import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { motifsDuGesteSchema } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

describe("administration — les motifs proposés pour un geste", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let jetons: AdminTokenService;

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
    baseUrl = await app.getUrl();
    jetons = app.get(AdminTokenService);
  }, 180_000);

  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await app?.close(); await db.close(); });

  const session = async (role: "support" | "admin") => {
    const compte = await db.prisma.admin.create({ data: { email: `${role}@lehno.app`, role } });
    const { accessToken } = await jetons.ouvrir(compte.id);
    return { authorization: `Bearer ${accessToken}` };
  };

  const lire = async (geste: string, entete: Record<string, string>) =>
    fetch(`${baseUrl}/v1/admin/reasons?geste=${encodeURIComponent(geste)}`, { headers: entete });

  it("refuse une lecture sans session", async () => {
    expect((await lire("account_suspend", {})).status).toBe(401);
  });

  it("suit le contrat, et rend les deux langues ensemble", async () => {
    const entete = await session("admin");
    const corps = (await (await lire("account_suspend", entete)).json()) as { motifs: { code: string; fr: string; en: string }[] };

    const valide = motifsDuGesteSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();

    const fraude = corps.motifs.find((m) => m.code === "suspected_fraud");
    expect(fraude).toMatchObject({ fr: "Fraude suspectée", en: "Suspected fraud" });
  });

  /* Le back-office change de langue depuis le menu de compte, sans recharger.
     Un seul libellé obligerait à refaire l'appel à chaque bascule — et à
     rouvrir la fenêtre de confirmation en cours de saisie. */
  it("ne demande jamais de choisir la langue au serveur", async () => {
    const entete = await session("admin");
    const corps = (await (await lire("account_suspend", entete)).json()) as { motifs: { code: string; fr: string; en: string }[] };
    for (const m of corps.motifs) {
      expect(m.fr).toBeTruthy();
      expect(m.en).toBeTruthy();
    }
  });

  /* Huit gestes n'ont aucun préréglage et n'attendent qu'une phrase. Un écran
     qui traiterait le vide comme une panne afficherait une erreur là où il faut
     une zone de saisie. */
  it("rend une liste vide pour un geste sans préréglage, et non une erreur", async () => {
    const entete = await session("admin");
    const res = await lire("feature_flag_toggle", entete);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { motifs: unknown[] }).motifs).toEqual([]);
  });

  it("rend une liste vide pour un geste inconnu, sans se plaindre", async () => {
    const entete = await session("admin");
    const res = await lire("ce_geste_n_existe_pas", entete);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { motifs: unknown[] }).motifs).toEqual([]);
  });

  // Ce sont les GESTES qui sont gardés, pas la lecture de leurs motifs :
  // restreindre celle-ci ne protégerait rien et cacherait au support la raison
  // qu'il doit donner.
  it("ouvre la liste au support comme à l'administrateur", async () => {
    const entete = await session("support");
    expect((await lire("account_suspend", entete)).status).toBe(200);
  });

  // Un motif retiré ne se propose plus, mais ce qu'il a justifié hier reste.
  it("cesse de proposer un motif retiré", async () => {
    const entete = await session("admin");
    await db.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`select set_config('app.reason', 'retiré pour le test', true)`;
      await tx.auditReason.update({ where: { code: "suspected_fraud" }, data: { isActive: false } });
    });

    const corps = (await (await lire("account_suspend", entete)).json()) as { motifs: { code: string; fr: string; en: string }[] };
    expect(corps.motifs.map((m) => m.code)).not.toContain("suspected_fraud");

    // Rétabli : `audit_reason` est une table de référence, que resetDatabase ne
    // restaure pas — un test qui retire un motif déciderait du point de départ
    // du suivant.
    await db.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`select set_config('app.reason', 'rétabli', true)`;
      await tx.auditReason.update({ where: { code: "suspected_fraud" }, data: { isActive: true } });
    });
  });
  describe("l'administration du module", () => {
    const ecrire = (chemin: string, entete: Record<string, string>, methode: string, corps?: unknown) =>
      fetch(`${baseUrl}/v1/admin/reasons${chemin}`, {
        method: methode,
        headers: { ...entete, "content-type": "application/json" },
        ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
      });

    /* Un code par cas. `audit_reason` est une table de référence, que
       resetDatabase ne vide pas : un code réemployé d'un test à l'autre ferait
       échouer la création en doublon, et le cas suivant lirait une erreur là
       où il attend un identifiant. */
    let n = 0;
    const neuf = () => ({
      code: `decision_produit_${(n += 1)}`, fr: "Décision produit", en: "Product decision",
      gestes: ["account_suspend"], reason: "Nouveau motif demandé par le support",
    });

    it("le support ne fabrique pas les motifs, il les emploie", async () => {
      const entete = await session("support");
      const m = neuf();
      expect((await ecrire("", entete, "POST", m)).status).toBe(403);
      expect((await ecrire("/all", entete, "GET")).status).toBe(403);
    });

    it("un administrateur en crée un, et il se propose aussitôt", async () => {
      const entete = await session("admin");
      const m = neuf();
      expect((await ecrire("", entete, "POST", m)).status).toBe(201);

      const corps = (await (await lire("account_suspend", entete)).json()) as { motifs: { code: string }[] };
      expect(corps.motifs.map((x) => x.code)).toContain(m.code);
    });

    /* Sans cette contrainte, quelqu'un collerait un libellé — « Fraude
       suspectée » — dans le champ du code, et on serait revenu au point de
       départ : un texte d'affichage en guise de clé de comptage. */
    it("refuse un code qui ressemble à un libellé", async () => {
      const entete = await session("admin");
      const res = await ecrire("", entete, "POST", { ...neuf(), code: "Fraude suspectée" });
      expect(res.status).toBe(400);
    });

    it("refuse deux motifs sous le même code", async () => {
      const entete = await session("admin");
      const m = neuf();
      await ecrire("", entete, "POST", m);
      expect((await ecrire("", entete, "POST", m)).status).toBe(409);
    });

    /* L'INVARIANT du module : renommer un code couperait en deux l'historique
       de tout ce qu'il a justifié — les gestes d'hier garderaient l'ancien, ceux
       de demain le nouveau, et aucun comptage ne les rapprocherait. */
    it("n'offre aucun moyen de renommer un code", async () => {
      const entete = await session("admin");
      const m = neuf();
      const cree = (await (await ecrire("", entete, "POST", m)).json()) as { id: string };

      const res = await ecrire(`/${cree.id}`, entete, "PATCH", {
        code: "autre_code", reason: "tentative de renommage",
      });
      expect(res.status).toBe(400);

      const apres = await db.prisma.auditReason.findUniqueOrThrow({ where: { id: cree.id } });
      expect(apres.code).toBe(m.code);
    });

    it("remplace les gestes en bloc, et l'ancien cesse de le proposer", async () => {
      const entete = await session("admin");
      const m = neuf();
      const cree = (await (await ecrire("", entete, "POST", m)).json()) as { id: string };

      await ecrire(`/${cree.id}`, entete, "PATCH", {
        gestes: ["account_erase"], reason: "ce motif vaut pour l'effacement",
      });

      const avant = (await (await lire("account_suspend", entete)).json()) as { motifs: { code: string }[] };
      const apres = (await (await lire("account_erase", entete)).json()) as { motifs: { code: string }[] };
      expect(avant.motifs.map((x) => x.code)).not.toContain(m.code);
      expect(apres.motifs.map((x) => x.code)).toContain(m.code);
    });

    /* Un motif se retire, il ne s'efface pas : le journal ne porte aucune clé
       étrangère vers lui, donc l'effacer ne casserait rien — il rendrait
       simplement illisibles tous les gestes qu'il a justifiés. */
    it("n'offre aucun moyen d'effacer un motif", async () => {
      const entete = await session("admin");
      const m = neuf();
      const cree = (await (await ecrire("", entete, "POST", m)).json()) as { id: string };
      expect((await ecrire(`/${cree.id}`, entete, "DELETE")).status).toBe(404);
    });

    it("garde le motif au journal, avec sa raison", async () => {
      const entete = await session("admin");
      const m = neuf();
      await ecrire("", entete, "POST", m);
      const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "audit_reason_create" }, orderBy: { createdAt: "desc" } });
      expect(trace.reason).toBe(m.reason);
    });
  });
});
