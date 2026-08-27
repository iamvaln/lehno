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
    moderation: "Modération",
    suppressions: "Demandes de suppression",
    assistance: "Assistance",
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
    // Le fichier arrive tout de suite. La formule précédente annonçait un
    // courriel : il n'existe ni file d'attente ni envoi de pièce jointe, et
    // promettre un courriel qui n'arrive jamais est pire qu'un téléchargement.
    telecharge: "Le fichier est prêt : il vient d'être téléchargé.",
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

  // La section « Journal d'audit ». À ne pas confondre avec `audit` ci-dessus,
  // qui nomme l'historique des interventions **sur un compte**, dans sa fiche.
  // Les deux existent, et ne montrent pas la même chose.
  journal: {
    titre: "Journal d'audit",
    sous: "Ce que l'équipe a fait, avec son motif. Rien ne s'y modifie ni ne s'y efface.",
    col: { date: "Quand", acteur: "Qui", action: "Quoi", motif: "Pourquoi", cible: "Sur quoi" },
    // Un utilisateur agissant chez lui n'a rien à justifier ; l'absence se dit,
    // plutôt que de laisser une case vide qu'on prendrait pour un oubli.
    sansMotif: "Geste de l'utilisateur",
    acteurs: { admin: "Administration", user: "Utilisateur" },
    vide: {
      titre: "Aucune trace sur cette période",
      texte: "Chaque geste d'administration s'inscrit ici, avec son auteur, sa cible et son motif.",
    },
    filtres: {
      action: "Nature du geste",
      periode: "Période",
      toutes: "Toutes",
      touteLaPeriode: "Depuis toujours",
      // Les natures que le journal porte aujourd'hui. La liste vient du code
      // parce qu'elle vient des gestes qu'on a écrits — la déduire des traces
      // existantes ferait disparaître un filtre le jour où personne n'a encore
      // posé ce geste.
      actions: {
        user_status_update: "Changement d'état d'un compte",
        admin_invite: "Invitation d'un administrateur",
        admin_role_update: "Changement de rôle d'un administrateur",
        admin_revoke: "Révocation d'un accès d'administrateur",
        ai_model_update: "Réglage d'un modèle d'IA",
        prompt_template_create: "Création d'un gabarit de production",
        prompt_template_activate: "Activation d'un gabarit de production",
        support_request_update: "Changement d'état d'une demande d'assistance",
        parameter_update: "Modification d'un paramètre",
        feature_flag_update: "Bascule d'une fonctionnalité",
        credit_bundle_update: "Modification d'un palier",
        payment_channel_create: "Ouverture d'un canal",
        payment_channel_update: "Modification d'un barème",
        collection_account_create: "Ouverture d'un compte de collecte",
        collection_account_update: "Modification d'un compte de collecte",
        payment_manual_create: "Saisie d'un paiement",
        payment_decision: "Décision sur un paiement",
        credit_adjustment: "Ajustement d'un solde",
        audit_log_export: "Export du journal",
        login_activity_export: "Export des connexions",
        user_export: "Export des comptes",
        payment_export: "Export des paiements",
        credit_transaction_export: "Export des mouvements de crédits",
      },
    },
  },

  entrees: {
    titre: "Connexions",
    sous: "Les entrées réussies et les tentatives refusées. L'adresse IP est enregistrée mais ne se lit pas ici : elle sert aux investigations, pas à la lecture courante.",
    col: { date: "Quand", compte: "Compte", adresse: "Adresse tentée", resultat: "Résultat", appareil: "Appareil", lieu: "Lieu approximatif" },
    resultats: { success: "Entrée", failure: "Refusée" },
    inconnu: "—",
    filtres: {
      resultat: "Résultat",
      periode: "Période",
      tous: "Tous",
      touteLaPeriode: "Depuis toujours",
    },
    vide: {
      titre: "Aucune tentative sur cette période",
      texte: "Chaque entrée, réussie ou non, s'inscrit ici avec son appareil et son lieu approximatif.",
    },
  },

  modeles: {
    titre: "Modèles d'IA",
    sous: "Ce qu'on appelle pour chaque tâche, dans quel ordre, et ce que ça coûte au fournisseur.",
    col: { fournisseur: "Fournisseur", modele: "Modèle", capacite: "Sait faire", etat: "État", emplois: "Où il sert", entree: "Coût entrée", sortie: "Coût sortie" },
    capacites: { texte: "Texte", image: "Image" },
    /* Trois états, et surtout pas deux. « Éteint » est la décision d'un humain,
       « momentanément injoignable » le constat du disjoncteur. Ils se réparent
       par des gestes opposés : le premier attend qu'on le rallume, le second se
       rouvre seul. Les confondre ferait attendre une reprise qui ne viendra pas. */
    etats: { actif: "En service", eteint: "Éteint", enPanne: "Momentanément injoignable" },
    // Un coût absent n'est pas un coût nul : c'est un modèle qu'on n'a pas
    // encore tarifé. « 0 » le ferait passer pour gratuit dans un calcul de marge.
    sansCout: "Non tarifé",
    sansEmploi: "Dans aucune chaîne",
    unite: "$ / M jetons",
    taches: {
      note_classification: "Classement des notes",
      sensitive_detection: "Détection du sensible",
      message: "Message",
      gift_ideas: "Idées de cadeaux",
      illustration: "Illustration",
      photo_style: "Style photo",
    } as Record<string, string>,
    eteindre: "Éteindre ce modèle",
    rallumer: "Remettre en service",
    dialogueEteindre: {
      titre: "Éteindre {modele}",
      consequence: "Les productions passeront au modèle suivant, dans chaque chaîne où celui-ci figure. Si c'est le dernier en service d'une tâche, le serveur refusera.",
      motifs: [
        "Le modèle échoue trop souvent",
        "Coût devenu trop élevé",
        "Remplacé par un autre fournisseur",
      ],
    },
    dialogueRallumer: {
      titre: "Remettre {modele} en service",
      consequence: "Il reprendra sa place, à son rang, dans chaque chaîne où il figure.",
      motifs: [
        "L'incident du fournisseur est clos",
        "Retour arrière après un essai",
      ],
    },
    chaines: {
      titre: "L'ordre d'essai, tâche par tâche",
      sous: "Le rang 1 est appelé en premier. S'il ne répond pas, on passe au suivant. Le fournisseur est rappelé à chaque rang : trois modèles du même hébergeur, c'est une chaîne qu'une seule panne emporte en entier.",
      vide: "Aucun modèle rangé sur cette tâche : rien ne sera produit.",
      promouvoir: "Monter d'un rang",
      declasser: "Descendre d'un rang",
      dialogue: {
        titre: "Changer l'ordre d'essai",
        consequence: "L'ordre s'applique à la prochaine production. Les crédits déjà engagés ne sont pas concernés.",
        motifs: [
          "Le primaire coûte trop cher",
          "Le repli donne de meilleurs résultats",
          "Le fournisseur du primaire est instable",
        ],
      },
      avertissements: {
        courte: "Cette chaîne ne compte que {rangs} rang(s) au lieu de {recommande}. Ce n'est pas une erreur : deux fournisseurs seulement produisent des images.",
        fournisseurRepete: "Plusieurs rangs partagent le même fournisseur : une seule panne emporterait toute la chaîne, et le repli n'aurait pas lieu.",
      },
    },
    // Ce que cet écran ne montre pas encore, et pourquoi.
    manque: "La dépense réelle et ce qu'elle a rapporté n'apparaissent pas encore : les productions payantes ne sont pas encore rattachées à leur consommation. Ce catalogue dit ce qu'on essaie, dans quel ordre, et ce que ça coûte au fournisseur.",
  },

  drapeaux: {
    titre: "Fonctionnalités",
    sous: "Ce qu'on livre, et ce qui attend. Le socle n'y figure pas : il n'est pas extinguible.",
    col: { cle: "Clé", gouverne: "Ce que ça gouverne", portee: "Où", couverture: "Ce que ça couvre", etat: "État", parQui: "Dernière bascule" },
    etats: {
      actif: "En service",
      eteint: "Éteint",
      // Allumé, mais un prérequis est éteint : la fonctionnalité ne tourne pas.
      // Le dire évite de croire qu'elle marche alors que personne ne la voit.
      inerte: "Allumé, sans effet",
    },
    portees: { app: "Application", public: "Public" },
    requiert: "Demande : {cles}",
    emporte: "Éteindre emporte aussi",
    jamais: "Jamais basculé",
    allumer: "Allumer",
    eteindre: "Éteindre",
    dialogueEteindre: {
      titre: "Éteindre {cle}",
      consequence: "Les écrans et points d'entrée listés cessent de répondre. Ceux qui en dépendent s'éteignent avec.",
      motifs: [
        "Incident en cours sur cette fonctionnalité",
        "Pas encore prête pour le public",
        "Coût trop élevé pour l'instant",
      ],
    },
    dialogueAllumer: {
      titre: "Allumer {cle}",
      consequence: "Les écrans et points d'entrée listés se mettent à répondre. Si un prérequis est éteint, rien ne changera tant qu'il le reste.",
      motifs: [
        "Ouverture au public",
        "L'incident est clos",
        "Essai sur une durée courte",
      ],
    },
  },

  // La section §5.4. Trois faces d'une même chose : ce qui est entré, ce que
  // ça a produit en crédits, et les réglages qui décident de l'un et de
  // l'autre.
  credits: {
    titre: "Crédits et paiements",
    sous: "Ce qui est entré, ce que ça a produit, et les réglages qui en décident.",
    onglets: { paiements: "Paiements", mouvements: "Mouvements", reglages: "Réglages" },

    paiements: {
      col: {
        utilisateur: "Compte", mode: "Voie", etat: "État", montant: "Montant",
        methode: "Méthode", attendu: "Attendu", recu: "Reçu", ecart: "Écart", quand: "Saisi le",
      },
      modes: { provider: "Prestataire", semi_manual: "Semi-manuel", manual: "Manuel" },
      etats: {
        pending: "En attente", succeeded: "Confirmé", failed: "Refusé",
        expired: "Expiré", refunded: "Remboursé",
      },
      filtreEtat: "État", filtreMode: "Voie", tous: "Tous",
      // Ce qu'on ne connaît pas ne s'écrit pas zéro : un écart nul et un écart
      // non constaté ne disent pas la même chose.
      nonConstate: "—",
      vide: {
        titre: "Aucun paiement sur cette période",
        texte: "Les versements saisis et ceux reçus par l'application apparaissent ici, avec leur issue.",
      },
    },

    mouvements: {
      col: { utilisateur: "Compte", type: "Type", source: "Origine", montant: "Crédits", quand: "Le" },
      types: { grant: "Octroi", purchase: "Achat", consumption: "Consommation", adjustment: "Ajustement" },
      sources: {
        signup_grant: "Inscription", referral_bonus: "Parrainage", purchase: "Achat",
        manual_topup: "Versement manuel", promo_code: "Code promo", gift: "Cadeau",
        reward: "Récompense", consumption: "Consommation", refund: "Remboursement",
        correction: "Correction",
      },
      vide: {
        titre: "Aucun mouvement sur cette période",
        texte: "Chaque octroi, achat, consommation et ajustement s'inscrit ici.",
      },
    },

    detail: {
      titre: "Paiement",
      groupes: { operation: "L'opération", montants: "Les montants", histoire: "Son histoire" },
      champs: {
        reference: "Référence", compte: "Compte de collecte", frais: "Frais",
        montant: "Prix du palier", attendu: "Attendu sur le compte", recu: "Constaté",
        ecart: "Écart", motifEchec: "Motif du refus", credits: "Crédits",
      },
      histoire: { etat: "État", debut: "Depuis", duree: "Durée", origine: "Provoqué par", parQui: "Par", motif: "Motif" },
      origines: {
        user: "L'utilisateur", webhook: "Le prestataire", polling: "Une interrogation",
        admin: "L'administration", system: "Un traitement programmé",
      },
      // L'état courant dure encore : lui donner une durée figerait une mesure
      // qui bouge.
      enCours: "En cours",
      retour: "Retour aux paiements",
    },

    decision: {
      confirmer: "Confirmer la réception",
      rejeter: "Rejeter",
      // Le rappel qui évite l'approbation machinale. Il ne s'efface pas.
      avertissement: "Le reçu ne prouve rien : un montage est facile. Vérifiez la réception sur le compte de l'opérateur avant de confirmer.",
      montantRecu: "Montant constaté sur le compte",
      montantAide: "À renseigner même sans écart : c'est lui qui permet de constater qu'il n'y en a pas.",
      reference: "Référence de la transaction",
      dialogueConfirmer: {
        titre: "Confirmer ce versement",
        consequence: "Les crédits sont octroyés au compte, une seule fois. Le client en est prévenu.",
        motifs: ["Réception constatée sur le compte", "Versement retrouvé après recherche"],
      },
      dialogueRejeter: {
        titre: "Rejeter ce versement",
        consequence: "Aucun crédit n'est octroyé. Le motif sera visible sur le paiement.",
        motifs: ["Aucune réception sur le compte", "Montant insuffisant", "Reçu non conforme"],
      },
    },

    // Enregistrer un versement constaté. Le montant et les crédits viennent du
    // palier : « on achète un palier, jamais un montant libre », et l'écran
    // n'offre donc aucun champ de montant.
    saisie: {
      ouvrir: "Saisir un versement",
      titre: "Saisir un versement reçu",
      sous: "Le versement a déjà été fait. On l'enregistre ici, puis on le confirme après avoir vérifié la réception.",
      champs: {
        compteClient: "Compte crédité",
        palier: "Palier acheté",
        canal: "Canal employé",
        compte: "Compte qui a reçu",
        numeroPayeur: "Numéro du payeur",
        reference: "Référence de la transaction",
      },
      apercu: {
        titre: "Ce que le client verse, et ce qu'on doit voir arriver",
        aVerser: "Le client verse",
        attendu: "On doit voir arriver",
        credits: "Crédits octroyés à la confirmation",
      },
      choisir: "Choisir…",
      enregistrer: "Enregistrer le versement",
      annuler: "Annuler",
      // Le paiement naît en attente : il reste à confirmer une fois la
      // réception vérifiée sur le compte de l'opérateur.
      enregistre: "Versement enregistré, en attente de confirmation.",
      motifs: [
        "Versement constaté sur le compte",
        "Recharge demandée par téléphone",
        "Régularisation d'un versement ancien",
      ],
      dialogue: {
        titre: "Enregistrer ce versement",
        consequence: "Le paiement naît en attente. Aucun crédit n'est octroyé tant que la réception n'est pas confirmée.",
      },
    },

    reglages: {
      paliers: {
        titre: "Paliers d'achat",
        sous: "Ce qu'on propose à l'achat. Aucune saisie libre : le plus petit palier fixe le minimum.",
        col: { montant: "Prix", credits: "Crédits", remise: "Remise", position: "Ordre", etat: "État" },
      },
      canaux: {
        titre: "Canaux et barèmes",
        sous: "Ce que le service propose, et ce que l'opérateur prend. Un canal ne se supprime pas, il se désactive.",
        col: { libelle: "Canal", pays: "Pays", frais: "Frais", portes: "À la charge de", etat: "État" },
        portes: { payer: "Du client", payee: "Du service" },
      },
      comptes: {
        titre: "Comptes de collecte",
        sous: "Les comptes sur lesquels les clients versent.",
        col: { libelle: "Compte", operateur: "Opérateur", numero: "Numéro", visible: "Dans l'application", etat: "État" },
        visible: "Proposé", masque: "Masqué",
      },
      actif: "En service",
      inactif: "Retiré",
      aucuneRemise: "—",
    },
  },

  // Les comptes d'exploitation. « Gérer les accès des administrateurs » est
  // réservé au rôle admin (ux-admin §6) — c'est le contrepoids du journal
  // d'audit : qui peut lire le travail de l'équipe décide aussi qui en fait
  // partie.
  acces: {
    titre: "Accès administrateurs",
    sous: "Qui entre dans cet outil, et avec quels droits. Un accès se retire, il ne s'efface pas.",
    col: { email: "Adresse", nom: "Nom", role: "Rôle", etat: "État", depuis: "Depuis" },
    roles: { admin: "Administrateur", support: "Support" },
    etats: { actif: "En service", revoque: "Accès retiré" },
    sansNom: "—",
    // Le compte de celui qui regarde : ni rôle ni accès ne s'y touchent.
    soiMeme: "Vous",
    vide: {
      titre: "Aucun autre compte",
      texte: "Les comptes d'exploitation apparaissent ici, avec leur rôle et la date de leur arrivée.",
    },
    gestes: {
      promouvoir: "Passer administrateur",
      retrograder: "Passer support",
      revoquer: "Retirer l'accès",
    },
    inviter: {
      ouvrir: "Inviter quelqu'un",
      titre: "Inviter un compte d'exploitation",
      sous: "Le compte est créé à l'avance : une adresse inconnue ne reçoit jamais de code.",
      email: "Adresse e-mail",
      role: "Rôle",
      confirmer: "Inviter",
      annuler: "Annuler",
      motifs: [
        "Arrivée dans l'équipe",
        "Renfort temporaire sur l'assistance",
        "Remplacement d'un départ",
      ],
      dialogue: {
        titre: "Inviter ce compte",
        consequence: "Le compte pourra entrer dès sa première demande de code. Le journal garde qui l'a invité.",
      },
    },
    dialogueRole: {
      titre: "Changer le rôle de {compte}",
      consequence: "Le rôle administrateur ouvre la famille Économie et le journal d'audit. Le changement prend effet au prochain geste.",
      motifs: [
        "Changement de responsabilité",
        "Besoin d'accès aux leviers d'économie",
        "Retour à un périmètre d'assistance",
      ],
    },
    dialogueRevocation: {
      titre: "Retirer l'accès de {compte}",
      // Ce qui distingue « retirer l'accès » de « le retirer plus tard ».
      consequence: "Les sessions ouvertes se ferment tout de suite. Le compte est désactivé, jamais effacé : le journal doit encore pouvoir nommer qui a fait quoi.",
      motifs: [
        "Départ de l'équipe",
        "Compte compromis",
        "Fin d'une mission temporaire",
      ],
    },
  },

  // Les quatre files. Trois se lisent, la quatrième se solde — et c'est la
  // seule dont le modèle porte un état.
  assistance: {
    titre: "Assistance",
    sous: "Ce que les gens nous écrivent, et ce qui attend une réponse.",
    onglets: { demandes: "Demandes", contact: "Messages", attente: "Liste d'attente", retours: "Retours" },

    demandes: {
      col: { utilisateur: "Compte", sujet: "Sujet", corps: "Demande", version: "Version", etat: "État", quand: "Reçue le" },
      etats: { open: "Ouverte", answered: "Répondue", closed: "Close" },
      filtreEtat: "État",
      tous: "Toutes",
      sansSujet: "—",
      gestes: { repondre: "Marquer répondue", clore: "Clore", rouvrir: "Rouvrir" },
      dialogue: {
        titre: "Changer l'état de cette demande",
        consequence: "Le changement rejoint le journal d'audit, avec son motif.",
        motifs: [
          "Réponse envoyée par courriel",
          "Question déjà traitée ailleurs",
          "Sans suite après relance",
        ],
      },
      vide: {
        titre: "Aucune demande en attente",
        texte: "Les demandes envoyées depuis l'application apparaissent ici, la plus ancienne d'abord.",
      },
    },

    contact: {
      col: { nom: "Nom", email: "Adresse", sujet: "Sujet", message: "Message", quand: "Reçu le" },
      // Les six clés du formulaire public. Le serveur transporte la clé, jamais
      // la phrase : c'est ce qui permet de la dire dans les deux langues.
      sujets: {
        question: "Une question",
        probleme: "Un problème",
        suggestion: "Une suggestion",
        partenariat: "Un partenariat",
        presse: "La presse",
        autre: "Autre chose",
      },
      vide: {
        titre: "Aucun message",
        texte: "Les messages du formulaire public apparaissent ici, le plus récent d'abord.",
      },
    },

    attente: {
      col: { email: "Adresse", source: "Venue de", langue: "Langue", quand: "Inscrite le" },
      sansSource: "—",
      vide: {
        titre: "Personne sur la liste",
        texte: "Les adresses laissées avant l'ouverture apparaissent ici.",
      },
    },

    retours: {
      col: { utilisateur: "Compte", note: "Note", corps: "Retour", version: "Version", quand: "Laissé le" },
      anonyme: "Compte retiré",
      sansNote: "—",
      vide: {
        titre: "Aucun retour",
        texte: "Les retours laissés depuis l'application apparaissent ici.",
      },
    },
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
    // Les libellés des paramètres vivent ici, indexés par la clé que le serveur
    // envoie : il transporte des clés, jamais des phrases composées. Une clé
    // qu'on ne connaît pas s'affiche telle quelle — ça se voit, et c'est mieux
    // qu'une ligne vide.
    cles: {
      reminder_lead_days_default: { libelle: "Anticipation des rappels", aide: "Combien de jours avant la date le rappel part, par défaut.", unite: "jours" },
      wish_window_lead_days: { libelle: "Ouverture de la fenêtre de vœux", aide: "Combien de jours avant la date le lien accepte des vœux.", unite: "jours" },
      wish_window_trail_days: { libelle: "Fermeture de la fenêtre de vœux", aide: "Combien de jours après la date le lien reste ouvert.", unite: "jours" },
      max_accounts_per_device: { libelle: "Comptes par appareil", aide: "Au-delà, la création est refusée depuis cet appareil.", unite: null },
      account_grace_period_days: { libelle: "Délai de grâce", aide: "Le temps laissé avant l'effacement définitif d'un compte.", unite: "jours" },
      signup_free_credits: { libelle: "Crédits offerts à l'inscription", aide: "Ce qu'un compte neuf reçoit pour essayer.", unite: "crédits" },
      credit_unit_price: { libelle: "Prix du crédit", aide: "Le prix unitaire, en francs CFA.", unite: "FCFA" },
    },
    motif: {
      titre: "Enregistrer ces réglages",
      question: "Pourquoi ce changement ?",
      consequence: "Ces valeurs pilotent le produit et prennent effet tout de suite. Le journal garde le motif, votre nom et l'heure.",
      motifs: [
        "Ajustement tarifaire",
        "Correction d'une valeur erronée",
        "Décision de lancement",
      ],
    },
    nonReglable: "Ces types viennent du code : leur état ne se règle pas ici. Ils sont montrés pour qu'on sache lesquels existent.",
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
    /** Ce qu'on écrit à la place d'une valeur absente — jamais une valeur inventée. */
    inconnu: "—",
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
    // Un palier retiré, un canal fermé, un compte de collecte désactivé : la
    // demande est bien formée, c'est ce qu'elle vise qui ne se propose plus.
    resource_inactive: "Ce choix n'est plus proposé. Rechargez pour voir ce qui reste disponible.",
    insufficient_credits: "Il n'y a pas assez de crédits pour ce geste.",
    rate_limited: "Trop de demandes. Patientez un instant.",
    internal_error: "Le service a rencontré une erreur. Réessayez dans un instant.",
    account_suspended: "Ce compte est suspendu.",
    reseau_indisponible: "Le service est injoignable. Vérifiez votre connexion.",
    reponse_invalide: "Le service a répondu quelque chose d'inattendu. Réessayez dans un instant.",
  },

  studio: {
    titre: "Studio du portrait",
    sous: "Les gabarits de production en service, et ce qui les a précédés.",
    portee: "Cette entrée montre les réglages en service. La composition d'un brouillon et le banc d'essai ne sont pas encore possibles : le modèle de données ne porte pas de brouillon, et aucun fournisseur d'IA n'est branché.",
    col: {
      genre: "Production",
      cle: "Gabarit",
      version: "En service",
      modele: "Modèle appelé",
      parQui: "Publié par",
      corps: "Consigne",
    },
    genres: {
      message: "Message",
      illustration: "Illustration",
      photo_style: "Style de photo",
      note_classification: "Classement des notes",
      sensitive_detection: "Détection des cas sensibles",
    },
    version: "Version {n}",
    aucune: "Aucune",
    parPriorite: "Au routage par priorité",
    parMigration: "Posé à l'installation",
    historique: "Historique de « {cle} »",
    revenir: "Remettre en service",
    dialogue: {
      titre: "Remettre la version {n} en service",
      consequence: "La version en service se range, celle-ci reprend la main. Rien n'est reconstruit, et le changement rejoint le journal d'audit avec son motif.",
      motifs: [
        "Les productions se sont dégradées depuis la publication",
        "La version en service ne tient pas ses garde-fous",
        "Retour arrière après un essai non concluant",
      ],
    },
    vide: {
      titre: "Aucun gabarit",
      texte: "Les gabarits de production s'inscrivent ici dès qu'une première version est publiée.",
    },
  },

  liens: {
    titre: "Liens externes",
    sous: "Les consoles des plateformes sur lesquelles Lehno s'appuie, rassemblées ici plutôt que cherchées ailleurs.",
    groupes: {
      mesure: "Mesure et supervision",
      messages: "Envoi de messages",
      identite: "Identité et connexion",
      code: "Code et livraison",
    },
    usages: {
      posthog: "La mesure d'usage : ce que les gens font dans l'application, et ce qu'ils n'y font pas.",
      resend: "L'envoi des e-mails transactionnels — codes de connexion, confirmations, avis.",
      google: "Les identifiants de la connexion Google, et leur validité.",
      apple: "Les identifiants de la connexion Apple, et les certificats de l'application.",
      github: "Le dépôt, les revues et les livraisons.",
    },
    ouvrir: "Ouvre {nom} dans un nouvel onglet",
    horsOutil: "Chaque plateforme garde sa propre authentification : ces liens ne donnent aucun accès par eux-mêmes.",
  },

  gabarits: {
    tableau: "Tableau de bord",
    liste: "Liste filtrable, puis détail",
    formulaire: "Formulaire de configuration",
  },

  metriques: {
    titre: "Métriques",
    sous: "L'usage au-delà des chiffres du tableau de bord.",
    periode: "Période",
    periodes: { j7: "7 jours", j30: "30 jours", j90: "90 jours", m12: "12 mois" },
    retention: {
      titre: "Rétention",
      sous: "Ce que devient chaque mois d'arrivées. Toujours douze mois, quelle que soit la période retenue : sur une fenêtre plus courte, la colonne des trente jours ne pourrait afficher que des zéros, et ces zéros se liraient comme une fuite.",
      // « De retour » et non « revenus » : la page porte des montants juste à
      // côté, et le mot s'y lirait comme de l'argent.
      col: { mois: "Mois d'entrée", inscrits: "Entrées", a7: "De retour à 7 jours", a30: "De retour à 30 jours" },
      vide: "Aucune arrivée sur les douze derniers mois.",
    },
    conversion: {
      titre: "Conversion",
      sous: "La part d'une arrivée qui finit par acheter. Le chiffre d'affaires, lui, se lit au tableau de bord.",
      comptes: "Comptes entrés",
      acheteurs: "Ont acheté",
      delai: "Délai médian jusqu'au premier achat",
      // Zéro dirait « le jour même ». Personne n'ayant acheté, il n'y a pas de
      // délai à annoncer — et non un délai nul.
      sansDelai: "Personne n'a encore acheté",
      jours: "{n} j",
      paliers: "Achats par palier",
      colPalier: "Palier",
      colAchats: "Achats",
      credits: "{n} crédits",
      sansPalier: "Aucun achat rattaché à un palier sur la période.",
    },
    consommation: {
      titre: "Consommation",
      credits: "Crédits consommés",
      mouvements: "Mouvements",
    },
    manques: {
      titre: "Ce qui n'est pas encore mesurable",
      sous: "Trois des cinq contenus de la section n'ont pas de source dans ce dépôt. Ils sont nommés ici plutôt que rendus en rangs vides : un zéro sans explication se prend pour une mesure.",
      usage_par_fonctionnalite: {
        quoi: "Usage par fonctionnalité",
        bloque: "Le marquage part vers l'outil d'analyse sans que rien n'en soit conservé ici.",
      },
      issue_des_actions: {
        quoi: "Exécutions des actions payantes et leur issue",
        bloque: "Le registre des exécutions n'existe pas encore en base.",
      },
      contributions: {
        quoi: "Contributions reçues et validées",
        bloque: "Les surfaces publiques qui les produisent ne sont pas construites.",
      },
    },
  },

  attente: {
    titre: "Section à venir",
    texte: "Le lot 1 couvre le tableau de bord, les utilisateurs, les crédits, les configurations et le journal d'audit. Cette section arrive ensuite.",
    gabarit: "Gabarit : {gabarit}",
  },
};
