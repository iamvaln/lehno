import { describe, expect, it } from "vitest";
import { resolve } from "@lehno/tokens";
import { meriteDesGuillemets, styleDeCitation } from "./Quote.styles.js";

const CLAIR = resolve("light");

describe("la citation", () => {
  it("s'écrit dans l'italique de titre", () => {
    const s = styleDeCitation({ couleurs: CLAIR });
    expect(s.fontFamily).toBe("Fraunces-Italic");
    expect(s.color).toBe(CLAIR.textBody);
  });

  it("s'efface en ton discret", () => {
    expect(styleDeCitation({ couleurs: CLAIR, ton: "muted" }).color).toBe(CLAIR.textSecondary);
  });

  /* Les guillemets ne s'ouvrent qu'au-delà d'une certaine longueur : sur une
     note de trois mots, ils pèsent plus que le mot cité. Le seuil vient du
     design system, où il valait 90 caractères. */
  it("n'ouvre les guillemets qu'au-delà du seuil", () => {
    expect(meriteDesGuillemets("Une idée courte.")).toBe(false);
    expect(meriteDesGuillemets("x".repeat(91))).toBe(true);
  });

  it("laisse le choix l'emporter sur le seuil", () => {
    expect(meriteDesGuillemets("Court.", true)).toBe(true);
    expect(meriteDesGuillemets("x".repeat(200), false)).toBe(false);
  });
});
