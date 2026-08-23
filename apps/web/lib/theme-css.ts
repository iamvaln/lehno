import { cssVariables, cssTokens, cssAdmin } from "@lehno/tokens";

// La surcharge du back-office est émise ici aussi : elle ne coûte que sa taille
// tant qu'aucune page ne porte la classe, et évite une seconde feuille à tenir.
export const themeCss = `
:root {
  ${cssTokens()}
  ${cssVariables("light")}
}
:root.lehno-nuit, body.lehno-nuit {
  ${cssVariables("dark")}
}
${cssAdmin("light")}
${cssAdmin("dark")}
`.trim();
