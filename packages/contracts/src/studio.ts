import { z } from "zod";
import { ORIENTATIONS, ORIENTATION_CONSIGNE, type Orientation } from "./gabarits.js";
import { studioConfigSchema, type StudioConfig, type StudioChoice } from "./me-studio.js";

/* Les RÉGLAGES du studio — ce que l'administration compose, publie, et que
 * l'application consomme ensuite par `/me/studio/options`.
 *
 * Trois surfaces se partagent ce fichier, et c'est délibéré :
 *
 * - l'administration les écrit (`/admin/portrait-studio/*`) ;
 * - le serveur en tire ce que l'application voit (`catalogueServi`) ;
 * - la règle de publication en tire son empreinte (`matierePourEmpreinte`).
 *
 * Les trois DOIVENT lire la même forme. Une seconde déclaration côté serveur
 * ou côté back-office divergerait au premier champ ajouté, et la divergence ne
 * se verrait qu'à la publication — c'est-à-dire chez l'utilisateur.
 */

// ── Ce qui se dit dans les deux langues ─────────────────────────────────────

/* Les deux langues sont OBLIGATOIRES ensemble.
 *
 * Un libellé rendu dans une seule langue laisserait l'autre vide à l'écran, et
 * l'application n'a rien pour le combler : elle affiche ce que le serveur
 * rend, sans dictionnaire embarqué (voir me-studio.ts). Rendre `en` facultatif
 * reviendrait donc à autoriser un écran muet pour la moitié du parc. */
const bilingueSchema = z.object({
  fr: z.string().trim().min(1).max(2000),
  en: z.string().trim().min(1).max(2000),
}).strict();

const bilingueFacultatifSchema = bilingueSchema.nullable();

export type Bilingue = z.infer<typeof bilingueSchema>;

// ── Ce que le studio propose ────────────────────────────────────────────────

/* Les trois voies d'image de la §2.2 : une seule à la fois.
 *
 * Elles sont un ensemble ARRÊTÉ, contrairement aux ambiances : ajouter une
 * quatrième voie changerait la composition de l'image, donc le code du
 * serveur. Ce n'est pas un réglage, c'est une livraison — et le prétendre
 * réglable ferait promettre à l'écran d'administration ce que la publication
 * ne saurait pas tenir. */
export const VOIES_IMAGE = ["illustration", "photo", "aucune"] as const;
export type VoieImage = (typeof VOIES_IMAGE)[number];

/* Les ambiances, elles, sont ouvertes : familles d'illustration et styles de
   photo se nomment, se décrivent et s'activent depuis l'administration. Les
   trois noms de style de photo ne sont d'ailleurs PAS tranchés (spec portrait
   §7) — un enum les aurait gelés avant qu'on sache lesquels. */
export const GROUPES_AMBIANCE = ["illustration_family", "photo_style"] as const;
export type GroupeAmbiance = (typeof GROUPES_AMBIANCE)[number];

/* Les deux motifs de la §3.4, et leurs deux emplois. Jamais les deux sur un
   même portrait : c'est le gabarit qui décide lequel s'emploie, pas
   l'utilisateur — d'où deux champs plutôt qu'une liste. */
export const MOTIFS_IDENTITAIRES = ["trame_de_hampes", "registres"] as const;
export type MotifIdentitaire = (typeof MOTIFS_IDENTITAIRES)[number];

/* Les champs du proche que le gabarit a le DROIT de lire.
 *
 * TROIS ABSENTS, et aucun n'est un oubli.
 *
 * `nom_dusage` est ce à quoi le message s'adresse : sans lui il n'y a personne
 * à qui écrire. `registre` et l'accord grammatical décident de la FORME de
 * chaque phrase, pas de sa matière — les couper ne retirerait rien de la
 * consigne, ça la rendrait bancale. Les rejets (`dislikes_nogo`) sont une
 * INTERDICTION, pas une matière : les rendre décochables permettrait de
 * publier un réglage qui laisse un modèle parler de ce que la personne
 * déteste, et c'est justement la faute que la §4.1 range à part.
 *
 * Ne figure donc ici que ce que l'invite sait réellement OMETTRE, sans laisser
 * de ligne vide derrière elle. */
