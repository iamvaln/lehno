import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { EffacementService } from "../src/me/effacement.service.js";

const JOUR = 24 * 60 * 60_000;

/* L'effacement réel des comptes supprimés.
 *
 * Chaque cas ci-dessous garde UN piège nommé. Ce n'est pas de la décoration :
 * la moitié d'entre eux protège une ligne qu'on ne peut pas récupérer si elle
 * part — et l'autre moitié protège une ligne qu'on ne peut pas défendre si elle
 * reste. */
describe("l'effacement des comptes supprimés", () => {
  let db: TestDb;
  let service: EffacementService;

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    await db.prisma.systemParameter.update({
      where: { key: "account_grace_period_days" }, data: { value: "30" },
    });
    service = new EffacementService(db.prisma as never);
  });

  const suffixe = () => randomBytes(5).toString("hex");

  /** Un compte, avec l'adresse et le pseudo qu'on lui rendra. */
  const compte = async (over: Record<string, unknown> = {}) => {
    const s = suffixe();
    return db.prisma.user.create({
      data: {
        email: `${s}@example.com`,
        username: `u${s}`,
        referralCode: s.toUpperCase(),
        ...over,
      },
    });
  };

  /** Un compte dont le titulaire a demandé la suppression il y a `ilYA` jours. */
  const enSuppression = (ilYA: number) =>
    compte({ status: "pending_deletion", deletionRequestedAt: new Date(Date.now() - ilYA * JOUR) });

  /** De quoi meubler un carnet : un proche, une occasion, une note. */
  const carnet = async (userId: string) => {
    const proche = await db.prisma.person.create({
      data: { userId, displayName: "Awa" },
    });
    const occasion = await db.prisma.event.create({
      data: {
        personId: proche.id, authorUserId: userId, kind: "birthday",
        referenceDate: new Date(),
      },
    });
    const note = await db.prisma.note.create({
      data: { personId: proche.id, authorUserId: userId, content: "aime le ndolé" },
    });
    return { proche, occasion, note };
  };

  const relu = (id: string) => db.prisma.user.findUniqueOrThrow({ where: { id } });

  // ── Le délai de grâce ─────────────────────────────────────────────────────

  /* PIÈGE : se tromper de borne est littéralement irréversible. Un compte
     encore dans son délai est restaurable ; l'effacer supprime la restauration
     que le back-office annonce au même instant. */
  it("ne touche pas un compte encore dans son délai de grâce", async () => {
    const u = await enSuppression(5);
    await carnet(u.id);

    await service.executer();

    expect(await db.prisma.person.count({ where: { userId: u.id } })).toBe(1);
    expect((await relu(u.id)).erasedAt).toBeNull();
    expect((await relu(u.id)).email).toBe(u.email);
    expect((await relu(u.id)).status).toBe("pending_deletion");
  });

  /* PIÈGE : la borne se lit dans le paramètre système, pas dans une constante.
     Un délai raccourci en back-office doit faire partir ce qui l'a dépassé — et
     le test le prouve sur un compte que le délai par défaut aurait épargné. */
  it("suit le délai réglé en base, pas une constante", async () => {
    const u = await enSuppression(5);
    await db.prisma.systemParameter.update({
      where: { key: "account_grace_period_days" }, data: { value: "3" },
    });

    await service.executer();

    expect((await relu(u.id)).erasedAt).not.toBeNull();
  });

  it("efface un compte dont le délai est échu, et son carnet avec", async () => {
    const u = await enSuppression(40);
    await carnet(u.id);

    await service.executer();

    expect(await db.prisma.person.count({ where: { userId: u.id } })).toBe(0);
    expect(await db.prisma.note.count()).toBe(0);
    expect(await db.prisma.event.count()).toBe(0);

    const apres = await relu(u.id);
    expect(apres.status).toBe("deleted");
    expect(apres.erasedAt).not.toBeNull();
    // `.invalid` : le domaine réservé par la RFC 2606. Aucun courrier ne peut
    // plus partir vers ce compte, quoi qu'on tente.
    expect(apres.email).toBe(`supprime+${u.id}@lehno.invalid`);
    expect(apres.email).not.toContain("@example.com");
    expect(apres.username).not.toBe(u.username);
    expect(apres.referralCode).not.toBe(u.referralCode);
  });

  /* PIÈGE : marquer « effacé » depuis le back-office court-circuite le délai —
     c'est le geste réservé au rôle admin. S'il n'était pas ramassé ici, le
     geste continuerait à n'effacer rien du tout, ce qu'il faisait avant. */
  it("efface sans attendre un compte marqué effacé par l'administration", async () => {
    const u = await compte({ status: "deleted" });
    await carnet(u.id);

    await service.executer();

    expect(await db.prisma.person.count({ where: { userId: u.id } })).toBe(0);
    expect((await relu(u.id)).erasedAt).not.toBeNull();
  });

  /* PIÈGE : un compte marqué `pending_deletion` sans date de demande. Sans le
     `not: null` du filtre, il passerait la comparaison d'échéance et partirait
     sans avoir jamais eu de délai. */
  it("laisse tranquille un compte en suppression sans date de demande", async () => {
    const u = await compte({ status: "pending_deletion", deletionRequestedAt: null });
    await carnet(u.id);

    await service.executer();

    expect(await db.prisma.person.count({ where: { userId: u.id } })).toBe(1);
    expect((await relu(u.id)).erasedAt).toBeNull();
  });

  // ── Ce qui doit SURVIVRE ──────────────────────────────────────────────────

  /* PIÈGE : DeviceSignup tient le plafond de comptes par appareil, et le
     plafond porte sur le seul `deviceId`. L'effacer avec le compte ouvrirait
     la porte que §9.11 nomme : créer puis supprimer pour recréer sans limite. */
  it("délie DeviceSignup du compte, mais lui laisse tenir le plafond", async () => {
    const appareil = `dev-${suffixe()}`;
    const u = await enSuppression(40);
    await db.prisma.deviceSignup.create({ data: { deviceId: appareil, userId: u.id, ip: "10.0.0.1" } });

    await service.executer();

    const lignes = await db.prisma.deviceSignup.findMany({ where: { deviceId: appareil } });
    // La ligne demeure : c'est elle qui compte pour le plafond.
    expect(lignes).toHaveLength(1);
    // Le lien vers le compte est rompu : c'est ça, l'anonymisation.
    expect(lignes[0]?.userId).toBeNull();
    // L'IP reste, elle sert aux investigations et n'identifie pas le compte.
    expect(lignes[0]?.ip).toBe("10.0.0.1");
  });

  /* PIÈGE : « une trace qui doit faire foi ne disparaît pas avec ce qu'elle
     décrit » — c'est écrit dans le schéma, et rien ne le tient si personne ne
     l'éprouve. Le journal n'a aucune clé étrangère, donc rien ne le protège
     d'un `deleteMany` distrait. */
  it("laisse intact le journal d'audit, et y ajoute la trace de l'effacement", async () => {
    const u = await enSuppression(40);
    const admin = await db.prisma.admin.create({ data: { email: `a${suffixe()}@lehno.app`, role: "admin" } });
    await db.prisma.auditLog.create({
      data: {
        actorType: "admin", actorId: admin.id, action: "user_status_update",
        reason: "Demande du titulaire", targetType: "user", targetId: u.id,
      },
    });

    await service.executer();

    const ancienne = await db.prisma.auditLog.findFirst({ where: { action: "user_status_update" } });
    expect(ancienne?.reason).toBe("Demande du titulaire");

    const trace = await db.prisma.auditLog.findFirst({ where: { action: "account_erased" } });
    expect(trace?.targetId).toBe(u.id);
    expect((trace?.metadata as { porte?: string } | null)?.porte).toBe("delai_de_grace_echu");
  });

  /* PIÈGE : `payment` et `credit_transaction` référencent `user` en CASCADE.
     Un `user.delete()` — la façon évidente d'effacer un compte — emporterait
     silencieusement des pièces que §4 range sous obligation légale. C'est LA
     raison pour laquelle la ligne `user` est vidée au lieu d'être supprimée. */
  it("garde les paiements et les mouvements de crédits", async () => {
    const u = await enSuppression(40);
    const paiement = await db.prisma.payment.create({
      data: { userId: u.id, amount: "1000", currency: "XAF", credits: 20, status: "succeeded" },
    });
    await db.prisma.creditTransaction.create({
      data: { userId: u.id, type: "purchase", source: "purchase", amount: 20, paymentId: paiement.id },
    });

    await service.executer();

    expect(await db.prisma.payment.count({ where: { userId: u.id } })).toBe(1);
    expect(await db.prisma.creditTransaction.count({ where: { userId: u.id } })).toBe(1);
    // Et la ligne du compte est toujours là, sinon les deux au-dessus seraient
    // parties avec elle.
    expect((await relu(u.id)).id).toBe(u.id);
  });

  /* PIÈGE : le numéro mobile money est la donnée que §9.11 désigne comme la
     plus sensible. Il vit sur PaymentMethod, que le paiement référence en
     SetNull — donc on peut l'effacer sans perdre la pièce comptable. */
  it("efface le moyen de paiement sans emporter le paiement", async () => {
    const u = await enSuppression(40);
    const moyen = await db.prisma.paymentMethod.create({
      data: { userId: u.id, kind: "mobile_money", msisdn: "+237690000000" },
    });
    await db.prisma.payment.create({
      data: { userId: u.id, paymentMethodId: moyen.id, amount: "1000", currency: "XAF", credits: 20 },
    });

    await service.executer();

    expect(await db.prisma.paymentMethod.count({ where: { userId: u.id } })).toBe(0);
    const p = await db.prisma.payment.findFirstOrThrow({ where: { userId: u.id } });
    expect(p.paymentMethodId).toBeNull();
  });

  /* PIÈGE : §9.11 veut que les traces de connexion survivent anonymisées. Ne
     rompre que `userId` laisserait l'adresse en clair dans `attemptedEmail` —
     l'anonymisation serait de façade, sur la colonne qui identifie le mieux. */
  it("garde les traces de connexion, sans compte ni adresse", async () => {
    const u = await enSuppression(40);
    await db.prisma.loginActivity.create({
      data: { userId: u.id, attemptedEmail: u.email, result: "success", method: "otp", ip: "10.0.0.2" },
    });
    // Un échec sur la même adresse, écrit AVANT que le compte n'existe : pas de
    // `user_id`, et pourtant l'adresse y est.
    await db.prisma.loginActivity.create({
      data: { attemptedEmail: u.email, result: "failure", method: "otp" },
    });

    await service.executer();

    const traces = await db.prisma.loginActivity.findMany();
    expect(traces).toHaveLength(2);
    expect(traces.every((t) => t.userId === null)).toBe(true);
    expect(traces.every((t) => t.attemptedEmail === null)).toBe(true);
    // Ce qui documente un incident reste : le résultat et l'adresse IP.
    expect(traces.some((t) => t.result === "failure")).toBe(true);
    expect(traces.some((t) => t.ip === "10.0.0.2")).toBe(true);
  });

  // ── Ce qui appartient à un TIERS ──────────────────────────────────────────

  /* PIÈGE : une note que ce compte a déposée dans le carnet de QUELQU'UN
     D'AUTRE, par un lien de collecte. Elle est la donnée du destinataire, qui
     n'a rien demandé. L'emporter effacerait le carnet d'un tiers ; garder la
     signature laisserait un lien vers un compte effacé. */
  it("n'emporte pas ce qu'il a écrit dans le carnet d'un autre — il le désigne", async () => {
    const partant = await enSuppression(40);
    const restant = await compte();
    const sonProche = await db.prisma.person.create({
      data: { userId: restant.id, displayName: "Bilé" },
    });
    const contribution = await db.prisma.note.create({
      data: { personId: sonProche.id, authorUserId: partant.id, content: "il collectionne les vinyles", origin: "collected" },
    });

    await service.executer();

    const relue = await db.prisma.note.findUnique({ where: { id: contribution.id } });
    // Le contenu reste : il appartient au carnet de `restant`.
    expect(relue?.content).toBe("il collectionne les vinyles");
    // La signature part : elle désignait le compte effacé.
    expect(relue?.authorUserId).toBeNull();
    // Et le proche du tiers n'a pas bougé.
    expect(await db.prisma.person.count({ where: { userId: restant.id } })).toBe(1);
    expect((await relu(restant.id)).erasedAt).toBeNull();
  });

  /* PIÈGE : symétrique du précédent. Une note déposée par un tiers DANS le
     carnet du partant appartient au carnet, pas au déposant — §7 la dit
     effacée « à la suppression du compte du propriétaire ». La laisser au motif
     qu'elle vient d'ailleurs ferait survivre du contenu sur des proches. */
  it("emporte ce qu'un tiers a déposé dans le carnet du partant", async () => {
    const partant = await enSuppression(40);
    const tiers = await compte();
    const { proche } = await carnet(partant.id);
    await db.prisma.note.create({
      data: { personId: proche.id, authorUserId: tiers.id, content: "adore la kola", origin: "collected" },
    });

    await service.executer();

    expect(await db.prisma.note.count()).toBe(0);
    // Le tiers, lui, n'est pas touché.
    expect((await relu(tiers.id)).erasedAt).toBeNull();
  });

  // ── Idempotence et reprise ────────────────────────────────────────────────

  /* PIÈGE : sans marqueur d'idempotence, la tâche repasserait chaque nuit sur
     tous les comptes déjà effacés — et réécrirait une trace d'audit à chaque
     fois. `status` ne peut pas servir de marqueur : il vaut `deleted` avant
     comme après. */
  it("n'efface qu'une fois : deux passages, une seule trace", async () => {
    const u = await enSuppression(40);
    await carnet(u.id);

    await service.executer();
    const premier = (await relu(u.id)).erasedAt;

    await service.executer();

    expect((await relu(u.id)).erasedAt).toEqual(premier);
    expect(await db.prisma.auditLog.count({ where: { action: "account_erased" } })).toBe(1);
  });

  /* PIÈGE : la tâche tourne de nuit et peut être interrompue au milieu. Un
     compte à moitié effacé qui ne se reprend pas est pire que rien.
     La panne est INJECTÉE de façon déterministe : une étape précise échoue, une
     seule fois. On vérifie ensuite que `erasedAt` est resté nul — sans quoi le
     compte serait sorti de la file en laissant ses lignes derrière lui. */
  it("reprend un effacement interrompu au passage suivant", async () => {
    const u = await enSuppression(40);
    await carnet(u.id);
    await db.prisma.refreshToken.create({
      data: {
        userId: u.id, familyId: randomUUID(), tokenHash: `h${suffixe()}`,
        expiresAt: new Date(Date.now() + JOUR),
      },
    });

    // Un client qui tombe sur la suppression des sessions — l'étape 3, après
    // que le carnet soit parti. Tout le reste passe normalement.
    let tombe = true;
    const boiteux = new Proxy(db.prisma, {
      get(cible, prop, recepteur) {
        if (prop === "refreshToken" && tombe) {
          tombe = false;
          return { deleteMany: async () => { throw new Error("connexion perdue"); } };
        }
        return Reflect.get(cible, prop, recepteur) as unknown;
      },
    });

    // Le passage ne rejette pas : un compte qui tombe n'arrête pas les autres.
    await expect(new EffacementService(boiteux as never).executer()).resolves.toBeUndefined();

    // Le carnet est parti — l'effacement avait commencé...
    expect(await db.prisma.person.count({ where: { userId: u.id } })).toBe(0);
    // ...mais la session est restée, et surtout le compte n'est PAS marqué
    // effacé. Il ressortira de la file demain.
    expect(await db.prisma.refreshToken.count({ where: { userId: u.id } })).toBe(1);
    expect((await relu(u.id)).erasedAt).toBeNull();
    expect(await db.prisma.auditLog.count({ where: { action: "account_erased" } })).toBe(0);

    // Le passage suivant reprend du début et finit le travail, alors même
    // qu'aucune étape ne sait où la précédente s'est arrêtée.
    await service.executer();

    expect(await db.prisma.refreshToken.count({ where: { userId: u.id } })).toBe(0);
    expect((await relu(u.id)).erasedAt).not.toBeNull();
    expect(await db.prisma.auditLog.count({ where: { action: "account_erased" } })).toBe(1);
  });

  /* PIÈGE : L'ORDRE DES ÉTAPES. L'adresse du compte sert de critère pour
     retrouver les traces de connexion écrites sans `user_id`. Si le compte
     était anonymisé AVANT elles, une reprise relirait le substitut
     `supprime+…@lehno.invalid`, ne retrouverait plus ces lignes, et l'adresse
     d'origine resterait au journal pour toujours — sans que rien ne le
     signale. Ce cas ne tombe QUE sur une reprise : un passage d'une traite
     garde l'adresse d'origine dans une variable et masque le défaut. */
  it("retrouve encore les traces par l'adresse après une reprise", async () => {
    const u = await enSuppression(40);
    await db.prisma.loginActivity.create({
      data: { attemptedEmail: u.email, result: "failure", method: "otp" },
    });

    let tombe = true;
    const boiteux = new Proxy(db.prisma, {
      get(c, prop, r) {
        if (prop === "loginActivity" && tombe) {
          tombe = false;
          return { updateMany: async () => { throw new Error("connexion perdue"); } };
        }
        return Reflect.get(c, prop, r) as unknown;
      },
    });
    await new EffacementService(boiteux as never).executer();
    // Interrompu juste avant l'anonymisation du compte : l'adresse d'origine
    // est donc encore lisible, et c'est exactement ce que la reprise exige.
    expect((await relu(u.id)).email).toBe(u.email);

    await service.executer();

    const trace = await db.prisma.loginActivity.findFirstOrThrow();
    expect(trace.attemptedEmail).toBeNull();
    expect((await relu(u.id)).erasedAt).not.toBeNull();
  });

  /* PIÈGE : un compte en panne ne doit pas emporter la file. Sans le
     try/catch par compte, le premier échec laisserait tous les suivants
     intouchés — et la file se bloquerait sur lui, nuit après nuit. */
  it("poursuit la file quand un compte tombe", async () => {
    const casse = await enSuppression(60);
    const sain = await enSuppression(40);

    let cible = casse.id;
    const boiteux = new Proxy(db.prisma, {
      get(c, prop, r) {
        if (prop === "person") {
          const vrai = Reflect.get(c, prop, r) as { deleteMany: (a: unknown) => Promise<unknown> };
          return {
            ...vrai,
            deleteMany: async (a: { where: { userId: string } }) => {
              if (a.where.userId === cible) { cible = ""; throw new Error("connexion perdue"); }
              return vrai.deleteMany(a);
            },
          };
        }
        return Reflect.get(c, prop, r) as unknown;
      },
    });

    await new EffacementService(boiteux as never).executer();

    // Le plus ancien passe en premier et tombe...
    expect((await relu(casse.id)).erasedAt).toBeNull();
    // ...et le suivant est traité quand même.
    expect((await relu(sain.id)).erasedAt).not.toBeNull();
  });

  // ── Ce qui reste du compte ────────────────────────────────────────────────

  /* PIÈGE : §13 promet que « chaque acceptation est horodatée et conservée ».
     Ces deux colonnes disent sous quel contrat les paiements qu'on garde ont
     été faits ; les vider avec le reste laisserait des pièces comptables sans
     leurs conditions. */
  it("conserve l'acceptation des conditions, qui date les paiements gardés", async () => {
    const accepte = new Date("2026-01-15T10:00:00Z");
    const u = await enSuppression(40);
    await db.prisma.user.update({
      where: { id: u.id },
      data: { acceptedTermsAt: accepte, acceptedTermsVersion: "2026-08-23" },
    });

    await service.executer();

    const apres = await relu(u.id);
    expect(apres.acceptedTermsAt).toEqual(accepte);
    expect(apres.acceptedTermsVersion).toBe("2026-08-23");
  });

  /* PIÈGE : `federated_identity` porte `@@unique([provider, providerUserId])`.
     Une identité laissée derrière interdirait à la personne de revenir un jour
     avec le même compte Google — un effacement qui bannit sans le dire. */
  it("délie le compte Google, pour que la personne puisse revenir", async () => {
    const u = await enSuppression(40);
    await db.prisma.federatedIdentity.create({
      data: { userId: u.id, provider: "google", providerUserId: "g-42", emailAtLink: u.email },
    });

    await service.executer();

    expect(await db.prisma.federatedIdentity.count()).toBe(0);
    // La preuve que ça sert : la même identité peut se rattacher à un compte neuf.
    const neuf = await compte();
    await expect(db.prisma.federatedIdentity.create({
      data: { userId: neuf.id, provider: "google", providerUserId: "g-42" },
    })).resolves.toBeTruthy();
  });

  /* PIÈGE : un code à usage unique écrit AVANT que le compte n'existe porte
     l'adresse sans `user_id`. Filtrer sur le seul compte le laisserait sur
     place, avec l'adresse dedans. */
  it("purge les codes à usage unique, y compris ceux sans compte", async () => {
    const u = await enSuppression(40);
    await db.prisma.otpCode.create({
      data: { userId: u.id, targetEmail: u.email, codeHash: "h1", reason: "login", expiresAt: new Date(Date.now() + JOUR) },
    });
    await db.prisma.otpCode.create({
      data: { targetEmail: u.email, codeHash: "h2", reason: "email_verification", expiresAt: new Date(Date.now() + JOUR) },
    });

    await service.executer();

    expect(await db.prisma.otpCode.count()).toBe(0);
  });
});
