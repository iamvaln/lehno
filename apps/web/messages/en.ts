import type { fr } from "./fr";

// Écrit, pas traduit mot à mot : chaque langue est relue pour sa propre justesse.
// Le type reprend celui du français, ce qui interdit une clé oubliée ou en trop.
export const en: typeof fr = {
  langue: "en",

  navComment: "How it works",
  navContenu: "What's inside",
  navPrix: "What it costs",
  cta: "Get started",

  themeBascule: "Switch theme",
  themeVersSombre: "Switch to dark mode",
  themeVersClair: "Switch to light mode",
  langueBouton: "FR",
  langueLabel: "Passer en français",
  menuOuvrir: "Open menu",
  menuFermer: "Close menu",

  heroTitre: "Be there on the day",
  heroSous: "Lehno keeps the dates that matter and what you know about the people you love. When the day comes, you already have what you need.",
  emailPlaceholder: "your email address",
  emailLabel: "Your email address",
  waitlist: "We're getting ready to launch. We'll let you know the day the app opens.",
  merciTitre: "Noted. See you soon.",
  merciSous: "You'll get a note the day we open — nothing else.",
  waitlistErreur: "That didn't go through. Try again in a moment.",
  altApple: "Download on the App Store",
  altGoogle: "Get it on Google Play",
  altMarque: "Lehno",

  anniv: "Birthday",
  mariage: "Anniversary",
  aujourdhui: "today",
  appBouton: "Jot something down",
  date24: "24 Aug", date30: "30 Aug", date2: "2 Sep", date14: "14 Sep",
  salut: "Hi Valentine",
  salutSous: "One date today, two this week.",
  preparer: "Prepare",
  marquer: "Mark as sent",
  tabAccueil: "Home", tabDates: "Dates", tabProches: "People", tabMoi: "Me",
  notifications: "3 unread notifications",

  etape1Titre: "Write it down when it comes to you.",
  etape1: "A gift idea mid-conversation, a detail that sticks. You open the app, you type, it's filed away.",
  etape2Titre: "Lehno reminds you.",
  etape2: "A few days before the date, the app tells you — and puts everything you noted back in front of you.",
  etape3Titre: "Give something that fits.",
  etape3: "A gift that looks like them, a message in your own voice. You choose, you send.",

  blocFicheTitre: "The people you love, in a notebook that remembers",
  blocFiche: "One page per person: their date, their tastes, what they let slip. It fills up over the year, effortlessly. And it serves again every year.",
  registre: "friendly tone",
  gouts: "Interests / tastes",
  idees: "Gift ideas",
  nogo: "Dislikes / no-go",
  tag1: "vinyl", tag2: "hiking", tag3: "specialty coffee",
  ideeTexte: "“He mentioned a hand coffee grinder — his is on its last legs.”",
  ideeDate: "noted in March",
  nogoTexte: "Doesn't drink alcohol.",

  blocDatesTitre: "Every date, in one place",
  blocDates: "Birthdays, weddings, retirements, six months of a relationship: everything worth marking lives in the same calendar.",
  maman: "Mum", retraite: "Retirement", nourEtMoi: "Nour & me", sixMois: "Six months",
  age36: "turning 36", an5: "5 years",

  blocMotTitre: "A message that sounds like you",
  blocMot: "Lehno drafts a starting point from what you know about them. You adjust it, you sign it, you send it from your own inbox.",
  ideesKicker: "Ways to celebrate · from free to lavish",
  idee1: "A letter on what their friendship changed this year",
  idee2: "An afternoon at the record market, then coffee",
  idee3: "The hand grinder he mentioned back in March",
  brouillon: "Draft · for Valery",
  brouillonTexte: "“Valery, 36 and still fixing the world at midnight. Thank you for last summer — I owe you at least one decent coffee. Happy birthday, old friend.”",
  modifier: "Edit and send",
  regenerer: "Regenerate",

  prixKicker: "What it costs",
  prixGratuitChiffre: "Free",
  prixGratuitTitre: "With no time limit",
  prixGratuit: "Your notes, the pages for the people you love, your dates, the reminders and your Wall.",
  prixCreditsUnite: "per credit",
  prixCreditsTitre: "Pay as you go, in credits",
  prixCredits: "One credit per piece created for you: the portrait, the gift ideas, the message. {credits} credits when you sign up.",

  finTitre: "Make every big day feel like the person it's for.",
  signature: "Every date that matters, properly celebrated.",
  cgu: "Terms of Use",
  confidentialite: "Privacy",
  contact: "Contact",

  // Contact page. The mockup showed a form (TextField, Button, Banner), but
  // no API endpoint receives it in this repo: this page shows the real
  // contact channels instead of an inert form.
  contactKicker: "Contact",
  contactTitre: "Write to us",
  contactChapeau: "A question, a problem, something to report: write to us, we reply within two working days.",
  contactEcrireTitre: "By email",
  contactEcrireTexte: "The safest channel for a question about your account, your data, or a technical problem.",
  contactEmail: "hello@lehno.app",
  contactAilleursTitre: "Elsewhere",
  contactAilleursTexte: "We answer direct messages too, a little more slowly.",
  piedFaq: "FAQ",
  mentionsLegales: "Legal notice",

  faq: {
    kicker: "Frequently asked",
    titre: "What people ask us most",
    chapeau: "If your answer isn't here, write to us — the contact page takes two minutes.",
    aRediger: "To be written",
    quiRedige: "Product copy — Lehno tone, two sentences per answer",
    groupes: [
      {
        titre: "Getting started",
        items: [
          { q: "Do I have to pay to use Lehno?", reponse: "No. Holding dates, writing notes and getting reminders costs nothing. Only creations — a message, a portrait, a gift idea — cost a credit." },
          { q: "Which phones does the app run on?", reponse: "iOS and Android. Minimum versions are listed on the App Store and on Google Play." },
          { q: "How long does setting up take?", reponse: "One date and a first name is enough. Profiles fill up over the year, not on the day you sign up." },
        ],
      },
      {
        titre: "Credits",
        items: [
          { q: "How much is a credit?", reponse: "100 F per credit, and 5 credits when you sign up. One credit per piece written for you: the portrait, the gift ideas, the message." },
          { q: "Do credits expire?", couvre: "Not settled yet. The answer must say the same thing here and in the terms of use, in the same words." },
          { q: "Can I pay without a bank card?", reponse: "With mobile money, MTN or Orange. Confirmation sometimes takes a few minutes: the screen follows the payment through." },
          { q: "What if a creation fails?", reponse: "The credit comes back to your balance, and the app tells you what happened." },
        ],
      },
      {
        titre: "People and notes",
        items: [
          { q: "Do the people I write about know?", reponse: "No. Your notes are visible only to you, and serve only what you ask for." },
          { q: "What should I write down?", reponse: "Anything that helps you do well: tastes, wishes overheard, a detail that stayed with you. Nothing you wouldn't say to them." },
          { q: "Does the app read my contacts or calendar?", couvre: "Not settled yet: say what is asked for, at what moment, and what happens if the permission is declined." },
        ],
      },
      {
        titre: "The Wall",
        items: [
          { q: "Who can see my Wall?", reponse: "Anyone with the link. It's a public page, and it can be unpublished at any time from the app." },
          { q: "Can I choose what appears on it?", reponse: "Yes, item by item. Your notes about other people never appear there." },
          { q: "How do I report a Wall?", reponse: "Every Wall carries a report link in its footer. What gets reported is reviewed, and taken down if it should be." },
        ],
      },
      {
        titre: "Your account",
        items: [
          { q: "How do I sign in without a password?", reponse: "A code arrives at your email address. You can also come in through Google or Apple — it's the same account." },
          { q: "How do I delete my account?", reponse: "From Me, then Account and security. The \"Delete your account\" page says what disappears and what is kept." },
        ],
      },
    ],
  },
};
