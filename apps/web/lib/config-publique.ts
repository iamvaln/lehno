export type ConfigPublique = {
  signupFreeCredits: number;
  creditUnitPrice: number;
  currency: string;
  referralBonusInvited: number;
};

// La landing doit s'afficher même serveur éteint : une page de pré-lancement qui
// dépendrait de l'API pour paraître serait une page qui disparaît avec elle.
// Ces valeurs sont donc un repli, pas une source — dès que l'API répond, elle gagne.

export const CONFIG_REPLI: ConfigPublique = {
  signupFreeCredits: 5,
  creditUnitPrice: 100,
  currency: "XAF",
  referralBonusInvited: 0,
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
// Un champ manquant doit dégrader la page, jamais la faire planter : une
// réponse incomplète serait alors pire qu'un serveur éteint, cas pour lequel
// CONFIG_REPLI a justement été écrit. La même garde vaut pour chargerFeatures
// plus bas, qui vérifie recevoir un tableau avant de le filtrer.
function fusionner(charge: unknown): ConfigPublique {
  if (typeof charge !== "object" || charge === null) return CONFIG_REPLI;
  const recu = charge as Partial<ConfigPublique>;
  return {
    ...CONFIG_REPLI,
    ...recu,
  };
}

// Les fonctionnalités actives sur les surfaces sans compte — /public/features.
//
// Une LISTE de ce qui est actif, jamais l'état brut des drapeaux : le serveur
// a déjà résolu les dépendances, et « éteint » se confond avec « inconnu ».
// C'est voulu (spécification §6.2) — les deux valent éteint, et le jour où
// l'activation deviendra sélective, rien ne changera ici.
//
// Le repli est la liste VIDE, et c'est une décision : API injoignable ou
// réponse incomplète, la landing retombe en pré-lancement. Mieux vaut afficher
// la capture d'adresse que promettre une application disponible alors que le
// serveur qui le confirmerait ne répond plus.
export async function chargerFeatures(revalidate: number): Promise<string[]> {
  const base = process.env["API_URL"];
  if (!base) return [];
  try {
    const reponse = await fetch(`${base}/v1/public/features`, { next: { revalidate } });
    if (!reponse.ok) return [];
    const charge: unknown = await reponse.json();
    if (typeof charge !== "object" || charge === null) return [];
    const liste = (charge as { features?: unknown }).features;
    // Une réponse d'une API antérieure n'a pas ce champ. Sans cette garde, le
    // filtrage plus bas lèverait et la landing entière rendrait une erreur —
    // pire qu'un serveur éteint, cas pour lequel ce repli existe.
    if (!Array.isArray(liste)) return [];
    return liste.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}
