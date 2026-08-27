import { z } from "zod";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  waitlistJoinSchema,
  waitlistJoinResponseSchema,
  contactSendSchema,
  contactSendResponseSchema,
  publicConfigSchema,
  LEGAL_DOCUMENTS,
  LEGAL_LANGUAGES,
} from "./public.js";
import {
  requestOtpSchema,
  verifyOtpSchema,
  federatedSchema,
  refreshSchema,
  sessionSchema,
  verifyOutcomeSchema,
  registerSchema,
  registeredSchema,
} from "./auth.js";
import { profileSchema, updateProfileSchema, usernameSchema } from "./profile.js";
import { errorEnvelopeSchema } from "./errors.js";
import {
  personSchema, createPersonSchema, updatePersonSchema, personListSchema, listPersonsQuerySchema,
  noteSchema, createNoteSchema, createNotesSchema, personAttributesSchema,
} from "./me.js";
import {
  eventSchema, createEventSchema, updateEventSchema,
  occurrenceSchema, listOccurrencesQuerySchema, listEventsQuerySchema,
} from "./me-events.js";
import { homeSchema } from "./me-home.js";
import { featuresResponseSchema, DRAPEAUX, CLES_DRAPEAUX, type CleDrapeau } from "./flags.js";
import { maintenanceStatusSchema } from "./maintenance.js";
import { creditBalanceSchema, referralSummarySchema, invitationSchema } from "./me-credits.js";
import { metadataSchema } from "./me-app.js";
import { notificationPreferencesSchema, updateNotificationPreferencesSchema } from "./me-notifications.js";
import { sessionsListSchema, identitiesListSchema } from "./me-security.js";

// Le contrat se CALCULE depuis les schémas Zod, il ne se recopie pas. Une
// seconde déclaration des mêmes formes — en DTO décoré, par exemple — dériverait
// de la première dès la première correction.
const schema = (s: ZodTypeAny): object => zodToJsonSchema(s, { target: "openApi3" });

// Deux formes de réponse n'ont pas de foyer dans un contrat de domaine : elles
// ne décrivent ni la liste d'attente, ni le contact, ni un profil, seulement
// l'accusé d'un point d'entrée d'authentification ou de disponibilité. Elles
// sont définies une fois, ici, plutôt que recopiées à chaque chemin qui les sert.
/* L'accusé d'une demande de code, et le délai avant la suivante.
 *
 * Ce délai est CROISSANT — cinq secondes, puis vingt-cinq, puis cent
 * vingt-cinq — et il vient donc du serveur. Le client l'affiche en compte à
 * rebours ; s'il codait la formule de son côté, deux versions du parc
 * appliqueraient deux règles différentes, celle du serveur restant la seule
 * qui compte. Un refus porte le même champ dans ses détails. */
const sentResponseSchema = z
  .object({ sent: z.literal(true), retryAfterSeconds: z.number().int().positive() })
  .strict();
const usernameAvailableResponseSchema = z.object({ available: z.boolean() }).strict();

/* La couverture des drapeaux, ENGENDRÉE depuis le registre.
 *
 * Recopier ce tableau à la main le condamnerait : un drapeau ajouté ou un
 * chemin déplacé, et la documentation dirait au client de masquer un écran qui
 * n'existe plus, ou de laisser paraître un écran que le serveur ferme. Le
 * registre est la référence commune des deux équipes (§6.1) ; le contrat le
 * rend, il ne le redit pas. */
/* Les chemins que le garde d'arrêt laisse passer — mêmes préfixes que
 * apps/api/src/maintenance/maintenance.guard.ts. Deux listes, et c'est le
 * défaut connu de ce montage : le contrat vit dans un paquet que le serveur
 * importe, jamais l'inverse. Un test d'API constate la correspondance sur les
 * deux chemins qui comptent, plutôt que de la supposer. */
const CHEMINS_SANS_ARRET = ["/admin", "/public/maintenance"];

function exemptDArret(chemin: string): boolean {
  return CHEMINS_SANS_ARRET.some((o) => chemin === o || chemin.startsWith(`${o}/`));
}

function couvertureDesDrapeaux(): string {
  const cellule = (v: readonly string[]): string => (v.length === 0 ? "—" : v.map((x) => `\`${x}\``).join(", "));
  const lignes = CLES_DRAPEAUX.map((cle: CleDrapeau) => {
    const d = DRAPEAUX[cle];
    return `| \`${cle}\` | ${d.gouverne} | ${d.portee.join(", ")} | ${cellule(d.requiert)} | ${cellule(d.ecrans)} | ${cellule(d.chemins)} |`;
  });
  return [
    "| Clé | Ce qu'elle gouverne | Portée | Requiert | Écrans | Chemins |",
    "|---|---|---|---|---|---|",
    ...lignes,
  ].join("\n");
}

type Chemin = {
  chemin: string;
  methode: "get" | "post" | "patch" | "delete";
  resume: string;
  // Ce qu'un intégrateur ne peut PAS déduire des schémas : une règle de
  // séquence, une contrainte que le serveur applique sans que la forme la
  // dise, un piège.
  //
  // Ces notes vivaient en commentaires du code — invisibles pour l'équipe
  // mobile, qui ne lit que le contrat publié. Un commentaire que seul son
  // auteur voit ne documente rien.
  note?: string;
  authentifie?: boolean;
  // Paramètres de chemin ou de requête, chacun tiré d'un schéma déjà exporté
  // — jamais retapé en une forme parallèle qui pourrait diverger.
  parametres?: { nom: string; dans: "path" | "query"; schema: ZodTypeAny; requis?: boolean }[];
  corps?: ZodTypeAny;
  reponse?: ZodTypeAny;
  // Type de contenu de la réponse de succès : JSON par défaut. Le seul
  // chemin qui rend un document plutôt qu'une forme validée (les documents
  // légaux, servis en Markdown) le déclare ici.
  typeContenuReponse?: string;
  // 204 : pas de corps de réponse à décrire (voir DELETE /auth/session).
  sansContenu?: boolean;
  statut?: number;
};

