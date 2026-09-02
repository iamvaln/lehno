import { describe, expect, it } from "vitest";
import {
  expliqueLeBonusManque, lignesDeBienvenue, phraseDeBienvenue, resteAvantExpiration,
} from "../lib/bienvenue.js";
import { MESSAGES } from "../messages/index.js";

const t = MESSAGES.fr;

describe("ce que la bienvenue promet", () => {
  /* Au lancement, une seule nature est ouverte. La phrase ne cite que
     celle-là : énumérer le portrait quand il est fermé promettrait ce qu'on ne
     livre pas, à la seconde même où quelqu'un arrive. */
  it("ne cite que les natures ouvertes", () => {
    const phrase = phraseDeBienvenue(["generation.message"], t);
    expect(phrase).toContain(t.bienvenueNatureMessage);
    expect(phrase).not.toContain(t.bienvenueNaturePortrait);
    expect(phrase).not.toContain(t.bienvenueNatureIdees);
  });

  it("les cite toutes quand elles le sont", () => {
    const phrase = phraseDeBienvenue(
      ["generation.message", "generation.ideas", "generation.portrait"], t,
    );
    for (const nature of [t.bienvenueNatureMessage, t.bienvenueNatureIdees, t.bienvenueNaturePortrait]) {
      expect(phrase).toContain(nature);
    }
  });

  /* Aucune nature ouverte : la phrase s'arrête au carnet. Une énumération vide
     après deux points — « De quoi préparer vos premières célébrations : » suivi
     de rien — se lirait comme un défaut d'affichage. */
  it("s'arrête au carnet quand aucune ne l'est", () => {
    expect(phraseDeBienvenue([], t)).toBe(t.bienvenueOuvre);
  });

  /* L'ordre est celui du kit — portrait, idées, message —, pas celui de la
     liste reçue : c'est une phrase, et l'ordre d'une énumération est une
     décision de langue, pas un hasard de tri. */
  it("garde l'ordre de la phrase, pas celui des drapeaux", () => {
    const phrase = phraseDeBienvenue(["generation.message", "generation.portrait"], t);
    expect(phrase.indexOf(t.bienvenueNaturePortrait))
      .toBeLessThan(phrase.indexOf(t.bienvenueNatureMessage));
  });
});

describe("une ligne par geste, jamais un total", () => {
  const OUVERT = ["referral"];

  /* Trois gestes, et ils ne se valent pas. Le cadeau vient à tout le monde ; la
     liste d'attente se MÉRITAIT — il fallait s'y inscrire ; le parrainage se
     mérite autrement. Les additionner effacerait la raison de chacun. */
  it("détaille les trois plutôt que d'en faire un solde", () => {
    const lignes = lignesDeBienvenue(
      { cadeau: 5, attente: 3, parrainage: { outcome: "credited", bonusCredits: 2 } },
      OUVERT, t,
    );
    expect(lignes.map((l) => l.cle)).toEqual(["cadeau", "attente", "parrain"]);
  });

  /* Le cas du LANCEMENT en porte deux : ceux qui recevront le courrier
     d'ouverture attendaient. Ce n'est pas un cas limite, c'est l'état le plus
     fréquent des premiers jours. */
  it("porte deux lignes pour qui attendait sans code", () => {
    const lignes = lignesDeBienvenue({ cadeau: 5, attente: 3, parrainage: null }, OUVERT, t);
    expect(lignes.map((l) => l.cle)).toEqual(["cadeau", "attente"]);
  });

  // AUCUNE LIGNE À VIDE. Un cadeau nul n'a pas de ligne, une attente nulle non
  // plus : l'écran ne garde pas la place de ce qui n'existe pas.
  it("n'affiche aucune ligne vide", () => {
    expect(lignesDeBienvenue({ cadeau: 0, attente: 0, parrainage: null }, OUVERT, t)).toEqual([]);
    const lignes = lignesDeBienvenue({ cadeau: 5, attente: 0, parrainage: null }, OUVERT, t);
    expect(lignes.map((l) => l.cle)).toEqual(["cadeau"]);
  });

  /* Un parrainage crédité de zéro n'a pas de ligne non plus : « Bonus de
     parrainage · 0 crédit » annoncerait un geste qui n'a rien donné. */
  it("ne montre pas un bonus nul", () => {
    const lignes = lignesDeBienvenue(
      { cadeau: 5, attente: 0, parrainage: { outcome: "credited", bonusCredits: 0 } }, OUVERT, t,
    );
    expect(lignes.map((l) => l.cle)).toEqual(["cadeau"]);
  });
});

