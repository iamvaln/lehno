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
    const corps = await (await lire("account_suspend", entete)).json();

    const valide = motifsDuGesteSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();

    const fraude = corps.motifs.find((m: { code: string }) => m.code === "suspected_fraud");
    expect(fraude).toMatchObject({ fr: "Fraude suspectée", en: "Suspected fraud" });
  });

  /* Le back-office change de langue depuis le menu de compte, sans recharger.
     Un seul libellé obligerait à refaire l'appel à chaque bascule — et à
     rouvrir la fenêtre de confirmation en cours de saisie. */
  it("ne demande jamais de choisir la langue au serveur", async () => {
    const entete = await session("admin");
    const corps = await (await lire("account_suspend", entete)).json();
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
    expect((await res.json()).motifs).toEqual([]);
  });

  it("rend une liste vide pour un geste inconnu, sans se plaindre", async () => {
    const entete = await session("admin");
    const res = await lire("ce_geste_n_existe_pas", entete);
    expect(res.status).toBe(200);
    expect((await res.json()).motifs).toEqual([]);
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

    const corps = await (await lire("account_suspend", entete)).json();
    expect(corps.motifs.map((m: { code: string }) => m.code)).not.toContain("suspected_fraud");

    // Rétabli : `audit_reason` est une table de référence, que resetDatabase ne
    // restaure pas — un test qui retire un motif déciderait du point de départ
    // du suivant.
    await db.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`select set_config('app.reason', 'rétabli', true)`;
      await tx.auditReason.update({ where: { code: "suspected_fraud" }, data: { isActive: true } });
    });
  });
});
