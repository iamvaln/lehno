import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { reglagesPortraitDeDepart } from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { GenerationService } from "../src/me/generation.service.js";
import { PortraitService } from "../src/me/portrait.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { AuditService } from "../src/admin/audit.service.js";
import { StudioConfigurationService } from "../src/studio/configuration.service.js";
import { RouteurIAService, type Adaptateur, type ReponseIA } from "../src/ia/routeur.service.js";
import { CatalogueIAService } from "../src/ia/catalogue.service.js";
import { StockageMemoire } from "../src/stockage/memoire.adapter.js";
import { verifierLaSelection } from "../src/studio/selection.js";

/**
 * Le portrait, en deux temps.
 *
 * Le texte au lancement, l'IMAGE À L'APPROBATION. Ce qu'on éprouve n'est pas la
 * qualité du dessin — elle dépend d'un tiers — mais trois choses qui se
 * comptent : le crédit débité une fois, l'image qui ne se fabrique qu'une fois
 * approuvée, et surtout CE QUI PART au fournisseur d'image.
 */
describe("le portrait", () => {
  let db: TestDb;
  let stockage: StockageMemoire;
  let awa: string;
  let proche: string;

  /* Le brief : des mots, une phrase, une version courte. C'est ce que le modèle
     de TEXTE rend, et c'est tout ce que le modèle d'image recevra. */
  const BRIEF = JSON.stringify({
    mots: ["le jardin du matin", "les mains dans la terre", "le héron"],
    phrase: "Celle qui plante avant que le jour se lève.",
    phraseCourte: "Le jardin du matin.",
  });

  /* Un double qui RETIENT ce qu'on lui a envoyé. C'est le seul moyen d'éprouver
     ce qui fuit : la promesse du brief est que les notes ne traversent pas. */
  const repond = (contenu: string): Adaptateur & { vu: string[] } => {
    const a = {
      vu: [] as string[],
      async appeler(_modele: string, d: { invite: string; systeme?: string }): Promise<ReponseIA> {
        a.vu.push(`${d.systeme ?? ""}\n${d.invite}`);
        return { contenu };
      },
    };
    return a as Adaptateur & { vu: string[] };
  };

  const configs = (): StudioConfigurationService =>
    new StudioConfigurationService(db.prisma as never, new AuditService(db.prisma as never));

  const generation = (a: Adaptateur): GenerationService =>
    new GenerationService(
      db.prisma as never, new TenantRepository(db.prisma as never),
      new RouteurIAService(db.prisma as never), { anthropic: a }, configs(),
    );

  const portraits = (a: Adaptateur): PortraitService =>
    new PortraitService(
      db.prisma as never, new RouteurIAService(db.prisma as never),
      { anthropic: a, xai: a, openai: a }, configs(), stockage,
    );

  /* La configuration PUBLIÉE. Sans elle le service refuse — et c'est voulu :
     composer une image avec des réglages que personne n'a publiés donnerait une
     image qu'aucun essai n'a montrée. */
  const publier = async (): Promise<void> => {
    const reglages = reglagesPortraitDeDepart();
    await db.prisma.studioConfig.create({
      data: {
        kind: "portrait", state: "published", version: 1,
        settings: reglages as never, fingerprint: randomBytes(8).toString("hex"),
      },
    });
  };

  const selection = () =>
    verifierLaSelection(reglagesPortraitDeDepart(), {
      orientation: "notre_relation", visual: "illustration", illustrationFamily: "nature",
    });

  const crediter = (n: number) =>
    db.prisma.creditTransaction.create({
      data: { userId: awa, type: "grant", source: "signup_grant", amount: n },
    });

  const solde = async (): Promise<number> =>
    (await db.prisma.creditTransaction.aggregate({ where: { userId: awa }, _sum: { amount: true } }))._sum.amount ?? 0;

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    await new CatalogueIAService(db.prisma as never).reconcilier();
    stockage = new StockageMemoire();

    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
      select: { id: true },
    });
    awa = u.id;
    const p = await db.prisma.person.create({
      data: { userId: awa, displayName: "Célarine", gender: "female" },
      select: { id: true },
    });
    proche = p.id;
  });

  describe("le texte", () => {
    it("produit un portrait en attente d'approbation, sans image", async () => {
      await crediter(5);
      const portrait = await generation(repond(BRIEF)).lancerPortrait(awa, proche, selection());

      expect(portrait.status).toBe("generated");
      expect(portrait.imageKey).toBeNull();
      expect(await solde()).toBe(4);
    });

    /* LA PROMESSE DU BRIEF. Les notes privées ne doivent pas traverser — c'est
       toute la raison de cette tâche de texte. Ici on vérifie qu'elles arrivent
       bien au modèle de TEXTE ; le cas de l'approbation vérifie qu'elles
       n'arrivent PAS au modèle d'image. */
    it("donne les notes au modèle de texte, et les rejets à part", async () => {
      await crediter(5);
      const categorie = await db.prisma.category.findFirstOrThrow({ where: { code: "dislikes_nogo" } });
      await db.prisma.note.create({
        data: { personId: proche, authorUserId: awa, content: "aime jardiner" },
      });
      await db.prisma.note.create({
        data: {
          personId: proche, authorUserId: awa, content: "déteste les chiens",
          categories: { create: { categoryId: categorie.id } },
        },
      });

      const a = repond(BRIEF);
      await generation(a).lancerPortrait(awa, proche, selection());

      expect(a.vu[0]).toContain("aime jardiner");
      expect(a.vu[0]).toContain("À NE JAMAIS ÉVOQUER");
      expect(a.vu[0]!.indexOf("déteste les chiens")).toBeLessThan(a.vu[0]!.indexOf("aime jardiner"));
    });

    /* LES ATTRIBUTS SONT LA MATIÈRE LA PLUS SÛRE : déjà rangés, déjà choisis.
       Et `avoid` est un REJET, du côté des attributs — le laisser dans la
       matière ferait dessiner ce que la personne fuit, par une autre porte que
       les notes. */
    it("emploie les goûts relevés, et écarte ceux marqués à éviter", async () => {
      await crediter(5);
      await db.prisma.personAttribute.createMany({
        data: [
          { personId: proche, kind: "animal", value: "le héron", observedAt: new Date() },
          { personId: proche, kind: "avoid", value: "le rouge", observedAt: new Date() },
        ],
      });

      const a = repond(BRIEF);
      await generation(a).lancerPortrait(awa, proche, selection());

      expect(a.vu[0]).toContain("animal : le héron");
      expect(a.vu[0]).toContain("À NE JAMAIS ÉVOQUER");
      expect(a.vu[0]).toContain("le rouge");
      // Et il ne figure pas dans la matière : seulement dans l'interdiction.
      expect(a.vu[0]).not.toContain("avoid : le rouge");
    });

    it("rend le crédit quand le brief est illisible", async () => {
      await crediter(5);
      await expect(
        generation(repond("pas du JSON")).lancerPortrait(awa, proche, selection()),
      ).rejects.toThrow();
      expect(await solde()).toBe(5);
    });

    /* Sous trois mots, il n'y a plus de portrait à composer : un nuage d'un mot
       n'est pas un nuage. Le crédit est rendu. */
    it("rend le crédit quand le brief n'a pas assez de mots", async () => {
      await crediter(5);
      const maigre = JSON.stringify({ mots: ["le jardin"], phrase: "Une phrase." });
      await expect(
        generation(repond(maigre)).lancerPortrait(awa, proche, selection()),
      ).rejects.toThrow();
      expect(await solde()).toBe(5);
    });
  });

  describe("l'approbation", () => {
    const unPortrait = async () => {
      await crediter(5);
      return generation(repond(BRIEF)).lancerPortrait(awa, proche, selection());
    };

    /* LE CAS QUI JUSTIFIE TOUTE LA TÂCHE DE BRIEF.
     *
     * Ce qui part au fournisseur d'image ne doit contenir NI note, NI nom, NI
     * relation — seulement les mots retenus. C'est ce qui empêche « a perdu son
     * père en mars » de traverser chez un tiers pour fabriquer un dessin. */
    it("n'envoie au modèle d'image que les mots retenus", async () => {
      await db.prisma.note.create({
        data: { personId: proche, authorUserId: awa, content: "a perdu son père en mars" },
      });
      await publier();
      const portrait = await unPortrait();

      const image = repond("aW1hZ2U=");
      await portraits(image).approuver(awa, portrait.id);

      const envoye = image.vu[0]!;
      expect(envoye).toContain("le jardin du matin");
      expect(envoye).not.toContain("a perdu son père en mars");
      expect(envoye).not.toContain("Célarine");
    });

    it("fabrique l'image et range une clé, jamais l'image", async () => {
      await publier();
      const portrait = await unPortrait();

      const rendu = await portraits(repond("aW1hZ2U=")).approuver(awa, portrait.id);
      expect(rendu.status).toBe("approved");
      expect(rendu.imageUrl).not.toBeNull();

      const ligne = await db.prisma.portrait.findUniqueOrThrow({ where: { id: portrait.id } });
      expect(ligne.imageKey).toMatch(/^portraits\//);
      expect(stockage.contenuDe(ligne.imageKey!)).toBeDefined();
    });

    /* Deux frappes sur le même bouton sont la chose la plus banale du monde sur
       un téléphone : la seconde ne doit pas coûter un appel de modèle. */
    it("approuver deux fois ne fabrique qu'une image", async () => {
      await publier();
      const portrait = await unPortrait();

      const image = repond("aW1hZ2U=");
      const un = await portraits(image).approuver(awa, portrait.id);
      const deux = await portraits(image).approuver(awa, portrait.id);

      expect(deux.id).toBe(un.id);
      expect(image.vu).toHaveLength(1);
    });

    /* ON REFUSE PLUTÔT QUE DE RETOMBER SUR LE GABARIT DU CODE, à la différence
       du message. Un repli ferait composer une image avec des réglages que
       personne n'a publiés — donc une image qu'aucun essai n'a montrée. */
    it("refuse d'approuver sans configuration publiée", async () => {
      const portrait = await unPortrait();
      await expect(portraits(repond("aW1hZ2U=")).approuver(awa, portrait.id))
        .rejects.toMatchObject({ code: "resource_inactive" });
    });

    // 404 et non 403 : dire « il existe mais n'est pas à vous » apprendrait
    // qu'il existe.
    it("ne laisse pas approuver le portrait d'un autre", async () => {
      await publier();
      const portrait = await unPortrait();
      const bila = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@example.com`,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
        select: { id: true },
      });
      await expect(portraits(repond("aW1hZ2U=")).approuver(bila.id, portrait.id))
        .rejects.toMatchObject({ code: "not_found" });
    });
  });
});
