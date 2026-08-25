// The onboarding dictionary, in English.
//
// Transposé de `specs/ui_kits/app/copy.js`, le dictionnaire du kit. Chaque
// variante s'écrit EN ENTIER : les règles de pluriel diffèrent d'une langue à
// l'autre — le zéro prend le singulier en français, le pluriel en anglais — et
// une phrase recollée de morceaux ne peut pas suivre.
//
// Aucun repli d'une langue sur l'autre : un appel qui oublie sa clé doit
// échouer, pas s'afficher dans la mauvaise langue.

export const en = {
  connexionTitre: "Be there on the day",
  connexionTexte: "The dates of the people you love, and what you know about them. When the day comes, you already have what you need.",
  champEmail: "Your email address",
  champEmailEx: "you@example.com",
  recevoirCode: "Send me a code",
  ou: "or",
  avecGoogle: "Continue with Google",
  avecApple: "Continue with Apple",
  connexionErreur: "We couldn't reach Google. The other ways are still open.",
  connexionPiedAvant: "By continuing, you agree to the ",
  connexionPiedEntre: " and the ",
  connexionPiedCgu: "terms of use",
  connexionPiedConf: "privacy policy",
  connexionPiedApres: ".",
  retour: "Back",
  codeTitre: "Your code is on its way",
  codeTexte: "Check your inbox.",
  codeValidite: (duree: string) => duree + " left to enter it.",
  valider: "Confirm",
  codeErreur: "That code doesn't match. Two tries left.",
  codeExpire: "This code has expired.",
  renvoyerCode: "Send another code",
  codeRenvoiAttente: (s: number) => "New code in " + s + "s",
  pseudoTitre: "Pick your handle",
  champPseudo: "Handle",
  pseudoAdresse: "lehno.app/valentine",
  pseudoPris: "That one's taken. \u201Cvalentine2\u201D is free.",
  champParrain: "Referral code (optional)",
  parrainValide: "Valid code",
  parrainInvalide: "Invalid code",
  continuer: "Continue",
  bienvenueTitre: (prenom: string) => "Welcome, " + prenom,
  bienvenueTexte: "Your notebook is open. Enough to prepare your first celebrations: a portrait, gift ideas, the right words.",
  bienvenueCredits: (n: number) => n + (n === 1 ? " credit" : " credits"),
  bienvenueCadeau: "Welcome gift",
  bienvenueParrainage: "Referral bonus",
  inviterAmi: "Invite a friend",
  commencer: "Get started",
  langue: "en",
};
