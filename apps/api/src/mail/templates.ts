import type { Locale } from "@lehno/i18n";

const GABARITS = {
  fr: {
    subject: "Votre code Lehno",
    body: (code: string) =>
      `Votre code de connexion est ${code}.

Il est valable 10 minutes. ` +
      `Si vous n'avez rien demandé, ignorez ce message.`,
  },
  en: {
    subject: "Your Lehno code",
    body: (code: string) =>
      `Your sign-in code is ${code}.

It is valid for 10 minutes. ` +
      `If you didn't ask for it, ignore this message.`,
  },
} as const;

export function otpEmail(input: { code: string; locale: Locale }): { subject: string; text: string } {
  const g = GABARITS[input.locale];
  return { subject: g.subject, text: g.body(input.code) };
}
