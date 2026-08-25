// La table du back-office, en français. Elle vient de `ui_kits/admin/dico.json`,
// relue ligne à ligne contre specs/ton-et-ecriture-lehno.md §2.5 : on vouvoie
// quelqu'un qui travaille, on nomme les choses, et un compte suspendu est
// suspendu. Les données de démonstration ne sont pas ici — elles vivent dans
// src/fixtures, validées par les contrats.
//
// Ce qui a été réécrit contre le prototype, et pourquoi :
//
// — Le passif repasse à l'actif (§2.1) : « les données sont conservées » devient
//   « les données restent en place », « chaque changement est journalisé »
//   devient « le journal d'audit garde chaque changement et son auteur ».
// — Les états vides annoncent ce qui est possible, jamais ce qui manque (§4.7) :
//   « Aucune demande » devient « Rien en attente d'effacement », et le titre
//   d'une recherche sans résultat porte le geste — « Élargissez la recherche ».
// — Les échecs disent « on » et tiennent les trois temps de l'excuse (§4.5) :
//   ce qui s'est passé, ce qu'on a fait, ce qu'on peut faire. Le prototype n'en
//   portait aucun ; le bloc `echecs` les ajoute.
// — Les demi-phrases à coller (« Compte suspendu — ») deviennent des gabarits
//   entiers, parce qu'un fragment ne se relit pas et ne se traduit pas.
// — La pagination perd « 1–20 sur 347 » et « page 2 / 18 » : les listes de
//   `/v1/admin` se parcourent au curseur, aucun total n'existe.
export const fr = {
  langue: "fr",

  outil: {
    marque: "Back-office",
    titre: "Back-office Lehno",
  },

  commun: {
    fermer: "Fermer",
    retour: "Retour",
    chargement: "Chargement…",
  },

  barre: {
    recherche: "Rechercher un utilisateur, un paiement, un contenu",
    rechercheLabel: "Recherche",
    langue: "Langue de l'outil",
    theme: "Changer de thème",
    menu: "Ouvrir la navigation",
    compte: "Mon compte",
    profil: "Mon profil",
    acces: "Accès des administrateurs",
    deconnexion: "Se déconnecter",
    roleAdmin: "Administrateur",
    roleSupport: "Support",
  },

  // Rangées par ce que l'administrateur vient faire, pas par objet manipulé.
  familles: {
    exploitation: "Exploitation",
    economie: "Économie",
    supervision: "Supervision",
    outils: "Outils",
  },

  sections: {
    tableau: "Tableau de bord",
    alertes: "Alertes",
    moderation: "Modération",
    suppressions: "Demandes de suppression",
    contact: "Messages de contact",
    attente: "Liste d'attente",
    transactions: "Transactions",
    comptes: "Comptes",
    credits: "Crédits et paiements",
    acces: "Accès administrateurs",
    parametres: "Paramètres",
    fonctionnalites: "Fonctionnalités",
    modeles: "Modèles d'IA",
    studio: "Studio du portrait",
    offres: "Offres et croissance",
    metriques: "Métriques",
    audit: "Journal d'audit",
    connexions: "Connexions",
    liens: "Liens externes",
    profil: "Mon profil",
  },

  fil: {
    accueil: "Tableau de bord",
    libelle: "Fil d'Ariane",
  },

  // Les libellés du tableau et de sa pagination. « Précédent · Suivant » et rien
  // d'autre : une API à curseur ne rend pas de total, et afficher un numéro de
  // page promettrait un comptage que le serveur ne fait pas.
  table: {
    toutSelectionner: "Tout sélectionner sur cette page",
    selectionner: "Sélectionner {nom}",
    actions: "Actions sur cette ligne",
    pagination: "Pages de la liste",
    precedent: "Précédent",
    suivant: "Suivant",
    parPage: "Par page",
    reinitialiser: "Remettre les filtres à zéro",
    selectionUn: "1 ligne sélectionnée",
    selectionN: "{n} lignes sélectionnées",
    deselectionner: "Annuler la sélection",
    resultatUn: "1 résultat",
    resultatsN: "{n} résultats",
    vide: {
      titre: "Élargissez la recherche",
      texte: "Aucune ligne ne répond à ces filtres. Retirez-en un, ou cherchez sur l'adresse.",
    },
  },

  // Les états d'un compte, dits comme ils sont : un compte suspendu est
  // suspendu, pas « momentanément indisponible ».
  etats: {
    actif: "Actif",
    suspendu: "Suspendu",
    attente: "En attente",
    grace: "Délai de grâce",
    efface: "Effacé",
  },

  // Toute action qui change un état passe par là, et porte un motif : c'est ce
  // qui fait que le journal d'audit dit quelque chose.
  confirmation: {
    motif: "Motif",
    motifAide: "Le journal d'audit garde ce geste et son motif.",
    autre: "Autre — préciser",
    autrePlaceholder: "En quelques mots, ce qui motive ce geste",
    motifManquant: "Choisissez un motif avant de confirmer.",
    motifCourt: "Un motif d'au moins 6 caractères.",
    confirmer: "Confirmer",
    annuler: "Annuler",
  },

  exporter: {
    bouton: "Exporter",
    avecPortee: "Exporter {portee}",
    porteeSelection: "{n} lignes",
    porteeResultats: "les {n} résultats",
    formatCsv: "CSV — tableur",
    formatJson: "JSON — données brutes",
    journal: "L'export apparaît au journal d'audit.",
    encours: "Préparation du fichier…",
    lance: "Export lancé sur {n} lignes. Le fichier arrive par courriel.",
  },

  // Trois temps, dans cet ordre : ce qui s'est passé, ce qu'on a fait, ce qu'on
  // peut faire maintenant. Aucune de ces phrases n'est sans sujet.
  // Un écran qui charge et un écran vide ne disent pas la même chose : sans
  // état d'attente, une base lente ressemble à un système sans activité.
  actions: {
    chargement: "Chargement…",
    reessayer: "Réessayer",
    echecTitre: "Le chargement n'a pas abouti",
  },

  // Une valeur qu'on ne sait pas encore compter n'est pas zéro. Le dire au lieu
  // de l'écrire « 0 » évite de faire passer une lacune de la base pour un
  // constat sur le compte qu'on regarde.
  nonMesure: {
    court: "—",
    explication: "Pas encore mesuré",
    bloc: "Cette mesure n'existe pas encore. Elle apparaîtra ici quand la fonctionnalité sera en service.",
  },

  echecs: {
    chargement: "On n'a pas réussi à charger cette liste. Rien n'a bougé côté données. Réessayez, ou revenez dans un instant.",
    action: "On n'a pas pu appliquer ce geste. L'état du compte est celui d'avant. Réessayez, ou passez la main à un administrateur.",
    enregistrement: "On n'a pas pu enregistrer. Les valeurs en place tiennent toujours. Reprenez la saisie et réessayez.",
    reseau: "On a perdu le serveur en cours de route. Le dernier geste n'est pas passé. Vérifiez la connexion, puis réessayez.",
    exporter: "On n'a pas pu préparer le fichier. Aucun export n'est parti. Réessayez dans un instant.",
  },

  // Le rappel porté par une pastille d'alerte : le courriel et l'écran sont deux
  // vues du même événement, et l'écran dit que le courriel est déjà parti.
  alerte: {
    notifie: "notifié à {heure}",
  },

  audit: {
    titre: "Journal d'audit",
    sous: "Ce que l'équipe a fait, avec son motif.",
    col: {
      date: "Date",
      auteur: "Auteur",
      action: "Action",
      objet: "Objet",
      motif: "Motif",
    },
    vide: {
      titre: "Rien à signaler sur ce compte",
      texte: "Les gestes de l'équipe apparaissent ici, avec leur auteur et leur motif.",
    },
  },

  tableau: {
    titre: "Tableau de bord",
    sous: "Ce qui ne va pas, puis les chiffres, puis ce qui attend une décision.",
    alertesTitre: "Ce qui ne va pas",
    alertesVide: {
      titre: "Rien de bloqué",
      texte: "Les pannes et les blocages apparaissent ici, avec l'heure du courriel déjà parti.",
    },
    indicateursTitre: "Les chiffres",
    aTraiterTitre: "À traiter",
    col: {
      element: "Élément",
      section: "Section",
      etat: "État",
      depuis: "Depuis",
    },
    vide: {
      titre: "Rien à traiter",
      texte: "Le service tourne. Ce qui demande une décision apparaît ici.",
    },
  },

  comptes: {
    titre: "Utilisateurs",
    sous: "Retrouvez un compte, et agissez dessus.",
    recherche: "Pseudo ou adresse e-mail",
    filtreEtat: "État",
    tousEtats: "Tous les états",
    filtreCredits: "Crédits",
    tousCredits: "Tous les soldes",
    sansCredit: "Solde à zéro",
    avecCredit: "Solde positif",
    col: {
      pseudo: "Pseudo",
      email: "Adresse",
      etat: "État",
      credits: "Crédits",
      inscrit: "Inscrit le",
    },
    actions: {
      ouvrir: "Ouvrir la fiche",
      ajuster: "Ajuster le solde",
      suspendre: "Suspendre",
      retablir: "Rétablir",
    },
    lot: {
      exporter: "Exporter la sélection",
      suspendre: "Suspendre ces comptes",
    },
    faits: {
      ajuster: "Solde ajusté. Motif : {motif}",
      suspendre: "Compte suspendu. Motif : {motif}",
      retablir: "Compte rétabli. Motif : {motif}",
      suspendreLot: "{n} comptes suspendus. Motif : {motif}",
    },
    suspendre: {
      titre: "Suspendre {pseudo} ?",
      consequence: "Ce compte ne se connecte plus, et ses surfaces publiques cessent de répondre. Les données restent en place.",
      motifs: [
        "Signalement d'un tiers",
        "Fraude suspectée",
        "Demande du titulaire",
      ],
    },
    retablir: {
      titre: "Rétablir {pseudo} ?",
      consequence: "Le compte se reconnecte, et ses surfaces publiques répondent de nouveau.",
      motifs: [
        "Vérification faite, rien à reprocher",
        "Suspension déclenchée par erreur",
        "Demande du titulaire",
      ],
    },
    ajuster: {
      titre: "Ajuster le solde de {pseudo}",
      consequence: "Le mouvement apparaît dans l'historique du compte, avec son motif.",
      motifs: [
        "Génération échouée non recréditée",
        "Geste commercial",
        "Correction d'un octroi",
      ],
    },
    vide: {
      titre: "Élargissez la recherche",
      texte: "Aucun compte ne répond à ces filtres. Retirez-en un, ou cherchez sur l'adresse.",
    },
  },

  compte: {
    fil: "Utilisateurs",
    sous: "{email} · compte créé le {date}",
    onglets: {
      vue: "Vue d'ensemble",
      murs: "Murs",
      credits: "Crédits",
      securite: "Sécurité",
    },
    groupes: {
      compte: "Compte",
      usage: "Usage",
      credits: "Crédits",
    },
    champs: {
      etat: "État",
      langue: "Langue",
      inscrit: "Inscrit le",
      derniere: "Dernière connexion",
      solde: "Solde",
      achetes: "Crédits achetés",
      offerts: "Crédits offerts",
      proches: "Proches",
      occasions: "Occasions suivies",
      notes: "Notes",
      murs: "Murs",
    },
    // Le cloisonnement tient en administration : on compte, on n'ouvre pas.
    cloisonnement: "Le contenu des fiches et des notes ne s'ouvre pas ici. On en compte les volumes, rien de plus.",
    suspendu: "Ce compte est suspendu. Il ne se connecte plus, et ses surfaces publiques ne répondent plus.",
    signalement: {
      court: "1 contenu signalé sur ce compte",
      detail: "Un mot reçu sur un Mur de ce compte attend une décision en Modération.",
    },
    murs: {
      titre: "Murs de ce compte",
      note: "Le contenu d'un Mur ne s'ouvre qu'en Modération, et sur signalement.",
      col: {
        nom: "Mur",
        occasion: "Occasion",
        date: "Date",
        etat: "État",
        contributions: "Contributions",
      },
      etats: {
        publie: "Publié",
        brouillon: "Brouillon",
      },
      vide: {
        titre: "Ce compte n'a pas encore de Mur",
        texte: "Les Murs publiés apparaissent ici, avec leur occasion et le nombre de mots reçus.",
      },
    },
    credits: {
      titre: "Mouvements de crédits",
      note: "Transactions détaille les recharges ; ici, ce que le compte a reçu et dépensé.",
      col: {
        objet: "Objet",
        nature: "Nature",
        credits: "Crédits",
        date: "Date",
      },
      natures: {
        achat: "Achat",
        depense: "Dépense",
        offert: "Offert",
        rendu: "Rendu",
      },
      vide: {
        titre: "Aucun mouvement pour l'instant",
        texte: "Les achats, les dépenses et les crédits offerts apparaissent ici.",
      },
    },
    securite: {
      titre: "Sessions ouvertes",
      note: "Clore une session déconnecte l'appareil sans toucher au compte.",
      col: {
        appareil: "Appareil",
        lieu: "Lieu",
        vue: "Dernière activité",
      },
      clore: "Clore",
      close: "Session close. Cet appareil devra se reconnecter.",
      vide: {
        titre: "Aucune session ouverte",
        texte: "Les appareils connectés à ce compte apparaissent ici.",
      },
    },
  },

  suppressions: {
    titre: "Demandes de suppression",
    sous: "Suivez les comptes en délai de grâce, restaurez à la demande, effacez quand le délai est échu.",
    recherche: "Pseudo ou adresse e-mail",
    filtreEtat: "État",
    tousEtats: "Tous les états",
    etats: {
      enCours: "Délai de grâce",
      echue: "À effacer",
      efface: "Effacé",
    },
    col: {
      compte: "Compte",
      demandee: "Demandée le",
      echeance: "Fin du délai",
      restant: "Jours restants",
      etat: "État",
    },
    restantZero: "Aujourd'hui",
    restantUn: "1 jour",
    restantN: "{n} jours",
    restaurer: "Restaurer",
    effacer: "Effacer sans attendre",
    dialogueEffacer: {
      titre: "Effacer {compte} maintenant ?",
      consequence: "L'effacement est définitif : fiches, notes, contenus produits et surfaces publiques disparaissent. Ce qui reste du délai de grâce s'arrête là.",
      motifs: [
        "Demande explicite du titulaire",
        "Compte de test",
        "Obligation légale",
      ],
    },
    dialogueRestaurer: {
      titre: "Restaurer {compte} ?",
      consequence: "Le compte redevient actif avec ses données, et sa demande de suppression s'annule.",
      motifs: [
        "Demande du titulaire",
        "Suppression déclenchée par erreur",
      ],
    },
    faits: {
      efface: "Compte effacé. Motif : {motif}",
      restaure: "Compte restauré. Motif : {motif}",
    },
    vide: {
      titre: "Rien en attente d'effacement",
      texte: "Les comptes en délai de grâce apparaissent ici, avec leur échéance.",
    },
  },

  parametres: {
    titre: "Configurations",
    sous: "Ces valeurs pilotent le produit. Elles prennent effet dès que vous enregistrez.",
    onglets: {
      economie: "Économie",
      occasions: "Types d'occasions",
    },
    precedente: "Valeur précédente : {valeur}",
    enregistrer: "Enregistrer",
    annuler: "Annuler",
    enregistre: "Configurations enregistrées.",
    rienAEnregistrer: "Rien n'a changé depuis le dernier enregistrement.",
    journal: "Le journal d'audit garde chaque changement et son auteur.",
    erreurEntier: "Un nombre entier supérieur à zéro.",
    occasions: {
      sous: "Ce que le produit propose de célébrer. L'ordre est celui du choix à la création.",
      col: {
        nom: "Type",
        etat: "État",
        registre: "Registre",
      },
      etats: {
        propose: "Proposé",
        masque: "Masqué",
      },
      sensible: "Occasion sensible",
      courant: "Occasion courante",
      noteSensible: "Une occasion sensible ne reçoit ni message enjoué ni suggestion de cadeau.",
      ajouter: "Ajouter un type",
      vide: {
        titre: "Aucun type proposé pour l'instant",
        texte: "Les types que le produit propose à la création apparaissent ici.",
      },
    },
  },

  profil: {
    titre: "Mon profil",
    groupes: {
      compte: "Compte",
      acces: "Accès",
    },
    champs: {
      email: "Adresse",
      role: "Rôle",
      ajoutePar: "Ajouté par",
      derniere: "Dernière connexion",
      methode: "Méthode de connexion",
      portee: "Ce que ce rôle ouvre",
    },
    methode: "Adresse e-mail et code à usage unique",
    portee: {
      support: "Comptes, crédits, modération, demandes de suppression.",
      admin: "Tout, dont les configurations, les accès et le journal d'audit.",
    },
    sessionsTitre: "Sessions ouvertes",
    col: {
      appareil: "Appareil",
      ip: "Adresse IP",
      depuis: "Depuis",
    },
    ici: "Session en cours",
    fermer: "Fermer les autres sessions",
    fermees: "Les autres appareils devront se reconnecter.",
    vide: {
      titre: "Une seule session ouverte",
      texte: "Les autres appareils connectés à ce compte apparaissent ici.",
    },
  },

  // L'écran répond la même chose à une adresse connue et à une adresse
  // inconnue : dire « ce compte n'existe pas » donnerait la liste de l'équipe.
  connexion: {
    marque: "Back-office",
    titre: "Connexion",
    sous: "Réservée aux comptes d'administration.",
    adresse: "Adresse e-mail",
    adressePlaceholder: "vous@lehno.app",
    envoyer: "Recevoir un code",
    titreCode: "Le code",
    envoye: "Un code vient de partir vers {adresse}.",
    code: "Code à 6 chiffres",
    entrer: "Entrer",
    renvoyer: "Renvoyer un code",
    renvoyerDans: "Renvoyer un code dans {n} s",
    changer: "Changer d'adresse",
    faux: "Code refusé. Il reste {n} tentatives.",
    fauxUn: "Code refusé. Il reste une tentative.",
    epuise: "3 codes refusés. Demandez-en un nouveau pour reprendre.",
    echec: "On n'a pas pu envoyer le code. Rien n'est parti vers cette adresse. Réessayez dans un instant.",
  },

  // Le serveur rend un code stable, jamais une phrase : son message est destiné
  // au journal, écrit dans une seule langue, et cite des identifiants internes.
  // C'est ici que le code devient lisible — et c'est ce qui rend l'outil
  // bilingue sans que le serveur ait à connaître la langue de qui l'appelle.
  codes: {
    otp_invalid: "Code refusé.",
    otp_expired: "Ce code a expiré. Demandez-en un nouveau.",
    otp_too_many_attempts: "Trop de codes refusés. Demandez-en un nouveau pour reprendre.",
    otp_rate_limited: "Trop de demandes. Patientez un instant avant de réessayer.",
    unauthorized: "Votre session a expiré. Reconnectez-vous.",
    session_expired: "Votre session a expiré. Reconnectez-vous.",
    refresh_reused: "Votre session a été fermée par sécurité. Reconnectez-vous.",
    forbidden: "Votre rôle ne permet pas cette action.",
    not_found: "Introuvable.",
    conflict: "L'état a changé entre-temps. Rechargez avant de réessayer.",
    validation_failed: "La demande est mal formée.",
    reason_required: "Un motif est nécessaire, d'au moins six caractères.",
    rate_limited: "Trop de demandes. Patientez un instant.",
    internal_error: "Le service a rencontré une erreur. Réessayez dans un instant.",
    account_suspended: "Ce compte est suspendu.",
    reseau_indisponible: "Le service est injoignable. Vérifiez votre connexion.",
    reponse_invalide: "Le service a répondu quelque chose d'inattendu. Réessayez dans un instant.",
  },

  gabarits: {
    tableau: "Tableau de bord",
    liste: "Liste filtrable, puis détail",
    formulaire: "Formulaire de configuration",
  },

  attente: {
    titre: "Section à venir",
    texte: "Le lot 1 couvre le tableau de bord, les utilisateurs, les crédits, les configurations et le journal d'audit. Cette section arrive ensuite.",
    gabarit: "Gabarit : {gabarit}",
  },
};
