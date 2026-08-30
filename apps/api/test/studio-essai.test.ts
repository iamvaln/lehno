import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { PanneFournisseur, RefusModele, RouteurIAService, type Adaptateur, type DemandeIA } from "../src/ia/routeur.service.js";
import { AuditService } from "../src/admin/audit.service.js";
import { StudioConfigurationService } from "../src/studio/configuration.service.js";
import { StudioEssaiService } from "../src/studio/essai.service.js";
import {
  SEUIL_PANNE, reglagesMessageDeDepart,
  type ProfilContenu, type ReglagesMessage,
} from "@lehno/contracts";
import { StockageMemoire } from "../src/stockage/memoire.adapter.js";

/* L'essai d'administration.
 *
 * Tout se joue avec de faux adaptateurs : sans eux, aucun de ces cas ne
 * tournerait en intégration continue, et l'absence de repli — la propriété la
 * plus coûteuse à perdre de ce fichier — ne serait éprouvée qu'en production,
 * c'est-à-dire le jour où quelqu'un publie sur la foi d'un résultat obtenu
 * ailleurs. */
describe("l'essai du studio", () => {
  let db: TestDb;
  let essais: StudioEssaiService;
  let configs: StudioConfigurationService;
  let vus: DemandeIA[];

  const faux = (comportement: () => { contenu: string; jetonsEntree?: number; jetonsSortie?: number } | Error) => {
    const a = {
      appels: 0,
      async appeler(_modele: string, demande: DemandeIA) {
        a.appels += 1;
        vus.push(demande);
        const r = comportement();
        if (r instanceof Error) throw r;
        return r;
      },
    };
    return a;
  };

  const monter = (adaptateurs: Record<string, Adaptateur>) => {
    configs = new StudioConfigurationService(db.prisma as never, new AuditService(db.prisma as never));
    /* Le stockage en mémoire : un essai de portrait range son image, et
       mille cinq cents tests ne peuvent pas dépendre d'un compartiment
       distant. Il rend de vraies clés, de la même forme que R2. */
    essais = new StudioEssaiService(
      db.prisma as never, configs, new RouteurIAService(db.prisma as never), adaptateurs,
      new StockageMemoire(),
    );
  };

  const CONTENU: ProfilContenu = {
    langue: "fr", orientation: "ma_gratitude", nomDUsage: "Léa",
    registre: "familier", lien: "famille_proche", relation: "ma sœur",
    genreDuProche: "female", genreDeLAuteur: "male", occasionSensible: false,
    notes: [{ categorie: "loisirs", date: "2026-02-11", contenu: "Reprise de la poterie." }],
    aEviter: ["les surprises"], texteLibre: "elle rit fort", age: 34,
  };

  const profil = () => db.prisma.studioProfile.create({
    data: { label: "essai", isSensitive: false, payload: CONTENU as never },
  });

  const modele = (provider: string, modelKey: string) =>
    db.prisma.aIModel.create({ data: { provider, modelKey } });

  const reglages = (f: (r: ReglagesMessage) => void = () => undefined): ReglagesMessage => {
    const r = JSON.parse(JSON.stringify(reglagesMessageDeDepart())) as ReglagesMessage;
    r.modele = "anthropic:demande";
    f(r);
    return r;
  };

  let adminId: string;

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    vus = [];
    const a = await db.prisma.admin.create({ data: { email: "admin@lehno.app", role: "admin" } });
    adminId = a.id;
  });

  /* LA propriété du §11.1. Le routeur replie ; l'essai ne DOIT pas. Sans ce
     cas, on enregistrerait un essai `success` portant une empreinte qui
     désigne un modèle n'ayant rien produit — et la règle de publication
     autoriserait une mise en service sur la foi d'un résultat obtenu ailleurs.
     La garantie serait vraie au dossier et fausse en fait. */
  it("n'a pas de repli : le modèle demandé, ou l'échec en le nommant", async () => {
    const demande = faux(() => new PanneFournisseur("502"));
    const secours = faux(() => ({ contenu: "je réponds à sa place" }));
    monter({ anthropic: demande, deepseek: secours });

    const m1 = await modele("anthropic", "demande");
    const m2 = await modele("deepseek", "secours");
    // Une chaîne complète est en place : c'est elle que le routeur suivrait.
    await db.prisma.aITaskRoute.createMany({
      data: [{ task: "message", modelId: m1.id, rank: 1 }, { task: "message", modelId: m2.id, rank: 2 }],
    });

    const { essai } = await essais.essayer(adminId, reglages(), (await profil()).id);

    expect(secours.appels).toBe(0);
    expect(essai.etat).toBe("error");
    expect(essai.modele).toEqual({ fournisseur: "anthropic", cle: "demande" });
    expect(essai.erreur).toBe("502");
  });

  /* Le §11.2, et l'ordre décide de ce qu'on perd : si le brouillon n'était
     écrit qu'au retour, un fournisseur en panne effacerait dix minutes de
     composition. C'est le défaut qui fait détester un outil. */
  it("écrit le brouillon AVANT l'appel : une panne ne l'emporte pas", async () => {
    monter({ anthropic: faux(() => new PanneFournisseur("timeout")) });
    await modele("anthropic", "demande");

    const { configId, essai } = await essais.essayer(adminId, reglages((r) => {
      r.consigneCommune = "dix minutes de composition";
    }), (await profil()).id);

    expect(essai.etat).toBe("timeout");
    const brouillon = await configs.brouillon("message");
    expect(brouillon?.id).toBe(configId);
    expect(configs.reglagesMessageDe(brouillon!).consigneCommune).toBe("dix minutes de composition");
  });

  /* Un brouillon ne se MUTE pas, il se rejoue. Si la ligne était mutable, un
     essai lancé avant une modification resterait rattaché à la même ligne
     après elle : la règle « rien ne se publie sans essai » serait satisfaite
     par un essai qui ne parle plus de rien. */
  it("chaîne les brouillons : le précédent est dépassé, jamais modifié", async () => {
    monter({ anthropic: faux(() => ({ contenu: "voilà" })) });
    await modele("anthropic", "demande");
    const p = (await profil()).id;

    const un = await essais.essayer(adminId, reglages((r) => { r.consigneCommune = "premier"; }), p);
    const deux = await essais.essayer(adminId, reglages((r) => { r.consigneCommune = "second"; }), p);

    expect(deux.configId).not.toBe(un.configId);
    const premier = await db.prisma.studioConfig.findUniqueOrThrow({ where: { id: un.configId } });
    expect(premier.state).toBe("superseded");
    expect(configs.reglagesMessageDe(premier).consigneCommune).toBe("premier");
    expect(await db.prisma.studioConfig.count({ where: { state: "draft" } })).toBe(1);
  });

  /* Sans `origin`, la facture des réglages se confond avec celle de la
     production, et on ne peut répondre ni à « combien nous coûtent les
     réglages » ni à « combien nous coûtent les utilisateurs ». */
  it("marque l'appel « studio_trial » et ne le rattache à aucune exécution payante", async () => {
    monter({ anthropic: faux(() => ({ contenu: "voilà", jetonsEntree: 100, jetonsSortie: 50 })) });
    await modele("anthropic", "demande");

    await essais.essayer(adminId, reglages(), (await profil()).id);

    const usage = await db.prisma.aIUsage.findFirstOrThrow();
    expect(usage.origin).toBe("studio_trial");
    expect(usage.actionRunId).toBeNull();
    expect(usage.userId).toBeNull();
    expect(usage.purpose).toBe("message");
  });

  /* Le disjoncteur protège le routage AUTOMATIQUE et se nourrit du trafic
     réel. Sans ce cas, un administrateur qui éprouve une consigne bancale sur
     le modèle de premier rang l'écarterait de la PRODUCTION pour cinq minutes
     — trois essais y suffisent — sans avoir rien dit à personne. */
  it("ne nourrit pas le disjoncteur", async () => {
    monter({ anthropic: faux(() => new PanneFournisseur("502")) });
    const m = await modele("anthropic", "demande");
    const p = (await profil()).id;

    for (let i = 0; i < SEUIL_PANNE + 1; i += 1) await essais.essayer(adminId, reglages(), p);

    const apres = await db.prisma.aIModel.findUniqueOrThrow({ where: { id: m.id } });
    expect(apres.consecutiveFailures).toBe(0);
    expect(apres.outageUntil).toBeNull();
  });

  /* Un refus n'est pas une panne : le brief de design §12 en fait deux gestes
     différents — reprendre la consigne, ou réessayer. Les confondre ferait
     réessayer trente fois une demande que le modèle refusera toujours. */
  it("distingue un refus d'une panne", async () => {
    monter({ anthropic: faux(() => new RefusModele("content_policy")) });
    await modele("anthropic", "demande");

    const { essai } = await essais.essayer(adminId, reglages(), (await profil()).id);
    expect(essai.etat).toBe("refused");
    expect(essai.erreur).toBe("content_policy");
  });

  /* Tout l'objet de l'établi : c'est la consigne DES RÉGLAGES qui part, pas
     celle du registre en code. Sans ce cas, on réglerait une consigne à
     l'écran, on verrait un résultat produit par une autre, et on la
     publierait. */
  it("envoie la consigne des réglages, pas celle du registre", async () => {
    monter({ anthropic: faux(() => ({ contenu: "voilà" })) });
    await modele("anthropic", "demande");

    await essais.essayer(adminId, reglages((r) => {
      r.orientations.find((o) => o.id === "ma_gratitude")!.consigne.fr = "Parlez de la poterie et de rien d'autre.";
      r.consigneCommune = "Trois mots maximum.";
      r.gardeFous = ["jamais de point d'exclamation"];
    }), (await profil()).id);

    expect(vus[0]?.invite).toContain("Parlez de la poterie et de rien d'autre.");
    expect(vus[0]?.invite).not.toContain("Dites ce que vous lui devez.");
    expect(vus[0]?.systeme).toContain("Trois mots maximum.");
    expect(vus[0]?.systeme).toContain("jamais de point d'exclamation");
  });

  /* « L'administrateur décide ce que le gabarit a le droit de lire » doit être
     un fait, pas une case décorative. Un champ décoché qui partirait quand
     même ferait publier un réglage qui ne fait pas ce qu'il dit. */
  it("retire de l'invite les champs que les réglages ne retiennent pas", async () => {
    monter({ anthropic: faux(() => ({ contenu: "voilà" })) });
    await modele("anthropic", "demande");

    await essais.essayer(adminId, reglages((r) => { r.champsDuProche = []; }), (await profil()).id);

    expect(vus[0]?.invite).not.toContain("Reprise de la poterie.");
    expect(vus[0]?.invite).not.toContain("ma sœur");
    expect(vus[0]?.invite).not.toContain("elle rit fort");
    // L'interdiction, elle, part TOUJOURS : ce n'est pas une matière qu'on
    // choisit d'employer, c'est un rejet de la personne.
    expect(vus[0]?.invite).toContain("les surprises");
    // Et le nom d'usage aussi : sans lui, il n'y a personne à qui écrire.
    expect(vus[0]?.invite).toContain("Léa");
  });

  /* Un modèle qu'on ne connaît pas n'est pas une panne, c'est une erreur de
     saisie : on refuse AVANT d'écrire quoi que ce soit, plutôt que d'écrire
     une ligne de dépense qui ne se rattache à aucun modèle du catalogue. */
  it("refuse un modèle absent du catalogue sans rien écrire", async () => {
    monter({ anthropic: faux(() => ({ contenu: "voilà" })) });
    const p = (await profil()).id;

    await expect(essais.essayer(adminId, reglages(), p)).rejects.toMatchObject({ code: "validation_failed" });
    expect(await db.prisma.studioConfig.count()).toBe(0);
    expect(await db.prisma.studioTrial.count()).toBe(0);
  });

  /* Une clé d'API manquante : le routeur saute au rang suivant, ici il n'y a
     pas de suivant. On le NOMME plutôt que de rendre une erreur nue — le
     brouillon est déjà écrit, et l'établi doit dire lequel des trois cas s'est
     produit. Aucune ligne d'usage : rien n'a été appelé, donc rien n'a coûté. */
  it("nomme le fournisseur injoignable et ne facture rien", async () => {
    monter({});
    await modele("anthropic", "demande");

    const { essai } = await essais.essayer(adminId, reglages(), (await profil()).id);
    expect(essai.etat).toBe("error");
    expect(essai.erreur).toBe("no_adapter_for_anthropic");
    expect(await db.prisma.aIUsage.count()).toBe(0);
  });
});
