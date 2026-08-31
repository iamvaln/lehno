/* Les illustrations du système, en données.
 *
 * Boîte 200 × 160, marge intérieure de 8 %, fond transparent, lisible à 120 px.
 * Aucun contour, aucune ombre, aucun dégradé — un seul objet par image.
 *
 * Les tracés traversent du web au natif sans une retouche : ce sont des
 * coordonnées, et react-native-svg lit les mêmes. Seules les couleurs changent
 * de forme — trois variables CSS deviennent trois rôles nommés, que le
 * composant résout depuis le thème courant. C'est aussi ce qui donne au natif
 * un thème que le web obtenait par la cascade.
 */

export const ROLES_D_ILLUSTRATION = ["mass", "form", "warm"] as const;
export type RoleDIllustration = (typeof ROLES_D_ILLUSTRATION)[number];

export type Forme =
  // `fillRule` sert aux tracés à trou — un anneau se dessine d'un seul chemin,
  // et react-native-svg lit la même règle que le navigateur.
  | ["path", { d: string; fill: RoleDIllustration; fillRule?: "evenodd" | "nonzero" }]
  | ["rect", { x: number; y: number; width: number; height: number; rx?: number; fill: RoleDIllustration }]
  | ["ellipse", { cx: number; cy: number; rx: number; ry: number; fill: RoleDIllustration }]
  | ["circle", { cx: number; cy: number; r: number; fill: RoleDIllustration }];

export const BOITE = { largeur: 200, hauteur: 160 } as const;

