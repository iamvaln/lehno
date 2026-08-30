import { z } from "zod";
import { currencySchema } from "./me-wishes.js";

/* La liste partagée et la réservation d'un souhait — surfaces publiques §3.6,
 * parcours de réservation §3.4, brief `brief-design-liste-partagee.md`.
 * Drapeaux `wishlist.own` (la page) et `reservation` (le geste).
 *
 * Ces appels se font SANS COMPTE : l'autorisation tient au jeton porté par le
 * lien, qui désigne la ressource et vaut permission — rien d'autre.
 */

/* L'en-tête par lequel un visiteur déjà confirmé se fait reconnaître à son
 * retour. Un en-tête plutôt qu'un segment d'URL : le jeton n'a alors aucune
 * raison d'atteindre un journal d'accès, un référent, ou le presse-papier de
 * quelqu'un qui repartage la page.
 *
 * Et surtout PAS `Authorization: Bearer` : ce jeton-là ne vaut pas session de
 * compte, il ne désigne que des réservations. Les mêler laisserait un jour un
 * garde d'authentification en accepter un pour l'autre. */
export const ENTETE_JETON_RESERVATION = "x-lehno-reservation";

// ── Ce qu'un visiteur voit ──────────────────────────────────────────────────

export const publicWishSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  imageUrl: z.string().url().nullable(),
  details: z.string().nullable(),
  link: z.string().url().nullable(),
  price: z.number().nonnegative().nullable(),
  currency: currencySchema.nullable(),
  /* Réservé OUI, par qui JAMAIS. Le cadeau pris reste visible — c'est ce qui
     évite les doublons, donc la raison d'être du mécanisme — mais aucun champ
     de cette forme ne nomme le réservant, pas même sous condition : le nom
     qu'un visiteur a accepté de donner l'a été au PROPRIÉTAIRE, pas aux
     autres visiteurs. */
  isReserved: z.boolean(),
  isFulfilled: z.boolean(),
  /* « Le visiteur revenu retrouve les siens, signalés à lui seul. » Vrai
     uniquement pour celui qui présente le jeton de sa propre réservation ; un
     visiteur quelconque le reçoit toujours à faux. */
  reservedByMe: z.boolean(),
}).strict();

export type PublicWish = z.infer<typeof publicWishSchema>;

/* La réponse porte son ÉTAT, elle ne se contente pas d'un statut.
 *
 * « Un lien révoqué, un Mur dépublié : le serveur rend un état explicite que la
 * page traduit en message, plutôt qu'une absence sèche » (spec §7). Un `404`
 * sur un lien révoqué ferait afficher « cette page n'existe pas » à quelqu'un
 * qui tient un lien qui a existé — et qui, lui, sait qu'il a existé.
 *
 * Un jeton INCONNU, lui, rend bien `404` : là, rien n'a jamais existé, et dire
 * « révoqué » apprendrait qu'un jeton a un jour été valide. Trente-deux
 * caractères tirés au hasard ne s'énumèrent pas ; c'est ce qui rend la
 * distinction tenable. */
export const sharedWishlistSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("ok"),
    // « C'est Awa qui m'envoie ça » — la personne d'abord, la liste ensuite.
    ownerFirstName: z.string(),
    ownerAvatarUrl: z.string().url().nullable(),
    occasionLabel: z.string().nullable(),
    occasionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /* Faux quand l'occasion est passée : la liste s'affiche, sans accepter de
       réservation. Le client n'a pas à comparer la date lui-même — deux
       versions du parc, deux fuseaux, deux réponses. */
    acceptsReservations: z.boolean(),
    wishes: z.array(publicWishSchema),
  }).strict(),
  // Le lien a existé et ne mène plus : « ce lien n'est plus actif », sans
  // reproche et sans rien dire du propriétaire.
  z.object({ state: z.literal("revoked") }).strict(),
]);

export type SharedWishlist = z.infer<typeof sharedWishlistSchema>;

// ── Réserver ────────────────────────────────────────────────────────────────

