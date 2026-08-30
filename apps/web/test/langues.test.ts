import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { ENTETE_LANGUE, langueDemandee } from "../lib/langues.js";

describe("négociation de langue", () => {
  it("sans en-tête, le français", () => {
    expect(langueDemandee(null)).toBe("fr");
    expect(langueDemandee("")).toBe("fr");
  });

  it("reconnaît une variante régionale", () => {
    expect(langueDemandee("en-GB,en;q=0.9")).toBe("en");
    expect(langueDemandee("fr-CM")).toBe("fr");
  });

  it("respecte le facteur de qualité plutôt que l'ordre d'écriture", () => {
    expect(langueDemandee("fr;q=0.2,en;q=0.9")).toBe("en");
    expect(langueDemandee("en;q=0.3,fr;q=0.8")).toBe("fr");
  });

  it("ignore une langue explicitement refusée", () => {
    expect(langueDemandee("en;q=0, de;q=0.9")).toBe("fr");
  });

  it("retombe sur le français devant une langue que le produit ne parle pas", () => {
    expect(langueDemandee("de-DE,de;q=0.9")).toBe("fr");
  });
});

/* Le middleware reporte la langue en en-tête pour `not-found.tsx`, seul rendu
   du site à ne pas recevoir les paramètres de route. C'est un fil ténu : rien
   d'autre ne l'emploie, et le rompre rendrait la page introuvable en français
   à un lecteur anglophone sans que rien ne casse. */
describe("le report de la langue au rendu", () => {
  const passer = async (chemin: string): Promise<Response> => {
    const { middleware } = await import("../middleware.js");
    return middleware(new NextRequest(new URL(`http://localhost${chemin}`))) as unknown as Response;
  };

  it("pose la langue du chemin sur la requête transmise", async () => {
    const reponse = await passer("/en/m/inconnu");
    const reportes = reponse.headers.get("x-middleware-override-headers");
    // Nul = le middleware laisse passer sans rien reporter, et la page
    // introuvable retombera sur le français quelle que soit la langue lue.
    expect(reportes, "aucun en-tête reporté au rendu").not.toBeNull();
    expect(reportes).toContain(ENTETE_LANGUE);
    expect(reponse.headers.get(`x-middleware-request-${ENTETE_LANGUE}`)).toBe("en");
  });

  it("redirige toujours ce qui n'a pas de préfixe", async () => {
    const reponse = await passer("/m/awa");
    expect(reponse.status).toBe(307);
    expect(reponse.headers.get("location")).toMatch(/\/(fr|en)\/m\/awa$/);
  });
});
