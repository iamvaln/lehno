import { describe, expect, it } from "vitest";
import {
  createNoteSchema, createNotesSchema, type Occurrence, type Person,
} from "@lehno/contracts";
import {
  MAX_CARACTERES, MAX_PROCHES, ajouteLeProche, candidatsAAjouter, envoiDeLaNote,
  occasionRetenue, occasionsOffertes, peutEnregistrer, retireLeProche, texteUtile,
} from "../lib/note.js";

/* Des identifiants VALIDES au sens du contrat : les schémas exigent des uuid,
   et un test qui poserait « p1 » ne prouverait rien de ce que le serveur
   accepte. */
function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const AWA = uuid(1);
const MALICK = uuid(2);
const ANNIV = uuid(9);

function occasion(champs: Partial<Occurrence> = {}): Occurrence {
  return {
    id: ANNIV,
    eventId: uuid(20),
    personId: AWA,
    personDisplayName: "Awa Sow",
    kind: "birthday",
    nature: "happy",
    label: null,
    occurrenceDate: "2026-09-24",
    occurrenceYear: 2026,
    status: "upcoming",
    daysUntil: 28,
    age: 34,
    ...champs,
  };
}

function proche(champs: Partial<Person> & { id: string; displayName: string }): Person {
  return {
    callingName: null,
    avatarUrl: null,
    isSelf: false,
    relation: null,
    relationHint: null,
    // Nullable en lecture : les fiches antérieures à la règle n'en portent pas.
    gender: null,
    birthDate: null,
    birthYearKnown: false,
    city: null,
    country: null,
    register: null,
    language: null,
    preferredChannel: null,
    createdAt: "2026-08-01T09:00:00.000Z",
    notesCount: 0,
    nextOccurrence: null,
    ...champs,
  };
}

describe("le chemin dit à qui la note appartient", () => {
  /* `/me/notes` existe pour la note qui « n'appartient à aucun proche en
     particulier » — le contrat le dit ainsi. Une note pour une seule personne
     appartient à cette personne : la faire partir par le chemin nu marcherait,
     et dirait le contraire de ce qu'elle est. */
  it("part par le chemin du proche quand il n'y en a qu'un", () => {
    const envoi = envoiDeLaNote("Un moulin à café manuel.", [AWA], null);
    expect(envoi?.chemin).toBe(`/me/persons/${AWA}/notes`);
    expect(envoi?.corps).toEqual({ content: "Un moulin à café manuel." });
  });

  it("passe au chemin partagé dès qu'ils sont deux", () => {
    const envoi = envoiDeLaNote("Ils déménagent en mars.", [AWA, MALICK], null);
    expect(envoi?.chemin).toBe("/me/notes");
    expect(envoi?.corps).toEqual({
      content: "Ils déménagent en mars.",
      personIds: [AWA, MALICK],
    });
  });

  /* Les deux corps sont ceux que le serveur attend, sans quoi le reste de ce
     fichier ne prouverait que notre cohérence avec nous-mêmes. Les schémas sont
     `.strict()` : un champ de trop échoue ici. */
  it("forme des corps que le contrat accepte, chacun sur son chemin", () => {
    const seul = envoiDeLaNote("Une note.", [AWA], ANNIV);
    expect(createNoteSchema.safeParse(seul?.corps).success).toBe(true);

    const partagee = envoiDeLaNote("Une note.", [AWA, MALICK], null);
    expect(createNotesSchema.safeParse(partagee?.corps).success).toBe(true);
    // `personIds` sur le chemin nommé : `.strict()` le refuse, et c'est bien
    // ainsi qu'on saurait s'être trompé de corps.
    expect(createNoteSchema.safeParse(partagee?.corps).success).toBe(false);
  });
});

describe("durable ou de circonstance", () => {
  /* `eventOccurrenceId` nul = note DURABLE. La clé s'AJOUTE ou n'existe pas :
     le schéma la dit `uuid().optional()`, pas nullable. Un `null` posé « pour
     être explicite » ferait refuser tout l'envoi. */
  it("n'écrit aucune clé d'occasion pour une note durable", () => {
    const envoi = envoiDeLaNote("Il n'aime pas les surprises.", [AWA], null);
    expect("eventOccurrenceId" in (envoi?.corps ?? {})).toBe(false);
  });

  it("le contrat refuserait le null qu'on aurait pu écrire à la place", () => {
    expect(createNoteSchema.safeParse({ content: "x", eventOccurrenceId: null }).success).toBe(false);
  });

  it("porte l'occasion quand elle est choisie", () => {
    const envoi = envoiDeLaNote("Prévoir une tenue.", [AWA], ANNIV);
    expect(envoi?.corps).toEqual({ content: "Prévoir une tenue.", eventOccurrenceId: ANNIV });
  });
});

