"use strict";
// SDT basic-need satisfaction — the SDT "sheet".
//
// STRUCTURE: three needs x six items, 1-5 agreement, mixed keying — modelled
// on the Work-related Basic Need Satisfaction scale (W-BNS; Van den Broeck,
// Vansteenkiste, De Witte, Soenens & Lens, 2010, J. Occup. Organ. Psychol.
// 83:981-1002) and its English validation (Frontiers in Psychology, 2024).
//
// ITEMS: AUTHORED HERE. The W-BNS items and the Center for Self-Determination
// Theory's scales are licensed for non-commercial research only (CSDT terms,
// checked 2026-09-16), so their wording is NOT reproduced. These items are
// byall's own plain-language pool expressing the same three constructs — the
// same move the public-domain IPIP pool made for the NEO facets. They are
// not psychometrically validated as a scale; the structure and cut-offs are
// borrowed, the wording is ours. Label them honestly wherever they surface.
//
// In the transcript path the model answers each item AS THE CANDIDATE, from
// what they said in the interview, answering 3 where there is no evidence.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDT_ITEM_IDS = exports.SDT_ITEMS = exports.SDT_NEEDS = void 0;
exports.SDT_NEEDS = [
    { key: 'autonomy', title: 'Autonomy',
        about: 'feeling free to decide how, when and what they work on, and that the work reflects what they think matters',
        high: 'works best with real say over how things are done',
        low: 'feels boxed in by how work is handed down' },
    { key: 'competence', title: 'Competence',
        about: 'feeling capable and effective at the work, and getting better at it',
        high: 'feels on top of the hard parts of the job and keeps growing',
        low: 'often feels out of their depth or unsure of their footing' },
    { key: 'relatedness', title: 'Relatedness',
        about: 'feeling connected to, and cared about by, the people they work with',
        high: 'feels part of the team and has people at work who matter to them',
        low: 'feels on the outside of the group at work' }
];
exports.SDT_ITEMS = [
    // Autonomy
    { id: 1, scale: 'autonomy', keyed: 'plus', text: 'I feel free to decide how I go about my work' },
    { id: 2, scale: 'autonomy', keyed: 'plus', text: 'The way I work reflects what I think matters' },
    { id: 3, scale: 'autonomy', keyed: 'minus', text: 'I feel forced to do my work in a way I would not choose' },
    { id: 4, scale: 'autonomy', keyed: 'plus', text: 'I can shape what I take on at work' },
    { id: 5, scale: 'autonomy', keyed: 'minus', text: 'At work I mostly do what I am told, whether I agree with it or not' },
    { id: 6, scale: 'autonomy', keyed: 'plus', text: 'I feel like myself when I am working' },
    // Competence
    { id: 7, scale: 'competence', keyed: 'plus', text: 'I feel good at what I do' },
    { id: 8, scale: 'competence', keyed: 'plus', text: 'I can handle the hard parts of my job' },
    { id: 9, scale: 'competence', keyed: 'minus', text: 'I doubt whether I am able to do my work well' },
    { id: 10, scale: 'competence', keyed: 'plus', text: 'I keep getting better at the things my work needs' },
    { id: 11, scale: 'competence', keyed: 'minus', text: 'I feel out of my depth at work' },
    { id: 12, scale: 'competence', keyed: 'plus', text: 'People come to me because I know my stuff' },
    // Relatedness
    { id: 13, scale: 'relatedness', keyed: 'plus', text: 'I belong to a team that feels like mine' },
    { id: 14, scale: 'relatedness', keyed: 'plus', text: 'There are people at work I can be honest with about what is on my mind' },
    { id: 15, scale: 'relatedness', keyed: 'minus', text: 'At work I feel like an outsider' },
    { id: 16, scale: 'relatedness', keyed: 'plus', text: 'Some of the people I work with are real friends' },
    { id: 17, scale: 'relatedness', keyed: 'minus', text: 'I keep to myself at work and nobody would notice if I left' },
    { id: 18, scale: 'relatedness', keyed: 'plus', text: 'My colleagues care how I am doing' }
];
exports.SDT_ITEM_IDS = exports.SDT_ITEMS.map(i => String(i.id));
