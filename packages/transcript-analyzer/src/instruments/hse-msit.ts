// HSE Management Standards Indicator Tool (MSIT) — the JD-R "sheet".
//
// 35 items, 7 scales, 1-5. Source: UK Health and Safety Executive,
// https://www.hse.gov.uk/stress/standards/ — Crown copyright, released under the
// Open Government Licence v3 (free to use, including commercially, with
// attribution). Item text is reproduced verbatim from the HSE indicator tool.
//
// Keying: `keyed: 'plus'` means the answer scale runs 1..5 (Never..Always /
// Strongly disagree..Strongly agree) and a HIGH answer is GOOD; `keyed: 'minus'`
// means the tool prints 5..1 under the same labels — a HIGH answer is BAD and
// is reversed before scoring. Same convention as @bigfive-org/questions.
//
// In the transcript path the model answers each item AS THE CANDIDATE, from
// what they said in the interview, answering 3 where there is no evidence
// (the same rule the OCEAN facets use). Scoring is sum -> average -> the
// shared calculateResult cut-offs (<2.5 low, >3.5 high).

import type { SheetItem, Keyed } from './score-sheet'

export type JdrScaleKey =
  | 'demands'
  | 'control'
  | 'manager_support'
  | 'peer_support'
  | 'relationships'
  | 'role'
  | 'change'

export interface InstrumentItem extends SheetItem<JdrScaleKey> {
  id: number          // the tool's own item number (1-35)
  text: string        // verbatim
  keyed: Keyed
  response: 'frequency' | 'agreement'   // Never..Always vs Strongly disagree..Strongly agree
}

export interface InstrumentScale {
  key: JdrScaleKey
  title: string
  // Plain-language reading of a HIGH score (used by the prompt and the report)
  high: string
  low: string
  // JD-R family: the one demand scale vs the six resource scales
  family: 'demand' | 'resource'
}

export const HSE_MSIT_SCALES: InstrumentScale[] = [
  { key: 'demands', title: 'Demands', family: 'demand',
    high: 'copes with workload, pace and deadline pressure without being overwhelmed',
    low: 'is stretched thin by workload, pace or conflicting demands' },
  { key: 'control', title: 'Control', family: 'resource',
    high: 'has, and uses, real say over how, when and what they work on',
    low: 'has little say over how their work is done' },
  { key: 'manager_support', title: 'Managerial support', family: 'resource',
    high: 'draws on encouragement, feedback and backing from their manager',
    low: 'gets little support or feedback from their manager' },
  { key: 'peer_support', title: 'Peer support', family: 'resource',
    high: 'leans on colleagues for help and is respected by them',
    low: 'works without much help from colleagues' },
  { key: 'relationships', title: 'Relationships', family: 'resource',
    high: 'works in relationships free of friction, harassment or bullying',
    low: 'experiences strained or hostile working relationships' },
  { key: 'role', title: 'Role', family: 'resource',
    high: 'is clear on what is expected, their duties and how their work fits the whole',
    low: 'is unclear on expectations, duties or purpose' },
  { key: 'change', title: 'Change', family: 'resource',
    high: 'is consulted about change and understands how it will play out',
    low: 'finds change imposed and unexplained' }
]

