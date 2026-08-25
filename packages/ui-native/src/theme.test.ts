import { describe, expect, it } from "vitest";
import { resolve } from "@lehno/tokens";
import { themeDuSysteme, couleursDuSysteme } from "./theme.js";

// useColorScheme rend null quand le système ne s'est pas encore prononcé — au
// tout premier rendu, et sur un appareil sans préférence. Sans repli explicite,
// l'application démarre sans couleurs et l'écran est blanc sur blanc.
describe("le thème du système", () => {
  it("suit la préférence quand elle existe", () => {
    expect(themeDuSysteme("dark")).toBe("dark");
    expect(themeDuSysteme("light")).toBe("light");
  });

  // « unspecified » depuis React Native 0.86, `null` avant elle. Les deux
  // formes doivent tomber du même côté : une montée de version ne doit pas
  // transformer l'absence de préférence en thème sombre par accident.
  it("retombe sur le thème clair quand le système ne dit rien", () => {
    expect(themeDuSysteme("unspecified")).toBe("light");
    expect(themeDuSysteme(null)).toBe("light");
    expect(themeDuSysteme(undefined)).toBe("light");
  });

  // La bascule reste possible sans passer par le système : la charte porte les
  // deux thèmes, et l'utilisateur peut vouloir l'un des deux quoi qu'il arrive.
  it("laisse un choix explicite l'emporter sur le système", () => {
    expect(themeDuSysteme("light", "dark")).toBe("dark");
    expect(themeDuSysteme("dark", "light")).toBe("light");
  });

  it("rend les couleurs de la charte, pas les siennes", () => {
    expect(couleursDuSysteme("dark")).toEqual(resolve("dark"));
    expect(couleursDuSysteme(null)).toEqual(resolve("light"));
  });
});
