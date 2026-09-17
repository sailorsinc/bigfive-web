// The Big Five-only view (the website and /api/analyze) — a view over the combined analyzer, D4
export { analyzeTranscript, toOceanAnalysis } from './ocean-analysis'
export type {
  TranscriptInput,
  OceanAnalysis,
  Evidence,
  Scores,
  DomainScore,
  FacetScore,
  StoredAnswer,
  AnalysisMetadata
} from './types'
export { assessContentQuality, shouldProceedWithAnalysis, getQualityScore } from './content-validator'
export type { ContentQualityMetrics } from './content-validator'

// Combined four-framework assessment (additive — OCEAN-only API above is unchanged)
export {
  CombinedAnalyzer,
  analyzeCombinedTranscript,
  TranscriptQualityError,
  SPIRAL_COLOR_PATTERN,
  scrubSpiralEmployerView,
  findVerbatimEvidence,
  validateCombinedOutput
} from './combined-analyzer'
export type {
  CombinedTranscriptInput,
  CombinedAnalysis,
  CombinedFrameworks,
  CombinedAnalysisMetadata,
  CombinedGPTRawOutput,
  ChatCompletionsClient,
  OceanDomainProfile,
  OceanDomainKey,
  SheetScaleProfile,
  SpiralOrientationKey,
  SpiralOrientationProfile
} from './combined-types'

// The V1 "sheets" — item pools + the shared scoring arithmetic
export { scoreSheet, validateSheetAnswers, keyedScore, calculateResult, toPercent, countNeutralAnswers } from './instruments/score-sheet'
export type { SheetItem, SheetScaleScore, SheetAnswers, Keyed, Level } from './instruments/score-sheet'
export { OCEAN_ITEMS, OCEAN_ITEM_IDS, OCEAN_DOMAINS, scoreOcean, domainName, facetName } from './instruments/ipip-neo-120'
export type { OceanItem, OceanDomainScore, OceanFacetScore } from './instruments/ipip-neo-120'
export { SDT_ITEMS, SDT_NEEDS, SDT_ITEM_IDS } from './instruments/sdt-needs'
export type { SdtNeedKey, SdtItem, SdtNeed } from './instruments/sdt-needs'
export { HSE_MSIT_ITEMS, HSE_MSIT_SCALES, HSE_MSIT_ITEM_IDS } from './instruments/hse-msit'
export type { JdrScaleKey, InstrumentItem, InstrumentScale } from './instruments/hse-msit'
export { COMBINED_SYSTEM_PROMPT, buildCombinedAnalysisPrompt } from './prompts/combined-assessment'