export const reserveWishSchema = z.object({
  /* Facultative SEULEMENT pour un utilisateur connecté, dont l'adresse est
     déjà vérifiée par son compte : il réserve en un geste. Le visiteur sans
     compte doit la donner, et le serveur refuse sans elle — la règle est
     conditionnelle à la session, donc elle vit au serveur, pas au schéma. */
  email: z.string().email().max(254).optional(),
  // Le nom ne sert que si `showIdentity` : le retenir sans lui serait garder
  // une donnée dont on s'est engagé à ne rien faire.
  displayName: z.string().trim().min(1).max(80).optional(),
  /* « Une case, pas une question. » Par défaut la réservation reste anonyme
     aux yeux du propriétaire ; celui qui veut se nommer coche. */
  showIdentity: z.boolean().optional(),
  // La langue du courriel qui porte le code. Le visiteur n'a pas de compte
  // d'où la déduire — c'est la page qui la connaît.
  locale: z.enum(["fr", "en"]).optional(),
  /* Champ leurre et instant de rendu : même rôle qu'au formulaire de liste
     d'attente (voir `waitlistJoinSchema`). Ils figurent au contrat, sinon le
     `.strict()` refuserait la soumission par une erreur de validation — ce qui
     apprendrait au robot que le leurre existe. */
  website: z.string().max(254).optional(),
  renderedAt: z.number().int().positive().optional(),
}).strict();

export type ReserveWishInput = z.infer<typeof reserveWishSchema>;

export const reserveOutcomeSchema = z.discriminatedUnion("state", [
  /* Le visiteur sans compte : un code part, et la réservation ne tient qu'une
     fois ce code vérifié. Tant qu'elle est en attente, le souhait DEMEURE
     disponible pour un autre — sans quoi une adresse inventée suffirait à
     bloquer un cadeau. */
  z.object({
    state: z.literal("code_sent"),
    reservationId: z.string().uuid(),
    expiresAt: z.string(),
  }).strict(),
  // L'utilisateur connecté : son adresse est déjà vérifiée, la réservation
  // naît confirmée. Il reçoit tout de même un jeton de visite, pour que la
  // page publique le reconnaisse sans compter sur sa session de compte.
  z.object({
    state: z.literal("confirmed"),
    reservationId: z.string().uuid(),
    sessionToken: z.string(),
  }).strict(),
]);

export type ReserveOutcome = z.infer<typeof reserveOutcomeSchema>;

export const verifyReservationSchema = z.object({
  /* L'adresse ACCOMPAGNE le code : c'est elle qui fait l'identité, le jeton
     n'étant qu'un raccourci. Sans elle, il faudrait chercher la réservation
     par le seul souhait, et un code à six chiffres se rejouerait contre toutes
     les demandes en attente sur ce cadeau. */
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/),
}).strict();

export type VerifyReservationInput = z.infer<typeof verifyReservationSchema>;

export const reservationConfirmedSchema = z.object({
  reservationId: z.string().uuid(),
  wishId: z.string().uuid(),
  /* Le raccourci du retour : présenté dans `x-lehno-reservation`, il fait
     reconnaître SES réservations, et celles-là seulement. Rendu une seule
     fois — la base n'en garde que le condensé. */
  sessionToken: z.string(),
}).strict();

export type ReservationConfirmed = z.infer<typeof reservationConfirmedSchema>;

// ── Annuler ─────────────────────────────────────────────────────────────────

/* Une réservation s'annule, et c'était le seul geste irréversible qu'un
 * visiteur sans compte pouvait faire : sans cette route, celui qui se trompe —
 * ou qui ne peut plus offrir — bloquait le cadeau jusqu'à la date, sans recours,
 * après trois clics.
 *
 * Pas de corps : le souhait est dans le chemin, et l'identité vient du jeton de
 * visite (ou de la session). Rien d'autre n'a à être dit.
 *
 * La réponse porte `cancelled: true` plutôt qu'un 204 muet, comme le dépôt
 * porte `submitted: true` : le client sait qu'il a été entendu, et non
 * seulement que rien n'a cassé.
 */
export const cancelReservationResponseSchema = z.object({
  cancelled: z.literal(true),
}).strict();

export type CancelReservationResponse = z.infer<typeof cancelReservationResponseSchema>;
