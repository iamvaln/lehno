import { z } from "zod";
import { currencySchema } from "./me-wishes.js";

/* Crédits et paiements — spec technique §5.6, dictionnaire : PaymentMethod,
 * Payment, CreditTransaction.
 */

export const PAYMENT_METHOD_KINDS = ["mobile_money", "card"] as const;
export type PaymentMethodKind = (typeof PAYMENT_METHOD_KINDS)[number];

/* Ce que l'écran affiche d'une méthode — et rien d'autre.
 *
 * Le numéro d'un compte mobile money est chiffré au repos, déchiffré pour la
 * seule communication avec le prestataire, et masqué partout à l'affichage :
 * seuls l'opérateur et les quatre derniers chiffres paraissent. Ce schéma est
 * `strict`, donc un serveur qui laisserait fuir `msisdn` ou `providerRef`
 * ferait échouer le parsage plutôt que de les faire traverser jusqu'à un
 * journal de bord ou un rapport d'erreur.
 */
export const paymentMethodSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(PAYMENT_METHOD_KINDS),
  // L'opérateur (« MTN MoMo », « Orange Money ») ou le réseau de la carte.
  brand: z.string().nullable(),
  last4: z.string().regex(/^\d{4}$/).nullable(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  // Détermine la méthode proposée par défaut à l'achat : la plus récente.
  lastUsedAt: z.string().nullable(),
  /* Une méthode ne peut recevoir un remboursement qu'après un délai depuis son
     enregistrement et un premier paiement réussi. La règle est réglable en
     back-office : le serveur rend son verdict, le client ne le recalcule pas. */
  refundEligible: z.boolean(),
}).strict();

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/* Un compte mobile money s'identifie par son numéro ; une carte par la
   référence opaque que le prestataire rend. L'un n'a jamais l'autre. */
/* L'OPÉRATEUR NE SE TAPE PAS, IL SE CHOISIT.
 *
 * `brand` était du texte libre, et la règle « un seul numéro par opérateur »
 * reposait dessus. Une liste de choix à l'écran ne la ferait pas mordre : un
 * client d'une version antérieure, ou un appel direct, enverrait « MTN MoMo »
 * là où un autre envoie « MTN » — deux méthodes pour un même opérateur, et la
 * règle ne verrait rien.
 *
 * La clé devient donc le CANAL, que le serveur connaît : il porte l'opérateur,
 * le pays et la nature. Le client le lit déjà pour la recharge, il n'a rien de
 * nouveau à aller chercher.
 *
 * `brand` reste pour les CARTES, et seulement pour elles : là il vient du
 * prestataire — « Visa », « Mastercard » — et ne désigne pas un opérateur qu'on
 * pourrait choisir dans une liste. */
export const registerPaymentMethodSchema = z.object({
  kind: z.enum(PAYMENT_METHOD_KINDS),
  msisdn: z.string().trim().min(6).max(20).optional(),
  channelId: z.string().uuid().optional(),
  providerRef: z.string().trim().min(1).max(255).optional(),
  brand: z.string().trim().max(40).optional(),
}).strict().superRefine((v, ctx) => {
  if (v.kind === "mobile_money") {
    if (!v.msisdn) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["msisdn"], message: "un compte mobile money porte son numéro" });
    }
    if (!v.channelId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["channelId"], message: "un compte mobile money désigne son canal" });
    }
    if (v.brand) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["brand"], message: "l'opérateur vient du canal, il ne se saisit pas" });
    }
    if (v.providerRef) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["providerRef"], message: "un compte mobile money n'a pas de référence prestataire" });
    }
    return;
  }
  if (!v.providerRef) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["providerRef"], message: "une carte porte sa référence" });
  }
  if (v.msisdn) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["msisdn"], message: "une carte ne porte aucun numéro de téléphone" });
  }
  if (v.channelId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["channelId"], message: "une carte ne passe pas par un canal d'opérateur" });
  }
});

export type RegisterPaymentMethodInput = z.infer<typeof registerPaymentMethodSchema>;

// ── L'achat ─────────────────────────────────────────────────────────────────

export const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "expired", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_DIRECTIONS = ["charge", "refund"] as const;

/* « Soit l'identifiant d'une méthode enregistrée, soit les éléments d'une
   nouvelle à enregistrer au passage — le cas du premier achat. Sans indication,
   le serveur retient la méthode utilisée le plus récemment. »

   Les deux à la fois ne veulent rien dire : le serveur devrait deviner laquelle
   débiter, et il débiterait peut-être la mauvaise. */
