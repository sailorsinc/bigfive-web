"use strict";
// Combined four-framework assessment prompt (OCEAN + SDT + JD-R + Spiral Dynamics).
// One call, JSON output, verbatim transcript evidence, deterministic seed,
// temperature 0.1. ADDITIVE module — the existing OCEAN-only prompt is untouched.
//
// V1 sheets: for SDT and JD-R the model no longer invents a 0-100 number per
// dimension. It ANSWERS AN ITEM POOL AS THE CANDIDATE (the same stand-in-
// respondent move the OCEAN facets make), and the server does the arithmetic.
// The item pools live in ../instruments and are rendered into the system
// prompt here so they sit in the cached prefix.
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMBINED_SYSTEM_PROMPT = void 0;
exports.buildCombinedAnalysisPrompt = buildCombinedAnalysisPrompt;
exports.buildCorrectionPrompt = buildCorrectionPrompt;
const sdt_needs_1 = require("../instruments/sdt-needs");
const hse_msit_1 = require("../instruments/hse-msit");
function renderSdtItems() {
    return sdt_needs_1.SDT_ITEMS.map(i => `${i.id}. ${i.text}`).join('\n');
}
function renderHseItems() {
    return hse_msit_1.HSE_MSIT_ITEMS.map(i => {
        const scale = i.response === 'frequency'
            ? '(1 Never · 2 Seldom · 3 Sometimes · 4 Often · 5 Always)'
            : '(1 Strongly disagree · 2 Disagree · 3 Neutral · 4 Agree · 5 Strongly agree)';
        return `${i.id}. ${i.text} ${scale}`;
    }).join('\n');
}
function renderScaleGuide(scales) {
    return scales.map(s => `- ${s.key} (${s.title}): high = ${s.high}`).join('\n');
}
exports.COMBINED_SYSTEM_PROMPT = `You are an expert industrial-organizational psychologist. Analyze the interview transcript and score the candidate across ALL FOUR psychological frameworks in a single assessment.

Every framework produces TWO things:
- "profile": full internal data for matching algorithms (never shown to employers)
- "employer_view": 3-6 short, plain-language, human-readable insight strings safe to show an employer (no psychological jargon, no framework names, no scores)

## Framework 1 — Big Five (OCEAN), Johnson 120 IPIP-NEO-PI-R facets

Score each of the 30 facets 1-5 (1 = very low, 2 = low, 3 = moderate/insufficient evidence, 4 = high, 5 = very high).

**O - Openness to Experience**
1. Imagination (fantasy-oriented vs practical)
2. Artistic Interests (appreciates art/beauty vs indifferent)
3. Emotionality (aware of feelings vs unaware)
4. Adventurousness (tries new things vs routine-oriented)
5. Intellect (enjoys abstract ideas vs concrete thinking)
6. Liberalism (challenges authority vs traditional values)

**C - Conscientiousness**
1. Self-Efficacy (confident in abilities vs doubts capabilities)
2. Orderliness (organized vs disorganized)
3. Dutifulness (follows rules vs casual about obligations)
4. Achievement-Striving (ambitious vs content with status quo)
5. Self-Discipline (finishes tasks vs procrastinates)
6. Cautiousness (thinks before acting vs impulsive)

**E - Extraversion**
1. Friendliness (warm and approachable vs reserved)
2. Gregariousness (sociable vs prefers solitude)
3. Assertiveness (takes charge vs stays in background)
4. Activity Level (fast-paced vs leisurely)
5. Excitement-Seeking (craves excitement vs prefers calm)
6. Cheerfulness (joyful and optimistic vs serious)

**A - Agreeableness**
1. Trust (believes in others vs suspicious)
2. Morality (straightforward vs manipulative)
3. Altruism (helps others vs self-focused)
4. Cooperation (defers to others vs competitive)
5. Modesty (humble vs proud of achievements)
6. Sympathy (soft-hearted vs tough-minded)

**N - Neuroticism**
1. Anxiety (worries frequently vs calm)
2. Anger (irritable vs even-tempered)
3. Depression (feels sad/discouraged vs content)
4. Self-Consciousness (shy in social situations vs confident)
5. Immoderation (resists temptation poorly vs disciplined with desires)
6. Vulnerability (handles stress poorly vs pressure-proof)

For each domain also provide:
- "reasoning": 1-2 sentences connecting observed behavior to the domain score
- "evidence": 2-3 quotes copied from the transcript CHARACTER-FOR-CHARACTER. Each evidence string MUST be an exact verbatim substring of the transcript — do not paraphrase, do not fix grammar, do not add or remove words or punctuation.

## Frameworks 2 and 3 — answer the items AS THE CANDIDATE

For SDT and JD-R you do not rate dimensions directly. You stand in for the candidate and answer a short questionnaire on their behalf, using ONLY what they said in the transcript about their typical or most recent work. Rules:
- Answer every item as written, on its own 1-5 scale. Do NOT reverse any item — the server handles scoring direction.
- If the transcript gives no evidence either way for an item, answer 3.
- Answer as the candidate would about themselves and their usual work, not as an observer judging them.

## Framework 2 — SDT basic needs (18 items, 1 Strongly disagree · 3 Neither · 5 Strongly agree)

${renderSdtItems()}

Scales (items 1-6 autonomy, 7-12 competence, 13-18 relatedness):
${renderScaleGuide(sdt_needs_1.SDT_NEEDS)}

For each of the three scales also provide "reasoning" (1-2 sentences) and "evidence" (1-3 verbatim transcript quotes). List "dominant_drivers": the 1-2 needs the candidate most clearly seeks at work, lowercase keys.

## Framework 3 — JD-R via the HSE Management Standards items (35 items)

${renderHseItems()}

Scales:
${renderScaleGuide(hse_msit_1.HSE_MSIT_SCALES)}

For each of the seven scales also provide "reasoning" (1-2 sentences) and "evidence" (1-3 verbatim transcript quotes). Also provide "sustainability": 1-2 sentences on the long-term energy/burnout outlook and the conditions under which this candidate stays energized.

## Framework 4 — Spiral Dynamics (INTERNAL PROFILE ONLY), score orientations 0-100

- structure_oriented (Blue): rules, procedures, loyalty, tradition, duty
- achievement_oriented (Orange): results, competition, efficiency, success
- people_oriented (Green): harmony, equality, collaboration, consensus
- systems_oriented (Yellow): integration, flexibility, multiple perspectives

For each orientation provide, under "orientation_evidence", "reasoning" (1 sentence) and "evidence" (1-2 verbatim transcript quotes). The profile also includes dominant_orientation, secondary_orientation (both one of the four keys above), communication_style, culture_fit_indicators, internal_tags, and a summary.

CRITICAL PRIVACY RULE: Spiral vMEME color labels (Blue, Orange, Green, Yellow, Turquoise, Red, Purple, Beige) are INTERNAL ONLY — they may appear inside spiral.profile and NOWHERE else. In spiral.employer_view (and every other employer_view) use ONLY neutral language:
- "process-oriented" instead of Blue
- "results-oriented" instead of Orange
- "relationship-oriented" instead of Green
- "adaptive/integrative" instead of Yellow
Never write a color word in any employer_view string.

## Guidelines

- Base ratings ONLY on observable behaviors and statements in the transcript
- Look for patterns across multiple statements, not single instances
- If insufficient evidence exists for a facet, item or dimension, score it neutral (3 for facets and items, ~50 for 0-100 scales) and reflect that in confidence
- Focus on HOW the person communicates and behaves, not WHAT they accomplished
- Every "evidence" string anywhere in the output must be an exact verbatim substring of the transcript
- employer_view strings are short, specific, professional, and free of jargon, framework names, numeric scores, and color labels
- Return a single valid JSON object and nothing else`;
function buildCombinedAnalysisPrompt(transcript, context) {
    const contextInfo = context?.candidateName || context?.jobRole
        ? `\n## Context\n- Candidate: ${context?.candidateName || 'Not specified'}\n- Job Role: ${context?.jobRole || 'Not specified'}\n`
        : '';
    return `Analyze this interview transcript across all four frameworks.
${contextInfo}
## Transcript

${transcript}

## Required Output

Provide a JSON object with this exact structure (pure JSON, no markdown):

{
  "ocean": {
    "domains": {
      "O": {
        "facets": {"1": 4, "2": 3, "3": 4, "4": 3, "5": 5, "6": 3},
        "reasoning": "Why the openness evidence supports these facet scores",
        "evidence": ["exact verbatim transcript substring", "another exact verbatim substring"]
      },
      "C": {"facets": {"1": 4, "2": 3, "3": 4, "4": 5, "5": 4, "6": 4}, "reasoning": "...", "evidence": ["..."]},
      "E": {"facets": {"1": 3, "2": 2, "3": 4, "4": 3, "5": 2, "6": 3}, "reasoning": "...", "evidence": ["..."]},
      "A": {"facets": {"1": 4, "2": 4, "3": 3, "4": 3, "5": 3, "6": 4}, "reasoning": "...", "evidence": ["..."]},
      "N": {"facets": {"1": 2, "2": 2, "3": 2, "4": 3, "5": 3, "6": 2}, "reasoning": "...", "evidence": ["..."]}
    },
    "employer_view": ["Plain-language personality insight", "..."]
  },
  "sdt": {
    "answers": {"1": 4, "2": 4, "3": 2, "4": 3, "5": 2, "6": 4, "7": 4, "8": 4, "9": 2, "10": 5, "11": 2, "12": 3, "13": 4, "14": 3, "15": 2, "16": 3, "17": 2, "18": 3},
    "scales": {
      "autonomy":    {"reasoning": "...", "evidence": ["exact verbatim transcript substring"]},
      "competence":  {"reasoning": "...", "evidence": ["..."]},
      "relatedness": {"reasoning": "...", "evidence": ["..."]}
    },
    "dominant_drivers": ["competence", "autonomy"],
    "employer_view": ["Plain-language motivation insight", "..."]
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
    "employer_view": ["Plain-language energy/sustainability insight", "..."]
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
      "dominant_orientation": "achievement_oriented",
      "secondary_orientation": "people_oriented",
      "communication_style": "How to best communicate with this candidate",
      "culture_fit_indicators": ["thrives in meritocratic environments"],
      "internal_tags": ["orange_primary", "green_secondary"],
      "summary": "2-3 sentence values summary"
    },
    "employer_view": ["Neutral-language work-style insight (no color words)", "..."]
  },
  "confidence": 0.78
}

Important: sdt.answers must have all 18 items and jdr.answers all 35, each 1-5, answered as written (not reversed). Every evidence string anywhere must be copied character-for-character from the transcript above. Every employer_view array must contain 3-6 short neutral strings with no color labels and no framework jargon.`;
}
function buildCorrectionPrompt(violations) {
    return `Your previous JSON response violated the output contract. Fix ALL of the following and return the complete corrected JSON object (same structure, all four frameworks):

${violations.map((v, i) => `${i + 1}. ${v}`).join('\n')}

Remember: sdt.answers needs all 18 items and jdr.answers all 35, each 1-5; every evidence string (ocean domains, sdt scales, jdr scales, spiral orientation_evidence) must be an exact verbatim substring of the transcript (character-for-character); and no employer_view string may contain a Spiral color label (Blue, Orange, Green, Yellow, Turquoise, Red, Purple, Beige). Return pure JSON only.`;
}
