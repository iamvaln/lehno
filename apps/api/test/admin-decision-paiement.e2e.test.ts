import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, avecMotif, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { paiementDecideSchema } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

describe("administration — la décision sur un paiement", () => {
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

  /** Un paiement manuel en attente : 1 000 F, dix crédits, attendu 1 000. */
  const enAttente = async (entete: Record<string, string>) => {
    const [utilisateur, palier, compte, canal] = await Promise.all([
      db.prisma.user.create({ data: { email: "awa@exemple.cm", username: "awa", referralCode: "AWA1" } }),
      db.prisma.creditBundle.findFirstOrThrow({ where: { position: 2 } }),
      db.prisma.collectionAccount.create({
        data: { label: "Orange Money principal", operator: "orange_money", number: "690000000" },
      }),
      avecMotif(db.prisma, "fixture de test", (tx) => tx.paymentChannel.create({
        data: { kind: "mobile_money", operator: "orange_money", country: "CM", label: "Orange Money", feePercent: 2 },
      })),
    ]);
    const res = await fetch(`${baseUrl}/v1/admin/payments`, {
      method: "POST",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify({
        utilisateurId: utilisateur.id, palierId: palier.id,
        compteCollecteId: compte.id, canalId: canal.id,
        reason: "Versement constaté sur le compte Orange",
      }),
    });
    const corps = (await res.json()) as { id: string };
    return { paiementId: corps.id, utilisateurId: utilisateur.id };
  };

  const decider = (entete: Record<string, string>, id: string, corps: unknown) =>
    fetch(`${baseUrl}/v1/admin/payments/${id}/decision`, {
      method: "POST",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify(corps),
    });

  const CONFIRMER = {
    decision: "confirmer", montantRecu: 1000,
    reference: "MP260826.1200.A11111", reason: "Réception constatée sur le compte",
  };

  it("suit le contrat publié, au champ près", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);

    const corps = await (await decider(entete, paiementId, CONFIRMER)).json();

    const valide = paiementDecideSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  it("confirmer fait passer le paiement au succès", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);

    await decider(entete, paiementId, CONFIRMER);

    expect((await db.prisma.payment.findUniqueOrThrow({ where: { id: paiementId } })).status).toBe("succeeded");
  });

  it("confirmer octroie les crédits du palier, en achat", async () => {
    const { entete } = await session("admin");
    const { paiementId, utilisateurId } = await enAttente(entete);

    await decider(entete, paiementId, CONFIRMER);

    const mouvement = await db.prisma.creditTransaction.findFirstOrThrow({ where: { paymentId: paiementId } });
    expect(mouvement.userId).toBe(utilisateurId);
    expect(mouvement.amount).toBe(10);
    expect(mouvement.type).toBe("purchase");
    expect(mouvement.source).toBe("purchase");
  });

  // « Les crédits sont octroyés une seule fois, quelle que soit la voie qui a
  // constaté le succès. » Deux confirmations concurrentes liraient toutes deux
  // « aucun octroi » avant que l'une n'écrive : c'est l'index qui tranche, pas
  // le service.
  it("deux confirmations n'octroient qu'une fois", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);

    const [a, b] = await Promise.all([
      decider(entete, paiementId, CONFIRMER),
      decider(entete, paiementId, { ...CONFIRMER, reference: "MP260826.1200.B22222" }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await db.prisma.creditTransaction.count({ where: { paymentId: paiementId } })).toBe(1);
  });

  it("confirmer un paiement déjà tranché est refusé", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);
    await decider(entete, paiementId, CONFIRMER);

    const res = await decider(entete, paiementId, { ...CONFIRMER, reference: "MP260826.1200.C33333" });

    expect(res.status).toBe(409);
  });

  // Le montant reçu se renseigne TOUJOURS : c'est lui qui permet de constater
  // qu'il n'y a pas d'écart. Sans ce champ, le silence vaudrait aussi bien
  // « rien à signaler » que « personne n'a regardé ».
  it("confirmer sans montant reçu est refusé", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);

    const res = await decider(entete, paiementId, {
      decision: "confirmer", reference: "MP260826.1200.D44444", reason: "Réception constatée",
    });

    expect(res.status).toBe(400);
    expect((await db.prisma.payment.findUniqueOrThrow({ where: { id: paiementId } })).status).toBe("pending");
  });

  it("confirmer consigne le montant reçu et la référence", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);

    await decider(entete, paiementId, CONFIRMER);

    const p = await db.prisma.payment.findUniqueOrThrow({ where: { id: paiementId } });
    expect(Number(p.receivedAmount)).toBe(1000);
    expect(p.providerRef).toBe("MP260826.1200.A11111");
  });

  // « Un écart se traite, il ne se devine pas. » On crédite le palier convenu et
  // on note l'écart ; c'est à l'administrateur de décider s'il rejette.
  it("un écart ne bloque pas la décision, il se consigne", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);

    const corps = (await (await decider(entete, paiementId, { ...CONFIRMER, montantRecu: 900 })).json()) as {
      ecart: number;
    };

    expect(corps.ecart).toBe(-100);
    expect((await db.prisma.payment.findUniqueOrThrow({ where: { id: paiementId } })).status).toBe("succeeded");
  });

  it("sans écart, l'écart vaut zéro et non nul", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);

    const corps = (await (await decider(entete, paiementId, CONFIRMER)).json()) as { ecart: number };

    expect(corps.ecart).toBe(0);
  });

  // ─── Le rejet ──────────────────────────────────────────────────────────────

  it("rejeter n'octroie rien et fait échouer le paiement", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);

    await decider(entete, paiementId, { decision: "rejeter", reason: "Aucune réception sur le compte" });

    expect((await db.prisma.payment.findUniqueOrThrow({ where: { id: paiementId } })).status).toBe("failed");
    expect(await db.prisma.creditTransaction.count()).toBe(0);
  });

  it("rejeter exige un motif", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);

    const res = await decider(entete, paiementId, { decision: "rejeter", reason: "non" });

    expect(res.status).toBe(400);
  });

  // Le rejet n'écrit aucun mouvement de crédits : l'index qui empêche le double
  // octroi ne le protège donc pas. C'est le refus d'un paiement déjà tranché
  // qui tient ici — et sans lui, rejeter deux fois écrirait deux histoires sur
  // le même versement.
  it("rejeter deux fois est refusé", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);
    await decider(entete, paiementId, { decision: "rejeter", reason: "Aucune réception sur le compte" });

    const res = await decider(entete, paiementId, { decision: "rejeter", reason: "Toujours aucune réception" });

    expect(res.status).toBe(409);
    const lignes = await db.prisma.paymentStatusHistory.findMany({ where: { paymentId: paiementId } });
    expect(lignes).toHaveLength(2);
  });

  it("confirmer après un rejet est refusé", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);
    await decider(entete, paiementId, { decision: "rejeter", reason: "Aucune réception sur le compte" });

    const res = await decider(entete, paiementId, CONFIRMER);

    expect(res.status).toBe(409);
    expect(await db.prisma.creditTransaction.count()).toBe(0);
  });

  it("le motif du rejet se lit sur le paiement", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);

    await decider(entete, paiementId, { decision: "rejeter", reason: "Aucune réception sur le compte" });

    expect((await db.prisma.payment.findUniqueOrThrow({ where: { id: paiementId } })).failureReason)
      .toBe("Aucune réception sur le compte");
  });

  // ─── L'histoire ────────────────────────────────────────────────────────────

  // « Une seule ligne ouverte par paiement » : l'état précédent se ferme, le
  // nouveau s'ouvre. C'est ce qui rend la durée de chaque état lisible.
  it("la décision ferme l'état précédent et ouvre le suivant", async () => {
    const { compte, entete } = await session("admin");
    const { paiementId } = await enAttente(entete);

    await decider(entete, paiementId, CONFIRMER);

    const lignes = await db.prisma.paymentStatusHistory.findMany({
      where: { paymentId: paiementId }, orderBy: { startedAt: "asc" },
    });
    expect(lignes.map((l) => l.status)).toEqual(["pending", "succeeded"]);
    expect(lignes[0]?.endedAt).not.toBeNull();
    expect(lignes[1]?.endedAt).toBeNull();
    expect(lignes[1]?.changedByAdminId).toBe(compte.id);
    expect(lignes[1]?.origin).toBe("admin");
  });

  it("la décision rejoint le journal d'audit", async () => {
    const { compte, entete } = await session("admin");
    const { paiementId } = await enAttente(entete);

    await decider(entete, paiementId, CONFIRMER);

    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "payment_decision" } });
    expect(trace.actorId).toBe(compte.id);
    expect(trace.reason).toBe("Réception constatée sur le compte");
  });

  // Le reçu s'efface une fois la demande traitée : une photo de justificatif
  // n'a aucune raison de rester une fois qu'elle a servi.
  it("le reçu s'efface une fois la demande traitée", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);
    await db.prisma.payment.update({ where: { id: paiementId }, data: { proofKey: "recus/abc.jpg" } });

    await decider(entete, paiementId, CONFIRMER);

    expect((await db.prisma.payment.findUniqueOrThrow({ where: { id: paiementId } })).proofKey).toBeNull();
  });

  // ─── Les droits ────────────────────────────────────────────────────────────

  // « Seul un administrateur confirme ou rejette, quelle que soit la voie. »
  it("le support ne décide pas", async () => {
    const { entete } = await session("admin");
    const { paiementId } = await enAttente(entete);
    const support = await session("support");

    const res = await decider(support.entete, paiementId, CONFIRMER);

    expect(res.status).toBe(403);
    expect((await db.prisma.payment.findUniqueOrThrow({ where: { id: paiementId } })).status).toBe("pending");
  });

  it("un paiement inconnu rend 404", async () => {
    const { entete } = await session("admin");

    const res = await decider(entete, "00000000-0000-0000-0000-000000000000", CONFIRMER);

    expect(res.status).toBe(404);
  });
});
