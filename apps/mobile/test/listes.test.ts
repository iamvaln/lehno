import { describe, expect, it } from "vitest";
import { fr } from "../messages/fr.js";
import type {
  Occurrence, PublicWish, SharedWishlist, Wishlist,
} from "@lehno/contracts";
import {
  apercuSansSouhait, etatDuSouhaitMontre, listeCourante, listesRangees,
  occasionsOuvrables, peutChercherDesIdees, peutPartager, quandDeLaListe,
  resteAOffrir, souhaitsMontres,
  ouvertureDeListe,
  nomDeLaListe,
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
  personDisplayName: "Moi", isSelf: false, kind: "birthday", nature: "happy", label: null,
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

/* OUVRIR UNE LISTE SANS DATE À SOI.
 *
 * L'écran était un CUL-DE-SAC, vu à l'appareil sur un compte neuf : les dates
 * qu'on saisit d'abord sont celles de ses proches, jamais les siennes.
 * « Nouvelle wishlist » s'ouvrait donc sur « Aucune date à vous pour
 * l'instant », « Enregistrer » éteint, et rien d'autre — pas un champ, pas un
 * lien —, pendant que l'accueil invitait à « Faire ma wishlist ».
 */
describe("ce qu'on envoie pour ouvrir une liste", () => {
  const OCCASION = "11111111-1111-4111-8111-111111111111";

  /* `.strict()` REFUSE LA REQUÊTE ENTIÈRE pour une clé en trop, et `name`
     exige au moins un caractère. Une chaîne vide se retire donc, elle ne
     s'envoie pas — l'absence, elle, passe. */
  it("n'envoie pas un nom vide", () => {
    expect(ouvertureDeListe(OCCASION, "")).toEqual({ occurrenceId: OCCASION });
    expect(ouvertureDeListe(OCCASION, "   ")).toEqual({ occurrenceId: OCCASION });
  });

  it("n'envoie pas d'occasion quand il n'y en a pas", () => {
    expect(ouvertureDeListe(null, "Ma crémaillère")).toEqual({ name: "Ma crémaillère" });
  });

  it("porte les deux quand les deux sont là", () => {
    expect(ouvertureDeListe(OCCASION, "Mes trente ans"))
      .toEqual({ occurrenceId: OCCASION, name: "Mes trente ans" });
  });

  /* Le serveur le dit — « une liste sans occasion a besoin d'un nom ». On le
     vérifie ici AUSSI, non par défiance : c'est ce qui permet d'éteindre le
     bouton plutôt que de faire découvrir la règle par un refus après coup. */
  it("ne compose rien sans occasion ni nom", () => {
    expect(ouvertureDeListe(null, "")).toBeNull();
    expect(ouvertureDeListe(null, "  ")).toBeNull();
  });

  /* Les blancs de bordure viennent du clavier, pas de l'intention : le schéma
     les coupe (`trim()`), et deux listes « Noël » et « Noël  » se
     ressembleraient sans se ranger ensemble. */
  it("coupe les blancs de bordure", () => {
    expect(ouvertureDeListe(null, "  Noël ")).toEqual({ name: "Noël" });
  });
});

/* COMMENT LA LISTE S'APPELLE. Le nom saisi partait à la trappe : la carte le
   composait toujours depuis l'occasion, et une liste sans occasion s'affichait
   « Autre ». Vu à l'appareil sur la liste qu'on venait de créer. */
describe("le nom d'une liste", () => {
  const T = fr;

  it("préfère le nom donné par le propriétaire", () => {
    expect(nomDeLaListe(
      { name: "Ma crémaillère", eventKind: "birthday", eventLabel: null }, T,
    )).toBe("Ma crémaillère");
  });

  /* Nul veut dire « composez-le depuis l'occasion », et c'est le client qui
     compose : le serveur rendrait une chaîne figée le jour où l'occasion
     change de nom. */
  it("compose depuis l'occasion quand il n'y en a pas", () => {
    expect(nomDeLaListe({ name: null, eventKind: "birthday", eventLabel: null }, T))
      .toBe(T.typeAnniversaire);
    expect(nomDeLaListe({ name: null, eventKind: "other", eventLabel: "Crémaillère" }, T))
      .toBe("Crémaillère");
  });

  /* SANS OCCASION NI NOM, il ne reste que « Autre » — c'est ce qu'on voyait, et
     ce que le serveur empêche désormais à l'ouverture. Le cas subsiste pour les
     listes ouvertes avant, et il ne doit pas rendre `undefined`. */
  it("ne rend jamais rien du tout", () => {
    expect(nomDeLaListe({ name: null, eventKind: null, eventLabel: null }, T))
      .toBe(T.typeAutre);
  });

  // Un nom fait de blancs n'est pas un nom : il laisserait une carte muette.
  it("ne retient pas un nom fait de blancs", () => {
    expect(nomDeLaListe({ name: "   ", eventKind: "other", eventLabel: "Noël" }, T))
      .toBe("Noël");
  });
});

/* CHERCHER DES IDÉES DEMANDE UNE OCCASION.
 *
 * Le geste ouvre §3.7, qui lit `/me/occurrences/{id}`. Sur une liste qui n'en
 * vise aucune, il n'y a pas d'`id` à lui passer : le bouton menait à « Cette
 * demande n'est pas valide », un écran rouge dont « Réessayer » réessaie la même
 * demande invalide. Vu à l'appareil, sur la première liste sans occasion qu'il
 * devenait possible d'ouvrir.
 */
describe("chercher des idées pour une liste", () => {
  const IDEES = ["generation.ideas"];
  const liste = (p: Partial<Wishlist>): Wishlist => ({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    occurrenceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: null, occurrenceDate: "2026-12-25", eventKind: "other", eventLabel: "Noël",
    wishCount: 0, reservedCount: 0, isShared: false, closesAt: null, isArchived: false,
    ...p,
  });

  it("se propose sur une liste qui vise une occasion", () => {
    expect(peutChercherDesIdees(liste({}), IDEES)).toBe(true);
  });

  it("ne se propose pas sans occasion", () => {
    expect(peutChercherDesIdees(liste({ occurrenceId: null }), IDEES)).toBe(false);
  });

  /* Une date passée ne se prépare plus : le geste coûte un crédit, et le cadeau
     ne s'offrira pas. */
  it("ne se propose pas sur une liste archivée", () => {
    expect(peutChercherDesIdees(liste({ isArchived: true }), IDEES)).toBe(false);
  });

  it("ne se propose pas quand la nature est éteinte", () => {
    expect(peutChercherDesIdees(liste({}), [])).toBe(false);
  });
});