export const startPaymentSchema = z.object({
  credits: z.number().int().positive(),
  paymentMethodId: z.string().uuid().optional(),
  newPaymentMethod: registerPaymentMethodSchema.optional(),
  idempotencyKey: z.string().min(1).max(128).optional(),
}).strict().refine(
  (v) => !(v.paymentMethodId && v.newPaymentMethod),
  { path: ["paymentMethodId"], message: "une méthode connue ou une neuve, pas les deux" },
);

export type StartPaymentInput = z.infer<typeof startPaymentSchema>;

export const paymentSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(PAYMENT_DIRECTIONS),
  amount: z.number().nonnegative(),
  currency: currencySchema,
  credits: z.number().int(),
  status: z.enum(PAYMENT_STATUSES),
  // Le motif du refus, pour l'affichage — l'écran de recharge le montre.
  failureReason: z.string().nullable(),
  paymentMethodId: z.string().uuid().nullable(),
  createdAt: z.string(),
}).strict();

export type Payment = z.infer<typeof paymentSchema>;

// ── La recharge par palier, voie manuelle ───────────────────────────────────

/**
 * Un palier d'achat.
 *
 * **Un achat porte un palier, jamais un montant libre** (§5.6) : le plus petit
 * fixe le minimum. C'est ce qui permet d'annoncer une remise en clair, et ce
 * qui évite d'avoir à valider un montant arbitraire contre un barème.
 */
export const creditBundleSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().nonnegative(),
  currency: currencySchema,
  credits: z.number().int().positive(),
  /**
   * La remise, en clair, sur les plus grands paliers — « +20 % offerts ».
   * C'est un argument de vente, pas une décoration : nul quand il n'y en a pas,
   * et **la ligne ne doit alors pas exister** plutôt qu'afficher « +0 % ».
   */
  bonusPercent: z.number().int().nullable(),
  position: z.number().int(),
}).strict();

export const creditBundlesSchema = z.object({
  bundles: z.array(creditBundleSchema),
}).strict();

/**
 * Un canal de paiement : un opérateur, dans un pays, avec son barème.
 *
 * **Ce n'est pas une méthode de paiement.** Le canal est ce que le service
 * propose — une poignée, réglés en administration. La méthode est ce qu'un
 * client a enregistré, autant que de clients. Les fondre porterait un taux de
 * frais sur le numéro de chaque client, et changer le barème d'un opérateur
 * demanderait de tous les corriger.
 */
export const paymentChannelSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(PAYMENT_METHOD_KINDS),
  operator: z.string(),
  country: z.string(),
  label: z.string(),
  /**
   * Qui supporte les frais. **Ça change le sens du calcul**, pas seulement son
   * affichage : sur le mobile money le client paie en plus — un palier à 1 000
   * fait verser 1 020 et il en arrive 1 000. La carte fera l'inverse.
   *
   * Le client n'a pas à en déduire quoi que ce soit : `/me/payments/preview`
   * rend les montants déjà calculés.
   */
  feeBorneBy: z.enum(["payer", "payee"]),
  currency: currencySchema,
}).strict();

export const paymentChannelsSchema = z.object({
  channels: z.array(paymentChannelSchema),
}).strict();

/**
 * Un compte sur lequel verser.
 *
 * Ne sont rendus que ceux qui sont **visibles ET actifs**. Les deux ne disent
 * pas la même chose en base : le premier décide de ce que le client voit, le
 * second de ce qui reste employable. Le client ne voit que l'intersection, et
 * **la création refuse un compte hors de cette intersection** — sinon un client
 * qui garde son écran ouvert verserait sur un compte qu'on vient de retirer.
 */
export const collectionAccountSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  operator: z.string(),
  number: z.string(),
}).strict();

export const collectionAccountsSchema = z.object({
  accounts: z.array(collectionAccountSchema),
}).strict();

/**
 * Ce qu'on demande avant de payer : un palier, un canal.
 */
export const paymentPreviewInputSchema = z.object({
  bundleId: z.string().uuid(),
  channelId: z.string().uuid(),
}).strict();

export type PaymentPreviewInput = z.infer<typeof paymentPreviewInputSchema>;

