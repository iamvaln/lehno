import { afterEach, describe, expect, it, vi } from "vitest";

/* Le sélecteur d'images est natif : on le remplace, sinon rien ne tourne hors
   d'un téléphone. Ce qu'on éprouve n'est pas lui — c'est ce que la fonction
   fait de sa réponse, et surtout ce qu'elle envoie. */
const selecteur = vi.hoisted(() => ({
  requestMediaLibraryPermissionsAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
}));
vi.mock("expo-image-picker", () => selecteur);

const appel = vi.hoisted(() => vi.fn());
vi.mock("../lib/api.js", () => ({ appel }));

const { choisirUnePhoto, envoyerLaPhoto } = await import("../lib/photo-de-profil.js");

const PROFIL = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "awa", displayName: "Awa", avatarUrl: "https://exemple.test/a.jpg",
  email: "awa@example.com", emailVerified: true, uiLanguage: "fr", theme: "system",
  timezone: "Africa/Douala", sendHour: 9, gender: null,
};

describe("la photo de profil", () => {
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

  /* La permission se demande AU MOMENT du geste. Refusée, elle est durable :
     l'écran doit pouvoir le dire plutôt que de laisser un bouton inerte. */
  it("distingue le refus de permission de l'annulation", async () => {
    selecteur.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await choisirUnePhoto()).toEqual({ issue: "refusee" });

    selecteur.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    selecteur.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });
    expect(await choisirUnePhoto()).toEqual({ issue: "annulee" });
  });

  /* On n'envoie pas l'original : le choix est déjà recadré au carré. Ce n'est
     pas une garantie — le serveur revérifie tout —, c'est une économie de
     forfait. */
  it("demande un carré au sélecteur", async () => {
    selecteur.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    selecteur.launchImageLibraryAsync.mockResolvedValue({
      canceled: false, assets: [{ uri: "file:///a.jpg", mimeType: "image/jpeg" }],
    });
    await choisirUnePhoto();
    expect(selecteur.launchImageLibraryAsync.mock.calls[0]?.[0]).toMatchObject({
      allowsEditing: true, aspect: [1, 1],
    });
  });

  /* La borne vient du SERVEUR : une constante recopiée finirait par diverger,
     et c'est celle du serveur qui refuse. Refusé avant la montée — envoyer
     cinq mégaoctets pour se les faire refuser ferait payer deux fois. */
  it("refuse une photo trop lourde sans la monter", async () => {
    appel.mockResolvedValueOnce({
      url: "https://depot.test/a", expireDans: 600, typeMime: "image/jpeg", tailleMax: 10,
    });
    const montee = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url === "file:///a.jpg"
      ? { blob: async () => ({ size: 11 }) }
      : montee())));

    await expect(envoyerLaPhoto({ uri: "file:///a.jpg", typeMime: "image/jpeg" }))
      .rejects.toThrow("trop_lourde");
    expect(montee).not.toHaveBeenCalled();
  });

  /* Le dépôt part DIRECTEMENT sur le stockage, et la confirmation ne porte
     AUCUN corps : le serveur sait quelle clé il a délivrée, et à qui. */
  it("dépose sur l'URL signée, puis confirme sans rien nommer", async () => {
    appel
      .mockResolvedValueOnce({
        url: "https://depot.test/a", expireDans: 600, typeMime: "image/jpeg", tailleMax: 5_000_000,
      })
      .mockResolvedValueOnce(PROFIL);
    const monte: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "file:///a.jpg") return { blob: async () => ({ size: 1000 }) };
      monte.push({ url, init: init as RequestInit });
      return { ok: true };
    }));

    const profil = await envoyerLaPhoto({ uri: "file:///a.jpg", typeMime: "image/jpeg" });
    expect(profil.avatarUrl).toBe(PROFIL.avatarUrl);

    expect(monte[0]?.url).toBe("https://depot.test/a");
    expect(monte[0]?.init.method).toBe("PUT");
    // Aucun jeton de session sur le dépôt : l'URL signée porte seule la
    // permission.
    expect(JSON.stringify(monte[0]?.init.headers)).not.toMatch(/authorization/i);

    const confirmation = appel.mock.calls[1];
    expect(confirmation?.[0]).toBe("/me/profile/avatar");
    expect(confirmation?.[1]).toEqual({ method: "POST" });
  });
});