describe("les deux issues qui n'empêchent rien", () => {
  const OUVERT = ["referral"];

  /* Un code inconnu ou son propre code laissent le compte se créer. La ligne le
     CONSTATE, en gris sourd — pas de bandeau d'erreur pour un bonus qui
     n'arrive pas. Alarmer quelqu'un sur un compte qui vient de se créer serait
     lui apprendre à s'inquiéter de ce qui a marché. */
  it("constate un code introuvable sans alarmer", () => {
    const lignes = lignesDeBienvenue(
      { cadeau: 5, attente: 0, parrainage: { outcome: "unknown", bonusCredits: 0 } }, OUVERT, t,
    );
    const parrain = lignes.find((l) => l.cle === "parrain");
    expect(parrain?.sourd).toBe(true);
    expect(parrain?.accent).toBeUndefined();
    expect(expliqueLeBonusManque(lignes)).toBe(true);
  });

  it("constate son propre code de la même façon", () => {
    const lignes = lignesDeBienvenue(
      { cadeau: 5, attente: 0, parrainage: { outcome: "self", bonusCredits: 0 } }, OUVERT, t,
    );
    expect(lignes.find((l) => l.cle === "parrain")?.sourd).toBe(true);
  });

  // La phrase d'explication n'accompagne QUE le bonus manqué : sans parrainage,
  // il n'y a rien à expliquer.
  it("n'explique rien quand tout a marché", () => {
    const lignes = lignesDeBienvenue(
      { cadeau: 5, attente: 0, parrainage: { outcome: "credited", bonusCredits: 2 } }, OUVERT, t,
    );
    expect(expliqueLeBonusManque(lignes)).toBe(false);
    expect(expliqueLeBonusManque([])).toBe(false);
  });

  /* Le drapeau `referral` gouverne l'entrée : fermé, il n'y a ni ligne ni
     explication, même si le serveur a renvoyé une issue. */
  it("disparaît entièrement quand le parrainage est fermé", () => {
    const lignes = lignesDeBienvenue(
      { cadeau: 5, attente: 3, parrainage: { outcome: "credited", bonusCredits: 2 } }, [], t,
    );
    expect(lignes.map((l) => l.cle)).toEqual(["cadeau", "attente"]);
  });
});

describe("le temps qui reste pour saisir le code", () => {
  const T = Date.parse("2026-08-31T04:00:00.000Z");

  /* ON COMPTE DEPUIS L'ÉCHÉANCE SERVIE, pas depuis une durée démarrée au
     montage : revenir en arrière puis repartir faisait repartir le minuteur de
     dix minutes sur un code déjà mort — « expiré » au-dessus d'un décompte qui
     tournait encore. */
  it("mesure l'âge du CODE, pas celui de l'écran", () => {
    expect(resteAvantExpiration("2026-08-31T04:09:00.000Z", T)).toBe(540);
    // Le même code, lu trois minutes plus tard : il reste moins, pas autant.
    expect(resteAvantExpiration("2026-08-31T04:09:00.000Z", T + 180_000)).toBe(360);
  });

  it("ne descend jamais sous zéro", () => {
    expect(resteAvantExpiration("2026-08-31T03:59:00.000Z", T)).toBe(0);
  });

  /* Illisible : on rend `null` plutôt que zéro. « Il reste 0 s » sur un code
     parfaitement valide ferait renoncer quelqu'un qui pouvait encore saisir —
     l'écran se tait, et le serveur tranchera. */
  it("se tait plutôt que d'annoncer zéro sur une échéance illisible", () => {
    expect(resteAvantExpiration("pas une date", T)).toBeNull();
    expect(resteAvantExpiration("", T)).toBeNull();
  });
});
