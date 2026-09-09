import { describe, expect, it } from "vitest";
import {
  startGenerationSchema, studioConfigSchema, valideSelection,
  type Portrait, type StudioConfig,
} from "@lehno/contracts";
import {
  apresLeChoix, approbation, changementDeSignature, etatDuPortrait, feuilleDePartage,
  laFeuilleDeposeUnFichier, laProductionEstRefusee,
  motDAccompagnement, offreDeRefaire, ouverture, relanceDuPortrait,
  selectionParDefaut, signatureARemettre,
} from "../lib/portrait.js";

const PORTRAIT = "11111111-1111-4111-8111-111111111111";
const PROCHE = "22222222-2222-4222-8222-222222222222";
const IMAGE = "https://images.lehno.io/portraits/abcdef.png";

const portrait = (sur: Partial<Portrait> = {}): Portrait => ({
  id: PORTRAIT,
  personId: PROCHE,
  status: "generated",
  content: "Tu refais le monde à minuit et tu nous ramènes au concret le lendemain.",
  contentShort: null,
  senderNote: "Fait avec soin par Valentine",
  imageUrl: null,
  createdAt: "2026-08-22T09:00:00.000Z",
  ...sur,
});

/* Le catalogue est passé par le SCHÉMA RÉEL : un fixture qui ne serait pas un
   catalogue valide ferait passer des tests sur une forme que le serveur ne peut
   pas servir — et ce sont justement les révélations qu'on éprouve ici. */
const CATALOGUE: StudioConfig = studioConfigSchema.parse({
  rootGroupIds: ["voie", "ambiance"],
  groups: [
    {
      id: "voie", label: "L'image", defaultChoiceId: "illustration",
      choices: [
        { id: "illustration", label: "Une illustration", description: null, warning: null, revealsGroup: "famille" },
        { id: "photo", label: "Une photo traitée", description: null, warning: null, revealsGroup: "style" },
        { id: "aucune", label: "Aucune", description: null, warning: null, revealsGroup: null },
      ],
    },
    {
      id: "famille", label: "La famille", defaultChoiceId: "nature",
      choices: [
        { id: "nature", label: "Nature", description: null, warning: null, revealsGroup: null },
        { id: "animal", label: "Animal", description: null, warning: null, revealsGroup: null },
      ],
    },
    {
      id: "style", label: "Le style", defaultChoiceId: "lumiere",
      choices: [
        { id: "lumiere", label: "La lumière", description: null, warning: null, revealsGroup: null },
        { id: "silhouette", label: "La silhouette", description: null, warning: null, revealsGroup: null },
      ],
    },
    {
      id: "ambiance", label: "L'ambiance", defaultChoiceId: "papier",
      choices: [
        { id: "papier", label: "Papier", description: null, warning: null, revealsGroup: null },
        { id: "encre", label: "Encre", description: null, warning: null, revealsGroup: null },
      ],
    },
  ],
});

describe("l'ouverture de l'écran", () => {
  it("lit le portrait quand l'identifiant est recevable", () => {
    expect(ouverture(PORTRAIT)).toEqual({ sorte: "lire", chemin: `/me/portraits/${PORTRAIT}` });
  });

  it("n'a rien à lire sans identifiant", () => {
    expect(ouverture(undefined)).toEqual({ sorte: "sans-objet" });
    expect(ouverture("")).toEqual({ sorte: "sans-objet" });
  });

  /* UN PARAMÈTRE DE ROUTE N'EST PAS DE CONFIANCE : `…/portrait?id=…` s'atteint
     par lien profond. Sans la garde de forme, ce qu'on y pose se colle au
     chemin — et un « ../ » sort du préfixe pour viser un autre chemin de /me. */
  it("refuse ce qui n'est pas un identifiant de portrait", () => {
    for (const pose of ["../account", "1 OR 1=1", "%2e%2e%2fwall", "abc"]) {
      expect(ouverture(pose), pose).toEqual({ sorte: "sans-objet" });
    }
  });
});

describe("les trois moments de l'écran", () => {
  it("un portrait produit reste à valider", () => {
    expect(etatDuPortrait(portrait())).toBe("avalider");
  });

  it("un portrait validé qui porte son image est prêt", () => {
    expect(etatDuPortrait(portrait({ status: "approved", imageUrl: IMAGE }))).toBe("pret");
  });

  /* LE CAS QU'ON OUBLIE. « L'image composée, produite à l'approbation » : entre
     les deux, il y a un instant où le portrait est validé et n'a pas d'image.
     Le dire « prêt » afficherait un cadre vide et offrirait un partage sur
     rien. */
  it("un portrait validé sans image attend encore sa composition", () => {
    expect(etatDuPortrait(portrait({ status: "approved" }))).toBe("composition");
  });
});

