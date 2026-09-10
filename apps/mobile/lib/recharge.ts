import {
  paymentPreviewInputSchema,
  type CreditBundle, type PaymentChannel, type PaymentDetail,
  type PaymentPreview, type PaymentPreviewInput, type PaymentStatus,
} from "@lehno/contracts";

/* Le parcours de recharge — §3.9, et ses cinq moments.
 *
 * `versement.ts` porte ce qui touche au VERSEMENT lui-même : sur quel compte,
 * par quel canal, ce qu'on déclare. Ce fichier-ci porte le PARCOURS : où l'on
 * en est, ce qu'on montre, et ce qui décide de passer à la suite.
 *
 * Rien n'y importe `react-native` : il est typé Flow, et ni esbuild ni Vitest
 * ne savent le lire. Une seule décision qui remonterait dans le `.tsx`
 * deviendrait invérifiable.
 */

// ── Où l'on en est ──────────────────────────────────────────────────────────

export type Etape = "choix" | "recap" | "attente" | "abouti" | "echec";

/* L'ÉTAPE SE LIT SUR LE PAIEMENT, pas sur un compteur d'écran.
 *
 * Un booléen « en attente » par étape se serait désynchronisé au premier
 * retour d'arrière-plan : deux vérités sur le même paiement, et celle de
 * l'écran aurait gagné. Ici, c'est le statut servi qui commande, et l'aperçu
 * ne tranche que tant qu'aucun paiement n'existe.
 *
 * `refunded` RENVOIE AU CHOIX, et c'est le cas qui se raisonne le moins bien.
 * Un paiement remboursé a bel et bien abouti puis été défait : « Crédits
 * ajoutés » annoncerait des crédits qui sont repartis, et « Rien n'a été
 * prélevé » nierait un prélèvement qui a eu lieu. Les deux mentent. L'écran
 * revient donc à son point de départ, et les mouvements — qui portent le
 * remboursement ligne à ligne — disent le reste.
 */
export function etapeDeLaRecharge(
  paiement: PaymentDetail | null,
  apercu: PaymentPreview | null,
): Etape {
  if (paiement === null) return apercu === null ? "choix" : "recap";
  switch (paiement.status) {
    case "pending": return "attente";
    case "succeeded": return "abouti";
    case "failed":
    case "expired": return "echec";
    default: return "choix";
  }
}

// ── Les paliers ─────────────────────────────────────────────────────────────

/* L'ORDRE EST CELUI DE `position`, jamais celui de l'arrivée.
 *
 * Le contrat porte `position` précisément pour que l'ordre se règle en
 * administration : c'est lui qui décide quel palier se lit en premier, donc
 * lequel sert d'ancre au prix des autres. S'en remettre à l'ordre de la
 * réponse ferait dépendre l'argumentaire commercial de ce que la base rend ce
 * jour-là.
 *
 * On recopie avant de trier : `sort` mute, et la liste vient de l'état de
 * l'écran — la trier sur place ferait muter un état de React sans passer par
 * son setter, ce qui ne redessine rien et se voit trois écrans plus loin.
 */
export function paliersOrdonnes(paliers: readonly CreditBundle[]): CreditBundle[] {
  return [...paliers].sort((a, b) => a.position - b.position);
}

/* LE PALIER PRÉSENTÉ D'AVANCE est le premier qui porte une remise.
 *
 * La maquette en désigne un — celui du milieu, à −17 % — et il faut bien en
 * désigner un : sans palier posé, le bouton « Payer … » n'a pas de montant à
 * annoncer, et l'écran s'ouvre sur une action morte.
 *
 * La règle ne peut pas être « le deuxième » : le nombre de paliers se règle en
 * back-office, et « le deuxième » désignerait n'importe quoi le jour où il y en
 * a cinq. « Le premier qui porte une remise » désigne la même chose sur la
 * grille de la maquette, et reste vraie quelle que soit la grille — c'est le
 * plus petit palier dont l'administration a décidé qu'il valait le coup.
 *
 * Aucune remise nulle part : le premier. Pas de palier du tout : rien, et le
 * bouton reste éteint plutôt que d'inventer un montant.
 */
