import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { ContactService } from "../src/public/contact.service.js";
import { RateLimitService } from "../src/common/rate-limit.service.js";
import { AppError } from "../src/common/errors.js";
import type { Mail, MailPort } from "../src/mail/mail.port.js";

// Même adaptateur de test que la liste d'attente : il retient ce qu'on lui
// donne, et sait échouer sur commande — seule façon de démontrer ce qui
// survit à une panne d'acheminement, et ce qui n'y survit pas.
class MailDeTest implements MailPort {
  readonly envoyes: Mail[] = [];
  echoueVers: string[] = [];
  async send(mail: Mail): Promise<void> {
    if (this.echoueVers.includes(mail.to)) throw new Error("acheminement indisponible");
    this.envoyes.push(mail);
  }
}

const ADRESSE_EQUIPE = "equipe@example.com";

describe("formulaire de contact", () => {
  let db: TestDb;
  let service: ContactService;
  let mail: MailDeTest;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    mail = new MailDeTest();
    service = new ContactService(
      db.prisma as never,
      new RateLimitService(db.prisma as never),
      mail,
      ADRESSE_EQUIPE,
    );
  });

  const message = {
    name: "Awa",
    email: "awa@example.com",
    subject: "question_app" as const,
    message: "Une question sur mon compte, merci de votre aide.",
    locale: "fr" as const,
  };

  // Le message doit être en base AVANT toute tentative d'envoi : c'est la
  // seule trace qui survit à une panne d'acheminement vers l'équipe (voir
  // plus bas). L'ordre des deux courriels est fixé par le contrat du test
  // suivant, pas par celui-ci — on ne teste ici que leur nombre et leur
  // contenu.
  it("enregistre le message, écrit à l'équipe et accuse réception à la personne", async () => {
    await service.send(message);

    const ligne = await db.prisma.contactMessage.findFirst({ where: { email: "awa@example.com" } });
    expect(ligne, "le message doit être en base").not.toBeNull();
    expect(ligne?.subject).toBe("question_app");

    expect(mail.envoyes).toHaveLength(2);
    const versEquipe = mail.envoyes.find((m) => m.to === ADRESSE_EQUIPE);
    const versLaPersonne = mail.envoyes.find((m) => m.to === "awa@example.com");
    expect(versEquipe, "un courriel doit partir vers l'équipe").toBeDefined();
    expect(versLaPersonne, "un accusé de réception doit partir vers la personne").toBeDefined();
    // Le sujet choisi doit se lire dans le courriel envoyé à l'équipe, sous sa
    // forme localisée — jamais la clé brute que le client a transmise.
    expect(versEquipe?.text).toContain("l'application");
  });

  // L'échec le plus grave de ce point d'entrée : contrairement à la liste
  // d'attente, rien d'autre ne portait le message. La persistance en base,
  // faite avant l'envoi, est ce qui empêche la perte — l'appel réussit
  // toujours, et la ligne reste là même si le courriel vers l'équipe échoue.
  it("garde le message même si le courriel vers l'équipe ne part pas", async () => {
    mail.echoueVers = [ADRESSE_EQUIPE];
    await expect(service.send(message)).resolves.toEqual({ sent: true });

    const ligne = await db.prisma.contactMessage.findFirst({ where: { email: "awa@example.com" } });
    expect(ligne, "le message doit être en base malgré la panne").not.toBeNull();
    expect(mail.envoyes.some((m) => m.to === "awa@example.com"), "l'accusé de réception part quand même").toBe(true);
  });

  // Panne symétrique : l'accusé de réception ne part pas, mais l'inscription
  // n'est pas perdue et l'équipe a quand même reçu le message.
  it("n'échoue pas si l'accusé de réception ne part pas", async () => {
    mail.echoueVers = ["awa@example.com"];
    await expect(service.send(message)).resolves.toEqual({ sent: true });

    expect(await db.prisma.contactMessage.count()).toBe(1);
    expect(mail.envoyes.some((m) => m.to === ADRESSE_EQUIPE), "l'équipe a quand même reçu le message").toBe(true);
  });

  it("plafonne le rejeu sur une même adresse", async () => {
    for (let i = 0; i < 3; i += 1) await service.send(message);
    await expect(service.send(message)).rejects.toBeInstanceOf(AppError);
  });

  it("plafonne les envois venus d'une même adresse IP", async () => {
    for (let i = 0; i < 5; i += 1) {
      await service.send({ ...message, email: `p${i}@example.com`, ip: "203.0.113.7" });
    }
    await expect(
      service.send({ ...message, email: "sixieme@example.com", ip: "203.0.113.7" }),
    ).rejects.toBeInstanceOf(AppError);
  });

  // Le plafond par IP ne doit pas devenir un plafond global.
  it("ne bloque pas les autres origines", async () => {
    for (let i = 0; i < 5; i += 1) {
      await service.send({ ...message, email: `p${i}@example.com`, ip: "203.0.113.7" });
    }
    await expect(
      service.send({ ...message, email: "ailleurs@example.com", ip: "198.51.100.4" }),
    ).resolves.toEqual({ sent: true });
  });

  it("refuse une adresse jetable, sans rien enregistrer", async () => {
    await expect(
      service.send({ ...message, email: "awa@mailinator.com" }),
    ).rejects.toBeInstanceOf(AppError);

    expect(await db.prisma.contactMessage.count()).toBe(0);
    expect(mail.envoyes).toHaveLength(0);
  });

  it("refuse une soumission qui a rempli le champ leurre", async () => {
    await expect(
      service.send({ ...message, website: "http://spam.example" }),
    ).rejects.toBeInstanceOf(AppError);

    expect(await db.prisma.contactMessage.count()).toBe(0);
    expect(mail.envoyes).toHaveLength(0);
  });

  it("refuse un délai de soumission invraisemblable", async () => {
    await expect(
      service.send({ ...message, renderedAt: Date.now() }),
    ).rejects.toBeInstanceOf(AppError);

    expect(await db.prisma.contactMessage.count()).toBe(0);
  });

  // Les deux filtres à robots doivent être indiscernables depuis le client.
  it("ne dit pas lequel des deux filtres a écarté la soumission", async () => {
    const attraper = async (corps: Parameters<typeof service.send>[0]) => {
      try {
        await service.send(corps);
        expect.unreachable("aurait dû être refusé");
      } catch (erreur) {
        const e = erreur as AppError;
        return { code: e.code, message: e.message };
      }
    };

    const parLeLeurre = await attraper({ ...message, email: "a@example.com", website: "spam" });
    const parLeDelai = await attraper({ ...message, email: "b@example.com", renderedAt: Date.now() });

    expect(parLeDelai).toEqual(parLeLeurre);
  });

  // Deux casses, deux suffixes : une même boîte ne doit pas ouvrir deux
  // compteurs de plafond (voir apps/common/email.ts, canonicalEmail).
  it("ne se contourne pas en changeant la casse ou par sous-adressage", async () => {
    await service.send({ ...message, email: "awa@example.com" });
    await service.send({ ...message, email: "AWA@example.com" });
    await service.send({ ...message, email: "awa+autre@example.com" });

    await expect(
      service.send({ ...message, email: "aWa@ExAmPlE.cOm" }),
      "quatrième tentative sur la même boîte, quelle qu'en soit la forme",
    ).rejects.toBeInstanceOf(AppError);
  });
});