export const CHAMPS_DU_PROCHE = ["relation", "age", "notes", "texte_libre"] as const;
export type ChampDuProche = (typeof CHAMPS_DU_PROCHE)[number];

/* Le modèle appelé, sous la forme « fournisseur:clé ».
 *
 * C'est l'unicité que porte `ai_model`, et celle du registre en code
 * (MODELES_IA). Une troisième forme ici — deux champs séparés, par exemple —
 * obligerait à recomposer la clé à chaque comparaison, et une recomposition
 * fautive ne se verrait qu'au premier essai. */
const cleModeleSchema = z.string().regex(/^[a-z0-9_-]+:[A-Za-z0-9._-]+$/, "forme attendue : fournisseur:modèle");

export const orientationReglageSchema = z.object({
  id: z.enum(ORIENTATIONS),
  /** Lu par l'application seule : désactiver fait disparaître sans livraison. */
  actif: z.boolean(),
  libelle: bilingueSchema,
  description: bilingueFacultatifSchema,
  /** L'avertissement affiché AU MOMENT du choix — l'hommage change le gabarit. */
  avertissement: bilingueFacultatifSchema,
  /** Lu par le modèle : entre dans l'empreinte. */
  consigne: bilingueSchema,
}).strict();

export const ambianceReglageSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,60}$/),
  groupe: z.enum(GROUPES_AMBIANCE),
  actif: z.boolean(),
  libelle: bilingueSchema,
  description: bilingueFacultatifSchema,
  /** Lu par le modèle : entre dans l'empreinte. */
  consigne: bilingueSchema,
}).strict();

/* Une voie d'image ne porte AUCUNE consigne : elle n'apprend rien au modèle.
   C'est l'ambiance choisie derrière elle qui parle, et la voie « aucune » ne
   fait même pas d'appel. Lui donner un champ de consigne inviterait à écrire
   une instruction que rien ne lirait. */
export const voieImageReglageSchema = z.object({
  id: z.enum(VOIES_IMAGE),
  actif: z.boolean(),
  libelle: bilingueSchema,
  description: bilingueFacultatifSchema,
}).strict();

/* DEUX CONFIGURATIONS, ET NON UNE.
 *
 * Elles n'ont vécu ensemble que par accident d'écriture, et ça coûtait deux
 * choses qu'on ne voyait pas :
 *
 * 1. UNE SEULE EMPREINTE pour les deux. Reformuler un garde-fou du message
 *    faisait retomber les essais du portrait, et modifier un style de dessin
 *    faisait retomber ceux du message. Chaque réglage rendait l'autre à
 *    éprouver, sans qu'aucun des deux n'ait changé.
 *
 * 2. PIRE : l'essai du studio appelle le modèle du MESSAGE. Publier un
 *    changement de style de dessin se débloquait donc avec un essai qui avait
 *    produit un texte — on mettait en service un portrait que personne n'avait
 *    vu. C'est exactement la faute que la règle « rien ne se publie sans
 *    essai » existe pour empêcher, et elle passait par le trou entre les deux
 *    générations.
 *
 * Chacune a désormais sa ligne, son empreinte, ses essais et sa publication. */

