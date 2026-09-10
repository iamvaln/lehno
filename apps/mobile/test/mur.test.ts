import { describe, expect, it } from "vitest";
import {
  receivedWishSchema, updateWallSchema,
  type ReceivedWish, type Wall, type WallInterest,
} from "@lehno/contracts";
import {
  basculeLInteret, corpsDExposition, motsRecus, ongletDemande, ongletsDuMur,
  peutPartager, rienDExpose, signatureDuMot,
} from "../lib/mur.js";

const uuid = (n: number): string =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

const interet = (n: number, isPublic: boolean): WallInterest => ({
  id: uuid(n), kind: "hobby", value: `goût ${n}`, isPublic,
});

const mur = (isEnabled: boolean): Wall => ({
  slug: "valentine", isEnabled, showBirthdayDate: true, showWishlist: false, welcomeMessage: null,
  publicUrl: "https://lehno.app/valentine", wishLinkUrl: null, interests: [],
});

const mot = (n: number, quand: string, auteur: string | null): ReceivedWish =>
  receivedWishSchema.parse({
    id: uuid(n), occurrenceId: uuid(100), authorName: auteur,
    content: `mot ${n}`, status: "pending", createdAt: quand,
    // Non exposé, comme en base : le décor part de l'état réel.
    isPublic: false, showAuthor: false,
  });


describe("ce qui est exposé", () => {
  /* EN ENTIER, jamais par ajout ni retrait : « un patch élément par élément
     laisserait une case décochée à l'écran rester cochée EN BASE si l'appel qui
     la retirait s'est perdu ». */
  it("envoie l'ensemble de ce qui reste public", () => {
    const corps = corpsDExposition([interet(1, true), interet(2, false), interet(3, true)]);
    expect(corps.publicInterestIds).toEqual([uuid(1), uuid(3)]);
  });

  /* Un tableau VIDE est un geste légitime — « plus rien d'exposé » — et non une
     absence de choix. Omettre le champ laisserait tout en place. */
  it("compose le vide plutôt que d'omettre le champ", () => {
    expect(corpsDExposition([interet(1, false)]).publicInterestIds).toEqual([]);
    expect(corpsDExposition([])).toHaveProperty("publicInterestIds");
  });

  it("compose un corps que le contrat accepte", () => {
    expect(updateWallSchema.safeParse(corpsDExposition([interet(1, true)])).success).toBe(true);
  });

  // Muter la liste reçue ferait diverger l'écran de ce que le serveur a
  // confirmé, le jour où l'appel échoue.
  it("bascule sans modifier la liste reçue", () => {
    const source = [interet(1, true), interet(2, false)];
    const apres = basculeLInteret(source, uuid(2));
    expect(apres[1]?.isPublic).toBe(true);
    expect(source[1]?.isPublic).toBe(false);
  });

  it("ne touche que le goût visé", () => {
    const apres = basculeLInteret([interet(1, true), interet(2, false)], uuid(1));
    expect(apres.map((i) => i.isPublic)).toEqual([false, false]);
  });
});

describe("l'adresse du Mur", () => {
  /* Elle se MONTRE avant la publication — « pour qu'on sache ce qu'on s'apprête
     à ouvrir » — et ne se PARTAGE qu'après : la faire circuler avant que la
     page ne réponde enverrait des gens sur un refus. */
  it("ne se partage qu'une fois le Mur allumé", () => {
    expect(peutPartager(mur(true))).toBe(true);
    expect(peutPartager(mur(false))).toBe(false);
  });
});

