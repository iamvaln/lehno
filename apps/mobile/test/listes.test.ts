import { describe, expect, it } from "vitest";
import type { Occurrence, Wishlist } from "@lehno/contracts";
import {
  listesRangees, occasionsOuvrables, peutPartager, resteAOffrir,
} from "../lib/listes.js";

const uuid = (n: number): string =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

const liste = (n: number, p: Partial<Wishlist> = {}): Wishlist => ({
  id: uuid(n), occurrenceId: uuid(100 + n), occurrenceDate: "2026-09-03",
  eventKind: "birthday", eventLabel: null, wishCount: 7, reservedCount: 3,
  isShared: false, isArchived: false, ...p,
});

const occasion = (n: number): Occurrence => ({
  id: uuid(100 + n), eventId: uuid(200 + n), personId: uuid(1),
  personDisplayName: "Moi", kind: "birthday", nature: "happy", label: null,
  occurrenceDate: "2026-09-03", occurrenceYear: 2026, status: "upcoming",
  daysUntil: 5, age: 30,
});

describe("ce qu'on peut encore ouvrir", () => {
  /* Une occasion qui porte déjà sa liste ne s'en ouvre pas une seconde : deux
     listes pour un même anniversaire se partageraient l'une l'autre sans qu'on
     sache laquelle circule. */
  it("écarte les occasions qui ont déjà leur liste", () => {
    expect(occasionsOuvrables([occasion(1), occasion(2)], [liste(1)]).map((o) => o.id))
      .toEqual([uuid(102)]);
  });

  it("rend tout quand aucune liste n'existe", () => {
    expect(occasionsOuvrables([occasion(1)], [])).toHaveLength(1);
  });
});

describe("l'ordre des listes", () => {
  /* Une liste archivée « s'affiche encore — on veut revoir ce qu'on avait
     demandé ». Elle descend sans disparaître : la faire sortir effacerait la
     mémoire de ce qu'on souhaitait l'an dernier. */
  it("descend les archivées sans les retirer", () => {
    const rangees = listesRangees([
      liste(1, { isArchived: true, occurrenceDate: "2025-09-03" }),
      liste(2, { occurrenceDate: "2026-09-03" }),
    ]);
    expect(rangees.map((l) => l.isArchived)).toEqual([false, true]);
    expect(rangees).toHaveLength(2);
  });

  it("range les vivantes de la plus proche à la plus lointaine", () => {
    const rangees = listesRangees([
      liste(1, { occurrenceDate: "2026-12-25" }),
      liste(2, { occurrenceDate: "2026-09-03" }),
    ]);
    expect(rangees.map((l) => l.occurrenceDate)).toEqual(["2026-09-03", "2026-12-25"]);
  });

  // On relit la dernière archivée, pas la première : l'an dernier avant
  // l'année d'avant.
  it("range les archivées de la plus récente à la plus ancienne", () => {
    const rangees = listesRangees([
      liste(1, { isArchived: true, occurrenceDate: "2024-09-03" }),
      liste(2, { isArchived: true, occurrenceDate: "2025-09-03" }),
    ]);
    expect(rangees.map((l) => l.occurrenceDate)).toEqual(["2025-09-03", "2024-09-03"]);
  });

  it("ne modifie pas la liste reçue", () => {
    const source = [liste(1, { isArchived: true }), liste(2)];
    listesRangees(source);
    expect(source[0]?.isArchived).toBe(true);
  });
});

describe("ce qui reste à offrir", () => {
  /* COMBIEN, jamais LESQUELS ni PAR QUI : savoir qui a réservé quoi gâcherait
     la surprise qu'on prépare. */
  it("se déduit des deux comptes", () => {
    expect(resteAOffrir(liste(1))).toBe(4);
  });

  // Un compte de réservations supérieur au nombre de souhaits est un défaut du
  // serveur ; un nombre négatif à l'écran serait pire.
  it("ne descend jamais sous zéro", () => {
    expect(resteAOffrir(liste(1, { wishCount: 2, reservedCount: 5 }))).toBe(0);
  });
});

describe("quand une liste se partage", () => {
  it("se partage vivante et remplie", () => {
    expect(peutPartager(liste(1))).toBe(true);
  });

  /* Une archivée n'accepte plus de réservation : en donner le lien ferait venir
     quelqu'un sur une page qui ne peut plus rien recevoir. */
  it("ne se partage pas une fois archivée", () => {
    expect(peutPartager(liste(1, { isArchived: true }))).toBe(false);
  });

  // Une liste vide demanderait à un proche de choisir dans rien.
  it("ne se partage pas vide", () => {
    expect(peutPartager(liste(1, { wishCount: 0 }))).toBe(false);
  });
});
