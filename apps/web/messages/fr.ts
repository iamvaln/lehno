// La table de chaînes de « Landing Lehno v3.dc.html », transposée telle quelle.
// Six clés mortes de la maquette ne sont pas reprises — qaAnniv, qaNote, qaFiche,
// contribs, reprises, voirTout — héritées d'un accueil que la spec mobile a réécrit.
// La maquette définissait « brouillon » deux fois par langue, la seconde écrasant
// la première : seule celle du bloc « un mot qui vient de vous » subsiste.
export const fr = {
  langue: "fr",

  navComment: "Comment ça marche",
  navContenu: "Ce qu'elle contient",
  navMur: "Le Mur",
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
  merciSous: "Vous serez prévenu dès l'ouverture.",
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
  tabReglages: "Réglages",
  notifications: "3 notifications non lues",

  etape1Titre: "Notez quand ça vous vient.",
  etape1: "Une idée de cadeau au détour d'une conversation, un détail qui vous marque. Vous ouvrez, vous écrivez, c'est rangé.",
  etape2Titre: "Lehno vous rappelle.",
  etape2: "Quelques jours avant la date, l'application vous prévient — et vous remet sous les yeux tout ce que vous aviez noté.",
  etape3Titre: "Offrez quelque chose de juste.",
  etape3: "Une idée de cadeau qui lui ressemble, un mot dans votre ton à vous. Vous choisissez, vous envoyez.",

  contenuKicker: "Ce que l'application contient",
  blocFicheTitre: "Vos proches, dans un carnet qui se souvient",
  blocFiche: "Une fiche par personne : sa date, ses goûts, ce qu'elle a laissé entendre. Ça s'enrichit au fil de l'année, sans effort. Et ça ressert chaque année.",
  registre: "registre amical",
  gouts: "Intérêts / goûts",
  idees: "Idées cadeaux",
  nogo: "Dislikes / no-go",
  tag1: "vinyles", tag2: "rando", tag3: "café de spécialité",
  ideeParole: "Il a parlé d'un moulin à café manuel, le sien rend l'âme.",
  provIdee: "noté en mars",
  nogoParole: "Je ne bois pas d'alcool.",
  provNogo: "dit par lui, en janvier",

  blocDatesTitre: "Toutes vos dates, au même endroit",
  blocDates: "Anniversaires, mariages, retraites, six mois d'une histoire : tout ce qui mérite d'être marqué tient dans le même calendrier.",
  date21: "21 août", age29: "29 ans",
  maman: "Maman", retraite: "Départ en retraite",
  age36: "36 ans", an5: "5 ans",

  blocMotTitre: "Un mot qui vient de vous",
  blocMot: "Lehno vous propose une base, écrite à partir de ce que vous savez d'elle. Vous ajustez, vous signez, vous envoyez depuis votre messagerie.",
  ideesKicker: "Idées de célébration · du gratuit au plus cher",
  idee1: "Une lettre sur ce que son amitié a changé cette année",
  idee2: "Un après-midi au marché aux vinyles, puis un café",
  idee3: "Le moulin à café manuel dont il a parlé en mars",
  brouillon: "Brouillon · pour Valery",
  brouillonTexte: "« Valery, 36 ans et toujours cette manie de refaire le monde à minuit. Merci pour l'été dernier — je te dois au moins un café correct. Bon anniversaire, mon vieux. »",
  provBrouillon: "écrit à partir de 9 notes sur Valery",
  modifier: "Modifier et envoyer",
  regenerer: "Régénérer",

  prixKicker: "Ce que ça coûte",
  prixGratuitChiffre: "Gratuit",
  prixGratuitTitre: "Sans limite de temps",
  prixGratuit: "Vos notes, les fiches de vos proches, vos dates, les rappels et votre Mur.",
  prixCreditsUnite: "le crédit",
  prixCreditsTitre: "À l'usage, en crédits",
  /* La phrase du tarif SE COMPOSE : elle n'énumère que les générations
     ouvertes. Énumérer une génération fermée, c'est vendre ce qu'on ne livre
     pas. Le nombre de crédits offerts vient de /v1/public/config, jamais de la
     maquette. */
  prixCredits: "Un crédit par contenu créé pour vous : {liste}. {credits} crédits offerts à l'inscription.",
  prixGenerations: {
    "generation.message": "le message",
    "generation.ideas": "les idées de cadeau",
    "generation.portrait": "le portrait",
  },
  // La conjonction de l'énumération : « le message, les idées et le portrait ».
  prixEt: "et",
  // Seulement quand le parrainage est ouvert.
  prixParrainage: "Et deux de plus par personne que vous invitez.",

  finTitre: "Faites de chaque jour J un moment qui leur ressemble.",
  signature: "Chaque date qui compte, bien célébrée.",
  cgu: "Conditions d'utilisation",
  confidentialite: "Confidentialité",
  contact: "Contact",

  // Page contact, recopiée telle quelle depuis le paquet de passation
  // (design_handoff_surfaces_publiques/ui_kits/web/pages.html, clé "contact") :
  // un vrai formulaire existe désormais, reçu par apps/api/src/public/contact.
  contactKicker: "Contact",
  contactTitre: "Écrivez-nous",
  contactChapeau: "Une question, un problème, un contenu à signaler : ce formulaire arrive directement chez nous.",
  contactLabelNom: "Votre nom",
  contactLabelEmail: "Votre adresse e-mail",
  contactLabelSujet: "De quoi s'agit-il ?",
  contactLabelMessage: "Votre message",
  contactAideMessage: "Dites-nous ce qui s'est passé, et depuis quel écran si c'est un problème technique.",
  contactEmailErreur: "Cette adresse ne semble pas valide.",
  contactEnvoyer: "Envoyer",
  contactDelai: "Nous répondons sous deux jours ouvrés.",
  contactConfirme: "C'est envoyé. Vous recevrez une réponse à l'adresse indiquée.",
  // Reprend la formulation déjà retenue pour la liste d'attente
  // (voir waitlistErreur) : un refus du serveur et une panne réseau se
  // ressemblent pour la personne, l'un et l'autre se règlent en réessayant.
  contactEnvoiErreur: "L'envoi n'a pas abouti. Réessayez dans un instant.",
  // Les six motifs de la maquette, dans l'ordre où ils y figurent. L'ordre
  // apparie chaque libellé à sa clé stable (voir ContactForm.tsx) : la clé
  // ne s'affiche jamais, c'est elle qui part au serveur.
  contactSujets: [
    "Une question sur l'application",
    "Un problème technique",
    "Les crédits et les paiements",
    "Signaler un contenu",
    "Une demande sur mes données",
    "Autre",
  ],
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
          { q: "Les crédits expirent-ils ?", reponse: "Non, ils ne périment pas : ils restent acquis tant que le compte existe. Vous les dépensez au rythme qui vous convient." },
          { q: "Comment payer sans carte bancaire ?", reponse: "Par mobile money, MTN ou Orange. La validation prend parfois quelques minutes : l'écran suit l'opération jusqu'au bout." },
          { q: "Que se passe-t-il si une création échoue ?", reponse: "Le crédit revient sur votre solde, et l'application vous dit ce qui s'est passé." },
        ],
      },
      {
        titre: "Les proches et les notes",
        items: [
          { q: "Mes proches savent-ils que j'écris sur eux ?", reponse: "Non. Vos notes ne sont visibles que de vous, et ne servent qu'à ce que vous demandez." },
          { q: "Qu'est-ce que je peux noter ?", reponse: "Tout ce qui aide à bien faire : des goûts, des envies entendues, un détail qui vous a marqué. Rien que vous ne diriez pas à la personne." },
          { q: "Est-ce que l'application lit mes contacts ou mon agenda ?", reponse: "Non. Elle ne demande ni vos contacts ni votre agenda : les dates que vous suivez, c'est vous qui les saisissez." },
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
  mentions: "Mentions légales",

  // Pages légales (components/legal/LegalPage.tsx) : le sommaire latéral.
  sommaire: "Sommaire",

  // Aperçu du Mur — repris tel quel de la maquette v3.
  murTitre: "Votre page à vous",
  murTexte: "Vos proches veulent bien faire aussi. Partagez votre Mur : ils y trouvent ce qui vous ferait plaisir, et peuvent vous laisser un mot.",
  murPoint1Titre: "Une adresse à partager",
  murPoint1: "Un lien s'envoie, s'ouvre dans le navigateur, et voilà.",
  murPoint2Titre: "Vos envies, écrites par vous",
  murPoint2: "Ce qui vous ferait plaisir, et ce qui ne vous ferait pas plaisir.",
  murPoint3Titre: "Les mots qu'on vous laisse",
  murPoint3: "Vos proches vous écrivent depuis votre Mur, vous les retrouvez dans l'application.",
  murEvite: "Ce que j'évite",
  murNo1: "les bougies parfumées",
  murNo2: "l'alcool",
  murPiedTitre: "Vous aussi, dites ce qui vous ferait plaisir.",
  murPiedLien: "Créer mon Mur",
  murHello: "Bienvenue chez Valentine",
  murSous: "Ravie de te voir passer.",
  murAime: "Ce que j'aime",
  murTag1: "parfums",
  murTag2: "fleurs",
  murTag3: "cinéma",
  murDate: "Mon anniversaire, c'est le 14 mars",
  murIdee: "Une idée ? Voici ce qui me ferait plaisir.",
  murListe: "Voir ma liste",
  murMot: "Laisse-moi un mot",
  // ——— L'acquisition, sur les surfaces publiques ———————————————
  //
  // Une phrase générique, servie partout où la surface n'en propose pas de
  // meilleure. « Vous aussi, soyez là le jour J » est vrai partout, donc
  // convaincant nulle part — mais c'est mieux que rien, et c'est ce qui évite
  // qu'une page publique se termine sans porte de sortie.
  acqTitre: "Vous aussi, soyez là le jour J",
  acqTexte: "Lehno retient les dates qui comptent, garde ce que vous savez des gens, et écrit le mot le jour venu.",
  acqAction: "Découvrir Lehno",

  // ——— Le Mur ————————————————————————————————————————————————
  //
  // C'est la seule surface où la marque ne parle pas en son nom : le
  // propriétaire s'adresse à ses proches. « Je », tutoiement.
  murIntro: "Voilà ce qu'il faut savoir sur moi",
  murAnniversaire: "Mon anniversaire",
  murInterets: "Ce que j'aime",
  murDeposer: "Me laisser un mot",
  // Les vœux fermés retirent le bouton et gardent le fait. Un bouton qui
  // n'ouvre rien serait pire que pas de bouton.
  murVoeuxFermes: "Les mots ne sont pas ouverts en ce moment.",
  murInvitation: "Avoir mon Mur",
  murAlt: "Photo de {nom}",

  // ——— Les avis courts ————————————————————————————————————————
  //
  // Ce qui s'est passé, et la suite. Pas d'illustration, pas d'« Oups ».
  etatIndisponibleTitre: "Cette page n'a pas pu s'afficher",
  etatIndisponibleTexte: "Ce n'est pas vous : nous n'avons pas réussi à joindre le service. Réessayez dans un instant.",
  etatRetour: "Aller à l'accueil",


  // ——— Le dépôt de vœux ————————————————————————————————————————
  //
  // La page s'ouvre MÊME hors fenêtre, et dit alors quand revenir : c'est le
  // dépôt qui refuse, pas la lecture. Un formulaire qui échoue en silence, ou
  // une page qui ne se charge pas, laisse le visiteur sans recours.
  voeuxTitre: "Un mot pour {nom}",
  voeuxOccasion: "Pour le {date}",
  voeuxAvantOuverture: "Les mots s'ouvrent le {date}.",
  voeuxApresFermeture: "Les mots se sont refermés le {date}.",
  voeuxRevenir: "Revenez à ce moment-là : le lien reste le même.",
  voeuxLabelMessage: "Votre mot",
  voeuxAideMessage: "Il sera lu le jour venu, tel que vous l'écrivez.",
  voeuxLabelSignature: "Signature",
  voeuxAideSignature: "Facultative. Sans elle, votre mot arrive anonyme.",
  voeuxEnvoyer: "Envoyer mon mot",
  voeuxConfirme: "C'est envoyé. Votre mot l'attendra.",
  voeuxErreur: "Votre mot n'est pas parti. Réessayez dans un instant.",
  voeuxFermeErreur: "Les mots viennent de se refermer. Votre texte n'a pas été envoyé.",

  voeuxContexte: "pour l'anniversaire de {nom}",
  voeuxPlaceholderMessage: "Écrivez-lui ce que vous avez sur le cœur…",
  voeuxPlaceholderSignature: "votre nom, ou comme il vous plaît",
  voeuxMention: "Votre mot lui parviendra le jour venu, tel que vous l'écrivez.",
  voeuxConfirmeTitre: "C'est envoyé.",
  voeuxConfirmeTexte: "Votre mot l'attendra le jour venu. Vous pouvez fermer cette page.",
  // Après le geste seulement : promettre « ayez votre Mur » à quelqu'un qui
  // n'a pas encore écrit, c'est lui parler d'autre chose que de ce qu'il est
  // venu faire.
  acqVoeuxTitre: "Ayez votre Mur",
  acqVoeuxTexte: "Vos proches y trouvent votre date, ce que vous aimez, et un endroit pour vous écrire.",
  acqVoeuxAction: "Créer le mien",


  // ——— La collecte ————————————————————————————————————————————
  //
  // On salue d'abord la personne — un lien nominatif désigne quelqu'un —, et
  // c'est seulement après qu'on dit de qui vient l'invitation. L'inverse,
  // c'est une machine qui se présente avant de dire bonjour.
  collecteSalut: "Bonjour {nom}",
  collecteSalutPublic: "Bonjour",
  collecteDemandeNominatif: "vous a écrit",
  collecteDemandePublic: "a ouvert un lien",
  collecteChapeauNominatif: "{nom} garde les dates et les envies de ses proches au même endroit. Ce que vous écrivez ici n'est vu que par {nom}.",
  collecteChapeauPublic: "{nom} garde les dates et les envies de ses proches au même endroit. Dites-lui qui vous êtes, et ce qui vous ferait plaisir.",
  collecteChapeauRetour: "Vous avez déjà répondu. Vous pouvez compléter : ce que vous ajoutez s'ajoute, rien ne s'efface.",
  collecteLabelNom: "Votre nom",
  collecteLabelRelation: "On se connaît d'où ?",
  collecteAideRelation: "Un mot suffit : collègue, cousine, voisin de palier.",
  collecteLabelDate: "Votre date de naissance",
  collecteAideDateNominatif: "Déjà connue de {nom} — corrigez-la si elle est fausse.",
  collecteAideDatePublic: "Le jour et le mois suffisent à {nom} pour y penser.",
  collecteLabelSouhaits: "Ce qui vous ferait plaisir",
  collectePlaceholderSouhait: "Un livre, une soirée, un ustensile qui manque…",
  collecteAjouterSouhait: "Ajouter un souhait",
  collecteRetirerSouhait: "Retirer ce souhait",
  collecteLabelPrix: "Prix indicatif ({devise})",
  collecteLabelLien: "Un lien",
  collecteLabelMot: "Un mot pour {nom}",
  collecteAideMot: "Facultatif, et lu tel quel.",
  collecteFacultatif: "Facultatif",
  collecteLabelEmail: "Votre adresse",
  collecteAideEmail: "Elle sert à {nom} pour vous demander une précision. Rien d'autre : pas d'inscription, pas de lettre.",
  collecteAideEmailPublic: "Requise sur un lien ouvert : c'est ce qui permet à {nom} de savoir à qui il parle.",
  collecteEnvoyer: "Envoyer à {nom}",
  collecteConfirmeTitre: "C'est transmis.",
  collecteConfirmeTexte: "{nom} le verra et décidera de ce qu'il garde. Rien n'entre dans une fiche sans sa décision.",
  collecteAjouterEncore: "Ajouter autre chose",
  collecteErreur: "Votre réponse n'est pas partie. Réessayez dans un instant.",
  // Le sort de chaque souhait se montre SANS le commenter : « écarté » ne
  // s'excuse pas et ne se justifie pas.
  collecteDejaTitre: "Ce que vous avez déjà envoyé",
  collecteRetenu: "Retenu",
  collecteEcarte: "Écarté",
  collecteEnAttente: "En attente",
  collecteVoirMur: "Voir le mur de {nom}",
  // Après le geste, l'exact retournement de ce qu'on vient de faire.
  acqCollecteTitre: "Tenez la liste de vos proches",
  acqCollecteTexte: "Leurs dates, ce qu'ils aiment, ce qu'ils vous ont dit un jour. Lehno vous le rappelle le moment venu.",
  acqCollecteAction: "Essayer Lehno",


  // ——— La liste partagée ——————————————————————————————————————
  //
  // La page la plus exigeante du produit : vue par des gens qui ne connaissent
  // pas Lehno, souvent une seule fois. La personne avant les objets — une page
  // qui ouvre sur une grille ressemble à un catalogue, et le lien n'était pas
  // un catalogue.
  listeTitre: "Voilà ce qui me ferait plaisir",
  listeOccasion: "{occasion}, le {date}",
  listeFermee: "L'occasion est passée. La liste reste visible, mais on ne peut plus s'en occuper.",
  listeVide: "Rien n'est encore posé ici.",
  // L'anonymat se dit UNE FOIS, en pied de liste. Répété sur chaque carte, un
  // rappel devient du bruit.
  listeAnonymat: "Ce que vous réservez reste anonyme : personne d'autre ne voit qui a pris quoi.",
  listeRevoqueTitre: "Ce lien n'est plus actif",
  listeRevoqueTexte: "La liste a été dépubliée ou le lien retiré. Rien à faire de votre côté.",
  // Après le geste seulement : quelqu'un qui vient de réserver a compris à
  // quoi ça sert.
  listeFaireMaPart: "Faites la vôtre",
  listeFaireMaPartTexte: "Vos proches savent quoi vous offrir, et vous n'avez rien eu à demander.",
  listeFaireMaPartAction: "Créer ma liste",

  // ——— Un souhait ——————————————————————————————————————————————
  //
  // Ce qui n'apparaît JAMAIS : qui a réservé. Un souhait réservé se dit
  // réservé, et rien de plus.
  souhaitReserver: "Je m'en occupe",
  souhaitReserve: "Déjà pris",
  souhaitReserveAide: "Quelqu'un s'en occupe.",
  souhaitMien: "Vous vous en occupez",
  souhaitOffert: "Offert",
  souhaitPourquoiAdresse: "Votre adresse sert à confirmer que c'est bien vous, et à vous retrouver si vous revenez. Pas de compte à créer.",
  souhaitLabelEmail: "Votre adresse",
  souhaitSeFaireConnaitre: "Dire à qui de droit que c'est moi",
  souhaitLabelNom: "Votre nom",
  souhaitContinuer: "Continuer",
  souhaitAnnulerGeste: "Laisser tomber",
  souhaitCodeEnvoye: "Un code à six chiffres part à cette adresse. Il vaut dix minutes.",
  souhaitLabelCode: "Le code",
  souhaitConfirmer: "Confirmer",
  souhaitErreur: "Ça n'a pas marché. Réessayez dans un instant.",
  souhaitCodeFaux: "Ce code ne correspond pas, ou il a expiré.",
  souhaitDejaPris: "Quelqu'un a été plus rapide : ce souhait vient d'être pris.",


  // ——— L'invitation au parrainage ————————————————————————————
  //
  // Une invitation est INTIME : quelqu'un vous dit que ça vous servira. Une
  // colonne, sur du blanc, sans aplat ni maquette. La page ne porte pas la
  // clôture d'acquisition de la coquille — elle EST la page d'acquisition.
  inviteMention: "vous invite sur Lehno",
  inviteTitre: "Les dates qui comptent, et quoi offrir le jour venu",
  inviteTitreSansCode: "Lehno, en deux mots",
  invitePromesse: "Lehno retient les anniversaires de vos proches, garde ce que vous savez d'eux, et vous aide à trouver le bon cadeau — sans avoir à demander.",
  inviteGainTexte: "crédits offerts à l'ouverture de votre compte, parce que quelqu'un vous a invité.",
  inviteCodeLabel: "Votre code :",
  // Sans code valable il n'y a pas de gain à annoncer : la ligne disparaît,
  // les badges restent. Le contrat ne distingue pas « expiré » de « déjà
  // employé » — la page ne l'invente pas.
  inviteSansCode: "Ce lien d'invitation n'est plus valable. Vous pouvez tout de même installer Lehno.",


  // ——— La page introuvable ——————————————————————————————————
  //
  // Elle dit ce qui s'est passé et propose la suite. Pas d'excuse, pas
  // d'illustration, pas d'« Oups » : quelqu'un arrivé là par le lien d'une
  // amie n'a pas besoin d'être consolé.
  introuvableTitre: "Cette page n'existe pas",
  introuvableTexte: "Le lien est peut-être incomplet, ou la page a été retirée. Il n'y a rien à réparer de votre côté.",
  introuvableRetour: "Aller à l'accueil",
  introuvableFaq: "Voir les questions fréquentes",


  // ——— Un lien retiré ———————————————————————————————————————
  //
  // 410, seul statut de ce genre dans tout le contrat : le lien a existé. Le
  // visiteur l'a reçu de quelqu'un — un 404 lui ferait croire qu'il a mal
  // recopié l'adresse, et une panne l'enverrait réessayer pour rien.
  lienRetireTitre: "Ce lien n'est plus actif",
  lienRetireTexte: "Il a été retiré par la personne qui vous l'a envoyé. Il n'y a rien à faire de votre côté.",

  souhaitAnnuler: "Annuler",
  souhaitAnnulerErreur: "L'annulation n'a pas abouti. Réessayez dans un instant.",


  // ——— L'arrêt pour intervention ————————————————————————————————
  //
  // 503, et non 404 : un arrêt de deux heures ne se lit pas comme une
  // suppression. Deux états, parce que l'heure de retour est facultative —
  // avec elle on dit quand revenir, sans elle on dit seulement qu'une mise à
  // jour est en cours. Pas de « bientôt », pas d'estimation inventée.
  interventionTitre: "Lehno est en cours de mise à jour",
  interventionAvecHeure: "Le service revient vers {heure}. Rien de ce que vous avez envoyé n'est perdu.",
  interventionSansHeure: "Une mise à jour est en cours. Rien de ce que vous avez envoyé n'est perdu.",

};
