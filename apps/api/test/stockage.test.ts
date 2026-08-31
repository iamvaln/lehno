import { describe, expect, it } from "vitest";
import { cle, extensionDe } from "../src/stockage/cle.js";
import { StockageMemoire } from "../src/stockage/memoire.adapter.js";

/* La clé d'un fichier.
 *
 * Des fonctions pures, éprouvées sans compartiment : ce qui décide de la forme
 * d'une clé décide de ce qu'un tiers peut deviner, et ça se vérifie souvent. */
describe("la clé d'un fichier", () => {
  /* Ni un chemin lisible, ni un compteur : une clé qui se devine rend le
     compartiment public par déduction, même fermé — il suffit d'essayer. */
  it("ne se devine pas : deux appels ne donnent jamais la même", () => {
    const vues = new Set(Array.from({ length: 200 }, () => cle("portraits", "png")));
    expect(vues.size).toBe(200);
  });

  /* L'identifiant du propriétaire n'y figure pas : la clé voyage dans des
     journaux et des URL, et elle deviendrait une donnée sur la personne. */
  it("ne porte que son préfixe et un tirage", () => {
    const c = cle("recus", "pdf");
    expect(c).toMatch(/^recus\/[0-9a-f-]{36}\.pdf$/);
  });

  /* L'extension vient du TYPE DÉCLARÉ, jamais du nom du fichier envoyé : ce
     nom vient du client, il peut porter n'importe quoi, et il finirait dans une
     clé qu'on sert ensuite. */
  it("tire son extension du type, et n'en invente pas", () => {
    expect(extensionDe("image/png")).toBe("png");
    expect(extensionDe("image/jpeg; charset=binary")).toBe("jpg");
    expect(extensionDe("application/x-msdownload")).toBe("");
    expect(cle("avatars", extensionDe("application/x-msdownload"))).toMatch(/^avatars\/[0-9a-f-]{36}$/);
  });

  // Un type inconnu ne doit pas pouvoir glisser une extension par la bande.
  it("refuse une extension fabriquée à la main", () => {
    expect(cle("exports", "../../etc/passwd")).toMatch(/^exports\/[0-9a-f-]{36}\.etcpassw$/);
  });
});

describe("le stockage en mémoire", () => {
  /* Il rend de VRAIES clés, de la même forme que l'adaptateur réel : un test
     qui passerait ici et casserait là-bas parce que la clé n'a pas la même tête
     ne prouverait rien. */
  it("rend des clés de la même forme que le stockage réel", async () => {
    const s = new StockageMemoire();
    const d = await s.deposer("portraits", "image/png");
    expect(d.cle).toMatch(/^portraits\/[0-9a-f-]{36}\.png$/);
    expect(d.expireDans).toBeGreaterThan(0);
  });

  it("garde ce qu'on lui écrit, et l'oublie quand on l'efface", async () => {
    const s = new StockageMemoire();
    const c = await s.ecrire("recus", Buffer.from("reçu"), "application/pdf");
    expect(s.contenuDe(c)?.toString()).toBe("reçu");
    await s.effacer(c);
    expect(s.contenuDe(c)).toBeUndefined();
  });
});
