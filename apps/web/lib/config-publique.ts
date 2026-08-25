export type ConfigPublique = {
  signupFreeCredits: number;
  creditUnitPrice: number;
  currency: string;
  referralBonusInvited: number;
  // Les drapeaux publics du registre (packages/contracts/src/flags.ts),
  // dont "launch.live" — la bascule de la landing entre pré-lancement et
  // lancé. Clé absente = éteint, même règle que FlagsService.estActif().
  flags: Record<string, boolean>;
};

// La landing doit s'afficher même serveur éteint : une page de pré-lancement qui
// dépendrait de l'API pour paraître serait une page qui disparaît avec elle.
// Ces valeurs sont donc un repli, pas une source — dès que l'API répond, elle gagne.
//
// flags: {} est une DÉCISION, pas un défaut oublié. Une panne d'API pendant
// que "launch.live" est vrai fait retomber la landing en pré-lancement (elle
// capture une adresse) plutôt que de continuer à montrer des liens de
// magasin — l'inverse serait pire : promettre une application disponible
// alors même que le serveur qui le confirmerait ne répond plus.
export const CONFIG_REPLI: ConfigPublique = {
  signupFreeCredits: 5,
  creditUnitPrice: 100,
  currency: "XAF",
  referralBonusInvited: 0,
  flags: {},
};

export async function chargerConfig(revalidate: number): Promise<ConfigPublique> {
  const base = process.env["API_URL"];
  if (!base) return CONFIG_REPLI;
  try {
    const reponse = await fetch(`${base}/v1/public/config`, { next: { revalidate } });
    if (!reponse.ok) return CONFIG_REPLI;
    return fusionner(await reponse.json());
  } catch {
    // Serveur injoignable, DNS muet, délai dépassé : la page paraît quand même.
    return CONFIG_REPLI;
  }
}

// Une réponse peut être valide — 200, JSON bien formé — et pourtant incomplète :
// c'est le cas pendant un déploiement où l'image du site part avant celle de
// l'api, et après un retour arrière de l'api. On complète donc champ par champ
// depuis le repli plutôt que de faire confiance à la charge reçue.
//
// Sans cette fusion, un champ manquant ne dégradait pas la page : il la faisait
// PLANTER. `flags` absent, et `configuration.flags["launch.live"]` lève un
// TypeError qui rend la landing entière en erreur — pire que le serveur
// éteint, cas pour lequel CONFIG_REPLI avait justement été écrit.
function fusionner(charge: unknown): ConfigPublique {
  if (typeof charge !== "object" || charge === null) return CONFIG_REPLI;
  const recu = charge as Partial<ConfigPublique>;
  return {
    ...CONFIG_REPLI,
    ...recu,
    // Seul champ dont on lit une sous-clé : il doit être un OBJET, pas
    // seulement présent. `null` passerait le test de présence et planterait
    // pareil.
    flags: typeof recu.flags === "object" && recu.flags !== null ? recu.flags : CONFIG_REPLI.flags,
  };
}
