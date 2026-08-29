import { describe, expect, it } from "vitest";
import { ecranEteint, moiVisible, preparationOuverte } from "../lib/navigation.js";

/* Les cinq profils du handoff, exprimés comme le serveur les rend : la liste
   RÉSOLUE de ce qui est actif, jamais l'état brut. Ce sont les cinq états à
   éprouver — « en développement tout est allumé, un déploiement neuf crée tout
   éteint », et c'est le second que verront les premiers utilisateurs. */
const TOUT = [
  "wishlist", "wishlist.own", "wall", "collect", "wishes", "reservation",
  "events.other", "generation.message", "generation.ideas", "generation.portrait",
  "credits", "topup.provider", "topup.manual", "referral", "launch.live",
];

// La configuration décidée : anniversaires seuls, message généré, versement
// manuel, collecte et parrainage. Tout le reste éteint.
const LANCEMENT = ["collect", "generation.message", "credits", "topup.manual", "referral"];

const PORTRAIT_FERME = TOUT.filter((c) => c !== "generation.portrait");
const CREDITS_ETEINTS = TOUT.filter((c) => !["credits", "topup.provider", "topup.manual"].includes(c));
const IDEES_SEULES = [...LANCEMENT.filter((c) => c !== "generation.message"), "generation.ideas"];
const RIEN: string[] = [];

describe("l'onglet Moi est une conséquence, pas un drapeau", () => {
  /* Le serveur n'enverra jamais `moi`. L'onglet part quand ses cinq sections
     sont toutes fermées — un onglet qui ne mène qu'à un écran vide est pire
     qu'un onglet absent. */
  it("tient tant qu'une seule de ses sections tient", () => {
    expect(moiVisible(["wall"])).toBe(true);
    expect(moiVisible(["reservation"])).toBe(true);
  });

  it("tombe au lancement, où ses cinq sections sont fermées", () => {
    expect(moiVisible(LANCEMENT)).toBe(false);
    expect(moiVisible(RIEN)).toBe(false);
  });

  // Un drapeau qui ne le concerne pas ne le rallume pas : `collect` et
  // `referral` sont ouverts au lancement, et Moi tombe quand même.
  it("ne se rallume pas sur un drapeau étranger", () => {
    expect(moiVisible(["collect", "referral", "credits"])).toBe(false);
  });
});

describe("§3.7 s'ouvre dès qu'une nature tient", () => {
  /* Les trois natures de génération sont TROIS drapeaux, pas un interrupteur.
     Au lancement le message est allumé et les idées non : c'est le cas
     NOMINAL, pas une variante. */
  it("le message seul suffit — c'est le lancement", () => {
    expect(preparationOuverte(LANCEMENT)).toBe(true);
    expect(ecranEteint("preparation", LANCEMENT)).toBe(false);
  });

  // La combinaison inverse, celle qui éprouve le plus les écrans : la piste qui
  // reste n'est pas celle qu'ils ouvraient d'ordinaire.
  it("les idées seules suffisent aussi", () => {
    expect(preparationOuverte(IDEES_SEULES)).toBe(true);
    expect(ecranEteint("cadrage", IDEES_SEULES)).toBe(false);
    expect(ecranEteint("cadrage", LANCEMENT)).toBe(true);
  });

  it("les deux éteintes, l'écran sort de la navigation", () => {
    expect(ecranEteint("preparation", RIEN)).toBe(true);
    expect(ecranEteint("generation", RIEN)).toBe(true);
  });

  /* Les reprises couvrent les TROIS natures. Elles tiennent donc encore quand
     seul le portrait est ouvert — il y a une production à retrouver. */
  it("les reprises tiennent tant qu'une production est possible", () => {
    expect(ecranEteint("reprises", ["generation.portrait"])).toBe(false);
    expect(ecranEteint("reprises", LANCEMENT)).toBe(false);
    expect(ecranEteint("reprises", RIEN)).toBe(true);
  });
});

describe("les cinq profils", () => {
  // Tout allumé : rien ne sort. C'est l'environnement d'intégration, pas la
  // production.
  it("tout allumé n'éteint aucun écran", () => {
    for (const id of ["souhait", "listes", "monmur", "reservations", "valider",
      "collecte", "preparation", "generation", "cadrage", "portrait", "studio",
      "reprises", "parrainage", "paiement", "moi"]) {
      expect(ecranEteint(id, TOUT), id).toBe(false);
    }
  });

  /* Le lancement retire neuf écrans, et l'onglet qui menait à quatre d'entre
     eux avec. C'est cette liste-là qu'il faut voir juste : elle décide de
     l'ordre de construction. */
  it("le lancement retire neuf écrans, et garde la promesse", () => {
    const sortis = ["souhait", "listes", "monmur", "reservations", "cadrage",
      "portrait", "studio", "paiement", "moi"];
    for (const id of sortis) expect(ecranEteint(id, LANCEMENT), id).toBe(true);

    const restent = ["valider", "collecte", "preparation", "generation", "reprises", "parrainage"];
    for (const id of restent) expect(ecranEteint(id, LANCEMENT), id).toBe(false);
  });

  // Portrait fermé : le message et les idées restent. Un lancement plausible,
  // que le drapeau global rendait indessinable.
  it("portrait fermé ne ferme que le portrait", () => {
    expect(ecranEteint("portrait", PORTRAIT_FERME)).toBe(true);
    expect(ecranEteint("studio", PORTRAIT_FERME)).toBe(true);
    expect(ecranEteint("preparation", PORTRAIT_FERME)).toBe(false);
    expect(ecranEteint("reprises", PORTRAIT_FERME)).toBe(false);
  });

  /* LE CAS QUI PIÈGE. L'achat s'en va, les générations RESTENT — et deviennent
     gratuites. C'est le seul endroit où éteindre un drapeau ajoute de la valeur
     pour l'utilisateur. Un écran qui dirait « rechargez » mentirait. */
  it("crédits éteints ne ferme aucune génération", () => {
    expect(ecranEteint("paiement", CREDITS_ETEINTS)).toBe(true);
    for (const id of ["preparation", "generation", "cadrage", "portrait", "studio", "reprises"]) {
      expect(ecranEteint(id, CREDITS_ETEINTS), id).toBe(false);
    }
  });
});

describe("le socle ne s'éteint jamais", () => {
  /* Proches, notes, dates, occasions, rappels, compte : aucun drapeau ne les
     gouverne. Le dire par un DÉFAUT plutôt que par une liste évite d'oublier
     un écran neuf — et un écran oublié dans une liste blanche disparaîtrait. */
  it("aucun écran du socle ne sort, même liste vide", () => {
    for (const id of ["accueil", "proches", "proche", "identite", "recherche",
      "dates", "evenement", "note", "occasion", "notifications", "reglagesHub",
      "profil", "rappels", "securite", "aide", "donnees", "recharge", "surface",
      "maintenance"]) {
      expect(ecranEteint(id, RIEN), id).toBe(false);
    }
  });

  // Un écran que cette version ne connaît pas est du socle par défaut. Le
  // masquer sur une supposition ferait disparaître ce qu'on vient d'ajouter.
  it("un écran inconnu est du socle", () => {
    expect(ecranEteint("ecran-a-venir", RIEN)).toBe(false);
  });
});
