import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { EnvoiService } from "../src/me/envoi.service.js";
import type { Mail, MailPort } from "../src/mail/mail.port.js";
import type { EnvoiPousse, PushPort } from "../src/notifications/push.port.js";

/* L'envoi de la file.
 *
 * La propriété qui compte n'est pas « ça part » — c'est « ça ne part QU'UNE
 * FOIS ». Un rappel manqué se rattrape à l'échéance suivante ; un courrier reçu
 * trois fois ne se rattrape pas. */
describe("l'envoi des notifications", () => {
  let db: TestDb;
  let envoi: EnvoiService;
  let partis: Mail[];
  let pousses: EnvoiPousse[];
  let awa: string;

  const poste: MailPort = { send: async (m) => { partis.push(m); } };
  const telephone: PushPort = { envoyer: async (e) => { pousses.push(e); } };
  const telephoneEnPanne: PushPort = {
    envoyer: async () => { throw new Error("OneSignal a refusé l'envoi (400)"); },
  };
  const enPanne: MailPort = { send: async () => { throw new Error("le relais est tombé"); } };

  const enFile = async (quand: Date | null, canal = "email"): Promise<string> => {
    const n = await db.prisma.notification.create({
      data: {
        userId: awa, type: "event_reminder", channel: canal as never,
        titleKey: "notification.event_reminder",
        /* Les paramètres complets, comme la programmation les pose vraiment.
           Un rappel sans le nom ni la date ne se compose pas — c'est voulu,
           et c'est ce que vérifie « une clé sans phrase » plus bas. */
        bodyParams: { days: 3, date: "2026-03-14", person: "Célarine", nature: "happy" },
        dedupeKey: randomBytes(8).toString("hex"),
        ...(quand ? { scheduledFor: quand } : {}),
      },
      select: { id: true },
    });
    return n.id;
  };

  const statutDe = async (id: string): Promise<string> =>
    (await db.prisma.notification.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    partis = [];
    pousses = [];
    envoi = new EnvoiService(db.prisma as never, poste, telephone);
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
      select: { id: true },
    });
    awa = u.id;
  });

  it("envoie ce qui est dû", async () => {
    const id = await enFile(new Date(Date.now() - 60_000));
    await envoi.envoyer();
    expect(partis).toHaveLength(1);
    expect(await statutDe(id)).toBe("sent");
  });

  // Une date nulle veut dire « tout de suite » : les relances n'attendent pas
  // une date, elles attendent le prochain passage.
  it("envoie aussi ce qui n'a pas de date", async () => {
    await enFile(null);
    await envoi.envoyer();
    expect(partis).toHaveLength(1);
  });

  it("laisse en file ce qui n'est pas encore dû", async () => {
    const id = await enFile(new Date(Date.now() + 86_400_000));
    await envoi.envoyer();
    expect(partis).toHaveLength(0);
    expect(await statutDe(id)).toBe("pending");
  });

  /* LA propriété. On marque AVANT d'envoyer, et c'est contre-intuitif : marquer
     après laisserait la ligne en attente si une panne survenait entre les deux,
     et le passage suivant renverrait le même courrier. */
  it("n'envoie jamais deux fois, même relancé", async () => {
    await enFile(new Date(Date.now() - 60_000));
    await envoi.envoyer();
    await envoi.envoyer();
    await envoi.envoyer();
    expect(partis).toHaveLength(1);
  });

  // Et sous concurrence : la prise se fait par un updateMany conditionné au
  // statut, donc le second processus ne trouve rien à prendre.
  it("n'envoie pas deux fois quand deux passages se croisent", async () => {
    await enFile(new Date(Date.now() - 60_000));
    await Promise.all([envoi.envoyer(), envoi.envoyer(), envoi.envoyer()]);
    expect(partis).toHaveLength(1);
  });

  // Le centre de notifications se lit dans l'application : il n'a rien à voir
  // avec le courrielleur.
  it("ne poste rien pour le canal du centre", async () => {
    await enFile(new Date(Date.now() - 60_000), "in_app");
    await envoi.envoyer();
    expect(partis).toHaveLength(0);
  });

  /* Le courrier porte une PHRASE, pas la clé.
   *
   * Avant, l'envoi passait `titleKey` en objet et les paramètres en JSON : ça
   * partait, et ça ne se lisait pas. Le test le fige, parce qu'un courrier
   * illisible ne fait échouer aucune assertion — il arrive juste chez
   * quelqu'un. */
  it("compose une vraie phrase dans la langue de qui reçoit", async () => {
    await enFile(new Date(Date.now() - 60_000));
    await envoi.envoyer();
    expect(partis[0]?.subject).toBe("Une date pour Célarine approche");
    expect(partis[0]?.text).toContain("14 mars");
    expect(partis[0]?.subject).not.toContain("notification.");
    expect(partis[0]?.text).not.toContain("{");
  });

  it("suit la langue d'interface, relue au moment de l'envoi", async () => {
    await db.prisma.user.update({ where: { id: awa }, data: { uiLanguage: "en" } });
    await enFile(new Date(Date.now() - 60_000));
    await envoi.envoyer();
    expect(partis[0]?.subject).toBe("A date for Célarine is coming up");
    expect(partis[0]?.locale).toBe("en");
  });

  /* Une clé sans phrase est un trou de développement, pas une panne passagère.
     La marquer `failed` la fait paraître dans la file du back-office ; la
     laisser `pending` l'y cacherait pour toujours. */
  it("marque en échec une clé qu'aucune traduction ne sait rendre", async () => {
    const n = await db.prisma.notification.create({
      data: {
        userId: awa, type: "event_reminder", channel: "email" as never,
        titleKey: "notification.jamais_ecrite", bodyParams: {},
        dedupeKey: randomBytes(8).toString("hex"),
      },
      select: { id: true },
    });
    const bilan = await envoi.envoyer();
    expect(partis).toHaveLength(0);
    expect(bilan.echouees).toBe(1);
    expect(await statutDe(n.id)).toBe("failed");
  });

  // Même chose quand la clé est connue mais qu'un paramètre indispensable
  // manque : mieux vaut un rappel manqué qu'un courrier nommant « undefined ».
  it("marque en échec un rappel dont le nom du proche manque", async () => {
    const n = await db.prisma.notification.create({
      data: {
        userId: awa, type: "event_reminder", channel: "email" as never,
        titleKey: "notification.event_reminder", bodyParams: { days: 3 },
        dedupeKey: randomBytes(8).toString("hex"),
      },
      select: { id: true },
    });
    await envoi.envoyer();
    expect(partis).toHaveLength(0);
    expect(await statutDe(n.id)).toBe("failed");
  });

  /* Le téléphone.
   *
   * Deux surfaces, un seul texte : la phrase composée pour le courrier est la
   * même que celle affichée sur l'écran verrouillé. Ce qui change est le
   * transport, pas le contenu. */
  describe("le canal du téléphone", () => {
    const avecAppareil = async (): Promise<void> => {
      await db.prisma.device.create({
        data: { userId: awa, pushToken: `sub-${randomBytes(6).toString("hex")}`, platform: "ios" },
      });
    };

    it("part au téléphone et pas au courrielleur", async () => {
      await avecAppareil();
      const id = await enFile(new Date(Date.now() - 60_000), "push");
      await envoi.envoyer();
      expect(partis).toHaveLength(0);
      expect(pousses).toHaveLength(1);
      expect(pousses[0]?.titre).toBe("Une date pour Célarine approche");
      expect(await statutDe(id)).toBe("sent");
    });

    it("adresse tous les appareils de la personne en un seul envoi", async () => {
      await avecAppareil();
      await avecAppareil();
      await enFile(new Date(Date.now() - 60_000), "push");
      await envoi.envoyer();
      // Un appel, deux jetons : c'est la même nouvelle. Un envoi par appareil
      // multiplierait les requêtes sans rien gagner.
      expect(pousses).toHaveLength(1);
      expect(pousses[0]?.jetons).toHaveLength(2);
    });

    it("ne parle pas à un appareil désactivé", async () => {
      await avecAppareil();
      await db.prisma.device.updateMany({ where: { userId: awa }, data: { isActive: false } });
      await avecAppareil();
      await enFile(new Date(Date.now() - 60_000), "push");
      await envoi.envoyer();
      expect(pousses[0]?.jetons).toHaveLength(1);
    });

    /* La route voyage en données. Sans elle, taper la notification ramène à
       l'accueil et il faut retrouver soi-même ce dont on venait d'être
       prévenu. */
    it("emporte la route qui ouvre le bon écran", async () => {
      await avecAppareil();
      await db.prisma.notification.create({
        data: {
          userId: awa, type: "event_reminder", channel: "push" as never,
          titleKey: "notification.event_reminder",
          bodyParams: { days: 3, date: "2026-03-14", person: "Célarine", nature: "happy" },
          targetRoute: "/occurrences/abc", dedupeKey: randomBytes(8).toString("hex"),
          scheduledFor: new Date(Date.now() - 60_000),
        },
      });
      await envoi.envoyer();
      expect(pousses[0]?.donnees).toEqual({ route: "/occurrences/abc" });
    });

    it("suit la langue de qui reçoit, comme le courrier", async () => {
      await db.prisma.user.update({ where: { id: awa }, data: { uiLanguage: "en" } });
      await avecAppareil();
      await enFile(new Date(Date.now() - 60_000), "push");
      await envoi.envoyer();
      expect(pousses[0]?.titre).toBe("A date for Célarine is coming up");
    });

    /* Une ligne `push` sans appareil ne peut pas aboutir. La marquer `sent`
       prétendrait qu'elle est partie ; la laisser `pending` ferait grossir une
       file qui ment sur ce qu'elle contient. */
    it("marque en échec un push sans aucun appareil actif", async () => {
      const id = await enFile(new Date(Date.now() - 60_000), "push");
      const bilan = await envoi.envoyer();
      expect(pousses).toHaveLength(0);
      expect(bilan.echouees).toBe(1);
      expect(await statutDe(id)).toBe("failed");
    });

    it("marque en échec quand le service de notification refuse", async () => {
      envoi = new EnvoiService(db.prisma as never, poste, telephoneEnPanne);
      await avecAppareil();
      const id = await enFile(new Date(Date.now() - 60_000), "push");
      const bilan = await envoi.envoyer();
      expect(bilan.echouees).toBe(1);
      expect(await statutDe(id)).toBe("failed");
    });

    // Le courrier ne doit pas souffrir d'une panne du téléphone : les deux
    // lignes sont distinctes, et un passage traite les deux.
    it("un téléphone en panne n'empêche pas le courrier de partir", async () => {
      envoi = new EnvoiService(db.prisma as never, poste, telephoneEnPanne);
      await avecAppareil();
      await enFile(new Date(Date.now() - 60_000), "push");
      await enFile(new Date(Date.now() - 60_000), "email");
      const bilan = await envoi.envoyer();
      expect(partis).toHaveLength(1);
      expect(bilan.envoyees).toBe(1);
      expect(bilan.echouees).toBe(1);
    });
  });

  describe("quand le relais tombe", () => {
    beforeEach(() => { envoi = new EnvoiService(db.prisma as never, enPanne, telephone); });

    it("marque l'échec sans faire échouer le passage", async () => {
      const id = await enFile(new Date(Date.now() - 60_000));
      const bilan = await envoi.envoyer();
      expect(bilan.echouees).toBe(1);
      expect(await statutDe(id)).toBe("failed");
    });

    /* Une ligne en échec ne se réessaie pas d'elle-même. C'est un choix : entre
       renvoyer et perdre, on perd. Un rappel manqué se rattrape à l'échéance
       suivante ; un courrier reçu trois fois ne se rattrape pas. */
    it("ne réessaie pas d'elle-même une ligne en échec", async () => {
      await enFile(new Date(Date.now() - 60_000));
      await envoi.envoyer();
      const bilan = await envoi.envoyer();
      expect(bilan.envoyees + bilan.echouees).toBe(0);
    });
  });
});