export const reglagesMessageSchema = z.object({
  /** Ce qui s'ajoute à la consigne système, en plus des règles absolues. */
  consigneCommune: z.string().trim().max(4000),
  /** Ce qui est écarté : symboles, formules, tournures. */
  gardeFous: z.array(z.string().trim().min(1).max(200)).max(40),
  champsDuProche: z.array(z.enum(CHAMPS_DU_PROCHE)),
  /** Le modèle appelé par génération. Voir la note de `cleModeleSchema`. */
  modele: cleModeleSchema,
  /* L'ORDRE DU TABLEAU EST L'ORDRE DE L'ÉCRAN, et le premier actif est le
     défaut. Deux champs — un ordre et un défaut désigné — laisseraient un
     défaut pointer sur une orientation qu'on vient de désactiver ; l'écran
     s'ouvrirait alors sans sélection. Ici l'invariant est tenu par
     construction, et l'administration règle le défaut en réordonnant, ce
     qu'elle fait déjà. */
  orientations: z.array(orientationReglageSchema).min(1),
}).strict().superRefine((r, ctx) => {
  const vus = new Set<string>();
  for (const o of r.orientations) {
    if (vus.has(o.id))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["orientations"], message: `« ${o.id} » figure deux fois` });
    vus.add(o.id);
  }
  /* Aucune orientation active vaut un écran de studio VIDE : l'utilisateur
     n'aurait rien à choisir et ne pourrait pas produire. On le refuse ici
     plutôt qu'à la publication — sinon le brouillon s'enregistrerait, et le
     refus tomberait après la dépense d'un essai. */
  if (!r.orientations.some((o) => o.actif))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["orientations"], message: "au moins une orientation doit rester active" });
});

export const reglagesPortraitSchema = z.object({
  motifs: z.object({
    /** Le seul qui accepte du texte par-dessus (§3.4). */
    bande: z.enum(MOTIFS_IDENTITAIRES),
    fondSansImage: z.enum(MOTIFS_IDENTITAIRES),
  }).strict(),
  modeles: z.object({
    illustration: cleModeleSchema,
    photo_style: cleModeleSchema,
  }).strict(),
  voiesImage: z.array(voieImageReglageSchema).min(1),
  ambiances: z.array(ambianceReglageSchema),
}).strict().superRefine((r, ctx) => {
  const doublon = (ids: string[]): string | null => {
    const vus = new Set<string>();
    for (const id of ids) { if (vus.has(id)) return id; vus.add(id); }
    return null;
  };
  for (const [chemin, ids] of [
    ["voiesImage", r.voiesImage.map((v) => v.id)],
    ["ambiances", r.ambiances.map((a) => a.id)],
  ] as const) {
    const d = doublon([...ids]);
    if (d) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [chemin], message: `« ${d} » figure deux fois` });
  }
});

export type OrientationReglage = z.infer<typeof orientationReglageSchema>;
export type AmbianceReglage = z.infer<typeof ambianceReglageSchema>;
export type VoieImageReglage = z.infer<typeof voieImageReglageSchema>;
export type ReglagesMessage = z.infer<typeof reglagesMessageSchema>;
export type ReglagesPortrait = z.infer<typeof reglagesPortraitSchema>;

// ── L'empreinte : ce que le modèle lit, et rien d'autre ─────────────────────

/* La projection sur la partie LUE PAR LE MODÈLE (brief fonctionnel §3).
 *
 * Ce qui en sort commande la règle de publication : deux configurations de
 * même empreinte partagent leur couverture d'essai. Ce qui n'y entre pas —
 * libellés, ordre, activation — s'enregistre donc sans repasser par une
 * prévisualisation.
 *
 * DEUX PIÈGES, et ils sont symétriques.
 *
 * Faire entrer un libellé dans l'empreinte rendrait la §3 inapplicable : on
 * redemanderait de valider une image identique à la précédente, et une
 * validation qui ne prouve rien s'apprend très vite à cliquer sans regarder.
 *
 * En faire sortir une consigne serait pire : on publierait un texte que
 * personne n'a vu tourner, sur la foi d'un essai passé avec un autre. La règle
 * serait vraie au dossier et fausse en fait.
 *
 * D'où le tri, champ par champ, plutôt qu'un hachage de `settings` entier.
 */
/* La projection du MESSAGE sur ce que le modèle lit. */
export function partieLueParLeModeleMessage(r: ReglagesMessage): unknown {
  return {
    consigneCommune: r.consigneCommune,
    /* NI `gardeFous` NI `champsDuProche` ne se trient : leur ordre est celui
       dans lequel ils partent dans l'invite, donc il change le texte reçu par
       le modèle. Les trier ferait passer pour identiques deux consignes qui ne
       le sont pas. */
    gardeFous: r.gardeFous,
    champsDuProche: r.champsDuProche,
    modele: r.modele,
    /* Les orientations, elles, SE TRIENT — par identifiant, jamais par
       position. Leur position est l'ordre de l'écran, c'est-à-dire justement
       ce que la §3 range du côté de l'application. Sans ce tri, remonter une
       orientation d'un cran demanderait un nouvel essai. */
    orientations: [...r.orientations]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((o) => ({ id: o.id, consigne: o.consigne })),
  };
}

