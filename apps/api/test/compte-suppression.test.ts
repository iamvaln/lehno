import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AccountService } from "../src/me/account.service.js";
import { OtpService } from "../src/auth/otp.service.js";
import { TokenService } from "../src/auth/token.service.js";

const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SUPPORT = "hello@lehno.app";
const JOUR = 24 * 60 * 60_000;

/* La suppression du compte — maquette §3.24, CGU §6.
 *
 * Le geste le plus destructeur du produit, et celui qu'Apple exige. Chaque cas
 * ci-dessous garde une manière précise dont il pourrait mal tourner.
 */
describe("suppression du compte", () => {
  let db: TestDb;
  let account: AccountService;
  let otp: OtpService;
  let tokens: TokenService;
  let userId: string;
  let autreUserId: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    otp = new OtpService(db.prisma as never, PEPPER);
    tokens = new TokenService(db.prisma as never, SECRET);
    account = new AccountService(db.prisma as never, otp, tokens, SUPPORT);

    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1" },
    });
    userId = u.id;
    const autre = await db.prisma.user.create({
      data: { email: "karim@example.com", username: "karim", referralCode: "KAR1" },
    });
    autreUserId = autre.id;
  });

  /** Le parcours complet, jusqu'au code valide en main. */
  async function confirmerAvecCodeValide(extra: Record<string, unknown> = {}) {
    const { code } = await account.demanderCode(userId);
    return account.confirmer(userId, { username: "awa", code, ...extra } as never);
  }

  describe("l'aperçu, premier et deuxième temps", () => {
    it("compte ce qui disparaîtrait, sans rien toucher", async () => {
      const p = await db.prisma.person.create({ data: { userId, displayName: "Maman" } });
      await db.prisma.note.create({ data: { personId: p.id, content: "aime le jasmin" } });

      const apercu = await account.apercu(userId);

      expect(apercu.impact.persons).toBe(1);
      expect(apercu.impact.notes).toBe(1);
      // Rien n'a bougé : l'aperçu se consulte et se referme.
      expect((await db.prisma.user.findUniqueOrThrow({ where: { id: userId } })).status).toBe("active");
    });

    /* Le piège gardé : ouvrir l'écran de suppression enverrait un code par
       e-mail. §3.24 fait de l'aperçu un temps à part, qu'on doit pouvoir lire
       et quitter — arroser la boîte de quelqu'un qui regarde n'est pas un
       geste neutre. */
    it("n'émet aucun code : le regarder n'est pas le demander", async () => {
      await account.apercu(userId);
      expect(await db.prisma.otpCode.count({ where: { reason: "account_deletion" } })).toBe(0);
    });

    /* Le piège gardé : annoncer le solde ENTIER comme remboursable. Les CGU §6
       ne promettent que les crédits achetés ; les offerts n'ont pas été payés
       et ne se remboursent pas. Confondre les deux, c'est promettre de
       l'argent qu'on ne doit pas. */
    it("distingue le solde entier de sa part achetée", async () => {
      await db.prisma.creditTransaction.createMany({
        data: [
          { userId, type: "grant", source: "signup_grant", amount: 5 },
          { userId, type: "purchase", source: "purchase", amount: 100 },
        ],
      });

      const { refund } = await account.apercu(userId);
      expect(refund.balance).toBe(105);
      expect(refund.refundable).toBe(100);
    });

    /* Le piège gardé : proposer une méthode qui ne réunit pas les deux
       conditions des CGU §6. L'écran la présenterait comme une destination
       valable, et le remboursement serait refusé après coup — ou pire, versé. */
    it("n'offre que les méthodes qui réunissent les deux conditions", async () => {
      await db.prisma.creditTransaction.create({
        data: { userId, type: "purchase", source: "purchase", amount: 100 },
      });
      // Ancienne, mais jamais servie.
      await db.prisma.paymentMethod.create({
        data: {
          userId, kind: "mobile_money", brand: "MTN MoMo", last4: "4321",
          createdAt: new Date(Date.now() - 90 * JOUR),
        },
      });
      // A servi, mais enregistrée hier.
      await db.prisma.paymentMethod.create({
        data: {
          userId, kind: "card", brand: "Visa", last4: "1111",
          createdAt: new Date(Date.now() - JOUR),
          firstSuccessfulPaymentAt: new Date(Date.now() - JOUR),
        },
      });

      const { refund } = await account.apercu(userId);
      expect(refund.eligibleMethods).toHaveLength(0);
    });

    it("propose une méthode ancienne qui a déjà servi", async () => {
      const m = await db.prisma.paymentMethod.create({
        data: {
          userId, kind: "mobile_money", brand: "Orange Money", last4: "7788",
          createdAt: new Date(Date.now() - 90 * JOUR),
          firstSuccessfulPaymentAt: new Date(Date.now() - 60 * JOUR),
        },
      });

      const { refund } = await account.apercu(userId);
      expect(refund.eligibleMethods.map((x) => x.id)).toEqual([m.id]);
    });

    /* Le piège gardé : la méthode d'un AUTRE compte proposée comme
       destination. Ce serait un virement vers un tiers, décidé par le
       cloisonnement plutôt que par la personne. */
    it("ne propose jamais la méthode de paiement d'un autre compte", async () => {
      await db.prisma.paymentMethod.create({
        data: {
          userId: autreUserId, kind: "card", brand: "Visa", last4: "9999",
          createdAt: new Date(Date.now() - 90 * JOUR),
          firstSuccessfulPaymentAt: new Date(Date.now() - 60 * JOUR),
        },
      });

      const { refund } = await account.apercu(userId);
      expect(refund.eligibleMethods).toHaveLength(0);
    });
  });

  describe("la confirmation, troisième temps", () => {
    /* Le piège gardé : un seul facteur. Le pseudo seul s'affiche à l'écran
       d'à côté ; le code seul ne prouve pas qu'on a compris ce qu'on efface. */
    it("refuse un pseudo qui ne correspond pas, même avec un code valide", async () => {
      const { code } = await account.demanderCode(userId);

      await expect(account.confirmer(userId, { username: "karim", code }))
        .rejects.toMatchObject({ code: "validation_failed" });
      expect((await db.prisma.user.findUniqueOrThrow({ where: { id: userId } })).status).toBe("active");
    });

    /* Le piège gardé, et il est subtil : vérifier le code AVANT le pseudo le
       brûlerait sur une faute de frappe qui n'a rien à voir avec la boîte
       mail, obligeant à en redemander un. L'ordre des deux vérifications est
       une décision, pas un hasard. */
    it("ne brûle pas le code quand c'est le pseudo qui est faux", async () => {
      const { code } = await account.demanderCode(userId);
      await expect(account.confirmer(userId, { username: "pas-moi", code })).rejects.toThrow();

      // Le même code doit encore valoir.
      const accepte = await account.confirmer(userId, { username: "awa", code });
      expect(accepte.requestedAt).toBeDefined();
    });

    it("refuse un code invalide, même avec le bon pseudo", async () => {
      await account.demanderCode(userId);
      await expect(account.confirmer(userId, { username: "awa", code: "000000" }))
        .rejects.toMatchObject({ code: "otp_invalid" });
      expect((await db.prisma.user.findUniqueOrThrow({ where: { id: userId } })).status).toBe("active");
    });

    /* Le piège gardé : réemployer la raison `login` pour ce code. Les codes
       s'annulent entre eux par (adresse, raison) — un code obtenu pour se
       connecter suffirait alors à effacer le compte. */
    it("n'accepte pas un code émis pour se connecter", async () => {
      const { code } = await otp.issue("awa@example.com", "login");
      await expect(account.confirmer(userId, { username: "awa", code }))
        .rejects.toMatchObject({ code: "otp_invalid" });
    });

    it("désactive le compte et annonce l'échéance, sans rien effacer", async () => {
      const p = await db.prisma.person.create({ data: { userId, displayName: "Maman" } });
      await db.prisma.note.create({ data: { personId: p.id, content: "aime le jasmin" } });

      const accepte = await confirmerAvecCodeValide();

      const u = await db.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(u.status).toBe("pending_deletion");
      expect(u.deletionRequestedAt).not.toBeNull();
      expect(accepte.supportEmail).toBe(SUPPORT);
      // Trente jours plus tard, par défaut.
      expect(new Date(accepte.erasesAt).getTime() - new Date(accepte.requestedAt).getTime())
        .toBe(30 * JOUR);

      /* Le piège gardé, et c'est LE piège du chantier : effacer tout de suite.
         La réversibilité promise pendant trente jours serait mensongère à la
         milliseconde où elle est faite. */
      expect(await db.prisma.person.count({ where: { userId } })).toBe(1);
      expect(await db.prisma.note.count({ where: { personId: p.id } })).toBe(1);
    });

    it("enregistre le motif du départ quand il est donné", async () => {
      await confirmerAvecCodeValide({ reason: "too_expensive", reasonDetails: "au-delà de mon budget" });
      const u = await db.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(u.deletionReason).toContain("too_expensive");
      expect(u.deletionReason).toContain("au-delà de mon budget");
    });

    it("accepte un départ sans motif", async () => {
      await confirmerAvecCodeValide();
      expect((await db.prisma.user.findUniqueOrThrow({ where: { id: userId } })).deletionReason).toBeNull();
    });

    /* Le piège gardé : §3.24 promet que « plus de connexion n'est possible »
       dès la confirmation. Des lignées laissées vivantes rendraient cette
       phrase fausse. */
    it("révoque toutes les sessions du compte", async () => {
      const paire = await tokens.issuePair(userId, "Chrome — macOS");
      await confirmerAvecCodeValide();
      await expect(tokens.rotate(paire.refreshToken)).rejects.toThrow();
    });

    it("ne touche pas aux sessions d'un autre compte", async () => {
      const paireAutre = await tokens.issuePair(autreUserId, "Safari — iOS");
      await confirmerAvecCodeValide();
      await expect(tokens.rotate(paireAutre.refreshToken)).resolves.toBeDefined();
    });

    /* Le piège gardé : une seconde confirmation rejouée écraserait
       `deletionRequestedAt`, rallongerait le délai de grâce d'autant, et
       repousserait l'effacement à chaque appel. L'écriture est conditionnée au
       statut `active` pour que la seconde n'ait rien à mettre à jour. */
    it("refuse une seconde confirmation et ne repousse pas l'échéance", async () => {
      const premiere = await confirmerAvecCodeValide();
      const demandeeLe = (await db.prisma.user.findUniqueOrThrow({ where: { id: userId } })).deletionRequestedAt;

      const { code } = await otp.issue("awa@example.com", "account_deletion");
      await expect(account.confirmer(userId, { username: "awa", code }))
        .rejects.toMatchObject({ code: "account_pending_deletion" });

      const apres = (await db.prisma.user.findUniqueOrThrow({ where: { id: userId } })).deletionRequestedAt;
      expect(apres?.toISOString()).toBe(demandeeLe?.toISOString());
      expect(premiere.requestedAt).toBe(demandeeLe?.toISOString());
    });

    /* Le piège gardé : un compte déjà en suppression qui redemande un code, ou
       rouvre l'aperçu. Il n'est plus actif, et le lui laisser faire
       entretiendrait l'illusion qu'il l'est. */
    it("refuse l'aperçu et la demande de code à un compte déjà en suppression", async () => {
      await confirmerAvecCodeValide();
      await expect(account.apercu(userId)).rejects.toMatchObject({ code: "account_pending_deletion" });
      await expect(account.demanderCode(userId)).rejects.toMatchObject({ code: "account_pending_deletion" });
    });
  });

  describe("le remboursement demandé à la confirmation (CGU §6)", () => {
    /** Une méthode qui réunit les deux conditions, et cent crédits achetés. */
    async function compteAvecSoldeAchete() {
      await db.prisma.creditTransaction.createMany({
        data: [
          { userId, type: "grant", source: "signup_grant", amount: 5 },
          { userId, type: "purchase", source: "purchase", amount: 100 },
        ],
      });
      await db.prisma.payment.create({
        data: {
          userId, direction: "charge", status: "succeeded", mode: "provider",
          amount: 10_000, currency: "XAF", credits: 100,
        },
      });
      return db.prisma.paymentMethod.create({
        data: {
          userId, kind: "mobile_money", brand: "MTN MoMo", last4: "4321",
          createdAt: new Date(Date.now() - 90 * JOUR),
          firstSuccessfulPaymentAt: new Date(Date.now() - 60 * JOUR),
        },
      });
    }

    it("enregistre un paiement sortant en attente, pour le montant acheté seul", async () => {
      const methode = await compteAvecSoldeAchete();

      const accepte = await confirmerAvecCodeValide({ refundPaymentMethodId: methode.id });
      expect(accepte.refundRequested).toBe(true);

      const remboursement = await db.prisma.payment.findFirstOrThrow({
        where: { userId, direction: "refund" },
      });
      expect(remboursement.status).toBe("pending");
      expect(remboursement.paymentMethodId).toBe(methode.id);
      // Cent crédits achetés à 100 l'unité — les cinq offerts ne comptent pas.
      expect(remboursement.credits).toBe(100);
      expect(Number(remboursement.amount)).toBe(10_000);
    });

    /* Le piège gardé : débiter les crédits à la DEMANDE. Si la suppression est
       annulée pendant le délai de grâce, le compte rétabli doit retrouver son
       solde — et si le versement n'a jamais lieu, la personne aurait perdu les
       deux. Le débit accompagne l'argent qui part, pas la promesse qu'il
       partira. */
    it("ne débite pas les crédits tant que l'argent n'est pas parti", async () => {
      const methode = await compteAvecSoldeAchete();
      await confirmerAvecCodeValide({ refundPaymentMethodId: methode.id });

      const somme = await db.prisma.creditTransaction.aggregate({
        where: { userId }, _sum: { amount: true },
      });
      expect(somme._sum.amount).toBe(105);
    });

    /* Le piège gardé : ne vérifier l'éligibilité qu'à l'écran d'aperçu. Rien
       n'oblige un appelant à y être passé — une règle vérifiée au seul écran
       précédent n'est pas une règle, seulement une suggestion. */
    it("revérifie l'éligibilité à la confirmation, pas seulement à l'aperçu", async () => {
      await db.prisma.creditTransaction.create({
        data: { userId, type: "purchase", source: "purchase", amount: 100 },
      });
      const toute_neuve = await db.prisma.paymentMethod.create({
        data: { userId, kind: "card", brand: "Visa", last4: "1111" },
      });

      const { code } = await account.demanderCode(userId);
      await expect(account.confirmer(userId, {
        username: "awa", code, refundPaymentMethodId: toute_neuve.id,
      })).rejects.toMatchObject({ code: "resource_inactive" });

      // Et le compte n'est PAS parti en suppression au passage.
      expect((await db.prisma.user.findUniqueOrThrow({ where: { id: userId } })).status).toBe("active");
    });

    /* Le piège gardé : renvoyer l'argent vers la méthode de quelqu'un
       d'autre. 404 et non 403 — répondre « interdit » confirmerait qu'elle
       existe (spec technique §9.3). */
    it("rend 404 sur la méthode d'un autre compte, jamais 403", async () => {
      const autrui = await db.prisma.paymentMethod.create({
        data: {
          userId: autreUserId, kind: "card", brand: "Visa", last4: "9999",
          createdAt: new Date(Date.now() - 90 * JOUR),
          firstSuccessfulPaymentAt: new Date(Date.now() - 60 * JOUR),
        },
      });

      const { code } = await account.demanderCode(userId);
      await expect(account.confirmer(userId, {
        username: "awa", code, refundPaymentMethodId: autrui.id,
      })).rejects.toMatchObject({ code: "not_found" });
    });

    it("part sans remboursement quand aucune méthode n'est choisie", async () => {
      await compteAvecSoldeAchete();
      const accepte = await confirmerAvecCodeValide();
      expect(accepte.refundRequested).toBe(false);
      expect(await db.prisma.payment.count({ where: { userId, direction: "refund" } })).toBe(0);
    });

    /* Le piège gardé : créer un remboursement de zéro sur un compte qui n'a
       reçu que des cadeaux. Il paraîtrait au back-office comme une somme à
       verser, et quelqu'un finirait par la verser. */
    it("n'enregistre rien quand il ne reste que des crédits offerts", async () => {
      await db.prisma.creditTransaction.create({
        data: { userId, type: "grant", source: "signup_grant", amount: 5 },
      });
      const methode = await db.prisma.paymentMethod.create({
        data: {
          userId, kind: "mobile_money", brand: "MTN MoMo", last4: "4321",
          createdAt: new Date(Date.now() - 90 * JOUR),
          firstSuccessfulPaymentAt: new Date(Date.now() - 60 * JOUR),
        },
      });

      const accepte = await confirmerAvecCodeValide({ refundPaymentMethodId: methode.id });
      expect(accepte.refundRequested).toBe(false);
      expect(await db.prisma.payment.count({ where: { userId, direction: "refund" } })).toBe(0);
    });
  });

  /* Le retour pendant le délai de grâce. §3.24 le fait passer par
     l'assistance, et non par un chemin authentifié : une fois le compte en
     suppression, plus aucune connexion n'est possible — il n'y a donc pas de
     session depuis laquelle annuler. Le rétablissement appartient au
     back-office (PATCH /admin/users/{id}). Ce que ces cas éprouvent, c'est que
     le rétablissement RETROUVE TOUT : si la confirmation avait effacé quoi que
     ce soit, la promesse de réversibilité serait creuse. */
  describe("le retour pendant le délai de grâce", () => {
    it("un compte rétabli retrouve ses proches, ses notes et son solde intacts", async () => {
      const p = await db.prisma.person.create({ data: { userId, displayName: "Maman" } });
      await db.prisma.note.create({ data: { personId: p.id, content: "aime le jasmin" } });
      await db.prisma.creditTransaction.create({
        data: { userId, type: "purchase", source: "purchase", amount: 100 },
      });

      await confirmerAvecCodeValide();

      // Ce que fait l'administration au bout du fil (voir admin/users.controller.ts).
      await db.prisma.user.update({
        where: { id: userId },
        data: { status: "active", deletionRequestedAt: null, deletionReason: null },
      });

      expect(await db.prisma.person.count({ where: { userId } })).toBe(1);
      expect(await db.prisma.note.count({ where: { personId: p.id } })).toBe(1);
      const somme = await db.prisma.creditTransaction.aggregate({
        where: { userId }, _sum: { amount: true },
      });
      expect(somme._sum.amount).toBe(100);

      // Et le compte redevient utilisable : l'aperçu répond de nouveau.
      await expect(account.apercu(userId)).resolves.toBeDefined();
    });

    /* Le piège gardé : le compte rétabli reste dans la file de travail du
       back-office et se fait effacer par le passage suivant. C'est
       `deletionRequestedAt` qui l'y met (admin/deletions.controller.ts) ; le
       remettre à nul est ce qui l'en sort. */
    it("un compte rétabli quitte la file des suppressions à échéance", async () => {
      await confirmerAvecCodeValide();
      expect(await db.prisma.user.count({
        where: { status: "pending_deletion", deletionRequestedAt: { not: null } },
      })).toBe(1);

      await db.prisma.user.update({
        where: { id: userId },
        data: { status: "active", deletionRequestedAt: null },
      });

      expect(await db.prisma.user.count({
        where: { status: "pending_deletion", deletionRequestedAt: { not: null } },
      })).toBe(0);
    });
  });
});