describe("approuver", () => {
  it("passe le portrait à validé", () => {
    expect(approbation(portrait())).toEqual({
      chemin: `/me/portraits/${PORTRAIT}`,
      corps: { status: "approved" },
    });
  });

  it("ne s'offre pas deux fois", () => {
    expect(approbation(portrait({ status: "approved", imageUrl: IMAGE }))).toBeNull();
  });
});

describe("la signature en pied", () => {
  it("se retire par null, jamais par une chaîne vide", () => {
    expect(changementDeSignature(portrait(), null)).toEqual({
      chemin: `/me/portraits/${PORTRAIT}`,
      corps: { senderNote: null },
    });
    // Une saisie vidée vaut un retrait : une chaîne vide serait une note qui
    // existe et ne s'affiche pas, et le gabarit lui garderait sa place.
    expect(changementDeSignature(portrait(), "   ")).toEqual({
      chemin: `/me/portraits/${PORTRAIT}`,
      corps: { senderNote: null },
    });
  });

  it("se remet telle qu'on l'écrit, sans ses blancs", () => {
    const envoi = changementDeSignature(portrait({ senderNote: null }), "  Fait par Valentine  ");
    expect(envoi?.corps).toEqual({ senderNote: "Fait par Valentine" });
  });

  /* Effleurer l'interrupteur puis le remettre est le geste le plus banal d'ici.
     Il ne doit pas laisser deux écritures derrière lui. */
  it("ne part pas quand rien ne change", () => {
    expect(changementDeSignature(portrait(), "Fait avec soin par Valentine")).toBeNull();
    expect(changementDeSignature(portrait({ senderNote: null }), null)).toBeNull();
    expect(changementDeSignature(portrait({ senderNote: null }), "")).toBeNull();
  });

  it("remet d'abord la note du portrait, puis celle qu'on vient de retirer", () => {
    expect(signatureARemettre(portrait(), null, "par valentine")).toBe("Fait avec soin par Valentine");
    expect(signatureARemettre(portrait({ senderNote: null }), "retirée à l'instant", "par valentine"))
      .toBe("retirée à l'instant");
    expect(signatureARemettre(portrait({ senderNote: null }), null, "par valentine")).toBe("par valentine");
  });
});

describe("enregistrer et partager", () => {
  const pret = portrait({ status: "approved", imageUrl: IMAGE });

  it("n'ouvre rien tant qu'il n'y a pas d'image", () => {
    expect(feuilleDePartage(portrait(), "partager", "un mot", "ios")).toBeNull();
    expect(feuilleDePartage(portrait({ status: "approved" }), "enregistrer", "", "ios")).toBeNull();
  });

  /* Un texte déposé dans la pellicule n'irait nulle part, et il ferait basculer
     la feuille en partage de texte, l'image en pièce jointe muette. */
  it("enregistrer ne joint aucun mot", () => {
    expect(feuilleDePartage(pret, "enregistrer", "un mot", "ios"))
      .toEqual({ sorte: "fichier", url: IMAGE });
  });

  it("partager joint le mot, et se passe d'un mot vide", () => {
    expect(feuilleDePartage(pret, "partager", " un mot ", "ios"))
      .toEqual({ sorte: "fichier", url: IMAGE, message: "un mot" });
    expect(feuilleDePartage(pret, "partager", "   ", "ios"))
      .toEqual({ sorte: "fichier", url: IMAGE });
  });

  /* LE DÉFAUT SILENCIEUX. `Share.share` ne lit `url` que sur iOS : ailleurs
     l'adresse est ignorée SANS ERREUR, la feuille s'ouvre vide, et rien ne le
     dit. On ne dépose donc un fichier que là où la feuille sait en prendre un ;
     ailleurs, c'est l'adresse qui circule, et l'enregistrement n'existe pas. */
  it("ne dépose un fichier que là où la feuille sait en prendre un", () => {
    expect(laFeuilleDeposeUnFichier("ios")).toBe(true);
    expect(laFeuilleDeposeUnFichier("android")).toBe(false);
    expect(laFeuilleDeposeUnFichier("autre")).toBe(false);
  });

  it("se replie sur l'adresse là où le fichier ne passe pas", () => {
    expect(feuilleDePartage(pret, "partager", "Pour toi", "android"))
      .toEqual({ sorte: "adresse", message: `Pour toi\n${IMAGE}` });
    expect(feuilleDePartage(pret, "partager", "  ", "android"))
      .toEqual({ sorte: "adresse", message: IMAGE });
  });

  it("n'offre pas d'enregistrer là où rien ne peut l'être", () => {
    expect(feuilleDePartage(pret, "enregistrer", "", "android")).toBeNull();
  });

  it("accompagne de la version courte, et se replie sur le texte long", () => {
    expect(motDAccompagnement(portrait({ contentShort: "Tu as tenu tout le monde debout." })))
      .toBe("Tu as tenu tout le monde debout.");
    expect(motDAccompagnement(portrait())).toBe(portrait().content);
  });
});

