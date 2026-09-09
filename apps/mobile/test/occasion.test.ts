import { describe, expect, it } from "vitest";
import {
  createWishSchema, updateWishSchema,
  type GeneratedMessage, type Generation, type GenerationResult, type Note,
  type Occurrence, type ReceivedWish, type Wish,
} from "@lehno/contracts";
import {
  corpsDeRetenu, corpsDuSouhait, estPassee, etatDuSouhait, identifiantDOccasion,
  ideesDeLOccasion, messageDeLOccasion, montreLeBlocDesSouhaits, montreLesSouhaits,
  montreLesVoeux, notesDeLOccasion, offreToutLaWishlist, socleEnPied, souhaitsMontres,
  voeuxDeLOccasion,
} from "../lib/occasion.js";

const uuid = (n: number): string =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

const OCCASION = uuid(1);
const AUTRE = uuid(2);

const occasion = (jours: number, nature: Occurrence["nature"] = "happy"): Occurrence => ({
  id: OCCASION,
  eventId: uuid(10),
  personId: uuid(20),
  personDisplayName: "Valery",
  kind: "birthday",
  nature,
  label: null,
  occurrenceDate: "2026-08-24",
  occurrenceYear: 2026,
  status: "upcoming",
  daysUntil: jours,
  age: 36,
});

const note = (n: number, vise: string | null, quand: string): Note => ({
  id: uuid(100 + n),
  personId: uuid(20),
  content: `note ${n}`,
  eventOccurrenceId: vise,
  categories: [],
  createdAt: quand,
});

const message = (
  n: number, vise: string, statut: GeneratedMessage["status"], quand: string,
): GeneratedMessage => ({
  id: uuid(200 + n),
  occurrenceId: vise,
  content: `texte ${n}`,
  contentShort: null,
  status: statut,
  createdAt: quand,
  updatedAt: quand,
});

/* La liste des générations sert `{ generation, message }` : le client suit UN
   seul objet, et l'écran a besoin des deux — le texte pour le montrer,
   l'identifiant de l'exécution pour l'ouvrir. */
const execution = (
  n: number, kind: Generation["kind"], vise: string | null,
  statut: Generation["status"], quand: string,
): Generation => ({
  id: uuid(300 + n),
  kind,
  personId: null,
  occurrenceId: vise,
  status: statut,
  creditsSpent: 1,
  failureReason: null,
  resultId: null,
  createdAt: quand,
});

const produit = (m: GeneratedMessage): GenerationResult => ({
  generation: {
    ...execution(0, "wish_message", m.occurrenceId, "succeeded", m.createdAt),
    /* L'exécution et son message ne portent PAS le même identifiant. « Voir »
       ouvre l'EXÉCUTION : les confondre ferait passer le test sans rien
       prouver, et l'écran ouvrirait un 404 en production. */
    id: `9${m.id.slice(1)}`,
  },
  message: m,
});

const enCours = (n: number, vise: string, quand: string): GenerationResult => ({
  generation: execution(n, "wish_message", vise, "running", quand),
  message: null,
});

const souhait = (n: number, quoi: string, reste: Partial<Wish> = {}): Wish => ({
  id: uuid(400 + n),
  occurrenceId: OCCASION,
  label: quoi,
  link: null,
  imageUrl: null,
  details: null,
  price: null,
  currency: null,
  status: "available",
  origin: "owner",
  isShortlisted: false,
  reservedByName: null,
  ...reste,
});

const voeu = (
  n: number, vise: string, statut: ReceivedWish["status"], quand: string,
): ReceivedWish => ({
  id: uuid(500 + n),
  occurrenceId: vise,
  authorName: `Rose ${n}`,
  content: `vœu ${n}`,
  status: statut,
  createdAt: quand,
});

