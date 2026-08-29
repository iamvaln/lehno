import { describe, expect, it } from "vitest";
import { createEventSchema, type EventKind } from "@lehno/contracts";
import { MESSAGES } from "../messages/index.js";
import {
  JOURS_DE_RAPPEL, RANG_DE_RAPPEL_PAR_DEFAUT,
  anneesOffertes, aujourdhuiCivil, borneLeJour, corpsDeCreation, dateDEvenement,
  demandeLAnnee, demandeLaDate, demandeLeChoixDuType, demandeLeLibelle,
  enToutesLettres, joursJusqua, lireLeRefus, nomsDesMois, pretAEnregistrer,
  prochaineEcheance, regleDeRappel, typeInitial, typesOfferts,
} from "../lib/evenement.js";

// Un identifiant qui passe le `.uuid()` du contrat : les corps composés ici
// sont éprouvés PAR le schéma, pas par une relecture à l'œil.
const QUELQUUN = "3f1a2b4c-5d6e-4f70-8901-23456789abcd";

/* LE CAS DU LANCEMENT — une seule nature ouverte — N'EST PAS UNE VARIANTE.
 *
 * `events.other` éteint, `/me/metadata` rend `["birthday"]`. C'est ce que
 * l'application voit à l'ouverture, et c'est donc le cas nominal ; les deux
 * types ouverts sont la variante à venir. Les deux sont éprouvés, et l'état où
 * la liste n'est pas encore arrivée avec eux.
 */
describe("le type vient des métadonnées, jamais du drapeau", () => {
  it("au lancement, une seule nature : rien à choisir", () => {
    const ouverts: EventKind[] = ["birthday"];
    expect(typesOfferts(ouverts)).toEqual(["birthday"]);
    expect(demandeLeChoixDuType(ouverts)).toBe(false);
    expect(typeInitial(ouverts)).toBe("birthday");
  });

  it("les deux natures ouvertes : la rangée paraît", () => {
    const ouverts: EventKind[] = ["birthday", "other"];
    expect(demandeLeChoixDuType(ouverts)).toBe(true);
    expect(typeInitial(ouverts)).toBe("birthday");
  });

  /* L'anniversaire est MIS EN AVANT (§3.6). Une réponse qui rendrait la liste
     dans l'autre sens ne doit pas déplacer la première pastille sous le doigt,
     ni faire s'ouvrir le formulaire sur « autre ». */
  it("met l'anniversaire en tête quel que soit l'ordre reçu", () => {
    expect(typesOfferts(["other", "birthday"])).toEqual(["birthday", "other"]);
    expect(typeInitial(["other", "birthday"])).toBe("birthday");
  });

  /* Tant que la réponse n'est pas là, on ne propose RIEN qu'on ne sache
     ouvert. Ouvrir sur « anniversaire » par défaut serait présumer d'une liste
     qu'on n'a pas lue — et c'est exactement ce qui fait recevoir le filet du
     serveur. */
  it("ne propose rien tant que la liste n'est pas arrivée", () => {
    expect(typesOfferts([])).toEqual([]);
    expect(demandeLeChoixDuType([])).toBe(false);
    expect(typeInitial([])).toBeNull();
  });

  it("n'enregistre pas sans type connu", () => {
    expect(pretAEnregistrer({ personId: QUELQUUN, kind: null, libelle: "", date: "" })).toBe(false);
  });
});

describe("ce que chaque type demande", () => {
  /* La date d'un anniversaire se CALCULE depuis `person.birthDate`. Des
     sélecteurs seraient du décor : on choisirait le 4 mars et l'événement
     tomberait à la date de la fiche. */
  it("un anniversaire ne demande ni date, ni année, ni libellé", () => {
    expect(demandeLaDate("birthday")).toBe(false);
    expect(demandeLAnnee("birthday")).toBe(false);
    expect(demandeLeLibelle("birthday")).toBe(false);
  });

  it("un événement libre demande les trois", () => {
    expect(demandeLaDate("other")).toBe(true);
    expect(demandeLAnnee("other")).toBe(true);
    expect(demandeLeLibelle("other")).toBe(true);
  });

  it("n'enregistre un événement libre ni sans libellé ni sans date", () => {
    const base = { personId: QUELQUUN, kind: "other" as const };
    expect(pretAEnregistrer({ ...base, libelle: "  ", date: "2027-03-04" })).toBe(false);
    expect(pretAEnregistrer({ ...base, libelle: "Mariage", date: "" })).toBe(false);
    expect(pretAEnregistrer({ ...base, libelle: "Mariage", date: "2027-03-04" })).toBe(true);
  });

  /* PAS de date de naissance exigée du proche ici : le serveur la réclame, et
     c'est lui qui a le dernier mot. Deux règles pour une, et la nôtre se
     tromperait sur une fiche corrigée ailleurs entre-temps. */
  it("laisse enregistrer un anniversaire dès qu'un proche est désigné", () => {
    expect(pretAEnregistrer({ personId: QUELQUUN, kind: "birthday", libelle: "", date: "" })).toBe(true);
    expect(pretAEnregistrer({ personId: null, kind: "birthday", libelle: "", date: "" })).toBe(false);
  });
});