export function palierParDefaut(paliers: readonly CreditBundle[]): string | null {
  const ordonnes = paliersOrdonnes(paliers);
  /* La MÊME source que celle affichée : le champ servi. Choisir sur un autre
     critère ferait présélectionner un palier qui n'est pas celui qui montre le
     meilleur chiffre. */
  const avecRemise = ordonnes.find((p) => p.discountPercent !== null && p.discountPercent > 0);
  return (avecRemise ?? ordonnes[0])?.id ?? null;
}

/* LE MOBILE NE CALCULE PAS LA RÉDUCTION, et c'est une décision, pas un oubli.
 *
 * On ne fait confiance qu'au SERVEUR, et un téléphone n'a pas à porter un
 * traitement qu'on peut lui épargner. `discountPercent` est donc affiché tel
 * qu'il vient — l'application ne le vérifie pas, ne le recompose pas, et
 * n'appelle pas `/public/config` pour se faire un avis : un aller-retour
 * réseau de moins sur l'appareil, et c'est le réseau qui pèse sur un
 * téléphone, pas le calcul.
 *
 * LA DETTE ÉTAIT AU SERVEUR, et elle est réglée. `credit_bundle.bonus_percent`
 * était un entier SAISI À LA MAIN au panneau, que rien ne rattachait aux
 * montants qu'il résume : un palier pouvait annoncer 20 % quand son rapport
 * prix/crédits en valait cinq. Le serveur le DÉDUIT désormais au moment de
 * servir, depuis `credits × credit_unit_price` et `amount` — voir
 * `apps/api/src/payments/remise.ts` et
 * `specs/manques-contrat-mobile-2026-09-09.md` §9.
 *
 * Rien n'a changé ici que le nom du champ, et c'est ce qui a rendu la reprise
 * indolore : l'écran lisait déjà la valeur servie et rien d'autre.
 *
 * Une réduction, pas un bonus : elle abaisse le prix, elle n'augmente pas les
 * crédits. D'où « −N % », comme la planche l'écrit — et le champ s'appelle
 * maintenant `discountPercent`, qui le dit.
 */

// ── Le moyen de payer ───────────────────────────────────────────────────────

/* L'ICÔNE SUIT LA NATURE DU CANAL, et il n'y en a que deux.
 *
 * `kind` est une énumération fermée au contrat : un `switch` exhaustif la
 * suivrait, mais une valeur de plus au contrat casserait la compilation ici
 * sans que personne ne sache quoi dessiner. Le repli sur la carte est donc
 * explicite — « tout ce qui n'est pas un téléphone se paie comme une carte » —
 * et le jour où un troisième moyen arrive, il s'affiche sans faire tomber
 * l'écran, avec une icône approximative qu'on corrigera.
 */
export function iconeDuMoyen(canal: PaymentChannel): string {
  return canal.kind === "mobile_money" ? "smartphone" : "credit-card";
}

// ── Le récapitulatif ────────────────────────────────────────────────────────

export interface Recap {
  credits: number;
  bonus: number | null;
  montant: number;
  frais: number | null;
  total: number;
  devise: string;
}

