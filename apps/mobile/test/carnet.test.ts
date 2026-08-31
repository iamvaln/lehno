import { describe, expect, it } from "vitest";
import type { Note } from "@lehno/contracts";
import { MESSAGES } from "../messages/index.js";
import { libelleDeLEcheance } from "../lib/libelles.js";
import type { TableDesCategories, Tri } from "../lib/carnet.js";
import {
  PAGE, basculeDeTri, chercheVraiment, dateCourte, interetsEtNotes,
  parametresDeRecherche, parametresDuCarnet,
  categoriesDeLaNote, estUnGardeFou, offreLeType, presseAssezPourSAfficher,
  resteACharger, sousTitreDuProche, TOPO_VISIBLE, topoReplie,
} from "../lib/carnet.js";

describe("le tri porte sa direction", () => {
  /* « Par date » ne dit rien tant qu'on ne sait pas de quel bout. Un second
     appui sur le critère ACTIF retourne le sens ; un appui sur l'autre
     critère repart au sens naturel, sans hériter du précédent — sinon
     passer de « date, au plus loin » à l'alphabet donnerait Z–A sans que
     personne ne l'ait demandé. */
  it("retourne le sens quand on réappuie sur le critère actif", () => {
    expect(basculeDeTri({ cle: "date", sens: "asc" }, "date")).toEqual({ cle: "date", sens: "desc" });
    expect(basculeDeTri({ cle: "date", sens: "desc" }, "date")).toEqual({ cle: "date", sens: "asc" });
  });

  it("repart au sens naturel en changeant de critère", () => {
    expect(basculeDeTri({ cle: "date", sens: "desc" }, "alpha")).toEqual({ cle: "alpha", sens: "asc" });
  });
});

describe("ce que le serveur reçoit", () => {
  /* Le tri et la pagination sont au SERVEUR, pas ici. Le carnet arrive par
     pages de vingt : trier la page reçue mettrait en tête le plus proche
     des vingt premiers, pas le plus proche du carnet. */
  it("porte le critère, le sens et la page", () => {
    expect(parametresDuCarnet({ cle: "alpha", sens: "desc" }, 40))
      .toBe("?sort=alpha&direction=desc&offset=40&limit=20");
  });

  it("demande la première page sans offset hérité", () => {
    expect(parametresDuCarnet({ cle: "date", sens: "asc" }, 0))
      .toBe("?sort=date&direction=asc&offset=0&limit=20");
  });
});

describe("le décompte ne paraît que s'il presse", () => {
  /* La liste montre « qui a une date qui approche », pas tout le monde classé
     par échéance — sans quoi elle redirait l'onglet Dates avec d'autres
     pixels. Sept jours est la limite du handoff. */
  it("s'affiche jusqu'à sept jours, le jour même compris", () => {
    expect(presseAssezPourSAfficher(0)).toBe(true);
    expect(presseAssezPourSAfficher(7)).toBe(true);
    expect(presseAssezPourSAfficher(8)).toBe(false);
  });

  // `daysUntil` est SIGNÉ. Une prochaine échéance ne devrait pas être passée,
  // mais si elle l'est, « J−−3 » n'a aucun sens : on n'affiche rien.
  it("ne s'affiche pas pour une échéance déjà passée", () => {
    expect(presseAssezPourSAfficher(-1)).toBe(false);
  });

  it("ne s'affiche pas sans date du tout", () => {
    expect(presseAssezPourSAfficher(null)).toBe(false);
  });
});

describe("« Voir plus · n restants »", () => {
  it("compte ce qui reste au serveur, pas ce qui est à l'écran", () => {
    expect(resteACharger(43, 20)).toBe(23);
    expect(resteACharger(43, 40)).toBe(3);
  });

  // Jamais négatif : un total qui rétrécit entre deux pages — une fiche
  // supprimée ailleurs — proposerait sinon de charger « −2 restants ».
  it("ne descend pas sous zéro", () => {
    expect(resteACharger(43, 60)).toBe(0);
  });

  it("pagine par vingt, la page du handoff", () => {
    expect(PAGE).toBe(20);
  });
});

/* La table que `/me/metadata` sert : sept catégories, chacune avec sa nature
   et son caractère de contrainte. C'est le SERVEUR qui les porte — aucune
   énumération ne dit qu'un no-go contraint la génération. */
