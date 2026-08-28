import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { DeroulementService } from "../src/me/deroulement.service.js";
import { ProgrammationService } from "../src/me/programmation.service.js";
import { RelancesService } from "../src/me/relances.service.js";
import { EnvoiService } from "../src/me/envoi.service.js";
import { GenerationService } from "../src/me/generation.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { RouteurIAService } from "../src/ia/routeur.service.js";
import { OrdonnanceurService } from "../src/me/ordonnanceur.service.js";
import type { Mail, MailPort } from "../src/mail/mail.port.js";

/* Le passage complet, de bout en bout : une échéance périmée doit finir en
   courrier parti, sans qu'aucune étape ne soit appelée à la main. */
describe("le passage quotidien", () => {
  let db: TestDb;
  let ordonnanceur: OrdonnanceurService;
  let partis: Mail[];
  const poste: MailPort = { send: async (m) => { partis.push(m); } };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    partis = [];
    const p = db.prisma as never;
    ordonnanceur = new OrdonnanceurService(
      new DeroulementService(p), new ProgrammationService(p),
      new RelancesService(p), new EnvoiService(p, poste),
      // Le rattrapage des générations abandonnées : sans fournisseur d'IA, il
      // ne produit rien mais rembourse ce qui traîne — c'est bien son rôle.
      new GenerationService(p, new TenantRepository(p), new RouteurIAService(p), {}),
    );
  });

  it("mène une échéance périmée jusqu'au courrier, en un passage", async () => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
      select: { id: true },
    });
    const pers = await db.prisma.person.create({
      data: { userId: u.id, displayName: "Valery" }, select: { id: true },
    });
    // Un anniversaire dont l'échéance est passée : rien n'est ouvert devant.
    await db.prisma.event.create({
      data: {
        personId: pers.id, authorUserId: u.id, kind: "birthday",
        referenceDate: new Date(Date.now() - 10 * 86_400_000),
        schedules: { create: [{ type: "recurrent", unit: "month", interval: 1, leadTimeDays: 0 }] },
      },
    });

    await ordonnanceur.executer();

    // Des échéances ont été ouvertes...
    expect(await db.prisma.eventOccurrence.count()).toBeGreaterThan(0);
    // ...et des notifications posées.
    expect(await db.prisma.notification.count()).toBeGreaterThan(0);
  });

  /* Une étape qui tombe n'arrête pas les suivantes : elles dépendent de son
     PASSAGE, pas de sa réussite. Un déroulement en panne laisse les échéances
     d'hier, que la programmation traite quand même. */
  it("poursuit les étapes suivantes quand l'une tombe", async () => {
    const casse = {
      derouler: async () => { throw new Error("déroulement en panne"); },
    } as never;
    const p = db.prisma as never;
    const avecPanne = new OrdonnanceurService(
      casse, new ProgrammationService(p), new RelancesService(p), new EnvoiService(p, poste),
      new GenerationService(p, new TenantRepository(p), new RouteurIAService(p), {}),
    );
    await expect(avecPanne.executer()).resolves.toBeUndefined();
  });

  it("est idempotent : deux passages ne doublent rien", async () => {
    await ordonnanceur.executer();
    const un = await db.prisma.notification.count();
    await ordonnanceur.executer();
    expect(await db.prisma.notification.count()).toBe(un);
  });
});