describe("avant ou après", () => {
  it("une échéance à venir n'est pas passée", () => {
    expect(estPassee(occasion(3))).toBe(false);
  });

  // Le jour même se prépare encore : on peut souhaiter le matin pour le soir.
  it("le jour même n'est pas passé", () => {
    expect(estPassee(occasion(0))).toBe(false);
  });

  it("un décompte négatif est passé", () => {
    expect(estPassee(occasion(-1))).toBe(true);
  });

  /* LE PIÈGE QUE LE DÉCOMPTE ÉVITE. Le statut parle de la COLLECTE, pas de la
     date : une collecte peut se fermer avant le jour, ou rester ouverte après.
     S'y fier montrerait le bloc de préparation sur une date écoulée, ou le
     retirerait la veille. */
  it("ne se fie pas au statut de collecte", () => {
    expect(estPassee({ ...occasion(3), status: "closed" })).toBe(false);
    expect(estPassee({ ...occasion(-3), status: "collecting" })).toBe(true);
  });
});

describe("les notes de cette célébration", () => {
  /* Une note DURABLE décrit le proche et vaut d'une année sur l'autre. La
     montrer ici la ferait paraître écrite pour cette date, et elle
     reviendrait chaque année sous un titre qui la dément. */
  it("écarte les notes durables", () => {
    const liste = notesDeLOccasion([note(1, null, "2026-01-01"), note(2, OCCASION, "2026-01-02")], OCCASION);
    expect(liste.map((n) => n.id)).toEqual([uuid(102)]);
  });

  it("écarte les notes d'une autre occasion", () => {
    const liste = notesDeLOccasion([note(1, AUTRE, "2026-01-01")], OCCASION);
    expect(liste).toEqual([]);
  });

  it("rend la plus récente d'abord", () => {
    const liste = notesDeLOccasion([
      note(1, OCCASION, "2026-01-01"),
      note(3, OCCASION, "2026-03-01"),
      note(2, OCCASION, "2026-02-01"),
    ], OCCASION);
    expect(liste.map((n) => n.content)).toEqual(["note 3", "note 2", "note 1"]);
  });

  it("ne rend rien plutôt que de se rabattre sur les durables", () => {
    expect(notesDeLOccasion([note(1, null, "2026-01-01")], OCCASION)).toEqual([]);
  });
});

describe("ce qui a été écrit pour cette occasion", () => {
  it("ne trouve rien quand rien n'a été écrit", () => {
    expect(messageDeLOccasion([], OCCASION)).toBeNull();
  });

  it("ignore ce qui vise une autre occasion", () => {
    expect(messageDeLOccasion([produit(message(1, AUTRE, "sent", "2026-01-01"))], OCCASION)).toBeNull();
  });

  // Une exécution en cours n'a pas encore de résultat : le contrat rend le
  // message nul tant qu'elle tourne, et la liste en porte donc.
  it("traverse les exécutions sans résultat", () => {
    const trouve = messageDeLOccasion(
      [enCours(9, OCCASION, "2026-02-01"), produit(message(1, OCCASION, "generated", "2026-01-01"))],
      OCCASION,
    );
    expect(trouve?.etat).toBe("pret");
  });

  it("rend le plus récent des brouillons", () => {
    const trouve = messageDeLOccasion([
      produit(message(1, OCCASION, "generated", "2026-01-01")),
      produit(message(2, OCCASION, "edited", "2026-02-01")),
    ], OCCASION);
    expect(trouve?.message.content).toBe("texte 2");
    expect(trouve?.etat).toBe("pret");
  });

  /* « Un message envoyé puis regénéré reste envoyé. » Montrer le brouillon plus
     récent ferait croire qu'il reste quelque chose à faire — et pousserait à
     renvoyer un mot que le proche a déjà reçu. */
  it("l'envoyé prime sur un brouillon plus récent", () => {
    const trouve = messageDeLOccasion([
      produit(message(1, OCCASION, "sent", "2026-01-01")),
      produit(message(2, OCCASION, "generated", "2026-06-01")),
    ], OCCASION);
    expect(trouve?.message.content).toBe("texte 1");
    expect(trouve?.etat).toBe("envoye");
  });

  // Ajusté mais pas envoyé reste PRÊT : la retouche ne change pas ce qu'il
  // reste à faire, seulement la provenance.
  it("un texte ajusté est un texte prêt", () => {
    const trouve = messageDeLOccasion([produit(message(1, OCCASION, "edited", "2026-01-01"))], OCCASION);
    expect(trouve?.etat).toBe("pret");
  });
});