const TABLE = [
  { code: "gift_ideas", kind: "ponctuelle", isConstraint: false },
  { code: "message_ideas", kind: "ponctuelle", isConstraint: false },
  { code: "facts", kind: "ponctuelle", isConstraint: false },
  { code: "encouragements", kind: "ponctuelle", isConstraint: false },
  { code: "challenges", kind: "ponctuelle", isConstraint: false },
  { code: "interests", kind: "durable", isConstraint: false },
  { code: "dislikes_nogo", kind: "durable", isConstraint: true },
] as const satisfies TableDesCategories;

describe("ce qu'une note annonce", () => {
  const note = (categories: Note["categories"]): Note => ({
    id: "11111111-1111-4111-8111-111111111111",
    personId: "22222222-2222-4222-8222-222222222222",
    content: "vinyles", eventOccurrenceId: null, categories, createdAt: "2026-08-01T00:00:00Z",
  });

  /* Le défaut vu à l'écran : « Danielle a une allergie aux fruits à coque »,
     rangée en « Faits marquants », s'affichait « IDÉE ». La fiche pliait sept
     catégories en deux, et se trompait sur cinq. */
  it("annonce sa catégorie, pas une de deux", () => {
    expect(categoriesDeLaNote(note(["facts"]))).toEqual(["facts"]);
    expect(categoriesDeLaNote(note(["encouragements"]))).toEqual(["encouragements"]);
  });

  /* Une note peut relever de deux catégories quand elle sert deux usages : ce
     qu'un proche traverse relève des challenges ET de ce qu'il a besoin
     d'entendre. N'en montrer qu'une choisirait à sa place. */
  it("garde ses deux catégories quand elle en porte deux", () => {
    expect(categoriesDeLaNote(note(["challenges", "encouragements"]))).toHaveLength(2);
  });

  // Vide est un état VALIDE : une note que le système n'a pas su ranger reste
  // telle quelle, sans repli sur une catégorie fourre-tout.
  it("n'annonce rien quand elle n'est pas rangée", () => {
    expect(categoriesDeLaNote(note([]))).toEqual([]);
  });
});

describe("le garde-fou", () => {
  const note = (categories: Note["categories"]): Note => ({
    id: "11111111-1111-4111-8111-111111111111",
    personId: "22222222-2222-4222-8222-222222222222",
    content: "je ne bois pas", eventOccurrenceId: null, categories,
    createdAt: "2026-08-01T00:00:00Z",
  });

  /* `isConstraint` vient du SERVEUR. Le déduire du code — « celle qui
     s'appelle dislikes_nogo » — réécrirait chez nous une règle qui vit
     là-bas, et la ferait diverger au premier ajout. */
  it("se lit dans la table, pas dans le nom de la catégorie", () => {
    expect(estUnGardeFou(note(["dislikes_nogo"]), TABLE)).toBe(true);
    expect(estUnGardeFou(note(["facts"]), TABLE)).toBe(false);
  });

  // Une seule contrainte suffit : se tromper là-dessus fait proposer du vin à
  // quelqu'un qui ne boit pas.
  it("suffit d'une seule catégorie contraignante", () => {
    expect(estUnGardeFou(note(["facts", "dislikes_nogo"]), TABLE)).toBe(true);
  });

  // Une catégorie que cette version ne connaît pas ne contraint rien : elle
  // n'est pas dans la table, on ne peut rien en dire.
  it("ne contraint pas sur une catégorie absente de la table", () => {
    expect(estUnGardeFou(note(["interests"]), [])).toBe(false);
  });
});