describe("la prochaine échéance d'un anniversaire", () => {
  it("prend l'année en cours quand la date est encore devant", () => {
    expect(prochaineEcheance("1990-12-24", "2026-08-27")).toBe("2026-12-24");
  });

  it("passe à l'année suivante quand elle est derrière", () => {
    expect(prochaineEcheance("1990-03-04", "2026-08-27")).toBe("2027-03-04");
  });

  /* Le jour même EST à venir. C'est la règle du serveur — `echeances` part de
     « depuis » inclus — et deux réponses différentes feraient afficher une
     date que la fiche contredit toute la journée. */
  it("compte le jour même, pas l'année prochaine", () => {
    expect(prochaineEcheance("1990-08-27", "2026-08-27")).toBe("2026-08-27");
  });

  /* Un 29 février se marque le 28 les années communes : le dictionnaire de
     données tranche ainsi. Sans cette borne, on composerait « 2027-02-29 »,
     une date qui n'existe pas — et que le serveur ne rendrait jamais. */
  it("ramène le 29 février au 28 une année commune", () => {
    expect(prochaineEcheance("2000-02-29", "2027-01-10")).toBe("2027-02-28");
    expect(prochaineEcheance("2000-02-29", "2028-01-10")).toBe("2028-02-29");
  });

  // Jamais la naissance elle-même, si loin soit-elle.
  it("ne rend jamais la date de naissance", () => {
    expect(prochaineEcheance("1950-01-01", "2026-08-27")).toBe("2027-01-01");
  });
});

describe("l'année d'un événement libre", () => {
  it("propose celle où la date tombe ensuite, et la suivante", () => {
    expect(anneesOffertes(24, 12, "2026-08-27")).toEqual([2026, 2027]);
    expect(anneesOffertes(4, 3, "2026-08-27")).toEqual([2027, 2028]);
  });

  // Jamais en arrière : le contrat refuse une date d'événement passée, et
  // proposer 2026 ferait composer une saisie rejetée au bout du réseau.
  it("ne propose jamais une année révolue", () => {
    const [premiere] = anneesOffertes(1, 1, "2026-08-27");
    expect(premiere).toBe(2027);
  });
});

describe("le jour ne dépasse pas son mois", () => {
  it("ramène le 31 au dernier jour du mois court", () => {
    expect(borneLeJour(31, 4, 2027)).toBe(30);
    expect(borneLeJour(31, 12, 2027)).toBe(31);
  });

  it("suit les bissextiles", () => {
    expect(dateDEvenement(29, 2, 2027)).toBe("2027-02-28");
    expect(dateDEvenement(29, 2, 2028)).toBe("2028-02-29");
  });
});

describe("le décompte", () => {
  it("compte les jours qui séparent deux dates civiles", () => {
    expect(joursJusqua("2026-08-27", "2026-08-27")).toBe(0);
    expect(joursJusqua("2026-08-28", "2026-08-27")).toBe(1);
    expect(joursJusqua("2026-12-24", "2026-08-27")).toBe(119);
  });

  /* Une date civile n'a pas d'heure : la lire en heure locale la ferait reculer
     d'un jour à l'ouest de Greenwich, et « demain » s'afficherait
     « aujourd'hui » pour qui est à Douala comme pour qui est à Montréal. */
  it("franchit un changement d'heure sans perdre de journée", () => {
    expect(joursJusqua("2027-03-29", "2027-03-28")).toBe(1);
    expect(joursJusqua("2027-10-31", "2027-10-30")).toBe(1);
  });

  it("lit « aujourd'hui » dans le fuseau de l'appareil", () => {
    expect(aujourdhuiCivil(new Date(2026, 7, 27, 23, 30))).toBe("2026-08-27");
    expect(aujourdhuiCivil(new Date(2026, 0, 1, 0, 15))).toBe("2026-01-01");
  });
});

describe("les mois et les dates se disent dans la langue de l'écran", () => {
  it("nomme les douze mois, rang 1 à 12", () => {
    const fr = nomsDesMois("fr");
    expect(fr).toHaveLength(12);
    expect(fr[0]).toBe("janvier");
    expect(fr[11]).toBe("décembre");
    expect(nomsDesMois("en")[0]).toBe("January");
  });

  it("écrit la date en toutes lettres sans la décaler", () => {
    expect(enToutesLettres("2027-03-04", "fr")).toBe("jeudi 4 mars 2027");
    expect(enToutesLettres("2027-03-04", "en")).toBe("Thursday, March 4, 2027");
  });
});

/* LE DICTIONNAIRE PORTE LES MOTS, LE MODULE PORTE LES JOURS, et l'ordre est le
   contrat entre les deux. Une option ajoutée d'un seul côté décalerait tous les
   délais en silence — « La veille » enverrait trois jours. */
