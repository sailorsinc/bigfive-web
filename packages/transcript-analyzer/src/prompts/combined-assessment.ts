// Combined four-framework assessment prompt (OCEAN + SDT + JD-R + Spiral Dynamics).
// One call, JSON output, verbatim transcript evidence, deterministic seed,
// temperature 0.1.
//
// Everything is a sheet: for Big Five, SDT and JD-R the model does not rate
// dimensions — it ANSWERS AN ITEM POOL AS THE CANDIDATE and the server does
// the arithmetic. The item pools are rendered from ../instruments (which in
// turn read the published @bigfive-org packages for Big Five), so no item or
// facet name is typed in this file. They sit in the system prompt, the
// cached prefix.

import { OCEAN_ITEMS, OCEAN_DOMAINS, domainName } from '../instruments/ipip-neo-120'
import { SDT_ITEMS, SDT_NEEDS } from '../instruments/sdt-needs'
import { HSE_MSIT_ITEMS, HSE_MSIT_SCALES } from '../instruments/hse-msit'

function renderOceanItems(): string {
  return OCEAN_ITEMS.map(i => `${i.id}. ${i.text}`).join('\n')
}

function renderSdtItems(): string {
  return SDT_ITEMS.map(i => `${i.id}. ${i.text}`).join('\n')
}

function renderHseItems(): string {
  return HSE_MSIT_ITEMS.map(i => {
    const scale = i.response === 'frequency'
      ? '(1 Never · 2 Seldom · 3 Sometimes · 4 Often · 5 Always)'
      : '(1 Strongly disagree · 2 Disagree · 3 Neutral · 4 Agree · 5 Strongly agree)'
    return `${i.id}. ${i.text} ${scale}`
  }).join('\n')
}

function renderScaleGuide(scales: Array<{ key: string; title: string; high: string }>): string {
  return scales.map(s => `- ${s.key} (${s.title}): high = ${s.high}`).join('\n')
}

function renderOceanDomains(): string {
  return OCEAN_DOMAINS.map(d => `- ${d}: ${domainName(d)}`).join('\n')
}

export const COMBINED_SYSTEM_PROMPT = `You are an expert industrial-organizational psychologist. Analyze the interview transcript and score the candidate across ALL FOUR psychological frameworks in a single assessment.

Every framework produces TWO things:
- "profile": full internal data for matching algorithms (never shown to employers)
- "employer_view": 3-6 short, plain-language, human-readable insight strings safe to show an employer (no psychological jargon, no framework names, no scores). Put the single most useful sentence FIRST — it is the headline.

## How to answer the questionnaires (frameworks 1-3)

You do not rate traits. You stand in for the candidate and answer each questionnaire item on their behalf, using ONLY what they said in the transcript about themselves and their usual work. Rules:
- Answer every item as written, on the scale given. Do NOT reverse any item — the server handles scoring direction.
- If the transcript gives no evidence either way for an item, answer 3.
- Answer as the candidate would about themselves, not as an observer judging them.
- Use the whole transcript for every item, not just the answer that seems most related.

## Framework 1 — Big Five: Johnson's IPIP-NEO-120 (120 items, 1 Very Inaccurate · 2 Moderately Inaccurate · 3 Neither · 4 Moderately Accurate · 5 Very Accurate)

Each item is a statement about the candidate ("Worry about things", "Make friends easily"). Answer how accurately it describes them.

${renderOceanItems()}

Domains:
${renderOceanDomains()}

For each of the five domains also provide "reasoning" (1-2 sentences connecting observed behaviour to the domain) and "evidence" (2-3 quotes copied from the transcript CHARACTER-FOR-CHARACTER).

## Framework 2 — SDT basic needs (18 items, 1 Strongly disagree · 3 Neither · 5 Strongly agree)

${renderSdtItems()}

Scales (items 1-6 autonomy, 7-12 competence, 13-18 relatedness):
${renderScaleGuide(SDT_NEEDS)}

For each of the three scales also provide "reasoning" (1-2 sentences) and "evidence" (1-3 verbatim transcript quotes).

## Framework 3 — JD-R via the HSE Management Standards items (35 items)

${renderHseItems()}

Scales:
${renderScaleGuide(HSE_MSIT_SCALES)}

For each of the seven scales also provide "reasoning" (1-2 sentences) and "evidence" (1-3 verbatim transcript quotes). Also provide "sustainability": 1-2 sentences on the long-term energy/burnout outlook and the conditions under which this candidate stays energized.

## Framework 4 — Spiral Dynamics (INTERNAL PROFILE ONLY), score orientations 0-100

- structure_oriented (Blue): rules, procedures, loyalty, tradition, duty
- achievement_oriented (Orange): results, competition, efficiency, success
- people_oriented (Green): harmony, equality, collaboration, consensus
- systems_oriented (Yellow): integration, flexibility, multiple perspectives

For each orientation provide, under "orientation_evidence", "reasoning" (1 sentence) and "evidence" (1-2 verbatim transcript quotes). The profile also includes communication_style, culture_fit_indicators, internal_tags, and a summary.

CRITICAL PRIVACY RULE: Spiral vMEME color labels (Blue, Orange, Green, Yellow, Turquoise, Red, Purple, Beige) are INTERNAL ONLY — they may appear inside spiral.profile and NOWHERE else. In spiral.employer_view (and every other employer_view) use ONLY neutral language:
- "process-oriented" instead of Blue
- "results-oriented" instead of Orange
- "relationship-oriented" instead of Green
- "adaptive/integrative" instead of Yellow
Never write a color word in any employer_view string.

## Guidelines

- Base every answer ONLY on observable behaviors and statements in the transcript
- Look for patterns across multiple statements, not single instances
- If insufficient evidence exists for an item or dimension, answer neutral (3 for items, ~50 for 0-100 scales) and reflect that in confidence
- Focus on HOW the person communicates and behaves, not WHAT they accomplished
- Every "evidence" string anywhere in the output must be an exact verbatim substring of the transcript
- employer_view strings are short, specific, professional, and free of jargon, framework names, numeric scores, and color labels
- Return a single valid JSON object and nothing else`