describe("ce qui va en étiquette", () => {
  const note = (categories: Note["categories"]): Note => ({
    id: "11111111-1111-4111-8111-111111111111",
    personId: "22222222-2222-4222-8222-222222222222",
    content: "vinyles", eventOccurrenceId: null, categories, createdAt: "2026-08-01T00:00:00Z",
  });

  /* DURABLE et sans contrainte. Durable, parce qu'un goût vaut d'une année sur
     l'autre là où un challenge d'il y a deux ans ne vaut plus. Sans contrainte,
     parce qu'un no-go est durable lui aussi, et le ranger parmi les goûts le
     ferait lire comme une envie. */
  it("prend les durables qui ne contraignent pas", () => {
    const { interets, cartes } = interetsEtNotes(
      [note(["interests"]), note(["dislikes_nogo"]), note(["facts"])], TABLE,
    );
    expect(interets).toHaveLength(1);
    expect(cartes).toHaveLength(2);
  });

  // Une note rangée en étiquette ne reparaît pas plus bas : elle serait lue
  // deux fois.
  it("ne compte pas deux fois une note à plusieurs catégories", () => {
    const { interets, cartes } = interetsEtNotes([note(["interests", "facts"])], TABLE);
    expect(interets).toHaveLength(1);
    expect(cartes).toHaveLength(0);
  });

  // Sans table — elle n'est pas encore arrivée —, tout reste en carte. Rien ne
  // monte en étiquette sur une supposition.
  it("ne devine rien sans la table", () => {
    const { interets, cartes } = interetsEtNotes([note(["interests"])], []);
    expect(interets).toHaveLength(0);
    expect(cartes).toHaveLength(1);
  });
});

describe("la date en repère", () => {
  it("se dit dans la langue de lecture", () => {
    expect(dateCourte("2026-08-24", "fr")).toMatch(/24/);
    expect(dateCourte("2026-08-24", "en")).toMatch(/24/);
    expect(dateCourte("2026-08-24", "fr")).not.toEqual(dateCourte("2026-08-24", "en"));
  });

  /* Une date CIVILE n'a pas d'heure. La construire dans le fuseau local la
     ferait reculer d'un jour partout à l'ouest de Greenwich : le 1er août
     s'afficherait « 31 juil. » à Douala comme à New York. */
  it("ne recule pas d'un jour selon le fuseau", () => {
    expect(dateCourte("2026-08-01", "fr")).toMatch(/^1\b/);
    expect(dateCourte("2026-01-01", "fr")).toMatch(/^1\b/);
  });

  // L'année n'y figure pas : l'échéance est à venir, et l'écrire ferait lire
  // une date d'archive.
  it("ne dit pas l'année", () => {
    expect(dateCourte("2026-08-24", "fr")).not.toMatch(/2026/);
  });
});

describe("le sous-titre de la fiche", () => {
  it("se compose de ce qu'on sait", () => {
    expect(sousTitreDuProche(["Anniversaire", "24 août", "amical"]))
      .toBe("Anniversaire · 24 août · amical");
  });

  // Un morceau absent emporte son séparateur : « · · amical » se lirait comme
  // un défaut d'affichage plutôt que comme une information manquante.
  it("n'affiche pas les séparateurs de ce qui manque", () => {
    expect(sousTitreDuProche([null, null, "amical"])).toBe("amical");
    expect(sousTitreDuProche(["Anniversaire", null, null])).toBe("Anniversaire");
    expect(sousTitreDuProche([null, null, null])).toBe("");
  });
});

describe("les types d'événement ouverts", () => {
  /* `eventKinds` vient de `/me/metadata`, DÉJÀ FILTRÉ par le serveur. Tester
     `events.other` nous-mêmes referait son raisonnement, et s'en écarterait le
     jour où il change — c'est le contrat qui l'écrit, sur le chemin. */
  it("se lisent dans la liste servie, pas dans un drapeau", () => {
    expect(offreLeType(["birthday"], "other")).toBe(false);
    expect(offreLeType(["birthday", "other"], "other")).toBe(true);
  });

  // Rien tant que la réponse n'est pas là : on ne propose pas un choix qu'on
  // ne sait pas ouvert. Même l'anniversaire s'affirme depuis la liste.
  it("ne propose rien avant d'avoir lu", () => {
    expect(offreLeType([], "birthday")).toBe(false);
  });
});

describe("ce qu'un drapeau ferme, et ce qu'il ne ferme pas", () => {
  const t = MESSAGES.fr;

  /* IL FERME LA CRÉATION, JAMAIS L'EXISTANT. Un événement libre créé avant
     l'extinction reste lisible, modifiable, et ses échéances tombent toujours.
     Le masquer ferait disparaître les dates de quelqu'un parce qu'on a éteint
     un interrupteur — le pire défaut possible dans un produit dont c'est la
     seule promesse.

     Ce test tient l'affichage : `libelleDeLEcheance` ne prend AUCUNE liste de
     types ouverts. Lui en passer une serait le premier pas vers un masquage. */
  it("une échéance libre garde son libellé, quoi qu'on ait fermé", () => {
    expect(libelleDeLEcheance("other", "Soutenance", t)).toBe("Soutenance");
  });

  // Le libellé d'un événement libre est du CONTENU : il s'affiche tel quel,
  // sans traduction. Un anniversaire, lui, prend le sien au dictionnaire.
  it("ne traduit pas ce que l'utilisateur a écrit", () => {
    expect(libelleDeLEcheance("birthday", null, t)).toBe(t.typeAnniversaire);
    expect(libelleDeLEcheance("other", "Retraite de papa", t)).toBe("Retraite de papa");
  });
});

