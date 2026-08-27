import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { EnvoiService } from "../src/me/envoi.service.js";
import type { Mail, MailPort } from "../src/mail/mail.port.js";

/* L'envoi de la file.
 *
 * La propriété qui compte n'est pas « ça part » — c'est « ça ne part QU'UNE
 * FOIS ». Un rappel manqué se rattrape à l'échéance suivante ; un courrier reçu
 * trois fois ne se rattrape pas. */
describe("l'envoi des notifications", () => {
  let db: TestDb;
  let envoi: EnvoiService;
  let partis: Mail[];
  let awa: string;

  const poste: MailPort = { send: async (m) => { partis.push(m); } };
  const enPanne: MailPort = { send: async () => { throw new Error("le relais est tombé"); } };

  const enFile = async (quand: Date | null, canal = "email"): Promise<string> => {
    const n = await db.prisma.notification.create({
      data: {
        userId: awa, type: "event_reminder", channel: canal as never,
        titleKey: "notification.event_reminder", bodyParams: { days: 3 },
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
    envoi = new EnvoiService(db.prisma as never, poste);
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

  describe("quand le relais tombe", () => {
    beforeEach(() => { envoi = new EnvoiService(db.prisma as never, enPanne); });

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
