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
  personSchema, createPersonSchema, updatePersonSchema,
  noteSchema, createNoteSchema, createNotesSchema,
} from "./me.js";
import {
  eventSchema, createEventSchema, updateEventSchema,
  occurrenceSchema, listOccurrencesQuerySchema, listEventsQuerySchema,
} from "./me-events.js";
import { featuresResponseSchema, DRAPEAUX, CLES_DRAPEAUX, type CleDrapeau } from "./flags.js";
import { creditBalanceSchema, referralSummarySchema, invitationSchema } from "./me-credits.js";
import { metadataSchema } from "./me-app.js";

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
    resume: "Lister ses proches",
    authentifie: true,
    reponse: z.array(personSchema),
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
      "la demande.",
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
    parametres: [{ nom: "id", dans: "path", schema: z.string().uuid(), requis: true }],
    reponse: eventSchema,
  },
  {
    chemin: "/me/events/{id}",
    methode: "patch",
    resume: "Corriger un événement",
    authentifie: true,
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
    ].join("\n"),
    authentifie: true,
    reponse: metadataSchema,
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
      },
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Lehno",
      version: "1",
      description: "L'assistant des dates qui comptent. Le contrat est engendré depuis les schémas Zod de @lehno/contracts — il ne s'écrit pas à la main.",
    },
    servers: [{ url: "https://api.lehno.app/v1" }, { url: "http://localhost:3001/v1", description: "développement" }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    },
    paths,
  };
}
