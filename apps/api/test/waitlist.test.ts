import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { WaitlistService } from "../src/public/waitlist.service.js";
import { RateLimitService } from "../src/common/rate-limit.service.js";
import { AppError } from "../src/common/errors.js";
import type { Mail, MailPort } from "../src/mail/mail.port.js";

// Un adaptateur de courriel qui retient ce qu'on lui donne, et sait échouer
// sur commande — c'est la seule façon de démontrer que l'inscription survit à
// une panne d'acheminement.
class MailDeTest implements MailPort {
  readonly envoyes: Mail[] = [];
  echoue = false;
  async send(mail: Mail): Promise<void> {
    if (this.echoue) throw new Error("acheminement indisponible");
    this.envoyes.push(mail);
  }
}

describe("liste d'attente", () => {
  let db: TestDb;
  let service: WaitlistService;
  let mail: MailDeTest;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    mail = new MailDeTest();
    service = new WaitlistService(db.prisma as never, new RateLimitService(db.prisma as never), mail);
  });

  it("enregistre l'adresse et confirme par courriel", async () => {
    await service.join({ email: "awa@example.com", locale: "fr" });

    const ligne = await db.prisma.waitlistSignup.findFirst({ where: { email: "awa@example.com" } });
    expect(ligne, "l'adresse doit être en base").not.toBeNull();
    expect(mail.envoyes).toHaveLength(1);
    expect(mail.envoyes[0]!.to).toBe("awa@example.com");
    expect(mail.envoyes[0]!.locale).toBe("fr");
  });

  // Le point d'entrée est idempotent et muet : réinscrire la même adresse ne
  // doit ni créer une seconde ligne, ni renvoyer un second courriel. Sans
  // cette garantie, n'importe qui bombarde une adresse en rejouant l'appel.
  it("ne renvoie pas de courriel à une adresse déjà inscrite", async () => {
    const premier = await service.join({ email: "awa@example.com", locale: "fr" });
    const second = await service.join({ email: "awa@example.com", locale: "fr" });

    expect(second, "réponse identique : la liste ne s'énumère pas").toEqual(premier);
    expect(await db.prisma.waitlistSignup.count()).toBe(1);
    expect(mail.envoyes, "le second appel ne doit rien envoyer").toHaveLength(1);
  });

  // La colonne est en citext : deux casses désignent la même personne.
  it("traite deux casses comme une seule adresse", async () => {
    await service.join({ email: "awa@example.com", locale: "fr" });
    await service.join({ email: "AWA@Example.com", locale: "fr" });

    expect(await db.prisma.waitlistSignup.count()).toBe(1);
    expect(mail.envoyes).toHaveLength(1);
  });

  // L'adresse capturée vaut plus que la confirmation : une panne d'acheminement
  // ne doit pas perdre l'inscription, ni faire échouer l'appel.
  it("garde l'inscription même si le courriel ne part pas", async () => {
    mail.echoue = true;
    await expect(service.join({ email: "awa@example.com", locale: "fr" })).resolves.toEqual({ joined: true });
    expect(await db.prisma.waitlistSignup.count()).toBe(1);
  });

  it("plafonne les inscriptions venues d'une même adresse IP", async () => {
    for (let i = 0; i < 10; i += 1) {
      await service.join({ email: `p${i}@example.com`, locale: "fr", ip: "203.0.113.7" });
    }
    await expect(
      service.join({ email: "onzieme@example.com", locale: "fr", ip: "203.0.113.7" }),
    ).rejects.toBeInstanceOf(AppError);
  });

  // Le plafond par IP ne doit pas devenir un plafond global : une autre origine
  // reste servie même quand la première est bloquée.
  it("ne bloque pas les autres origines", async () => {
    for (let i = 0; i < 10; i += 1) {
      await service.join({ email: `p${i}@example.com`, locale: "fr", ip: "203.0.113.7" });
    }
    await expect(
      service.join({ email: "ailleurs@example.com", locale: "fr", ip: "198.51.100.4" }),
    ).resolves.toEqual({ joined: true });
  });

  it("plafonne le rejeu sur une même adresse", async () => {
    for (let i = 0; i < 3; i += 1) {
      await service.join({ email: "awa@example.com", locale: "fr" });
    }
    await expect(service.join({ email: "awa@example.com", locale: "fr" })).rejects.toBeInstanceOf(AppError);
  });

  // §9.9 : « l'énumération d'une même boîte par suffixes (a+1@, a+2@) est
  // détectée ». Le plafond seul n'y suffit pas — il laisserait passer trois
  // variantes par heure. C'est l'unicité sur la forme canonique qui tranche.
  it("ne laisse pas une même boîte se démultiplier par sous-adressage", async () => {
    await service.join({ email: "awa+1@example.com", locale: "fr" });
    await service.join({ email: "awa+2@example.com", locale: "fr" });

    expect(await db.prisma.waitlistSignup.count(), "une seule boîte, une seule ligne").toBe(1);
    expect(mail.envoyes, "une seule confirmation").toHaveLength(1);
  });

  // Gmail ignore aussi les points de la partie locale.
  it("traite les points comme inexistants chez Gmail, et seulement là", async () => {
    await service.join({ email: "a.w.a@gmail.com", locale: "fr" });
    await service.join({ email: "awa@gmail.com", locale: "fr" });
    expect(await db.prisma.waitlistSignup.count()).toBe(1);

    await service.join({ email: "a.w.a@example.com", locale: "fr" });
    await service.join({ email: "awa@example.com", locale: "fr" });
    expect(await db.prisma.waitlistSignup.count(), "ailleurs, ce sont deux boîtes").toBe(3);
  });

  // Aucune surface de l'application n'accepte une adresse jetable.
  it("refuse une adresse jetable, sans rien enregistrer", async () => {
    await expect(
      service.join({ email: "awa@mailinator.com", locale: "fr" }),
    ).rejects.toBeInstanceOf(AppError);

    expect(await db.prisma.waitlistSignup.count()).toBe(0);
    expect(mail.envoyes).toHaveLength(0);
  });

  // Un robot remplit tous les champs, y compris celui que personne ne voit.
  it("refuse une soumission qui a rempli le champ leurre", async () => {
    await expect(
      service.join({ email: "awa@example.com", locale: "fr", website: "http://spam.example" }),
    ).rejects.toBeInstanceOf(AppError);

    expect(await db.prisma.waitlistSignup.count()).toBe(0);
    expect(mail.envoyes).toHaveLength(0);
  });

  // Les deux filtres à robots doivent être indiscernables depuis le client :
  // AppError.toEnvelope renvoie le message tel quel, donc deux libellés
  // distincts diraient au robot lequel a mordu, et il s'ajusterait.
  it("ne dit pas lequel des deux filtres a écarté la soumission", async () => {
    const attraper = async (corps: Parameters<typeof service.join>[0]) => {
      try {
        await service.join(corps);
        expect.unreachable("aurait dû être refusé");
      } catch (erreur) {
        const e = erreur as AppError;
        return { code: e.code, message: e.message };
      }
    };

    const parLeLeurre = await attraper({ email: "a@example.com", locale: "fr", website: "spam" });
    const parLeDelai = await attraper({ email: "b@example.com", locale: "fr", renderedAt: Date.now() });

    expect(parLeDelai).toEqual(parLeLeurre);
  });

  // La base est en citext, mais la clé du limiteur est une chaîne ordinaire :
  // sans normalisation, « AWA@ » et « awa@ » ouvrent deux compteurs et le
  // plafond se contourne par la touche majuscule. Le test précédent ne le
  // voit pas — il n'emploie qu'une seule casse.
  it("ne se contourne pas en changeant la casse", async () => {
    await service.join({ email: "awa@example.com", locale: "fr" });
    await service.join({ email: "AWA@example.com", locale: "fr" });
    await service.join({ email: "Awa@Example.com", locale: "fr" });

    await expect(
      service.join({ email: "aWa@ExAmPlE.cOm", locale: "fr" }),
      "quatrième tentative sur la même adresse, quelle qu'en soit la casse",
    ).rejects.toBeInstanceOf(AppError);
  });
});
