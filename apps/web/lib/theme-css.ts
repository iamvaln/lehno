import { themes, cssVariables } from "@lehno/tokens";

// Seule source des couleurs : @lehno/tokens. Les recopier dans une feuille de style
// en donnerait deux exemplaires que rien n'obligerait à concorder, et leur dérive
// casserait le mode sombre sans qu'aucun test ne le voie.
export const themeCss = `
:root[data-theme="light"] { ${cssVariables(themes.light)} }
:root[data-theme="dark"]  { ${cssVariables(themes.dark)} }
`.trim();
