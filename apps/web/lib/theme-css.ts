import { cssVariables, cssTokens, cssAdmin } from "@lehno/tokens";

// La surcharge du back-office est émise ici aussi : elle ne coûte que sa taille
// tant qu'aucune page ne porte la classe, et évite une seconde feuille à tenir.
// Le pont entre les jetons et next/font.
//
// Les jetons nomment les polices par leur famille — « Fraunces, Georgia,
// serif ». C'est juste pour un système de design, qui ne sait pas comment on
// les servira. Mais next/font ne publie pas la famille sous son nom : il
// engendre un nom haché et l'expose par une variable, --font-titre et
// --font-texte, que le layout pose sur <html>.
//
// Sans ce pont, le navigateur cherche une police nommée « Fraunces », n'en
// trouve aucune, et se rabat sur Georgia — tous les titres du site, sur toutes
// les pages. Ni le lint, ni les tests, ni le build ne le voyaient : seul l'œil.
//
// Il doit être émis APRÈS les jetons, sinon la valeur littérale l'emporte.
const pontDesPolices = `
  --font-display: var(--font-titre), Georgia, "Times New Roman", serif;
  --font-body: var(--font-texte), system-ui, -apple-system, "Segoe UI", sans-serif;
`.trim();

export const themeCss = `
:root {
  ${cssTokens()}
  ${cssVariables("light")}
  ${pontDesPolices}
}
:root.lehno-nuit, body.lehno-nuit {
  ${cssVariables("dark")}
}
${cssAdmin("light")}
${cssAdmin("dark")}
`.trim();
