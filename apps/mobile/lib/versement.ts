import {
  declarePaymentSchema, estActive,
  type CollectionAccount, type CreditTransaction, type DeclarePaymentInput,
  type PaymentChannel,
} from "@lehno/contracts";

/* La recharge — §3.9, et ses deux parcours.
 *
 * `topup.provider` allumé : on paie dans l'application, l'opérateur pousse une
 * demande sur le téléphone. Éteint et `topup.manual` allumé — la configuration
 * du lancement — L'ORDRE DES GESTES S'INVERSE : on verse d'abord depuis son
 * application d'opérateur, puis on revient le déclarer.
 *
 * Ce n'est pas l'écran d'achat amputé, c'est un autre écran.
 */

export type Parcours = "operateur" | "manuel" | "aucun";

/* CE QUE L'ÉCRAN PROPOSE, et il ne lit PAS `credits`.
 *
 * La maquette le fait — `flags.credits !== false` — mais ce drapeau n'existe
 * pas : le registre l'interdit nommément, « les actions payantes consomment du
 * crédit, toujours ». Le lire rendrait toujours faux, et le mode « générations
 * gratuites » qu'elle dessine n'est atteignable par personne.
 *
 * Les deux voies ensemble n'arrivent pas au lancement, mais si elles
 * arrivaient, l'automatique primerait : c'est le parcours qui aboutit sans
 * qu'un humain intervienne.
 */
export function parcoursDeRecharge(actives: readonly string[]): Parcours {
  if (estActive(actives, "topup.provider")) return "operateur";
  if (estActive(actives, "topup.manual")) return "manuel";
  return "aucun";
}

/* SUR QUEL COMPTE VERSER.
 *
 * Le serveur ne rend que les comptes visibles ET actifs, et les ordonne par
 * `position` : le premier est celui que l'administration met en avant. On ne
 * choisit donc pas, on prend le sien — proposer une liste ferait porter à
 * l'utilisateur un arbitrage qui ne le regarde pas.
 *
 * Aucun compte servi n'est pas une erreur d'affichage : c'est l'impossibilité
 * de verser. L'écran doit alors se taire sur le versement plutôt que de
 * montrer un formulaire vers nulle part.
 */
export function comptePourVerser(
  comptes: readonly CollectionAccount[],
): CollectionAccount | null {
  return comptes[0] ?? null;
}

/* LE CANAL SE DÉDUIT DU COMPTE, faute d'être demandé.
 *
 * `declarePaymentSchema` exige un `channelId` — le barème des frais en dépend.
 * La maquette du versement manuel ne pose jamais la question : elle montre un
 * compte, et c'est tout. On rattache donc par l'OPÉRATEUR, seul lien commun
 * entre un compte de collecte et un canal.
 *
 * Deux canaux du même opérateur rendent la déduction ambiguë — et c'est
 * exactement ce qui arrive quand les canaux se dédoublent en automatique et
 * manuel, ce que le contrat ne distingue pas encore. On rend alors `null` :
 * mieux vaut ne pas offrir la déclaration que l'envoyer sur un barème choisi
 * au hasard, puisque c'est lui qui décide de ce que la personne verse en plus.
 */
export function canalPourLeCompte(
  canaux: readonly PaymentChannel[],
  compte: CollectionAccount,
): PaymentChannel | null {
  const memes = canaux.filter(
    (c) => c.operator.trim().toLowerCase() === compte.operator.trim().toLowerCase(),
  );
  return memes.length === 1 ? memes[0]! : null;
}

/* CE QUI AUTORISE LA DÉCLARATION.
 *
 * Les bornes viennent du CONTRAT — six caractères pour le numéro, quatre pour
 * la référence — et non de la maquette, qui en demande plus de cinq pour les
 * deux. Une borne plus stricte que le serveur refuserait une référence qu'il
 * aurait acceptée, et l'utilisateur n'aurait aucun moyen de le savoir.
 *
 * Le format reste LIBRE : « les opérateurs ne s'accordent sur rien ». On
 * vérifie qu'il y a quelque chose, pas que ça ressemble à ce qu'on croit
 * connaître d'un opérateur.
 */
export function declarationComplete(depuis: string, reference: string): boolean {
  return depuis.trim().length >= 6 && reference.trim().length >= 4;
}

export interface SaisieDeVersement {
  palier: string;
  canal: string;
  compte: string;
  depuis: string;
  reference: string;
}

export function corpsDeDeclaration(saisie: SaisieDeVersement): DeclarePaymentInput {
  return declarePaymentSchema.parse({
    bundleId: saisie.palier,
    channelId: saisie.canal,
    collectionAccountId: saisie.compte,
    payerMsisdn: saisie.depuis.trim(),
    providerRef: saisie.reference.trim(),
  });
}

/* LES TROIS DERNIERS MOUVEMENTS, là où le solde se lit.
 *
 * Trois, parce que c'est ce qu'on vient vérifier après un versement. La suite
 * demande §3.32 : « trois lignes ne suffisent pas à une réclamation », mais
 * les mettre toutes ici pousserait le reste de l'écran hors de vue.
 */
export const APERCU_DES_MOUVEMENTS = 3;

export function mouvementsRecents(
  transactions: readonly CreditTransaction[],
): CreditTransaction[] {
  return [...transactions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, APERCU_DES_MOUVEMENTS);
}

/* « Tout voir » ne paraît que s'il y a plus à voir. Un lien qui mène à la même
   liste apprend à ne pas le suivre. */
export function offreTout(transactions: readonly CreditTransaction[]): boolean {
  return transactions.length > APERCU_DES_MOUVEMENTS;
}

/* LE SIGNE PORTE LE SENS, pas la couleur seule : « + 12 » et « − 2 » se lisent
   en noir et blanc, et le vert n'ajoute qu'une confirmation. Le montant est
   déjà signé au contrat — on ne le recalcule pas, on le met en forme. */
export function montreLeMouvement(montant: number): string {
  return (montant > 0 ? "+ " : "− ") + Math.abs(montant);
}

/* LES MOIS SÉPARENT, ILS NE TITRENT PAS.
 *
 * Le regroupement suit la liste dans son ordre — du plus récent au plus
 * ancien — sans la retrier : elle arrive déjà rangée, et un second tri ici
 * ferait deux vérités sur ce qu'est « récent ».
 *
 * On ne réemploie pas `parMois` : elle est typée pour les échéances, et la
 * rendre générique pour deux appelants qui ne partagent qu'une découpe de
 * chaîne coûterait plus qu'elle ne rendrait. Le TITRE, lui, se réemploie —
 * `titreDuMois` porte la règle « l'année ne paraît que si elle diffère », et
 * la réécrire donnerait deux façons de nommer un mois.
 */
export function moisDesMouvements(
  transactions: readonly CreditTransaction[],
): { mois: string; items: CreditTransaction[] }[] {
  const groupes: { mois: string; items: CreditTransaction[] }[] = [];
  for (const t of transactions) {
    const mois = t.createdAt.slice(0, 7);
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.mois === mois) dernier.items.push(t);
    else groupes.push({ mois, items: [t] });
  }
  return groupes;
}
