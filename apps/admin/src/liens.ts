/**
 * Les portes d'entrée vers les plateformes tierces — ux-admin §5.14.
 *
 * De simples raccourcis : chaque plateforme garde sa propre authentification et
 * ses propres données. Rien ici n'est un secret, rien n'appelle personne. C'est
 * pourquoi la liste vit dans le code de l'outil et non en base — il n'y a ni
 * état à tenir, ni geste à journaliser, et la spécification n'accorde à cette
 * section aucune action, là où §5.10 les énumère pour les siennes.
 *
 * **La liste ne dit que ce qui sert.** La spécification énumère la pile visée ;
 * le dépôt, lui, n'en branche aujourd'hui qu'une partie. Annoncer une console
 * pour un outil que rien n'appelle donnerait à lire une pile qui n'existe pas.
 * Une entrée se pose donc quand son outil entre en service, comme la
 * spécification le demande : « la liste s'entretient à mesure que la pile
 * technique évolue ».
 *
 * Le nom d'un outil ne se traduit pas ; ce à quoi il sert, si. La phrase d'usage
 * vit donc au dictionnaire, sous la clé de l'entrée, et un test refuse une
 * entrée dont la phrase manquerait dans l'une des deux langues.
 */

export type GroupeLiens = "mesure" | "messages" | "identite" | "code";

export interface LienExterne {
  /** Identifie l'entrée, et sa phrase d'usage au dictionnaire. */
  cle: string;
  /** Le nom de l'outil, tel qu'il se dit — il ne se traduit pas. */
  nom: string;
  /** Sa console. La racine, jamais un lien profond : un chemin interne bouge. */
  url: string;
}

export const LIENS: { groupe: GroupeLiens; entrees: readonly LienExterne[] }[] = [
  {
    groupe: "mesure",
    entrees: [
      { cle: "posthog", nom: "PostHog", url: "https://app.posthog.com" },
    ],
  },
  {
    groupe: "messages",
    entrees: [
      { cle: "resend", nom: "Resend", url: "https://resend.com/emails" },
    ],
  },
  {
    groupe: "identite",
    entrees: [
      { cle: "google", nom: "Google Cloud", url: "https://console.cloud.google.com/apis/credentials" },
      { cle: "apple", nom: "Apple Developer", url: "https://developer.apple.com/account" },
    ],
  },
  {
    groupe: "code",
    entrees: [
      { cle: "github", nom: "GitHub", url: "https://github.com/iamvaln/lehno" },
    ],
  },
];

/** Toutes les entrées, à plat — pour les tests et le rendu. */
export function toutesLesEntrees(): LienExterne[] {
  return LIENS.flatMap(({ entrees }) => [...entrees]);
}
