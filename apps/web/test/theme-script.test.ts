import { describe, expect, it } from "vitest";
import { themeScript } from "../lib/theme-script.js";

describe("script de thème", () => {
  const run = (stored: string | null, prefersDark: boolean): string => {
    const root: { dataset: Record<string, string> } = { dataset: {} };
    const fn = new Function("localStorage", "matchMedia", "document", themeScript);
    fn(
      { getItem: () => stored },
      (q: string) => ({ matches: prefersDark && q.includes("dark") }),
      { documentElement: root },
    );
    return root.dataset.theme ?? "";
  };

  it("le choix explicite l'emporte sur le système", () => {
    expect(run("light", true)).toBe("light");
    expect(run("dark", false)).toBe("dark");
  });

  it("sans choix, il suit le système", () => {
    expect(run(null, true)).toBe("dark");
    expect(run(null, false)).toBe("light");
  });

  it("« system » stocké retombe sur la préférence du navigateur", () => {
    expect(run("system", true)).toBe("dark");
  });

  it("un stockage inaccessible ne fait pas planter la page", () => {
    const root: { dataset: Record<string, string> } = { dataset: {} };
    const fn = new Function("localStorage", "matchMedia", "document", themeScript);
    expect(() => fn(
      { getItem: () => { throw new Error("bloqué"); } },
      () => ({ matches: false }),
      { documentElement: root },
    )).not.toThrow();
    expect(root.dataset.theme).toBe("light");
  });
});
