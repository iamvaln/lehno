import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { ownerWishSchema, sharedWishlistSchema, wishlistSchema } from "@lehno/contracts";
import { WishlistService } from "../src/me/wishlist.service.js";
import { SharedWishlistService } from "../src/public/shared-wishlist.service.js";
import { OtpService } from "../src/auth/otp.service.js";
import { RateLimitService } from "../src/common/rate-limit.service.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { FlagsService } from "../src/flags/flags.service.js";
import type { Mail, MailPort } from "../src/mail/mail.port.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";
const SITE = "https://lehno.test";

// La boîte aux lettres du test : le code n'existe nulle part ailleurs — il
// n'est stocké que sous forme de HMAC —, donc l'éprouver suppose de lire le
// courriel, exactement comme le visiteur.
class BoiteDeTest implements MailPort {
  readonly envois: Mail[] = [];
  async send(mail: Mail): Promise<void> { this.envois.push(mail); }
  dernierCode(): string {
    const dernier = this.envois.at(-1);
    if (!dernier) throw new Error("aucun courriel envoyé");
    const trouve = /\b(\d{6})\b/.exec(dernier.text);
    if (!trouve) throw new Error(`aucun code dans : ${dernier.text}`);
    return trouve[1]!;
  }
}

describe("mes listes de souhaits, leur partage et leur réservation", () => {
  let db: TestDb;
  let listes: WishlistService;
  let publiques: SharedWishlistService;
  let boite: BoiteDeTest;
  let drapeaux: FlagsService;
  let awa: string;
  let bila: string;

  const compte = async (nom?: string): Promise<string> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${nom ?? randomBytes(6).toString("hex")}@example.com`,
        username: nom ?? `u${randomBytes(4).toString("hex")}`,
        displayName: nom ? `${nom} Diop` : null,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
    });
    return u.id;
  };

  /* Une occasion À MOI : la self-Person, son anniversaire, une échéance à
     venir. C'est la chaîne entière que le service remonte avant d'ouvrir une
     liste — l'écrire en entier ici évite d'en éprouver un maillon en croyant
     les éprouver tous. */
  const monOccasion = async (userId: string, dans = 30): Promise<string> => {
    const p = await db.prisma.person.create({
      data: { userId, displayName: "Moi", isSelf: true },
    });
    return occasionSur(userId, p.id, dans);
  };

  // L'occasion d'un PROCHE : même forme, `isSelf` en moins. C'est elle qui doit
  // être refusée à l'ouverture d'une liste.
  const occasionDunProche = async (userId: string, dans = 30): Promise<string> => {
    const p = await db.prisma.person.create({
      data: { userId, displayName: "Karim", isSelf: false },
    });
    return occasionSur(userId, p.id, dans);
  };

  const occasionSur = async (userId: string, personId: string, dans: number): Promise<string> => {
    const e = await db.prisma.event.create({
      data: { personId, kind: "birthday", referenceDate: new Date("1990-08-24") },
    });
    const date = new Date(Date.now() + dans * 86_400_000);
    const o = await db.prisma.eventOccurrence.create({
      data: {
        eventId: e.id, userId,
        occurrenceDate: new Date(date.toISOString().slice(0, 10)),
        occurrenceYear: date.getUTCFullYear(),
      },
    });
    return o.id;
  };

  // Une liste ouverte, partagée, avec un souhait dessus : le point de départ de
  // presque tous les cas de réservation.
  const listePartagee = async (userId: string, dans = 30): Promise<{
    listeId: string; token: string; souhaitId: string;
  }> => {
    const o = await monOccasion(userId, dans);
    const liste = await listes.create(userId, o);
    const partage = await listes.share(userId, liste.id);
    const souhait = await listes.createWish(userId, liste.id, { label: "Un moulin à café" });
    return { listeId: liste.id, token: partage.token, souhaitId: souhait.id };
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    drapeaux = new FlagsService(db.prisma as never);
    await drapeaux.reconcilier();
    /* Les trois drapeaux allumés : ces cas éprouvent la surface, pas son
       extinction. `wall` en fait partie parce que `reservation` en dépend —
       l'oublier ferait tomber toutes les réservations en 404, et on chercherait
       longtemps pourquoi. Le cas HTTP plus bas éprouve l'autre position. */
    for (const cle of ["wishlist.own", "reservation", "wall"]) {
      await db.prisma.featureFlag.update({ where: { key: cle }, data: { enabled: true } });
    }
    boite = new BoiteDeTest();
    listes = new WishlistService(db.prisma as never, SITE);
    publiques = new SharedWishlistService(
      db.prisma as never,
      new RateLimitService(db.prisma as never),
      new OtpService(db.prisma as never, PEPPER),
      boite,
    );
    awa = await compte("awa");
    bila = await compte("bila");
  });

  // ── Tenir sa liste ────────────────────────────────────────────────────────

  it("ouvre une liste sur une occasion à soi et y note un souhait", async () => {
    const o = await monOccasion(awa);
    const liste = await listes.create(awa, o);
    expect(wishlistSchema.safeParse(liste).success).toBe(true);
    expect(liste.wishCount).toBe(0);
    expect(liste.isShared).toBe(false);

    const souhait = await listes.createWish(awa, liste.id, {
      label: "Un moulin à café", price: 12000, currency: "XAF",
    });
    expect(ownerWishSchema.safeParse(souhait).success).toBe(true);
    // Public par défaut : la liste existe pour être partagée, et un souhait qui
    // naîtrait privé demanderait un geste de plus pour faire ce qu'on attendait.
    expect(souhait.isPublic).toBe(true);
    expect(souhait.status).toBe("available");
    expect(souhait.price).toBe(12000);
  });

  /* `OwnerWish` N'EST PAS `WishlistItem`. Ouvrir une liste sur l'anniversaire
     d'un proche publierait à des visiteurs ce que ce proche m'a confié en
     privé — c'est la confusion que le dictionnaire sépare, et elle a déjà coûté
     une correction. La garde ne peut pas se contenter de `user_id` sur
     l'occurrence : cette colonne vaut aussi pour l'anniversaire d'un proche. */
  it("refuse d'ouvrir une liste sur l'occasion d'un proche, pas seulement sur celle d'un autre compte", async () => {
    const duProche = await occasionDunProche(awa);
    await expect(listes.create(awa, duProche)).rejects.toMatchObject({ code: "not_found" });
    expect(await db.prisma.wishlist.count()).toBe(0);
  });

  it("n'ouvre pas deux listes sur la même occasion", async () => {
    const o = await monOccasion(awa);
    await listes.create(awa, o);
    await expect(listes.create(awa, o)).rejects.toMatchObject({ code: "conflict" });
  });

  /* L'ordre appartient au propriétaire : « il a rangé sa liste ; la page
     respecte ce rangement ». `nulls: "last"` est le piège — sans lui, Postgres
     remonte les souhaits non rangés EN TÊTE d'un tri croissant, et le rangement
     qu'on vient de faire paraît ignoré. */
  it("rend les souhaits dans l'ordre du propriétaire, les non rangés à la fin", async () => {
    const o = await monOccasion(awa);
    const liste = await listes.create(awa, o);
    await listes.createWish(awa, liste.id, { label: "sans rang" });
    await listes.createWish(awa, liste.id, { label: "second", position: 2 });
    await listes.createWish(awa, liste.id, { label: "premier", position: 1 });

    expect((await listes.listWishes(awa, liste.id)).map((s) => s.label))
      .toEqual(["premier", "second", "sans rang"]);
  });

  // ── Le cloisonnement ──────────────────────────────────────────────────────

  /* 404 avant de lire, jamais une liste vide. Une liste vide serait
     indiscernable d'une liste à soi sans souhait, et l'identifiant deviendrait
     un oracle : on saurait qu'une liste existe ailleurs en l'essayant. */
  it("ne laisse pas deviner la liste d'un autre compte par une liste vide", async () => {
    const { listeId } = await listePartagee(bila);
    await expect(listes.listWishes(awa, listeId)).rejects.toMatchObject({ code: "not_found" });
    await expect(listes.createWish(awa, listeId, { label: "intrus" }))
      .rejects.toMatchObject({ code: "not_found" });
    await expect(listes.share(awa, listeId)).rejects.toMatchObject({ code: "not_found" });
    await expect(listes.revokeShare(awa, listeId)).rejects.toMatchObject({ code: "not_found" });
  });

  it("ne corrige ni ne retire le souhait d'un autre compte, et ne dit pas qu'il existe", async () => {
    const { souhaitId } = await listePartagee(bila);
    await expect(listes.updateWish(awa, souhaitId, { label: "détourné" }))
      .rejects.toMatchObject({ code: "not_found" });
    await expect(listes.removeWish(awa, souhaitId)).rejects.toMatchObject({ code: "not_found" });
    const ligne = await db.prisma.ownerWish.findUniqueOrThrow({ where: { id: souhaitId } });
    expect(ligne.label).toBe("Un moulin à café");
  });

  // ── Le partage ────────────────────────────────────────────────────────────

  /* IDEMPOTENT. Frapper un jeton neuf à chaque appel ferait cesser de valoir
     l'adresse qu'on vient de coller dans un groupe, au premier réappui sur
     « Partager » — et personne ne comprendrait pourquoi. */
  it("rend le même lien à chaque partage", async () => {
    const o = await monOccasion(awa);
    const liste = await listes.create(awa, o);
    const un = await listes.share(awa, liste.id);
    const deux = await listes.share(awa, liste.id);
    expect(deux.token).toBe(un.token);
    expect(un.url).toBe(`${SITE}/l/${un.token}`);
  });

  /* UN LIEN MORT DOIT LE DIRE. La ligne révoquée survit pour ça : un `404` sur
     un lien qu'on tient dans la main donne à croire à une panne, et on
     réessaie. Un jeton jamais frappé, lui, rend bien 404 — dire « révoqué »
     apprendrait qu'il a un jour été valide. */
  it("dit qu'un lien révoqué l'est, et rend 404 sur un jeton qui n'a jamais existé", async () => {
    const { listeId, token } = await listePartagee(awa);
    expect((await publiques.voir(token)).state).toBe("ok");

    await listes.revokeShare(awa, listeId);
    expect(await publiques.voir(token)).toEqual({ state: "revoked" });

    await expect(publiques.voir("jetonquinajamaisexiste")).rejects.toMatchObject({ code: "not_found" });
    // Et la liste le signale au propriétaire : l'écran repropose de partager.
    expect((await listes.list(awa))[0]?.isShared).toBe(false);
  });

  // Le lien révoqué reste mort après un nouveau partage : c'est tout l'intérêt
  // de la révocation. Un jeton neuf est frappé, l'ancien ne ressuscite pas.
  it("ne ressuscite pas un lien révoqué en repartageant", async () => {
    const { listeId, token } = await listePartagee(awa);
    await listes.revokeShare(awa, listeId);
    const neuf = await listes.share(awa, listeId);
    expect(neuf.token).not.toBe(token);
    expect(await publiques.voir(token)).toEqual({ state: "revoked" });
    expect((await publiques.voir(neuf.token)).state).toBe("ok");
  });

  // ── Ce que le visiteur voit ───────────────────────────────────────────────

  it("montre la liste partagée à un visiteur sans compte", async () => {
    const { listeId, token } = await listePartagee(awa);
    await listes.createWish(awa, listeId, { label: "Un carnet", isPublic: false });

    const vue = await publiques.voir(token);
    expect(sharedWishlistSchema.safeParse(vue).success).toBe(true);
    if (vue.state !== "ok") throw new Error("état inattendu");
    expect(vue.ownerFirstName).toBe("Moi");
    expect(vue.acceptsReservations).toBe(true);
    // Le souhait gardé pour soi ne transite pas, même pour être écarté au rendu.
    expect(vue.wishes.map((s) => s.label)).toEqual(["Un moulin à café"]);
  });

  /* « Liste dont l'occasion est passée : elle s'affiche, sans accepter de
     réservation. » Calculé au SERVEUR — deux versions du parc et deux fuseaux
     donneraient deux réponses sur la même liste. */
  it("affiche une liste dont l'occasion est passée sans accepter de réservation", async () => {
    const { token, souhaitId } = await listePartagee(awa, -10);
    const vue = await publiques.voir(token);
    if (vue.state !== "ok") throw new Error("état inattendu");
    expect(vue.acceptsReservations).toBe(false);
    expect(vue.wishes).toHaveLength(1);

    await expect(publiques.reserver(souhaitId, { email: "kine@example.com" }, {}))
      .rejects.toMatchObject({ code: "resource_inactive" });
  });

  // ── La réservation ────────────────────────────────────────────────────────

  it("réserve en deux temps : un code, puis la confirmation", async () => {
    const { token, souhaitId } = await listePartagee(awa);
    const debut = await publiques.reserver(souhaitId, {
      email: "kine@example.com", displayName: "Kiné", showIdentity: true,
    }, {});
    expect(debut.state).toBe("code_sent");

    /* TANT QUE LA DEMANDE EST EN ATTENTE, LE CADEAU RESTE DISPONIBLE. Sans
       cette règle, une adresse inventée suffirait à bloquer un cadeau jusqu'à
       l'expiration — et c'est la raison pour laquelle l'index unique ne porte
       que sur `confirmed`. */
    const pendant = await publiques.voir(token);
    if (pendant.state !== "ok") throw new Error("état inattendu");
    expect(pendant.wishes[0]?.isReserved).toBe(false);

    const confirmee = await publiques.verifier(souhaitId, {
      email: "kine@example.com", code: boite.dernierCode(),
    });
    expect(confirmee.sessionToken).toHaveLength(64);

    const apres = await publiques.voir(token);
    if (apres.state !== "ok") throw new Error("état inattendu");
    expect(apres.wishes[0]?.isReserved).toBe(true);
    // Le statut du souhait est DÉRIVÉ ici, nulle part ailleurs.
    expect((await db.prisma.ownerWish.findUniqueOrThrow({ where: { id: souhaitId } })).status)
      .toBe("reserved");
  });

  /* LA GARANTIE VIENT DE LA BASE, jamais d'une lecture préalable. Deux
     confirmations successives suffisent à l'éprouver : la seconde se heurte à
     l'index unique partiel, et non à un `if` que deux appels simultanés
     franchiraient tous les deux. Éprouver par deux requêtes concurrentes
     donnerait un test qui ne mord qu'une fois sur deux — pire qu'absent, parce
     qu'il passerait en intégration continue en cachant la régression. */
  it("ne laisse pas deux visiteurs réserver le même souhait", async () => {
    const { souhaitId } = await listePartagee(awa);

    await publiques.reserver(souhaitId, { email: "kine@example.com" }, {});
    const codeKine = boite.dernierCode();
    await publiques.reserver(souhaitId, { email: "fatou@example.com" }, {});
    const codeFatou = boite.dernierCode();
    // Deux demandes en attente COEXISTENT : c'est voulu, la première confirmée
    // l'emporte.
    expect(await db.prisma.wishReservation.count({ where: { status: "pending" } })).toBe(2);

    await publiques.verifier(souhaitId, { email: "kine@example.com", code: codeKine });

    await expect(publiques.verifier(souhaitId, { email: "fatou@example.com", code: codeFatou }))
      /* `conflict`, pas une erreur de code : dire « code invalide » ferait
         croire à Fatou qu'elle a mal recopié, et elle recommencerait. */
      .rejects.toMatchObject({ code: "conflict" });

    // « La demande en attente est signalée comme caduque. »
    const fatou = await db.prisma.wishReservation.findFirstOrThrow({
      where: { email: "fatou@example.com" },
    });
    expect(fatou.status).toBe("expired");
    expect(await db.prisma.wishReservation.count({ where: { status: "confirmed" } })).toBe(1);
  });

  // La contrainte est en BASE : elle tient même si un jour du code contourne le
  // service. C'est ce qui la distingue d'un invariant écrit en TypeScript.
  it("refuse en base une seconde réservation confirmée sur le même souhait", async () => {
    const { souhaitId } = await listePartagee(awa);
    const ligne = { ownerWishId: souhaitId, status: "confirmed" as const, expiresAt: new Date() };
    await db.prisma.wishReservation.create({ data: { ...ligne, email: "kine@example.com" } });
    await expect(
      db.prisma.wishReservation.create({ data: { ...ligne, email: "fatou@example.com" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  /* LA VRAIE COURSE, jouée sans concurrence.
     Le cas ci-dessus passe par le service, qui périme les demandes en attente
     dès qu'une confirmation aboutit : Fatou est alors arrêtée AVANT d'atteindre
     l'index. C'est bien, mais ça n'éprouve pas l'index — et c'est lui qui doit
     tenir le jour où deux confirmations tombent dans le même millier de
     microsecondes, aucune n'ayant encore périmé l'autre.

     On reproduit donc cet état exact — une confirmation écrite sans passer par
     le service, la demande de Fatou toujours en attente — puis on la fait
     confirmer. Deux écritures successives suffisent à prouver l'unicité ; deux
     requêtes concurrentes donneraient un test qui ne mord qu'une fois sur
     deux, et un tel test est pire qu'absent — il passe en intégration continue
     en cachant la régression. */
  it("laisse la base trancher quand deux confirmations se croisent avant toute péremption", async () => {
    const { souhaitId } = await listePartagee(awa);
    await publiques.reserver(souhaitId, { email: "fatou@example.com" }, {});
    const codeFatou = boite.dernierCode();

    // La confirmation de Kiné, écrite DIRECTEMENT : le service n'intervient
    // pas, donc la demande de Fatou reste en attente, exactement comme si les
    // deux étaient arrivées en même temps.
    await db.prisma.wishReservation.create({
      data: {
        ownerWishId: souhaitId, email: "kine@example.com",
        status: "confirmed", confirmedAt: new Date(), expiresAt: new Date(),
      },
    });

    await expect(publiques.verifier(souhaitId, { email: "fatou@example.com", code: codeFatou }))
      .rejects.toMatchObject({ code: "conflict" });

    expect(await db.prisma.wishReservation.count({ where: { status: "confirmed" } })).toBe(1);
    const fatou = await db.prisma.wishReservation.findFirstOrThrow({
      where: { email: "fatou@example.com" },
    });
    expect(fatou.status).toBe("expired");
  });

  it("refuse un code expiré", async () => {
    const { souhaitId } = await listePartagee(awa);
    await publiques.reserver(souhaitId, { email: "kine@example.com" }, {});
    const code = boite.dernierCode();

    await db.prisma.wishReservation.updateMany({
      where: { email: "kine@example.com" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(publiques.verifier(souhaitId, { email: "kine@example.com", code }))
      .rejects.toMatchObject({ code: "otp_expired" });
    expect(await db.prisma.wishReservation.count({ where: { status: "confirmed" } })).toBe(0);
  });

  /* UN CODE NE SE REJOUE PAS. Le rejeu se ferme par la condition
     `status: "pending"` dans le WHERE de l'écriture, pas par une relecture :
     deux appels avec le même bon code liraient tous deux « en attente » avant
     que l'un n'écrive. */
  it("ne rejoue pas un code déjà consommé", async () => {
    const { souhaitId } = await listePartagee(awa);
    await publiques.reserver(souhaitId, { email: "kine@example.com" }, {});
    const code = boite.dernierCode();
    await publiques.verifier(souhaitId, { email: "kine@example.com", code });

    await expect(publiques.verifier(souhaitId, { email: "kine@example.com", code }))
      .rejects.toMatchObject({ code: "otp_invalid" });
    // Le condensé du code est effacé à la confirmation : il n'y a même plus rien
    // à comparer.
    const ligne = await db.prisma.wishReservation.findFirstOrThrow({
      where: { email: "kine@example.com" },
    });
    expect(ligne.codeHash).toBeNull();
  });

  // Le plafond de tentatives brûle le code. Le compteur est incrémenté par une
  // écriture conditionnelle : une rafale ne peut pas le dépasser.
  it("brûle le code au bout de cinq essais", async () => {
    const { souhaitId } = await listePartagee(awa);
    await publiques.reserver(souhaitId, { email: "kine@example.com" }, {});
    for (let i = 0; i < 5; i += 1) {
      await expect(publiques.verifier(souhaitId, { email: "kine@example.com", code: "000000" }))
        .rejects.toMatchObject({ code: "otp_invalid" });
    }
    await expect(publiques.verifier(souhaitId, { email: "kine@example.com", code: "000000" }))
      .rejects.toMatchObject({ code: "otp_too_many_attempts" });
  });

  // Une demande neuve périme la précédente : sinon plusieurs codes vivent en
  // parallèle et le plafond de tentatives se contourne en en redemandant un.
  it("périme le code précédent quand on en redemande un", async () => {
    const { souhaitId } = await listePartagee(awa);
    await publiques.reserver(souhaitId, { email: "kine@example.com" }, {});
    const ancien = boite.dernierCode();
    await publiques.reserver(souhaitId, { email: "kine@example.com" }, {});

    await expect(publiques.verifier(souhaitId, { email: "kine@example.com", code: ancien }))
      .rejects.toMatchObject({ code: "otp_invalid" });
    await expect(publiques.verifier(souhaitId, { email: "kine@example.com", code: boite.dernierCode() }))
      .resolves.toMatchObject({ wishId: souhaitId });
  });

  it("refuse une adresse jetable, partout où une adresse entre", async () => {
    const { souhaitId } = await listePartagee(awa);
    await expect(publiques.reserver(souhaitId, { email: "kine@mailinator.com" }, {}))
      .rejects.toMatchObject({ code: "email_disposable" });
  });

  /* UN SEUL code pour les deux filtres à robots. Deux libellés distincts
     diraient au robot lequel a mordu — `AppError.toEnvelope` renvoie le message
     tel quel —, et il s'ajusterait. */
  it("écarte le champ leurre et le délai invraisemblable sous le même code", async () => {
    const { souhaitId } = await listePartagee(awa);
    const leurre = await publiques.reserver(souhaitId, {
      email: "kine@example.com", website: "http://spam",
    }, {}).catch((e: unknown) => e);
    const trop_vite = await publiques.reserver(souhaitId, {
      email: "kine@example.com", renderedAt: Date.now(),
    }, {}).catch((e: unknown) => e);

    expect(leurre).toMatchObject({ code: "reservation_rejected" });
    expect(trop_vite).toMatchObject({ code: "reservation_rejected" });
    expect((leurre as Error).message).toBe((trop_vite as Error).message);
  });

  // Un utilisateur connecté réserve EN UN GESTE : son adresse est déjà vérifiée
  // par son compte, aucun code ne part.
  it("laisse un utilisateur connecté réserver sans code", async () => {
    const { souhaitId } = await listePartagee(awa);
    const issue = await publiques.reserver(souhaitId, {}, {
      userId: bila, email: "bila@example.com",
    });
    expect(issue.state).toBe("confirmed");
    expect(boite.envois).toHaveLength(0);
    expect((await listes.myReservations(bila))[0]?.wishId).toBe(souhaitId);
  });

  /* « Les réservations faites sans compte, avant de s'inscrire, rejoignent cet
     écran dès que l'adresse coïncide » : c'est l'adresse qui fait l'identité,
     le jeton n'étant qu'un raccourci de navigateur. */
  it("rattache à un compte les réservations faites avant l'inscription, par l'adresse", async () => {
    const { souhaitId } = await listePartagee(awa);
    await publiques.reserver(souhaitId, { email: "bila@example.com" }, {});
    await publiques.verifier(souhaitId, { email: "bila@example.com", code: boite.dernierCode() });

    const miennes = await listes.myReservations(bila);
    expect(miennes.map((r) => r.wishId)).toEqual([souhaitId]);
    expect(miennes[0]?.ownerUsername).toBe("awa");
  });

  /* Le visiteur revenu retrouve LES SIENS, et ceux-là seulement. On remonte du
     jeton à l'adresse : le jeton est unique par réservation, s'en tenir à lui
     ne signalerait que le dernier cadeau pris. */
  it("signale au visiteur revenu ses propres réservations, et seulement les siennes", async () => {
    const { listeId, token, souhaitId } = await listePartagee(awa);
    const second = await listes.createWish(awa, listeId, { label: "Un carnet" });
    const troisieme = await listes.createWish(awa, listeId, { label: "Une écharpe" });

    await publiques.reserver(souhaitId, { email: "kine@example.com" }, {});
    const un = await publiques.verifier(souhaitId, {
      email: "kine@example.com", code: boite.dernierCode(),
    });
    await publiques.reserver(second.id, { email: "kine@example.com" }, {});
    await publiques.verifier(second.id, { email: "kine@example.com", code: boite.dernierCode() });
    await publiques.reserver(troisieme.id, { email: "fatou@example.com" }, {});
    await publiques.verifier(troisieme.id, { email: "fatou@example.com", code: boite.dernierCode() });

    const avecJeton = await publiques.voir(token, { jetonVisite: un.sessionToken });
    if (avecJeton.state !== "ok") throw new Error("état inattendu");
    const miens = avecJeton.wishes.filter((s) => s.reservedByMe).map((s) => s.label);
    expect(miens.sort()).toEqual(["Un carnet", "Un moulin à café"]);

    // Un visiteur quelconque n'en repère aucun, alors qu'il voit bien que les
    // trois sont réservés.
    const anonyme = await publiques.voir(token);
    if (anonyme.state !== "ok") throw new Error("état inattendu");
    expect(anonyme.wishes.every((s) => s.isReserved)).toBe(true);
    expect(anonyme.wishes.some((s) => s.reservedByMe)).toBe(false);
  });

  // ── LE PIÈGE : ce que le propriétaire ne doit PAS voir ────────────────────

  /* Le plus coûteux du lot, parce qu'il ne se voit qu'à l'usage — et qu'alors
     la surprise est déjà gâchée.
     Le propriétaire apprend QU'un cadeau est réservé, et le nom du réservant
     SEULEMENT si celui-ci l'a autorisé. Rien d'autre ne doit sortir : ni
     l'adresse, ni l'identifiant de compte, ni l'instant — recoupés avec un Mur
     ou une liste d'amis, ils désignent la personne aussi sûrement qu'un nom. */
  it("ne montre au propriétaire ni l'adresse ni le nom d'un réservant resté anonyme", async () => {
    const { listeId, souhaitId } = await listePartagee(awa);
    await publiques.reserver(souhaitId, {
      email: "kine@example.com", displayName: "Kiné", showIdentity: false,
    }, {});
    await publiques.verifier(souhaitId, { email: "kine@example.com", code: boite.dernierCode() });

    const souhaits = await listes.listWishes(awa, listeId);
    expect(souhaits[0]?.status).toBe("reserved");
    expect(souhaits[0]?.reservedByName).toBeNull();

    // Aucune trace de l'adresse ni du nom dans TOUTE la réponse : c'est la
    // sérialisation entière qu'on inspecte, pas les seuls champs qu'on pensait
    // à regarder.
    const rendu = JSON.stringify(souhaits);
    expect(rendu).not.toContain("kine@example.com");
    expect(rendu).not.toContain("Kiné");

    // Le nom n'est même pas RETENU quand il n'a pas été autorisé : le garder
    // serait conserver une donnée dont on s'est engagé à ne rien faire.
    const ligne = await db.prisma.wishReservation.findFirstOrThrow({
      where: { ownerWishId: souhaitId },
    });
    expect(ligne.displayName).toBeNull();
  });

  /* LA MÊME GARDE, AU RENDU, et il en faut deux.
     La première ne retient pas le nom sans autorisation ; celle-ci refuse de le
     rendre même s'il est là. Poser la ligne à la main est exactement ce que
     ferait un chemin d'écriture futur — une reprise de données, une correction
     d'administration —, et c'est le jour où quelqu'un remplace la recopie
     champ par champ par un `...ligne` que la seconde garde compte. Sans ce cas,
     on peut la casser sans qu'aucun test ne tombe : c'est vérifié. */
  it("refuse de rendre un nom présent en base mais non autorisé", async () => {
    const { listeId, souhaitId } = await listePartagee(awa);
    await db.prisma.wishReservation.create({
      data: {
        ownerWishId: souhaitId, email: "kine@example.com",
        displayName: "Kiné", showIdentity: false,
        status: "confirmed", confirmedAt: new Date(), expiresAt: new Date(),
      },
    });
    await db.prisma.ownerWish.update({
      where: { id: souhaitId }, data: { status: "reserved" },
    });

    const souhaits = await listes.listWishes(awa, listeId);
    expect(souhaits[0]?.status).toBe("reserved");
    expect(souhaits[0]?.reservedByName).toBeNull();
    expect(JSON.stringify(souhaits)).not.toContain("Kiné");
  });

  it("montre le nom au propriétaire lorsque le réservant l'a autorisé", async () => {
    const { listeId, souhaitId } = await listePartagee(awa);
    await publiques.reserver(souhaitId, {
      email: "kine@example.com", displayName: "Kiné", showIdentity: true,
    }, {});
    await publiques.verifier(souhaitId, { email: "kine@example.com", code: boite.dernierCode() });

    const souhaits = await listes.listWishes(awa, listeId);
    expect(souhaits[0]?.reservedByName).toBe("Kiné");
    // L'adresse, elle, ne sort jamais — autorisation ou pas.
    expect(JSON.stringify(souhaits)).not.toContain("kine@example.com");
  });

  /* La notification dit QUE quelqu'un a réservé. Elle ne nomme l'anonyme sous
     aucun prétexte : elle s'affiche sans qu'on l'ait demandée, donc elle
     gâcherait la surprise plus sûrement qu'un écran qu'on ouvre. */
  it("prévient le propriétaire sans nommer un réservant resté anonyme", async () => {
    const { souhaitId } = await listePartagee(awa);
    await publiques.reserver(souhaitId, {
      email: "kine@example.com", displayName: "Kiné", showIdentity: false,
    }, {});
    await publiques.verifier(souhaitId, { email: "kine@example.com", code: boite.dernierCode() });

    const n = await db.prisma.notification.findFirstOrThrow({ where: { userId: awa } });
    expect(n.type).toBe("wish_reserved");
    /* La CLÉ, et pas seulement la nature : elles se ressemblent, et c'est ce
       qui a laissé passer une clé sans son préfixe `notification.`. Un client
       qui résout ses libellés par préfixe ne l'aurait jamais trouvée, et rien
       ici ne le disait. */
    expect(n.titleKey).toBe("notification.wish_reserved");
    expect(JSON.stringify(n.bodyParams)).not.toContain("Kiné");
    expect(JSON.stringify(n.bodyParams)).toContain("Un moulin à café");
  });

  /* Un souhait réservé ne redevient pas disponible d'un PATCH : quelqu'un s'est
     engagé à l'offrir et a reçu confirmation. Le libérer le laisserait réserver
     une seconde fois, et deux personnes offriraient la même chose — ce que tout
     ce mécanisme existe pour éviter. */
  it("ne laisse pas le propriétaire libérer un souhait réservé", async () => {
    const { souhaitId } = await listePartagee(awa);
    await publiques.reserver(souhaitId, { email: "kine@example.com" }, {});
    await publiques.verifier(souhaitId, { email: "kine@example.com", code: boite.dernierCode() });

    await expect(listes.updateWish(awa, souhaitId, { status: "available" }))
      .rejects.toMatchObject({ code: "conflict" });
    // Le déclarer offert reste sa décision, elle.
    await expect(listes.updateWish(awa, souhaitId, { status: "fulfilled" }))
      .resolves.toMatchObject({ status: "fulfilled" });
  });

  /* L'invariant « un prix porte sa devise » appartient à l'ÉTAT FINAL, pas au
     message : un PATCH { currency: null } traverse le schéma sans encombre — il
     ne porte aucun prix — et laisserait un souhait à 12 000 sans dire de quoi
     sur une page que des visiteurs lisent. */
  it("refuse de retirer la devise d'un souhait qui garde son prix", async () => {
    const { listeId } = await listePartagee(awa);
    const s = await listes.createWish(awa, listeId, {
      label: "Un moulin", price: 12000, currency: "XAF",
    });
    await expect(listes.updateWish(awa, s.id, { currency: null }))
      .rejects.toMatchObject({ code: "validation_failed" });
    await expect(listes.updateWish(awa, s.id, { price: null, currency: null }))
      .resolves.toMatchObject({ price: null });
  });

  // ── Par HTTP : les drapeaux, l'authentification, les statuts ──────────────

  describe("par HTTP", () => {
    let app: INestApplication;
    let baseUrl: string;
    let precedent: Record<string, string | undefined>;

    beforeAll(async () => {
      precedent = {
        DATABASE_URL: process.env.DATABASE_URL,
        OTP_PEPPER: process.env.OTP_PEPPER,
        JWT_SECRET: process.env.JWT_SECRET,
        ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
        LEHNO_MAIL_CONSOLE: process.env.LEHNO_MAIL_CONSOLE,
        PUBLIC_WEB_URL: process.env.PUBLIC_WEB_URL,
      };
      process.env.DATABASE_URL = db.url;
      process.env.OTP_PEPPER = PEPPER;
      process.env.JWT_SECRET = SECRET;
      process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
      process.env.LEHNO_MAIL_CONSOLE = "1";
      process.env.PUBLIC_WEB_URL = SITE;

      app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
      app.setGlobalPrefix("v1");
      app.useGlobalFilters(new AppExceptionFilter());
      await app.listen(0);
      baseUrl = await app.getUrl();
    }, 120_000);

    afterAll(async () => {
      await app.close();
      for (const [cle, valeur] of Object.entries(precedent)) {
        if (valeur === undefined) delete process.env[cle];
        else process.env[cle] = valeur;
      }
    });

    const jeton = (userId: string): string =>
      jwt.sign({ sub: userId }, SECRET, { algorithm: "HS256", expiresIn: 900 });

    it("ouvre une liste par HTTP et rend 201", async () => {
      const o = await monOccasion(awa);
      const r = await fetch(`${baseUrl}/v1/me/wishlists`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        body: JSON.stringify({ occurrenceId: o }),
      });
      expect(r.status).toBe(201);
    });

    it("rend 404 sur la liste d'un autre compte, jamais 403", async () => {
      const { listeId } = await listePartagee(bila);
      const r = await fetch(`${baseUrl}/v1/me/wishlists/${listeId}/wishes`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(404);
    });

    /* La page publique n'exige AUCUNE session : c'est tout son objet. Un 401
       ici la fermerait à ceux pour qui elle existe. */
    it("sert la liste partagée sans le moindre jeton", async () => {
      const { token } = await listePartagee(awa);
      const r = await fetch(`${baseUrl}/v1/public/wishlists/${token}`);
      expect(r.status).toBe(200);
      expect((await r.json() as { state: string }).state).toBe("ok");
    });

    /* Un lien révoqué rend 200 avec son ÉTAT, pas 404 : « ce lien n'est plus
       actif » plutôt que « cette page n'existe pas ». Le second ferait croire à
       une panne à quelqu'un qui tient le lien. */
    it("rend 200 et l'état « revoked » sur un lien révoqué", async () => {
      const { listeId, token } = await listePartagee(awa);
      await listes.revokeShare(awa, listeId);
      const r = await fetch(`${baseUrl}/v1/public/wishlists/${token}`);
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ state: "revoked" });
    });

    it("refuse un appel sans jeton sur mes listes", async () => {
      const r = await fetch(`${baseUrl}/v1/me/wishlists`);
      expect(r.status).toBe(401);
    });

    /* LE cas du drapeau, et il y a deux choses dedans.
     *
     * `404` et non `403` : un `403` distinguerait « éteinte » de « refusée » et
     * révélerait ainsi que la surface existe (§6.2).
     *
     * ET SANS JETON AUSSI : le garde de drapeau passe AVANT celui
     * d'authentification. Dans l'autre ordre, l'appel sans jeton rendrait 401
     * des deux côtés — mais l'appel AVEC jeton rendrait 404 d'un côté et 200 de
     * l'autre, ce qui suffit à savoir. Le sans-jeton prouve l'ordre des gardes. */
    it("rend 404 partout quand wishlist.own est éteint, jeton ou pas — page publique comprise", async () => {
      const { listeId, token, souhaitId } = await listePartagee(awa);
      await db.prisma.featureFlag.update({ where: { key: "wishlist.own" }, data: { enabled: false } });
      try {
        const entete = { authorization: `Bearer ${jeton(awa)}`, "content-type": "application/json" };
        const appels = [
          fetch(`${baseUrl}/v1/me/wishlists`, { headers: entete }),
          fetch(`${baseUrl}/v1/me/wishlists/${listeId}/wishes`, { headers: entete }),
          fetch(`${baseUrl}/v1/me/wishlists/${listeId}/share`, { headers: entete }),
          fetch(`${baseUrl}/v1/me/owner-wishes/${souhaitId}`, { method: "DELETE", headers: entete }),
          // La page publique s'éteint avec le reste : elle est sous le même
          // drapeau, et la laisser ouverte publierait ce qu'on vient de fermer.
          fetch(`${baseUrl}/v1/public/wishlists/${token}`),
          // Sans jeton : c'est ce cas qui prouve que FeatureGuard passe avant
          // AuthGuard. Un 401 ici dirait que la surface existe.
          fetch(`${baseUrl}/v1/me/wishlists`),
        ];
        for (const r of await Promise.all(appels)) expect(r.status).toBe(404);

        /* ET LA RÉSERVATION TOMBE AVEC : `reservation` requiert
           `wishlist.own`, et la résolution se fait côté serveur — le client n'a
           aucune règle de dépendance à connaître. */
        const reserve = await fetch(`${baseUrl}/v1/public/owner-wishes/${souhaitId}/reserve`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "kine@example.com" }),
        });
        expect(reserve.status).toBe(404);
        const mesReservations = await fetch(`${baseUrl}/v1/me/reservations`, { headers: entete });
        expect(mesReservations.status).toBe(404);

        // Et rien n'a été écrit : un drapeau éteint ferme la porte, il ne
        // laisse pas passer l'écriture en taisant la réponse.
        expect(await db.prisma.wishReservation.count()).toBe(0);
      } finally {
        await db.prisma.featureFlag.update({ where: { key: "wishlist.own" }, data: { enabled: true } });
      }
    });

    /* L'inverse, qui compte autant : éteindre la seule réservation laisse la
       liste et son partage debout. On peut donc livrer les listes sans le geste
       de réservation — c'est la position que le produit doit pouvoir tenir. */
    it("laisse listes et partage debout quand seule la réservation est éteinte", async () => {
      const { listeId, token, souhaitId } = await listePartagee(awa);
      await db.prisma.featureFlag.update({ where: { key: "reservation" }, data: { enabled: false } });
      try {
        const entete = { authorization: `Bearer ${jeton(awa)}` };
        expect((await fetch(`${baseUrl}/v1/me/wishlists/${listeId}/share`, { headers: entete })).status).toBe(200);
        expect((await fetch(`${baseUrl}/v1/public/wishlists/${token}`)).status).toBe(200);
        const reserve = await fetch(`${baseUrl}/v1/public/owner-wishes/${souhaitId}/reserve`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "kine@example.com" }),
        });
        expect(reserve.status).toBe(404);
      } finally {
        await db.prisma.featureFlag.update({ where: { key: "reservation" }, data: { enabled: true } });
      }
    });

    it("rend 204 sur la révocation d'un partage", async () => {
      const { listeId } = await listePartagee(awa);
      const r = await fetch(`${baseUrl}/v1/me/wishlists/${listeId}/share`, {
        method: "DELETE", headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(204);
    });

    it("rend 409 sur un cadeau déjà réservé", async () => {
      const { souhaitId } = await listePartagee(awa);
      await db.prisma.wishReservation.create({
        data: {
          ownerWishId: souhaitId, email: "kine@example.com",
          status: "confirmed", expiresAt: new Date(),
        },
      });
      const r = await fetch(`${baseUrl}/v1/public/owner-wishes/${souhaitId}/reserve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "fatou@example.com" }),
      });
      expect(r.status).toBe(409);
    });

    // Un visiteur sans compte doit donner son adresse ; le schéma la laisse
    // facultative parce que la règle dépend de la session, que lui seul connaît.
    it("refuse une réservation sans adresse quand personne n'est connecté", async () => {
      const { souhaitId } = await listePartagee(awa);
      const r = await fetch(`${baseUrl}/v1/public/owner-wishes/${souhaitId}/reserve`, {
        method: "POST", headers: { "content-type": "application/json" }, body: "{}",
      });
      expect(r.status).toBe(400);
    });
  });
});
