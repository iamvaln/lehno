import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { creerClient, ErreurApi, type MagasinSession } from "../src/api/client.js";

// Un magasin de session en mémoire : le client ne doit connaître ni le stockage
// du navigateur ni sa disponibilité — un onglet privé peut le refuser.
function magasin(session: { acces: string; rafraichissement: string; role: "support" | "admin" } | null = null): MagasinSession & { valeur: typeof session } {
  return {
    valeur: session,
    lire() { return this.valeur; },
    ecrire(s) { this.valeur = s; },
    effacer() { this.valeur = null; },
  };
}

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

const SESSION = { acces: "jeton-acces", rafraichissement: "jeton-refresh", role: "admin" as const };

describe("le client d'API du back-office", () => {
  it("ne cherche pas de corps derrière un 204", async () => {
    const appels = vi.fn().mockResolvedValue(reponse(204));
    const client = creerClient({ base: "https://api.test/v1", magasin: magasin(SESSION), fetch: appels });

    await expect(client.appeler("/admin/admins/abc", { methode: "DELETE" })).resolves.toBeUndefined();
  });

  // Le contrat commun §2 : le client traduit un code, il ne montre jamais le
  // message du serveur — celui-ci est destiné au journal, et il est écrit dans
  // une seule langue.
  it("remonte le code d'erreur, jamais le message du serveur", async () => {
    const appels = vi.fn().mockResolvedValue(
      reponse(404, { code: "not_found", message: "Person 42 not found for tenant 7" }),
    );
    const client = creerClient({ base: "https://api.test/v1", magasin: magasin(SESSION), fetch: appels });

    const echec = await client.appeler("/admin/users/42").catch((e: unknown) => e);
    expect(echec).toBeInstanceOf(ErreurApi);
    expect((echec as ErreurApi).code).toBe("not_found");
    expect(JSON.stringify(echec)).not.toContain("tenant 7");
  });

  it("porte le jeton en en-tête, jamais dans l'URL", async () => {
    const appels = vi.fn().mockResolvedValue(reponse(200, { ok: true }));
    const client = creerClient({ base: "https://api.test/v1", magasin: magasin(SESSION), fetch: appels });

    await client.appeler("/admin/dashboard", { schema: z.object({ ok: z.boolean() }) });

    const [url, init] = appels.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("jeton-acces");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer jeton-acces");
  });

  it("rafraîchit puis rejoue une seule fois après un 401", async () => {
    const appels = vi.fn()
      .mockResolvedValueOnce(reponse(401, { code: "unauthorized", message: "expired" }))
      .mockResolvedValueOnce(reponse(200, { accessToken: "neuf", refreshToken: "neuf-r", expiresIn: 1800, role: "admin" }))
      .mockResolvedValueOnce(reponse(200, { ok: true }));
    const m = magasin(SESSION);
    const client = creerClient({ base: "https://api.test/v1", magasin: m, fetch: appels });

    await expect(client.appeler("/admin/dashboard", { schema: z.object({ ok: z.boolean() }) }))
      .resolves.toEqual({ ok: true });
    expect(appels).toHaveBeenCalledTimes(3);
    expect(m.valeur?.acces).toBe("neuf");
  });

  // Deux reprises masqueraient une boucle : un serveur qui rend 401 sur tout,
  // jeton neuf compris, doit fermer la session plutôt que tourner.
  it("ferme la session si le second 401 suit le rafraîchissement", async () => {
    const appels = vi.fn()
      .mockResolvedValueOnce(reponse(401, { code: "unauthorized", message: "expired" }))
      .mockResolvedValueOnce(reponse(200, { accessToken: "neuf", refreshToken: "neuf-r", expiresIn: 1800, role: "admin" }))
      .mockResolvedValueOnce(reponse(401, { code: "unauthorized", message: "encore" }));
    const m = magasin(SESSION);
    const client = creerClient({ base: "https://api.test/v1", magasin: m, fetch: appels });

    await expect(client.appeler("/admin/dashboard")).rejects.toThrow(ErreurApi);
    expect(m.valeur).toBeNull();
  });

  it("ferme la session quand le rafraîchissement lui-même est refusé", async () => {
    const appels = vi.fn()
      .mockResolvedValueOnce(reponse(401, { code: "unauthorized", message: "expired" }))
      .mockResolvedValueOnce(reponse(401, { code: "refresh_reused", message: "rejoué" }));
    const m = magasin(SESSION);
    const client = creerClient({ base: "https://api.test/v1", magasin: m, fetch: appels });

    const echec = await client.appeler("/admin/dashboard").catch((e: unknown) => e);
    expect((echec as ErreurApi).code).toBe("refresh_reused");
    expect(m.valeur).toBeNull();
  });

  // Une réponse hors schéma est un défaut de serveur. La laisser passer la
  // ferait échouer plus loin, dans un écran, où la cause ne se lit plus.
  it("refuse une réponse qui ne suit pas son schéma", async () => {
    const appels = vi.fn().mockResolvedValue(reponse(200, { ok: "oui" }));
    const client = creerClient({ base: "https://api.test/v1", magasin: magasin(SESSION), fetch: appels });

    await expect(client.appeler("/admin/dashboard", { schema: z.object({ ok: z.boolean() }) }))
      .rejects.toThrow(ErreurApi);
  });

  it("n'ajoute pas d'en-tête d'autorisation sans session", async () => {
    const appels = vi.fn().mockResolvedValue(reponse(200, { envoye: true }));
    const client = creerClient({ base: "https://api.test/v1", magasin: magasin(null), fetch: appels });

    await client.appeler("/admin/auth/otp", { methode: "POST", corps: { email: "sam@lehno.app" } });

    const [, init] = appels.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has("authorization")).toBe(false);
  });

  it("compose l'URL sans doubler la barre, et passe la requête en paramètres", async () => {
    const appels = vi.fn().mockResolvedValue(reponse(200, { items: [] }));
    const client = creerClient({ base: "https://api.test/v1", magasin: magasin(SESSION), fetch: appels });

    await client.appeler("/admin/users", { requete: { etat: "actif", curseur: "abc" } });

    const [url] = appels.mock.calls[0] as [string];
    expect(url).toBe("https://api.test/v1/admin/users?etat=actif&curseur=abc");
  });

  // Un réseau coupé n'est pas une erreur de serveur : sans ce code, l'écran
  // afficherait « erreur interne » à quelqu'un dont le wifi vient de tomber.
  it("traduit une panne de réseau en code, plutôt qu'en exception brute", async () => {
    const appels = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const client = creerClient({ base: "https://api.test/v1", magasin: magasin(SESSION), fetch: appels });

    const echec = await client.appeler("/admin/dashboard").catch((e: unknown) => e);
    expect(echec).toBeInstanceOf(ErreurApi);
    expect((echec as ErreurApi).code).toBe("reseau_indisponible");
  });
});
