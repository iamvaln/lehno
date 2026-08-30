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

/* Le thème sombre POUR UNE PAGE SANS SCRIPT.
 *
 * `not-found` est servi par Next dans sa propre coquille : `<html>` n'y porte
 * pas `suppressHydrationWarning`, et React remet donc son `className` à
 * l'hydratation — emportant la classe `lehno-nuit` que le script venait de
 * poser. La page repassait en clair sous les yeux du visiteur.
 *
 * Une requête média ne se défait pas. Elle ignore le choix explicite rangé dans
 * le stockage local — sur une page d'erreur, la préférence du système suffit. */
export const themeSansScript = `
@media (prefers-color-scheme: dark) {
  :root { ${cssVariables("dark")} }
}
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
