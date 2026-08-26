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
    moderation: "Moderation",
    suppressions: "Deletion requests",
    assistance: "Support",
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
    // Voir fr.ts : the file downloads now, no email queue exists.
    telecharge: "The file is ready: it has just been downloaded.",
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

  // Voir fr.ts : `journal` est la section, `audit` l'historique d'un compte.
  journal: {
    titre: "Audit log",
    sous: "What the team did, and why. Nothing here can be changed or removed.",
    col: { date: "When", acteur: "Who", action: "What", motif: "Why", cible: "On what" },
    sansMotif: "User's own action",
    acteurs: { admin: "Administration", user: "User" },
    vide: {
      titre: "No entries in this period",
      texte: "Every administrative action lands here, with its author, target and reason.",
    },
    filtres: {
      action: "Kind of action",
      periode: "Period",
      toutes: "All",
      touteLaPeriode: "All time",
      actions: {
        user_status_update: "Account state change",
        parameter_update: "Parameter change",
        feature_flag_update: "Feature toggle",
        credit_bundle_update: "Bundle change",
        payment_channel_create: "Channel opened",
        payment_channel_update: "Fee change",
        collection_account_create: "Collection account opened",
        collection_account_update: "Collection account change",
        payment_manual_create: "Payment entered",
        payment_decision: "Payment decision",
        credit_adjustment: "Balance adjustment",
        audit_log_export: "Audit log export",
        login_activity_export: "Sign-ins export",
      },
    },
  },

  entrees: {
    titre: "Sign-ins",
    sous: "Successful entries and refused attempts. No IP address: it never reaches the database.",
    col: { date: "When", compte: "Account", adresse: "Address tried", resultat: "Result", appareil: "Device", lieu: "Approximate location" },
    resultats: { success: "Signed in", failure: "Refused" },
    inconnu: "—",
    filtres: {
      resultat: "Result",
      periode: "Period",
      tous: "All",
      touteLaPeriode: "All time",
    },
    vide: {
      titre: "No attempts in this period",
      texte: "Every entry, successful or not, lands here with its device and approximate location.",
    },
  },

  modeles: {
    titre: "AI models",
    sous: "The order we try them in, and what each one costs at the provider.",
    col: { rang: "Try order", fournisseur: "Provider", modele: "Model", etat: "State", entree: "Input cost", sortie: "Output cost" },
    etats: { actif: "In service", eteint: "Off" },
    sansCout: "Not priced",
    unite: "$ / M tokens",
    eteindre: "Turn this model off",
    rallumer: "Put back in service",
    dialogueEteindre: {
      titre: "Turn off {modele}",
      consequence: "Work will move to the next model in the try order. If this is the last one in service, the server will refuse.",
      motifs: [
        "The model fails too often",
        "Cost has grown too high",
        "Replaced by another provider",
      ],
    },
    dialogueRallumer: {
      titre: "Put {modele} back in service",
      consequence: "It returns to the try order, at its rank.",
      motifs: [
        "The provider incident is over",
        "Rolling back a trial",
      ],
    },
    manque: "Real spend and what it earned are not shown yet: usage records do not exist in the database. This catalogue says what we try, and in what order.",
  },

  drapeaux: {
    titre: "Features",
    sous: "What ships, and what waits. The core is not listed: it cannot be turned off.",
    col: { cle: "Key", gouverne: "What it governs", portee: "Where", couverture: "What it covers", etat: "State", parQui: "Last change" },
    etats: {
      actif: "In service",
      eteint: "Off",
      inerte: "On, no effect",
    },
    portees: { app: "App", public: "Public" },
    requiert: "Needs: {cles}",
    emporte: "Turning off also takes down",
    jamais: "Never changed",
    allumer: "Turn on",
    eteindre: "Turn off",
    dialogueEteindre: {
      titre: "Turn off {cle}",
      consequence: "The listed screens and entry points stop answering. Anything depending on them goes down too.",
      motifs: [
        "Incident under way on this feature",
        "Not ready for the public yet",
        "Too costly for now",
      ],
    },
    dialogueAllumer: {
      titre: "Turn on {cle}",
      consequence: "The listed screens and entry points start answering. If a prerequisite is off, nothing changes until it is on.",
      motifs: [
        "Opening to the public",
        "The incident is over",
        "Short trial",
      ],
    },
  },

  // Voir fr.ts : trois faces d'une même section.
  credits: {
    titre: "Credits and payments",
    sous: "What came in, what it produced, and the settings that decide both.",
    onglets: { paiements: "Payments", mouvements: "Movements", reglages: "Settings" },

    paiements: {
      col: {
        utilisateur: "Account", mode: "Route", etat: "State", montant: "Amount",
        methode: "Method", attendu: "Expected", recu: "Received", ecart: "Gap", quand: "Entered",
      },
      modes: { provider: "Provider", semi_manual: "Semi-manual", manual: "Manual" },
      etats: {
        pending: "Pending", succeeded: "Confirmed", failed: "Refused",
        expired: "Expired", refunded: "Refunded",
      },
      filtreEtat: "State", filtreMode: "Route", tous: "All",
      nonConstate: "—",
      vide: {
        titre: "No payments in this period",
        texte: "Entered transfers and those received by the app appear here, with their outcome.",
      },
    },

    mouvements: {
      col: { utilisateur: "Account", type: "Type", source: "Origin", montant: "Credits", quand: "On" },
      types: { grant: "Grant", purchase: "Purchase", consumption: "Use", adjustment: "Adjustment" },
      sources: {
        signup_grant: "Sign-up", referral_bonus: "Referral", purchase: "Purchase",
        manual_topup: "Manual transfer", promo_code: "Promo code", gift: "Gift",
        reward: "Reward", consumption: "Use", refund: "Refund",
        correction: "Correction",
      },
      vide: {
        titre: "No movements in this period",
        texte: "Every grant, purchase, use and adjustment lands here.",
      },
    },

    detail: {
      titre: "Payment",
      groupes: { operation: "The operation", montants: "The amounts", histoire: "Its history" },
      champs: {
        reference: "Reference", compte: "Collection account", frais: "Fee",
        montant: "Bundle price", attendu: "Expected on the account", recu: "Observed",
        ecart: "Gap", motifEchec: "Reason for refusal", credits: "Credits",
      },
      histoire: { etat: "State", debut: "Since", duree: "Duration", origine: "Triggered by", parQui: "By", motif: "Reason" },
      origines: {
        user: "The user", webhook: "The provider", polling: "A status check",
        admin: "Administration", system: "A scheduled job",
      },
      enCours: "Ongoing",
      retour: "Back to payments",
    },

    decision: {
      confirmer: "Confirm receipt",
      rejeter: "Refuse",
      avertissement: "The receipt proves nothing — a forgery is easy. Check the money arrived on the operator account before confirming.",
      montantRecu: "Amount observed on the account",
      montantAide: "Fill this in even with no gap: it is what lets you establish there isn't one.",
      reference: "Transaction reference",
      dialogueConfirmer: {
        titre: "Confirm this transfer",
        consequence: "Credits are granted to the account, once. The client is notified.",
        motifs: ["Receipt confirmed on the account", "Transfer found after searching"],
      },
      dialogueRejeter: {
        titre: "Refuse this transfer",
        consequence: "No credits are granted. The reason will show on the payment.",
        motifs: ["Nothing arrived on the account", "Amount too low", "Receipt not acceptable"],
      },
    },

    // Voir fr.ts : no free amount field — the bundle decides.
    saisie: {
      ouvrir: "Enter a transfer",
      titre: "Enter a received transfer",
      sous: "The transfer already happened. Record it here, then confirm once you have checked it arrived.",
      champs: {
        compteClient: "Account to credit",
        palier: "Bundle bought",
        canal: "Channel used",
        compte: "Account that received",
        numeroPayeur: "Payer's number",
        reference: "Transaction reference",
      },
      apercu: {
        titre: "What the client sends, and what should arrive",
        aVerser: "The client sends",
        attendu: "We should see",
        credits: "Credits granted on confirmation",
      },
      choisir: "Choose…",
      enregistrer: "Record the transfer",
      annuler: "Cancel",
      enregistre: "Transfer recorded, awaiting confirmation.",
      motifs: [
        "Transfer seen on the account",
        "Top-up requested by phone",
        "Settling an older transfer",
      ],
      dialogue: {
        titre: "Record this transfer",
        consequence: "The payment starts pending. No credits are granted until receipt is confirmed.",
      },
    },

    reglages: {
      paliers: {
        titre: "Purchase bundles",
        sous: "What we offer. No free amounts: the smallest bundle sets the minimum.",
        col: { montant: "Price", credits: "Credits", remise: "Bonus", position: "Order", etat: "State" },
      },
      canaux: {
        titre: "Channels and fees",
        sous: "What the service offers, and what the operator takes. A channel is never deleted, only switched off.",
        col: { libelle: "Channel", pays: "Country", frais: "Fee", portes: "Borne by", etat: "State" },
        portes: { payer: "The client", payee: "The service" },
      },
      comptes: {
        titre: "Collection accounts",
        sous: "The accounts clients transfer to.",
        col: { libelle: "Account", operateur: "Operator", numero: "Number", visible: "In the app", etat: "State" },
        visible: "Offered", masque: "Hidden",
      },
      actif: "In service",
      inactif: "Withdrawn",
      aucuneRemise: "—",
    },
  },

  // Voir fr.ts : managing administrator access is admin-only (ux-admin §6).
  acces: {
    titre: "Administrator access",
    sous: "Who gets into this tool, and with what rights. Access is withdrawn, never erased.",
    col: { email: "Address", nom: "Name", role: "Role", etat: "State", depuis: "Since" },
    roles: { admin: "Administrator", support: "Support" },
    etats: { actif: "In service", revoque: "Access withdrawn" },
    sansNom: "—",
    soiMeme: "You",
    vide: {
      titre: "No other account",
      texte: "Operations accounts appear here, with their role and when they joined.",
    },
    gestes: {
      promouvoir: "Make administrator",
      retrograder: "Make support",
      revoquer: "Withdraw access",
    },
    inviter: {
      ouvrir: "Invite someone",
      titre: "Invite an operations account",
      sous: "The account is created ahead of time: an unknown address never receives a code.",
      email: "Email address",
      role: "Role",
      confirmer: "Invite",
      annuler: "Cancel",
      motifs: [
        "Joining the team",
        "Temporary support cover",
        "Replacing a leaver",
      ],
      dialogue: {
        titre: "Invite this account",
        consequence: "The account can sign in from its first code request. The log keeps who invited it.",
      },
    },
    dialogueRole: {
      titre: "Change {compte}'s role",
      consequence: "The administrator role opens the Economy family and the audit log. It takes effect on the next action.",
      motifs: [
        "Change of responsibility",
        "Needs access to economy levers",
        "Back to a support scope",
      ],
    },
    dialogueRevocation: {
      titre: "Withdraw {compte}'s access",
      consequence: "Open sessions close immediately. The account is deactivated, never erased: the log must still be able to name who did what.",
      motifs: [
        "Left the team",
        "Account compromised",
        "End of a temporary assignment",
      ],
    },
  },

  // Voir fr.ts : three registers to read, one queue to settle.
  assistance: {
    titre: "Support",
    sous: "What people write to us, and what awaits an answer.",
    onglets: { demandes: "Requests", contact: "Messages", attente: "Waitlist", retours: "Feedback" },

    demandes: {
      col: { utilisateur: "Account", sujet: "Subject", corps: "Request", version: "Version", etat: "State", quand: "Received" },
      etats: { open: "Open", answered: "Answered", closed: "Closed" },
      filtreEtat: "State",
      tous: "All",
      sansSujet: "—",
      gestes: { repondre: "Mark answered", clore: "Close", rouvrir: "Reopen" },
      dialogue: {
        titre: "Change this request's state",
        consequence: "The change lands in the audit log, with its reason.",
        motifs: [
          "Answer sent by email",
          "Already handled elsewhere",
          "No follow-up after a reminder",
        ],
      },
      vide: {
        titre: "No requests waiting",
        texte: "Requests sent from the app appear here, oldest first.",
      },
    },

    contact: {
      col: { nom: "Name", email: "Address", sujet: "Subject", message: "Message", quand: "Received" },
      sujets: {
        question: "A question",
        probleme: "A problem",
        suggestion: "A suggestion",
        partenariat: "A partnership",
        presse: "Press",
        autre: "Something else",
      },
      vide: {
        titre: "No messages",
        texte: "Messages from the public form appear here, most recent first.",
      },
    },

    attente: {
      col: { email: "Address", source: "Came from", langue: "Language", quand: "Signed up" },
      sansSource: "—",
      vide: {
        titre: "Nobody on the list",
        texte: "Addresses left before launch appear here.",
      },
    },

    retours: {
      col: { utilisateur: "Account", note: "Rating", corps: "Feedback", version: "Version", quand: "Left on" },
      anonyme: "Account removed",
      sansNote: "—",
      vide: {
        titre: "No feedback",
        texte: "Feedback left from the app appears here.",
      },
    },
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
    // Voir fr.ts : le serveur transporte des clés, l'outil porte les phrases.
    cles: {
      reminder_lead_days_default: { libelle: "Reminder lead time", aide: "How many days before the date the reminder goes out, by default.", unite: "days" },
      wish_window_lead_days: { libelle: "Wish window opens", aide: "How many days before the date the link accepts wishes.", unite: "days" },
      wish_window_trail_days: { libelle: "Wish window closes", aide: "How many days after the date the link stays open.", unite: "days" },
      max_accounts_per_device: { libelle: "Accounts per device", aide: "Beyond this, sign-up is refused from that device.", unite: null },
      account_grace_period_days: { libelle: "Grace period", aide: "The time left before an account is erased for good.", unite: "days" },
      signup_free_credits: { libelle: "Credits given at sign-up", aide: "What a new account gets to try things out.", unite: "credits" },
      credit_unit_price: { libelle: "Credit price", aide: "The unit price, in CFA francs.", unite: "FCFA" },
    },
    motif: {
      titre: "Save these settings",
      question: "Why this change?",
      consequence: "These values drive the product and take effect right away. The log keeps the reason, your name and the time.",
      motifs: [
        "Pricing adjustment",
        "Correcting a wrong value",
        "Launch decision",
      ],
    },
    nonReglable: "These types come from the code: their state cannot be set here. They are shown so you know which ones exist.",
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
    // Voir fr.ts : the request is fine, what it points at is no longer offered.
    resource_inactive: "That option is no longer offered. Reload to see what remains.",
    insufficient_credits: "There aren't enough credits for that.",
    rate_limited: "Too many requests. Wait a moment.",
    internal_error: "The service hit an error. Try again in a moment.",
    account_suspended: "This account is suspended.",
    reseau_indisponible: "The service is unreachable. Check your connection.",
    reponse_invalide: "The service answered something unexpected. Try again in a moment.",
  },

  liens: {
    titre: "External links",
    sous: "Consoles for the platforms Lehno relies on, gathered here rather than looked up elsewhere.",
    groupes: {
      mesure: "Analytics and monitoring",
      messages: "Message delivery",
      identite: "Identity and sign-in",
      code: "Code and releases",
    },
    usages: {
      posthog: "Usage analytics: what people do in the app, and what they don't.",
      resend: "Transactional email delivery — sign-in codes, confirmations, notices.",
      google: "Google sign-in credentials, and their validity.",
      apple: "Apple sign-in credentials, and the app's certificates.",
      github: "The repository, reviews and releases.",
    },
    ouvrir: "Opens {nom} in a new tab",
    horsOutil: "Each platform keeps its own authentication: these links grant no access by themselves.",
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
