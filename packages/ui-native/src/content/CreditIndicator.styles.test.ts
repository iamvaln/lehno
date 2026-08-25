import { describe, expect, it } from "vitest";
import { resolve } from "@lehno/tokens";
import { styleDIndicateurDeCredit } from "./CreditIndicator.styles.js";

const CLAIR = resolve("light");

describe("l'indicateur de crédits", () => {
  // Le coût s'affiche AVANT de lancer : c'est la règle de la charte. Quand il
  // dépasse le solde, la ligne passe à l'avertissement — pas à l'erreur, rien
  // n'est encore cassé.
  it("avertit quand le coût dépasse le solde", () => {
    expect(styleDIndicateurDeCredit({ couleurs: CLAIR, solde: 0, cout: 1 }).texte.color)
      .toBe(CLAIR.feedbackWarning);
    expect(styleDIndicateurDeCredit({ couleurs: CLAIR, solde: 4, cout: 1 }).texte.color)
      .toBe(CLAIR.textMention);
  });

  // Sans solde connu, rien ne permet de dire qu'il manque quelque chose : la
  // ligne reste neutre plutôt que d'alarmer à tort.
  it("n'avertit pas quand le solde est inconnu", () => {
    expect(styleDIndicateurDeCredit({ couleurs: CLAIR, cout: 1 }).texte.color).toBe(CLAIR.textMention);
  });

  // La variante « solde » est un chiffre qu'on lit de loin : caractère de
  // titre, et l'unité en petit à côté.
  it("écrit le solde dans le caractère de titre", () => {
    const s = styleDIndicateurDeCredit({ couleurs: CLAIR, solde: 4, variante: "solde" });
    expect(s.nombre?.fontFamily).toBe("Fraunces-Regular");
    expect(s.nombre?.fontSize).toBe(34);
  });
});