describe("les sections qui ne paraissent pas toujours", () => {
  it("les souhaits suivent leur drapeau", () => {
    expect(montreLesSouhaits(["wishlist"], occasion(3))).toBe(true);
    expect(montreLesSouhaits([], occasion(3))).toBe(false);
  });

  /* LA RÈGLE QU'AUCUN DRAPEAU NE RATTRAPE. Une occasion sensible se prépare
     « sans cadeau » : proposer une liste de souhaits pour un deuil serait une
     faute, drapeau allumé ou non. */
  it("les souhaits se taisent sur une occasion sensible, drapeau allumé", () => {
    expect(montreLesSouhaits(["wishlist"], occasion(3, "sensitive"))).toBe(false);
  });

  it("les vœux reçus suivent le leur", () => {
    expect(montreLesVoeux(["wishes"])).toBe(true);
    expect(montreLesVoeux([])).toBe(false);
  });

  // Au lancement les deux sont éteints : l'occasion se réduit aux notes et à
  // la préparation, et c'est le cas NOMINAL, pas une variante dégradée.
  it("au lancement, ni souhaits ni vœux", () => {
    const LANCEMENT = ["collect", "referral", "topup.manual", "generation.message"];
    expect(montreLesSouhaits(LANCEMENT, occasion(3))).toBe(false);
    expect(montreLesVoeux(LANCEMENT)).toBe(false);
  });
});

describe("l'exécution derrière le texte", () => {
  /* « Voir » ouvre `/generation`, qui s'observe par identifiant d'EXÉCUTION.
     Rendre celui du message ferait ouvrir une génération qui n'existe pas. */
  it("rend l'identifiant de l'exécution, pas celui du message", () => {
    const m = message(1, OCCASION, "generated", "2026-01-01");
    const trouve = messageDeLOccasion([produit(m)], OCCASION);
    expect(trouve?.generationId).not.toBe(m.id);
    expect(trouve?.generationId).toBe(`9${m.id.slice(1)}`);
  });
});

describe("les idées déjà trouvées", () => {
  it("ne trouve rien quand rien n'a été lancé", () => {
    expect(ideesDeLOccasion([], OCCASION)).toBeNull();
  });

  it("rend l'exécution aboutie de cette occasion", () => {
    const gen = execution(1, "gift_ideas", OCCASION, "succeeded", "2026-01-01");
    expect(ideesDeLOccasion([{ generation: gen, message: null }], OCCASION)).toBe(gen.id);
  });

  /* Une exécution QUI TOURNE n'a rien à revoir, et une qui a ÉCHOUÉ a rendu son
     crédit : offrir « Revoir les idées » mènerait à un écran sans contenu, et
     surtout retirerait « Trouver des idées » — le seul geste qui reste. */
  it("ignore ce qui tourne encore ou a échoué", () => {
    const attente = execution(2, "gift_ideas", OCCASION, "running", "2026-01-01");
    const rate = execution(3, "gift_ideas", OCCASION, "failed", "2026-02-01");
    expect(ideesDeLOccasion([
      { generation: attente, message: null },
      { generation: rate, message: null },
    ], OCCASION)).toBeNull();
  });

  it("ne prend pas un message pour des idées", () => {
    const gen = execution(4, "wish_message", OCCASION, "succeeded", "2026-01-01");
    expect(ideesDeLOccasion([{ generation: gen, message: null }], OCCASION)).toBeNull();
  });

  it("ignore une autre occasion", () => {
    const gen = execution(5, "gift_ideas", AUTRE, "succeeded", "2026-01-01");
    expect(ideesDeLOccasion([{ generation: gen, message: null }], OCCASION)).toBeNull();
  });
});

