export const fr = {
  errors: {
    validation_failed: "Cette demande n'est pas valide.",
    not_found: "Introuvable.",
    conflict: "Cette opération entre en conflit avec l'état actuel.",
    rate_limited: "Trop de tentatives. Réessayez dans un moment.",
    internal_error: "Quelque chose s'est mal passé de notre côté.",
    unauthorized: "Vous devez être connecté.",
    forbidden: "Vous n'avez pas accès à cela.",
    session_expired: "Votre session a expiré. Reconnectez-vous.",
    refresh_reused: "Votre session a été fermée par sécurité. Reconnectez-vous.",
    otp_invalid: "Ce code ne correspond pas.",
    otp_expired: "Ce code a expiré. Demandez-en un nouveau.",
    otp_too_many_attempts: "Trop d'essais. Demandez un nouveau code.",
    reason_required: "Ce geste demande un motif : il sera gardé au journal.",
    // Le studio : on ne publie que ce qu'on a vu tourner. Le message dit le
    // geste qui manque, pas seulement le refus — un bouton grisé sans
    // explication se lit comme une panne.
    trial_required: "Prévisualisez d'abord ce réglage : rien ne part en service sans avoir tourné une fois.",
    // Un palier retiré, un canal fermé, un compte de collecte désactivé : la
    // demande est bien formée, c'est ce qu'elle vise qui ne se propose plus.
    resource_inactive: "Ce choix n'est plus proposé. Rechargez la page pour voir ce qui reste disponible.",
    insufficient_credits: "Il n'y a pas assez de crédits pour ce geste.",
    otp_rate_limited: "Vous avez demandé plusieurs codes. Patientez un instant.",
    username_taken: "Ce pseudo est déjà pris.",
    username_invalid: "Ce pseudo ne convient pas.",
    device_limit_reached: "Trop de comptes créés depuis cet appareil.",
    account_suspended: "Ce compte est suspendu.",
    account_pending_deletion: "Ce compte est en cours de suppression.",
    federated_token_invalid: "La connexion avec ce service n'a pas abouti.",
    federated_already_linked: "Ce compte est déjà rattaché ailleurs.",
    email_disposable: "Cette adresse est temporaire. Indiquez-en une que vous consultez.",
    waitlist_email_invalid: "Cette adresse ne semble pas valide.",
    waitlist_rejected: "Cet envoi n'a pas abouti. Réessayez dans un instant.",
    contact_invalid: "Ce formulaire n'est pas valide. Vérifiez les champs et réessayez.",
    contact_rejected: "Cet envoi n'a pas abouti. Réessayez dans un instant.",
    // On DIT que le lien a existé : « page introuvable » ferait croire au
    // visiteur qu'il a mal recopié une adresse qu'on lui a pourtant envoyée.
    link_revoked: "Ce lien n'est plus actif.",
    wish_window_closed: "Les vœux ne sont pas ouverts en ce moment.",
    // Même formule que les deux autres refus de robot : elle ne dit pas
    // lequel des filtres a mordu.
    collect_rejected: "Cet envoi n'a pas abouti. Réessayez dans un instant.",
    maintenance: "Lehno est momentanément fermé pour une intervention. Réessayez dans un instant.",
    // Pas « une erreur est survenue » : rien n'a échoué de notre côté, et le
    // dire enverrait chercher une faute qu'on n'a pas commise. §4.5 : ce qui
    // s'est passé, ce qu'on a fait, ce qu'on peut faire maintenant.
    generation_unavailable: "Le modèle ne répond pas pour l'instant. Vos crédits n'ont pas été débités — réessayez dans quelques minutes.",
  },
} as const;
