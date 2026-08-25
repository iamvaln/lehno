import { z } from "zod";

export const requestOtpSchema = z.object({ email: z.string().email().max(254) }).strict();

export const verifyOtpSchema = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/),
  deviceId: z.string().min(1).max(128).optional(),
  referralCode: z.string().max(16).optional(),
}).strict();

export const sessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  isNewAccount: z.boolean(),
}).strict();

export const refreshSchema = z.object({ refreshToken: z.string().min(1) }).strict();

export const federatedSchema = z.object({
  provider: z.enum(["google", "apple"]),
  idToken: z.string().min(1),
  deviceId: z.string().min(1).max(128).optional(),
  // La §5.1 veut le code de parrainage sur les TROIS voies. Il manquait ici :
  // une inscription par Google ou Apple ne pouvait en porter aucun, et le
  // filleul perdait son bonus selon la porte qu'il avait empruntée.
  referralCode: z.string().max(16).optional(),
}).strict();

export type Session = z.infer<typeof sessionSchema>;
