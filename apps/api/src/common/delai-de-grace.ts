/*
 * Le délai de grâce d'une suppression de compte, en jours.
 *
 * IL VIT ICI, ET NON DANS CHACUN DE SES DEUX LECTEURS. Deux chemins s'en
 * servent et n'ont pas le droit de diverger : le back-office annonce une
 * échéance (« il reste trois jours »), la tâche de nuit efface ce qui l'a
 * dépassée. Une constante de repli différente d'un côté et de l'autre, et
 * l'écran promettrait un délai que la tâche ne respecterait pas — un compte
 * effacé pendant qu'on affiche encore « restaurable ». La bévue ne se rattrape
 * pas : les lignes sont parties.
 */

/** Le contrat minimal : de quoi lire un paramètre système, rien de plus. */
type LecteurDeParametres = {
  systemParameter: {
    findUnique(args: { where: { key: string } }): Promise<{ value: string } | null>;
  };
};

/**
 * La valeur de repli quand le paramètre est absent ou aberrant. Trente jours,
 * comme le back-office l'annonçait avant que ce fichier n'existe.
 */
export const DELAI_DE_GRACE_DEFAUT = 30;

/** La clé du paramètre, une seule fois : une faute de frappe rendrait le repli
 *  permanent sans que rien ne le signale. */
export const CLE_DELAI_DE_GRACE = "account_grace_period_days";

export async function delaiDeGraceEnJours(prisma: LecteurDeParametres): Promise<number> {
  const ligne = await prisma.systemParameter.findUnique({ where: { key: CLE_DELAI_DE_GRACE } });
  const valeur = Number(ligne?.value);
  // Strictement positif : un délai nul ou négatif ferait effacer un compte
  // l'instant où sa suppression est demandée, sans aucun retour possible.
  return Number.isFinite(valeur) && valeur > 0 ? valeur : DELAI_DE_GRACE_DEFAUT;
}
