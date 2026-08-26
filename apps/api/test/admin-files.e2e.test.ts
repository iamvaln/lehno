import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { pageAssistanceSchema, pageContactSchema, pageAttenteSchema, pageRetoursSchema } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/**
 * Les quatre files d'assistance.
 *
 * Trois sont des registres qu'on lit — messages du formulaire, liste d'attente,
 * retours. La quatrième porte un état : une demande d'assistance se solde.
 *
 * Toutes sont ouvertes au support : « répondre aux utilisateurs et traiter les
 * cas courants » est sa raison d'être (ux-admin §6).
 */
describe("administration — les files d'assistance", () => {
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

  const lire = (chemin: string, entete: Record<string, string>, requete = "") =>
    fetch(`${baseUrl}/v1/admin/${chemin}${requete}`, { headers: entete });

  const client = async () => (await db.prisma.user.create({
    data: { email: "awa@exemple.cm", username: "awa", referralCode: "AWA1" },
  })).id;

  // ─── Les demandes d'assistance ─────────────────────────────────────────────

  it("les demandes suivent le contrat publié", async () => {
    const { entete } = await session("support");
    await db.prisma.supportRequest.create({
      data: { userId: await client(), body: "Mon rappel n'est pas parti", subject: "Rappels" },
    });

    const corps = await (await lire("support-requests", entete)).json();

    const valide = pageAssistanceSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  // Une file de travail se lit du plus ancien au plus récent : c'est celui qui
  // attend depuis le plus longtemps qu'on traite d'abord.
  it("la file présente d'abord ce qui attend depuis le plus longtemps", async () => {
    const { entete } = await session("support");
    const u = await client();
    await db.prisma.supportRequest.create({
      data: { userId: u, body: "Ancienne", createdAt: new Date(Date.now() - 86_400_000) },
    });
    await db.prisma.supportRequest.create({ data: { userId: u, body: "Récente" } });

    const corps = (await (await lire("support-requests", entete)).json()) as { items: { corps: string }[] };

    expect(corps.items.map((d) => d.corps)).toEqual(["Ancienne", "Récente"]);
  });

  it("se filtre par état", async () => {
    const { entete } = await session("support");
    const u = await client();
    await db.prisma.supportRequest.create({ data: { userId: u, body: "Ouverte" } });
    await db.prisma.supportRequest.create({ data: { userId: u, body: "Close", status: "closed" } });

    const corps = (await (await lire("support-requests", entete, "?etat=open")).json()) as {
      items: { corps: string }[];
    };

    expect(corps.items.map((d) => d.corps)).toEqual(["Ouverte"]);
  });

  it("solder une demande change son état et passe au journal", async () => {
    const { compte, entete } = await session("support");
    const demande = await db.prisma.supportRequest.create({
      data: { userId: await client(), body: "Mon rappel n'est pas parti" },
    });

    const res = await fetch(`${baseUrl}/v1/admin/support-requests/${demande.id}`, {
      method: "PATCH",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify({ etat: "answered", reason: "Réponse envoyée par courriel" }),
    });

    expect(res.status).toBe(200);
    expect((await db.prisma.supportRequest.findUniqueOrThrow({ where: { id: demande.id } })).status)
      .toBe("answered");
    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "support_request_update" } });
    expect(trace.actorId).toBe(compte.id);
  });

  it("solder sans motif est refusé, et rien ne bouge", async () => {
    const { entete } = await session("support");
    const demande = await db.prisma.supportRequest.create({
      data: { userId: await client(), body: "Mon rappel n'est pas parti" },
    });

    const res = await fetch(`${baseUrl}/v1/admin/support-requests/${demande.id}`, {
      method: "PATCH",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify({ etat: "closed", reason: "non" }),
    });

    expect(res.status).toBe(400);
    expect((await db.prisma.supportRequest.findUniqueOrThrow({ where: { id: demande.id } })).status)
      .toBe("open");
  });

  // ─── Les trois registres ───────────────────────────────────────────────────

  it("les messages du formulaire suivent le contrat publié", async () => {
    const { entete } = await session("support");
    await db.prisma.contactMessage.create({
      data: { name: "Awa", email: "awa@exemple.cm", subject: "question", message: "Bonjour" },
    });

    const corps = await (await lire("contact-messages", entete)).json();

    const valide = pageContactSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  // Le sujet est une CLÉ, jamais un texte libre venu du client : c'est ce qui
  // permet de le traduire plutôt que de l'afficher tel quel.
  it("le sujet d'un message reste une clé", async () => {
    const { entete } = await session("support");
    await db.prisma.contactMessage.create({
      data: { name: "Awa", email: "awa@exemple.cm", subject: "question", message: "Bonjour" },
    });

    const corps = (await (await lire("contact-messages", entete)).json()) as { items: { sujet: string }[] };

    expect(corps.items[0]?.sujet).toBe("question");
  });

  it("la liste d'attente suit le contrat publié", async () => {
    const { entete } = await session("support");
    await db.prisma.waitlistSignup.create({
      data: { email: "Awa@Exemple.cm", emailCanonical: "awa@exemple.cm", source: "landing" },
    });

    const corps = await (await lire("waitlist", entete)).json();

    const valide = pageAttenteSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  // C'est l'adresse SAISIE qu'on rend, pas sa forme canonique : c'est elle que
  // la personne reconnaîtra, et à elle qu'on écrira.
  it("la liste d'attente rend l'adresse telle qu'elle a été saisie", async () => {
    const { entete } = await session("support");
    await db.prisma.waitlistSignup.create({
      data: { email: "Awa+lehno@Exemple.cm", emailCanonical: "awa@exemple.cm" },
    });

    const corps = (await (await lire("waitlist", entete)).json()) as { items: { email: string }[] };

    expect(corps.items[0]?.email).toBe("Awa+lehno@Exemple.cm");
  });

  it("les retours suivent le contrat publié", async () => {
    const { entete } = await session("support");
    await db.prisma.feedback.create({ data: { userId: await client(), rating: 4, body: "Pratique" } });

    const corps = await (await lire("feedback", entete)).json();

    const valide = pageRetoursSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  // Un retour survit au compte qui l'a laissé — la relation est en SetNull.
  // L'anonyme se dit, il ne fait pas échouer la lecture.
  it("un retour sans compte se lit quand même", async () => {
    const { entete } = await session("support");
    await db.prisma.feedback.create({ data: { rating: 5, body: "Anonyme" } });

    const corps = (await (await lire("feedback", entete)).json()) as {
      items: { utilisateur: string | null }[];
    };

    expect(corps.items[0]?.utilisateur).toBeNull();
  });

  // ─── Les droits ────────────────────────────────────────────────────────────

  // « Répondre aux utilisateurs et traiter les cas courants » est la raison
  // d'être du support : les quatre files lui sont ouvertes.
  it("les quatre files sont ouvertes au support", async () => {
    const { entete } = await session("support");

    for (const chemin of ["support-requests", "contact-messages", "waitlist", "feedback"]) {
      expect((await lire(chemin, entete)).status, chemin).toBe(200);
    }
  });

  it("rien n'est ouvert sans session", async () => {
    for (const chemin of ["support-requests", "contact-messages", "waitlist", "feedback"]) {
      expect((await lire(chemin, {})).status, chemin).toBe(401);
    }
  });
});
