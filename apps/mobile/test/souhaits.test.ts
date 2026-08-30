import { describe, expect, it } from "vitest";
import {
  createOwnerWishSchema, updateOwnerWishSchema, type OwnerWish,
} from "@lehno/contracts";
import {
  corpsDeCreation, corpsDeMarque, corpsDeVisibilite, etatDuSouhait,
  marqueSuivante, nomDuReserveur, souhaitsVisibles, type SaisieDeSouhait,
} from "../lib/souhaits.js";

const uuid = (n: number): string =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

const souhait = (n: number, p: Partial<OwnerWish> = {}): OwnerWish => ({
  id: uuid(n), wishlistId: uuid(1), label: "Un moulin à café", link: null,
  imageUrl: null, details: null, price: null, currency: null,
  status: "available", isPublic: true, position: null, reservedByName: null, ...p,
});

const saisie = (p: Partial<SaisieDeSouhait> = {}): SaisieDeSouhait => ({
  intitule: "Un moulin à café", lien: "", details: "", prix: "", devise: "XAF",
  public: true, ...p,
});

describe("ce qu'un souhait est devenu", () => {
  it("nomme les trois états", () => {
    expect(etatDuSouhait(souhait(1))).toBe("libre");
    expect(etatDuSouhait(souhait(2, { status: "reserved" }))).toBe("reserve");
    expect(etatDuSouhait(souhait(3, { status: "fulfilled" }))).toBe("offert");
  });
});

describe("ce que le propriétaire peut écrire", () => {
  /* `reserved` NE S'ÉCRIT PAS À LA MAIN : « le laisser poser permettrait de
     déclarer pris un cadeau que personne n'a réservé, donc de le retirer de la
     liste partagée sans qu'aucune réservation ne l'explique ». */
  it("ne propose jamais « réservé »", () => {
    for (const statut of ["available", "reserved", "fulfilled"] as const) {
      expect(marqueSuivante(souhait(1, { status: statut }))).not.toBe("reserved");
    }
  });

  /* Sur un souhait RÉSERVÉ, la bascule mène à « offert » — c'est le geste
     attendu : quelqu'un l'a pris, on le marque reçu le jour venu. */
  it("mène de réservé à offert", () => {
    expect(marqueSuivante(souhait(1, { status: "reserved" }))).toBe("fulfilled");
  });

  it("défait « offert » vers libre", () => {
    expect(marqueSuivante(souhait(1, { status: "fulfilled" }))).toBe("available");
  });

  it("compose des corps que le contrat accepte", () => {
    expect(updateOwnerWishSchema.safeParse(corpsDeMarque(souhait(1))).success).toBe(true);
    expect(updateOwnerWishSchema.safeParse(corpsDeVisibilite(souhait(1))).success).toBe(true);
  });
});

describe("qui a réservé", () => {
  /* « Nul ne veut pas dire *personne n'a réservé* — le souhait peut être
     `reserved` sans nom —, mais *aucun nom n'a été donné*. » Confondre les deux
     ferait dire à l'écran que rien n'est pris alors que si, et quelqu'un
     rachèterait le même cadeau. */
  it("ne rend un nom que sur un souhait réservé", () => {
    expect(nomDuReserveur(souhait(1, { status: "reserved", reservedByName: "Ana" })))
      .toBe("Ana");
    expect(nomDuReserveur(souhait(2, { reservedByName: "Ana" }))).toBeNull();
  });

  it("rend nul quand personne ne s'est nommé, sans nier la réservation", () => {
    const reserve = souhait(1, { status: "reserved", reservedByName: null });
    expect(nomDuReserveur(reserve)).toBeNull();
    expect(etatDuSouhait(reserve)).toBe("reserve");
  });
});

describe("créer un souhait", () => {
  it("compose un corps que le contrat accepte", () => {
    expect(createOwnerWishSchema.safeParse(corpsDeCreation(saisie())).success).toBe(true);
  });

  /* Les facultatifs sont OMIS et non envoyés vides : le schéma est strict et
     refuse une chaîne vide là où il attend une URL ou un texte. */
  it("omet ce qu'on n'a pas rempli", () => {
    const corps = corpsDeCreation(saisie());
    expect(corps).not.toHaveProperty("link");
    expect(corps).not.toHaveProperty("details");
    expect(corps).not.toHaveProperty("price");
  });

  /* UN PRIX PORTE SA DEVISE — le contrat refuse l'un sans l'autre, et
     « 12 000 » ne dit rien sans dire de quoi. */
  it("envoie le prix avec sa devise, ou aucun des deux", () => {
    const corps = corpsDeCreation(saisie({ prix: "12000" }));
    expect(corps.price).toBe(12000);
    expect(corps.currency).toBe("XAF");
  });

  // La virgule décimale est ce qu'on tape en français.
  it("accepte la virgule décimale", () => {
    expect(corpsDeCreation(saisie({ prix: "12,5" })).price).toBe(12.5);
  });

  it("ignore un prix qui n'en est pas un", () => {
    expect(corpsDeCreation(saisie({ prix: "beaucoup" }))).not.toHaveProperty("price");
  });

  it("refuse un intitulé vide plutôt que d'envoyer vers un refus", () => {
    expect(() => corpsDeCreation(saisie({ intitule: "   " }))).toThrow();
  });
});

describe("ce qui paraît sur la liste partagée", () => {
  /* « Un souhait peut rester à soi. » Une liste qui n'aurait que des souhaits
     privés se partagerait vide — et demanderait à un proche de choisir dans
     rien. */
  it("écarte les souhaits gardés pour soi", () => {
    expect(souhaitsVisibles([
      souhait(1), souhait(2, { isPublic: false }),
    ]).map((s) => s.id)).toEqual([uuid(1)]);
  });
});
