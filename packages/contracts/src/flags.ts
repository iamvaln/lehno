// Le registre des drapeaux. Chaque surface qu'on doit pouvoir éteindre y
// figure, et « public » dit si son état se lit SANS session — la landing en a
// besoin avant toute connexion.
//
// Le registre est du code, pas des données, pour une raison précise : la clé
// de @Feature en dérive par le type. Une faute de frappe est alors une erreur
// de compilation, pas une fonctionnalité éteinte en silence dont personne ne
// s'aperçoit. Le défaut classique de ces systèmes est le drapeau qui ne
// protège plus rien parce que sa clé ne correspond à aucune ligne ; ici cette
// erreur ne peut pas être écrite.
export const DRAPEAUX = {
  "launch.live": {
    description: "La landing montre les liens de magasin au lieu de la capture d'adresse",
    public: true,
  },
  "me.persons": {
    description: "L'annuaire des proches de l'espace privé",
    public: false,
  },
} as const;

export type CleDrapeau = keyof typeof DRAPEAUX;

// Les clés dont l'état se lit sans session, et elles seules. Dérivé de
// DRAPEAUX plutôt que réécrit à la main : une clé rendue publique dans le
// registre ci-dessus le devient ici sans second endroit à mettre à jour.
export const CLES_PUBLIQUES: readonly CleDrapeau[] = (Object.keys(DRAPEAUX) as CleDrapeau[]).filter(
  (cle) => DRAPEAUX[cle].public,
);