/**
 * Ce qu'un achat coûtera, calculé par le serveur.
 *
 * **Quatre montants, et ils ne disent pas la même chose.** Les confondre est
 * l'erreur la plus coûteuse de cet écran :
 *
 * - `amount` — le prix du palier ;
 * - `fee` — ce que l'opérateur prélève ;
 * - `amountToSend` — **ce que le client doit taper** dans son application
 *   d'opérateur. C'est le seul chiffre qui l'intéresse au moment d'agir ;
 * - `expectedOnAccount` — ce que l'administrateur doit voir arriver. Tout
 *   manque est un vrai écart, pas le fonctionnement de l'opérateur.
 *
 * Le client **n'en recalcule aucun**. Refaire le calcul côté client le ferait
 * diverger du serveur le jour où un barème change, et l'écart se découvrirait
 * devant l'application de l'opérateur — au pire moment.
 */
export const paymentPreviewSchema = z.object({
  amount: z.number().nonnegative(),
  fee: z.number().nonnegative(),
  amountToSend: z.number().nonnegative(),
  expectedOnAccount: z.number().nonnegative(),
  currency: currencySchema,
  credits: z.number().int().positive(),
  bonusPercent: z.number().int().nullable(),
}).strict();

export type PaymentPreview = z.infer<typeof paymentPreviewSchema>;

/**
 * Déclarer un versement déjà effectué — la voie **semi-manuelle**.
 *
 * L'ordre des gestes n'est pas celui d'un paiement automatique : le client
 * verse d'abord depuis son application d'opérateur, **puis** vient le déclarer.
 * Le paiement naît donc `pending`, et c'est l'administration qui constate la
 * réception sur le compte.
 *
 * **Aucun fichier n'est déposé.** La référence de transaction le remplace — le
 * code que l'opérateur envoie par SMS juste après le versement.
 *
 * Ce n'est pas un pis-aller. Une capture d'écran ne prouve rien : la spec le
 * dit — « un montage est facile ; c'est la réception sur le compte de
 * l'opérateur qui fait foi » —, et l'administration l'efface une fois la
 * demande traitée. La référence, elle, **retrouve la transaction sur le
 * relevé**, ce qu'aucune image ne fait.
 *
 * Et elle apporte ce que le fichier n'apportait pas : **elle est unique**. Deux
 * déclarations ne peuvent pas citer le même versement, donc personne ne peut
 * réclamer deux fois les crédits d'un seul transfert. Une image ne se compare à
 * rien.
 */
export const declarePaymentSchema = z.object({
  bundleId: z.string().uuid(),
  channelId: z.string().uuid(),
  collectionAccountId: z.string().uuid(),
  /** Le numéro employé pour verser. Format libre : les opérateurs diffèrent. */
  payerMsisdn: z.string().min(6).max(32),
  /**
   * La référence de la transaction, telle que l'opérateur l'a envoyée.
   *
   * **Obligatoire.** Sans elle, l'administration doit rapprocher sur le montant,
   * le numéro et l'heure — le rapprochement ambigu qui fait approuver le mauvais
   * versement. Avec elle, la correspondance est exacte.
   *
   * Format libre : les opérateurs ne s'accordent sur rien. On vérifie qu'il y a
   * quelque chose, pas qu'il ressemble à ce qu'on croit connaître d'un
   * opérateur — une règle de forme trop stricte rejetterait le jour où l'un
   * d'eux change la sienne, et personne ne saurait pourquoi.
   */
  providerRef: z.string().trim().min(4).max(120),
}).strict();

export type DeclarePaymentInput = z.infer<typeof declarePaymentSchema>;

/**
 * Un paiement tel que le client le suit.
 *
 * Les montants figés à la création accompagnent la ligne : **relire le barème
 * du jour pour expliquer un paiement d'il y a trois mois donnerait un chiffre
 * faux**, et c'est en litige qu'on va le lire.
 */
export const paymentDetailSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(PAYMENT_STATUSES),
  mode: z.enum(["provider", "semi_manual", "manual"]),
  amount: z.number().nonnegative(),
  currency: currencySchema,
  credits: z.number().int(),
  fee: z.number().nonnegative().nullable(),
  expectedOnAccount: z.number().nonnegative().nullable(),
  failureReason: z.string().nullable(),
  /** Le compte visé, pour que l'écran puisse rappeler où l'argent a été versé. */
  collectionAccount: collectionAccountSchema.nullable(),
  createdAt: z.string(),
}).strict();