describe("refaire", () => {
  it("disparaît quand la production du portrait est éteinte", () => {
    expect(offreDeRefaire(["generation.portrait", "wall"])).toBe(true);
    expect(offreDeRefaire(["generation.message"])).toBe(false);
    expect(offreDeRefaire([])).toBe(false);
  });

  /* LA RÈGLE DU LANCEMENT NE SE RÉÉCRIT PAS ICI : le corps formé repasse par le
     schéma réel. C'est lui qui exige un proche, refuse une occasion, et
     n'accepte `studioSelection` que pour un portrait. */
  it("forme une demande que le contrat accepte", () => {
    const envoi = relanceDuPortrait(PROCHE, CATALOGUE, selectionParDefaut(CATALOGUE));
    expect(envoi?.chemin).toBe("/me/generations");
    const lu = startGenerationSchema.safeParse(envoi?.corps);
    expect(lu.success, JSON.stringify(lu.error?.issues)).toBe(true);
    expect(envoi?.corps).toMatchObject({ kind: "portrait", personId: PROCHE });
    expect(envoi?.corps).not.toHaveProperty("occurrenceId");
  });

  /* Le serveur revérifiera de toute façon — il décide seul —, mais un refus
     APRÈS le débit serait un crédit perdu pour une demande que le client savait
     incohérente. */
  it("ne part pas sur une sélection que le catalogue refuse", () => {
    expect(relanceDuPortrait(PROCHE, CATALOGUE, {})).toBeNull();
    expect(relanceDuPortrait(PROCHE, CATALOGUE, { voie: "inconnue", ambiance: "papier" })).toBeNull();
  });
});

/* LE SERVEUR N'ACCEPTE ENCORE QUE LE MESSAGE : toute autre nature est écartée
   par `resource_inactive`, avant tout débit. L'écran doit cesser de proposer le
   geste — sans quoi chaque appui rouvre une feuille qui annonce un prix pour un
   lancement déjà refusé — mais garder tout le reste : le refus porte sur la
   PRODUCTION, pas sur le portrait qu'on a sous les yeux. */
describe("le refus de produire", () => {
  it("retire l'offre quand la nature n'est pas ouverte", () => {
    expect(laProductionEstRefusee("resource_inactive")).toBe(true);
  });

  /* Un accident se réessaie. Retirer le bouton pour une coupure de réseau
     priverait quelqu'un d'un geste qui marchait la seconde d'avant. */
  it("ne la retire pour aucun accident", () => {
    for (const code of ["internal_error", "not_found", "validation_failed", "insufficient_credits"] as const) {
      expect(laProductionEstRefusee(code), code).toBe(false);
    }
    expect(laProductionEstRefusee(null)).toBe(false);
  });
});

describe("la voie et l'ambiance, telles que le catalogue les sert", () => {
  it("s'ouvre déjà réglée, et sur une sélection recevable", () => {
    const par = selectionParDefaut(CATALOGUE);
    expect(par).toEqual({ voie: "illustration", famille: "nature", ambiance: "papier" });
    expect(valideSelection(CATALOGUE, par)).toEqual([]);
  });

  /* LE PIÈGE DU CATALOGUE À RÉVÉLATIONS. On choisit « une illustration », sa
     famille paraît, on répond « animal » — puis on repasse à « une photo ». Le
     groupe des familles quitte l'écran, mais sa réponse resterait dans la
     sélection, et `valideSelection` la refuserait comme « hors-portée » : le
     bouton « Refaire » s'éteignait sans que rien à l'écran ne dise pourquoi. */
  it("élague ce qu'un choix vient de refermer", () => {
    const avec = apresLeChoix(CATALOGUE, selectionParDefaut(CATALOGUE), "famille", "animal");
    expect(avec).toEqual({ voie: "illustration", famille: "animal", ambiance: "papier" });

    const photo = apresLeChoix(CATALOGUE, avec, "voie", "photo");
    expect(photo).toEqual({ voie: "photo", style: "lumiere", ambiance: "papier" });
    expect(valideSelection(CATALOGUE, photo)).toEqual([]);

    const aucune = apresLeChoix(CATALOGUE, photo, "voie", "aucune");
    expect(aucune).toEqual({ voie: "aucune", ambiance: "papier" });
    expect(valideSelection(CATALOGUE, aucune)).toEqual([]);
  });

  it("garde ce qui reste atteignable quand on revient sur ses pas", () => {
    const encre = apresLeChoix(CATALOGUE, selectionParDefaut(CATALOGUE), "ambiance", "encre");
    expect(apresLeChoix(CATALOGUE, encre, "voie", "aucune")).toEqual({ voie: "aucune", ambiance: "encre" });
  });
});
