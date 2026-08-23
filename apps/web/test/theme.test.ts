import { describe, expect, it } from "vitest";
import { themeScript } from "../lib/theme-script.js";
import { themeCss } from "../lib/theme-css.js";

describe("thème", () => {
  const executer = (stocke: string | null, prefereSombre: boolean): string => {
    const racine = { classList: { add: (c: string) => { racine.classes.push(c); }, remove: () => {} }, classes: [] as string[] };
    const fn = new Function("localStorage", "matchMedia", "document", themeScript);
    fn(
      { getItem: () => stocke },
      (q: string) => ({ matches: prefereSombre && q.includes("dark") }),
      { documentElement: racine },
    );
    return racine.classes.join(" ");
  };

  it("le choix explicite l'emporte sur le système", () => {
    expect(executer("light", true)).toBe("");
    expect(executer("dark", false)).toBe("lehno-nuit");
  });

  it("sans choix, il suit le système", () => {
    expect(executer(null, true)).toBe("lehno-nuit");
    expect(executer(null, false)).toBe("");
  });

  it("un stockage inaccessible ne fait pas planter la page", () => {
    const racine = { classList: { add: () => {}, remove: () => {} } };
    const fn = new Function("localStorage", "matchMedia", "document", themeScript);
    expect(() => fn(
      { getItem: () => { throw new Error("bloqué"); } },
      () => ({ matches: false }),
      { documentElement: racine },
    )).not.toThrow();
  });

  // La règle doit viser la racine ET le corps : le script ne peut poser la
  // classe que sur la racine, le corps n'existant pas encore.
  it("la feuille fait porter le thème sombre par la racine comme par le corps", () => {
    expect(themeCss).toContain(":root.lehno-nuit, body.lehno-nuit");
  });

  // Le back-office redéfinit le rayon : deux occurrences attendues, une par
  // contexte, jamais deux dans le même.
  it("les jetons hors thème ne sont émis qu'une fois par contexte", () => {
    expect(themeCss.match(/--radius-sm:/g)).toHaveLength(2);
    expect(themeCss).toContain(".lehno-admin {");
  });
});
