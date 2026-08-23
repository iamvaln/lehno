import { describe, expect, it, vi, afterEach } from "vitest";
import { chargerDocumentLegal, documentRepli } from "../lib/legal.js";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

// Même contrat que chargerConfig (lib/config-publique.ts) : la page doit
// s'afficher même API éteinte, avec un repli plutôt qu'une page vide.
describe("document légal", () => {
  it("sans adresse d'API configurée, le repli", async () => {
    vi.stubEnv("API_URL", "");
    await expect(chargerDocumentLegal("cgu", "fr", 300)).resolves.toEqual(documentRepli("fr"));
  });

  it("interroge le bon chemin, avec la langue en paramètre de requête", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    const fetchSimule = vi.fn().mockResolvedValue({ ok: true, text: async () => "# Titre\n\n_Version 1_\n" });
    vi.stubGlobal("fetch", fetchSimule);
    await chargerDocumentLegal("confidentialite", "en", 300);
    expect(fetchSimule).toHaveBeenCalledWith(
      "http://api.test/v1/public/legal/confidentialite?lang=en",
      { next: { revalidate: 300 } },
    );
  });

  it("le markdown servi par l'API est analysé", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# Un vrai titre\n\n_Version 2026-08-23_\n\n## 1. Une section\n\nUn texte précis.\n",
    }));
    const doc = await chargerDocumentLegal("cgu", "fr", 300);
    expect(doc.titre).toBe("Un vrai titre");
    expect(doc.sections[0]!.blocs).toEqual([
      { type: "paragraphe", contenu: [{ type: "texte", valeur: "Un texte précis." }] },
    ]);
  });

  it("une réponse en erreur retombe sur le repli", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(chargerDocumentLegal("cgu", "fr", 300)).resolves.toEqual(documentRepli("fr"));
  });

  it("un serveur injoignable retombe sur le repli, sans lever", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(chargerDocumentLegal("cgu", "fr", 300)).resolves.toEqual(documentRepli("fr"));
  });
});
