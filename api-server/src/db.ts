import { MongoClient, Db, ObjectId } from 'mongodb'
import type { OceanAnalysis, CombinedAnalysis, Sitting } from '@bigfive-org/transcript-analyzer'

let cachedDb: Db | null = null

export async function connectToDatabase(): Promise<Db> {
  if (cachedDb) {
    return cachedDb
  }

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set')
  }

  const client = new MongoClient(uri)
  await client.connect()

  const dbName = process.env.DB_NAME || 'bigfive'
  const db = client.db(dbName)

  // Idempotency for contract-2 sittings is enforced by the database, not by a
  // find-then-insert: ONE stored result per (owner, sitting.id). Partial so
  // that pre-contract-2 documents (no sitting) are not in the index at all.
  // createIndex is idempotent. If it cannot be created (rights, a conflicting
  // pre-existing spec) we say so loudly and keep serving — reads still work,
  // but two concurrent first requests for one sitting could both be stored.
  try {
    await db.collection(process.env.DB_COLLECTION || 'results').createIndex(
      { owner: 1, 'sitting.id': 1 },
      { unique: true, partialFilterExpression: { type: 'combined', 'sitting.id': { $exists: true } }, name: 'combined_owner_sitting' }
    )
  } catch (err) {
    console.error('Could not create the combined_owner_sitting unique index — idempotency is not database-enforced:', err)
  }

  cachedDb = db
  return cachedDb
}

interface SaveAnalysisInput {
  transcript: string
  language: string
  jobRole?: string
  interviewType?: string
  analysis: OceanAnalysis
  metadata?: Record<string, any>
}

export async function saveAnalysis(input: SaveAnalysisInput): Promise<string> {
  const db = await connectToDatabase()
  const collection = db.collection(process.env.DB_COLLECTION || 'results')

  // The 120 keyed answers the model gave as the candidate — the same shape the
  // website stores for a human sitting, so its result page scores them from the
  // same answers. (Cut-offs differ until the owner aligns them: the website uses
  // the package default >3/<3, this API 2.5/3.5. Before the IPIP sheet this
  // faked 30 "answers" from facet ratings.)
  const answers = input.analysis.answers

  const document = {
    // Original format for compatibility
    answers,
    dateStamp: Date.now(),
    lang: input.language,

    // Transcript-specific fields
    type: 'transcript',
    transcript: {
      text: input.transcript,
      jobRole: input.jobRole,
      interviewType: input.interviewType,
      length: input.transcript.length
    },

    // Analysis results
    analysis: {
      evidence: input.analysis.evidence,
      confidence: input.analysis.confidence,
      reasoning: input.analysis.reasoning,
      metadata: input.analysis.metadata
    },

    // Additional metadata
    metadata: input.metadata || {}
  }

  const result = await collection.insertOne(document)
  return result.insertedId.toString()
}

// ---------------------------------------------------------------------------
// Combined four-framework assessment persistence (ADDITIVE — saveAnalysis and
// the existing document shapes are untouched).
//
// Deliberate difference from saveAnalysis: the combined document stores the
// assessment RESULT only — never the transcript text (byall port-doc decision 4;
// the caller keeps its own transcript copy).

/** Thrown when the unique (owner, sitting.id) index refuses a second insert — the route then replays the stored one. */
export class DuplicateSittingError extends Error {
  constructor(public readonly sittingId: string) {
    super(`A result for sitting ${sittingId} was stored concurrently`)
    this.name = 'DuplicateSittingError'
  }
}

interface SaveCombinedAnalysisInput {
  owner: string          // the caller's idempotency scope (a hash of the API key, or 'public')
  sitting: Sitting
  fingerprint: string    // a hash of the answered exchanges — a reused id with different content is refused
  exchangeCount: number
  transcriptLength: number
  contentQuality: string
  analysis: CombinedAnalysis
}

