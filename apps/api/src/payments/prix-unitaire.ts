import type { PrismaService } from "../prisma/prisma.service.js";

/**
 * Ce que coûte UN crédit acheté seul, lu dans `system_parameter`.
 *
 * UN SEUL LECTEUR, UN SEUL DÉFAUT. Il y en avait trois, identiques, chacun
 * accompagné d'un commentaire disant que les autres devaient rester d'accord
 * avec lui — c'est-à-dire nommant le risque tout en le laissant en place. Le
 * jour où l'un des trois change, la même offre annonce deux remises
 * différentes selon la porte par laquelle on la regarde : la liste des paliers
 * au panneau, l'aperçu avant paiement, la page publique.
 *
 * Le défaut ne vaut que pour une base où le paramètre n'a pas été semé. Il
 * n'est PAS une valeur commerciale : le prix vit en base, il se règle en
 * administration sans livraison.
 */
export const PRIX_UNITAIRE_PAR_DEFAUT = 100;

/** Le prix unitaire du jour. Voir `remiseDe`, qui le consomme. */
export async function prixUnitaireDuJour(prisma: PrismaService): Promise<number> {
  const ligne = await prisma.systemParameter.findUnique({
    where: { key: "credit_unit_price" },
  });
  return ligne ? Number(ligne.value) : PRIX_UNITAIRE_PAR_DEFAUT;
}
