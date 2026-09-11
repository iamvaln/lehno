import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, request as requeteHttp, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { chromium, type Browser } from "playwright-core";
import { withDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";

/* LA TOURNÉE DU BACK-OFFICE, dans un vrai navigateur, contre une vraie API et
 * une vraie base.
 *
 * ELLE EXISTE PARCE QUE LES SUITES VERTES NE DISENT RIEN DE LA FRONTIÈRE.
 * Cinq pannes trouvées le 10 septembre avaient toutes la même forme : deux
 * côtés d'un contrat, chacun éprouvé chez lui, et rien qui les regarde
 * ensemble.
 *
 * - Le tableau de bord rendait `200` avec une forme que le contrat refusait ;
 *   l'épreuve de l'API vérifiait la forme DU SERVICE, celle de l'outil simulait
 *   une réponse conforme AU CONTRAT.
 * - Le menu d'actions de tous les tableaux était invisible : l'icône avait été
 *   renommée par la bibliothèque, et `Icon` retombe sur un cadre vide.
 * - Le Mur composait des adresses vers des pages qui n'existent pas.
 *
 * Aucune n'était visible autrement qu'en REGARDANT. Cette tournée regarde.
 *
 * ─── CE QU'ELLE MONTE
 *
 * Une base jetable (Testcontainers), l'API en processus, puis l'outil COMPILÉ
 * servi par un serveur de fichiers qui relaie `/v1` vers l'API. Le relais n'est
 * pas un détail : il met l'outil et l'API sur la MÊME ORIGINE, ce qui évite de
 * dépendre du réglage CORS — celui-ci a déjà cassé le local trois fois, et ce
 * n'est pas ce qu'on éprouve ici.
 *
 * L'outil est COMPILÉ, pas servi par le serveur de développement : c'est le
 * paquet qui part en production qu'on veut voir, avec ses styles agrégés et son
 * code minifié — c'est là que vivent les classes CSS absentes et les noms
 * d'icône morts.
 *
 * ─── LA SESSION S'ÉCRIT, ELLE NE SE JOUE PAS
 *
 * On frappe un vrai jeton d'administration et on le pose dans le stockage avant
 * le premier rendu. Passer par l'écran de connexion ferait dépendre chaque
 * tournée du code envoyé par courriel — donc d'un adaptateur de courrier, d'une
 * lecture de journal et d'une attente. Ce n'est pas la connexion qu'on éprouve
 * ici, ce sont les quinze écrans qui viennent après.
 */

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/** Les sections dépliantes, et ce qu'elles cachent. Le menu les replie dès
 *  qu'on va ailleurs : sans les nommer, la moitié des écrans reste invisible. */
const DEPLIANTES: Record<string, string[]> = {
  "Paiements": ["À vérifier", "Toutes les transactions", "Versements manuels", "Canaux et barèmes", "Statistiques"],
  "Crédits": ["Transaction manuelle", "Offres et croissance"],
  /* « Gabarits de production » a disparu de cette liste avec son écran. Il
     lisait `prompt_template`, une première tentative de régler les invites sans
     livraison que rien n'a jamais branché à la génération ; le Studio fait la
     même chose, en marchant. */
  "Studio du portrait": ["L'Atelier", "Les essais", "Réglages en service"],
};

/** Ce qu'on refuse de voir, quel que soit l'écran. */
const ECHEC = /n'a pas abouti|Réessayez|did not go through/i;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

/* Le navigateur du poste, jamais un téléchargement : `playwright-core` emprunte
   Chrome là où il est. Absent — une machine sans navigateur —, la tournée se
   DÉCLARE ignorée plutôt que rouge : une suite qu'on ne peut pas faire passer
   chez soi finit par se lancer avec `--exclude`. */
async function navigateurDuPoste(): Promise<Browser | null> {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch (echec) {
    /* La cause est DITE. Un saut silencieux se confond avec un succès, et une
       tournée qu'on croit passée alors qu'elle n'a rien regardé est pire que
       pas de tournée du tout. */
    console.warn("tournée ignorée —", echec instanceof Error ? echec.message.split("\n")[0] : echec);
    return null;
  }
}

/** Sert l'outil compilé, et relaie `/v1` vers l'API — même origine, pas de CORS. */
function servir(racine: string, apiUrl: string): Promise<{ url: string; fermer: () => Promise<void> }> {
  const api = new URL(apiUrl);
  /* Nest annonce « http://[::1]:PORT » quand il écoute en IPv6. `http.request`
     n'accepte pas ce nom d'hôte entre crochets et échoue en silence : le relais
     rendait 502, et les VINGT écrans paraissaient en échec — le montage, pas le
     produit. On repasse en boucle locale IPv4, sur laquelle Nest écoute aussi. */
  const hote = api.hostname === "[::1]" || api.hostname === "::1" ? "127.0.0.1" : api.hostname;
  const serveur: Server = createServer((entrant: IncomingMessage, sortant: ServerResponse) => {
    const chemin = (entrant.url ?? "/").split("?")[0] ?? "/";

    if (chemin.startsWith("/v1")) {
      const relais = requeteHttp(
        {
          hostname: hote, port: api.port, path: entrant.url,
          method: entrant.method, headers: { ...entrant.headers, host: api.host },
        },
        (reponse) => {
          sortant.writeHead(reponse.statusCode ?? 502, reponse.headers);
          reponse.pipe(sortant);
        },
      );
      relais.on("error", () => { sortant.writeHead(502).end(); });
      entrant.pipe(relais);
      return;
    }

    /* `normalize` avant de joindre : sans lui, « /../.. » sortirait de la
       racine servie. Le risque est théorique dans une épreuve, l'habitude ne
       l'est pas. */
    const fichier = join(racine, normalize(chemin));
    const cible = existsSync(fichier) && extname(fichier) !== "" ? fichier : join(racine, "index.html");
    sortant.writeHead(200, { "content-type": TYPES[extname(cible)] ?? "application/octet-stream" });
    sortant.end(readFileSync(cible));
  });

  return new Promise((resoudre) => {
    serveur.listen(0, "127.0.0.1", () => {
      const adresse = serveur.address();
      const port = typeof adresse === "object" && adresse ? adresse.port : 0;
      resoudre({
        url: `http://127.0.0.1:${port}`,
        fermer: () => new Promise((fini) => { serveur.close(() => { fini(); }); }),
      });
    });
  });
}

describe("la tournée du back-office", () => {
  let db: TestDb;
  let app: INestApplication;
  let site: { url: string; fermer: () => Promise<void> };
  let navigateur: Browser | null;
  let jeton: string;

  beforeAll(async () => {
    db = await withDatabase();
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
    process.env.LEHNO_MAIL_CONSOLE = "1";
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("v1");
    app.useGlobalFilters(new AppExceptionFilter());
    await app.listen(0);

    const compte = await db.prisma.admin.create({ data: { email: "tournee@lehno.app", role: "admin" } });
    jeton = (await app.get(AdminTokenService).ouvrir(compte.id)).accessToken;

    /* `/v1` RELATIF : l'outil et l'API partagent l'origine du serveur de
       fichiers, donc `fetch` part sans préflight. */
    execFileSync("pnpm", ["--filter", "@lehno/admin", "build"], {
      env: { ...process.env, VITE_API_URL: "/v1" },
      stdio: "inherit",
    });

    const dist = fileURLToPath(new URL("../../admin/dist", import.meta.url));
    site = await servir(dist, await app.getUrl());
    navigateur = await navigateurDuPoste();
  }, 300_000);

  afterAll(async () => {
    await navigateur?.close();
    await site?.fermer();
    await app?.close();
    await db?.close();
  });

  it("ouvre chaque écran sans échec, sans erreur de page et sans appel refusé", async (epreuve) => {
    /* SAUTÉE, PAS RÉUSSIE. Un `return` anticipé compterait comme un succès, et
       une tournée qu'on croit passée alors qu'elle n'a rien regardé est pire
       que pas de tournée : c'est exactement le genre de vert vide que cette
       épreuve existe pour débusquer ailleurs. */
    if (!navigateur) return epreuve.skip();

    const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 1000 } });
    // Écrite AVANT le premier rendu : l'outil lit le stockage à son montage.
    await contexte.addInitScript(
      /* Le corps s'exécute DANS LE NAVIGATEUR, où `window` existe ; il est
         compilé ici, où il n'existe pas. D'où la déclaration locale plutôt
         qu'un `lib: ["dom"]` sur toute l'API, qui ferait croire au reste du
         serveur qu'il a un navigateur sous la main. */
      ([cle, valeur]: string[]) => {
        (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(cle!, valeur!);
      },
      ["lehno.admin.session", JSON.stringify({
        acces: jeton, rafraichissement: "tournee", role: "admin", email: "tournee@lehno.app",
      })],
    );
    const page = await contexte.newPage();

    const refuses: string[] = [];
    const erreurs: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/v1/") && r.status() >= 400) {
        refuses.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
      }
    });
    page.on("pageerror", (e) => erreurs.push(e.message));

    /* CHAQUE GESTE EST BORNÉ. Sans plafond, un clic sur une entrée devenue
       non cliquable attend la minute par défaut de Playwright, vingt fois : la
       tournée dépasse alors son propre délai et rend « expiré », sans jamais
       dire QUEL écran l'a retenue. Dix secondes suffisent largement à un
       écran d'administration, et un dépassement devient un grief nommé. */
    page.setDefaultTimeout(10_000);
    await page.goto(site.url, { waitUntil: "networkidle" });
    const nav = page.getByRole("navigation");

    const visiter = async (libelle: string, parent?: string): Promise<string> => {
      if (parent) {
        /* Le parent BASCULE : un clic déplie, le suivant replie. On insiste
           jusqu'à voir l'enfant plutôt que de supposer l'état du menu. */
        for (let essai = 0; essai < 3; essai += 1) {
          if (await nav.getByText(libelle, { exact: true }).first().isVisible().catch(() => false)) break;
          await nav.getByText(parent, { exact: true }).first().click().catch(() => undefined);
          await page.waitForTimeout(400);
        }
      }
      try {
        await nav.getByText(libelle, { exact: true }).first().click();
      } catch {
        return `${libelle} : entrée introuvable ou non cliquable`;
      }
      await page.waitForTimeout(1200);
      const texte = await page.locator("body").innerText();
      return ECHEC.test(texte) ? `${libelle} : écran en échec` : "";
    };

    const entrees = [...new Set((await nav.locator("button, a").allInnerTexts())
      .map((x) => x.trim()).filter(Boolean))];

    /* SANS CE PLANCHER, une navigation qui ne trouverait plus rien passerait au
       vert en ne visitant aucun écran — c'est exactement ainsi qu'une épreuve
       cesse d'éprouver sans que personne le voie. */
    expect(entrees.length, "le menu du rôle admin").toBeGreaterThanOrEqual(12);

    const griefs: string[] = [];
    for (const entree of entrees) {
      if (Object.hasOwn(DEPLIANTES, entree)) continue;
      griefs.push(await visiter(entree));
    }
    for (const [parent, enfants] of Object.entries(DEPLIANTES)) {
      for (const enfant of enfants) griefs.push(await visiter(enfant, parent));
    }

    /* ET ELLE PROUVE QU'ELLE A REGARDÉ. Sans ce compte, un menu qui cesserait
       de rendre ses entrées ferait passer la tournée au vert en n'ouvrant
       aucun écran. */
    expect(griefs.length, "écrans effectivement ouverts").toBeGreaterThanOrEqual(20);
    expect(griefs.filter(Boolean), "écrans en échec").toEqual([]);
    expect([...new Set(refuses)], "appels refusés par l'API").toEqual([]);
    expect([...new Set(erreurs)], "erreurs de page").toEqual([]);

    await contexte.close();
  }, 300_000);
});
