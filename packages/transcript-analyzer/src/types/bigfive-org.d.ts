// Typings for the two deep imports the IPIP adapter makes into the published
// @bigfive-org packages (their index.d.ts files don't cover these paths).

declare module '@bigfive-org/results/lib/get-template' {
  interface TemplateFacet { facet: number; title: string; text: string }
  interface TemplateDomain {
    domain: string
    title: string
    shortDescription: string
    description: string
    results: Array<{ score: 'low' | 'neutral' | 'high'; text: string }>
    facets: TemplateFacet[]
  }
  function getTemplate(lang: string): TemplateDomain[]
  export = getTemplate
}