// Une entrée par chemin servi. Les tâches suivantes ajoutent les leurs ici, et
// le test de péremption refuse un contrat qui ne les décrit pas.
//
// Recensés depuis apps/api/src/app.module.ts (liste `controllers`), pas
// recopiés d'une mémoire du plan : un contrat qui tait un chemin réellement
// câblé ment autant qu'un contrat périmé.
const CHEMINS: Chemin[] = [
  // ——— public/* (apps/api/src/public) ———————————————————————————
  {
    chemin: "/public/waitlist",
    methode: "post",
    resume: "S'inscrire à la liste d'attente",
    corps: waitlistJoinSchema,
    reponse: waitlistJoinResponseSchema,
  },
  {
    chemin: "/public/contact",
    methode: "post",
    resume: "Écrire à l'équipe",
    corps: contactSendSchema,
    reponse: contactSendResponseSchema,
  },
  {
    chemin: "/public/config",
    methode: "get",
    resume: "Lire la configuration publique (prix, crédits offerts, devise)",
    reponse: publicConfigSchema,
  },
  {
    chemin: "/public/maintenance",
    methode: "get",
    resume: "Savoir si l'API est arrêtée pour intervention, et pour combien de temps",
    note: [
      "### L'arrêt n'est PAS un drapeau de fonctionnalité",
      "",
      "Un drapeau éteint rend `404` — « cette surface n'existe pas » — et le",
      "client masque l'écran. Un arrêt rend **`503`**, code `maintenance`, avec",
      "`details.retryAfterSeconds` : la ressource existe et revient. Le client",
      "montre un écran d'attente et réessaie ; **il ne masque rien, il ne",
      "déconnecte personne, il ne vide aucun cache local.**",
      "",
      "### Où il s'applique",
      "",
      "Sur TOUS les chemins, sauf deux : `/admin*`, par où l'équipe rouvre, et",
      "celui-ci, qui reste joignable pendant l'arrêt — c'est ce qui permet de",
      "savoir quand revenir sans marteler un chemin fermé.",
      "",
      "### Ce que le client doit faire",
      "",
      "**Un arrêt commence au milieu d'une session.** Il n'y a rien à lire au",
      "démarrage : le `503` arrive sur n'importe quel appel, à n'importe quel",
      "moment. C'est lui le signal.",
      "",
      "**Deux valeurs, et elles ne disent pas la même chose.**",
      "",
      "- `retryAfterSeconds` — le **rythme de réessai**, toujours présent",
      "  pendant un arrêt. Attendre CE délai, pas un délai à soi : il vient du",
      "  serveur pour que tout le parc applique la même règle, et pour qu'on",
      "  puisse l'allonger si l'intervention dure.",
      "- `until` — l'**heure de retour annoncée**, en ISO 8601 UTC, **nulle**",
      "  quand on ne la connaît pas. Ne jamais la déduire du rythme : quinze",
      "  minutes entre deux essais ne veut pas dire que le service revient dans",
      "  quinze minutes. Nulle, l'écran dit seulement qu'une intervention est en",
      "  cours — pas de « bientôt », pas d'estimation inventée.",
      "",
      "Les deux voyagent AUSSI dans les détails du `503`, pour qu'un client",
      "refusé sache quoi afficher sans faire un second appel.",
      "",
      "**Puis interroger ce chemin** plutôt que de réessayer l'appel d'origine :",
      "`maintenance: false` dit que c'est fini.",
    ].join("\n"),
    reponse: maintenanceStatusSchema,
  },
  {
    // Ce qui est ACTIF pour un visiteur sans compte, dépendances déjà
    // résolues — jamais l'état brut des drapeaux (spécification §6.2). Une
    // liste, pas un dictionnaire : « éteint » et « inconnu » se confondent
    // côté client, à dessein.
    chemin: "/public/features",
    methode: "get",
    resume: "Lister les fonctionnalités actives sur les surfaces sans compte",
    note: [
      "Les surfaces SANS COMPTE uniquement : page publique du Mur, liste",
      "partagée, dépôt de vœux, page d'invitation, landing. Un client qui n'a",
      "pas encore de session lit celle-ci ; dès qu'il en a une, il lit",
      "`/me/features`, qui la remplace — jamais les deux à la fois.",
      "",
      "Mêmes règles de lecture que `/me/features` : voir sa description.",
    ].join("\n"),
    reponse: featuresResponseSchema,
  },
  {
    chemin: "/me/features",
    methode: "get",
    resume: "Lister les fonctionnalités actives pour le demandeur",
    authentifie: true,
    note: [
      "### Ce que le client doit faire de cette liste",
      "",
      "**Elle porte ce qui est ACTIF, dépendances déjà résolues.** Jamais",
      "l'état brut des drapeaux. Le jour où l'activation deviendra sélective —",
      "par compte, par pays, par version —, rien ne changera côté client.",
      "",
      "**Ce qui n'y figure pas est éteint.** Une clé absente et une clé inconnue",
      "se traitent pareil : éteinte. C'est ce qui permet de livrer un drapeau",
      "nouveau sans attendre que tout le parc se mette à jour.",
      "",
      "**Le client ne décide de rien.** Aucune règle de dépendance ne se code",
      "côté client : le serveur les a déjà appliquées. Un client qui déduirait",
      "lui-même « `wall` est là, donc `wishes` aussi » se tromperait le jour où",
      "une des deux s'éteint seule.",
      "",
      "**Quand lire.** Au démarrage, et après chaque connexion ou changement de",
      "compte. La liste n'est pas immuable : un drapeau peut s'éteindre pendant",
      "qu'une session est ouverte.",
      "",
      "**Ce que fait un chemin gouverné par un drapeau éteint.** Il rend `404`,",
      "jamais `403` — un `403` confirmerait que la fonctionnalité existe. Le",
      "client qui reçoit `404` sur un chemin qu'il croyait ouvert relit cette",
      "liste plutôt que d'afficher une erreur : c'est le signe que le drapeau a",
      "changé sous lui.",
      "",
      "### Deux drapeaux qui ne ferment pas un écran",
      "",
      "`events.other` gouverne une **valeur**, non un chemin : `kind: \"other\"`",
      "sur `/me/events`, que les anniversaires empruntent aussi. Il rend donc",
      "**`422`** (`resource_inactive`) et non `404` — le chemin existe, il n'y a",
      "rien à cacher. Le client n'a rien à en savoir : `/me/metadata` filtre",
      "`eventKinds`, et l'écran propose ce que la liste contient.",
      "",
      "Il garde la **création**, jamais l'existant : un événement libre créé",
      "avant l'extinction reste lisible, modifiable, et ses échéances tombent.",
      "",
      "`topup.provider` gouverne le seul **canal automatique**. `credits` dit",
      "que les crédits existent et s'achètent par paliers ; les deux canaux",
      "—`topup.manual` et `topup.provider` — en dépendent, parce qu'ils",
      "achètent les mêmes paliers. Un lancement en versement manuel seul",
      "s'écrit donc : `credits` allumé, `topup.manual` allumé,",
      "`topup.provider` éteint.",
      "",
      "### Livrer une version sans une fonctionnalité",
      "",
      "C'est le cas prévu : le socle — proches, notes, dates, occasions,",
      "rappels, compte — N'A PAS de drapeau et ne s'éteint pas. Tout le reste",
      "peut manquer d'une livraison à l'autre.",
      "",
      "Exemple, une version sans les listes de souhaits : `wishlist` et",
      "`wishlist.own` restent éteints. Le client masque les écrans de leur",
      "ligne du tableau ci-dessous, et n'appelle pas leurs chemins.",
      "",
      "**Le piège de ce cas précis** : `reservation` requiert `wishlist.own`.",
      "Elle disparaîtra donc de la liste, même si son propre interrupteur est",
      "allumé — la résolution se fait côté serveur. Le client n'a rien à en",
      "déduire : il ne la voit pas, il la masque, un point c'est tout.",
      "",
      "**Le piège inverse, à ne pas reproduire** : `credits` éteint n'éteint",
      "PAS les générations. Elles restent disponibles et gratuites si leur",
      "propre drapeau est allumé. Fermer le paiement ne doit pas fermer le",
      "produit.",
      "",
      "### La couverture de chaque drapeau",
      "",
      "Ce que le client masque et ce que le serveur ferme doivent désigner la",
      "même chose. Ce tableau est la référence commune, engendrée depuis le",
      "registre du serveur.",
      "",
      couvertureDesDrapeaux(),
    ].join("\n"),
    reponse: featuresResponseSchema,
  },
  {
    chemin: "/me/credits",
    methode: "get",
    resume: "Lire son solde de crédits et ses derniers mouvements",
    note: [
      "Le solde est la SOMME des mouvements, calculée à chaque appel. Aucune",
      "colonne de solde n'existe : le client ne refait pas ce calcul, sous",
      "peine de deux vérités qui divergent dès qu'un mouvement arrive hors de",
      "la page.",
      "",
      "Chaque mouvement porte `source`, un CODE STABLE que le client traduit —",
      "`signup_grant`, `referral_bonus`, `purchase`… Le champ `reason` est une",
      "note libre d'exploitation, en français, jamais destinée à l'affichage.",
      "",
      "`type` ne suffit pas à distinguer : un `grant` d'inscription et un",
      "`grant` de parrainage se ressemblent, et ce sont deux gestes distincts",
      "dont l'un se mérite.",
    ].join("\n"),
    authentifie: true,
    reponse: creditBalanceSchema,
  },
  {
    chemin: "/me/referral",
    methode: "get",
    resume: "Lire son code de parrainage, ses filleuls et ses gains",
    authentifie: true,
        note: [
      "`bonusParInvitation` dit ce que le parrainage rapporte **aujourd'hui**,",
      "ou **rien** — il est nul quand les crédits sont éteints.",
      "",
      "**Lisez cette valeur, pas les drapeaux.** `referral` ne dépend pas de",
      "`credits` : l'éteindre tuerait l'acquisition avec la monétisation, ce",
      "que §6.4 interdit. Mais dans cet état les crédits n'achètent rien et les",
      "générations sont gratuites — annoncer « cinq crédits » y serait faux.",
      "",
      "**Nul n'est pas zéro.** Nul, l'écran présente le parrainage sans",
      "promesse chiffrée ; il n'annonce pas « zéro crédit ».",
    ].join("\n"),
    reponse: referralSummarySchema,
  },
  {
    // Ouverte sans compte : c'est la page qu'ouvre un lien d'invitation.
    chemin: "/public/invitations/{code}",
    methode: "get",
    resume: "Lire une invitation : qui invite, et ce que l'invité y gagne",
    note: [
      "Ouverte SANS compte. Sert aussi à valider un code de parrainage à la",
      "saisie, avant de le soumettre à /auth/register : un code inconnu rend",
      "404.",
      "",
      "Ne porte que le pseudo de celui qui invite. Un code d'invitation",
      "circule par message et par réseau, et tout ce qu'on met ici circule",
      "avec lui.",
    ].join("\n"),
    parametres: [{ nom: "code", dans: "path", schema: z.string().max(16), requis: true }],
    reponse: invitationSchema,
  },
  {
    chemin: "/public/legal/{document}",
    methode: "get",
    resume: "Lire un document légal (CGU, confidentialité, mentions)",
    parametres: [
      { nom: "document", dans: "path", schema: z.enum(LEGAL_DOCUMENTS), requis: true },
      { nom: "lang", dans: "query", schema: z.enum(LEGAL_LANGUAGES), requis: false },
    ],
    typeContenuReponse: "text/markdown",
  },
  // ——— auth/* (apps/api/src/auth) ————————————————————————————————
  {
    chemin: "/auth/otp",
    methode: "post",
    resume: "Demander un code de connexion à usage unique par courriel",
    note: [
      "Le code vaut DIX MINUTES. C'est la première des deux horloges du parcours.",
      "",
      "La seconde est le délai avant de pouvoir en redemander un, et il CROÎT :",
      "5 secondes après la première demande, 25 après la deuxième, 125 après la",
      "troisième. Le client ne calcule pas cette formule — il lit",
      "`retryAfterSeconds` dans la réponse et l'affiche en compte à rebours.",
      "S'il la codait de son côté, deux versions du parc appliqueraient deux",
      "règles différentes, celle du serveur restant la seule qui compte.",
      "",
      "Un refus `rate_limited` porte le même champ dans ses `details`.",
      "",
      "Plafond : trois codes par heure et par boîte. Il GLISSE — le refus dit",
      "quand la plus ancienne demande sortira de la fenêtre, pas « dans une",
      "heure ».",
      "",
      "La réponse est identique pour une adresse connue et une adresse",
      "inconnue, délai compris : ce point d'entrée n'énumère pas les comptes.",
    ].join("\n"),
    corps: requestOtpSchema,
    reponse: sentResponseSchema,
  },
  {
    chemin: "/auth/otp/verify",
    methode: "post",
    resume: "Vérifier le code reçu : une session, ou une invitation à s'inscrire",
    note: [
      "DEUX ISSUES, distinguées par le champ `outcome` :",
      "",
      "- `session` — l'adresse a déjà un compte. On va droit à l'accueil.",
      "- `registration` — l'adresse est inconnue. AUCUN COMPTE N'EST CRÉÉ. La",
      "  réponse porte un jeton d'inscription ; l'écran du pseudo suit, et le",
      "  compte naît à POST /auth/register.",
      "",
      "Tester la présence d'`accessToken` pour deviner l'issue est une erreur :",
      "lire `outcome`, qui existe pour cela.",
      "",
      "Pourquoi le compte n'est pas créé ici : le code de parrainage se saisit",
      "à l'écran du pseudo, donc APRÈS. Créer d'abord et rattacher ensuite",
      "ouvrirait un chemin pour réclamer un parrainage des mois plus tard. Les",
      "deux opérations sont atomiques.",
      "",
      "Le jeton d'inscription n'est PAS une session : il n'ouvre aucune",
      "ressource, vaut quinze minutes, et le présenter en en-tête",
      "d'autorisation ne donne accès à rien.",
      "",
      "`deviceLimitReached` est INDICATIF — il évite de faire choisir un pseudo",
      "à quelqu'un dont la création sera refusée. Le plafond fait foi à la",
      "création, sous verrou.",
    ].join("\n"),
    corps: verifyOtpSchema,
    reponse: verifyOutcomeSchema,
  },
  {
    // La création du compte. Le jeton d'inscription vient de /otp/verify ou de
    // /federated ; le pseudo et le code de parrainage viennent de l'écran du
    // pseudo. Tout se joue ici, en une transaction — le plafond par appareil,
    // le compte, les crédits et le parrainage.
    //
    // Pourquoi pas à la vérification : le code de parrainage se saisit APRÈS
    // elle. Créer d'abord et rattacher ensuite laisserait un compte réclamer
    // un parrainage des mois plus tard.
    chemin: "/auth/register",
    methode: "post",
    resume: "Créer le compte : pseudo, appareil, et code de parrainage facultatif",
    note: [
      "TOUT SE JOUE ICI, en une transaction : le plafond par appareil, le",
      "compte, les crédits d'inscription et le parrainage. Rien n'est",
      "rattachable après coup.",
      "",
      "`deviceId` est OBLIGATOIRE, sur les trois voies d'entrée. Il l'est ici",
      "et non à la vérification, parce que c'est ici que le compte naît — donc",
      "ici que le plafond par appareil s'applique. Le rendre facultatif",
      "rouvrirait son contournement.",
      "",
      "Le pseudo est CHOISI par l'utilisateur : il forme l'adresse de son Mur.",
      "Un pseudo déjà pris rend `username_taken` (409) — le serveur n'en",
      "invente pas un autre, il ne peut pas deviner celui qu'on voulait.",
      "",
      "Un code de parrainage invalide NE CASSE PAS l'inscription. Le champ",
      "`referral` de la réponse porte son issue : `credited`, `unknown` ou",
      "`self`. Un code inconnu, expiré ou à soi-même se signale, et le compte",
      "se crée quand même.",
      "",
      "La réponse porte le DÉTAIL des octrois — `signupCredits` et",
      "`referral.bonusCredits` — et non un total. L'écran de bienvenue affiche",
      "deux lignes : cadeau de bienvenue et bonus de parrainage sont deux",
      "gestes distincts, dont l'un se mérite.",
      "",
      "Valider un code de parrainage AVANT de le soumettre : GET",
      "/public/invitations/{code}.",
    ].join("\n"),
    corps: registerSchema,
    reponse: registeredSchema,
    statut: 201,
  },
  {
    chemin: "/auth/federated",
    methode: "post",
    resume: "Se connecter via Google ou Apple : une session, ou une invitation à s'inscrire",
    note: [
      "MÊMES DEUX ISSUES que /auth/otp/verify, et pour la même raison : le",
      "choix du pseudo appartient à la première connexion, quelle que soit la",
      "voie empruntée. Une première connexion Google ou Apple rend donc un",
      "jeton d'inscription, pas une session.",
      "",
      "`referralCode` est accepté ici pour le cas d'une arrivée par lien",
      "d'invitation, où le code est connu d'avance — mais il ne s'applique",
      "qu'à la création : c'est /auth/register qui le traite.",
    ].join("\n"),
    corps: federatedSchema,
    reponse: verifyOutcomeSchema,
  },
  {
    chemin: "/auth/refresh",
    methode: "post",
    resume: "Renouveler une session à partir du jeton de rafraîchissement",
    corps: refreshSchema,
    reponse: sessionSchema,
  },
  {
    chemin: "/auth/session",
    methode: "delete",
    resume: "Clore la session (révoque la famille du jeton de rafraîchissement)",
    authentifie: true,
    corps: refreshSchema,
    sansContenu: true,
    statut: 204,
  },
  // ——— me/profile (apps/api/src/me) ———————————————————————————————
  {
    chemin: "/me/profile",
    methode: "get",
    resume: "Lire son propre profil",
    authentifie: true,
    reponse: profileSchema,
  },
  {
    chemin: "/me/profile",
    methode: "patch",
    resume: "Modifier son propre profil",
    authentifie: true,
    corps: updateProfileSchema,
    reponse: profileSchema,
  },
  {
    chemin: "/me/profile/username-available",
    methode: "get",
    resume: "Vérifier la disponibilité d'un identifiant",
    authentifie: true,
    parametres: [{ nom: "username", dans: "query", schema: usernameSchema, requis: true }],
    reponse: usernameAvailableResponseSchema,
  },
  // ——— me/persons (apps/api/src/me) ————————————————————————————————
  {
    chemin: "/me/persons",
    methode: "get",
    resume: "Lister ses proches — le carnet, trié et paginé",
    authentifie: true,
    note: [
      "### Une enveloppe, non plus un tableau",
      "",
      "`{ persons, total }`. Le total sert « Voir plus · n restants » : un",
      "curseur ne saurait pas le donner, et à l'échelle d'un carnet personnel le",
      "décalage numéroté est exact.",
      "",
      "### Le tri, et sa direction",
      "",
      "`sort=date` (défaut) range sur la prochaine échéance, `sort=alpha` sur le",
      "nom. `direction=asc` (défaut) ou `desc` : « par date » ne dit rien tant",
      "qu'on ne sait pas de quel bout.",
      "",
      "**Une fiche sans date passe en FIN de liste dans les DEUX sens.** Jamais",
      "en tête à l'inversion : le carnet sert à voir qui a une date qui",
      "approche, et une fiche à compléter y occuperait la place de ce qui presse.",
      "",
      "**Changer de tri revient à la première page** — remettre `offset` à zéro.",
      "Le serveur ne s'en souvient pas, c'est au client de le faire.",
      "",
      "### Ce que chaque fiche porte pour sa ligne",
      "",
      "`notesCount` — les notes DURABLES seules, celles que rend",
      "`/me/persons/{id}/notes`. Compter aussi celles de circonstance ferait dire",
      "« 7 notes » à une fiche qui n'en montre que trois.",
      "",
      "`nextOccurrence` — nulle quand le proche n'a aucune date ; la ligne",
      "affiche alors « Compléter » à la place du décompte. `daysUntil` est signé.",
      "",
      "Les deux voyagent AVEC la fiche : les chercher autrement ferait un appel",
      "par proche, soit quarante-trois sur le carnet d'essai du handoff.",
      "",
      "### La recherche",
      "",
      "`q` filtre sur le nom affiché ET le nom d'usage — quelqu'un cherche",
      "« maman » sans savoir si la fiche dit « Maman » ou « Maman Chantal ».",
      "",
      "**Insensible à la casse et aux accents** : « emile » trouve « Émile ».",
      "Sur un marché où les claviers ne portent pas toujours les accents,",
      "l'inverse rendrait la recherche inutilisable pour la moitié des noms.",
      "",
      "**Elle se combine au tri et à la pagination**, et s'applique AVANT eux :",
      "`total` compte les correspondances, pas le carnet entier. Ne filtrez pas",
      "une page déjà chargée — un proche de la troisième page resterait",
      "introuvable, et c'est le défaut que ce paramètre corrige.",
      "",
      "§3.15 demande des résultats « classés par proximité de leur prochaine",
      "échéance » : c'est `sort=date`, le tri par défaut. Rien à ajouter.",
      "",
      "### Le genre n'est pas dans ce contrat",
      "",
      "Ni en lecture, ni en écriture, ni dans `/me/metadata`. Le carnet ne pose",
      "pas la question ; tant que le champ traversait, la règle ne tenait que par",
      "la retenue du client. La colonne existe en base — c'est un signal de",
      "génération de dernier recours, déduit côté serveur, jamais demandé.",
    ].join("\n"),
    parametres: [
      { nom: "sort", dans: "query", schema: listPersonsQuerySchema.shape.sort, requis: false },
      { nom: "direction", dans: "query", schema: listPersonsQuerySchema.shape.direction, requis: false },
      { nom: "offset", dans: "query", schema: listPersonsQuerySchema.shape.offset, requis: false },
      { nom: "limit", dans: "query", schema: listPersonsQuerySchema.shape.limit, requis: false },
      { nom: "q", dans: "query", schema: listPersonsQuerySchema.shape.q, requis: false },
    ],
    reponse: personListSchema,
  },
  {
    chemin: "/me/persons",
    methode: "post",
    resume: "Ajouter un proche à l'annuaire",
    authentifie: true,
    corps: createPersonSchema,
    reponse: personSchema,
    // Nest rend 201 par défaut pour un POST sans @HttpCode explicite, et
    // c'est le statut juste ici : la route rend une ressource nouvelle, avec
    // un identifiant que le client apprend. Contrairement aux autres POST du
    // contrat (/auth/otp envoie un code, /public/waitlist est idempotent à
    // dessein, /public/contact achemine un message), aucun n'est une création
    // au sens REST — celui-ci l'est, 201 se corrige donc ici plutôt qu'au
    // contrôleur.
    statut: 201,
  },
  {
    chemin: "/me/persons/{id}",
    methode: "get",
    resume: "Lire la fiche d'un proche",
    authentifie: true,
    parametres: [{ nom: "id", dans: "path", schema: z.string().uuid(), requis: true }],
    reponse: personSchema,
  },
  {
    chemin: "/me/persons/{id}",
    methode: "patch",
    resume: "Corriger la fiche d'un proche",
    authentifie: true,
    parametres: [{ nom: "id", dans: "path", schema: z.string().uuid(), requis: true }],
    corps: updatePersonSchema,
    reponse: personSchema,
  },
  {
    // Chemin distinct de /me/persons/{id}/notes : cette note n'appartient à
    // aucun proche en particulier, et la loger sous l'un d'eux obligerait à en
    // désigner un comme propriétaire de l'appel, ce qu'il n'est pas.
    chemin: "/me/notes",
    methode: "post",
    resume: "Écrire une même note pour plusieurs proches",
    authentifie: true,
    corps: createNotesSchema,
    reponse: z.array(noteSchema),
    statut: 201,
  },
  {
    chemin: "/me/persons/{personId}/notes",
    methode: "get",
    resume: "Lister les notes d'un proche, de la plus récente à la plus ancienne",
    authentifie: true,
    parametres: [{ nom: "personId", dans: "path", schema: z.string().uuid(), requis: true }],
    reponse: z.array(noteSchema),
  },
  {
    chemin: "/me/persons/{personId}/notes",
    methode: "post",
    resume: "Écrire une note sur un proche",
    authentifie: true,
    parametres: [{ nom: "personId", dans: "path", schema: z.string().uuid(), requis: true }],
    corps: createNoteSchema,
    reponse: noteSchema,
    // Une ressource neuve, dont le client apprend l'identifiant.
    statut: 201,
  },
  {
    chemin: "/me/persons/{id}",
    methode: "delete",
    resume: "Supprimer un proche (emporte ses notes)",
    authentifie: true,
    parametres: [{ nom: "id", dans: "path", schema: z.string().uuid(), requis: true }],
    // 204 comme /auth/session : la suppression ne rend rien à décrire.
    sansContenu: true,
    statut: 204,
  },
  // ——— me/events (apps/api/src/me) ————————————————————————————————
  {
    chemin: "/me/events",
    methode: "get",
    resume: "Lister ses événements, tous ou ceux d'un seul proche",
    authentifie: true,
    note: [
      "Sans `personId`, le chemin rend TOUS les événements du compte. Avec, il",
      "rend ceux du proche visé — c'est ce que montre sa fiche (maquette §3.4).",
      "",
      "Un `personId` qui n'est pas au demandeur rend `404`, jamais une liste",
      "vide : celle-ci laisserait croire que le proche existe et n'a rien.",
      "",
      "Chaque événement porte ses `schedules` — le jeu de règles enregistré,",
      "TOUJOURS rendu (`[]` s'il n'y en a aucune, jamais absent). Rouvrir un",
      "événement pour le modifier (§3.6) montre ainsi ce qui a été saisi.",
    ].join("\n"),
    parametres: [
      { nom: "personId", dans: "query", schema: listEventsQuerySchema.shape.personId, requis: false },
    ],
    reponse: z.array(eventSchema),
  },
  {
    chemin: "/me/events",
    methode: "post",
    resume: "Créer un événement (anniversaire ou événement libre)",
    authentifie: true,
    note: [
      "Un anniversaire NE PORTE PAS `referenceDate` : elle se calcule depuis",
      "`person.birthDate`, la prochaine échéance à venir — jamais la naissance",
      "elle-même. La fournir tout de même reste accepté, mais reste soumise à",
      "la même contrainte qu'un événement libre : une date à venir.",
      "",
      "Un proche sans date de naissance ne peut pas recevoir d'anniversaire :",
      "`validation_failed` (422).",
      "",
      "Un proche n'a qu'un seul anniversaire : en créer un second rend",
      "`conflict` (409), la règle du formulaire (§3.6) tenue au serveur.",
      "",
      "`schedules` compose les rappels de l'événement — une ou plusieurs",
      "règles, récurrentes ou décalées, jamais les deux à la fois sur une même",
      "règle. Facultatif : un anniversaire reçoit sa règle annuelle sans qu'on",
      "la demande. La réponse les rend telles quelles dans `schedules` — c'est",
      "ce qu'un `GET` ultérieur montrera aussi.",
      "",
      "Une règle `recurrent` ouvre une échéance qui revient (l'anniversaire).",
      "Une règle `offset` ouvre un POINT FIXE après `referenceDate` — deux",
      "règles `offset` (un mois, puis trois mois) ouvrent donc DEUX échéances",
      "distinctes, pas une série. Sans règle du tout, `referenceDate` elle-même",
      "tient lieu d'unique échéance.",
      "",
      "### `kind: \"other\"` dépend du drapeau `events.other`",
      "",
      "Éteint, ce chemin rend **`422` (`resource_inactive`)** sur un `kind`",
      "autre que `birthday`, le type refusé voyageant dans `details.kind`.",
      "",
      "**Pas `404`**, contrairement à une surface fermée par un drapeau : le",
      "chemin existe, les anniversaires l'empruntent — il n'y a rien à cacher.",
      "",
      "**L'anniversaire passe toujours** : il relève du socle, qui n'a pas de",
      "drapeau et ne s'éteint jamais.",
      "",
      "**Ne testez pas le drapeau pour décider** — lisez `eventKinds` de",
      "`/me/metadata`, déjà filtré. Ce `422` est un FILET : il attrape une",
      "version installée qui n'a pas relu ses métadonnées. Un client à jour ne",
      "devrait jamais le voir.",
      "",
      "**Le drapeau garde la CRÉATION, jamais l'existant.** Un événement libre",
      "créé avant l'extinction reste lisible par `GET`, modifiable par `PATCH`,",
      "et ses échéances continuent de tomber. Ne le masquez pas.",
    ].join("\n"),
    corps: createEventSchema,
    reponse: eventSchema,
    statut: 201,
  },
  {
    chemin: "/me/events/{id}",
    methode: "get",
    resume: "Lire un événement",
    authentifie: true,
    note: [
      "`schedules` rend le jeu de règles enregistré — c'est ce qui permet au",
      "formulaire (§3.6) de rouvrir un événement en montrant ce qui a été",
      "saisi, plutôt qu'un formulaire vide qu'on ne peut que réécrire.",
    ].join("\n"),
    parametres: [{ nom: "id", dans: "path", schema: z.string().uuid(), requis: true }],
    reponse: eventSchema,
  },
  {
    chemin: "/me/events/{id}",
    methode: "patch",
    resume: "Corriger un événement",
    authentifie: true,
    note: [
      "`schedules`, fourni, REMPLACE le jeu de règles en entier — jamais un",
      "patch règle par règle. Le formulaire (§3.6) compose un ensemble complet",
      "à l'écran, comme à la création : envoyer ce même ensemble entier au",
      "PATCH évite qu'une règle retirée à l'écran ne survive en silence côté",
      "serveur, à côté des nouvelles. Un tableau vide (`schedules: []`) est",
      "valide et retire toute règle.",
      "",
      "Fourni, `schedules` referme aussi les échéances déjà ouvertes",
      "(`upcoming`) et en rouvre selon le nouveau jeu — une échéance qu'aucune",
      "règle actuelle n'expliquerait ne resterait pas affichée. `referenceDate`",
      "corrigée fait de même. Ce chemin n'ouvre PAS l'échéance suivante quand",
      "la précédente est passée : c'est le travail d'un ordonnanceur séparé.",
    ].join("\n"),
    parametres: [{ nom: "id", dans: "path", schema: z.string().uuid(), requis: true }],
    corps: updateEventSchema,
    reponse: eventSchema,
  },
  {
    chemin: "/me/events/{id}",
    methode: "delete",
    resume: "Supprimer un événement (emporte ses échéances)",
    authentifie: true,
    parametres: [{ nom: "id", dans: "path", schema: z.string().uuid(), requis: true }],
    sansContenu: true,
    statut: 204,
  },
  // ——— me/occurrences (apps/api/src/me) ——————————————————————————————
  {
    // Le MÊME appel sert l'accueil (trois échéances) et l'écran Dates (un
    // mois) : c'est la fenêtre et le plafond qui varient, pas le chemin
    // (spécification §5.2).
    chemin: "/me/occurrences",
    methode: "get",
    resume: "Lister ses échéances, dans une fenêtre de dates et un plafond",
    authentifie: true,
    note: [
      "`from` vaut aujourd'hui par défaut, `limit` vaut 50 à défaut d'une",
      "valeur explicite : l'accueil en demande trois, l'écran Dates un mois.",
      "",
      "`status` est DÉRIVÉ à la lecture, jamais lu tel quel dans la base :",
      "`upcoming` avant la fenêtre de vœux, `collecting` dedans, `closed`",
      "après. La fenêtre vaut [date − wish_window_lead_days, date +",
      "wish_window_trail_days], réglable en administration.",
      "",
      "`daysUntil` est SIGNÉ — négatif pour une échéance passée.",
      "",
      "`age` se calcule depuis la naissance du proche, jamais depuis la date",
      "de l'échéance. Nul quand l'année de naissance n'est pas connue.",
      "",
      "Chaque échéance porte `personDisplayName` : le nom du proche voyage",
      "avec elle, sans quoi chaque carte d'une liste demanderait sa fiche.",
      "",
      "`personId` restreint la liste à un proche — les échéances de sa fiche,",
      "et son historique quand `from` remonte dans le passé. Un `personId` qui",
      "n'est pas au demandeur rend `404`, jamais une liste vide.",
    ].join("\n"),
    parametres: [
      { nom: "from", dans: "query", schema: listOccurrencesQuerySchema.shape.from, requis: false },
      { nom: "to", dans: "query", schema: listOccurrencesQuerySchema.shape.to, requis: false },
      { nom: "limit", dans: "query", schema: listOccurrencesQuerySchema.shape.limit, requis: false },
      { nom: "personId", dans: "query", schema: listOccurrencesQuerySchema.shape.personId, requis: false },
    ],
    reponse: z.array(occurrenceSchema),
  },
  {
    chemin: "/me/occurrences/{id}",
    methode: "get",
    resume: "Lire le détail d'une échéance",
    authentifie: true,
    parametres: [{ nom: "id", dans: "path", schema: z.string().uuid(), requis: true }],
    reponse: occurrenceSchema,
  },
  {
    // Chemin distinct de /me/persons/{id}/notes : celles-ci sont DE
    // CIRCONSTANCE, propres à cette occasion — une idée de cadeau pour ce
    // mariage, une tenue à prévoir — jamais rendues par le chemin des
    // durables (voir la note de `noteSchema.eventOccurrenceId`).
    chemin: "/me/occurrences/{id}/notes",
    methode: "get",
    resume: "Lister les notes de circonstance d'une occasion, de la plus récente à la plus ancienne",
    authentifie: true,
    parametres: [{ nom: "id", dans: "path", schema: z.string().uuid(), requis: true }],
    reponse: z.array(noteSchema),
  },
  {
    chemin: "/me/occurrences/{id}/notes",
    methode: "post",
    resume: "Écrire une note de circonstance sur une occasion",
    authentifie: true,
    note: [
      "`personId` se déduit de l'occasion — une occurrence appartient à un",
      "événement, qui appartient à un proche — le client n'a pas à le fournir.",
    ].join("\n"),
    parametres: [{ nom: "id", dans: "path", schema: z.string().uuid(), requis: true }],
    corps: createNoteSchema,
    reponse: noteSchema,
    // Une ressource neuve, dont le client apprend l'identifiant.
    statut: 201,
  },
  // ——— me/metadata (apps/api/src/me) ——————————————————————————————
  {
    chemin: "/me/metadata",
    methode: "get",
    resume: "Lire les valeurs dont les écrans composent leurs listes",
    note: [
      "Aucun libellé : ils vivent dans les ressources de traduction de",
      "l'application, indexés par `code`.",
      "",
      "`categories` est la seule valeur lue EN BASE — sa `kind` et son",
      "`isConstraint` ne se déduisent d'aucune énumération. `dislikes_nogo`",
      "porte `isConstraint: true` : cela change ce que le produit PROPOSE, pas",
      "seulement ce qu'il affiche. Le reste est figé, servi avec elle pour",
      "que le client n'aille pas chercher la même chose à deux endroits.",
      "",
      "### `eventKinds` est FILTRÉ par les drapeaux",
      "",
      "C'est la seule liste qui varie d'un compte à l'autre. Quand",
      "`events.other` est éteint, elle rend `[\"birthday\"]` — et l'écran de",
      "§3.6 ne propose plus le choix « autre type », **sans avoir la moindre",
      "règle à connaître**.",
      "",
      "**C'est ce chemin qu'il faut lire, pas le drapeau.** Un client qui",
      "testerait `events.other` lui-même referait le raisonnement du serveur,",
      "et s'en écarterait le jour où il change.",
      "",
      "**À relire après chaque connexion**, comme `/me/features` : un drapeau",
      "peut basculer pendant qu'une session est ouverte.",
    ].join("\n"),
    authentifie: true,
    reponse: metadataSchema,
  },
  // ——— me/notification-preferences (apps/api/src/me) ——————————————————
  {
    chemin: "/me/notification-preferences",
    methode: "get",
    resume: "Lire ses préférences de notification (§3.11)",
    note: [
      "`preferences` porte UN type PAR TYPE CONFIGURABLE — `login_code`,",
      "`security` et `account` n'y figurent pas : ces natures partent",
      "toujours, y régler un canal n'aurait aucun effet.",
      "",
      "**Une ligne absente vaut le défaut** : poussée ET courriel activés.",
      "Ce chemin rend l'état EFFECTIF de chaque type, qu'une ligne existe en",
      "base ou non — le client n'a pas à connaître ni à rejouer ce défaut.",
      "",
      "La maquette groupe ces types en cinq NATURES affichées à l'écran",
      "(rappel d'échéance, récapitulatif, contributions à valider, relances,",
      "vie du compte). Ce groupement n'existe PAS côté serveur : chaque type",
      "se règle seul, et c'est l'écran qui décide quels boutons rassembler",
      "sous quel titre — le groupement ne change que l'affichage, jamais ce",
      "qui part.",
      "",
      "`digestFrequency` (`monthly` / `weekly` / `never`) vit ici et pas sur",
      "`/me/profile` : la maquette la range sous « Préférences de",
      "notification », à la différence de `sendHour` et `timezone`, qui",
      "valent pour toutes les natures et restent servis par `/me/profile`.",
    ].join("\n"),
    authentifie: true,
    reponse: notificationPreferencesSchema,
  },
  {
    chemin: "/me/notification-preferences",
    methode: "patch",
    resume: "Modifier ses préférences de notification",
    note: [
      "Un type de la liste toujours envoyée (`login_code`, `security`,",
      "`account`) dans `preferences` rend `400` (`validation_failed`) : le",
      "refus est posé dans le contrat, pas seulement dans l'écran — aucun",
      "appelant ne peut l'oublier.",
      "",
      "`preferences` et `digestFrequency` sont indépendants et tous deux",
      "facultatifs, mais au moins l'un des deux doit être présent — un corps",
      "vide rend `400`, comme `PATCH /me/wall`.",
      "",
      "Pas de `sendHour` ici : voir la note du `GET`.",
    ].join("\n"),
    authentifie: true,
    corps: updateNotificationPreferencesSchema,
    reponse: notificationPreferencesSchema,
  },
  {
    chemin: "/me/persons/{id}/attributes",
    methode: "get",
    resume: "Le topo d'un proche : ce que les notes ont appris de lui",
    note: [
      "Le bloc en tête de fiche (§3.4) : couleur, animal, plat, taille, métier,",
      "ce qu'il faut éviter — onze natures.",
      "",
      "### Rien ne se saisit, et il n'y a rien à écrire",
      "",
      "Ces valeurs sont **extraites des notes** par la passe qui les classe",
      "déjà. Aucun formulaire ne les demande, et **ce chemin n'accepte que la",
      "lecture** : corriger, c'est écrire une note nouvelle, et le plus récent",
      "l'emporte.",
      "",
      "**Le plus récent au sens de la NOTE**, pas du traitement. Une note de",
      "mars traitée après une note de septembre ne remplace pas celle de",
      "septembre — le cas arrive dès qu'un arriéré se traite d'un coup.",
      "",
      "### Une liste vide est un état normal",
      "",
      "Une fiche neuve n'a rien appris encore. Le client n'affiche alors",
      "**aucun bloc** — jamais une grille de cases vides qui attendraient",
      "d'être remplies. Et la composition doit tenir **avec deux valeurs comme",
      "avec onze**.",
      "",
      "### La provenance voyage avec la valeur",
      "",
      "`noteId` et `observedAt` permettent d'afficher la ligne de provenance et",
      "de remonter à ce qui a été écrit. Sans eux, un attribut est une",
      "affirmation sans source, qu'on ne peut ni vérifier ni corriger.",
      "",
      "`noteId` peut être **nul** si la note a été supprimée depuis : la valeur",
      "demeure. Ce qu'une phrase a appris ne s'efface pas avec elle.",
      "",
      "### Un chemin à part de la fiche",
      "",
      "La fiche se lit à chaque ouverture d'écran ; le topo ne bouge qu'au",
      "rythme des notes. Les servir ensemble ferait payer une jointure de plus",
      "au chemin le plus fréquenté du carnet, pour une donnée qui n'a pas",
      "changé.",
      "",
      "**Aucun libellé n'est rendu** : `kind` est un code, traduit par le",
      "client.",
    ].join("\n"),
    authentifie: true,
    reponse: personAttributesSchema,
  },
  // ——— me/home (apps/api/src/me/home.controller.ts) ———————————————————
  {
    chemin: "/me/home",
    methode: "get",
    resume: "L'accueil en un appel : la phrase d'état et les trois échéances les plus proches",
    note: [
      "L'écran d'ouverture de l'application (§3.2 de la maquette, §5.8 du",
      "technique). Tout y tient en un seul aller-retour, à dessein : c'est le",
      "premier appel après la connexion, et c'est là qu'un chargement en",
      "cascade se voit le plus.",
      "",
      "### `counts` ne se déduit PAS de `occurrences`",
      "",
      "La liste est plafonnée à **trois** cartes. Trois échéances rendues ne",
      "disent pas combien il y en a cette semaine : `counts.today` et",
      "`counts.thisWeek` sont comptés séparément, en base, sur la table",
      "entière. Un client qui compterait les éléments de `occurrences` pour",
      "composer sa phrase se tromperait dès la quatrième échéance — et il se",
      "tromperait **par défaut**, en annonçant moins qu'il n'y en a.",
      "",
      "La semaine, ce sont les **sept prochains jours, aujourd'hui compris**.",
      "",
      "### Les deux états vides ne se ressemblent pas",
      "",
      "`hasPersons` distingue « le carnet est vide » de « le carnet est plein",
      "mais rien n'approche ». Au premier lancement, le bouton principal",
      "devient « Ajouter un anniversaire » — il n'y a personne à propos de qui",
      "écrire. Ensuite, « Laisser une note » demeure.",
      "",
      "**Le client ne peut pas trancher depuis une liste vide** : les deux cas",
      "rendent `occurrences: []`. Ce drapeau lui évite d'appeler `/me/persons`",
      "rien que pour choisir un libellé de bouton.",
      "",
      "### La pastille de la cloche voyage avec",
      "",
      "`unreadNotifications` accompagne la réponse parce que l'en-tête",
      "l'affiche dès l'ouverture. La demander à part ferait clignoter la",
      "pastille — apparue vide, puis remplie une fraction de seconde plus tard.",
      "",
      "### Ce chemin n'a pas de drapeau",
      "",
      "Les dates relèvent du **socle**, qui ne s'éteint pas (§6.3). Il répond",
      "toujours, y compris à un compte qui n'a encore rien saisi.",
    ].join("\n"),
    authentifie: true,
    reponse: homeSchema,
  },
  // ——— me/sessions, me/identities (apps/api/src/me/security.controller.ts) ——
  // Écran « Sécurité et connexions », maquette §3.24. La suppression du
  // compte (§3.24, en trois temps) n'a PAS de chemin ici : chantier à part,
  // design encore en cours.
  {
    chemin: "/me/sessions",
    methode: "get",
    resume: "Lister les connexions récentes",
    authentifie: true,
    note: [
      "### Une session est une LIGNÉE, pas un jeton",
      "",
      "`RefreshToken` crée un jeton enfant à chaque renouvellement, dans la",
      "même lignée : lister les jetons montrerait vingt lignes pour un seul",
      "téléphone resté ouvert deux mois. `id` est celui de la lignée,",
      "`createdAt` la date de son premier jeton (l'ouverture), `lastActiveAt`",
      "celle de son plus récent (la dernière fois qu'elle a servi).",
      "",
      "### Pas de lieu approximatif",
      "",
      "La maquette en demande un ; ce chemin n'en rend pas. `RefreshToken.ip`",
      "sert aux investigations, pas à l'affichage (voir son commentaire dans",
      "`prisma/schema.prisma`), et aucun service de géolocalisation ne la",
      "traduit aujourd'hui en lieu. Plutôt qu'une adresse brute affichée comme",
      "un lieu, le champ est absent — il rejoindra ce contrat le jour où un",
      "service peut le produire honnêtement.",
      "",
      "### Pas de champ « appareil courant » non plus",
      "",
      "Ce chemin ne reçoit qu'un jeton d'accès, qui ne dit pas de quelle",
      "lignée il descend. Le client sait déjà quel appareil est le sien ; ce",
      "n'est pas au serveur de le lui redire.",
    ].join("\n"),
    reponse: sessionsListSchema,
  },
  {
    chemin: "/me/sessions",
    methode: "delete",
    resume: "Se déconnecter de partout",
    authentifie: true,
    note: [
      "### Révoque TOUTES les lignées du compte, y compris celle-ci",
      "",
      "Ce chemin ne reçoit qu'un jeton d'accès : rien n'y distingue « cet",
      "appareil » des autres pour l'épargner. Plutôt qu'épargner une lignée au",
      "hasard, cet appel révoque tout, sans exception. **Le client doit donc",
      "traiter cet appel comme SA PROPRE déconnexion aussi** : effacer ses",
      "jetons locaux et revenir à l'écran de connexion, sans attendre un signal",
      "du serveur pour le faire.",
      "",
      "### L'effet n'est pas instantané",
      "",
      "Le jeton d'accès est autoportant, valable quinze minutes, et sa",
      "validité ne se vérifie jamais en base : révoquer les lignées ici ne",
      "l'invalide pas rétroactivement. Un appareil qui vient d'obtenir un",
      "jeton d'accès peut continuer à l'utiliser jusqu'à quinze minutes après",
      "cet appel ; c'est à son prochain RENOUVELLEMENT (`/auth/refresh`) que la",
      "déconnexion se fait sentir, avec `session_expired`.",
    ].join("\n"),
    sansContenu: true,
    statut: 204,
  },
  {
    chemin: "/me/identities",
    methode: "get",
    resume: "Lister les moyens de connexion externes rattachés",
    authentifie: true,
    note: [
      "Les moyens EXTERNES seulement — Google, Apple. La connexion par e-mail",
      "et code n'apparaît pas ici : elle est toujours active, ne se détache",
      "jamais (elle reste l'accès de secours, maquette §3.24), et l'écran",
      "l'affiche sans avoir besoin de ce chemin pour le savoir.",
    ].join("\n"),
    reponse: identitiesListSchema,
  },
];

