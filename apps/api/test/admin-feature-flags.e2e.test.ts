import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { CLES_DRAPEAUX, drapeauxAdminSchema } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

describe("administration — les drapeaux de fonctionnalité", () => {
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
    return { compte, entete: { authorization: `Bearer ${accessToken}` } };
  };

  const lire = (entete: Record<string, string>) =>
    fetch(`${baseUrl}/v1/admin/feature-flags`, { headers: entete });

  const basculer = (entete: Record<string, string>, corps: unknown) =>
    fetch(`${baseUrl}/v1/admin/feature-flags`, {
      method: "PATCH",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify(corps),
    });

  const allumer = (cle: string) =>
    db.prisma.featureFlag.upsert({
      where: { key: cle }, create: { key: cle, enabled: true }, update: { enabled: true },
    });

  it("refuse sans session", async () => {
    expect((await lire({})).status).toBe(401);
  });

  // « Le rôle support n'a accès à aucune section de la famille Économie, y
  // compris en lecture » (ux-admin §6). Les drapeaux en font partie.
  it("est fermé au support, même en lecture", async () => {
    const { entete } = await session("support");
    expect((await lire(entete)).status).toBe(403);
  });

  it("suit le contrat publié, au champ près", async () => {
    const { entete } = await session("admin");

    const corps = await (await lire(entete)).json();

    const valide = drapeauxAdminSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  // Le registre est en code, l'état en base. Une clé sans ligne doit donc
  // paraître quand même — sinon un drapeau jamais touché serait invisible, et
  // personne ne pourrait l'allumer.
  it("rend tout le registre, y compris les clés sans ligne en base", async () => {
    const { entete } = await session("admin");

    const corps = (await (await lire(entete)).json()) as { items: { cle: string; actif: boolean }[] };

    expect(corps.items.map((d) => d.cle).sort()).toEqual([...CLES_DRAPEAUX].sort());
    for (const drapeau of corps.items) expect(drapeau.actif).toBe(false);
  });

  // « Le socle — proches, notes, dates, rappels, compte — n'y figure pas : il
  // n'est pas extinguible » (§5.7).
  it("ne propose aucun interrupteur sur le socle", async () => {
    const { entete } = await session("admin");

    const corps = (await (await lire(entete)).json()) as { items: { cle: string }[] };

    const cles = corps.items.map((d) => d.cle);
    for (const socle of ["persons", "notes", "events", "reminders", "account", "me.persons"]) {
      expect(cles).not.toContain(socle);
    }
  });

  // Le cœur du §5.7 : « L'écran annonce les conséquences avant la bascule,
  // plutôt que de les laisser découvrir. » La cascade est l'inverse de
  // `requiert`, et elle se calcule de proche en proche.
  it("annonce ce qu'une extinction emporte", async () => {
    const { entete } = await session("admin");

    const corps = (await (await lire(entete)).json()) as { items: { cle: string; emporte: string[] }[] };

    const mur = corps.items.find((d) => d.cle === "wall");
    // Le dépôt de vœux passe par le Mur ; la réservation aussi.
    expect(mur?.emporte).toContain("wishes");
    expect(mur?.emporte).toContain("reservation");
  });

  it("un drapeau que personne ne requiert n'emporte rien", async () => {
    const { entete } = await session("admin");

    const corps = (await (await lire(entete)).json()) as { items: { cle: string; emporte: string[] }[] };

    expect(corps.items.find((d) => d.cle === "launch.live")?.emporte).toEqual([]);
  });

  // Un drapeau allumé dont un prérequis est éteint reste inerte. Ne montrer
  // que l'interrupteur laisserait croire qu'une fonctionnalité tourne alors
  // que personne ne la voit.
  it("distingue l'interrupteur de ce qui se produit vraiment", async () => {
    const { entete } = await session("admin");
    await allumer("wishes");

    const corps = (await (await lire(entete)).json()) as { items: { cle: string; actif: boolean; effectif: boolean }[] };

    const voeux = corps.items.find((d) => d.cle === "wishes");
    expect(voeux?.actif).toBe(true);
    // « wall » est éteint : le dépôt de vœux n'a pas de porte d'entrée.
    expect(voeux?.effectif).toBe(false);
  });

  it("allumer un drapeau et son prérequis le rend effectif", async () => {
    const { entete } = await session("admin");
    await allumer("wall");
    await allumer("wishes");

    const corps = (await (await lire(entete)).json()) as { items: { cle: string; effectif: boolean }[] };

    expect(corps.items.find((d) => d.cle === "wishes")?.effectif).toBe(true);
  });

  it("bascule un drapeau", async () => {
    const { entete } = await session("admin");

    const res = await basculer(entete, { cle: "wall", actif: true, reason: "Ouverture du Mur au public" });

    expect(res.status).toBe(200);
    expect((await db.prisma.featureFlag.findUniqueOrThrow({ where: { key: "wall" } })).enabled).toBe(true);
  });

  // « Chaque bascule est journalisée avec son auteur et sa date » (§5.7).
  it("journalise la bascule, avec son auteur et son motif", async () => {
    const { compte, entete } = await session("admin");

    await basculer(entete, { cle: "wall", actif: true, reason: "Ouverture du Mur au public" });

    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "feature_flag_update" } });
    expect(trace.actorId).toBe(compte.id);
    expect(trace.reason).toBe("Ouverture du Mur au public");
    expect(trace.metadata).toMatchObject({ key: "wall", from: false, to: true });
  });

  it("refuse une bascule sans motif suffisant", async () => {
    const { entete } = await session("admin");

    const res = await basculer(entete, { cle: "wall", actif: true, reason: "court" });

    expect(res.status).toBe(400);
    expect(await db.prisma.featureFlag.findUnique({ where: { key: "wall" } })).toBeNull();
  });

  // Le registre est fermé : une clé qui n'y figure pas n'existe pas. Sans ce
  // refus, on créerait en base des lignes que rien ne lit — et un drapeau qui
  // ne garde rien ment sur ce qu'il éteint.
  it("refuse une clé hors du registre", async () => {
    const { entete } = await session("admin");

    const res = await basculer(entete, { cle: "invente.demain", actif: true, reason: "Un essai qui ne doit pas passer" });

    expect(res.status).toBe(404);
  });

  it("la bascule est fermée au support", async () => {
    const { entete } = await session("support");

    const res = await basculer(entete, { cle: "wall", actif: true, reason: "Tentative depuis le support" });

    expect(res.status).toBe(403);
  });

  it("dit qui a basculé en dernier", async () => {
    const { entete } = await session("admin");
    await basculer(entete, { cle: "wall", actif: true, reason: "Ouverture du Mur au public" });

    const corps = (await (await lire(entete)).json()) as { items: { cle: string; parQui: string | null }[] };

    expect(corps.items.find((d) => d.cle === "wall")?.parQui).toBe("admin@lehno.app");
    expect(corps.items.find((d) => d.cle === "credits")?.parQui).toBeNull();
  });
});
