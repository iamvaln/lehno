import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { publicConfigSchema } from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
// L'application entière refuse de démarrer sans clé d'administration : c'est
// voulu, mieux vaut ne pas démarrer que signer sans clé. Ces suites montent
// AppModule, elles la posent donc aussi.
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

// Revue tour 1 : config/legal/waitlist n'étaient éprouvés que par leurs
// services, jamais par la route réelle. Deux propriétés ne se démontrent
// qu'au point d'entrée : le refus par liste fermée des pages légales (un
// service reçoit déjà une valeur typée, la route reçoit ce que le monde
// envoie) et l'indistinguabilité de la liste d'attente (statut, corps,
// en-têtes identiques — un appel de service ne le montre pas).
describe("surfaces publiques — HTTP de bout en bout", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let previousEnv: {
    DATABASE_URL: string | undefined; OTP_PEPPER: string | undefined; JWT_SECRET: string | undefined;
    LEHNO_MAIL_CONSOLE: string | undefined;
  };

  beforeAll(async () => {
    db = await withDatabase();
    previousEnv = {
      DATABASE_URL: process.env.DATABASE_URL,
      OTP_PEPPER: process.env.OTP_PEPPER,
      JWT_SECRET: process.env.JWT_SECRET,
      LEHNO_MAIL_CONSOLE: process.env.LEHNO_MAIL_CONSOLE,
    };
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
    // Aucun identifiant Resend ici : adhésion explicite à la console de
    // développement requise depuis la revue tour 2 (voir app.module.ts) —
    // sans elle, le module refuserait de démarrer.
    process.env.LEHNO_MAIL_CONSOLE = "1";

    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix("v1");
    app.useGlobalFilters(new AppExceptionFilter());
    await app.listen(0);
    baseUrl = await app.getUrl();
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await db.close();
    if (previousEnv.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousEnv.DATABASE_URL;
    if (previousEnv.OTP_PEPPER === undefined) delete process.env.OTP_PEPPER;
    else process.env.OTP_PEPPER = previousEnv.OTP_PEPPER;
    if (previousEnv.JWT_SECRET === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousEnv.JWT_SECRET;
    if (previousEnv.LEHNO_MAIL_CONSOLE === undefined) delete process.env.LEHNO_MAIL_CONSOLE;
    else process.env.LEHNO_MAIL_CONSOLE = previousEnv.LEHNO_MAIL_CONSOLE;
  });

  beforeEach(async () => { await resetDatabase(db.prisma); });

  function post(path: string, body: unknown): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // Les réponses ne sont pas validées contre un schéma ici (ce n'est pas
  // l'objet de ces tests) : un type large suffit pour lire les champs qu'on
  // vient vérifier. Même choix que auth-http.e2e.test.ts.
  function json(res: Response): Promise<Record<string, string | number | boolean>> {
    return res.json() as Promise<Record<string, string | number | boolean>>;
  }

  describe("GET /public/config", () => {
    it("ne rend que les valeurs publiques, aucun paramètre d'exploitation", async () => {
      const res = await fetch(`${baseUrl}/v1/public/config`);
      expect(res.status).toBe(200);
      const body = await json(res);

      // `system_parameter` (préservée par resetDatabase) porte aussi des
      // clés d'exploitation — reminder_lead_days_default, wish_window_*,
      // max_accounts_per_device, account_grace_period_days — qui ne doivent
      // jamais franchir cette route.
      expect(Object.keys(body).sort()).toEqual(
        ["creditUnitPrice", "currency", "flags", "referralBonusInvited", "signupFreeCredits"].sort(),
      );
      expect(publicConfigSchema.safeParse(body).success).toBe(true);
    });

    // Preuve par la panne (cahier tâche 2c) : un drapeau PRIVÉ allumé en base
    // ne doit jamais franchir cette route, même en HTTP réel — seule la
    // route (pas seulement le service, déjà couvert par public.test.ts) le
    // démontre vraiment.
    it("un drapeau privé allumé en base ne fuite pas ici", async () => {
      await db.prisma.featureFlag.create({ data: { key: "me.persons", enabled: true } });
      const res = await fetch(`${baseUrl}/v1/public/config`);
      const body = (await res.json()) as { flags: Record<string, boolean> };
      expect(body.flags).not.toHaveProperty("me.persons");
      expect(body.flags).toEqual({ "launch.live": false });
    });
  });

  describe("GET /public/legal/:document", () => {
    it("sert un document connu dans les deux langues", async () => {
      const fr = await fetch(`${baseUrl}/v1/public/legal/cgu?lang=fr`);
      expect(fr.status).toBe(200);
      expect(fr.headers.get("content-type")).toMatch(/text\/markdown/);
      expect(await fr.text()).toContain("Conditions générales d'utilisation");

      const en = await fetch(`${baseUrl}/v1/public/legal/cgu?lang=en`);
      expect(en.status).toBe(200);
      expect(await en.text()).toContain("Terms of Service");
    });

    it("refuse un document inconnu", async () => {
      const res = await fetch(`${baseUrl}/v1/public/legal/not-a-real-document`);
      expect(res.status).toBe(404);
      const body = await json(res);
      expect(body.code).toBe("not_found");
    });

    it("refuse une tentative de remontée de répertoire", async () => {
      const res = await fetch(`${baseUrl}/v1/public/legal/${encodeURIComponent("../../../../etc/passwd")}`);
      expect(res.status).toBe(404);
      const body = await json(res);
      expect(body.code).toBe("not_found");
    });

    it("refuse une langue inconnue", async () => {
      const res = await fetch(`${baseUrl}/v1/public/legal/cgu?lang=de`);
      expect(res.status).toBe(404);
      const body = await json(res);
      expect(body.code).toBe("not_found");
    });
  });

  describe("POST /public/waitlist", () => {
    it("enregistre un dépôt neuf", async () => {
      const res = await post("/v1/public/waitlist", { email: "awa-http@example.com", locale: "fr" });
      expect(res.status).toBe(200);
      expect(await json(res)).toEqual({ joined: true });
      expect(await db.prisma.waitlistSignup.count()).toBe(1);
    });

    it("un second dépôt de la même adresse rend une réponse strictement identique", async () => {
      const first = await post("/v1/public/waitlist", { email: "awa-http@example.com", locale: "fr" });
      const second = await post("/v1/public/waitlist", { email: "AWA-HTTP@EXAMPLE.COM", locale: "en" });

      expect(first.status).toBe(second.status);
      expect(first.status).toBe(200);
      await expect(json(second)).resolves.toEqual(await json(first));
      // Ni le type de contenu ni sa longueur ne trahissent une adresse déjà
      // connue : la forme de la réponse est indépendante de ce que la table
      // savait déjà.
      expect(first.headers.get("content-type")).toBe(second.headers.get("content-type"));
      expect(first.headers.get("content-length")).toBe(second.headers.get("content-length"));
      expect(await db.prisma.waitlistSignup.count()).toBe(1);
    });

    it("refuse une adresse invalide", async () => {
      const res = await post("/v1/public/waitlist", { email: "pas-une-adresse" });
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.code).toBe("waitlist_email_invalid");
      expect(await db.prisma.waitlistSignup.count()).toBe(0);
    });
  });

  // Contrairement à contact.test.ts (qui appelle ContactService directement),
  // ces tests passent par la route réelle : c'est elle, et non le service,
  // qui porte la validation du sujet contre la liste fermée (contactSendSchema,
  // .strict()) — un service reçoit déjà une valeur typée, la route reçoit ce
  // que le monde envoie.
  describe("POST /public/contact", () => {
    const message = {
      name: "Awa", email: "awa-http@example.com", subject: "question_app", message: "Une question sur mon compte.",
    };

    it("enregistre un message neuf", async () => {
      const res = await post("/v1/public/contact", message);
      expect(res.status).toBe(200);
      expect(await json(res)).toEqual({ sent: true });
      expect(await db.prisma.contactMessage.count()).toBe(1);
    });

    it("refuse un sujet hors de la liste fermée, sans rien enregistrer", async () => {
      const res = await post("/v1/public/contact", { ...message, subject: "un_sujet_invente" });
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.code).toBe("contact_invalid");
      expect(await db.prisma.contactMessage.count()).toBe(0);
    });

    it("refuse un message trop court", async () => {
      const res = await post("/v1/public/contact", { ...message, message: "court" });
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.code).toBe("contact_invalid");
      expect(await db.prisma.contactMessage.count()).toBe(0);
    });

    it("refuse une adresse invalide", async () => {
      const res = await post("/v1/public/contact", { ...message, email: "pas-une-adresse" });
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.code).toBe("contact_invalid");
      expect(await db.prisma.contactMessage.count()).toBe(0);
    });

    it("refuse un champ inattendu (contrat strict) — un robot qui ajoute un champ se désigne", async () => {
      const res = await post("/v1/public/contact", { ...message, oops: true });
      expect(res.status).toBe(400);
      expect((await json(res)).code).toBe("contact_invalid");
      expect(await db.prisma.contactMessage.count()).toBe(0);
    });
  });
});
