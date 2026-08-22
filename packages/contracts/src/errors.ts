import { z } from "zod";

export const ERROR_CODES = [
  // requête
  "validation_failed", "not_found", "conflict", "rate_limited", "internal_error",
  // session
  "unauthorized", "forbidden", "session_expired", "refresh_reused",
  // code à usage unique
  "otp_invalid", "otp_expired", "otp_too_many_attempts", "otp_rate_limited",
  // compte
  "username_taken", "username_invalid", "device_limit_reached",
  "account_suspended", "account_pending_deletion",
  // identité externe
  "federated_token_invalid", "federated_already_linked",
  // liste d'attente
  "waitlist_email_invalid",
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