/* LE TOTAL EST SERVI, JAMAIS ADDITIONNÉ.
 *
 * `montant + frais` a l'air d'être la même chose que `amountToSend`, et ce
 * n'est vrai que d'un côté du barème. Sur la carte, c'est le bénéficiaire qui
 * supporte les frais : le client tape le prix du palier, et il en arrive
 * moins. L'addition afficherait alors un total plus élevé que ce qu'on lui
 * demande de taper, et il taperait ce chiffre-là.
 *
 * Le contrat est explicite — `amountToSend` est « le seul chiffre qui
 * l'intéresse au moment d'agir » —, et le barème (part proportionnelle, part
 * fixe, plancher, plafond, qui les supporte) se règle en administration. Un
 * calcul local mentirait au premier changement, et l'écart se découvrirait
 * devant l'application de l'opérateur, au pire moment.
 *
 * LES FRAIS NULS NE SE MONTRENT PAS. « frais 0 » n'apprend rien et fait
 * douter : on cherche ce qu'on n'a pas vu, on relit, on recompte. La ligne
 * n'existe que s'il y a quelque chose à dire — même règle que `discountPercent`
 * au contrat, « la ligne ne doit alors pas exister plutôt qu'afficher +0 % ».
 */
export function recapDuPaiement(apercu: PaymentPreview): Recap {
  return {
    credits: apercu.credits,
    /* Le champ servi, ici comme sur la liste des paliers. Deux sources
       différentes feraient un récapitulatif qui contredit la liste dont il
       vient — le pire endroit pour un désaccord de chiffres, juste avant de
       payer. */
    bonus: apercu.discountPercent !== null && apercu.discountPercent > 0 ? apercu.discountPercent : null,
    montant: apercu.amount,
    frais: apercu.fee > 0 ? apercu.fee : null,
    total: apercu.amountToSend,
    devise: apercu.currency,
  };
}

/* LA DEVISE EST CELLE QU'ON SERT, pas un symbole deviné.
 *
 * La maquette écrit « 500 F ». Le contrat sert un code ISO, et il le sert
 * précisément pour que le client n'ait rien à déduire : une table
 * XAF → « F » écrite ici serait fausse pour la première autre devise, et
 * personne ne saurait où elle se cache.
 *
 * Les décimales ne paraissent que s'il y en a. Le franc CFA n'a pas de
 * centime, et « 2200,00 » sur un écran de paiement fait chercher une précision
 * qui n'existe pas ; mais un barème à part fixe peut rendre 1020,5, et
 * l'arrondir ferait taper le mauvais montant.
 */
export function montantEnClair(valeur: number, devise: string): string {
  const chiffre = Number.isInteger(valeur) ? String(valeur) : valeur.toFixed(2);
  return `${chiffre} ${devise}`;
}

/* Ce qu'on demande à `/me/payments/preview`. Le schéma valide, comme pour la
   déclaration : un identifiant mal formé doit tomber ici, pas en 400. */
export function corpsDApercu(palier: string, canal: string): PaymentPreviewInput {
  return paymentPreviewInputSchema.parse({ bundleId: palier, channelId: canal });
}

export function apercuDemandable(palier: string | null, canal: string | null): boolean {
  return palier !== null && canal !== null;
}

// ── L'attente, et ce qu'elle raconte ────────────────────────────────────────

export type Attente = "poussee" | "verification";

/* L'ATTENTE SE LIT SUR LE MODE DU PAIEMENT, pas sur le drapeau du moment.
 *
 * Les deux disent la même chose la plupart du temps, et divergent exactement
 * quand ça compte : un drapeau bascule en back-office pendant qu'un paiement
 * dort en attente. L'écran annoncerait alors « Confirmez sur votre téléphone »
 * à quelqu'un dont le versement attend une vérification humaine — il
 * chercherait une notification qui ne viendra jamais, puis renoncerait.
 *
 * `mode` est figé à la création du paiement, avec ses montants et pour la même
 * raison : ce qui explique une opération doit être celui de l'opération, pas
 * celui d'aujourd'hui.
 *
 * `semi_manual` et `manual` attendent tous deux un humain. La distinction
 * intéresse l'administration — qui a saisi quoi — et ne change rien à ce que
 * la personne doit faire, c'est-à-dire rien.
 */
export function natureDeLAttente(mode: PaymentDetail["mode"]): Attente {
  return mode === "provider" ? "poussee" : "verification";
}

