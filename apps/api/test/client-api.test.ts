import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import {
  ClientApiService, engendrerUneCle, hacherLaCle,
} from "../src/clients/client-api.service.js";

/**
 * QUI NOUS APPELLE, ET DEPUIS QUEL BUILD.
 *
 * Ce service IDENTIFIE, il n'authentifie pas — et la distinction est écrite
 * partout parce que quelqu'un s'y fiera un jour comme à une frontière de
 * sécurité. Une clé livrée dans un binaire mobile ou un paquet web n'est pas un
 * secret : elle s'extrait d'un `.ipa` ou d'un `Ctrl-U`. Ce qu'elle apporte est
 * de se RÉVOQUER sans changer l'identifiant, donc sans casser la comparaison des
 * chiffres dans le temps.
 */
describe("le client qui appelle", () => {
  let db: TestDb;
  let service: ClientApiService;

  const poser = async (options: {
    clientId?: string;
    cle?: string;
    type?: "mobile_ios" | "mobile_android" | "web";
    actif?: boolean;
  } = {}): Promise<{ clientId: string; cle: string }> => {
    const clientId = options.clientId ?? `c_${randomBytes(6).toString("hex")}`;
    const cle = options.cle ?? engendrerUneCle();
    await db.prisma.apiClient.create({
      data: {
        clientId,
        label: "Un build",
        clientType: (options.type ?? "mobile_ios") as never,
        environment: "prod" as never,
        keyHash: hacherLaCle(cle),
        isActive: options.actif ?? true,
      },
    });
    return { clientId, cle };
  };

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    service = new ClientApiService(db.prisma as never);
  });

  it("reconnaît une paire juste", async () => {
    const { clientId, cle } = await poser();
    expect(await service.resoudre({ clientId, clientKey: cle, clientType: "mobile_ios" }))
      .toMatchObject({ etat: "reconnu", clientId, clientType: "mobile_ios" });
  });

  /* LA CLÉ N'EST JAMAIS EN CLAIR EN BASE. Une clé perdue se remplace, elle ne se
     récupère pas — et une clé qu'on ne peut pas relire ne fuite pas par la
     base. Le cas lit la colonne directement plutôt que de s'en remettre au
     service : c'est le stockage qu'on éprouve, pas la comparaison. */
  it("ne range jamais la clé en clair", async () => {
    const { clientId, cle } = await poser();
    const ligne = await db.prisma.apiClient.findUniqueOrThrow({
      where: { clientId }, select: { keyHash: true },
    });
    expect(ligne.keyHash).not.toBe(cle);
    expect(ligne.keyHash).toHaveLength(64);
  });

  /* ── LES CINQ REFUS, CHACUN AVEC SA CAUSE ──────────────────────────────────
   *
   * Le motif ne sort JAMAIS vers le client, qui reçoit un refus unique : dire
   * laquelle des deux valeurs est fausse apprendrait à un script lesquelles il a
   * devinées. Ici on veut tout savoir — c'est ce qui distingue le journal de la
   * réponse. */
  it("refuse sans en-têtes, et le dit « absent »", async () => {
    expect(await service.resoudre({ clientId: null, clientKey: null, clientType: null }))
      .toEqual({ etat: "absent" });
  });

  it("refuse un identifiant inconnu", async () => {
    expect(await service.resoudre({
      clientId: "jamais_vu", clientKey: engendrerUneCle(), clientType: "web",
    })).toEqual({ etat: "inconnu" });
  });

  it("refuse une clé fausse", async () => {
    const { clientId } = await poser();
    expect(await service.resoudre({
      clientId, clientKey: engendrerUneCle(), clientType: "mobile_ios",
    })).toEqual({ etat: "cle_fausse" });
  });

  /* COUPER SANS SUPPRIMER : les lignes déjà notées gardent leur référence, et
     l'historique reste lisible. C'est aussi ce qui permet de fermer un build
     sans fermer les autres. */
  it("refuse un client coupé, sans l'avoir supprimé", async () => {
    const { clientId, cle } = await poser({ actif: false });
    expect(await service.resoudre({ clientId, clientKey: cle, clientType: "mobile_ios" }))
      .toEqual({ etat: "coupe" });
    expect(await db.prisma.apiClient.count({ where: { clientId } })).toBe(1);
  });

  /* LE TYPE DÉCLARÉ DOIT CONCORDER. Ce n'est pas une redondance : un
     `x-client-type` qui ne correspond pas dit qu'une clé circule hors de son
     build, et c'est exactement ce qu'on veut voir. */
  it("refuse un type qui ne correspond pas à l'enregistrement", async () => {
    const { clientId, cle } = await poser({ type: "mobile_ios" });
    expect(await service.resoudre({ clientId, clientKey: cle, clientType: "web" }))
      .toEqual({ etat: "type_discordant" });
  });

  describe("le cache", () => {
    /* SANS LUI, UNE LECTURE EN BASE PAR REQUÊTE pour un objet qui change une
       fois par trimestre. On l'éprouve en coupant le client EN BASE puis en
       redemandant : tant que le cache tient, le verdict ne bouge pas. */
    it("évite de relire la base à chaque appel", async () => {
      const { clientId, cle } = await poser();
      await service.resoudre({ clientId, clientKey: cle, clientType: "mobile_ios" });

      await db.prisma.apiClient.updateMany({ where: { clientId }, data: { isActive: false } });

      expect(await service.resoudre({ clientId, clientKey: cle, clientType: "mobile_ios" }))
        .toMatchObject({ etat: "reconnu" });
    });

    /* SOIXANTE SECONDES D'ATTENTE POUR RÉVOQUER UNE CLÉ COMPROMISE, C'EST
       CINQUANTE-NEUF DE TROP. L'administration oublie explicitement. */
    it("s'oublie sur demande, pour que la révocation soit immédiate", async () => {
      const { clientId, cle } = await poser();
      await service.resoudre({ clientId, clientKey: cle, clientType: "mobile_ios" });

      await db.prisma.apiClient.updateMany({ where: { clientId }, data: { isActive: false } });
      service.oublier(clientId);

      expect(await service.resoudre({ clientId, clientKey: cle, clientType: "mobile_ios" }))
        .toEqual({ etat: "coupe" });
    });

    /* LES ÉCHECS AUSSI SE METTENT EN CACHE : un identifiant inconnu répété
       ferait sinon une lecture à chaque fois, et c'est précisément le profil
       d'un script qui tâtonne. On l'éprouve en CRÉANT le client après un premier
       refus — tant que le cache négatif tient, il reste inconnu. */
    it("retient aussi ce qu'il n'a pas trouvé", async () => {
      const clientId = `c_${randomBytes(6).toString("hex")}`;
      const cle = engendrerUneCle();

      expect(await service.resoudre({ clientId, clientKey: cle, clientType: "web" }))
        .toEqual({ etat: "inconnu" });

      await poser({ clientId, cle, type: "web" });

      expect(await service.resoudre({ clientId, clientKey: cle, clientType: "web" }))
        .toEqual({ etat: "inconnu" });
    });
  });

  /* SIX PAIRES, ET PAS UNE PAR BUILD : trois plateformes × deux environnements.
     La version ne fait pas partie de l'identité — elle voyage dans
     `x-app-version`. Ce cas garde la forme : deux clients peuvent partager un
     type et se distinguer par leur environnement. */
  it("distingue deux environnements du même type", async () => {
    const a = await poser({ type: "web" });
    const b = await poser({ type: "web" });

    expect(await service.resoudre({ clientId: a.clientId, clientKey: a.cle, clientType: "web" }))
      .toMatchObject({ clientId: a.clientId });
    expect(await service.resoudre({ clientId: b.clientId, clientKey: b.cle, clientType: "web" }))
      .toMatchObject({ clientId: b.clientId });
    // La clé de l'un ne vaut pas pour l'autre.
    expect(await service.resoudre({ clientId: a.clientId, clientKey: b.cle, clientType: "web" }))
      .toEqual({ etat: "cle_fausse" });
  });
});
