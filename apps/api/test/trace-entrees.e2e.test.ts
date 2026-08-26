import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AuthService } from "../src/auth/auth.service.js";
import { OtpService } from "../src/auth/otp.service.js";
import { connexionSchema } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/**
 * Ce que les traces d'entrée doivent porter.
 *
 * L'adresse et la voie servent au même usage — « détecter les séries d'échecs,
 * les accès inhabituels, et documenter un incident de sécurité » (ux-admin
 * §5.13). Sans la voie, une série d'échecs par code ne se distingue pas d'une
 * série par fournisseur externe ; sans l'adresse, on ne sait pas si elle vient
 * d'un endroit ou de mille.
 *
 * Le dépôt affirmait le contraire, en citant « spec technique §9 » pour
 * justifier que l'adresse ne descende pas en base. Cette section porte sur les
 * droits d'accès et ne dit rien de l'adresse ; le dictionnaire, lui, la prévoit
 * pour `LoginActivity` comme pour `DeviceSignup`.
 */
describe("les traces d'entrée portent l'adresse et la voie", () => {
  let db: TestDb;
  let app: INestApplication;
  let auth: AuthService;
  let otp: OtpService;

  beforeAll(async () => {
    db = await withDatabase();
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
    process.env.LEHNO_MAIL_CONSOLE = "1";
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    auth = app.get(AuthService);
    otp = app.get(OtpService);
  }, 180_000);

  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await app?.close(); await db.close(); });

  const entrer = async (email: string, ip?: string) => {
    const { code } = await otp.issue(email, "login");
    const r = await auth.verifyOtp({ email, code, deviceId: "dev-1", ...(ip ? { ip } : {}) });
    if (r.outcome !== "registration") throw new Error("inscription attendue");
    return auth.register({
      registrationToken: r.registrationToken,
      username: email.split("@")[0]!.replace(/[^a-zA-Z0-9]/g, ""),
      deviceId: "dev-1",
      ...(ip ? { ip } : {}),
    });
  };

  it("une entrée par code note sa voie", async () => {
    await entrer("awa@example.com");

    const traces = await db.prisma.loginActivity.findMany({ where: { result: "success" } });

    expect(traces.length).toBeGreaterThan(0);
    for (const trace of traces) expect(trace.method).toBe("otp");
  });

  it("une entrée par code note son adresse", async () => {
    await entrer("awa@example.com", "102.244.18.7");

    const trace = await db.prisma.loginActivity.findFirstOrThrow({ where: { result: "success" } });

    expect(trace.ip).toBe("102.244.18.7");
  });

  // Un échec sans adresse ne dit pas grand-chose : c'est justement la série
  // d'échecs venue d'un même endroit qu'on cherche à voir.
  it("un code refusé note aussi l'adresse et la voie", async () => {
    await otp.issue("awa@example.com", "login");
    await auth.verifyOtp({ email: "awa@example.com", code: "000000", deviceId: "dev-1", ip: "41.202.219.9" })
      .catch(() => {});

    const trace = await db.prisma.loginActivity.findFirstOrThrow({ where: { result: "failure" } });

    expect(trace.ip).toBe("41.202.219.9");
    expect(trace.method).toBe("otp");
  });

  // « Conservée pour d'éventuelles investigations, sans entrer dans le calcul
  // du plafond » (dictionnaire, DeviceSignup).
  it("la création d'un compte note l'adresse de l'appareil", async () => {
    await entrer("awa@example.com", "102.244.18.7");

    const trace = await db.prisma.deviceSignup.findFirstOrThrow();

    expect(trace.ip).toBe("102.244.18.7");
  });

  // La garde que l'intention d'origine portait par une absence.
  //
  // Les colonnes existaient depuis le premier jour, « conservées pour
  // investigation, jamais lues par le client Prisma » — et ne pas les
  // modéliser empêchait à la fois de les lire et de les écrire. Elles sont
  // donc restées vides, ce qui ne protégeait rien.
  //
  // Le modèle les porte maintenant. La garde devient ce test : l'adresse ne
  // sort pas par l'administration, et le contrat publié n'a aucun champ pour
  // la recevoir. Ce qu'on voit à l'écran est le lieu approximatif.
  it("l'adresse ne sort pas par l'administration", async () => {
    await entrer("awa@example.com", "102.244.18.7");

    const rendu = JSON.stringify(connexionSchema.shape);
    expect(rendu).not.toContain("ip");

    const trace = await db.prisma.loginActivity.findFirstOrThrow({ where: { result: "success" } });
    expect(trace.ip).toBe("102.244.18.7");
  });

  it("une adresse absente n'empêche rien", async () => {
    await expect(entrer("awa@example.com")).resolves.toBeDefined();

    const trace = await db.prisma.loginActivity.findFirstOrThrow({ where: { result: "success" } });
    expect(trace.ip).toBeNull();
  });
});