export const paymentsSchema = z.object({
  payments: z.array(paymentDetailSchema),
}).strict();

export type PaymentDetail = z.infer<typeof paymentDetailSchema>;
export type CreditBundle = z.infer<typeof creditBundleSchema>;
export type PaymentChannel = z.infer<typeof paymentChannelSchema>;
export type CollectionAccount = z.infer<typeof collectionAccountSchema>;

// ── Le solde ────────────────────────────────────────────────────────────────

export const CREDIT_TRANSACTION_TYPES = ["grant", "purchase", "consumption", "adjustment"] as const;

/* POURQUOI ce mouvement existe, du point de vue de CELUI QUI LE LIT.
 *
 * Ce vocabulaire est celui de l'utilisateur, pas celui de la comptabilité. Les
 * deux ne coïncident pas : nous distinguons un achat par l'application d'un
 * virement vérifié à la main, lui a payé dans les deux cas. Servir notre
 * taxonomie interne lui apprendrait des opérations qu'il n'a pas demandées, et
 * coupleraient son application à notre plan comptable — le jour où celui-ci
 * gagne une catégorie, son écran casserait.
 *
 * `type` ne suffit pas : un cadeau de bienvenue et un bonus de parrainage sont
 * tous deux des « grant », tous deux +5, et ce sont pourtant deux nouvelles
 * différentes — l'une se reçoit, l'autre se mérite.
 *
 * Aucun fourre-tout, et c'est délibéré. « Ajustement » disait « on a corrigé
 * une erreur » là où l'on voulait dire « on vous offre quelque chose » : deux
 * nouvelles opposées sous un même mot. Elles ont chacune la leur.
 */
export const CREDIT_REASONS = [
  "signup",     // le cadeau de bienvenue, à l'inscription
  "referral",   // le bonus d'une invitation — la seule qui se mérite
  "purchase",   // un achat, par l'application ou par virement vérifié
  "promo",      // un code promotionnel
  "gift",       // un cadeau : geste commercial, dédommagement
  "reward",     // une récompense : concours, défi
  "usage",      // une génération consommée
  "refund",     // un remboursement : les crédits repris avec l'argent rendu
  "correction", // une erreur réparée — le seul cas qui dit vraiment « ajustement »
] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];

/* Les libellés à afficher, dans les deux langues.
 *
 * Ils vivent ICI et non dans la réponse : le serveur n'a pas à connaître la
 * langue de celui qui appelle, et un même mot n'a pas à exister à deux
 * endroits. Le client les recopie dans ses ressources de traduction — c'est la
 * règle du contrat commun, « le client traduit le code ».
 *
 * Ils sont fournis pour qu'aucune équipe n'ait à les inventer : deux clients
 * qui traduisent « referral » chacun de son côté finissent par dire deux
 * choses différentes de la même ligne. */
export const CREDIT_REASON_LABELS: Record<CreditReason, { fr: string; en: string }> = {
  signup:     { fr: "Cadeau de bienvenue",  en: "Welcome gift" },
  referral:   { fr: "Bonus de parrainage",  en: "Referral bonus" },
  purchase:   { fr: "Achat de crédits",     en: "Credit purchase" },
  promo:      { fr: "Code promotionnel",    en: "Promo code" },
  gift:       { fr: "Cadeau",               en: "Gift" },
  reward:     { fr: "Récompense",           en: "Reward" },
  usage:      { fr: "Génération",           en: "Generation" },
  refund:     { fr: "Remboursement",        en: "Refund" },
  correction: { fr: "Correction",           en: "Correction" },
};

/* Ce que la comptabilité distingue, et que l'utilisateur n'a pas à connaître.
 * Reste EN BASE, ne franchit jamais une route mobile. */
export const CREDIT_SOURCES = [
  "signup_grant",
  "referral_bonus",
  /* Le cadeau réservé à qui attendait sur la liste. Une source à PART de
     `gift` : celui-ci est discrétionnaire — un geste commercial décidé au cas
     par cas —, celui-là est systématique et se compte. Sans la distinction, on
     ne saurait pas combien d'inscrits en attente ont converti, ni ce que ça a
     coûté. L'utilisateur, lui, voit la même chose : « Cadeau de bienvenue ». */
  "waitlist_bonus",
  "purchase",
  "manual_topup",
  "promo_code",
  "gift",
  "reward",
  "consumption",
  "refund",
  "correction",
] as const;
export type CreditSource = (typeof CREDIT_SOURCES)[number];