// Item -> scale mapping follows the HSE Management Standards Analysis Tool:
//   Demands 3 6 9 12 16 18 20 22 · Control 2 10 15 19 25 30
//   Managerial support 8 23 29 33 35 · Peer support 7 24 27 31
//   Relationships 5 14 21 34 · Role 1 4 11 13 17 · Change 26 28 32
export const HSE_MSIT_ITEMS: InstrumentItem[] = [
  { id: 1,  scale: 'role',            keyed: 'plus',  response: 'frequency', text: 'I am clear what is expected of me at work' },
  { id: 2,  scale: 'control',         keyed: 'plus',  response: 'frequency', text: 'I can decide when to take a break' },
  { id: 3,  scale: 'demands',         keyed: 'minus', response: 'frequency', text: 'Different groups at work demand things from me that are hard to combine' },
  { id: 4,  scale: 'role',            keyed: 'plus',  response: 'frequency', text: 'I know how to go about getting my job done' },
  { id: 5,  scale: 'relationships',   keyed: 'minus', response: 'frequency', text: 'I am subject to personal harassment in the form of unkind words or behaviour' },
  { id: 6,  scale: 'demands',         keyed: 'minus', response: 'frequency', text: 'I have unachievable deadlines' },
  { id: 7,  scale: 'peer_support',    keyed: 'plus',  response: 'frequency', text: 'If work gets difficult, my colleagues will help me' },
  { id: 8,  scale: 'manager_support', keyed: 'plus',  response: 'frequency', text: 'I am given supportive feedback on the work I do' },
  { id: 9,  scale: 'demands',         keyed: 'minus', response: 'frequency', text: 'I have to work very intensively' },
  { id: 10, scale: 'control',         keyed: 'plus',  response: 'frequency', text: 'I have a say in my own work speed' },
  { id: 11, scale: 'role',            keyed: 'plus',  response: 'frequency', text: 'I am clear what my duties and responsibilities are' },
  { id: 12, scale: 'demands',         keyed: 'minus', response: 'frequency', text: 'I have to neglect some tasks because I have too much to do' },
  { id: 13, scale: 'role',            keyed: 'plus',  response: 'frequency', text: 'I am clear about the goals and objectives for my department' },
  { id: 14, scale: 'relationships',   keyed: 'minus', response: 'frequency', text: 'There is friction or anger between colleagues' },
  { id: 15, scale: 'control',         keyed: 'plus',  response: 'frequency', text: 'I have a choice in deciding how I do my work' },
  { id: 16, scale: 'demands',         keyed: 'minus', response: 'frequency', text: 'I am unable to take sufficient breaks' },
  { id: 17, scale: 'role',            keyed: 'plus',  response: 'frequency', text: 'I understand how my work fits into the overall aim of the organisation' },
  { id: 18, scale: 'demands',         keyed: 'minus', response: 'frequency', text: 'I am pressured to work long hours' },
  { id: 19, scale: 'control',         keyed: 'plus',  response: 'frequency', text: 'I have a choice in deciding what I do at work' },
  { id: 20, scale: 'demands',         keyed: 'minus', response: 'frequency', text: 'I have to work very fast' },
  { id: 21, scale: 'relationships',   keyed: 'minus', response: 'frequency', text: 'I am subject to bullying at work' },
  { id: 22, scale: 'demands',         keyed: 'minus', response: 'frequency', text: 'I have unrealistic time pressures' },
  { id: 23, scale: 'manager_support', keyed: 'plus',  response: 'frequency', text: 'I can rely on my line manager to help me out with a work problem' },
  { id: 24, scale: 'peer_support',    keyed: 'plus',  response: 'agreement', text: 'I get help and support I need from colleagues' },
  { id: 25, scale: 'control',         keyed: 'plus',  response: 'agreement', text: 'I have some say over the way I work' },
  { id: 26, scale: 'change',          keyed: 'plus',  response: 'agreement', text: 'I have sufficient opportunities to question managers about change at work' },
  { id: 27, scale: 'peer_support',    keyed: 'plus',  response: 'agreement', text: 'I receive the respect at work I deserve from my colleagues' },
  { id: 28, scale: 'change',          keyed: 'plus',  response: 'agreement', text: 'Staff are always consulted about change at work' },
  { id: 29, scale: 'manager_support', keyed: 'plus',  response: 'agreement', text: 'I can talk to my line manager about something that has upset or annoyed me about work' },
  { id: 30, scale: 'control',         keyed: 'plus',  response: 'agreement', text: 'My working time can be flexible' },
  { id: 31, scale: 'peer_support',    keyed: 'plus',  response: 'agreement', text: 'My colleagues are willing to listen to my work-related problems' },
  { id: 32, scale: 'change',          keyed: 'plus',  response: 'agreement', text: 'When changes are made at work, I am clear how they will work out in practice' },
  { id: 33, scale: 'manager_support', keyed: 'plus',  response: 'agreement', text: 'I am supported through emotionally demanding work' },
  { id: 34, scale: 'relationships',   keyed: 'minus', response: 'agreement', text: 'Relationships at work are strained' },
  { id: 35, scale: 'manager_support', keyed: 'plus',  response: 'agreement', text: 'My line manager encourages me at work' }
]

export const HSE_MSIT_ITEM_IDS = HSE_MSIT_ITEMS.map(i => String(i.id))
