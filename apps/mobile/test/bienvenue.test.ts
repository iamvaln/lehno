import { describe, expect, it } from "vitest";
import { phraseDeBienvenue } from "../lib/bienvenue.js";
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