export const ILLUSTRATIONS: Record<string, readonly Forme[]> = {
  /* 01 — Carnet neuf : un carnet ouvert, des pages qui attendent. */
  "carnet-neuf": [
    ["path", { d: "M100 44 L28 54 v72 L100 116 Z", fill: "mass" }],
    ["path", { d: "M100 44 L172 54 v72 L100 116 Z", fill: "mass" }],
    ["path", { d: "M100 53 L40 61 v56 L100 109 Z", fill: "form" }],
    ["path", { d: "M100 53 L160 61 v56 L100 109 Z", fill: "form" }],
    ["rect", { x: 96, y: 44, width: 8, height: 72, rx: 3, fill: "mass" }],
    ["path", { d: "M140 60 l12 -1.6 v28 l-6 -5 -6 6 Z", fill: "warm" }]
  ],

  /* 02 — Aucune échéance proche : le calme, une pause. Surtout pas un manque. */
  "rien-approche": [
    ["path", { d: "M24 56 Q100 140 176 56 Q100 100 24 56 Z", fill: "form" }],
    ["path", { d: "M34 62 Q100 128 166 62 Q100 96 34 62 Z", fill: "mass" }],
    ["ellipse", { cx: 60, cy: 84, rx: 14, ry: 9, fill: "warm" }]
  ],

  /* 03 — Annuaire vide : des silhouettes en attente de se remplir.
     Sans visage ni traits — aucune illustration ne représente un type de personne. */
  "annuaire-vide": [
    ["circle", { cx: 54, cy: 90, r: 13, fill: "form" }],
    ["path", { d: "M30 134 a24 24 0 0 1 48 0 Z", fill: "form" }],
    ["circle", { cx: 100, cy: 84, r: 15, fill: "mass" }],
    ["path", { d: "M74 134 a26 26 0 0 1 52 0 Z", fill: "mass" }],
    ["circle", { cx: 146, cy: 90, r: 13, fill: "form" }],
    ["path", { d: "M122 134 a24 24 0 0 1 48 0 Z", fill: "form" }]
  ],

  /* 04 — Calendrier sans date : une grille dont aucune case n'est marquée. */
  "calendrier-sans-date": [
    ["rect", { x: 62, y: 24, width: 8, height: 22, rx: 4, fill: "mass" }],
    ["rect", { x: 130, y: 24, width: 8, height: 22, rx: 4, fill: "mass" }],
    ["rect", { x: 30, y: 40, width: 140, height: 100, rx: 12, fill: "mass" }],
    ["rect", { x: 40, y: 66, width: 120, height: 64, rx: 6, fill: "form" }],
    ...[55, 85, 115, 145].flatMap((x) => [82, 98, 114].map((y): Forme => ["circle", { cx: x, cy: y, r: 4.5, fill: "mass" }]))
  ],

  /* 05 — Aucune contribution à valider : une pile rangée, un plan de travail au repos. */
  "contributions-aucune": [
    ["rect", { x: 66, y: 56, width: 68, height: 13, rx: 3, fill: "warm" }],
    ["rect", { x: 58, y: 72, width: 84, height: 13, rx: 3, fill: "form" }],
    ["rect", { x: 52, y: 88, width: 96, height: 13, rx: 3, fill: "form" }],
    ["path", { d: "M28 99 h144 l-16 33 h-112 Z", fill: "mass" }]
  ],

  /* 06 — Aucune note sur une fiche : une page blanche dans le carnet. */
  "note-aucune": [
    ["rect", { x: 48, y: 28, width: 14, height: 106, rx: 4, fill: "mass" }],
    ["path", { d: "M62 28 h64 l24 24 v82 h-88 Z", fill: "form" }],
    ["path", { d: "M126 28 l24 24 h-24 Z", fill: "mass" }],
    ["circle", { cx: 55, cy: 50, r: 5, fill: "form" }],
    ["circle", { cx: 55, cy: 81, r: 5, fill: "form" }],
    ["circle", { cx: 55, cy: 112, r: 5, fill: "form" }]
  ],

  /* 07 — Liste de souhaits vide : une boîte OUVERTE, et vide.
     Un paquet fermé est un paquet plein : il dit qu'un cadeau existe, soit
     l'inverse de l'écran. Le couvercle est posé à côté, la boîte attend. */
  "souhaits-vide": [
    ["path", { d: "M116 46 L176 27 l6 20 l-60 19 Z", fill: "form" }],
    ["path", { d: "M140 38 l10 -3 l6 20 l-10 3 Z", fill: "warm" }],
    ["rect", { x: 44, y: 74, width: 92, height: 58, rx: 6, fill: "mass" }],
    ["rect", { x: 52, y: 74, width: 76, height: 15, rx: 4, fill: "form" }]
  ],

  /* 08 — Aucun portrait produit : un cadre qui attend son image. */
  "portrait-aucun": [
    ["rect", { x: 52, y: 26, width: 96, height: 104, rx: 8, fill: "mass" }],
    ["rect", { x: 62, y: 36, width: 76, height: 84, rx: 4, fill: "form" }],
    ["circle", { cx: 100, cy: 66, r: 12, fill: "mass" }],
    ["path", { d: "M78 120 a22 22 0 0 1 44 0 Z", fill: "mass" }],
    ["path", { d: "M92 130 h16 l7 16 h-30 Z", fill: "mass" }]
  ],

  /* 09 — Aucun mot reçu sur le Mur : une bulle vide.
     Pas une boîte aux lettres : le dôme à drapeau latéral est une convention
     nord-américaine, et son drapeau relevé signifie « courrier à prendre »,
     soit l'inverse de l'écran. La bulle épouse le libellé — des mots — et se
     lit partout. */
  "mur-aucun-mot": [
    ["rect", { x: 38, y: 30, width: 124, height: 80, rx: 18, fill: "mass" }],
    ["path", { d: "M66 110 v28 l28 -28 Z", fill: "mass" }],
    ["rect", { x: 50, y: 42, width: 100, height: 56, rx: 11, fill: "form" }]
  ],

  /* 10 — Recherche sans résultat : une loupe qui n'a rien trouvé, sans dramatiser. */
  "recherche-sans-resultat": [
    ["rect", { x: 56, y: 44, width: 92, height: 100, rx: 6, fill: "form" }],
    ["path", { d: "M110 92 l30 30 a9 9 0 0 1 -13 13 l-30 -30 Z", fill: "mass" }],
    ["path", {
      d: "M88 32 a36 36 0 1 0 0.1 0 Z M88 43 a25 25 0 1 1 -0.1 0 Z",
      fillRule: "evenodd", fill: "mass"
    }]
  ],

  /* ─── Priorité 2 — les attentes et les issues ─────────────────────── */

  /* 11 — Génération en cours : quelque chose se compose. */
  "generation-en-cours": [
    ["rect", { x: 46, y: 30, width: 108, height: 96, rx: 10, fill: "mass" }],
    ["rect", { x: 56, y: 40, width: 88, height: 76, rx: 6, fill: "form" }],
    ["rect", { x: 66, y: 54, width: 68, height: 9, rx: 4, fill: "mass" }],
    ["rect", { x: 66, y: 72, width: 52, height: 9, rx: 4, fill: "mass" }],
    ["rect", { x: 66, y: 90, width: 30, height: 9, rx: 4, fill: "warm" }]
  ],

  /* 12 — Paiement en attente. Pas de flèche qui sort : une flèche se lit comme
     un envoi, et quelqu'un qui attend son code verrait un mouvement là où il
     ne se passe rien. Trois points en attente, sans direction. */
  "paiement-attente": [
    ["rect", { x: 40, y: 30, width: 120, height: 62, rx: 12, fill: "mass" }],
    ["rect", { x: 50, y: 40, width: 100, height: 42, rx: 6, fill: "form" }],
    ["circle", { cx: 74, cy: 120, r: 9, fill: "mass" }],
    ["circle", { cx: 100, cy: 120, r: 9, fill: "mass" }],
    ["circle", { cx: 126, cy: 120, r: 9, fill: "mass" }]
  ],

  /* 13 — Paiement abouti : le soulagement, sans triomphe. */
  "paiement-abouti": [
    ["rect", { x: 40, y: 28, width: 120, height: 58, rx: 12, fill: "mass" }],
    ["rect", { x: 40, y: 44, width: 120, height: 12, fill: "form" }],
    ["path", { d: "M80 118 l7 -7 l11 11 l25 -25 l7 7 l-32 32 Z", fill: "warm" }]
  ],

  /* 14 — Paiement échoué ou expiré : une opération qui n'a pas abouti.
     Ni croix, ni panneau : l'erreur n'accuse personne, le trait s'interrompt. */
  "paiement-echoue": [
    ["rect", { x: 40, y: 40, width: 120, height: 58, rx: 12, fill: "mass" }],
    ["rect", { x: 40, y: 56, width: 120, height: 12, fill: "form" }],
    ["rect", { x: 48, y: 120, width: 44, height: 9, rx: 4, fill: "mass" }],
    ["rect", { x: 108, y: 120, width: 44, height: 9, rx: 4, fill: "mass" }]
  ],

  /* 15 — Solde épuisé : une réserve vide, sans culpabiliser. */
  "credits-epuises": [
    ["rect", { x: 56, y: 38, width: 88, height: 15, rx: 7, fill: "mass" }],
    ["rect", { x: 62, y: 53, width: 76, height: 83, rx: 11, fill: "mass" }],
    ["rect", { x: 72, y: 64, width: 56, height: 62, rx: 7, fill: "form" }]
  ],

  /* ─── Priorité 3 — l'entrée dans l'application ────────────────────── */

  /* 17 — Écran de bienvenue : un accueil, un présent modeste. */
  "bienvenue-credits": [
    ["rect", { x: 40, y: 42, width: 120, height: 74, rx: 12, fill: "mass" }],
    ["rect", { x: 50, y: 52, width: 100, height: 54, rx: 7, fill: "form" }],
    ["circle", { cx: 76, cy: 79, r: 11, fill: "warm" }],
    ["circle", { cx: 100, cy: 79, r: 11, fill: "warm" }],
    ["circle", { cx: 124, cy: 79, r: 11, fill: "warm" }]
  ],

  /* 18 — Vérification par code : un code qui arrive. */
  "verification-code": [
    ["rect", { x: 72, y: 20, width: 56, height: 118, rx: 12, fill: "mass" }],
    ["rect", { x: 80, y: 33, width: 40, height: 92, rx: 6, fill: "form" }],
    ["rect", { x: 84, y: 72, width: 7, height: 15, rx: 2, fill: "warm" }],
    ["rect", { x: 93, y: 72, width: 7, height: 15, rx: 2, fill: "mass" }],
    ["rect", { x: 102, y: 72, width: 7, height: 15, rx: 2, fill: "mass" }],
    ["rect", { x: 111, y: 72, width: 7, height: 15, rx: 2, fill: "mass" }]
  ],

  /* ─── Priorité 4 — les surfaces publiques ─────────────────────────── */

  /* 19 — Lien révoqué : une porte fermée, sans reproche. */
  "lien-revoque": [
    ["rect", { x: 62, y: 24, width: 76, height: 112, rx: 8, fill: "mass" }],
    ["rect", { x: 72, y: 36, width: 52, height: 76, rx: 5, fill: "form" }],
    ["circle", { cx: 131, cy: 84, r: 4.5, fill: "form" }]
  ],

  /* 20 — Fenêtre de vœux close : un moment passé. */
  "voeux-clos": [
    ["rect", { x: 66, y: 22, width: 68, height: 9, rx: 4, fill: "mass" }],
    ["path", { d: "M70 31 h60 l-24 34 h-12 Z", fill: "mass" }],
    ["path", { d: "M80 39 h40 l-16 22 h-8 Z", fill: "form" }],
    ["path", { d: "M94 95 h12 l24 34 h-60 Z", fill: "mass" }],
    ["rect", { x: 66, y: 129, width: 68, height: 9, rx: 4, fill: "mass" }]
  ],

  /* 21 — Page introuvable : un chemin qui ne mène nulle part. */
  "page-introuvable": [
    ["path", { d: "M72 142 L128 142 L113 40 L87 40 Z", fill: "mass" }],
    ["rect", { x: 95, y: 116, width: 10, height: 20, rx: 5, fill: "form" }],
    ["rect", { x: 96, y: 88, width: 8, height: 16, rx: 4, fill: "form" }],
    ["rect", { x: 97, y: 62, width: 6, height: 12, rx: 3, fill: "form" }]
  ],

  /* 22 — Mur dépublié : une page mise en retrait par son propriétaire. */
  "mur-depublie": [
    ["rect", { x: 52, y: 24, width: 96, height: 108, rx: 10, fill: "mass" }],
    ["rect", { x: 62, y: 34, width: 76, height: 88, rx: 6, fill: "form" }],
    ["rect", { x: 52, y: 66, width: 96, height: 26, fill: "mass" }]
  ],

  /* 23 — Contribution envoyée : un geste reçu. */
  "contribution-envoyee": [
    ["rect", { x: 62, y: 30, width: 76, height: 62, rx: 8, fill: "form" }],
    ["rect", { x: 74, y: 48, width: 40, height: 9, rx: 4, fill: "warm" }],
    ["path", { d: "M42 86 h116 l-10 50 h-96 Z", fill: "mass" }]
  ],

  /* 24 — Souhait réservé : un cadeau mis de côté. */
  "souhait-reserve": [
    ["rect", { x: 42, y: 66, width: 82, height: 66, rx: 8, fill: "mass" }],
    ["path", { d: "M124 52 l34 12 l-9 26 l-34 -12 Z", fill: "warm" }],
    ["circle", { cx: 132, cy: 64, r: 4, fill: "form" }]
  ],

  /* ─── Priorité 5 — le back-office ─────────────────────────────────── */

  /* 25 — File vide : un plan de travail rangé. */
  "bo-file-vide": [
    ["path", { d: "M52 70 h96 l-10 34 h-76 Z", fill: "mass" }],
    ["path", { d: "M64 79 h72 l-7 17 h-58 Z", fill: "form" }],
    ["rect", { x: 34, y: 104, width: 132, height: 12, rx: 6, fill: "mass" }]
  ],

  /* 26 — Aucun résultat, back-office : sobriété, aucune émotion. */
  "bo-aucun-resultat": [
    ["rect", { x: 42, y: 62, width: 116, height: 36, rx: 18, fill: "mass" }],
    ["rect", { x: 52, y: 70, width: 96, height: 20, rx: 10, fill: "form" }],
    ["rect", { x: 62, y: 76, width: 26, height: 8, rx: 4, fill: "mass" }]
  ]
};

export type NomDIllustration = keyof typeof ILLUSTRATIONS;