describe("l'état d'un souhait de proche", () => {
  it("déjà offert l'emporte", () => {
    expect(etatDuSouhait({ status: "fulfilled", isShortlisted: true })).toBe("offert");
  });

  it("retenu est le repère personnel", () => {
    expect(etatDuSouhait({ status: "available", isShortlisted: true })).toBe("retenu");
  });

  /* PAS ENCORE RETENU N'EST PAS REJETÉ. Le kit dessine un « Écarté » qu'aucun
     champ du contrat ne porte : le déduire d'un `isShortlisted` faux dirait à
     l'écran qu'on a refusé une idée qu'on n'a fait que ne pas trancher. */
  it("ce qui n'est pas retenu reste à étudier", () => {
    expect(etatDuSouhait({ status: "available", isShortlisted: false })).toBe("a_etudier");
  });

  /* Le serveur ne pose JAMAIS `reserved` sur un souhait de proche — une
     réservation vise un `OwnerWish`. Lui donner un rendu à part dessinerait un
     état que rien ne peut produire. */
  it("un réservé se lit comme à étudier, faute de pouvoir exister", () => {
    expect(etatDuSouhait({ status: "reserved", isShortlisted: false })).toBe("a_etudier");
  });
});

describe("trois lignes, et le reste sur demande", () => {
  const quatre = [1, 2, 3, 4].map((n) => souhait(n, `souhait ${n}`));

  it("s'arrête à trois", () => {
    expect(souhaitsMontres(quatre, false)).toHaveLength(3);
  });

  it("montre tout une fois déplié", () => {
    expect(souhaitsMontres(quatre, true)).toHaveLength(4);
  });

  it("n'offre le dépliage que s'il reste à voir", () => {
    expect(offreToutLaWishlist(quatre, false)).toBe(true);
    expect(offreToutLaWishlist(quatre, true)).toBe(false);
    expect(offreToutLaWishlist(quatre.slice(0, 3), false)).toBe(false);
  });
});

describe("noter un souhait", () => {
  it("passe par le schéma du contrat", () => {
    const corps = corpsDuSouhait({
      intitule: "  Un moulin à café  ", prix: "", devise: "XAF", details: "",
    });
    expect(() => createWishSchema.parse(corps)).not.toThrow();
    expect(corps.label).toBe("Un moulin à café");
  });

  /* UN PRIX PORTE SA DEVISE : le contrat refuse l'un sans l'autre. On omet donc
     les deux ensemble plutôt que d'envoyer un montant qui ne dit ni des francs
     ni des euros. */
  it("omet le prix ET la devise quand rien n'est saisi", () => {
    const corps = corpsDuSouhait({ intitule: "Un vinyle", prix: "", devise: "XAF", details: "" });
    expect(corps.price).toBeUndefined();
    expect(corps.currency).toBeUndefined();
  });

  it("les envoie ensemble quand le prix est chiffré", () => {
    const corps = corpsDuSouhait({ intitule: "Un vinyle", prix: "12000", devise: "XAF", details: "" });
    expect(corps).toMatchObject({ price: 12000, currency: "XAF" });
  });

  it("accepte la virgule décimale", () => {
    expect(corpsDuSouhait({
      intitule: "Un vinyle", prix: "12,5", devise: "EUR", details: "",
    }).price).toBe(12.5);
  });

  /* Un champ vide n'est pas une chaîne vide : le schéma est strict et la
     refuserait là où il attend un texte. */
  it("omet les précisions vides plutôt que d'envoyer du blanc", () => {
    expect(corpsDuSouhait({
      intitule: "Un vinyle", prix: "", devise: "XAF", details: "   ",
    }).details).toBeUndefined();
  });

  it("refuse un intitulé vide", () => {
    expect(() => corpsDuSouhait({
      intitule: "   ", prix: "", devise: "XAF", details: "",
    })).toThrow();
  });
});

