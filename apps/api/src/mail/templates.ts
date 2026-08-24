import type { Locale } from "@lehno/i18n";
import type { ContactSubject } from "@lehno/contracts";

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
    body: `C'est noté : vous serez prévenu dès l'ouverture de Lehno.

Si vous n'êtes pas à l'origine de cette inscription, ignorez ce message.`,
  },
  en: {
    subject: "Your address is noted",
    body: `Noted: we'll let you know as soon as Lehno opens.

If you didn't sign up, ignore this message.`,
  },
} as const;

export function waitlistEmail(input: { locale: Locale }): { subject: string; text: string } {
  const g = ATTENTE[input.locale];
  return { subject: g.subject, text: g.body };
}

// Le texte affiché des six motifs (design_handoff_surfaces_publiques/ui_kits/
// web/pages.html, clé "contact" → "sujets"), recopié tel quel. Le client
// n'envoie que la clé stable (CONTACT_SUBJECTS) ; c'est ce libellé, jamais la
// clé brute, qui doit se lire dans le courriel envoyé à l'équipe.
const SUJET_LABELS: Record<Locale, Record<ContactSubject, string>> = {
  fr: {
    question_app: "Une question sur l'application",
    probleme_technique: "Un problème technique",
    credits_paiements: "Les crédits et les paiements",
    signaler_contenu: "Signaler un contenu",
    demande_donnees: "Une demande sur mes données",
    autre: "Autre",
  },
  en: {
    question_app: "A question about the app",
    probleme_technique: "A technical problem",
    credits_paiements: "Credits and payments",
    signaler_contenu: "Report content",
    demande_donnees: "A request about my data",
    autre: "Something else",
  },
};

export function contactSubjectLabel(subject: ContactSubject, locale: Locale): string {
  return SUJET_LABELS[locale][subject];
}

const CONTACT_EQUIPE = {
  fr: {
    subject: (sujet: string) => `Contact — ${sujet}`,
    body: (input: { name: string; email: string; sujet: string; message: string }) =>
      `${input.name} <${input.email}> écrit à propos de : ${input.sujet}.

${input.message}`,
  },
  en: {
    subject: (sujet: string) => `Contact — ${sujet}`,
    body: (input: { name: string; email: string; sujet: string; message: string }) =>
      `${input.name} <${input.email}> wrote about: ${input.sujet}.

${input.message}`,
  },
} as const;

// Le courriel vers l'équipe : jamais le texte libre du client tel quel dans
// le champ "sujet" — toujours le libellé résolu depuis la clé validée.
export function contactTeamEmail(
  input: { name: string; email: string; subject: ContactSubject; message: string; locale: Locale },
): { subject: string; text: string } {
  const g = CONTACT_EQUIPE[input.locale];
  const sujet = contactSubjectLabel(input.subject, input.locale);
  return {
    subject: g.subject(sujet),
    text: g.body({ name: input.name, email: input.email, sujet, message: input.message }),
  };
}

// L'accusé de réception à la personne : une seule promesse, celle du délai
// déjà affiché sur la page (voir messages/fr.ts, contactDelai). Même ton que
// waitlistEmail ci-dessus — un constat, pas une formule de politesse.
const CONTACT_ACCUSE = {
  fr: {
    subject: "Votre message est bien arrivé",
    body: `Nous avons bien reçu votre message. Nous répondons sous deux jours ouvrés.

Si vous n'êtes pas à l'origine de cet envoi, ignorez ce message.`,
  },
  en: {
    subject: "Your message has arrived",
    body: `We've received your message. We reply within two working days.

If you didn't send this, ignore this message.`,
  },
} as const;

export function contactConfirmationEmail(input: { locale: Locale }): { subject: string; text: string } {
  const g = CONTACT_ACCUSE[input.locale];
  return { subject: g.subject, text: g.body };
}
