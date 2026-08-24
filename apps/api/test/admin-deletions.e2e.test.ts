import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

const JOUR = 24 * 60 * 60_000;

describe("administration — les demandes de suppression", () => {
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

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    await db.prisma.systemParameter.update({
      where: { key: "account_grace_period_days" }, data: { value: "30" },
    });
  });
  afterAll(async () => { await app?.close(); await db.close(); });

  const session = async (role: "support" | "admin") => {
    const compte = await db.prisma.admin.create({ data: { email: `${role}@lehno.app`, role } });
    const { accessToken } = await jetons.ouvrir(compte.id);
    return { compte, entete: { authorization: `Bearer ${accessToken}` } };
  };

  /** Un compte dont la suppression a été demandée il y a `ilYA` jours. */
  const enAttente = (n: number, ilYA: number) =>
    db.prisma.user.create({
      data: {
        email: `d${n}@example.com`, username: `d${n}`, referralCode: `D${n}`,
        status: "pending_deletion",
        deletionRequestedAt: new Date(Date.now() - ilYA * JOUR),
      },
    });

  const lister = (entete: Record<string, string>, requete = "") =>
    fetch(`${baseUrl}/v1/admin/deletions${requete}`, { headers: entete });

  it("refuse sans session", async () => {
    expect((await fetch(`${baseUrl}/v1/admin/deletions`)).status).toBe(401);
  });

  it("ne liste que les comptes en délai de grâce", async () => {
    await enAttente(1, 5);
    await db.prisma.user.create({ data: { email: "a@example.com", username: "a", referralCode: "A" } });
    const { entete } = await session("support");

    const corps = (await (await lister(entete)).json()) as { items: { compte: string }[] };
    expect(corps.items.map((d) => d.compte)).toEqual(["d1"]);
  });

  // L'échéance ne vit pas en colonne : elle se calcule depuis la demande et le
  // délai réglé en base. Le figer à l'écriture le rendrait faux dès que le
  // paramètre change — et c'est justement un paramètre qu'on règle.
  it("calcule l'échéance depuis le délai réglé, pas depuis une colonne", async () => {
    await enAttente(1, 5);
    const { entete } = await session("support");

    const avant = (await (await lister(entete)).json()) as { items: { joursRestants: number }[] };
    expect(avant.items[0]?.joursRestants).toBe(25);

    await db.prisma.systemParameter.update({
      where: { key: "account_grace_period_days" }, data: { value: "10" },
    });

    const apres = (await (await lister(entete)).json()) as { items: { joursRestants: number }[] };
    expect(apres.items[0]?.joursRestants).toBe(5);
  });

  it("marque échue une demande dont le délai est passé", async () => {
    await enAttente(1, 40);
    const { entete } = await session("support");

    const corps = (await (await lister(entete)).json()) as { items: { etat: string; joursRestants: number }[] };
    expect(corps.items[0]?.etat).toBe("echue");
    expect(corps.items[0]?.joursRestants).toBeLessThanOrEqual(0);
  });

  it("filtre les échéances du jour et de la semaine", async () => {
    await enAttente(1, 30);  // échoit aujourd'hui
    await enAttente(2, 26);  // dans 4 jours
    await enAttente(3, 5);   // dans 25 jours
    const { entete } = await session("support");

    const jour = (await (await lister(entete, "?echeance=today")).json()) as { items: { compte: string }[] };
    expect(jour.items.map((d) => d.compte)).toEqual(["d1"]);

    const semaine = (await (await lister(entete, "?echeance=week")).json()) as { items: { compte: string }[] };
    expect(semaine.items.map((d) => d.compte).sort()).toEqual(["d1", "d2"]);
  });

  // La plus urgente d'abord : c'est une file de travail, pas un annuaire.
  it("range les demandes par échéance, la plus proche en tête", async () => {
    await enAttente(1, 5);
    await enAttente(2, 29);
    const { entete } = await session("support");

    const corps = (await (await lister(entete)).json()) as { items: { compte: string }[] };
    expect(corps.items.map((d) => d.compte)).toEqual(["d2", "d1"]);
  });

  // Les deux gestes du délai de grâce ne créent aucun chemin d'écriture propre :
  // ce sont des changements d'état, et PATCH /admin/users/{id} les porte déjà,
  // avec son motif obligatoire et sa règle de rôle. Deux chemins pour un même
  // geste finiraient par diverger — l'un journalisant, l'autre non.
  it("restaurer un compte le retire de la file", async () => {
    const u = await enAttente(1, 5);
    const { entete } = await session("support");

    await fetch(`${baseUrl}/v1/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...entete },
      body: JSON.stringify({ status: "active", reason: "Demande retirée par le titulaire" }),
    });

    const corps = (await (await lister(entete)).json()) as { items: unknown[] };
    expect(corps.items).toHaveLength(0);
  });

  it("effacer sans attendre reste réservé à l'administrateur", async () => {
    const u = await enAttente(1, 40);
    const support = await session("support");

    const refus = await fetch(`${baseUrl}/v1/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...support.entete },
      body: JSON.stringify({ status: "deleted", reason: "Délai échu, effacement demandé" }),
    });
    expect(refus.status).toBe(403);

    const admin = await session("admin");
    const accepte = await fetch(`${baseUrl}/v1/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...admin.entete },
      body: JSON.stringify({ status: "deleted", reason: "Délai échu, effacement demandé" }),
    });
    expect(accepte.status).toBe(200);
  });
});
