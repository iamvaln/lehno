import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { createPersonSchema, champsDeProche, type CreatePersonInput } from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { PersonService } from "../src/me/person.service.js";
import { EventService } from "../src/me/event.service.js";
import { NoteService } from "../src/me/note.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { randomBytes } from "node:crypto";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { FlagsService } from "../src/flags/flags.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

describe("annuaire des proches", () => {
  let db: TestDb;
  let service: PersonService;
  let events: EventService;
  let notes: NoteService;
  let awa: string;
  let bila: string;

  const compte = async (): Promise<string> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
    });
    return u.id;
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    // `events.other` allumé : ces cas éprouvent les événements libres, pas le
    // lancement resserré. Un drapeau naît ÉTEINT — c'est voulu, et c'est
    // précisément l'état d'un déploiement neuf.
    const drapeaux = new FlagsService(db.prisma as never);
    await drapeaux.reconcilier();
    await db.prisma.featureFlag.update({ where: { key: "events.other" }, data: { enabled: true } });
    const depot = new TenantRepository(db.prisma as never);
    events = new EventService(depot, db.prisma as never, new FlagsService(db.prisma as never));
    notes = new NoteService(depot, db.prisma as never);
    service = new PersonService(depot, events, db.prisma as never);
    awa = await compte();
    bila = await compte();
  });

  it("crée un proche et le rend avec son identifiant", async () => {
    const p = await service.create(awa, { displayName: "Valery", register: "amical" });
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.displayName).toBe("Valery");
    expect(p.register).toBe("amical");
    expect(p.isSelf).toBe(false);
  });

  // Le cloisonnement est la propriété qui compte le plus ici : l'annuaire d'un
  // compte ne doit jamais laisser voir celui d'un autre.
  it("ne montre que les proches du demandeur", async () => {
    await service.create(awa, { displayName: "Valery" });
    await service.create(bila, { displayName: "Celarine" });

    const vus = await service.list(awa);
    expect(vus.persons.map((p) => p.displayName)).toEqual(["Valery"]);
  });

  /* Le carnet — ce que le handoff arrête, et qu'il ne faut pas re-trancher :
     vingt par page, deux tris avec leur direction, et une fiche sans date en
     fin de liste dans les deux sens. */
  describe("le carnet se trie et se pagine", () => {
    // Un carnet dont les dates sont posées à la main : le tri porte sur la
    // prochaine échéance, il faut donc de vraies échéances à des distances
    // connues.
    const avecDate = async (nom: string, dans: number | null): Promise<string> => {
      const p = await service.create(awa, { displayName: nom, birthDate: "1990-03-14" });
      if (dans === null) {
        // Un proche PEUT n'avoir aucune date : l'anniversaire est un événement,
        // pas une conséquence automatique de la naissance.
        await db.prisma.event.deleteMany({ where: { personId: p.id } });
        return p.id;
      }
      const e = await events.create(awa, { personId: p.id, kind: "birthday" });
      const jour = new Date(Date.now() + dans * 86_400_000).toISOString().slice(0, 10);
      await db.prisma.eventOccurrence.updateMany({
        where: { eventId: e.id }, data: { occurrenceDate: new Date(`${jour}T00:00:00Z`) },
      });
      return p.id;
    };

    it("compte les notes DURABLES de chaque proche, sans un appel par fiche", async () => {
      const p = await service.create(awa, { displayName: "Valery" });
      const q = await service.create(awa, { displayName: "Quentin" });
      for (const contenu of ["une", "deux", "trois"]) {
        await notes.createForPerson(awa, p.id, { content: contenu });
      }

      const { persons } = await service.list(awa);
      expect(persons.find((x) => x.id === p.id)?.notesCount).toBe(3);
      // Zéro, pas absent : la ligne affiche « Aucune note » et doit pouvoir le
      // distinguer d'un décompte qu'on n'aurait pas chargé.
      expect(persons.find((x) => x.id === q.id)?.notesCount).toBe(0);
    });

    it("porte la prochaine échéance, et rien quand le proche n'en a pas", async () => {
      const avec = await avecDate("Avec", 5);
      const sans = await avecDate("Sans", null);

      const { persons } = await service.list(awa);
      const a = persons.find((x) => x.id === avec);
      expect(a?.nextOccurrence?.daysUntil).toBe(5);
      expect(a?.nextOccurrence?.kind).toBe("birthday");
      // Nul plutôt qu'absent : la ligne affiche « Compléter » à la place du
      // décompte, elle est donc OBLIGÉE de traiter le cas.
      expect(persons.find((x) => x.id === sans)?.nextOccurrence).toBeNull();
    });

    it("trie par date, au plus proche puis au plus loin", async () => {
      await avecDate("Loin", 40);
      await avecDate("Proche", 2);
      await avecDate("Moyen", 12);

      const asc = await service.list(awa, { sort: "date" });
      expect(asc.persons.map((p) => p.displayName)).toEqual(["Proche", "Moyen", "Loin"]);
      const desc = await service.list(awa, { sort: "date", direction: "desc" });
      expect(desc.persons.map((p) => p.displayName)).toEqual(["Loin", "Moyen", "Proche"]);
    });

    /* LE cas du handoff : « Une fiche sans date passe en fin de liste dans les
       deux sens. » Un tri naïf la remonterait en tête dès qu'on l'inverse, et
       elle occuperait la place de ce qui presse. */
    it("laisse en FIN de liste, dans les deux sens, une fiche sans date", async () => {
      await avecDate("Proche", 2);
      await avecDate("Loin", 40);
      await avecDate("Sans", null);

      const asc = await service.list(awa, { sort: "date" });
      expect(asc.persons.at(-1)?.displayName).toBe("Sans");
      const desc = await service.list(awa, { sort: "date", direction: "desc" });
      expect(desc.persons.at(-1)?.displayName).toBe("Sans");
    });

    it("trie alphabétiquement, accents rangés avec leur lettre", async () => {
      for (const nom of ["Zoé", "Émile", "Awa"]) {
        await service.create(awa, { displayName: nom });
      }
      const az = await service.list(awa, { sort: "alpha" });
      // « Émile » entre Awa et Zoé, jamais après : c'est ce que la collation
      // du serveur PostgreSQL ne garantit pas, d'où le collateur explicite.
      expect(az.persons.map((p) => p.displayName)).toEqual(["Awa", "Émile", "Zoé"]);
      const za = await service.list(awa, { sort: "alpha", direction: "desc" });
      expect(za.persons.map((p) => p.displayName)).toEqual(["Zoé", "Émile", "Awa"]);
    });

    /* La recherche (§3.15). Elle vit sur le même chemin que la liste parce
       qu'elle doit se combiner au tri et à la pagination — l'écran de recherche
       filtrait jusqu'ici la page déjà chargée, et un proche de la troisième
       page restait introuvable. */
    it("filtre sur le nom affiché", async () => {
      for (const nom of ["Célarine", "Valery", "Quentin"]) {
        await service.create(awa, { displayName: nom });
      }
      const r = await service.list(awa, { q: "val" });
      expect(r.persons.map((p) => p.displayName)).toEqual(["Valery"]);
    });

    // Le nom d'usage est celui par lequel on l'APPELLE : quelqu'un cherche
    // « maman » sans savoir si la fiche affiche « Chantal Mbarga ».
    it("filtre aussi sur le nom d'usage", async () => {
      await service.create(awa, { displayName: "Chantal Mbarga", callingName: "Maman" });
      await service.create(awa, { displayName: "Valery" });
      const r = await service.list(awa, { q: "maman" });
      expect(r.persons.map((p) => p.displayName)).toEqual(["Chantal Mbarga"]);
    });

    /* LE cas du marché visé : les claviers ne portent pas toujours les
       accents. Une recherche sensible aux accents serait inutilisable pour la
       moitié des noms du carnet. */
    it("ignore la casse et les accents dans les deux sens", async () => {
      await service.create(awa, { displayName: "Émile" });
      await service.create(awa, { displayName: "Célarine" });
      expect((await service.list(awa, { q: "emile" })).persons).toHaveLength(1);
      expect((await service.list(awa, { q: "ÉMILE" })).persons).toHaveLength(1);
      expect((await service.list(awa, { q: "celarine" })).persons).toHaveLength(1);
    });

    /* Le filtre s'applique AVANT la découpe, jamais après : filtrer une page
       déjà coupée est exactement le défaut qu'on corrige. Vingt-cinq fiches
       dont une seule correspond, et elle doit sortir — même si elle serait
       tombée en troisième page sans le filtre. */
    it("cherche dans TOUT le carnet, pas dans la page déjà chargée", async () => {
      for (let i = 0; i < 25; i += 1) {
        await service.create(awa, { displayName: `Zzz${String(i).padStart(2, "0")}` });
      }
      await service.create(awa, { displayName: "Aiguille" });

      const r = await service.list(awa, { q: "aiguille", sort: "alpha" });
      expect(r.persons.map((p) => p.displayName)).toEqual(["Aiguille"]);
      // Le total compte les CORRESPONDANCES, pas le carnet : « Voir plus · n
      // restants » compterait sinon des fiches que la recherche a écartées.
      expect(r.total).toBe(1);
    });

    it("ne cherche jamais dans le carnet d'un autre compte", async () => {
      await service.create(bila, { displayName: "Celarine" });
      expect((await service.list(awa, { q: "celarine" })).persons).toEqual([]);
    });

    it("pagine par vingt, et rend le total pour « n restants »", async () => {
      for (let i = 0; i < 23; i += 1) {
        await service.create(awa, { displayName: `P${String(i).padStart(2, "0")}` });
      }
      const page = await service.list(awa, { sort: "alpha" });
      expect(page.persons).toHaveLength(20);
      // Le total, non le nombre rendu : « Voir plus · 3 restants » se calcule
      // avec lui, et un curseur ne saurait pas le donner.
      expect(page.total).toBe(23);

      const suite = await service.list(awa, { sort: "alpha", offset: 20 });
      expect(suite.persons).toHaveLength(3);
      expect(suite.persons[0]?.displayName).toBe("P20");
    });

    /* Trier PUIS paginer, jamais l'inverse. Si la page se découpait en base
       avant le tri, la vingt-et-unième fiche pourrait porter la date la plus
       proche et ne paraîtrait jamais en tête. */
    it("trie sur tout le carnet avant de découper la page", async () => {
      for (let i = 0; i < 20; i += 1) await avecDate(`Bourrage${i}`, 300 + i);
      await avecDate("La plus proche", 1);

      const page = await service.list(awa, { sort: "date" });
      expect(page.persons[0]?.displayName).toBe("La plus proche");
    });
  });

  // Le nom d'usage n'est pas unique : deux « Maman » sont deux personnes.
  it("accepte deux proches du même nom", async () => {
    await service.create(awa, { displayName: "Maman" });
    await service.create(awa, { displayName: "Maman" });
    expect((await service.list(awa)).persons).toHaveLength(2);
  });

  describe("la fiche complète", () => {
    // Le service ÉNUMÈRE les champs qu'il écrit — c'est ce qui empêche un
    // userId glissé d'atteindre le dépôt. Mais l'énumération a un prix : un
    // champ ajouté au contrat et oublié dans le service ne serait jamais
    // écrit, sans erreur ni avertissement. La fiche paraîtrait vide et
    // personne ne saurait pourquoi.
    //
    // Ce cas dérive la liste attendue du CONTRAT plutôt que de la recopier :
    // ajouter un champ au contrat le fait rougir tant que le service ne le
    // porte pas. C'est la seule chose qui relie les deux.
    it("écrit tous les champs du contrat, sans en oublier un seul", async () => {
      const complet: CreatePersonInput = {
        displayName: "Valery Nguemne",
        birthDate: "1990-03-14",
        birthYearKnown: true,
        callingName: "Valo",
        avatarUrl: "https://exemple.test/photo.jpg",
        relation: "ami",
        register: "amical",
        language: "fr",
        relationHint: "on a fait la fac ensemble",
        city: "Douala",
        country: "CM",
        preferredChannel: "whatsapp",
        gender: "male",
      };

      // Si le contrat gagne un champ, cette ligne échoue à la compilation
      // tant qu'il n'est pas ajouté ci-dessus — le cas ne peut pas devenir
      // partiel en silence.
      const attendus = Object.keys(champsDeProche.shape) as (keyof CreatePersonInput)[];
      expect(Object.keys(complet).sort()).toEqual([...attendus].sort());

      const p = await service.create(awa, complet);
      const relu = await service.get(awa, p.id);

      /* `gender` S'ÉCRIT SANS SE LIRE, et c'est la seule exception.
       *
       * Il sert l'accord grammatical et rien d'autre — « fier » ou « fière ».
       * Le absent de `personSchema` est la garde : un écran ne peut pas
       * l'afficher, ni s'en servir pour trier, ni le laisser paraître dans une
       * liste. Il entre par le formulaire d'identité et ne ressort que vers le
       * modèle.
       *
       * Le relire ici échouerait donc à la compilation. Le cas suivant vérifie
       * qu'il est bien arrivé EN BASE — sans quoi cette exception se
       * transformerait en champ silencieusement perdu. */
      for (const champ of attendus.filter((c) => c !== "gender")) {
        expect(relu[champ], `« ${champ} » n'a pas été écrit par le service`).toBe(complet[champ]);
      }
    });

    /* La contrepartie de l'exception ci-dessus : écrit, mais invisible.
     *
     * Sans ce cas, retirer `gender` du service ne ferait rougir personne — la
     * réponse ne le porte pas, et la boucle l'exclut. Un champ dont l'absence
     * ne se voit nulle part finit par disparaître. */
    it("écrit le genre en base sans jamais le rendre au client", async () => {
      const p = await service.create(awa, { displayName: "Célarine", gender: "female" });

      const enBase = await db.prisma.person.findUniqueOrThrow({
        where: { id: p.id }, select: { gender: true },
      });
      expect(enBase.gender).toBe("female");
      expect(p).not.toHaveProperty("gender");
      expect(await service.get(awa, p.id)).not.toHaveProperty("gender");
    });

    it("se corrige, et reste tout aussi invisible", async () => {
      const p = await service.create(awa, { displayName: "Célarine", gender: "female" });
      const apres = await service.update(awa, p.id, { gender: "other" });

      expect(apres).not.toHaveProperty("gender");
      expect((await db.prisma.person.findUniqueOrThrow({
        where: { id: p.id }, select: { gender: true },
      })).gender).toBe("other");
    });

    // `relation` et `relationHint` COEXISTENT : l'énumération sert la
    // génération, le texte libre garde la nuance qu'elle écrase. Poser l'une
    // ne doit pas effacer l'autre — ce serait perdre « on a fait la fac
    // ensemble » au profit de « ami ».
    it("garde le lien en toutes lettres à côté de l'énumération", async () => {
      const p = await service.create(awa, {
        displayName: "Celarine",
        relation: "collegue",
        relationHint: "on s'est connus sur un chantier à Yaoundé",
      });
      expect(p.relation).toBe("collegue");
      expect(p.relationHint).toBe("on s'est connus sur un chantier à Yaoundé");
    });

    // Un pays s'écrit en deux lettres : un pays en toutes lettres ne sert à
    // rien à qui doit le comparer, et « Cameroun » ou « Cameroon » selon la
    // langue de saisie rendrait toute recherche fausse.
    it("normalise le pays en deux lettres majuscules", async () => {
      // On passe par le SCHÉMA, comme le fait le contrôleur via son tuyau de
      // validation : la normalisation vit là, pas dans le service. Appeler le
      // service en direct la contournerait, et le cas mesurerait alors autre
      // chose que ce que traverse une vraie requête.
      const valide = createPersonSchema.parse({ displayName: "Awa", country: "cm" });
      const p = await service.create(awa, valide);
      expect(p.country).toBe("CM");

      // Un pays en toutes lettres ne sert à rien à qui doit le comparer, et
      // « Cameroun » ou « Cameroon » selon la langue de saisie rendrait toute
      // recherche fausse. Le schéma le refuse avant le service.
      expect(createPersonSchema.safeParse({ displayName: "X", country: "Cameroun" }).success)
        .toBe(false);
    });

    // Une correction ne touche que ce qu'elle nomme. Sans ça, corriger le
    // registre effacerait la ville, et l'utilisateur perdrait ce qu'il n'a
    // pas demandé à changer.
    it("une correction partielle ne touche pas au reste", async () => {
      const p = await service.create(awa, {
        displayName: "Awa", city: "Douala", callingName: "Awa chérie", register: "familier",
      });
      const m = await service.update(awa, p.id, { register: "formel" });
      expect(m.register).toBe("formel");
      expect(m.city).toBe("Douala");
      expect(m.callingName).toBe("Awa chérie");
    });
  });

  // Preuve de cloisonnement à l'écriture, en deux cas distincts et
  // indépendants : la disparition de l'un des deux ne doit pas passer
  // inaperçue derrière le succès de l'autre.
  describe("cloisonnement à l'écriture", () => {
    // Première protection : le schéma .strict() refuse un champ inattendu
    // avant même que la requête n'atteigne le service — un corps qui porte
    // userId ne doit jamais être une forme valide.
    it("un corps de création portant userId est refusé par le schéma, avant le service", () => {
      const résultat = createPersonSchema.safeParse({
        displayName: "Otage",
        userId: bila,
      });
      expect(résultat.success).toBe(false);
    });

    // Seconde protection, indépendante de la première : si l'appelant force
    // le passage jusqu'au service (contournement du typage, comme un `as` le
    // permettrait), la fiche appartient tout de même au demandeur — parce que
    // le service ÉNUMÈRE les champs qu'il écrit au lieu d'étaler l'entrée, et
    // qu'une clé inconnue n'atteint donc jamais le dépôt.
    //
    // Ce n'est PAS l'ordre d'écriture de Scope.create que ce cas éprouve :
    // inverser cet ordre laisse ce test vert, la preuve étant portée par
    // « ne laisse pas créer une ressource au nom d'un autre » dans
    // tenancy.test.ts. Deux gardes en série, une preuve chacune.
    it("un userId forcé jusqu'au service n'atteint pas le dépôt : le service énumère ses champs", async () => {
      const usurpé = { displayName: "Otage", userId: bila } as unknown as CreatePersonInput;
      await service.create(awa, usurpé);

      const vusAwa = await service.list(awa);
      const vusBila = await service.list(bila);
      expect(vusAwa.persons.map((p) => p.displayName)).toContain("Otage");
      expect(vusBila.persons.map((p) => p.displayName)).not.toContain("Otage");
    });
  });

  it("rend la fiche d'un proche", async () => {
    const p = await service.create(awa, { displayName: "Valery" });
    expect((await service.get(awa, p.id)).displayName).toBe("Valery");
  });

  // 404 et non 403 : la fiche d'un autre n'existe pas pour le demandeur. Un 403
  // confirmerait qu'elle existe, et l'identifiant deviendrait un oracle.
  it("ne rend pas la fiche d'un autre compte", async () => {
    const p = await service.create(bila, { displayName: "Celarine" });
    await expect(service.get(awa, p.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("met à jour le registre sans toucher au reste", async () => {
    const p = await service.create(awa, { displayName: "Valery", register: "amical" });
    const m = await service.update(awa, p.id, { register: "formel" });
    expect(m.register).toBe("formel");
    expect(m.displayName).toBe("Valery");
  });

  it("ne met pas à jour la fiche d'un autre compte", async () => {
    const p = await service.create(bila, { displayName: "Celarine" });
    await expect(service.update(awa, p.id, { register: "formel" })).rejects.toMatchObject({ code: "not_found" });
  });

  // Supprimer un proche emporte ses notes : la cascade est déclarée au schéma,
  // ce test la constate plutôt que de la supposer.
  it("supprime le proche et ses notes", async () => {
    const p = await service.create(awa, { displayName: "Valery" });
    await db.prisma.note.create({ data: { personId: p.id, content: "aime le café" } });

    await service.remove(awa, p.id);

    expect(await db.prisma.person.count({ where: { id: p.id } })).toBe(0);
    expect(await db.prisma.note.count({ where: { personId: p.id } })).toBe(0);
  });

  // Cloisonnement à la suppression : la protection la plus coûteuse à rater du
  // lot, un DELETE qui ignore la portée efface les données de quelqu'un
  // d'autre. Preuve indépendante du cas symétrique ci-dessus sur update.
  it("ne supprime pas la fiche d'un autre compte", async () => {
    const p = await service.create(bila, { displayName: "Celarine" });
    await expect(service.remove(awa, p.id)).rejects.toMatchObject({ code: "not_found" });
    expect(await db.prisma.person.count({ where: { id: p.id } })).toBe(1);
  });

  describe("HTTP de bout en bout", () => {
    let app: INestApplication;
    let baseUrl: string;
    let previousEnv: {
      DATABASE_URL: string | undefined; OTP_PEPPER: string | undefined; JWT_SECRET: string | undefined;
      LEHNO_MAIL_CONSOLE: string | undefined;
    };

    beforeAll(async () => {
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
      // L'AppModule fusionné porte aussi l'administration, qui refuse de
      // démarrer sans sa propre clé — deux mondes séparés jusque dans leurs
      // signatures. Sans cette ligne, monter le module échoue ici.
      process.env.LEHNO_MAIL_CONSOLE = "1";

      app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
      app.setGlobalPrefix("v1");
      app.useGlobalFilters(new AppExceptionFilter());
      await app.listen(0);
      baseUrl = await app.getUrl();
    }, 120_000);

    afterAll(async () => {
      await app.close();
      if (previousEnv.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousEnv.DATABASE_URL;
      if (previousEnv.OTP_PEPPER === undefined) delete process.env.OTP_PEPPER;
      else process.env.OTP_PEPPER = previousEnv.OTP_PEPPER;
      if (previousEnv.JWT_SECRET === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousEnv.JWT_SECRET;
      if (previousEnv.LEHNO_MAIL_CONSOLE === undefined) delete process.env.LEHNO_MAIL_CONSOLE;
      else process.env.LEHNO_MAIL_CONSOLE = previousEnv.LEHNO_MAIL_CONSOLE;
    });

    it("refuse un appel sans jeton", async () => {
      const r = await fetch(`${baseUrl}/v1/me/persons`);
      expect(r.status).toBe(401);
    });

    // Seul pont entre le contrat calculé et ce que le serveur rend réellement :
    // le test de péremption du contrat ne compare que le fichier au calcul,
    // jamais le calcul à la réponse HTTP effective. C'est ce test-ci qui
    // aurait révélé, seul, que @Post() sans @HttpCode rend 201 — le contrat
    // publié doit donc annoncer 201, pas 200.
    it("crée un proche via HTTP avec un jeton valable", async () => {
      const token = jwt.sign({ sub: awa }, SECRET, { algorithm: "HS256", expiresIn: 900 });
      const r = await fetch(`${baseUrl}/v1/me/persons`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: "Valery" }),
      });
      expect(r.status).toBe(201);
      const body = (await r.json()) as { id: string; displayName: string };
      expect(body.displayName).toBe("Valery");
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("lit la fiche d'un proche via HTTP", async () => {
      const p = await service.create(awa, { displayName: "Valery" });
      const token = jwt.sign({ sub: awa }, SECRET, { algorithm: "HS256", expiresIn: 900 });
      const r = await fetch(`${baseUrl}/v1/me/persons/${p.id}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(r.status).toBe(200);
      const body = (await r.json()) as { displayName: string };
      expect(body.displayName).toBe("Valery");
    });

    it("met à jour une fiche via HTTP", async () => {
      const p = await service.create(awa, { displayName: "Valery", register: "amical" });
      const token = jwt.sign({ sub: awa }, SECRET, { algorithm: "HS256", expiresIn: 900 });
      const r = await fetch(`${baseUrl}/v1/me/persons/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ register: "formel" }),
      });
      expect(r.status).toBe(200);
      const body = (await r.json()) as { register: string; displayName: string };
      expect(body.register).toBe("formel");
      expect(body.displayName).toBe("Valery");
    });

    // Seul pont entre le contrat calculé et ce que le serveur rend réellement :
    // le test de péremption du contrat ne compare que le fichier au calcul,
    // jamais le calcul à la réponse HTTP effective. Sans ce test-ci, un
    // contrôleur qui rendrait 200 au lieu de 204 laisserait le contrat mentir
    // sans qu'aucun test ne le révèle.
    it("supprime une fiche via HTTP et rend 204", async () => {
      const p = await service.create(awa, { displayName: "Valery" });
      const token = jwt.sign({ sub: awa }, SECRET, { algorithm: "HS256", expiresIn: 900 });
      const r = await fetch(`${baseUrl}/v1/me/persons/${p.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(r.status).toBe(204);
      const corps = await r.text();
      expect(corps).toBe("");
      expect(await db.prisma.person.count({ where: { id: p.id } })).toBe(0);
    });

    // Cloisonnement observé au niveau HTTP, pas seulement au niveau du
    // service : la fiche d'un autre compte n'existe pas pour le demandeur,
    // sur les trois verbes.
    it("rend 404 sur GET/PATCH/DELETE pour la fiche d'un autre compte", async () => {
      const p = await service.create(bila, { displayName: "Celarine" });
      const token = jwt.sign({ sub: awa }, SECRET, { algorithm: "HS256", expiresIn: 900 });

      const get = await fetch(`${baseUrl}/v1/me/persons/${p.id}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(get.status).toBe(404);

      const patch = await fetch(`${baseUrl}/v1/me/persons/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ register: "formel" }),
      });
      expect(patch.status).toBe(404);

      const del = await fetch(`${baseUrl}/v1/me/persons/${p.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(del.status).toBe(404);

      expect(await db.prisma.person.count({ where: { id: p.id } })).toBe(1);
    });

    // Un identifiant malformé doit répondre 400, sans atteindre la base.
    it("refuse un identifiant malformé avec 400", async () => {
      const token = jwt.sign({ sub: awa }, SECRET, { algorithm: "HS256", expiresIn: 900 });
      const r = await fetch(`${baseUrl}/v1/me/persons/pas-un-uuid`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(r.status).toBe(400);
    });
  });
});