export async function saveCombinedAnalysis(input: SaveCombinedAnalysisInput): Promise<string> {
  const db = await connectToDatabase()
  const collection = db.collection(process.env.DB_COLLECTION || 'results')

  const document = {
    type: 'combined',
    contract: '2',
    dateStamp: Date.now(),
    lang: input.sitting.language || 'en',

    // Idempotency key: (owner, sitting.id), unique in the database.
    owner: input.owner,
    // The sitting, as sent — an id, a language, maybe a role. Never a name.
    sitting: input.sitting,
    fingerprint: input.fingerprint,

    // Transcript INFO only — no transcript text is persisted.
    transcriptInfo: {
      exchanges: input.exchangeCount,
      length: input.transcriptLength
    },

    combined: {
      confidence: input.analysis.confidence,
      contentQuality: input.contentQuality,
      coverage: input.analysis.coverage,
      frameworks: input.analysis.frameworks,
      metadata: input.analysis.metadata
    }
  }

  try {
    const result = await collection.insertOne(document)
    return result.insertedId.toString()
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) throw new DuplicateSittingError(input.sitting.id)
    throw err
  }
}

export interface StoredCombined {
  id: string
  fingerprint?: string
  contentQuality: string
  analysis: CombinedAnalysis
}

/** The stored result for (owner, sitting.id), if it was scored before (idempotent replay). */
export async function findCombinedBySittingId(owner: string, sittingId: string): Promise<StoredCombined | null> {
  const db = await connectToDatabase()
  const collection = db.collection(process.env.DB_COLLECTION || 'results')
  const doc = await collection.findOne({ type: 'combined', owner, 'sitting.id': sittingId })
  if (!doc) return null
  return {
    id: doc._id.toString(),
    fingerprint: doc.fingerprint,
    contentQuality: doc.combined?.contentQuality,
    analysis: {
      contract: '2',
      sitting: doc.sitting,
      coverage: doc.combined?.coverage,
      frameworks: doc.combined?.frameworks,
      confidence: doc.combined?.confidence,
      metadata: doc.combined?.metadata
    }
  }
}

interface GetAnalysisOptions {
  includeEvidence?: boolean
  includeTranscript?: boolean
}

export async function getAnalysisById(
  id: string,
  options: GetAnalysisOptions = {}
): Promise<any | null> {
  const db = await connectToDatabase()
  const collection = db.collection(process.env.DB_COLLECTION || 'results')

  const document = await collection.findOne({ _id: new ObjectId(id) })

  if (!document) {
    return null
  }

  // Combined four-framework documents have their own shape (no answers array).
  // ADDITIVE branch: only 'combined'-type documents (new) take this path;
  // every pre-existing document type flows through the original code below.
  if (document.type === 'combined') {
    return {
      id: document._id.toString(),
      timestamp: document.dateStamp,
      language: document.lang,
      type: 'combined',
      contract: document.contract,
      sitting: document.sitting,
      coverage: document.combined?.coverage,
      confidence: document.combined?.confidence,
      contentQuality: document.combined?.contentQuality,
      frameworks: document.combined?.frameworks,
      analysisMetadata: document.combined?.metadata,
      transcriptInfo: document.transcriptInfo
    }
  }

  // Build response based on options
  const response: any = {
    id: document._id.toString(),
    timestamp: document.dateStamp,
    language: document.lang,
    type: document.type,
    scores: {}
  }

  // Add domain scores
  const domains = ['O', 'C', 'E', 'A', 'N']
  domains.forEach(domain => {
    const domainAnswers = document.answers.filter((a: any) => a.domain === domain)
    const domainScore = domainAnswers.reduce((sum: number, a: any) => sum + a.score, 0)
    const avgScore = domainScore / domainAnswers.length
    // `count` tells the two generations apart: 6 per domain for pre-sheet
    // documents (one faked answer per facet), 24 for the real 120-item sheet.
    response.scores[domain] = {
      score: domainScore,
      count: domainAnswers.length,
      average: avgScore,
      result: avgScore > 3.5 ? 'high' : avgScore < 2.5 ? 'low' : 'neutral'
    }
  })

  // Add analysis metadata
  if (document.analysis) {
    response.confidence = document.analysis.confidence
    response.reasoning = document.analysis.reasoning

    if (options.includeEvidence && document.analysis.evidence) {
      response.evidence = document.analysis.evidence
    }

    if (document.analysis.metadata) {
      response.analysisMetadata = document.analysis.metadata
    }
  }

  // Add transcript info
  if (document.transcript) {
    response.transcriptInfo = {
      length: document.transcript.length,
      jobRole: document.transcript.jobRole,
      interviewType: document.transcript.interviewType,
    }

    if (options.includeTranscript) {
      response.transcript = document.transcript.text
    }
  }

  return response
}
