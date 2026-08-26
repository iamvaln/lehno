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
export const registerPaymentMethodSchema = z.object({
  kind: z.enum(PAYMENT_METHOD_KINDS),
  msisdn: z.string().trim().min(6).max(20).optional(),
  providerRef: z.string().trim().min(1).max(255).optional(),
  brand: z.string().trim().max(40).optional(),
}).strict().superRefine((v, ctx) => {
  if (v.kind === "mobile_money") {
    if (!v.msisdn) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["msisdn"], message: "un compte mobile money porte son numéro" });
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

// ── Le solde ────────────────────────────────────────────────────────────────

export const CREDIT_TRANSACTION_TYPES = ["grant", "purchase", "consumption", "adjustment"] as const;

/* Pourquoi ce mouvement existe, en CODE STABLE — jamais en phrase.
 *
 * Le client ne montre pas le texte du serveur : il traduit le code dans la
 * langue de l'utilisateur, exactement comme pour les erreurs et les
 * notifications. L'écran de bienvenue en dépend directement — il affiche deux
 * lignes, « cadeau de bienvenue » et « bonus de parrainage », et sans code il
 * devrait reconnaître des phrases françaises pour les séparer.
 *
 * `type` ne suffit pas : un « grant » d'inscription et un « grant » de
 * parrainage se ressemblent, et ce sont pourtant deux gestes distincts dont
 * l'un se mérite. Les confondre efface la raison d'inviter quelqu'un. */
export const CREDIT_SOURCES = [
  "signup_grant",
  "referral_bonus",
  "purchase",
  "manual_topup",
  "promo_code",
  "consumption",
  "admin_adjustment",
] as const;
export type CreditSource = (typeof CREDIT_SOURCES)[number];

export const creditTransactionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(CREDIT_TRANSACTION_TYPES),
  // Signé : + au crédit, − au débit. Un débit noté positif gonflerait le solde
  // au lieu de le réduire.
  amount: z.number().int(),
  source: z.enum(CREDIT_SOURCES),
  // Note libre, destinée au journal et à l'administration — un motif de
  // rejet, une observation. Le client ne l'affiche jamais : elle n'est ni
  // traduite ni traduisible.
  reason: z.string().nullable(),
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
