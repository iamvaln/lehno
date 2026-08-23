// La table de chaînes de « Landing Lehno v3.dc.html », transposée telle quelle.
// Six clés mortes de la maquette ne sont pas reprises — qaAnniv, qaNote, qaFiche,
// contribs, reprises, voirTout — héritées d'un accueil que la spec mobile a réécrit.
// La maquette définissait « brouillon » deux fois par langue, la seconde écrasant
// la première : seule celle du bloc « un mot qui vient de vous » subsiste.
export const fr = {
  langue: "fr",

  navComment: "Comment ça marche",
  navContenu: "Ce qu'elle contient",
  navPrix: "Ce que ça coûte",
  cta: "Commencer",

  themeBascule: "Changer de thème",
  themeVersSombre: "Passer en mode sombre",
  themeVersClair: "Passer en mode clair",
  langueBouton: "EN",
  langueLabel: "Switch to English",
  menuOuvrir: "Ouvrir le menu",
  menuFermer: "Fermer le menu",

  heroTitre: "Soyez là le jour J",
  heroSous: "Lehno retient les dates qui comptent et ce que vous savez de vos proches. Le moment venu, vous avez déjà tout pour bien faire.",
  emailPlaceholder: "votre adresse e-mail",
  emailLabel: "Votre adresse e-mail",
  waitlist: "Nous préparons le lancement. Vous serez prévenu le jour où l'application ouvre.",
  merciTitre: "C'est noté. À très vite.",
  merciSous: "Vous recevrez un mot dès l'ouverture — rien d'autre.",
  waitlistErreur: "L'envoi n'a pas abouti. Réessayez dans un instant.",
  altApple: "Télécharger dans l'App Store",
  altGoogle: "Disponible sur Google Play",
  altMarque: "Lehno",

  anniv: "Anniversaire",
  mariage: "Mariage",
  aujourdhui: "aujourd'hui",
  appBouton: "Laisser une note",
  date24: "24 août", date30: "30 août", date2: "2 sept.", date14: "14 sept.",
  salut: "Bonjour Valentine",
  salutSous: "Une date aujourd'hui, deux cette semaine.",
  preparer: "Préparer",
  marquer: "Marquer envoyé",
  tabAccueil: "Accueil", tabDates: "Dates", tabProches: "Proches", tabMoi: "Moi",
  notifications: "3 notifications non lues",

  etape1Titre: "Notez quand ça vous vient.",
  etape1: "Une idée de cadeau au détour d'une conversation, un détail qui vous marque. Vous ouvrez, vous écrivez, c'est rangé.",
  etape2Titre: "Lehno vous rappelle.",
  etape2: "Quelques jours avant la date, l'application vous prévient — et vous remet sous les yeux tout ce que vous aviez noté.",
  etape3Titre: "Offrez quelque chose de juste.",
  etape3: "Une idée de cadeau qui lui ressemble, un mot dans votre ton à vous. Vous choisissez, vous envoyez.",

  blocFicheTitre: "Vos proches, dans un carnet qui se souvient",
  blocFiche: "Une fiche par personne : sa date, ses goûts, ce qu'elle a laissé entendre. Ça s'enrichit au fil de l'année, sans effort. Et ça ressert chaque année.",
  registre: "registre amical",
  gouts: "Intérêts / goûts",
  idees: "Idées cadeaux",
  nogo: "Dislikes / no-go",
  tag1: "vinyles", tag2: "rando", tag3: "café de spécialité",
  ideeTexte: "« Il a parlé d'un moulin à café manuel, le sien rend l'âme. »",
  ideeDate: "noté en mars",
  nogoTexte: "Ne boit pas d'alcool.",

  blocDatesTitre: "Toutes vos dates, au même endroit",
  blocDates: "Anniversaires, mariages, retraites, six mois d'une histoire : tout ce qui mérite d'être marqué tient dans le même calendrier.",
  maman: "Maman", retraite: "Départ en retraite", nourEtMoi: "Nour & moi", sixMois: "Six mois",
  age36: "36 ans", an5: "5 ans",

  blocMotTitre: "Un mot qui vient de vous",
  blocMot: "Lehno vous propose une base, écrite à partir de ce que vous savez d'elle. Vous ajustez, vous signez, vous envoyez depuis votre messagerie.",
  ideesKicker: "Idées de célébration · du gratuit au plus cher",
  idee1: "Une lettre sur ce que son amitié a changé cette année",
  idee2: "Un après-midi au marché aux vinyles, puis un café",
  idee3: "Le moulin à café manuel dont il a parlé en mars",
  brouillon: "Brouillon · pour Valery",
  brouillonTexte: "« Valery, 36 ans et toujours cette manie de refaire le monde à minuit. Merci pour l'été dernier — je te dois au moins un café correct. Bon anniversaire, mon vieux. »",
  modifier: "Modifier et envoyer",
  regenerer: "Régénérer",

  prixKicker: "Ce que ça coûte",
  prixGratuitChiffre: "Gratuit",
  prixGratuitTitre: "Sans limite de temps",
  prixGratuit: "Vos notes, les fiches de vos proches, vos dates, les rappels et votre Mur.",
  prixCreditsUnite: "le crédit",
  prixCreditsTitre: "À l'usage, en crédits",
  // Le nombre de crédits offerts vient de /v1/public/config, jamais de la maquette.
  prixCredits: "Un crédit par contenu créé pour vous : le portrait, les idées de cadeau, le message. {credits} crédits offerts à l'inscription.",

  finTitre: "Faites de chaque jour J un moment qui leur ressemble.",
  signature: "Chaque date qui compte, bien célébrée.",
  cgu: "Conditions d'utilisation",
  confidentialite: "Confidentialité",
  contact: "Contact",

  // Page contact. La maquette montrait un formulaire (TextField, Button,
  // Banner) mais aucun point d'entrée API ne le reçoit dans ce dépôt : cette
  // page montre les moyens de contact réels, pas un formulaire inerte.
  contactKicker: "Contact",
  contactTitre: "Écrivez-nous",
  contactChapeau: "Une question, un problème, un contenu à signaler : écrivez-nous, nous répondons sous deux jours ouvrés.",
  contactEcrireTitre: "Par courriel",
  contactEcrireTexte: "La voie la plus sûre pour une question sur votre compte, vos données ou un problème technique.",
  contactEmail: "hello@lehno.app",
  contactAilleursTitre: "Ailleurs",
  contactAilleursTexte: "On répond aussi en message privé, un peu moins vite.",
  piedFaq: "FAQ",
  mentionsLegales: "Mentions légales",

  // Contenu de la FAQ, recopié tel quel depuis le paquet de passation
  // (design_handoff_surfaces_publiques/ui_kits/web/pages.html, clé "faq") :
  // quinze questions groupées par thème. Deux réponses restent en attente
  // d'une décision produit ou juridique (expiration des crédits, accès aux
  // contacts/agenda) — elles portent "couvre" au lieu de "reponse", et le
  // rendu leur garde un bloc « à rédiger » plutôt que d'inventer une réponse.
  faq: {
    kicker: "FAQ",
    titre: "Ce qu'on nous demande le plus souvent",
    chapeau: "Si vous ne trouvez pas votre réponse, écrivez-nous : la page Contact met deux minutes.",
    aRediger: "À rédiger",
    quiRedige: "Rédaction produit — ton Lehno, deux phrases par réponse",
    groupes: [
      {
        titre: "Commencer",
        items: [
          { q: "Faut-il payer pour utiliser Lehno ?", reponse: "Non. Retenir les dates, écrire des notes et recevoir les rappels ne coûte rien. Seules les créations — un message, un portrait, une idée de cadeau — coûtent un crédit." },
          { q: "Sur quels téléphones l'application fonctionne-t-elle ?", reponse: "iOS et Android. Les versions minimales sont indiquées sur l'App Store et sur Google Play." },
          { q: "Combien de temps faut-il pour s'y mettre ?", reponse: "Une date et un prénom suffisent. Les fiches se remplissent au fil de l'année, pas le jour de l'inscription." },
        ],
      },
      {
        titre: "Les crédits",
        items: [
          { q: "Combien coûte un crédit ?", reponse: "100 F le crédit, et 5 crédits offerts à l'inscription. Un crédit par contenu créé pour vous : le portrait, les idées de cadeau, le message." },
          { q: "Les crédits expirent-ils ?", couvre: "La réponse n'est pas tranchée. Elle doit dire la même chose ici et dans les conditions d'utilisation, dans les mêmes termes." },
          { q: "Comment payer sans carte bancaire ?", reponse: "Par mobile money, MTN ou Orange. La validation prend parfois quelques minutes : l'écran suit l'opération jusqu'au bout." },
          { q: "Que se passe-t-il si une création échoue ?", reponse: "Le crédit revient sur votre solde, et l'application vous dit ce qui s'est passé." },
        ],
      },
      {
        titre: "Les proches et les notes",
        items: [
          { q: "Mes proches savent-ils que j'écris sur eux ?", reponse: "Non. Vos notes ne sont visibles que de vous, et ne servent qu'à ce que vous demandez." },
          { q: "Qu'est-ce que je peux noter ?", reponse: "Tout ce qui aide à bien faire : des goûts, des envies entendues, un détail qui vous a marqué. Rien que vous ne diriez pas à la personne." },
          { q: "Est-ce que l'application lit mes contacts ou mon agenda ?", couvre: "La réponse n'est pas tranchée : dire ce qui est demandé, à quel moment, et ce qui se passe si l'autorisation est refusée." },
        ],
      },
      {
        titre: "Le Mur",
        items: [
          { q: "Qui peut voir mon Mur ?", reponse: "Toute personne qui a le lien. C'est une page publique, et elle se dépublie à tout moment depuis l'application." },
          { q: "Puis-je choisir ce qui apparaît dessus ?", reponse: "Oui, élément par élément. Vos notes sur vos proches n'y figurent jamais." },
          { q: "Comment signaler un Mur ?", reponse: "Chaque Mur porte un lien de signalement en pied de page. Ce qui est signalé est examiné, et retiré s'il doit l'être." },
        ],
      },
      {
        titre: "Le compte",
        items: [
          { q: "Comment me connecter sans mot de passe ?", reponse: "Un code arrive sur votre adresse e-mail. Vous pouvez aussi entrer par Google ou par Apple — c'est le même compte." },
          { q: "Comment supprimer mon compte ?", reponse: "Depuis Moi, puis Compte et sécurité. La page « Supprimer votre compte » dit ce qui disparaît et ce qui est conservé." },
        ],
      },
    ],
  },
};
