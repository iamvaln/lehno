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
    return (await reponse.json()) as ConfigPublique;
  } catch {
    // Serveur injoignable, DNS muet, délai dépassé : la page paraît quand même.
    return CONFIG_REPLI;
  }
}
