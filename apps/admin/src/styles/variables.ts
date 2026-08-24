import { cssVariables, cssTokens, cssAdmin } from "@lehno/tokens";

// Les mêmes jetons que le produit, plus la surcharge de l'outil. Le back-office
// porte toujours .lehno-admin ; le thème sombre ajoute .lehno-nuit sur le même
// élément, et les deux blocs se cumulent.
//
// Volontairement identique à apps/web/lib/theme-css.ts : deux applications
// séparées, douze lignes chacune. Les partager demanderait un paquet commun,
// qui n'existe pas encore — et la duplication d'un appel de fonction ne dérive
// pas, puisque les valeurs, elles, viennent d'une source unique.
export function feuilleDesJetons(): string {
  return `
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
}
