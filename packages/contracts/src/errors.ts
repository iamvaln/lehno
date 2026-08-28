import { z } from "zod";

export const ERROR_CODES = [
  // requête
  "validation_failed", "not_found", "conflict", "rate_limited", "internal_error",
  // session
  "unauthorized", "forbidden", "session_expired", "refresh_reused",
  // code à usage unique
  "otp_invalid", "otp_expired", "otp_too_many_attempts", "otp_rate_limited",
  // Administration : un geste qui change un état exige son motif (spec §7).
  // Un code à part plutôt que validation_failed — l'interface doit pouvoir dire
  // « il manque le motif » et non « la requête est mal formée ».
  "reason_required",
  /* Une configuration de studio qu'on veut publier sans qu'aucun essai réussi
     ne porte son empreinte. 422, et un code à part de `validation_failed` :
     l'écran doit pouvoir dire « essayez-la d'abord » plutôt que « la requête
     est mal formée » — c'est la même raison qui a fait exister
     `reason_required`. Un bouton grisé sans explication s'interprète comme une
     panne. */
  "trial_required",
  // Un palier retiré, un canal fermé, un compte de collecte désactivé : la
  // requête est bien formée, la règle ne l'est pas. 422, pas 400 — et un code
  // à part de validation_failed, pour que l'écran puisse dire « ce palier n'est
  // plus proposé » au lieu de « la demande est mal formée ».
  "resource_inactive",
  // Une action payante lancée sans provision, ou une reprise qui creuserait le
  // solde. 422 : la demande est bien formée, c'est l'état du compte qui ne s'y
  // prête pas. Le contrat commun le cite comme l'exemple même d'un code stable.
  "insufficient_credits",
  // compte
  "username_taken", "username_invalid", "device_limit_reached",
  "account_suspended", "account_pending_deletion",
  // identité externe
  "federated_token_invalid", "federated_already_linked",
  // adresse électronique, sur toute surface qui en accepte une
  //
  // `email_disposable` dit à l'interface pourquoi l'adresse est refusée, pour
  // qu'elle puisse en proposer une autre plutôt que d'afficher une erreur
  // muette. La règle vit dans apps/api/src/common/email.ts et s'applique
  // partout : liste d'attente, code de connexion, réservation, dépôt d'un vœu.
  "email_disposable",
  // liste d'attente
  "waitlist_email_invalid",
  // Un seul code pour les deux filtres à robots — champ leurre rempli, délai
  // de soumission invraisemblable. Dire lequel a mordu apprendrait au robot
  // comment s'ajuster.
  "waitlist_rejected",
  // L'API est arrêtée pour intervention. 503, JAMAIS 404 : un 404 dirait au
  // client que la ressource n'existe plus, et le contrat lui demande alors de
  // relire ses drapeaux et de masquer l'écran — une fenêtre de deux heures se
  // lirait comme une suppression. 503 dit « reviens », et porte le délai.
  "maintenance",
  /* Aucun modèle d'IA ne peut répondre : la chaîne de la tâche est vide, ou
     tous ses rangs ont échoué. 503 et non 500 — l'API va bien, c'est un
     fournisseur tiers qui ne répond pas, et la demande vaudra encore dans cinq
     minutes. À part de `maintenance`, qui dit que L'API est arrêtée : ici le
     reste de l'application fonctionne, et l'écran ne doit surtout pas se
     masquer en entier.

     Un refus du modèle ne porte PAS ce code : ce n'est pas une indisponibilité,
     et réessayer donnerait le même non. */
  "generation_unavailable",
  // formulaire de contact
  "contact_invalid",
  // Même raisonnement que waitlist_rejected, pour les deux mêmes filtres :
  // un seul code, pour ne pas apprendre au robot lequel a mordu.
  "contact_rejected",
  // Réservation d'un souhait par un visiteur sans compte : troisième surface
  // publique sans session, mêmes deux filtres, même code unique. En donner un
  // par filtre dirait au robot lequel a mordu, et il s'ajusterait.
  "reservation_rejected",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorEnvelopeSchema = z
  .object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  })
  .strict();

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