describe("le rappel, entre le dictionnaire et le contrat", () => {
  it("a autant de délais que le dictionnaire a de choix, dans les deux langues", () => {
    expect(JOURS_DE_RAPPEL).toHaveLength(MESSAGES.fr.evtRappelChoix.length);
    expect(JOURS_DE_RAPPEL).toHaveLength(MESSAGES.en.evtRappelChoix.length);
  });

  it("ouvre sur le choix que le dictionnaire annonce comme défaut", () => {
    expect(MESSAGES.fr.evtRappelChoix[RANG_DE_RAPPEL_PAR_DEFAUT]).toBe(MESSAGES.fr.evtRappelDefaut);
    expect(MESSAGES.en.evtRappelChoix[RANG_DE_RAPPEL_PAR_DEFAUT]).toBe(MESSAGES.en.evtRappelDefaut);
    expect(JOURS_DE_RAPPEL[RANG_DE_RAPPEL_PAR_DEFAUT]).toBe(7);
  });

  /* Le serveur n'applique sa règle annuelle par défaut que si `schedules` est
     ABSENT. Envoyer un délai sans réécrire l'annuelle ferait donc perdre la
     récurrence, et l'anniversaire ne reviendrait jamais. */
  it("garde la récurrence annuelle d'un anniversaire en posant le délai", () => {
    expect(regleDeRappel("birthday", 3)).toEqual([
      { type: "recurrent", unit: "year", interval: 1, leadTimeDays: 3 },
    ]);
  });

  // Un événement libre tombe une fois : une règle annuelle ferait revenir un
  // mariage tous les ans. Un décalage nul, c'est sa propre date.
  it("ne fait pas récurrer un événement libre", () => {
    expect(regleDeRappel("other", 7)).toEqual([
      { type: "offset", offsetUnit: "day", offsetAmount: 0, leadTimeDays: 7 },
    ]);
  });
});

describe("ce qui part au serveur", () => {
  /* Un anniversaire NE PORTE PAS `referenceDate` : elle se calcule depuis la
     naissance du proche. L'envoyer quand même la ferait ignorer, et le
     formulaire aurait menti sur ce qu'il enregistrait. */
  it("n'envoie ni date ni libellé pour un anniversaire", () => {
    const corps = corpsDeCreation({
      personId: QUELQUUN, kind: "birthday",
      libelle: "Mariage", date: "2027-03-04", rangDuRappel: 1,
    });
    expect(corps).not.toHaveProperty("referenceDate");
    expect(corps).not.toHaveProperty("label");
    expect(createEventSchema.safeParse(corps).success).toBe(true);
  });

  it("envoie la date et le libellé d'un événement libre, sans espaces parasites", () => {
    const corps = corpsDeCreation({
      personId: QUELQUUN, kind: "other",
      libelle: "  Mariage de Sarah  ", date: "2027-03-04", rangDuRappel: 3,
    });
    expect(corps.label).toBe("Mariage de Sarah");
    expect(corps.referenceDate).toBe("2027-03-04");
    expect(createEventSchema.safeParse(corps).success).toBe(true);
  });

  /* `nature` ne part pas : elle se DÉTECTE côté serveur et se corrige après
     coup (§3.6). La poser à la saisie demanderait de qualifier une date au
     moment où on la note. */
  it("ne qualifie pas la nature à la saisie", () => {
    const corps = corpsDeCreation({
      personId: QUELQUUN, kind: "birthday", libelle: "", date: "", rangDuRappel: 3,
    });
    expect(corps).not.toHaveProperty("nature");
  });
});

/* LE FILET DU SERVEUR NE SE MONTRE PAS.
 *
 * `422 resource_inactive` dit que NOTRE écran a proposé un type que la liste ne
 * portait plus. C'est un défaut chez nous ; le traduire en message ferait
 * porter à quelqu'un la faute d'une liste que nous n'avons pas relue.
 */
describe("ce qu'on fait d'un refus", () => {
  it("relit les métadonnées en silence sur un type fermé", () => {
    expect(lireLeRefus(422, "resource_inactive")).toBe("relire");
  });

  /* Celui-là, lui, se montre : un proche sans date de naissance ne peut pas
     recevoir d'anniversaire, et c'est une fiche incomplète — pas une liste
     périmée. Le même statut, un autre code, une autre suite. */
  it("montre le refus d'un proche sans date de naissance", () => {
    expect(lireLeRefus(422, "validation_failed")).toBe("dire");
  });

  // Un proche n'a qu'un anniversaire. Le kit a une phrase qui nomme la personne
  // et la date ; « conflit avec l'état actuel » ne dit rien à personne.
  it("nomme le conflit d'un second anniversaire", () => {
    expect(lireLeRefus(409, "conflict")).toBe("deja");
  });

  it("dit tout le reste", () => {
    expect(lireLeRefus(500, "internal_error")).toBe("dire");
    expect(lireLeRefus(503, null)).toBe("dire");
    // 409 sans ce code vient d'ailleurs : on ne promet pas une modification
    // qu'on n'a pas de quoi ouvrir.
    expect(lireLeRefus(409, "validation_failed")).toBe("dire");
  });
});
