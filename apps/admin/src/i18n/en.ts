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
    paiements: "Payments",
    credits: "To check",
    transactionsToutes: "All transactions",
    versementsManuels: "Manual deposits",
    canauxPaiement: "Channels and fees",
    transactionsStats: "Statistics",
    creditsSection: "Credits",
    transactionManuelle: "Manual transaction",
    acces: "Administrator access",
    parametres: "Parameters",
    fonctionnalites: "Features",
    modeles: "AI models",
    studio: "Portrait studio",
    atelier: "The workshop",
    essais: "The trials",
    studioService: "Live settings",
    gabarits: "Production templates",
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
        admin_invite: "Administrator invited",
        admin_role_update: "Administrator role changed",
        admin_revoke: "Administrator access revoked",
        ai_model_update: "AI model setting changed",
        prompt_template_create: "Production template created",
        prompt_template_activate: "Production template activated",
        support_request_update: "Support request state changed",
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
        user_export: "Accounts exported",
        payment_export: "Payments exported",
        credit_transaction_export: "Credit movements exported",
      },
    },
  },

  entrees: {
    titre: "Sign-ins",
    sous: "Successful entries and refused attempts. The IP address is recorded but not shown here: it serves investigations, not everyday reading.",
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
    sous: "What we call for each task, in what order, and what it costs at the provider.",
    col: { fournisseur: "Provider", modele: "Model", capacite: "Handles", etat: "State", emplois: "Where it serves", entree: "Input cost", sortie: "Output cost" },
    capacites: { texte: "Text", image: "Image" },
    etats: { actif: "In service", eteint: "Off", enPanne: "Briefly unreachable" },
    sansCout: "Not priced",
    sansEmploi: "In no chain",
    unite: "$ / M tokens",
    taches: {
      note_classification: "Note sorting",
      sensitive_detection: "Sensitive detection",
      message: "Message",
      gift_ideas: "Gift ideas",
      illustration: "Illustration",
      photo_style: "Photo style",
    } as Record<string, string>,
    eteindre: "Turn this model off",
    rallumer: "Put back in service",
    dialogueEteindre: {
      titre: "Turn off {modele}",
      consequence: "Work moves to the next model in every chain this one sits in. If it is the last one in service for a task, the server refuses.",
      motifs: [
        "The model fails too often",
        "Cost has grown too high",
        "Replaced by another provider",
      ],
    },
    dialogueRallumer: {
      titre: "Put {modele} back in service",
      consequence: "It returns at its rank, in every chain it sits in.",
      motifs: [
        "The provider incident is over",
        "Rolling back a trial",
      ],
    },
    chaines: {
      titre: "Try order, task by task",
      sous: "Rank 1 is called first. If it does not answer, we move down. The provider is repeated at every rank: three models from one host is a chain a single outage takes out whole.",
      vide: "No model set for this task: nothing will be produced.",
      promouvoir: "Move up one rank",
      declasser: "Move down one rank",
      dialogue: {
        titre: "Change the try order",
        consequence: "The order applies to the next run. Credits already committed are unaffected.",
        motifs: [
          "The primary costs too much",
          "The fallback gives better results",
          "The primary's provider is unstable",
        ],
      },
      avertissements: {
        courte: "This chain has only {rangs} rank(s) instead of {recommande}. Not an error: only two providers make images.",
        fournisseurRepete: "Several ranks share one provider: a single outage would take the whole chain, and the fallback would never happen.",
      },
    },
    manque: "Real spend and what it earned are not shown yet: paid runs are not linked to their consumption. This catalogue says what we try, in what order, and what it costs at the provider.",
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
      attendRemboursement: "Refund to pay",
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
    /** Stands in for a missing value — never an invented one. */
    inconnu: "—",
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
    adressePlaceholder: "you@lehno.io",
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

  studioAtelier: {
    titre: "The workshop",
    sous: "Set, try, keep — one gesture, repeated.",
    chaine: {
      titre: "The chain",
      ambiance: "Mood under test",
      profil: "Test profile",
      modele: "Model called",
      sansTarif: "Price unknown",
      enPanne: "Out of routing until {date}",
      enPanneAide: "The Workshop calls it anyway — this is where you find out.",
    },
    lu: {
      titre: "What the model reads",
      consigne: "Mood instruction",
      consigneAide: "This text goes to the model as written, in the mood's language.",
      nonEnregistre: "not saved",
    },
    interne: {
      titre: "What only the app reads",
      motifBande: "Band pattern",
      motifFond: "Pattern when there is no image",
      motifs: {
        trame_de_hampes: "Stem weave",
        registres: "Registers",
      },
    },
    ouvrage: {
      titre: "The work",
      vide: "Nothing produced yet. Run a trial to see what these settings give.",
      alt: "Portrait produced by the trial",
      echecPanne: "The model did not answer. Try again: the breakdown may be temporary.",
      echecDelai: "The model took too long. Try again, or pick a faster one.",
      echecRefus: "The model refused this request. It is not a breakdown: rework the instruction.",
      code: "Server code: {code}",
      sansRepli: "No fallback was tried: this model is the one that failed.",
      cout: "{cout} F",
      coutInconnu: "Cost unknown",
    },
    gestes: {
      essayer: "Preview",
      enCours: "Trial running…",
      garder: "Keep",
      ecarter: "Discard",
      publier: "Publish",
      avantEssai: "Keep and Discard open up after a trial.",
      publierSansEssai: "We do not put live what we have not seen: run a trial first.",
      publierDejaEnService: "These settings are already the ones running.",
      publierDepasse: "This version is superseded: you go back to it from the live settings.",
      gardeFait: "Draft kept.",
      ecarteFait: "Back to the last kept draft.",
      echec: "The server refused: {code}",
    },
    publier: {
      titre: "Put these settings live",
      consequence: "Portraits produced from now on will use this version. The previous one steps back, and stays available for a rollback.",
      motifs: [
        "New mood instruction, tried and conclusive",
        "Fixing a guardrail that did not hold",
        "Model change after comparison",
      ],
    },
    journal: {
      titre: "Today's trials",
      sous: "No trial is deleted: what cost a call is kept.",
      vide: "No trial today.",
      col: { quand: "At", modele: "Model", etat: "Outcome", cout: "Cost", parQui: "By" },
      etats: {
        success: "Succeeded",
        error: "Breakdown",
        timeout: "Timed out",
        refused: "Refused by the model",
      },
    },
    rappel: "Model prices are indicative. Spending is read in “Model usage”, after the fact.",
    sansDepart: {
      titre: "Nothing to compose yet",
      texte: "No draft and no live version. Starting settings are seeded in the database when the Studio is installed.",
    },
    sansProfil: {
      titre: "No test profile",
      texte: "A trial runs against a simulated person. There is none; create one before trying.",
    },
  },

  studioEssais: {
    titre: "The trials",
    sous: "What was produced, and what we thought of it.",
    pourquoi: "The Workshop only shows today. Here are the last hundred trials — enough to look again without paying for the call.",
    filtre: {
      ambiance: "Mood",
      toutesAmbiances: "All",
      sansAmbiance: "No mood",
      libelle: "Fate",
      tout: "All",
      kept: "Kept",
      discarded: "Set aside",
      publie: "Published",
      nonJuge: "Unjudged",
    },
    sorts: {
      kept: "Kept",
      discarded: "Set aside",
      publie: "Published",
      nonJuge: "Unjudged",
    },
    carte: {
      alt: "Trial result",
      echoue: "Nothing was produced: {code}",
      coutInconnu: "Cost unknown",
      cout: "{cout} F",
      par: "by {qui}",
    },
    vide: {
      titre: "No trial",
      texte: "Trials launched from the Workshop appear here, with what they produced.",
    },
    videFiltre: {
      titre: "No trial with that fate",
      texte: "Change the filter to see the others.",
    },
    rappel: "No trial is deleted: what cost a call is kept.",
  },

  studioService: {
    titre: "Live settings",
    sous: "What runs today, and who put it there.",
    lecture: "This screen cannot be edited. Settings are composed in the Workshop, and only go live once published.",
    enService: "Live",
    version: "Version {n}",
    depuis: "Published on {date}",
    par: "by {qui}",
    sansNote: "Published without a note.",
    tauxAbsent: "The regeneration rate is not measured yet: nothing counts it on the server.",
    contenu: {
      titre: "What this version sets",
      ambiances: "{n} moods",
      voies: "{n} image routes",
      illustration: "Illustration: {modele}",
      photo: "Photo style: {modele}",
    },
    historique: {
      titre: "Publications",
      sous: "Every go-live, with its author and its reason. This is this section's log.",
    },
    col: {
      version: "Version",
      quand: "Published on",
      parQui: "By",
      note: "What it changes",
      etat: "State",
    },
    etats: {
      published: "Live",
      superseded: "Retired",
      draft: "Draft",
    },
    revenir: "Put back live",
    dialogue: {
      titre: "Put version {n} back live",
      consequence: "The live version steps back, this one takes over. Nothing is rebuilt, and the change joins the log with its reason.",
      motifs: [
        "Output has degraded since it went live",
        "The live version does not hold its guardrails",
        "Rolling back after an inconclusive trial",
      ],
    },
    aucunePublication: {
      titre: "No publication yet",
      texte: "Every go-live is recorded here, with its author and its reason.",
    },
    premier: {
      titre: "Nothing is live yet",
      texte: "No version has been published. Settings are composed in the Workshop, tried out, then published.",
    },
  },

  studio: {
    titre: "Portrait studio",
    sous: "The production templates in service, and what came before them.",
    portee: "This entry shows the settings in service. Drafting and the test bench are not possible yet: the data model carries no draft, and no AI provider is wired.",
    col: {
      genre: "Production",
      cle: "Template",
      version: "In service",
      modele: "Model called",
      parQui: "Published by",
      corps: "Instruction",
    },
    genres: {
      message: "Message",
      illustration: "Illustration",
      photo_style: "Photo style",
      note_classification: "Note classification",
      sensitive_detection: "Sensitive case detection",
    },
    version: "Version {n}",
    aucune: "None",
    parPriorite: "By priority routing",
    parMigration: "Set at install",
    historique: "History of \u00ab {cle} \u00bb",
    revenir: "Put back in service",
    dialogue: {
      titre: "Put version {n} back in service",
      consequence: "The version in service steps aside and this one takes over. Nothing is rebuilt, and the change joins the audit log with its reason.",
      motifs: [
        "Output has degraded since publication",
        "The version in service does not hold its guardrails",
        "Rolling back after an inconclusive trial",
      ],
    },
    vide: {
      titre: "No templates",
      texte: "Production templates appear here as soon as a first version is published.",
    },
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

  arret: {
    titre: "Service pause",
    sous: "Suspends the whole service and announces a delay. Not to be confused with turning a feature off, which removes only one surface.",
    etats: {
      ouvert: "Service open",
      arrete: "Service paused",
    },
    jusqua: "Back at {heure}",
    sansHeure: "No return time announced",
    arreter: "Pause the service",
    prolonger: "Extend",
    rouvrir: "Reopen the service",
    duree: "Duration",
    durees: {
      m15: "15 minutes",
      m30: "30 minutes",
      h1: "1 hour",
      h2: "2 hours",
      inconnue: "Not known yet",
    },
    dialogueArreter: {
      titre: "Pause the service",
      consequence: "Every call will return a waiting response, sign-in included. The back-office stays reachable — that is how you reopen.",
      motifs: [
        "Database migration",
        "Release going out",
        "Incident being handled",
      ],
    },
    dialogueRouvrir: {
      titre: "Reopen the service",
      consequence: "Calls resume immediately. The announced return time is cleared.",
      motifs: [
        "Work finished",
        "Work postponed",
      ],
    },
  },

  transactionManuelle: {
    titre: "Manual transaction",
    sous: "Write a credit movement on an account. The gesture is logged with its author and reason.",
    compte: "The account",
    chercher: "Search for an account",
    chercherPlaceholder: "Username or address",
    aucunCompte: "No account matches",
    solde: "Balance",
    changer: "Change",
    nature: "What this is",
    natures: {
      gift: "Gift — credited",
      reward: "Reward — credited",
      correctionPlus: "Correction — credited",
      correctionMoins: "Credits taken back — debited",
    },
    sensCredit: "The account will receive {n} credits.",
    sensDebit: "The account will lose {n} credits.",
    montant: "How many",
    montantAide: "A whole number of credits, above zero.",
    ecrire: "Write the movement",
    annuler: "Cancel",
    dialogue: {
      titre: "Write this movement",
      consequence: "The balance changes immediately, and the client sees it. The audit log keeps the gesture, its author and its reason.",
      motifs: [
        "Goodwill gesture",
        "Fixing an error",
        "Compensation for an incident",
      ],
    },
    fait: "Movement written.",
  },

  transactionsStats: {
    titre: "Transaction statistics",
    sous: "What comes in, what it costs, what does not go through.",
    devise: "F",
    cartes: {
      aboutis: "Payments completed",
      aboutisRatio: "one in {n} fails",
      aucunEchec: "no failures",
      encaisse: "Collected",
      frais: "Fees taken",
      panier: "Median payment",
      sansPanier: "No payment completed",
    },
    graphe: {
      titre: "Collected and failed",
      encaisse: "Collected",
      echoue: "Failed",
      jour: "Day",
      vide: "No payment over this period.",
      periodeLabel: "The period",
      periodes: { "7j": "7 days", "30j": "30 days", "90j": "3 months" },
      typeLabel: "The direction",
      types: { tous: "In and out", depot: "In", retrait: "Out" },
      modeLabel: "The mode",
      modes: { tous: "Automatic and manual", auto: "Automatic", manuel: "Manual" },
      coupe: "{periode} · {sens} · {mode}",
    },
    parMoyen: "By payment method",
    noteMoyen: "A method that fails more than the others is a routing decision, not a fee one.",
    parPays: "Completion by country",
    notePays: "A country that fails more reveals misset fees or a badly chosen operator.",
    col: { groupe: "Group", tentatives: "Attempts", aboutis: "Completed", taux: "Rate" },
    vide: "No payment tied to a channel over this period.",
    moyens: { mobile_money: "Mobile money", card: "Card" },
  },

  metriques: {
    titre: "Metrics",
    sous: "Usage beyond the dashboard figures.",
    periode: "Period",
    periodes: { j7: "7 days", j30: "30 days", j90: "90 days", m12: "12 months" },
    retention: {
      titre: "Retention",
      sous: "What becomes of each month of arrivals. Always twelve months, whatever period is chosen: over a shorter window the thirty-day column could only show zeros, and those zeros would read as churn.",
      col: { mois: "Month joined", inscrits: "Joined", a7: "Back within 7 days", a30: "Back within 30 days" },
      vide: "No arrivals over the past twelve months.",
    },
    conversion: {
      titre: "Conversion",
      sous: "The share of an intake that ends up buying. Revenue itself is on the dashboard.",
      comptes: "Accounts joined",
      acheteurs: "Bought",
      delai: "Median time to first purchase",
      sansDelai: "No one has bought yet",
      jours: "{n} d",
      paliers: "Purchases by bundle",
      colPalier: "Bundle",
      colAchats: "Purchases",
      credits: "{n} credits",
      sansPalier: "No purchase tied to a bundle over this period.",
    },
    actionsPayantes: {
      titre: "Paid actions",
      sous: "What gets started, and how it ends. An action no one uses shows as zero: not seeing it and not having it would look too much alike.",
      col: {
        action: "Action", lancements: "Runs", reussies: "Succeeded",
        echouees: "Failed", enAttente: "Pending", echec: "Failure rate",
      },
      sansTaux: "—",
      vide: "No paid action declared.",
      codes: {
        gift_ideas: "Gift ideas",
        portrait: "A portrait",
        wish_message: "A message",
      },
    },
    consommation: {
      titre: "Consumption",
      credits: "Credits used",
      mouvements: "Movements",
    },
    manques: {
      titre: "What cannot be measured yet",
      sous: "Three of the five contents of this section have no source in this repository. They are named here rather than rendered as empty rows: an unexplained zero reads as a measurement.",
      usage_par_fonctionnalite: {
        quoi: "Usage by feature",
        bloque: "Tracking goes out to the analytics tool with nothing kept here.",
      },
      contributions: {
        quoi: "Contributions received and approved",
        bloque: "The public surfaces that produce them are not built.",
      },
    },
  },

  attente: {
    titre: "Section on the way",
    texte: "Batch 1 covers the dashboard, users, credits, settings and the audit log. This section comes next.",
    gabarit: "Template: {gabarit}",
  },
};
