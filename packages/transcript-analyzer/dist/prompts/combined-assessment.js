"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMBINED_SYSTEM_PROMPT = void 0;
exports.renderExchanges = renderExchanges;
exports.buildCombinedAnalysisPrompt = buildCombinedAnalysisPrompt;
exports.buildCorrectionPrompt = buildCorrectionPrompt;
const ipip_neo_120_1 = require("../instruments/ipip-neo-120");
const sdt_needs_1 = require("../instruments/sdt-needs");
const hse_msit_1 = require("../instruments/hse-msit");
const exchanges_1 = require("../exchanges");
/**
 * The interview as the model reads it. Same "Interviewer: / Candidate:" lines
 * byall's transcript_text() produced, plus each exchange's number and themes as
 * a hint line — quotes are still matched against the candidate ANSWERS only.
 */
function renderExchanges(exchanges) {
    return (0, exchanges_1.answeredExchanges)(exchanges)
        .map(e => {
        const themes = e.themes?.length ? ` (themes: ${e.themes.join(', ')})` : '';
        return `Exchange ${e.n}${themes}\nInterviewer: ${e.question}\nCandidate: ${e.answer}`;
    })
        .join('\n\n');
}
function renderOceanItems() {
    return ipip_neo_120_1.OCEAN_ITEMS.map(i => `${i.id}. ${i.text}`).join('\n');
}
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
function renderOceanDomains() {
    return ipip_neo_120_1.OCEAN_DOMAINS.map(d => `- ${d}: ${(0, ipip_neo_120_1.domainName)(d)}`).join('\n');
}
exports.COMBINED_SYSTEM_PROMPT = `You are an expert industrial-organizational psychologist. Analyze the interview transcript and score the candidate across ALL FOUR psychological frameworks in a single assessment.

Every framework produces THREE things:
- "profile": full internal data for matching algorithms (never shown to employers)
- "employer_view": 3-6 short, plain-language, human-readable insight strings safe to show an employer (no psychological jargon, no framework names, no scores). Put the single most useful sentence FIRST — it is the headline.
- "confidence": 0-1, how much evidence THIS framework had in the transcript (an interview that never touched motivation gives SDT a low confidence even if the others are solid)

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
${renderScaleGuide(sdt_needs_1.SDT_NEEDS)}

For each of the three scales also provide "reasoning" (1-2 sentences) and "evidence" (1-3 verbatim transcript quotes).

## Framework 3 — JD-R via the HSE Management Standards items (35 items)

${renderHseItems()}

Scales:
${renderScaleGuide(hse_msit_1.HSE_MSIT_SCALES)}

For each of the seven scales also provide "reasoning" (1-2 sentences) and "evidence" (1-3 verbatim transcript quotes). Also provide "sustainability": 1-2 sentences on the long-term energy/burnout outlook and the conditions under which this candidate stays energized.

Also provide "energy_areas": three readings of what usually happens for this candidate. These are not questionnaire items and get no number or level. For each area give "line" (one short, plain sentence about the candidate, no name, no jargon, e.g. "Gets energy from ...") and "evidence" (1-2 verbatim transcript quotes).

Read the energy areas on their own, from the whole transcript. A quote you already used for a scale above may ALSO be used here: one story can show both a workplace condition and what charges or drains the person. Never leave an area empty because its story went to a scale.

One concrete story is enough for a line: a day, an episode, or something they keep doing. What does NOT count: today or this week only, a bare list with no example, a general claim like "I love challenges" or "I handle pressure well".

- energy_givers: what usually charges them. It counts: a concrete day with what charged them; an activity they keep choosing in their free time; "time flies" with an example.
- energy_drainers: what usually costs them energy. It counts: a concrete episode with the drain and what they did about it ("Every minute was checked. I left after a year."); what makes a day feel long, with an example; something draining they avoided or changed (stepped down, asked to move, left). It does not count: complaints about other people, drains rooted in health, tiredness this week.
- recovery_pressure: how they usually handle busy periods and how they recharge. It counts: a usual pattern with an example (likes peaks then takes a day off; keeps a fixed evening or activity even in busy weeks); a concrete recharge episode (a walk alone, a weekend away, phone off); what they did when it got too much. A recharge activity done with others still belongs here, even if it also says something about the people around them. Leave out sleep, health and medication entirely. Never write "burnout risk" or "vulnerable"; describe behaviour.

If nothing the candidate said speaks to an area, give it "line": "" and "evidence": [] — never guess.

## Framework 4 — Spiral Dynamics (INTERNAL PROFILE ONLY), score orientations 0-100

- structure_oriented (Blue): security and structure — safety, stability, reliability, agreed rules
- achievement_oriented (Orange): achievement and results — success, results, progress, recognition
- people_oriented (Green): care and fairness — people's wellbeing, honesty, fair treatment
- systems_oriented (Yellow): freedom and discovery — independence, their own path, new experiences

Values show ONLY in choices that cost something: the person gave up money, comfort, time, approval or safety for what mattered more. Note what was chosen AND what was given up. A choice forced by circumstance (no money, no alternative) is not a value choice. A value is never read from an opinion ("fairness matters to me"), from an either/or question, from being organised, from wanting to learn or grow, or from things they did well. An orientation with no costly choice in the transcript stays at 50.

Easily confused:
- being organised or careful is not security and structure; choosing predictability at a cost is (e.g. a permanent job over a better-paid uncertain one)
- getting good at something, or doing it well, is not achievement and results; working or risking something for a result or recognition is
- wanting a say over how and when they work is a need, not freedom and discovery; giving up stability for independence or something new is
- being friendly is not care and fairness; keeping their word or being honest when it costs them is

For each orientation provide, under "orientation_evidence", "reasoning" (1 sentence) and "evidence" (1-2 verbatim transcript quotes). The profile also includes communication_style, culture_fit_indicators, internal_tags, and a summary.

CRITICAL PRIVACY RULE: Spiral vMEME color labels (Blue, Orange, Green, Yellow, Turquoise, Red, Purple, Beige) are INTERNAL ONLY — they may appear inside spiral.profile and NOWHERE else. In spiral.employer_view (and every other employer_view) use ONLY neutral language:
- "values security and structure" instead of Blue
- "results-oriented" instead of Orange
- "values care and fairness" instead of Green
- "values freedom and discovery" instead of Yellow
Never write a color word in any employer_view string.

## Guidelines

- Base every answer ONLY on observable behaviors and statements in the transcript
- For the questionnaire items, look for patterns across multiple statements, not single instances (the energy areas and the values follow their own rules above)
- If insufficient evidence exists for an item or dimension, answer neutral (3 for items, ~50 for 0-100 scales) and reflect that in confidence
- Focus on HOW the person communicates and behaves, not WHAT they accomplished
- Every "evidence" string anywhere in the output must be an exact verbatim substring of a CANDIDATE answer — never of an interviewer question
- employer_view strings are short, specific, professional, and free of jargon, framework names, numeric scores, and color labels
- Return a single valid JSON object and nothing else`;
function buildCombinedAnalysisPrompt(transcript, context) {
    const lines = [];
    if (context?.jobRole)
        lines.push(`- Job Role: ${context.jobRole}`);
    if (context?.interviewType) {
        lines.push(`- Interview Type: ${context.interviewType}`);
        lines.push('- A technical or narrowly-scoped interview may not show the full personality range: read the absence of evidence as "no evidence" (answer 3), never as a low score.');
    }
    const contextInfo = lines.length ? `\n## Context\n${lines.join('\n')}\n` : '';
    return `Analyze this interview transcript across all four frameworks.
${contextInfo}
## Transcript

${transcript}

## Required Output

Provide a JSON object with this exact structure (pure JSON, no markdown). This is an OUTLINE, not an example: every <angle-bracket> placeholder stands for YOUR OWN value for THIS candidate, written as a plain number or string. The outline contains no numbers to copy.

{
  "ocean": {
    "answers": {"1": <1-5>, "2": <1-5>, "...": "...", "120": <1-5>},
    "domains": {
      "O": {"reasoning": "Why the openness evidence supports these answers", "evidence": ["exact verbatim transcript substring", "another exact verbatim substring"]},
      "C": {"reasoning": "...", "evidence": ["..."]},
      "E": {"reasoning": "...", "evidence": ["..."]},
      "A": {"reasoning": "...", "evidence": ["..."]},
      "N": {"reasoning": "...", "evidence": ["..."]}
    },
    "employer_view": ["The headline personality insight", "Plain-language insight", "..."],
    "confidence": <0-1>
  },
  "sdt": {
    "answers": {"1": <1-5>, "2": <1-5>, "...": "...", "18": <1-5>},
    "scales": {
      "autonomy":    {"reasoning": "...", "evidence": ["exact verbatim transcript substring"]},
      "competence":  {"reasoning": "...", "evidence": ["..."]},
      "relatedness": {"reasoning": "...", "evidence": ["..."]}
    },
    "employer_view": ["The headline motivation insight", "..."],
    "confidence": <0-1>
  },
  "jdr": {
    "answers": {"1": <1-5>, "2": <1-5>, "...": "...", "35": <1-5>},
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
    "energy_areas": {
      "energy_givers":     {"line": "<one plain sentence, or \"\" if nothing was said>", "evidence": ["<exact verbatim transcript substring>"]},
      "energy_drainers":   {"line": "<one plain sentence, or \"\">", "evidence": ["<...>"]},
      "recovery_pressure": {"line": "<one plain sentence, or \"\">", "evidence": ["<...>"]}
    },
    "employer_view": ["The headline energy/sustainability insight", "..."],
    "confidence": <0-1>
  },
  "spiral": {
    "profile": {
      "structure_oriented": <0-100>,
      "achievement_oriented": <0-100>,
      "people_oriented": <0-100>,
      "systems_oriented": <0-100>,
      "orientation_evidence": {
        "structure_oriented":   {"reasoning": "...", "evidence": ["..."]},
        "achievement_oriented": {"reasoning": "...", "evidence": ["..."]},
        "people_oriented":      {"reasoning": "...", "evidence": ["..."]},
        "systems_oriented":     {"reasoning": "...", "evidence": ["..."]}
      },
      "communication_style": "How to best communicate with this candidate",
      "culture_fit_indicators": ["<short indicator>", "..."],
      "internal_tags": ["<tag>", "..."],
      "summary": "2-3 sentence values summary"
    },
    "employer_view": ["The headline work-style insight (no color words)", "..."],
    "confidence": <0-1>
  },
  "confidence": <0-1>
}

Important: ocean.answers must have all 120 items, sdt.answers all 18 and jdr.answers all 35, each 1-5, answered as written (not reversed). Every evidence string anywhere must be copied character-for-character from a candidate answer above — never from a question. Every employer_view array must contain 3-6 short neutral strings, headline first, with no color labels and no framework jargon.`;
}
function buildCorrectionPrompt(violations) {
    return `Your previous JSON response violated the output contract. Fix ALL of the following and return the complete corrected JSON object (same structure, all four frameworks):

${violations.map((v, i) => `${i + 1}. ${v}`).join('\n')}

Remember: ocean.answers needs all 120 items, sdt.answers all 18 and jdr.answers all 35, each 1-5; every evidence string (ocean domains, sdt scales, jdr scales, jdr energy_areas, spiral orientation_evidence) must be an exact verbatim substring of a CANDIDATE answer (character-for-character, never from a question); and no employer_view string may contain a Spiral color label (Blue, Orange, Green, Yellow, Turquoise, Red, Purple, Beige). Return pure JSON only.`;
}