export function buildCombinedAnalysisPrompt(
  transcript: string,
  context?: { candidateName?: string; jobRole?: string }
): string {
  const contextInfo = context?.candidateName || context?.jobRole
    ? `\n## Context\n- Candidate: ${context?.candidateName || 'Not specified'}\n- Job Role: ${context?.jobRole || 'Not specified'}\n`
    : ''

  return `Analyze this interview transcript across all four frameworks.
${contextInfo}
## Transcript

${transcript}

## Required Output

Provide a JSON object with this exact structure (pure JSON, no markdown):

{
  "ocean": {
    "answers": {"1": 4, "2": 2, "3": 4, "4": 3, "5": 5, "...": "...", "120": 3},
    "domains": {
      "O": {"reasoning": "Why the openness evidence supports these answers", "evidence": ["exact verbatim transcript substring", "another exact verbatim substring"]},
      "C": {"reasoning": "...", "evidence": ["..."]},
      "E": {"reasoning": "...", "evidence": ["..."]},
      "A": {"reasoning": "...", "evidence": ["..."]},
      "N": {"reasoning": "...", "evidence": ["..."]}
    },
    "employer_view": ["The headline personality insight", "Plain-language insight", "..."]
  },
  "sdt": {
    "answers": {"1": 4, "2": 4, "3": 2, "4": 3, "5": 2, "6": 4, "7": 4, "8": 4, "9": 2, "10": 5, "11": 2, "12": 3, "13": 4, "14": 3, "15": 2, "16": 3, "17": 2, "18": 3},
    "scales": {
      "autonomy":    {"reasoning": "...", "evidence": ["exact verbatim transcript substring"]},
      "competence":  {"reasoning": "...", "evidence": ["..."]},
      "relatedness": {"reasoning": "...", "evidence": ["..."]}
    },
    "employer_view": ["The headline motivation insight", "..."]
  },
  "jdr": {
    "answers": {"1": 4, "2": 3, "3": 3, "4": 4, "5": 1, "6": 3, "7": 4, "8": 4, "9": 4, "10": 3, "11": 4, "12": 3, "13": 3, "14": 2, "15": 4, "16": 3, "17": 4, "18": 3, "19": 3, "20": 4, "21": 1, "22": 3, "23": 3, "24": 4, "25": 4, "26": 3, "27": 4, "28": 3, "29": 3, "30": 3, "31": 4, "32": 3, "33": 3, "34": 2, "35": 3},
    "scales": {
      "demands":         {"reasoning": "...", "evidence": ["..."]},
      "control":         {"reasoning": "...", "evidence": ["..."]},
      "manager_support": {"reasoning": "...", "evidence": ["..."]},
      "peer_support":    {"reasoning": "...", "evidence": ["..."]},
      "relationships":   {"reasoning": "...", "evidence": ["..."]},
      "role":            {"reasoning": "...", "evidence": ["..."]},
      "change":          {"reasoning": "...", "evidence": ["..."]}
    },
    "sustainability": "1-2 sentence long-term energy outlook",
    "employer_view": ["The headline energy/sustainability insight", "..."]
  },
  "spiral": {
    "profile": {
      "structure_oriented": 40,
      "achievement_oriented": 70,
      "people_oriented": 55,
      "systems_oriented": 45,
      "orientation_evidence": {
        "structure_oriented":   {"reasoning": "...", "evidence": ["..."]},
        "achievement_oriented": {"reasoning": "...", "evidence": ["..."]},
        "people_oriented":      {"reasoning": "...", "evidence": ["..."]},
        "systems_oriented":     {"reasoning": "...", "evidence": ["..."]}
      },
      "communication_style": "How to best communicate with this candidate",
      "culture_fit_indicators": ["thrives in meritocratic environments"],
      "internal_tags": ["orange_primary", "green_secondary"],
      "summary": "2-3 sentence values summary"
    },
    "employer_view": ["The headline work-style insight (no color words)", "..."]
  },
  "confidence": 0.78
}

Important: ocean.answers must have all 120 items, sdt.answers all 18 and jdr.answers all 35, each 1-5, answered as written (not reversed). Every evidence string anywhere must be copied character-for-character from the transcript above. Every employer_view array must contain 3-6 short neutral strings, headline first, with no color labels and no framework jargon.`
}

export function buildCorrectionPrompt(violations: string[]): string {
  return `Your previous JSON response violated the output contract. Fix ALL of the following and return the complete corrected JSON object (same structure, all four frameworks):

${violations.map((v, i) => `${i + 1}. ${v}`).join('\n')}

Remember: ocean.answers needs all 120 items, sdt.answers all 18 and jdr.answers all 35, each 1-5; every evidence string (ocean domains, sdt scales, jdr scales, spiral orientation_evidence) must be an exact verbatim substring of the transcript (character-for-character); and no employer_view string may contain a Spiral color label (Blue, Orange, Green, Yellow, Turquoise, Red, Purple, Beige). Return pure JSON only.`
}
