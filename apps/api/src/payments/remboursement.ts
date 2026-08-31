/* Le remboursement du solde à la suppression du compte — CGU §6, spec mobile
 * §3.24.
 *
 * Des fonctions PURES, sans Prisma ni horloge implicite, pour deux raisons.
 * La première est qu'elles portent une promesse publique : les CGU disent au
 * mot près ce qui se rembourse et sous quelles conditions, et une règle qu'on
 * ne peut éprouver qu'en montant une base ne s'éprouve pas assez souvent. La
 * seconde est qu'elles serviront à deux endroits — ici, à la suppression, et
 * sur `/me/payment-methods`, dont le contrat déclare déjà `refundEligible`
 * (packages/contracts/src/me-credits.ts) sans que rien ne le calcule encore.
 * Deux implémentations de la même clause finiraient par diverger, et c'est
 * la clause qui se retrouverait fausse d'un côté.
 */

/** Le délai des CGU §6 : « enregistrée depuis plus de deux semaines ». */
export const DELAI_METHODE_DEFAUT_JOURS = 14;

const JOUR_MS = 24 * 60 * 60_000;

/* Les sources d'un mouvement qui correspondent à de l'ARGENT VERSÉ.
 *
 * `manual_topup` en fait partie, et ce n'est pas un détail comptable : le
 * client a payé par virement vérifié à la main plutôt que par l'application,
 * mais il a payé. Les CGU parlent des « crédits que vous avez achetés », pas
 * du chemin qu'a pris l'argent. L'exclure rendrait la promesse fausse pour
 * précisément les clients qu'on a servis à la main.
 *
 * `refund` complète la liste par le bas : ses montants sont négatifs, et ils
 * doivent retrancher — sans quoi un solde déjà remboursé une fois se
 * rembourserait deux fois.
 */
const SOURCES_PAYEES = new Set(["purchase", "manual_topup", "refund"]);

export type Mouvement = { source: string; amount: number };

/** Une méthode de paiement, réduite aux deux dates dont dépend la clause. */
export type MethodePourEligibilite = {
  createdAt: Date;
  firstSuccessfulPaymentAt: Date | null;
};

/* Les DEUX conditions des CGU §6, et il en faut deux.
 *
 * L'ancienneté seule laisserait renvoyer de l'argent vers un numéro qu'on
 * n'a jamais vu fonctionner — une faute de frappe suffirait à l'envoyer chez
 * quelqu'un d'autre, sans retour possible. Le premier paiement réussi seul
 * laisserait enregistrer une méthode, payer un crédit avec, et demander
 * aussitôt le remboursement du solde entier ailleurs : c'est le blanchiment
 * par le service, et le délai est ce qui l'empêche.
 *
 * `maintenant` est un paramètre plutôt qu'un `new Date()` interne : une règle
 * de délai dont on ne peut pas choisir l'instant ne s'éprouve qu'en attendant
 * deux semaines, ou en acceptant un test qui ne mord qu'une fois sur deux.
 */
export function methodeEligibleAuRemboursement(
  methode: MethodePourEligibilite,
  maintenant: Date,
  delaiJours: number = DELAI_METHODE_DEFAUT_JOURS,
): boolean {
  if (methode.firstSuccessfulPaymentAt === null) return false;
  const age = maintenant.getTime() - methode.createdAt.getTime();
  // « PLUS DE deux semaines », strictement : à quatorze jours pile, la
  // condition n'est pas encore remplie. Le `>=` serait une lecture généreuse
  // d'un texte qui protège une sortie d'argent.
  return age > delaiJours * JOUR_MS;
}

/* La part ACHETÉE qui reste, en crédits.
 *
 * Le registre ne dit pas dans quelle poche une dépense a puisé : une
 * consommation est un mouvement négatif sans source d'origine. Il faut donc
 * une convention, et celle-ci est la plus favorable à la personne qui part :
 * les dépenses sont réputées avoir consommé les crédits OFFERTS en premier.
 *
 * L'inverse serait défendable en comptabilité et indéfendable au guichet :
 * quelqu'un qui a reçu cinq crédits de bienvenue, en a acheté cent et en a
 * dépensé cinq se verrait rembourser quatre-vingt-quinze crédits sur cent
 * achetés, en s'entendant dire que ce sont ses achats qui sont partis. Nous
 * choisissons de rembourser cent.
 *
 * Le plafond par le solde reste indispensable : on ne rend jamais plus de
 * crédits que le compte n'en porte, sinon un gros achat entièrement dépensé
 * ouvrirait un droit à remboursement sur un solde vide.
 */
export function creditsRemboursables(mouvements: Mouvement[]): number {
  let solde = 0;
  let achete = 0;
  for (const m of mouvements) {
    solde += m.amount;
    if (SOURCES_PAYEES.has(m.source)) achete += m.amount;
  }
  return Math.max(0, Math.min(solde, achete));
}

/** Le solde entier, offerts compris — ce que l'écran des crédits affiche. */
export function soldeTotal(mouvements: Mouvement[]): number {
  return mouvements.reduce((total, m) => total + m.amount, 0);
}

export type PaiementReussi = { amount: number; credits: number; currency: string };

/* CE QUE VALENT en argent les crédits remboursables.
 *
 * Le prix d'un crédit n'est pas une constante : il dépend du palier acheté,
 * et les paliers changent. On le retrouve donc dans les achats de CETTE
 * personne — montant total versé rapporté aux crédits obtenus — plutôt que
 * dans le tarif du jour. Les CGU §6 le disent : « un achat déjà effectué
 * garde ses conditions ». Rembourser au tarif courant ferait perdre à celui
 * qui a acheté pendant une promotion, et gagner à celui qui a acheté avant
 * une hausse.
 *
 * Nul quand on ne peut pas répondre honnêtement : aucun achat, ou des achats
 * dans PLUSIEURS devises. Le second cas mérite qu'on s'y arrête — annoncer
 * « 3 400 » sans savoir de quelle monnaie, ou convertir à un taux qu'on
 * n'affiche pas, serait pire que de passer la main. §3.24 prévoit ce chemin :
 * l'écran l'explique et oriente vers l'assistance.
 */
export function montantDuRemboursement(
  creditsARendre: number,
  paiements: PaiementReussi[],
): { amount: number; currency: string } | null {
  if (creditsARendre <= 0 || paiements.length === 0) return null;

  const devises = new Set(paiements.map((p) => p.currency));
  if (devises.size > 1) return null;
  const currency = paiements[0]!.currency;

  let verse = 0;
  let obtenus = 0;
  for (const p of paiements) {
    verse += p.amount;
    obtenus += p.credits;
  }
  if (obtenus <= 0) return null;

  // Arrondi au centième INFÉRIEUR côté prix unitaire ? Non : on arrondit le
  // montant final au centième le plus proche. Tronquer chaque crédit ferait
  // perdre quelques francs sur un gros solde, et une promesse de
  // remboursement qui rend systématiquement un peu moins est une promesse
  // tenue de travers.
  const amount = Math.round(((verse / obtenus) * creditsARendre + Number.EPSILON) * 100) / 100;
  return { amount, currency };
}