describe("les deux onglets", () => {
  /* LES MOTS SUIVENT `wishes`, PAS `wall` : la route qui les sert est gardée
     par ce drapeau. Un onglet qui mène à un refus est pire qu'un onglet
     absent — l'écran, lui, reste ouvert, car régler sa page n'a rien à voir
     avec en recevoir des mots. */
  it("n'ouvre l'onglet des mots que sous son drapeau", () => {
    expect(ongletsDuMur(["wall", "wishes"])).toEqual(["page", "mots"]);
    expect(ongletsDuMur(["wall"])).toEqual(["page"]);
  });

  /* UN PARAMÈTRE DE ROUTE N'EST PAS DE CONFIANCE : `…/monmur?onglet=` s'atteint
     par lien profond et accepte n'importe quoi, un tableau compris — un
     paramètre répété en rend un. */
  it("retombe sur la page devant tout ce qui n'est pas un onglet ouvert", () => {
    expect(ongletDemande("mots", ["wall", "wishes"])).toBe("mots");
    expect(ongletDemande("page", ["wall", "wishes"])).toBe("page");
    expect(ongletDemande("réglages", ["wall", "wishes"])).toBe("page");
    expect(ongletDemande(["mots"], ["wall", "wishes"])).toBe("page");
    expect(ongletDemande(undefined, ["wall", "wishes"])).toBe("page");
  });

  /* Le drapeau entre dans le calcul : demandé sans lui, « mots » ouvrirait un
     onglet que la barre ne dessine pas — et l'écran s'afficherait vide. */
  it("refuse l'onglet des mots quand son drapeau est éteint", () => {
    expect(ongletDemande("mots", ["wall"])).toBe("page");
  });
});

describe("ce que la page ne montre pas", () => {
  /* Un Mur publié dont rien n'est coché ouvre une adresse qui ne dit rien de
     soi. Le dire vaut mieux qu'aligner des interrupteurs éteints. */
  it("reconnaît une page qui n'expose rien", () => {
    expect(rienDExpose({ ...mur(true), showBirthdayDate: false }, [])).toBe(true);
    expect(rienDExpose({ ...mur(true), showBirthdayDate: false },
      [interet(1, false)])).toBe(true);
  });

  // Ne regarder que les goûts ferait passer pour vide une page qui annonce
  // encore une date d'anniversaire.
  it("compte la date d'anniversaire comme exposée", () => {
    expect(rienDExpose({ ...mur(true), showBirthdayDate: true }, [])).toBe(false);
    expect(rienDExpose({ ...mur(true), showBirthdayDate: false },
      [interet(1, true)])).toBe(false);
  });
});

describe("les mots reçus", () => {
  it("range du plus récent au plus ancien", () => {
    const liste = motsRecus([
      mot(1, "2026-08-01T10:00:00.000Z", "Awa"),
      mot(2, "2026-09-02T10:00:00.000Z", "Célarine"),
      mot(3, "2026-08-30T10:00:00.000Z", null),
    ]);
    expect(liste.map((m) => m.id)).toEqual([uuid(2), uuid(3), uuid(1)]);
  });

  // `sort` mute : réordonner la liste servie ferait diverger l'écran de ce
  // qu'on a lu du serveur.
  it("ne réordonne pas la liste reçue", () => {
    const source = [
      mot(1, "2026-08-01T10:00:00.000Z", "Awa"),
      mot(2, "2026-09-02T10:00:00.000Z", "Célarine"),
    ];
    motsRecus(source);
    expect(source.map((m) => m.id)).toEqual([uuid(1), uuid(2)]);
  });

  /* RIEN N'EST FILTRÉ. `status` tranche la CONSIDÉRATION dans le sas de §3.8 —
     « écarter, c'est ne pas le considérer, pas le cacher ». Masquer ici ce qui
     a été écarté ferait disparaître un mot qu'on a bel et bien reçu. */
  it("garde les mots écartés au sas", () => {
    const ecarte = { ...mot(1, "2026-08-01T10:00:00.000Z", "Awa"), status: "rejected" as const };
    expect(motsRecus([ecarte])).toHaveLength(1);
  });

  /* « Nul si la contribution était anonyme » — mais un nom réduit à des espaces
     vient du même formulaire public, et laisserait la ligne s'ouvrir sur une
     virgule. */
  it("replie l'anonyme et le vide sur le même libellé", () => {
    expect(signatureDuMot(mot(1, "2026-08-01T10:00:00.000Z", null), "Sans nom", "1 août"))
      .toBe("Sans nom, 1 août");
    expect(signatureDuMot(mot(2, "2026-08-01T10:00:00.000Z", "  "), "Sans nom", "1 août"))
      .toBe("Sans nom, 1 août");
    expect(signatureDuMot(mot(3, "2026-08-01T10:00:00.000Z", "Awa"), "Sans nom", "1 août"))
      .toBe("Awa, 1 août");
  });
});