describe("le repère personnel", () => {
  it("bascule, et passe par le schéma du contrat", () => {
    const corps = corpsDeRetenu({ isShortlisted: false });
    expect(() => updateWishSchema.parse(corps)).not.toThrow();
    expect(corps.isShortlisted).toBe(true);
    expect(corpsDeRetenu({ isShortlisted: true }).isShortlisted).toBe(false);
  });

  /* `isShortlisted` n'est PAS l'`isPublic` d'une liste partagée : celui-là
     décide de ce que des visiteurs voient. Les confondre publierait ce qu'on
     croyait garder pour soi. */
  it("n'écrit rien d'autre que le repère", () => {
    expect(Object.keys(corpsDeRetenu({ isShortlisted: false }))).toEqual(["isShortlisted"]);
  });
});

describe("les vœux reçus", () => {
  it("ne montre que ceux qu'on a acceptés", () => {
    const liste = voeuxDeLOccasion([
      voeu(1, OCCASION, "pending", "2026-01-01"),
      voeu(2, OCCASION, "approved", "2026-01-02"),
      voeu(3, OCCASION, "rejected", "2026-01-03"),
    ], OCCASION);
    expect(liste.map((v) => v.content)).toEqual(["vœu 2"]);
  });

  it("ignore les vœux d'une autre occasion", () => {
    expect(voeuxDeLOccasion([voeu(4, AUTRE, "approved", "2026-01-01")], OCCASION)).toEqual([]);
  });

  it("rend le plus récent d'abord", () => {
    const liste = voeuxDeLOccasion([
      voeu(5, OCCASION, "approved", "2026-01-01"),
      voeu(7, OCCASION, "approved", "2026-03-01"),
      voeu(6, OCCASION, "approved", "2026-02-01"),
    ], OCCASION);
    expect(liste.map((v) => v.content)).toEqual(["vœu 7", "vœu 6", "vœu 5"]);
  });
});

describe("le bloc des souhaits et sa liste", () => {
  /* Le drapeau ferme le BLOC ; la nature n'en change que le contenu. Confondre
     les deux ferait disparaître le titre d'une occasion sensible, et « cette
     date se prépare sans cadeau » avec lui — la seule phrase qui explique
     pourquoi il n'y a rien. */
  it("le drapeau gouverne le bloc, la nature seulement la liste", () => {
    const deuil = occasion(3, "sensitive");
    expect(montreLeBlocDesSouhaits(["wishlist"])).toBe(true);
    expect(montreLesSouhaits(["wishlist"], deuil)).toBe(false);
    expect(montreLeBlocDesSouhaits([])).toBe(false);
  });
});

describe("le geste du socle en pied", () => {
  it("prend la place quand il ne reste ni souhaits ni préparation", () => {
    expect(socleEnPied({ souhaits: false, pistes: 0 })).toBe(true);
  });

  it("s'efface dès qu'un des deux blocs tient", () => {
    expect(socleEnPied({ souhaits: true, pistes: 0 })).toBe(false);
    expect(socleEnPied({ souhaits: false, pistes: 1 })).toBe(false);
  });
});

describe("l'identifiant qui vient de la route", () => {
  it("accepte un identifiant du contrat", () => {
    expect(identifiantDOccasion(OCCASION)).toBe(OCCASION);
  });

  /* LE PIÈGE. Un lien profond pose ce qu'il veut, et le paramètre part dans un
     chemin d'API : sans cette garde, le client fabrique lui-même la requête
     qu'on ne voulait pas. */
  it("refuse une remontée d'arborescence", () => {
    expect(identifiantDOccasion("../../admin")).toBeNull();
  });

  it("refuse l'absence et le vide", () => {
    expect(identifiantDOccasion(undefined)).toBeNull();
    expect(identifiantDOccasion("")).toBeNull();
  });

  // `expo-router` rend un tableau quand le paramètre est répété dans l'URL.
  it("ne prend que la première valeur d'un paramètre répété", () => {
    expect(identifiantDOccasion([OCCASION, "../../admin"])).toBe(OCCASION);
    expect(identifiantDOccasion(["../../admin", OCCASION])).toBeNull();
  });
});
