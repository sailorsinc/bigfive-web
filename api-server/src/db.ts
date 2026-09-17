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
  cachedDb = client.db(dbName)

  // Idempotency for contract-2 sittings: same sitting.id -> same stored result.
  // Sparse: pre-contract-2 documents have no sitting. createIndex is idempotent.
  await cachedDb.collection(process.env.DB_COLLECTION || 'results')
    .createIndex({ 'sitting.id': 1 }, { sparse: true, name: 'sitting_id' })

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
  // website stores for a human sitting, so its result page scores them the
  // same way. (Before the IPIP sheet this faked 30 "answers" from facet ratings.)
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

interface SaveCombinedAnalysisInput {
  sitting: Sitting
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

    // The sitting, as sent — an id, a language, maybe a role. Never a name.
    sitting: input.sitting,

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

  const result = await collection.insertOne(document)
  return result.insertedId.toString()
}

/** The stored result for a sitting, if it was scored before (idempotent replay). */
export async function findCombinedBySittingId(sittingId: string): Promise<
  { id: string; analysis: CombinedAnalysis; contentQuality: string } | null
> {
  const db = await connectToDatabase()
  const collection = db.collection(process.env.DB_COLLECTION || 'results')
  const doc = await collection.findOne({ type: 'combined', 'sitting.id': sittingId })
  if (!doc) return null
  return {
    id: doc._id.toString(),
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
    response.scores[domain] = {
      score: domainScore,
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