/* La traduction de l'un vers l'autre, en UN endroit.
 *
 * `manual_topup` est le seul à se fondre : de l'intérieur c'est un virement
 * vérifié à la main, de l'extérieur c'est un achat — le client a payé, la
 * façon dont l'argent nous est parvenu ne le regarde pas. */
export const RAISON_DE_LA_SOURCE: Record<CreditSource, CreditReason> = {
  signup_grant: "signup",
  referral_bonus: "referral",
  // Un cadeau, du point de vue de qui le reçoit : la source dit d'où il vient,
  // la raison dit ce que l'utilisateur en lit.
  waitlist_bonus: "gift",
  purchase: "purchase",
  manual_topup: "purchase",
  promo_code: "promo",
  gift: "gift",
  reward: "reward",
  consumption: "usage",
  refund: "refund",
  correction: "correction",
};

export const creditTransactionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(CREDIT_TRANSACTION_TYPES),
  // Signé : + au crédit, − au débit. Un débit noté positif gonflerait le solde
  // au lieu de le réduire.
  amount: z.number().int(),
  // La RAISON, dans le vocabulaire de l'utilisateur — jamais la source
  // comptable. Voir CREDIT_REASON_LABELS pour les libellés des deux langues.
  reason: z.enum(CREDIT_REASONS),
  createdAt: z.string(),
}).strict();

/* « Solde = somme des mouvements. Aucune colonne de solde stockée. » Le serveur
   le calcule et le rend ; le client ne le refait pas, sous peine de deux
   vérités qui divergent dès qu'un mouvement arrive hors de la page. */
export const creditBalanceSchema = z.object({
  // Un solde négatif signifierait qu'une action payante s'est lancée sans
  // provision : c'est un défaut du serveur, pas un état à afficher.
  balance: z.number().int().min(0),
  transactions: z.array(creditTransactionSchema),
}).strict();

export type CreditBalance = z.infer<typeof creditBalanceSchema>;
export type CreditTransaction = z.infer<typeof creditTransactionSchema>;

// ── Le parrainage ───────────────────────────────────────────────────────────

export const REFERRAL_STATUSES = ["invited", "registered", "credited"] as const;

export const referredPersonSchema = z.object({
  // Le pseudo, jamais l'adresse : un parrain n'a pas à connaître la boîte de
  // ses filleuls sous prétexte qu'il les a invités.
  username: z.string(),
  status: z.enum(REFERRAL_STATUSES),
  createdAt: z.string(),
}).strict();

export const referralSummarySchema = z.object({
  code: z.string(),
  invited: z.array(referredPersonSchema),
  // Somme des mouvements rattachés à ses parrainages. Calculée, comme le
  // solde — un compteur stocké finirait par diverger du registre.
  creditsEarned: z.number().int().min(0),
  /* CE QUE LE PARRAINAGE RAPPORTE aujourd'hui, ou rien.
   *
   * Nul quand `credits` est éteint. Le drapeau `referral` ne dépend PAS de
   * `credits` — l'éteindre tuerait l'acquisition avec la monétisation, ce que
   * §6.4 interdit nommément — mais le parrainage n'a alors plus de crédits à
   * promettre : ils n'achètent rien, et les générations sont gratuites.
   *
   * L'écran lit donc cette VALEUR, jamais les deux drapeaux. Un client qui
   * croiserait `referral` et `credits` lui-même referait le raisonnement du
   * serveur, et s'en écarterait le jour où il change. Nul, il présente le
   * parrainage sans promesse chiffrée ; renseigné, il l'annonce. */
  bonusParInvitation: z.number().int().positive().nullable(),
}).strict();

export type ReferralSummary = z.infer<typeof referralSummarySchema>;

// ── La page d'invitation, ouverte sans compte ───────────────────────────────

/* Ce qu'un invité voit avant d'avoir un compte. Le strict minimum pour donner
   envie et rassurer : qui invite, et ce qu'on y gagne. Aucune donnée du
   parrain au-delà de son pseudo — un code d'invitation circule, et tout ce
   qu'on met ici circule avec lui. */
export const invitationSchema = z.object({
  code: z.string(),
  inviterUsername: z.string(),
  creditsForInvited: z.number().int().min(0),
}).strict();

export type Invitation = z.infer<typeof invitationSchema>;