describe("une occasion n'appartient qu'à un proche", () => {
  /* Une échéance porte son `personId`. Partager la note entre deux personnes et
     garder l'occasion poserait, chez la seconde, une note accrochée à une date
     qui n'est pas la sienne. Le contrat laisse passer la combinaison — c'est
     donc au client de ne pas la former. */
  it("tombe dès qu'un second proche est désigné", () => {
    expect(occasionRetenue(ANNIV, [AWA])).toBe(ANNIV);
    expect(occasionRetenue(ANNIV, [AWA, MALICK])).toBeNull();
    expect(occasionRetenue(ANNIV, [])).toBeNull();
  });

  it("l'envoi partagé n'emporte pas l'occasion restée sélectionnée", () => {
    const envoi = envoiDeLaNote("Une idée pour les deux.", [AWA, MALICK], ANNIV);
    expect("eventOccurrenceId" in (envoi?.corps ?? {})).toBe(false);
  });

  /* Le filtre par proche ne se délègue pas au paramètre de requête :
     `/me/occurrences` sert aussi l'accueil, où la liste porte tout le monde. */
  it("n'offre pas l'échéance d'un autre proche", () => {
    const liste = [occasion(), occasion({ id: uuid(10), personId: MALICK })];
    expect(occasionsOffertes(liste, AWA).map((o) => o.id)).toEqual([ANNIV]);
  });

  /* Le jour même compte : c'est justement le jour où l'on note. Hier, non — la
     note n'y serait plus lue par personne. */
  it("garde l'échéance du jour et écarte celle d'hier", () => {
    const liste = [
      occasion({ id: uuid(11), daysUntil: 0 }),
      occasion({ id: uuid(12), daysUntil: -1 }),
    ];
    expect(occasionsOffertes(liste, AWA).map((o) => o.id)).toEqual([uuid(11)]);
  });
});

describe("les bornes sont celles du contrat", () => {
  const texte = "n";

  it("refuse la note sans proche et accepte jusqu'à vingt", () => {
    const vingt = Array.from({ length: MAX_PROCHES }, (_, i) => uuid(100 + i));
    expect(peutEnregistrer(texte, [])).toBe(false);
    expect(peutEnregistrer(texte, vingt)).toBe(true);
    expect(peutEnregistrer(texte, [...vingt, uuid(999)])).toBe(false);

    // Et c'est bien là que le serveur coupe, pas un cran plus loin.
    expect(createNotesSchema.safeParse({ content: texte, personIds: vingt }).success).toBe(true);
    expect(createNotesSchema.safeParse({
      content: texte, personIds: [...vingt, uuid(999)],
    }).success).toBe(false);
  });

  it("refuse une note qui n'est que des blancs", () => {
    expect(texteUtile("   \n  ")).toBe("");
    expect(peutEnregistrer("   \n  ", [AWA])).toBe(false);
    expect(createNoteSchema.safeParse({ content: "   \n  " }).success).toBe(false);
  });

  it("s'arrête au même caractère que le contrat", () => {
    const pleine = "a".repeat(MAX_CARACTERES);
    expect(peutEnregistrer(pleine, [AWA])).toBe(true);
    expect(peutEnregistrer(pleine + "a", [AWA])).toBe(false);
    expect(createNoteSchema.safeParse({ content: pleine }).success).toBe(true);
    expect(createNoteSchema.safeParse({ content: pleine + "a" }).success).toBe(false);
  });

  /* Les blancs comptent-ils dans les 4000 ? Le contrat `trim()` AVANT de
     mesurer : une note de 4000 caractères suivis d'un retour à la ligne passe. */
  it("mesure après avoir retiré les blancs, comme le contrat", () => {
    const limite = "a".repeat(MAX_CARACTERES) + "\n  ";
    expect(peutEnregistrer(limite, [AWA])).toBe(true);
    expect(createNoteSchema.safeParse({ content: limite }).success).toBe(true);
  });

  it("ne forme aucun envoi quand la saisie ne tient pas", () => {
    expect(envoiDeLaNote("", [AWA], null)).toBeNull();
    expect(envoiDeLaNote("Quelque chose", [], null)).toBeNull();
  });
});

describe("désigner les proches", () => {
  /* Un proche désigné deux fois recevrait DEUX notes identiques : la note se
     duplique, une par entrée, et rien ne les rapproche ensuite. */
  it("n'ajoute pas deux fois le même proche", () => {
    expect(ajouteLeProche([AWA], AWA)).toEqual([AWA]);
    expect(ajouteLeProche([AWA], MALICK)).toEqual([AWA, MALICK]);
  });

  it("s'arrête au plafond plutôt que de former un envoi refusé", () => {
    const vingt = Array.from({ length: MAX_PROCHES }, (_, i) => uuid(100 + i));
    expect(ajouteLeProche(vingt, uuid(999))).toEqual(vingt);
  });

  it("retire sans toucher au reste", () => {
    expect(retireLeProche([AWA, MALICK], AWA)).toEqual([MALICK]);
    expect(retireLeProche([AWA], MALICK)).toEqual([AWA]);
  });
});

describe("chercher qui ajouter", () => {
  const carnet = [
    proche({ id: AWA, displayName: "Awa Sow" }),
    proche({ id: MALICK, displayName: "Marie-Ange Nkoulou", callingName: "Maman" }),
    proche({ id: uuid(3), displayName: "Célarine Ndiaye" }),
  ];

  it("écarte ceux qui sont déjà désignés", () => {
    expect(candidatsAAjouter(carnet, [AWA], "", "fr").map((p) => p.id)).toEqual([MALICK, uuid(3)]);
  });

  /* Le nom d'usage compte autant que le nom des listes : qui cherche « maman »
     doit trouver Marie-Ange. Sans cela, le nom qu'on emploie tous les jours est
     précisément celui qui ne trouve rien. */
  it("trouve par le nom d'usage, quelle que soit la casse", () => {
    expect(candidatsAAjouter(carnet, [], "maman", "fr").map((p) => p.id)).toEqual([MALICK]);
    expect(candidatsAAjouter(carnet, [], "SOW", "fr").map((p) => p.id)).toEqual([AWA]);
  });

  /* Au plafond, un nom proposé serait un geste sans effet — pire qu'un choix
     absent. L'écran ferme la liste ; la décision la vide. */
  it("ne propose personne au plafond", () => {
    const vingt = Array.from({ length: MAX_PROCHES }, (_, i) => uuid(100 + i));
    expect(candidatsAAjouter(carnet, vingt, "", "fr")).toEqual([]);
  });
});
