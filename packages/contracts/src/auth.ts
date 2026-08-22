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

export type Session = z.infer<typeof sessionSchema>;
