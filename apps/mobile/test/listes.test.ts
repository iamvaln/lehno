import { describe, expect, it } from "vitest";
import type {
  Occurrence, PublicWish, SharedWishlist, Wishlist,
} from "@lehno/contracts";
import {
  apercuSansSouhait, etatDuSouhaitMontre, listeCourante, listesRangees,
  occasionsOuvrables, peutChercherDesIdees, peutPartager, quandDeLaListe,
  resteAOffrir, souhaitsMontres,
} from "../lib/listes.js";

const uuid = (n: number): string =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

const liste = (n: number, p: Partial<Wishlist> = {}): Wishlist => ({
  id: uuid(n), occurrenceId: uuid(100 + n), occurrenceDate: "2026-09-03",
  /* Le nom et la clôture, arrivés avec les listes SANS occasion : nuls ici,
     puisque ce décor vise une liste qui a bien la sienne. */
  name: null, closesAt: null,
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

const souhaitPublic = (n: number, p: Partial<PublicWish> = {}): PublicWish => ({
  id: uuid(300 + n), label: "Un carnet", imageUrl: null, details: null, link: null,
  price: null, currency: null, isReserved: false, isFulfilled: false,
  reservedByMe: false, ...p,
});

const partagee = (souhaits: PublicWish[]): SharedWishlist => ({
  state: "ok", ownerFirstName: "Awa", ownerAvatarUrl: null, occasionLabel: null,
  occasionDate: "2026-09-03", acceptsReservations: true, wishes: souhaits,
});

describe("la liste qu'on regarde", () => {
  /* L'identifiant retenu peut venir d'un lien profond, ou désigner une liste
     supprimée ailleurs : on ne le croit jamais sur parole. */
  it("retombe sur la première quand l'identifiant ne désigne rien", () => {
    expect(listeCourante([liste(1), liste(2)], uuid(999))?.id).toBe(uuid(1));
  });

  it("rend celle qu'on a choisie quand elle existe", () => {
    expect(listeCourante([liste(1), liste(2)], uuid(2))?.id).toBe(uuid(2));
  });

  // `null` seulement quand il n'y a rien à montrer : autrement l'écran se
  // retrouverait vide en tenant pourtant des listes.
  it("ne rend rien quand il n'y a aucune liste", () => {
    expect(listeCourante([], uuid(1))).toBeNull();
  });
});

describe("la date d'une liste", () => {
  it("se formate quand elle existe au calendrier", () => {
    expect(quandDeLaListe("2026-09-03", "fr")).not.toBeNull();
  });

  /* Le contrat vérifie la FORME, pas le calendrier : « 2026-02-31 » passe sa
     validation. `Intl` le reporterait en mars sans rien dire, et la liste
     annoncerait une date que personne n'a saisie. */
  it("refuse une date qui n'existe pas plutôt que de la reporter", () => {
    expect(quandDeLaListe("2026-02-31", "fr")).toBeNull();
  });

  it("refuse une date tronquée", () => {
    expect(quandDeLaListe("2026-09", "fr")).toBeNull();
  });
});

describe("chercher des idées", () => {
  it("se propose sur une liste vivante quand la génération d'idées est ouverte", () => {
    expect(peutChercherDesIdees(liste(1), ["generation.ideas"])).toBe(true);
  });

  // La génération se paie : la proposer pour un anniversaire d'il y a onze mois
  // ferait dépenser un crédit pour rien.
  it("ne se propose pas sur une liste archivée", () => {
    expect(peutChercherDesIdees(liste(1, { isArchived: true }), ["generation.ideas"]))
      .toBe(false);
  });

  // Trois natures de génération, trois drapeaux : le message allumé n'ouvre pas
  // les idées.
  it("ne se propose pas quand seul le message est ouvert", () => {
    expect(peutChercherDesIdees(liste(1), ["generation.message"])).toBe(false);
  });
});

describe("l'aperçu de la page partagée", () => {
  it("montre les souhaits que le serveur sert", () => {
    expect(souhaitsMontres(partagee([souhaitPublic(1)]))).toHaveLength(1);
  });

  // Un lien révoqué n'a plus de souhaits à montrer, et la forme n'en porte pas :
  // l'écran doit pouvoir le demander sans se garder lui-même.
  it("ne montre rien d'un lien révoqué", () => {
    expect(souhaitsMontres({ state: "revoked" })).toEqual([]);
  });

  /* LE PIÈGE QUE L'APERÇU EXISTE POUR ATTRAPER : `wishCount` compte tous mes
     souhaits, la page publique n'en montre que les publics. Sept souhaits tous
     privés se partagent — et s'ouvrent sur rien. */
  it("avoue une page qui ne montre aucun souhait", () => {
    expect(apercuSansSouhait(partagee([]))).toBe(true);
  });

  it("ne l'avoue pas quand la page montre quelque chose", () => {
    expect(apercuSansSouhait(partagee([souhaitPublic(1)]))).toBe(false);
  });

  // Un lien révoqué n'est pas une page vide : c'est un autre message, et les
  // confondre ferait dire « tous vos souhaits sont privés » à tort.
  it("ne confond pas un lien révoqué avec une page vide", () => {
    expect(apercuSansSouhait({ state: "revoked" })).toBe(false);
  });
});

describe("l'état d'un souhait vu du dehors", () => {
  it("ne dit rien d'un souhait libre", () => {
    expect(etatDuSouhaitMontre(souhaitPublic(1))).toBeNull();
  });

  it("dit réservé", () => {
    expect(etatDuSouhaitMontre(souhaitPublic(1, { isReserved: true }))).toBe("reserve");
  });

  // Offert l'emporte : c'est l'état final, et un cadeau déjà offert reste
  // réservé au contrat.
  it("dit offert plutôt que réservé quand les deux tiennent", () => {
    expect(etatDuSouhaitMontre(souhaitPublic(1, { isReserved: true, isFulfilled: true })))
      .toBe("offert");
  });
});
