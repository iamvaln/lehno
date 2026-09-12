import { afterEach, describe, expect, it, vi } from "vitest";

/* Le système de fichiers est natif : on le remplace par une carte en mémoire.
   Ce qu'on éprouve n'est pas lui — c'est QUAND on télécharge, et quand on ne
   télécharge pas. */
const disque = vi.hoisted(() => new Map<string, string>());
const fs = vi.hoisted(() => ({
  cacheDirectory: "file:///cache/",
  getInfoAsync: vi.fn(async (chemin: string) => ({ exists: disque.has(chemin) })),
  makeDirectoryAsync: vi.fn(async () => {}),
  downloadAsync: vi.fn(async (_url: string, chemin: string) => {
    disque.set(chemin, "octets");
    return { status: 200 };
  }),
  deleteAsync: vi.fn(async (chemin: string) => { disque.delete(chemin); }),
  readDirectoryAsync: vi.fn(async () => [...disque.keys()].map((c) => c.split("/").pop() as string)),
}));
vi.mock("expo-file-system/legacy", () => fs);

const appel = vi.hoisted(() => vi.fn());
vi.mock("../lib/api.js", () => ({ appel }));

const { imageLocale, oublierLesAutres } = await import("../lib/images-locales.js");

const URL_SIGNEE = { url: "https://depot.test/signee?a=1", expireDans: 600 };

describe("les images gardées sur l'appareil", () => {
  afterEach(() => { disque.clear(); vi.clearAllMocks(); });

  /* On range par CLÉ, jamais par URL : l'URL est un laissez-passer signé qui
     change à chaque lecture. Un cache indexé dessus ne reconnaîtrait jamais deux
     fois la même image. */
  it("ne télécharge qu'une fois pour une même clé", async () => {
    appel.mockResolvedValue(URL_SIGNEE);

    const premier = await imageLocale("avatars/ab12");
    expect(premier).not.toBeNull();
    expect(fs.downloadAsync).toHaveBeenCalledTimes(1);

    /* Deuxième passage : le fichier est là, on ne demande RIEN au serveur.
       C'est ce qui rend l'image visible hors connexion. */
    const second = await imageLocale("avatars/ab12");
    expect(second).toBe(premier);
    expect(fs.downloadAsync).toHaveBeenCalledTimes(1);
    expect(appel).toHaveBeenCalledTimes(1);
  });

  it("sert le fichier sans réseau une fois qu'il est là", async () => {
    appel.mockResolvedValue(URL_SIGNEE);
    await imageLocale("avatars/ab12");

    appel.mockRejectedValue(new Error("hors connexion"));
    await expect(imageLocale("avatars/ab12")).resolves.not.toBeNull();
  });

  /* Hors connexion sur une image JAMAIS vue : nul, et l'écran montre ce qu'il
     montre sans image. Ce n'est pas une erreur, c'est un état. */
  it("rend nul quand l'image est inconnue et le réseau absent", async () => {
    appel.mockRejectedValue(new Error("hors connexion"));
    expect(await imageLocale("avatars/jamais-vue")).toBeNull();
  });

  it("ne garde pas un téléchargement à moitié fait", async () => {
    appel.mockResolvedValue(URL_SIGNEE);
    fs.downloadAsync.mockResolvedValueOnce({ status: 500 } as never);
    expect(await imageLocale("avatars/coupee")).toBeNull();
    // Et rien ne reste, sinon le prochain passage servirait un fichier tronqué.
    expect(disque.size).toBe(0);
  });

  it("ne demande rien pour une clé nulle", async () => {
    expect(await imageLocale(null)).toBeNull();
    expect(appel).not.toHaveBeenCalled();
  });

  /* Le ménage se fait avec les clés ENCORE valables : effacer au moment où une
     image change laisserait le fichier pour toujours le jour où un écran
     oublierait de le dire. */
  it("oublie ce qui ne sert plus, et garde le reste", async () => {
    appel.mockResolvedValue(URL_SIGNEE);
    await imageLocale("avatars/ancienne");
    await imageLocale("avatars/nouvelle");
    expect(disque.size).toBe(2);

    await oublierLesAutres(["avatars/nouvelle"]);
    expect(disque.size).toBe(1);
    expect([...disque.keys()][0]).toContain("nouvelle");
  });
});