/* « RIEN N'A ÉTÉ PRÉLEVÉ » NE SE DIT QUE SI C'EST VRAI.
 *
 * La maquette pose la phrase sans condition, parce qu'elle ne dessine que le
 * paiement automatique : une demande poussée qui échoue n'a rien débité, et
 * c'est la première chose qu'on veut savoir.
 *
 * Sur un versement déclaré, elle est FAUSSE et grave. L'argent est parti de
 * l'opérateur avant qu'on déclare quoi que ce soit ; un refus veut dire que
 * l'administration n'a pas retrouvé la transaction, pas que la personne a
 * gardé son argent. Lui dire qu'elle n'a rien payé, c'est lui apprendre à ne
 * pas réclamer.
 */
export function rienNAEtePreleve(paiement: PaymentDetail): boolean {
  return paiement.mode === "provider";
}

// ── Le suivi ────────────────────────────────────────────────────────────────

export const SUIVI_INTERVALLE_MS = 4000;

/* DEUX MINUTES, ET C'EST LA COPIE QUI LE DIT : « Comptez une à deux minutes ».
 *
 * Le nombre ne se choisit pas au jugé, il se déduit de ce qu'on a promis. Une
 * demande poussée aboutit dans cette fenêtre ou expire.
 *
 * Au-delà, on ARRÊTE, et c'est volontaire. Une vérification humaine se compte
 * en heures — l'écran l'annonce, « vous n'avez plus rien à faire » — et
 * continuer à interroger le serveur toutes les quatre secondes viderait la
 * batterie sur un écran qui vient de dire qu'il n'y a plus rien à attendre.
 */
export const SUIVI_ESSAIS_MAX = 30;

export function suivreEncore(statut: PaymentStatus, essais: number): boolean {
  return statut === "pending" && essais < SUIVI_ESSAIS_MAX;
}

// ── Ce qu'on reprend en rouvrant l'écran ────────────────────────────────────

/* ON NE REPREND QUE L'ATTENTE.
 *
 * Un versement déclaré et non constaté doit se retrouver : sans ça, on
 * redéclare le même virement et deux demandes visent un seul transfert.
 *
 * Un paiement ABOUTI, lui, ne se reprend pas. « Crédits ajoutés » accueillerait
 * la personne à chaque ouverture, indéfiniment, pour un achat d'il y a trois
 * semaines — et l'écran de recharge ne servirait plus à recharger. Un échec non
 * plus : on l'a déjà lu, et le relire empêche de réessayer.
 *
 * Le plus RÉCENT des paiements en attente : s'il y en a plusieurs, c'est celui
 * qu'on vient de déposer qu'on cherche.
 */
export function paiementASuivre(
  paiements: readonly PaymentDetail[],
): PaymentDetail | null {
  return [...paiements]
    .filter((p) => p.status === "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/* UN IDENTIFIANT QUI VIENT D'UN LIEN N'EST PAS UNE AUTORISATION.
 *
 * `/recharge?paiement=…` s'ouvre par lien profond, et ce qui s'y trouve est
 * posé par n'importe qui : une chaîne, un tableau de chaînes quand le paramètre
 * paraît deux fois, un identifiant qui appartient à quelqu'un d'autre.
 *
 * On ne le porte donc PAS jusqu'à `/me/payments/{id}`. Le serveur refuserait —
 * il ne rend que les paiements du porteur du jeton —, mais il refuserait par un
 * 404 que l'écran afficherait comme une panne : « Introuvable » en rouge sur un
 * compte parfaitement sain. On le cherche dans la liste que le serveur vient de
 * rendre, et un identifiant qui n'y est pas n'existe pas.
 */
export function paiementDuLien(
  brut: unknown,
  paiements: readonly PaymentDetail[],
): PaymentDetail | null {
  if (typeof brut !== "string" || brut === "") return null;
  return paiements.find((p) => p.id === brut) ?? null;
}
