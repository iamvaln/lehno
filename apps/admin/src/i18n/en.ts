import type { fr } from "./fr.js";

// L'anglais s'écrit, il ne se traduit pas (specs/ton-et-ecriture-lehno.md §6) :
// le français sert de référence de sens, jamais de gabarit de phrase. Les
// contractions sont admises, le point d'exclamation ne l'est pas, et tout est en
// « sentence case » — `Mark as sent`, jamais `Mark As Sent`, qui est une
// convention de logiciel d'entreprise.
//
// Le « we » reste rare : il ne sort que pour les échecs, où quelqu'un doit
// répondre de ce qui s'est passé. Partout ailleurs l'anglais s'efface bien par
// le passif court — `Settings saved`, `Account suspended`.
//
// Le type reprend celui du français : une clé oubliée ou en trop ne compile pas.
export const en: typeof fr = {
  langue: "en",

  outil: {
    marque: "Back office",
    titre: "Lehno back office",
  },

  commun: {
    fermer: "Close",
    retour: "Back",
    chargement: "Loading…",
  },

  barre: {
    recherche: "Search a user, a payment, a piece of content",
    rechercheLabel: "Search",
    langue: "Language of the tool",
    theme: "Switch theme",
    menu: "Open navigation",
    compte: "My account",
    profil: "My profile",
    acces: "Administrator access",
    deconnexion: "Sign out",
    roleAdmin: "Administrator",
    roleSupport: "Support",
  },

  familles: {
    exploitation: "Operations",
    economie: "Economy",
    supervision: "Monitoring",
    outils: "Tools",
  },

  sections: {
    tableau: "Dashboard",
    alertes: "Alerts",
    moderation: "Moderation",
    suppressions: "Deletion requests",
    contact: "Contact messages",
    attente: "Waitlist",
    transactions: "Transactions",
    comptes: "Accounts",
    credits: "Credits and payments",
    acces: "Administrator access",
    parametres: "Parameters",
    fonctionnalites: "Features",
    modeles: "AI models",
    studio: "Portrait studio",
    offres: "Offers and growth",
    metriques: "Metrics",
    audit: "Audit log",
    connexions: "Sign-ins",
    liens: "External links",
    profil: "My profile",
  },

  fil: {
    accueil: "Dashboard",
    libelle: "Breadcrumb",
  },

  table: {
    toutSelectionner: "Select everything on this page",
    selectionner: "Select {nom}",
    actions: "Actions on this row",
    pagination: "List pages",
    precedent: "Previous",
    suivant: "Next",
    parPage: "Per page",
    reinitialiser: "Reset the filters",
    selectionUn: "1 row selected",
    selectionN: "{n} rows selected",
    deselectionner: "Clear the selection",
    resultatUn: "1 result",
    resultatsN: "{n} results",
    vide: {
      titre: "Widen the search",
      texte: "No row answers these filters. Drop one, or search on the address.",
    },
  },

  etats: {
    actif: "Active",
    suspendu: "Suspended",
    attente: "Pending",
    grace: "Grace period",
    efface: "Erased",
  },

  confirmation: {
    motif: "Reason",
    motifAide: "The audit log keeps this action and its reason.",
    autre: "Other — say which",
    autrePlaceholder: "In a few words, what this action is for",
    motifManquant: "Pick a reason before you confirm.",
    motifCourt: "A reason of 6 characters or more.",
    confirmer: "Confirm",
    annuler: "Cancel",
  },

  exporter: {
    bouton: "Export",
    avecPortee: "Export {portee}",
    porteeSelection: "{n} rows",
    porteeResultats: "the {n} results",
    formatCsv: "CSV — spreadsheet",
    formatJson: "JSON — raw data",
    journal: "The export shows up in the audit log.",
    encours: "Preparing the file…",
    lance: "Export started on {n} rows. The file will arrive by email.",
  },

  // Voir fr.ts : un écran qui charge et un écran vide ne disent pas la même chose.
  actions: {
    chargement: "Loading…",
    reessayer: "Try again",
    echecTitre: "Loading did not go through",
  },

  // Voir fr.ts : une valeur qu'on ne sait pas encore compter n'est pas zéro.
  nonMesure: {
    court: "—",
    explication: "Not measured yet",
    bloc: "This measure does not exist yet. It will appear here once the feature ships.",
  },

  echecs: {
    chargement: "We couldn't load this list. Nothing moved on the data side. Try again, or come back in a moment.",
    action: "We couldn't apply that action. The account is exactly as it was. Try again, or hand it to an administrator.",
    enregistrement: "We couldn't save. The values in place still hold. Go back over the form and try again.",
    reseau: "We lost the server along the way. The last action didn't go through. Check the connection, then try again.",
    exporter: "We couldn't prepare the file. No export went out. Try again in a moment.",
  },

  alerte: {
    notifie: "emailed at {heure}",
  },

  audit: {
    titre: "Audit log",
    sous: "What the team did, and why.",
    col: {
      date: "Date",
      auteur: "Author",
      action: "Action",
      objet: "Subject",
      motif: "Reason",
    },
    vide: {
      titre: "Nothing to report on this account",
      texte: "Actions taken by the team show up here, with their author and reason.",
    },
  },

  tableau: {
    titre: "Dashboard",
    sous: "What's going wrong, then the numbers, then what's waiting on a decision.",
    alertesTitre: "What's going wrong",
    alertesVide: {
      titre: "Nothing blocked",
      texte: "Outages and stuck jobs show up here, with the time the email went out.",
    },
    indicateursTitre: "The numbers",
    aTraiterTitre: "To handle",
    col: {
      element: "Item",
      section: "Section",
      etat: "Status",
      depuis: "Age",
    },
    vide: {
      titre: "Nothing to handle",
      texte: "The service is running. Anything that needs a decision shows up here.",
    },
  },

  comptes: {
    titre: "Users",
    sous: "Find an account, and act on it.",
    recherche: "Handle or email address",
    filtreEtat: "Status",
    tousEtats: "All statuses",
    filtreCredits: "Credits",
    tousCredits: "Any balance",
    sansCredit: "Zero balance",
    avecCredit: "Positive balance",
    col: {
      pseudo: "Handle",
      email: "Address",
      etat: "Status",
      credits: "Credits",
      inscrit: "Joined",
    },
    actions: {
      ouvrir: "Open the account",
      ajuster: "Adjust the balance",
      suspendre: "Suspend",
      retablir: "Reinstate",
    },
    lot: {
      exporter: "Export the selection",
      suspendre: "Suspend these accounts",
    },
    faits: {
      ajuster: "Balance adjusted. Reason: {motif}",
      suspendre: "Account suspended. Reason: {motif}",
      retablir: "Account reinstated. Reason: {motif}",
      suspendreLot: "{n} accounts suspended. Reason: {motif}",
    },
    suspendre: {
      titre: "Suspend {pseudo}?",
      consequence: "This account can no longer sign in, and its public surfaces stop answering. The data stays where it is.",
      motifs: [
        "Reported by someone else",
        "Suspected fraud",
        "The holder asked for it",
      ],
    },
    retablir: {
      titre: "Reinstate {pseudo}?",
      consequence: "The account signs in again, and its public surfaces answer again.",
      motifs: [
        "Checked, nothing to hold against it",
        "Suspended by mistake",
        "The holder asked for it",
      ],
    },
    ajuster: {
      titre: "Adjust the balance of {pseudo}",
      consequence: "The movement shows up in the account history, with its reason.",
      motifs: [
        "Failed generation never refunded",
        "Goodwill gesture",
        "Fixing a grant",
      ],
    },
    vide: {
      titre: "Widen the search",
      texte: "No account answers these filters. Drop one, or search on the address.",
    },
  },

  compte: {
    fil: "Users",
    sous: "{email} · account created {date}",
    onglets: {
      vue: "Overview",
      murs: "Walls",
      credits: "Credits",
      securite: "Security",
    },
    groupes: {
      compte: "Account",
      usage: "Usage",
      credits: "Credits",
    },
    champs: {
      etat: "Status",
      langue: "Language",
      inscrit: "Joined",
      derniere: "Last sign-in",
      solde: "Balance",
      achetes: "Credits bought",
      offerts: "Credits granted",
      proches: "People",
      occasions: "Occasions tracked",
      notes: "Notes",
      murs: "Walls",
    },
    cloisonnement: "Profiles and notes don't open here. We count them, and that's all.",
    suspendu: "This account is suspended. It can't sign in, and its public surfaces no longer answer.",
    signalement: {
      court: "1 reported item on this account",
      detail: "A message left on a Wall of this account is waiting on a decision in Moderation.",
    },
    murs: {
      titre: "Walls on this account",
      note: "A Wall's content only opens in Moderation, and only once reported.",
      col: {
        nom: "Wall",
        occasion: "Occasion",
        date: "Date",
        etat: "Status",
        contributions: "Messages",
      },
      etats: {
        publie: "Published",
        brouillon: "Draft",
      },
      vide: {
        titre: "This account has no Wall yet",
        texte: "Published Walls show up here, with their occasion and how many messages came in.",
      },
    },
    credits: {
      titre: "Credit movements",
      note: "Transactions itemises the top-ups; here is what the account received and spent.",
      col: {
        objet: "Item",
        nature: "Kind",
        credits: "Credits",
        date: "Date",
      },
      natures: {
        achat: "Bought",
        depense: "Spent",
        offert: "Granted",
        rendu: "Refunded",
      },
      vide: {
        titre: "No movement yet",
        texte: "Purchases, spending and granted credits show up here.",
      },
    },
    securite: {
      titre: "Open sessions",
      note: "Closing a session signs the device out without touching the account.",
      col: {
        appareil: "Device",
        lieu: "Location",
        vue: "Last activity",
      },
      clore: "Close",
      close: "Session closed. That device will have to sign in again.",
      vide: {
        titre: "No open session",
        texte: "Devices signed in to this account show up here.",
      },
    },
  },

  suppressions: {
    titre: "Deletion requests",
    sous: "Track accounts in their grace period, restore on request, erase once the period is over.",
    recherche: "Handle or email address",
    filtreEtat: "Status",
    tousEtats: "All statuses",
    etats: {
      enCours: "Grace period",
      echue: "To erase",
      efface: "Erased",
    },
    col: {
      compte: "Account",
      demandee: "Requested",
      echeance: "Period ends",
      restant: "Days left",
      etat: "Status",
    },
    restantZero: "Today",
    restantUn: "1 day",
    restantN: "{n} days",
    restaurer: "Restore",
    effacer: "Erase now",
    dialogueEffacer: {
      titre: "Erase {compte} now?",
      consequence: "Erasure is final: profiles, notes, generated content and public surfaces all go. Whatever is left of the grace period stops here.",
      motifs: [
        "The holder asked for it in writing",
        "Test account",
        "Legal obligation",
      ],
    },
    dialogueRestaurer: {
      titre: "Restore {compte}?",
      consequence: "The account goes back to active with its data, and its deletion request drops.",
      motifs: [
        "The holder asked for it",
        "Deletion triggered by mistake",
      ],
    },
    faits: {
      efface: "Account erased. Reason: {motif}",
      restaure: "Account restored. Reason: {motif}",
    },
    vide: {
      titre: "Nothing waiting to be erased",
      texte: "Accounts in their grace period show up here, with their deadline.",
    },
  },

  parametres: {
    titre: "Settings",
    sous: "These values steer the product. They take effect the moment you save.",
    onglets: {
      economie: "Economy",
      occasions: "Occasion types",
    },
    precedente: "Previous value: {valeur}",
    enregistrer: "Save",
    annuler: "Cancel",
    enregistre: "Settings saved.",
    rienAEnregistrer: "Nothing has changed since the last save.",
    journal: "The audit log keeps every change and its author.",
    erreurEntier: "A whole number above zero.",
    occasions: {
      sous: "What the product offers to celebrate. The order is the one shown at creation.",
      col: {
        nom: "Type",
        etat: "Status",
        registre: "Register",
      },
      etats: {
        propose: "Offered",
        masque: "Hidden",
      },
      sensible: "Sensitive occasion",
      courant: "Everyday occasion",
      noteSensible: "A sensitive occasion gets no cheerful message and no gift suggestion.",
      ajouter: "Add a type",
      vide: {
        titre: "No type offered yet",
        texte: "The types the product offers at creation show up here.",
      },
    },
  },

  profil: {
    titre: "My profile",
    groupes: {
      compte: "Account",
      acces: "Access",
    },
    champs: {
      email: "Address",
      role: "Role",
      ajoutePar: "Added by",
      derniere: "Last sign-in",
      methode: "Sign-in method",
      portee: "What this role opens",
    },
    methode: "Email address and one-time code",
    portee: {
      support: "Accounts, credits, moderation, deletion requests.",
      admin: "Everything, including settings, access and the audit log.",
    },
    sessionsTitre: "Open sessions",
    col: {
      appareil: "Device",
      ip: "IP address",
      depuis: "Since",
    },
    ici: "Current session",
    fermer: "Close the other sessions",
    fermees: "The other devices will have to sign in again.",
    vide: {
      titre: "One session open",
      texte: "Other devices signed in to this account show up here.",
    },
  },

  connexion: {
    marque: "Back office",
    titre: "Sign in",
    sous: "Admin accounts only.",
    adresse: "Email address",
    adressePlaceholder: "you@lehno.app",
    envoyer: "Send me a code",
    titreCode: "The code",
    envoye: "A code just went out to {adresse}.",
    code: "6-digit code",
    entrer: "Enter",
    renvoyer: "Send another code",
    renvoyerDans: "Send another code in {n} s",
    changer: "Change address",
    faux: "Code refused. {n} tries left.",
    fauxUn: "Code refused. One try left.",
    epuise: "3 codes refused. Ask for a new one to carry on.",
    echec: "We couldn't send the code. Nothing went out to that address. Try again in a moment.",
  },

  // Le serveur rend un code stable, jamais une phrase (voir fr.ts).
  codes: {
    otp_invalid: "Wrong code.",
    otp_expired: "That code has expired. Request a new one.",
    otp_too_many_attempts: "Too many wrong codes. Request a new one to continue.",
    otp_rate_limited: "Too many requests. Wait a moment before trying again.",
    unauthorized: "Your session has expired. Sign in again.",
    session_expired: "Your session has expired. Sign in again.",
    refresh_reused: "Your session was closed as a precaution. Sign in again.",
    forbidden: "Your role does not allow this action.",
    not_found: "Not found.",
    conflict: "Things changed in the meantime. Reload before trying again.",
    validation_failed: "That request is malformed.",
    reason_required: "A reason is required, at least six characters.",
    rate_limited: "Too many requests. Wait a moment.",
    internal_error: "The service hit an error. Try again in a moment.",
    account_suspended: "This account is suspended.",
    reseau_indisponible: "The service is unreachable. Check your connection.",
    reponse_invalide: "The service answered something unexpected. Try again in a moment.",
  },

  gabarits: {
    tableau: "Dashboard",
    liste: "Filterable list, then detail",
    formulaire: "Configuration form",
  },

  attente: {
    titre: "Section on the way",
    texte: "Batch 1 covers the dashboard, users, credits, settings and the audit log. This section comes next.",
    gabarit: "Template: {gabarit}",
  },
};