export function construireOpenApi(): object {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const c of CHEMINS) {
    paths[c.chemin] ??= {};
    const typeContenu = c.typeContenuReponse ?? "application/json";
    paths[c.chemin]![c.methode] = {
      summary: c.resume,
      ...(c.note ? { description: c.note } : {}),
      ...(c.authentifie ? { security: [{ bearerAuth: [] }] } : {}),
      ...(c.parametres
        ? {
            parameters: c.parametres.map((p) => ({
              name: p.nom,
              in: p.dans,
              required: p.requis ?? p.dans === "path",
              schema: schema(p.schema),
            })),
          }
        : {}),
      ...(c.corps ? { requestBody: { required: true, content: { "application/json": { schema: schema(c.corps) } } } } : {}),
      responses: {
        [String(c.statut ?? 200)]: {
          description: "Succès",
          ...(c.sansContenu
            ? {}
            : c.reponse
              ? { content: { [typeContenu]: { schema: typeContenu === "application/json" ? schema(c.reponse) : { type: "string" } } } }
              : {}),
        },
        "4XX": {
          description: "Refus — la requête ne satisfait pas le contrat (forme, valeur, droit) ; corriger avant de réessayer.",
          content: { "application/json": { schema: schema(errorEnvelopeSchema) } },
        },
        // internal_error (statusForCode le fixe à 500, voir
        // apps/api/src/common/errors.ts) — rendu par AppExceptionFilter sur
        // toute exception non prévue, y compris hors AppError, donc atteignable
        // depuis n'importe quel chemin. Une défaillance du serveur, pas un
        // refus de la requête : le client devrait réessayer, pas corriger sa
        // demande — d'où un bloc séparé du "4XX" plutôt qu'absorbé dedans.
        "500": {
          description: "Défaillance du serveur — la requête n'y est pour rien, on peut réessayer sans la modifier.",
          content: { "application/json": { schema: schema(errorEnvelopeSchema) } },
        },
        // Atteignable depuis n'importe quel chemin que le garde d'arrêt
        // couvre — c'est-à-dire tous, sauf ceux qu'il exempte. Documenté pour
        // la même raison que le 500 : un client qui ne l'attend pas traiterait
        // un arrêt de deux heures comme une panne définitive.
        //
        // Et surtout PAS documenté sur les chemins exemptés : annoncer un 503
        // sur /admin ferait croire qu'un arrêt ferme la porte par laquelle on
        // le lève. La liste vient du garde, elle ne se devine pas.
        ...(exemptDArret(c.chemin)
          ? {}
          : {
            "503": {
              description:
                "Arrêt pour intervention — code `maintenance`, avec `details.retryAfterSeconds`. " +
                "La ressource existe et revient : ne pas la masquer, réessayer après le délai annoncé.",
              content: { "application/json": { schema: schema(errorEnvelopeSchema) } },
            },
          }),
      },
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Lehno",
      version: "1",
      description: [
        "L'assistant des dates qui comptent. Le contrat est engendré depuis les",
        "schémas Zod de @lehno/contracts — il ne s'écrit pas à la main.",
        "",
        "## Les en-têtes de mesure",
        "",
        "Le serveur émet les événements du plan de mesure quand le fait se",
        "produit chez lui — une inscription, un proche créé, une note prise. Il",
        "sait qui, quand, et quels drapeaux étaient actifs. **Il ne sait pas d'où**",
        "l'appel vient : ces cinq en-têtes le lui disent, sur chaque requête.",
        "",
        "| En-tête | Exemple | Ce qu'il permet |",
        "|---|---|---|",
        "| `X-Lehno-Surface` | `app` | Séparer l'application du web public |",
        "| `X-Lehno-App-Version` | `1.4.2` | Rattacher une rupture de courbe à une version |",
        "| `X-Lehno-Language` | `fr` | Segmenter par langue d'interface |",
        "| `X-Lehno-Theme` | `dark` | Savoir si le thème sombre sert |",
        "| `X-Lehno-Session` | un identifiant de session | Recoller un parcours avant l'ouverture du compte |",
        "",
        "**Aucun n'est obligatoire** : absent, il vaut simplement « inconnu », et",
        "rien n'échoue. Mais une mesure sans surface ni version ne se segmente",
        "pas, et une question du plan reste sans réponse.",
        "",
        "**Ils sont nettoyés et bornés** à l'arrivée : un en-tête est écrit par le",
        "client, et rien de ce qu'il écrit n'atteint un journal tel quel.",
        "",
        "**L'adresse électronique n'y figure pas et ne doit jamais y figurer.**",
        "L'identifiant de session suffit avant l'ouverture d'un compte ;",
        "l'identifiant de compte prend le relais après.",
      ].join("\n"),
    },
    servers: [{ url: "https://api.lehno.app/v1" }, { url: "http://localhost:3001/v1", description: "développement" }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    },
    paths,
  };
}
