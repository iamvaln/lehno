import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { SupportService } from "../src/me/support.service.js";

/* Écrire à l'équipe, donner un avis — maquette §3.26, spec technique §5.9. */
describe("aide et avis", () => {
  let db: TestDb;
  let support: SupportService;
  let userId: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    support = new SupportService(db.prisma as never);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1" },
    });
    userId = u.id;
  });

  it("enregistre un message ouvert, avec sa version d'application", async () => {
    const r = await support.ecrire(userId, {
      body: "l'application ne se lance plus", appVersion: "1.4.2", platform: "ios",
    });

    expect(r.status).toBe("open");
    const ligne = await db.prisma.supportRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(ligne.appVersion).toBe("1.4.2");
    expect(ligne.platform).toBe("ios");
  });

  /* Le piège gardé : la maquette §3.26 joint la version et la plateforme
     « pour éviter de les demander ». Un message qui les exigerait ferait
     échouer l'envoi depuis un client plus ancien qui ne les connaît pas —
     c'est-à-dire précisément celui dont on a le plus besoin d'entendre
     parler. */
  it("accepte un message sans version ni plateforme", async () => {
    await expect(support.ecrire(userId, { body: "une question" })).resolves.toBeDefined();
  });

  /* Le piège gardé : un avis rattaché au mauvais compte, ou à aucun. La
     colonne accepte le nul (un avis peut survivre à son auteur), mais un avis
     déposé depuis une session doit porter son compte. */
  it("rattache l'avis au compte qui le dépose", async () => {
    await support.donnerSonAvis(userId, { rating: 5, body: "très pratique" });
    const ligne = await db.prisma.feedback.findFirstOrThrow({ where: { userId } });
    expect(ligne.rating).toBe(5);
  });

  it("accepte une note sans texte, et un texte sans note", async () => {
    await support.donnerSonAvis(userId, { rating: 3 });
    await support.donnerSonAvis(userId, { body: "il manque le mode sombre" });
    expect(await db.prisma.feedback.count({ where: { userId } })).toBe(2);
  });

  /* Le piège gardé : les deux ressources fondues en une. Une demande d'aide
     perdue dans une pile de notes de satisfaction n'obtient jamais de réponse,
     et un avis qui attend une réponse déçoit à coup sûr. Elles vivent dans
     deux tables, et ce cas le constate. */
  it("ne mélange jamais une demande d'aide et un avis", async () => {
    await support.ecrire(userId, { body: "j'ai un problème de connexion" });
    await support.donnerSonAvis(userId, { rating: 4 });

    expect(await db.prisma.supportRequest.count({ where: { userId } })).toBe(1);
    expect(await db.prisma.feedback.count({ where: { userId } })).toBe(1);
  });
});
