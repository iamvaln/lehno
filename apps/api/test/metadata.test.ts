import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { MetadataService } from "../src/me/metadata.service.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";

describe("les métadonnées", () => {
  let db: TestDb;
  let metadata: MetadataService;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    metadata = new MetadataService(db.prisma as never);
  });

  it("rend les catégories avec leur nature et leur contrainte", async () => {
    const m = await metadata.get();
    const nogo = m.categories.find((c) => c.code === "dislikes_nogo");

    // La seule information que le client ne peut PAS déduire d'une
    // énumération : celle-ci contraint ce que le produit propose, elle
    // n'organise pas seulement l'affichage.
    expect(nogo?.isConstraint).toBe(true);
    expect(nogo?.kind).toBe("durable");

    const faits = m.categories.find((c) => c.code === "facts");
    expect(faits?.isConstraint).toBe(false);
    expect(faits?.kind).toBe("ponctuelle");
  });

  it("rend les sept catégories du socle, et rien d'autre", async () => {
    const m = await metadata.get();
    expect(m.categories.map((c) => c.code).sort()).toEqual([
      "challenges", "dislikes_nogo", "encouragements", "facts",
      "gift_ideas", "interests", "message_ideas",
    ]);
  });

  // LE cas qui distingue une lecture en base d'une constante recopiée — et
  // aucun des deux précédents ne le fait : ils rendraient sept catégories dans
  // les deux mondes.
  //
  // On retire une catégorie de la table, et le point d'entrée doit le refléter.
  // Une constante continuerait d'annoncer les sept, et le client afficherait un
  // rangement qu'aucune note ne peut atteindre — vide sur toutes les fiches,
  // sans que rien ne l'explique.
  //
  // Ce n'est pas théorique : un commit de cette branche a figé cette constante
  // par accident, et les six autres cas sont restés verts.
  it("suit la table, pas une constante recopiée", async () => {
    await db.prisma.noteCategory.deleteMany({});
    await db.prisma.category.deleteMany({ where: { code: "challenges" } });

    const m = await metadata.get();
    expect(m.categories.map((c) => c.code)).not.toContain("challenges");
    expect(m.categories).toHaveLength(6);

    // On la remet : resetDatabase PRÉSERVE la table `category`, semée par la
    // migration 20260822154334_content. Sans ce rétablissement, la suppression
    // déborderait sur tous les cas suivants, et l'ordre d'exécution
    // deviendrait une dépendance invisible.
    await db.prisma.category.create({
      data: { code: "challenges", kind: "ponctuelle", isConstraint: false },
    });
  });

  it("rend les énumérations dont les écrans composent leurs listes", async () => {
    const m = await metadata.get();
    expect(m.eventKinds).toEqual(["birthday", "other"]);
    expect(m.eventNatures).toEqual(["happy", "sensitive"]);
    expect(m.scheduleUnits).toEqual(["day", "week", "month", "quarter", "year"]);
    expect(m.personRelations).toContain("famille_proche");
    expect(m.personRegisters).toEqual(["familier", "amical", "formel"]);
    expect(m.contactChannels).toContain("whatsapp");
  });

  // Aucun libellé : ils vivent dans les traductions de l'application, indexés
  // par code. En rendre ici ferait deux sources de vérité pour un même mot, et
  // obligerait le serveur à connaître la langue du demandeur.
  it("ne rend aucun libellé traduit", async () => {
    const m = await metadata.get();
    const texte = JSON.stringify(m);
    expect(texte).not.toMatch(/Anniversaire|Birthday|Idées cadeaux|Gift ideas/);
  });

  describe("HTTP de bout en bout", () => {
    const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
    const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
    const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

    let app: INestApplication;
    let baseUrl: string;
    let precedent: Record<string, string | undefined>;

    beforeAll(async () => {
      precedent = {
        DATABASE_URL: process.env.DATABASE_URL,
        OTP_PEPPER: process.env.OTP_PEPPER,
        JWT_SECRET: process.env.JWT_SECRET,
        ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
        LEHNO_MAIL_CONSOLE: process.env.LEHNO_MAIL_CONSOLE,
      };
      process.env.DATABASE_URL = db.url;
      process.env.OTP_PEPPER = PEPPER;
      process.env.JWT_SECRET = SECRET;
      process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
      process.env.LEHNO_MAIL_CONSOLE = "1";

      app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
      app.setGlobalPrefix("v1");
      app.useGlobalFilters(new AppExceptionFilter());
      await app.listen(0);
      baseUrl = await app.getUrl();
    }, 120_000);

    afterAll(async () => {
      await app.close();
      for (const [cle, valeur] of Object.entries(precedent)) {
        if (valeur === undefined) delete process.env[cle];
        else process.env[cle] = valeur;
      }
    });

    const jeton = (userId: string): string =>
      jwt.sign({ sub: userId }, SECRET, { algorithm: "HS256", expiresIn: 900 });

    it("refuse un appel sans jeton", async () => {
      const r = await fetch(`${baseUrl}/v1/me/metadata`);
      expect(r.status).toBe(401);
    });

    it("rend les métadonnées via HTTP", async () => {
      const u = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@example.com`,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
      });

      const r = await fetch(`${baseUrl}/v1/me/metadata`, {
        headers: { authorization: `Bearer ${jeton(u.id)}` },
      });
      expect(r.status).toBe(200);
      const corps = (await r.json()) as { categories: unknown[]; eventKinds: string[] };
      expect(corps.categories).toHaveLength(7);
      expect(corps.eventKinds).toEqual(["birthday", "other"]);
    });
  });
});
