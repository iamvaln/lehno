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

// Constat, sans félicitation, et une seule promesse — celle que la landing a
// déjà faite : un message, à l'ouverture. Le ton suit ton-et-ecriture-lehno.md
// (4.1 « Tout va bien ») : on ne remercie pas d'un point d'exclamation, on dit
// ce qui se passe et ce qui suivra.
const ATTENTE = {
  fr: {
    subject: "Votre adresse est notée",
    body: `C'est noté : vous serez prévenu à l'ouverture de Lehno.

Un seul message, celui-là. Nous n'écrirons pas entre-temps.

Si cette adresse n'est pas la vôtre, ignorez ce message : elle ne servira à rien d'autre.`,
  },
  en: {
    subject: "Your address is noted",
    body: `Noted: we'll let you know when Lehno opens.

One message, that one. Nothing in between.

If this address isn't yours, ignore this note — it won't be used for anything else.`,
  },
} as const;

export function waitlistEmail(input: { locale: Locale }): { subject: string; text: string } {
  const g = ATTENTE[input.locale];
  return { subject: g.subject, text: g.body };
}
