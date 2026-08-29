import { describe, expect, it } from "vitest";
import type { GeneratedMessage, Note, Occurrence } from "@lehno/contracts";
import {
  estPassee, messageDeLOccasion, montreLesSouhaits, montreLesVoeux, notesDeLOccasion,
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
    expect(messageDeLOccasion([message(1, AUTRE, "sent", "2026-01-01")], OCCASION)).toBeNull();
  });

  // Une exécution en cours n'a pas encore de résultat : le contrat rend le
  // message nul tant qu'elle tourne, et la liste en porte donc.
  it("traverse les exécutions sans résultat", () => {
    const trouve = messageDeLOccasion([null, message(1, OCCASION, "generated", "2026-01-01")], OCCASION);
    expect(trouve?.etat).toBe("pret");
  });

  it("rend le plus récent des brouillons", () => {
    const trouve = messageDeLOccasion([
      message(1, OCCASION, "generated", "2026-01-01"),
      message(2, OCCASION, "edited", "2026-02-01"),
    ], OCCASION);
    expect(trouve?.message.content).toBe("texte 2");
    expect(trouve?.etat).toBe("pret");
  });

  /* « Un message envoyé puis regénéré reste envoyé. » Montrer le brouillon plus
     récent ferait croire qu'il reste quelque chose à faire — et pousserait à
     renvoyer un mot que le proche a déjà reçu. */
  it("l'envoyé prime sur un brouillon plus récent", () => {
    const trouve = messageDeLOccasion([
      message(1, OCCASION, "sent", "2026-01-01"),
      message(2, OCCASION, "generated", "2026-06-01"),
    ], OCCASION);
    expect(trouve?.message.content).toBe("texte 1");
    expect(trouve?.etat).toBe("envoye");
  });

  // Ajusté mais pas envoyé reste PRÊT : la retouche ne change pas ce qu'il
  // reste à faire, seulement la provenance.
  it("un texte ajusté est un texte prêt", () => {
    const trouve = messageDeLOccasion([message(1, OCCASION, "edited", "2026-01-01")], OCCASION);
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