describe("le topo se replie", () => {
  /* Trois puces, puis « +N ». Onze attributs ne repoussent pas les actions de
     la fiche : c'est un aperçu, pas un dossier. */
  it("montre trois valeurs et compte le reste", () => {
    const onze = Array.from({ length: 11 }, (_, i) => i);
    const { vus, reste } = topoReplie(onze);
    expect(vus).toHaveLength(TOPO_VISIBLE);
    expect(reste).toBe(8);
  });

  it("ne compte rien quand tout tient", () => {
    expect(topoReplie([1, 2])).toEqual({ vus: [1, 2], reste: 0 });
  });

  /* Une liste vide est un état NORMAL, pas un défaut : une fiche neuve n'a
     rien appris encore. Le bloc n'existe alors pas — jamais une grille de
     cases vides qui attendraient d'être remplies, ce qui transformerait une
     extraction en questionnaire. */
  it("rend un vide franc plutôt qu'un reste négatif", () => {
    expect(topoReplie([])).toEqual({ vus: [], reste: 0 });
  });

  // La composition doit tenir avec deux valeurs comme avec onze — le contrat
  // le demande en toutes lettres.
  it("tient de zéro à onze", () => {
    for (let n = 0; n <= 11; n++) {
      const { vus, reste } = topoReplie(Array.from({ length: n }, (_, i) => i));
      expect(vus.length + reste, `${n}`).toBe(n);
      expect(vus.length, `${n}`).toBeLessThanOrEqual(TOPO_VISIBLE);
    }
  });
});

describe("la recherche passe par le serveur", () => {
  const tri: Tri = { cle: "date", sens: "asc" };

  /* Elle filtrait la page chargée, et pour l'éviter l'écran tirait le carnet
     ENTIER par pages de cent. Quatre allers-retours avant la première lettre
     tapée, refaits à chaque ouverture. */
  it("ajoute la requête aux paramètres de la liste", () => {
    expect(parametresDeRecherche(tri, 0, "ana"))
      .toBe("?sort=date&direction=asc&offset=0&limit=20&q=ana");
  });

  /* LE TRI COURANT SE GARDE. Le contrat veut que la recherche « se combine au
     tri et à la pagination » — §3.15 demande des résultats classés par
     proximité, qui est le tri de la liste. Forcer l'alphabétique changerait
     l'ordre sous les yeux de quelqu'un qui vient de taper une lettre. */
  it("n'impose pas son tri", () => {
    expect(parametresDeRecherche({ cle: "alpha", sens: "desc" }, 40, "ana"))
      .toContain("sort=alpha&direction=desc&offset=40");
  });

  /* Un nom porte des espaces, des apostrophes, parfois une esperluette. Sans
     encodage, « Marie & Ana » couperait l'URL en deux. */
  it("encode ce qu'on tape", () => {
    expect(parametresDeRecherche(tri, 0, "Marie & Ana")).toContain("q=Marie%20%26%20Ana");
    expect(parametresDeRecherche(tri, 0, "N'Dour")).toContain("q=N'Dour");
  });

  // Sans requête, c'est la liste — pas une recherche vide.
  it("retombe sur les paramètres de la liste quand rien n'est tapé", () => {
    expect(parametresDeRecherche(tri, 0, "   ")).toBe(parametresDuCarnet(tri, 0));
  });
});

describe("quand on cherche vraiment", () => {
  /* Le contrat borne à un caractère, mais une seule lettre rend presque tout
     le carnet : l'appel coûte autant que la liste et n'apprend rien. */
  it("attend deux caractères", () => {
    expect(chercheVraiment("a")).toBe(false);
    expect(chercheVraiment("an")).toBe(true);
  });

  it("ne compte pas les espaces", () => {
    expect(chercheVraiment("  a  ")).toBe(false);
    expect(chercheVraiment("")).toBe(false);
  });
});
