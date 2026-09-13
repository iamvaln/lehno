import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { ClientGuard } from "../src/clients/client.guard.js";
import { VersionGuard } from "../src/clients/version.guard.js";
import { VersionsService } from "../src/clients/versions.service.js";
import { dansLeContexte, contexteCourant, type ContexteMesure } from "../src/tracking/contexte.js";

/**
 * LES DEUX GARDES, ET CE QUI LES EMPÊCHE DE FERMER PAR ACCIDENT.
 *
 * Elles dorment toutes deux derrière un paramètre système. C'est le point que
 * ces cas défendent : les allumer alors qu'aucun build n'envoie encore ses
 * en-têtes mettrait TOUT LE MONDE dehors d'un coup, applications déjà
 * installées comprises. Une garde ferme une porte ; elle ne doit jamais la
 * fermer par accident.
 */
describe("les gardes du client et de la version", () => {
  let db: TestDb;

  const VIDE: ContexteMesure = {
    surface: null, appVersion: null, language: null, theme: null, sessionId: null,
    correlationId: null, clientId: null, clientType: null, appBuild: null,
    osName: null, osVersion: null, env: null, clientVerdict: null, clientEnv: null,
  };

  /** Un contexte de requête, tel que le middleware l'aurait posé. */
  const contexte = (champs: Partial<ContexteMesure>): ContexteMesure => ({ ...VIDE, ...champs });

  /** Le contexte d'exécution que Nest passe à une garde. */
  const requete = (chemin: string) => ({
    switchToHttp: () => ({ getRequest: () => ({ path: chemin }) }),
  }) as never;

  /* LA MÊME CHOSE, AVEC UNE RÉPONSE QUI RETIENT SES EN-TÊTES. Le contexte nu
     ci-dessus n'en porte pas — c'est voulu et ça vaut d'être éprouvé : la garde
     tourne aussi là où rien ne recueille un en-tête, et elle ne doit pas tomber
     pour autant. */
  const requeteEtReponse = (chemin: string) => {
    const entetes = new Map<string, string>();
    return {
      entetes,
      contexte: {
        switchToHttp: () => ({
          getRequest: () => ({ path: chemin }),
          getResponse: () => ({
          /* IL JETTE COMME CELUI DE NODE. Un faux qui accepterait tout
             prouverait seulement que la garde ne pose pas l'en-tête, jamais
             que le poser CASSERAIT — or c'est ce fait-là qui motive la
             vérification, et un gabarit qui ne le modélise pas laisse croire
             qu'on se protège d'un danger imaginaire. */
          setHeader: (n: string, v: string) => {
            if (/[^\x20-\x7e]/.test(v)) {
              const e = new Error(`Invalid character in header content ["${n}"]`);
              (e as { code?: string }).code = "ERR_INVALID_CHAR";
              throw e;
            }
            entetes.set(n, v);
          },
        }),
        }),
      } as never,
    };
  };

  const allumer = async (cle: string): Promise<void> => {
    await db.prisma.systemParameter.upsert({
      where: { key: cle },
      create: { key: cle, value: "true", valueType: "boolean" as never },
      update: { value: "true" },
    });
  };

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => { await resetDatabase(db.prisma); });

  describe("la garde du client", () => {
    const garde = (): ClientGuard => new ClientGuard(db.prisma as never);

    /* LE CAS QUI COMPTE LE PLUS. Éteinte, elle laisse tout passer — y compris
       un appel qui n'a présenté aucune identité. C'est l'état d'aujourd'hui, et
       c'est ce qui permet de livrer la lecture avant le refus. */
    it("laisse tout passer tant qu'elle dort", async () => {
      const g = garde();
      await dansLeContexte(contexte({ clientVerdict: "absent" }), async () => {
        expect(await g.canActivate(requete("/v1/me/persons"))).toBe(true);
      });
    });

    it("refuse un client non reconnu une fois allumée", async () => {
      await allumer("client_guard_enabled");
      const g = garde();
      for (const verdict of ["absent", "inconnu", "coupe", "cle_fausse", "type_discordant"]) {
        await dansLeContexte(contexte({ clientVerdict: verdict }), async () => {
          await expect(g.canActivate(requete("/v1/me/persons")))
            .rejects.toMatchObject({ code: "client_unknown" });
        });
      }
    });

    it("laisse passer un client reconnu", async () => {
      await allumer("client_guard_enabled");
      const g = garde();
      await dansLeContexte(contexte({ clientVerdict: "reconnu" }), async () => {
        expect(await g.canActivate(requete("/v1/me/persons"))).toBe(true);
      });
    });

    /* LES SURFACES PUBLIQUES RESTENT OUVERTES. Un lien de liste s'ouvre dans le
       navigateur de quelqu'un qui n'a AUCUNE application installée, donc aucune
       paire à présenter. Y poser la garde fermerait le partage — qui est le
       cœur du produit. */
    it("n'a pas prise sur les surfaces publiques ni sur la santé", async () => {
      await allumer("client_guard_enabled");
      const g = garde();
      await dansLeContexte(contexte({ clientVerdict: "absent" }), async () => {
        expect(await g.canActivate(requete("/v1/public/wishlists/abc"))).toBe(true);
        expect(await g.canActivate(requete("/health"))).toBe(true);
      });
    });

    /* ET L'AUTHENTIFICATION, ELLE, EST SOUS GARDE — c'est tranché : une
       application s'identifie AVANT de connecter quelqu'un. Le tout premier
       appel d'un build neuf doit donc déjà porter ses en-têtes. */
    it("a prise sur l'authentification", async () => {
      await allumer("client_guard_enabled");
      const g = garde();
      await dansLeContexte(contexte({ clientVerdict: "absent" }), async () => {
        await expect(g.canActivate(requete("/v1/auth/otp")))
          .rejects.toMatchObject({ code: "client_unknown" });
      });
    });

    /* UN VERDICT NUL VEUT DIRE QUE LA RÉSOLUTION A ÉCHOUÉ — une panne de base,
       par exemple. On refuse alors : une garde qui s'ouvrirait sur une panne ne
       garde rien.
       C'est l'inverse du choix fait sur le PARAMÈTRE, qui reste éteint si on ne
       peut pas le lire. Ne pas savoir s'il faut garder ⇒ on n'empêche rien ;
       savoir qu'il faut garder mais ne pas pouvoir identifier ⇒ on refuse. */
    it("refuse quand la résolution elle-même a échoué", async () => {
      await allumer("client_guard_enabled");
      const g = garde();
      await dansLeContexte(contexte({ clientVerdict: null }), async () => {
        await expect(g.canActivate(requete("/v1/me/persons")))
          .rejects.toMatchObject({ code: "client_unknown" });
      });
    });
  });

  describe("la garde de la version", () => {
    const garde = (): VersionGuard =>
      new VersionGuard(db.prisma as never, new VersionsService(db.prisma as never));

    const poserUneVersion = async (build: number): Promise<void> => {
      await db.prisma.appVersion.create({
        data: {
          platform: "mobile_ios" as never, version: `1.0.${build}`,
          buildNumber: build, storeUrl: "https://apps.apple.com/lehno",
        },
      });
    };

    /* UN CLIENT DE PRODUCTION RECONNU — c'est la seule situation où cette garde
       décide quoi que ce soit. Tous les cas ci-dessous partent de là. */
    const enProduction = (build: number | null) => contexte({
      clientType: "mobile_ios", appBuild: build,
      clientVerdict: "reconnu", clientEnv: "prod",
    });

    it("laisse tout passer tant qu'elle dort", async () => {
      await poserUneVersion(400);
      const g = garde();
      await dansLeContexte(enProduction(999), async () => {
        expect(await g.canActivate(requete("/v1/me/persons"))).toBe(true);
      });
    });

    /* ─── LA SUGGESTION ──────────────────────────────────────────────────────
     *
     * Elle se CALCULAIT depuis toujours et ne partait jamais : le paramètre
     * était lu en tête de garde et coupait tout, suggestion comprise. La
     * bannière n'aurait donc pu exister qu'une fois le refus allumé — le plus
     * doux des deux gestes attendait le plus dur. */
    it("annonce une version plus récente, avec le lien pour la prendre", async () => {
      await poserUneVersion(400);
      await poserUneVersion(401);
      const g = garde();
      const { contexte: ctx, entetes } = requeteEtReponse("/v1/me/persons");
      await dansLeContexte(enProduction(400), async () => {
        expect(await g.canActivate(ctx)).toBe(true);
      });
      expect(entetes.get("x-app-update-available")).toBe("1.0.401");
      /* LE LIEN VOYAGE AVEC LA VERSION. Annoncer une version sans dire où la
         prendre est la même faute que « mettez à jour » sans lien, en plus
         poli. */
      expect(entetes.get("x-app-update-url")).toBe("https://apps.apple.com/lehno");
    });

    it("ne dit rien quand le build est déjà le dernier", async () => {
      await poserUneVersion(400);
      const g = garde();
      const { contexte: ctx, entetes } = requeteEtReponse("/v1/me/persons");
      await dansLeContexte(enProduction(400), async () => {
        expect(await g.canActivate(ctx)).toBe(true);
      });
      expect(entetes.size).toBe(0);
    });

    /* « ON NOTE, ON NE BLOQUE PAS » — la phase que le §8.3 du registre des
       versions proposait et qui n'existait nulle part. Éteinte, la garde suggère
       au lieu de fermer : les builds périmés reçoivent une bannière, on regarde
       le parc bouger, puis on allume. */
    it("éteinte, suggère à un build périmé au lieu de le refuser", async () => {
      await poserUneVersion(400);
      const g = garde();
      const { contexte: ctx, entetes } = requeteEtReponse("/v1/me/persons");
      await dansLeContexte(enProduction(999), async () => {
        expect(await g.canActivate(ctx)).toBe(true);
      });
      expect(entetes.get("x-app-update-available")).toBe("1.0.400");
    });

    /* UNE VALEUR QU'UN EN-TÊTE NE PEUT PAS PORTER NE LE FAIT PAS TOMBER.
       `version` n'est contraint que par sa longueur : rien n'y interdit un
       retour à la ligne, et Node refuse alors la valeur — sur CHAQUE requête,
       puisque la garde tourne partout. Une bannière qui manque est un
       désagrément ; une API qui tombe n'en est pas un. */
    it("se tait plutôt que de poser un en-tête impossible", async () => {
      await db.prisma.appVersion.create({
        data: {
          platform: "mobile_ios" as never, version: "1.0\n.500",
          buildNumber: 500, storeUrl: "https://apps.apple.com/lehno",
        },
      });
      await poserUneVersion(400);
      const g = garde();
      const { contexte: ctx, entetes } = requeteEtReponse("/v1/me/persons");
      await dansLeContexte(enProduction(400), async () => {
        expect(await g.canActivate(ctx)).toBe(true);
      });
      expect(entetes.has("x-app-update-available")).toBe(false);
      // Le lien, lui, est posable : on ne jette pas ce qui tient.
      expect(entetes.get("x-app-update-url")).toBe("https://apps.apple.com/lehno");
    });

    /* LA GARDE TOURNE AUSSI LÀ OÙ RIEN NE RECUEILLE UN EN-TÊTE. Elle ne doit pas
       tomber pour autant — c'est ce que le contexte nu éprouve. */
    it("ne tombe pas quand la réponse ne sait pas porter d'en-tête", async () => {
      await poserUneVersion(400);
      await poserUneVersion(401);
      const g = garde();
      await dansLeContexte(enProduction(400), async () => {
        expect(await g.canActivate(requete("/v1/me/persons"))).toBe(true);
      });
    });

    /* ─── LES DEUX EXEMPTIONS ────────────────────────────────────────────────
     *
     * LE BLOCAGE QU'ELLES EMPÊCHENT, signalé par la session mobile le
     * 13 septembre : `eas.json` porte `appVersionSource: "remote"`, donc le
     * numéro de build n'existe QUE dans les binaires produits par EAS. En Expo
     * Go, en build de développement et en diffusion interne, il n'y a rien à
     * envoyer — et sans exemption, allumer cette garde mettrait dehors toute
     * l'équipe et tous les testeurs, avec un « mettez à jour » qu'aucun magasin
     * ne peut satisfaire. */
    it("ne juge pas un client hors production, même sans numéro de build", async () => {
      await allumer("version_guard_enabled");
      await poserUneVersion(400);
      const g = garde();
      for (const env of ["dev", "staging"]) {
        await dansLeContexte(
          contexte({ clientType: "mobile_ios", appBuild: null, clientVerdict: "reconnu", clientEnv: env }),
          async () => { expect(await g.canActivate(requete("/v1/me/persons"))).toBe(true); },
        );
      }
    });

    /* ELLE SE DÉCIDE SUR L'ENVIRONNEMENT ENREGISTRÉ, JAMAIS SUR L'EN-TÊTE.
       Un build de production qui déclarerait `x-app-env: dev` ne s'exempterait
       de rien : c'est la paire présentée qui tranche, et elle est en base.
       Sans ce cas, l'exemption serait un interrupteur que n'importe qui
       actionne. */
    it("ne se laisse pas exempter par un en-tête menteur", async () => {
      await allumer("version_guard_enabled");
      await poserUneVersion(400);
      const g = garde();
      await dansLeContexte(
        contexte({
          clientType: "mobile_ios", appBuild: 999, clientVerdict: "reconnu",
          clientEnv: "prod", env: "dev",
        }),
        async () => {
          await expect(g.canActivate(requete("/v1/me/persons")))
            .rejects.toMatchObject({ code: "upgrade_required" });
        },
      );
    });

    /* SANS CLIENT RECONNU, ON NE JUGE PAS. Le type et l'environnement viennent
       de la paire, pas des en-têtes — décider sur une déclaration reviendrait à
       laisser le client choisir s'il veut être jugé. */
    it("ne juge pas quand le client n'est pas reconnu", async () => {
      await allumer("version_guard_enabled");
      await poserUneVersion(400);
      const g = garde();
      for (const verdict of ["absent", "inconnu", "cle_fausse"]) {
        await dansLeContexte(
          contexte({ clientType: "mobile_ios", appBuild: 999, clientVerdict: verdict }),
          async () => { expect(await g.canActivate(requete("/v1/me/persons"))).toBe(true); },
        );
      }
    });

    /* LE 426 PORTE OÙ ALLER. Un écran qui dit « mettez à jour » sans lien n'est
       pas un écran, c'est un mur. */
    it("rend 426 avec la version attendue et le lien", async () => {
      await allumer("version_guard_enabled");
      await poserUneVersion(400);
      const g = garde();
      await dansLeContexte(enProduction(999), async () => {
        await expect(g.canActivate(requete("/v1/me/persons"))).rejects.toMatchObject({
          code: "upgrade_required",
          details: { cause: "inconnue", version: "1.0.400", storeUrl: "https://apps.apple.com/lehno" },
        });
      });
    });

    it("laisse passer un build enregistré", async () => {
      await allumer("version_guard_enabled");
      await poserUneVersion(400);
      const g = garde();
      await dansLeContexte(enProduction(400), async () => {
        expect(await g.canActivate(requete("/v1/me/persons"))).toBe(true);
      });
    });

    it("n'a pas prise sur les surfaces publiques", async () => {
      await allumer("version_guard_enabled");
      await poserUneVersion(400);
      const g = garde();
      await dansLeContexte(enProduction(999), async () => {
        expect(await g.canActivate(requete("/v1/public/wishlists/abc"))).toBe(true);
      });
    });
  });

  /* LE CONTEXTE RESTE LISIBLE APRÈS LES GARDES — sans quoi l'origine
     n'atteindrait pas les lignes écrites plus loin dans la requête. */
  it("ne consomme pas le contexte", async () => {
    await dansLeContexte(contexte({ clientVerdict: "reconnu", clientId: "web_prod_1" }), async () => {
      await garderPuisLire();
    });

    async function garderPuisLire(): Promise<void> {
      await new ClientGuard(db.prisma as never).canActivate(requete("/v1/me/persons"));
      expect(contexteCourant().clientId).toBe("web_prod_1");
    }
  });
});
