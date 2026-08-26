import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { construireOpenApi } from "./openapi.js";
import { CLES_DRAPEAUX, DRAPEAUX } from "./flags.js";

describe("contrat publié", () => {
  it("porte les métadonnées du service", () => {
    const d = construireOpenApi() as { openapi: string; info: { title: string }; servers: unknown[] };
    expect(d.openapi).toMatch(/^3\./);
    expect(d.info.title).toBe("Lehno");
    expect(d.servers).not.toHaveLength(0);
  });

  // Le contrat décrit ce que le serveur sert vraiment : les chemins publics
  // existent déjà, ils doivent y être.
  it("décrit les chemins déjà servis", () => {
    const chemins = Object.keys((construireOpenApi() as { paths: object }).paths);
    expect(chemins).toContain("/public/waitlist");
    expect(chemins).toContain("/public/contact");
  });

  // Tous les contrôleurs de apps/api/src sont câblés dans AppModule
  // aujourd'hui : /public/*, /auth/* et /me/profile. Un contrat qui en tait
  // un ment autant qu'un contrat périmé — voir apps/api/src/app.module.ts.
  it("décrit tous les chemins câblés dans AppModule, pas seulement l'exemple du plan", () => {
    const chemins = Object.keys((construireOpenApi() as { paths: object }).paths);
    expect(chemins).toEqual(
      expect.arrayContaining([
        "/public/waitlist",
        "/public/contact",
        "/public/config",
        "/public/legal/{document}",
        "/auth/otp",
        "/auth/otp/verify",
        "/auth/federated",
        "/auth/refresh",
        "/auth/session",
        "/me/profile",
        "/me/profile/username-available",
      ]),
    );
  });

  // AppExceptionFilter (apps/api/src/common/errors.ts) rend un 500
  // "internal_error" sur toute exception non prévue — sur n'importe quel
  // chemin, pas seulement ceux qui le documentaient déjà sous "4XX". Un
  // client qui ne voit que le "4XX" ne saurait pas qu'il doit prévoir un
  // 500 à réessayer, distinct d'un refus à corriger.
  it("documente le 500 générique sur chaque chemin, distinct du refus 4XX", () => {
    const paths = (construireOpenApi() as { paths: Record<string, Record<string, { responses: Record<string, unknown> }>> }).paths;
    for (const [chemin, operations] of Object.entries(paths)) {
      for (const [methode, operation] of Object.entries(operations)) {
        expect(operation.responses, `${methode.toUpperCase()} ${chemin}`).toHaveProperty("500");
        expect(operation.responses, `${methode.toUpperCase()} ${chemin}`).toHaveProperty("4XX");
      }
    }
  });

  // Le mobile décide ce qu'il masque d'après cette table. Recopiée à la main,
  // elle vieillirait sans bruit : un drapeau ajouté au registre resterait
  // absent du contrat, donc jamais masqué — l'écran paraîtrait, et le serveur
  // rendrait 404 dessus. C'est exactement l'écart que la couverture existe
  // pour empêcher (spécification §6.1).
  it("publie la couverture de CHAQUE drapeau du registre", () => {
    const paths = (construireOpenApi() as {
      paths: Record<string, Record<string, { description?: string }>>;
    }).paths;
    const doc = paths["/me/features"]?.get?.description ?? "";

    for (const cle of CLES_DRAPEAUX) {
      expect(doc, `le drapeau ${cle} manque à la couverture publiée`).toContain(`\`${cle}\``);
      for (const chemin of DRAPEAUX[cle].chemins) {
        expect(doc, `${cle} : le chemin ${chemin} manque à la couverture publiée`).toContain(chemin);
      }
    }
  });

  // Le cas que le mobile doit pouvoir livrer : une version sans les listes de
  // souhaits. Il ne peut le faire que si le contrat lui dit que `reservation`
  // s'éteint AVEC `wishlist.own`, sans qu'il ait à le déduire.
  it("annonce la dépendance qui éteint la réservation avec les listes", () => {
    const paths = (construireOpenApi() as {
      paths: Record<string, Record<string, { description?: string }>>;
    }).paths;
    const doc = paths["/me/features"]?.get?.description ?? "";
    expect(DRAPEAUX.reservation.requiert).toContain("wishlist.own");
    expect(doc).toContain("`reservation` requiert `wishlist.own`");
  });

  // LE test qui compte. Un fichier engendré que rien ne vérifie pourrit : il
  // décrit alors une API qui n'existe plus, et un client s'y fie.
  it("le fichier versionné n'est pas périmé", () => {
    const surDisque = readFileSync(
      join(import.meta.dirname, "..", "..", "..", "docs", "api", "openapi.json"),
      "utf-8",
    );
    expect(
      JSON.parse(surDisque),
      "docs/api/openapi.json est périmé — relancer `pnpm --filter @lehno/contracts openapi`",
    ).toEqual(construireOpenApi());
  });
});
