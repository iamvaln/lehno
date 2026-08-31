import { describe, expect, it } from "vitest";
import type { MyReservation, Wall, WishLink } from "@lehno/contracts";
import {
  adresseAPartager, etatDuLien, etatDuMur, montreCeQuiRevient, montreLaVitrine,
  reservationsQuiTiennent,
} from "../lib/vitrine.js";

const LANCEMENT = ["collect", "referral", "topup.manual", "generation.message"];

const mur = (isEnabled: boolean): Wall => ({
  slug: "valentine",
  isEnabled,
  showBirthdayDate: true,
  welcomeMessage: null,
  publicUrl: "https://lehno.app/valentine",
  wishLinkUrl: null,
  interests: [],
});

const lien = (closesOn: string): WishLink => ({
  token: "abc", url: "https://lehno.app/v/abc",
  occurrenceId: "11111111-1111-4111-8111-111111111111", closesOn,
});

const reservation = (n: number, date: string): MyReservation => ({
  id: `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`,
  wishId: `${String(n + 50).padStart(8, "0")}-0000-4000-8000-000000000000`,
  wishLabel: "Un moulin à café", wishImageUrl: null, price: null, currency: null,
  ownerDisplayName: "Ana", ownerUsername: "ana",
  occurrenceDate: date, showIdentity: true, confirmedAt: "2026-08-01T00:00:00.000Z",
});

describe("les deux groupes de surfaces", () => {
  /* Un titre de section sans contenu annonce ce qui ne vient pas. */
  it("disparaissent entiers au lancement", () => {
    expect(montreLaVitrine(LANCEMENT)).toBe(false);
    expect(montreCeQuiRevient(LANCEMENT)).toBe(false);
  });

  it("la vitrine tient dès qu'une de ses trois surfaces tient", () => {
    expect(montreLaVitrine(["wall"])).toBe(true);
    expect(montreLaVitrine(["wishlist.own"])).toBe(true);
    expect(montreLaVitrine(["wishes"])).toBe(true);
  });

  // `wishes` porte les deux : le lien qu'on donne, et les mots qui reviennent.
  it("ce qui revient tient sur les vœux ou les réservations", () => {
    expect(montreCeQuiRevient(["wishes"])).toBe(true);
    expect(montreCeQuiRevient(["reservation"])).toBe(true);
    expect(montreCeQuiRevient(["wall"])).toBe(false);
  });
});

describe("le Mur", () => {
  /* `isEnabled` est la SEULE vérité. Un mur qui a une adresse mais reste éteint
     n'est pas « à moitié public » : l'annoncer autrement ferait croire à
     quelqu'un que ses dates circulent. */
  it("est privé tant qu'il n'est pas allumé", () => {
    expect(etatDuMur(mur(false))).toBe("prive");
    expect(etatDuMur(mur(true))).toBe("publie");
  });

  /* `publicUrl` existe même éteint — c'est l'adresse qu'il AURA. La proposer
     alors enverrait des gens sur une page qui refuse de répondre. */
  it("ne donne son adresse que s'il répond", () => {
    expect(adresseAPartager(mur(true))).toBe("https://lehno.app/valentine");
    expect(adresseAPartager(mur(false))).toBeNull();
  });
});

describe("le lien de vœux", () => {
  it("est ouvert avant sa date", () => {
    expect(etatDuLien(lien("2026-09-03"), "2026-08-29")).toBe("ouvert");
  });

  /* LE JOUR DE FERMETURE EST INCLUS. « Jusqu'au 3 septembre » qui se fermerait
     le 3 au matin serait une promesse rompue d'un jour — et c'est le genre
     d'écart qu'on ne pardonne pas sur un anniversaire. */
  it("est encore ouvert le jour même", () => {
    expect(etatDuLien(lien("2026-09-03"), "2026-09-03")).toBe("ouvert");
  });

  it("est fermé le lendemain", () => {
    expect(etatDuLien(lien("2026-09-03"), "2026-09-04")).toBe("ferme");
  });

  /* On compare des DATES CIVILES, pas des instants : comparer des instants
     fermerait le lien à minuit pile pour qui vit à l'ouest, alors que sa
     journée n'est pas finie. */
  it("compare des jours, pas des heures", () => {
    expect(etatDuLien(lien("2026-09-03"), "2026-09-03")).toBe("ouvert");
  });
});

describe("mes réservations", () => {
  // La plus proche d'abord : c'est celle qu'il faut préparer.
  it("range de la plus proche à la plus lointaine", () => {
    const liste = reservationsQuiTiennent([
      reservation(1, "2026-12-01"), reservation(2, "2026-09-03"), reservation(3, "2026-10-15"),
    ]);
    expect(liste.map((r) => r.occurrenceDate))
      .toEqual(["2026-09-03", "2026-10-15", "2026-12-01"]);
  });

  it("ne modifie pas la liste reçue", () => {
    const source = [reservation(1, "2026-12-01"), reservation(2, "2026-09-03")];
    reservationsQuiTiennent(source);
    expect(source[0]?.occurrenceDate).toBe("2026-12-01");
  });
});