/* Et celle du PORTRAIT. Séparées, donc indépendantes : reformuler un garde-fou
   du message ne fait plus retomber les essais du portrait, et l'inverse non
   plus. */
export function partieLueParLeModelePortrait(r: ReglagesPortrait): unknown {
  return {
    motifs: r.motifs,
    modeles: r.modeles,
    ambiances: [...r.ambiances]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((a) => ({ id: a.id, groupe: a.groupe, consigne: a.consigne })),
  };
}

/* La sérialisation canonique : clés triées, à toute profondeur.
 *
 * `JSON.stringify` suit l'ordre d'insertion des clés. Deux réglages identiques
 * composés dans un ordre différent — l'un venu du formulaire, l'autre relu de
 * la base — rendraient donc deux chaînes différentes, donc deux empreintes, et
 * la publication réclamerait un essai pour un changement qui n'existe pas. */
function canonique(valeur: unknown): string {
  if (valeur === null || typeof valeur !== "object") return JSON.stringify(valeur) ?? "null";
  if (Array.isArray(valeur)) return `[${valeur.map(canonique).join(",")}]`;
  const entrees = Object.entries(valeur as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entrees.map(([c, v]) => `${JSON.stringify(c)}:${canonique(v)}`).join(",")}}`;
}

/** La matière dont l'empreinte se calcule. Le hachage lui-même vit au serveur. */
export function matierePourEmpreinteMessage(r: ReglagesMessage): string {
  return canonique(partieLueParLeModeleMessage(r));
}

export function matierePourEmpreintePortrait(r: ReglagesPortrait): string {
  return canonique(partieLueParLeModelePortrait(r));
}

// ── Ce que l'application reçoit ─────────────────────────────────────────────

const GROUPE_ORIENTATION = "orientation";
const GROUPE_IMAGE = "image";

/** Le groupe qu'une voie d'image ouvre. `aucune` n'ouvre rien : c'est la fin. */
const GROUPE_OUVERT: Record<VoieImage, GroupeAmbiance | null> = {
  illustration: "illustration_family",
  photo: "photo_style",
  aucune: null,
};

/* Les réglages, projetés en ce que l'application affiche.
 *
 * C'est ici que « désactiver fait disparaître sans livraison » devient vrai :
 * l'inactif ne franchit pas cette fonction, donc n'atteint jamais un écran.
 *
 * Les libellés sortent DÉJÀ RÉSOLUS dans la langue demandée. Rendre les deux
 * langues et laisser choisir le client obligerait chaque application installée
 * à savoir quoi faire d'une troisième langue le jour où elle arrivera — et
 * elles ne se mettent pas à jour d'un bloc (voir me-studio.ts).
 */
/* Le catalogue servi à l'application réunit les DEUX configurations : les
   orientations viennent du message, les voies et les ambiances du portrait.
   C'est le seul endroit où elles se rejoignent, et il est en lecture — chacune
   se règle, s'éprouve et se publie de son côté. */
export function catalogueServi(
  m: ReglagesMessage, p: ReglagesPortrait, langue: "fr" | "en",
): StudioConfig {
  const r = { ...m, ...p };
  const dit = (b: Bilingue): string => b[langue];
  const ditOuNul = (b: Bilingue | null): string | null => (b === null ? null : b[langue]);

  const ambiancesActives = (groupe: GroupeAmbiance): StudioChoice[] =>
    r.ambiances
      .filter((a) => a.groupe === groupe && a.actif)
      .map((a) => ({
        id: a.id, label: dit(a.libelle), description: ditOuNul(a.description),
        warning: null, revealsGroup: null,
      }));

  const orientations: StudioChoice[] = r.orientations
    .filter((o) => o.actif)
    .map((o) => ({
      id: o.id, label: dit(o.libelle), description: ditOuNul(o.description),
      warning: ditOuNul(o.avertissement), revealsGroup: null,
    }));

  /* Le schéma des réglages refuse déjà zéro orientation active. On le
     revérifie ici parce que cette fonction sert aussi des réglages relus de la
     base, écrits par une version antérieure du schéma : rendre un groupe vide
     ferait tomber le `parse` final sur un message qui parle de `choices`, là
     où le défaut est ailleurs. */
  if (orientations.length === 0)
    throw new Error("aucune orientation active : le studio n'a rien à proposer");

  const groupes: StudioConfig["groups"] = [{
    id: GROUPE_ORIENTATION,
    label: langue === "fr" ? "Ce que vous voulez dire" : "What you want to say",
    defaultChoiceId: orientations[0]!.id,
    choices: orientations,
  }];

  const ambiancesParGroupe = new Map<GroupeAmbiance, StudioChoice[]>(
    GROUPES_AMBIANCE.map((g) => [g, ambiancesActives(g)]),
  );

  /* Une voie active dont le groupe d'ambiances est VIDE se retire avec lui.
   *
   * La garder produirait un choix qui ouvre un groupe inexistant — le contrat
   * le refuse (voir le superRefine de studioConfigSchema), et à l'écran ça
   * donnerait « une photo », puis rien. C'est l'état du jour : les trois noms
   * de style de photo ne sont pas tranchés, donc la voie photo ne s'affiche
   * pas, et elle apparaîtra le jour où on les saisira — sans livraison. */
  const voies: StudioChoice[] = r.voiesImage
    .filter((v) => v.actif)
    .filter((v) => {
      const ouvert = GROUPE_OUVERT[v.id];
      return ouvert === null || (ambiancesParGroupe.get(ouvert)?.length ?? 0) > 0;
    })
    .map((v) => ({
      id: v.id, label: dit(v.libelle), description: ditOuNul(v.description),
      warning: null, revealsGroup: GROUPE_OUVERT[v.id],
    }));

  const racines = [GROUPE_ORIENTATION];

  if (voies.length > 0) {
    groupes.push({
      id: GROUPE_IMAGE,
      label: langue === "fr" ? "L'image" : "The image",
      defaultChoiceId: voies[0]!.id,
      choices: voies,
    });
    racines.push(GROUPE_IMAGE);

    for (const groupe of GROUPES_AMBIANCE) {
      const choix = ambiancesParGroupe.get(groupe) ?? [];
      // Un groupe que plus aucune voie n'ouvre ne se sert pas : il ne serait
      // atteignable par personne, et l'écran le porterait pour rien.
      if (choix.length === 0) continue;
      if (!voies.some((v) => v.revealsGroup === groupe)) continue;
      groupes.push({
        id: groupe,
        label: groupe === "illustration_family"
          ? (langue === "fr" ? "La famille d'illustration" : "Illustration family")
          : (langue === "fr" ? "Le style de la photo" : "Photo style"),
        defaultChoiceId: choix[0]!.id,
        choices: choix,
      });
    }
  }

  // Le contrat se revérifie ici : une projection fautive doit tomber au
  // serveur, pas se découvrir à l'écran d'un utilisateur.
  return studioConfigSchema.parse({ groups: groupes, rootGroupIds: racines });
}

// ── Le point de départ, en code ─────────────────────────────────────────────

/* Les libellés des douze orientations. La spec §2.1 les énumère en français ;
   l'anglais est ici parce que le catalogue se sert dans les deux langues et
   qu'un libellé manquant laisserait l'écran vide de ce côté-là. */
const LIBELLES: Record<Orientation, { libelle: Bilingue; description: Bilingue }> = {
  notre_relation: {
    libelle: { fr: "Notre relation", en: "Our relationship" },
    description: { fr: "Ce que vous êtes l'un pour l'autre", en: "What you are to each other" },
  },
  ce_qui_te_caracterise: {
    libelle: { fr: "Ce qui te caractérise", en: "What makes you you" },
    description: { fr: "Ce qui le rend reconnaissable", en: "What makes them recognisable" },
  },
  ma_gratitude: {
    libelle: { fr: "Ma gratitude", en: "My gratitude" },
    description: { fr: "Ce que vous lui devez", en: "What you owe them" },
  },
  ma_fierte: {
    libelle: { fr: "Ma fierté", en: "My pride" },
    description: { fr: "Ce dont vous êtes fier pour lui", en: "What you are proud of on their behalf" },
  },
  mon_affection: {
    libelle: { fr: "Mon affection", en: "My affection" },
    description: { fr: "Une déclaration, dans son registre", en: "A declaration, in their register" },
  },
  tes_progres: {
    libelle: { fr: "Tes progrès", en: "Your progress" },
    description: { fr: "Ce qu'il a accompli cette année", en: "What they achieved this year" },
  },
  nos_progres: {
    libelle: { fr: "Nos progrès", en: "Our progress" },
    description: { fr: "Ce que la relation est devenue", en: "What the relationship has become" },
  },
  ce_que_tu_mas_appris: {
    libelle: { fr: "Ce que tu m'as appris", en: "What you taught me" },
    description: { fr: "Ce qu'il vous a transmis", en: "What they passed on to you" },
  },
  un_voeu: {
    libelle: { fr: "Un vœu", en: "A wish" },
    description: { fr: "Ce que vous lui souhaitez pour l'année qui vient", en: "What you wish them for the year ahead" },
  },
  une_motivation: {
    libelle: { fr: "Une motivation", en: "Encouragement" },
    description: { fr: "Un élan pour ce qui vient", en: "Momentum for what is ahead" },
  },
  un_soutien: {
    libelle: { fr: "Un soutien", en: "Support" },
    description: { fr: "Un accompagnement dans ce qu'il traverse", en: "Standing alongside what they are going through" },
  },
  un_hommage: {
    libelle: { fr: "Un hommage", en: "A tribute" },
    description: { fr: "Pour une mémoire, une absence", en: "For a memory, an absence" },
  },
};

/* L'hommage est le seul à porter un avertissement, et c'est la §2.1 qui le
   veut : il neutralise l'abricot, écarte l'illustration joyeuse et emprunte un
   registre propre. L'apprendre APRÈS la génération ferait perdre un crédit —
   d'où l'avertissement au moment du choix, et non dans le résultat. */
const AVERTISSEMENT_HOMMAGE: Bilingue = {
  fr: "Registre sobre, sans réjouissance : l'illustration et les couleurs changent.",
  en: "A sober register, no celebration: the illustration and colours change.",
};

const AMBIANCES_DE_DEPART: AmbianceReglage[] = [
  {
    id: "nature", groupe: "illustration_family", actif: true,
    libelle: { fr: "Nature", en: "Nature" },
    description: {
      fr: "Un paysage, une fleur, un élément. Pour qui est calme, enraciné, tourné vers le dehors.",
      en: "A landscape, a flower, an element. For the calm, the rooted, those turned outward.",
    },
    consigne: {
      fr: "Composez un élément naturel — paysage, fleur, matière. Une forme et une ambiance, jamais une scène racontée.",
      en: "Compose a natural element — landscape, flower, material. A shape and a mood, never a narrated scene.",
    },
  },
  {
    id: "animal", groupe: "illustration_family", actif: true,
    libelle: { fr: "Animal", en: "Animal" },
    description: {
      fr: "Un animal qu'il aime s'il figure dans les notes, sinon un qui correspond à son caractère.",
      en: "An animal they love if the notes name one, otherwise one that matches their character.",
    },
    consigne: {
      fr: "Composez un animal. Employez celui que les notes nomment ; à défaut, choisissez-en un qui réponde au caractère décrit. N'inventez aucun détail biographique.",
      en: "Compose an animal. Use the one the notes name; failing that, pick one that answers the character described. Invent no biographical detail.",
    },
  },
  {
    id: "abstrait", groupe: "illustration_family", actif: true,
    libelle: { fr: "Abstrait", en: "Abstract" },
    description: {
      fr: "Des formes, un mouvement, une lumière. Pour qui échappe aux deux autres.",
      en: "Shapes, movement, light. For those the other two do not fit.",
    },
    consigne: {
      fr: "Composez des formes, un mouvement, une lumière. Aucune figure reconnaissable, aucun décor.",
      en: "Compose shapes, movement, light. No recognisable figure, no setting.",
    },
  },
  /* AUCUN STYLE DE PHOTO n'est semé, et ce n'est pas un oubli : leurs trois
     noms ne sont pas tranchés (spec portrait §7). En inventer ferait publier
     un vocabulaire que la marque n'a pas choisi, et que l'écran montrerait
     comme s'il faisait foi. La voie « photo » reste donc inactive ; elle
     apparaîtra le jour où on les saisira, sans livraison. */
];

/* Les réglages de départ, tirés du registre des gabarits.
 *
 * Même raison que le catalogue des modèles : sans point de départ en code,
 * `/me/studio/options` rendrait un catalogue vide au premier démarrage, et
 * l'écran du studio n'aurait rien à proposer. Le principe « on ne garde que ce
 * qu'on a vu tourner » gouverne ce qu'un ADMINISTRATEUR retient ; il ne peut
 * pas gouverner l'état d'un serveur que personne n'a encore ouvert.
 *
 * LES CONSIGNES VIENNENT DE `gabarits.ts`, elles ne sont pas recopiées : deux
 * exemplaires du même texte divergeraient au premier ajustement, et on
 * chercherait longtemps pourquoi l'essai ne rend pas ce que la production
 * rend. */
export function reglagesMessageDeDepart(): ReglagesMessage {
  return reglagesMessageSchema.parse({
    consigneCommune: "",
    gardeFous: [],
    /* L'âge est ABSENT du défaut : la §2.5 le veut « seulement si
       l'utilisateur l'a demandé », et le gabarit interdit de le mentionner
       sans qu'on le lui donne. L'activer par défaut ferait dire l'âge de
       quelqu'un à qui personne ne l'a demandé. */
    champsDuProche: ["relation", "notes", "texte_libre"],
    modele: "anthropic:claude-opus-5",
    // L'ordre est celui de ORIENTATIONS — celui de l'écran, pas celui de la
    // table de la §2.1. Voir le commentaire du registre.
    orientations: ORIENTATIONS.map((id) => ({
      id,
      actif: true,
      libelle: LIBELLES[id].libelle,
      description: LIBELLES[id].description,
      avertissement: id === "un_hommage" ? AVERTISSEMENT_HOMMAGE : null,
      consigne: ORIENTATION_CONSIGNE[id],
    })),
  });
}

export function reglagesPortraitDeDepart(): ReglagesPortrait {
  return reglagesPortraitSchema.parse({
    motifs: { bande: "trame_de_hampes", fondSansImage: "registres" },
    modeles: {
      illustration: "xai:grok-imagine-image",
      photo_style: "xai:grok-imagine-image",
    },
    voiesImage: [
      {
        id: "illustration", actif: true,
        libelle: { fr: "Une illustration", en: "An illustration" },
        description: { fr: "Composée à partir de ce qu'on sait de lui", en: "Composed from what we know about them" },
      },
      {
        // Inactive tant que les trois styles n'ont pas de nom (§7). Une voie
        // sans ambiance derrière elle mènerait à un écran sans suite.
        id: "photo", actif: false,
        libelle: { fr: "Une photo traitée", en: "A treated photo" },
        description: { fr: "Jamais une photo brute ; toujours un style appliqué", en: "Never a raw photo; always a style applied" },
      },
      {
        id: "aucune", actif: true,
        libelle: { fr: "Aucune image", en: "No image" },
        description: { fr: "Le motif de marque tient tout le fond", en: "The brand motif holds the whole background" },
      },
    ],
    ambiances: AMBIANCES_DE_DEPART,
  });
}
