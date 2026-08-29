import { describe, expect, it } from "vitest";
import type {
  GeneratedMessage, Generation, GenerationResult, Occurrence,
} from "@lehno/contracts";
import {
  LONGUEUR_DE_LEXTRAIT, NATURES, composeLesReprises, extraitDe, fenetreDesReprises, ordonne,
  type Reprise,
} from "../lib/reprises.js";

/* Les profils du handoff, exprimés comme le serveur les rend : la liste
   RÉSOLUE de ce qui est actif. LANCEMENT est le cas NOMINAL — seul le message
   y est allumé —, pas une variante à traiter en dernier. */
const TOUT = ["generation.message", "generation.ideas", "generation.portrait", "credits"];
const LANCEMENT = ["collect", "generation.message", "credits", "topup.manual", "referral"];
const PORTRAIT_FERME = TOUT.filter((c) => c !== "generation.portrait");
const IDEES_SEULES = ["generation.ideas", "credits"];
const RIEN: string[] = [];

function uuid(n: number): string {
  return `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
}

function echeance(n: number, jours: number, qui = `Proche ${n}`): Occurrence {
  return {
    id: uuid(n),
    eventId: uuid(900 + n),
    personId: uuid(800 + n),
    personDisplayName: qui, kind: "birthday", nature: "happy",
    label: null, occurrenceDate: "2026-09-01", occurrenceYear: 2026,
    status: "upcoming", daysUntil: jours, age: null,
  };
}

function execution(
  n: number,
  {
    kind = "wish_message", status = "succeeded", vise = null, texte = "Un mot pour ses trente ans",
  }: {
    kind?: Generation["kind"];
    status?: Generation["status"];
    vise?: number | null;
    texte?: string;
  } = {},
): GenerationResult {
  /* Le résultat n'existe qu'une fois l'exécution aboutie — le contrat le dit
     nul tant qu'elle tourne. La fixture le tient, sans quoi elle modèlerait un
     état que le serveur ne sert jamais, et cacherait ce que l'écran doit
     savoir dire pendant l'attente. */
  const message: GeneratedMessage | null = vise === null || status !== "succeeded" ? null : {
    id: uuid(700 + n),
    occurrenceId: uuid(vise),
    content: texte, contentShort: null, status: "generated",
    createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z",
  };
  return {
    generation: {
      id: uuid(100 + n), kind, status, creditsSpent: 1,
      /* La cible vient désormais de l'EXÉCUTION, plus seulement du message
         produit : c'est ce qui donne un nom à une reprise encore en cours. */
      personId: kind === "portrait" && vise !== null ? uuid(vise) : null,
      occurrenceId: kind !== "portrait" && vise !== null ? uuid(vise) : null,
      failureReason: status === "failed" ? "provider_error" : null,
      resultId: message?.id ?? null,
      createdAt: "2026-08-01T10:00:00.000Z",
    },
    message,
  };
}

function reprise(jours: number | null, id = String(jours)): Reprise {
  return {
    id, kind: "wish_message", libelle: "repriseBrouillon", icone: "pencil",
    qui: "Proche", jours, extrait: null, enCours: jours === null,
  };
}

describe("les trois natures sont trois drapeaux", () => {
  /* Au lancement, SEUL LE MESSAGE est allumé. C'est le cas nominal : une liste
     qui supposerait les trois ouvertes proposerait de reprendre des portraits
     que le produit ne sait pas encore produire. */
  it("au lancement, ne garde que les brouillons de message", () => {
    const liste = composeLesReprises(
      [
        execution(1, { kind: "wish_message", vise: 1 }),
        execution(2, { kind: "gift_ideas" }),
        execution(3, { kind: "portrait" }),
      ],
      [echeance(1, 3)],
      LANCEMENT,
    );
    expect(liste.map((r) => r.kind)).toEqual(["wish_message"]);
  });

  // La combinaison inverse, celle qui éprouve le plus l'écran : la piste qui
  // reste n'est pas celle qu'il ouvrait d'ordinaire.
  it("garde les idées seules quand c'est la seule nature ouverte", () => {
    const liste = composeLesReprises(
      [execution(1, { kind: "wish_message", vise: 1 }), execution(2, { kind: "gift_ideas" })],
      [echeance(1, 3)],
      IDEES_SEULES,
    );
    expect(liste.map((r) => r.kind)).toEqual(["gift_ideas"]);
  });

  it("« Portrait fermé » laisse le message et les idées", () => {
    const liste = composeLesReprises(
      [
        execution(1, { kind: "portrait" }),
        execution(2, { kind: "gift_ideas" }),
        execution(3, { kind: "wish_message", vise: 1 }),
      ],
      [echeance(1, 3)],
      PORTRAIT_FERME,
    );
    expect(liste.map((r) => r.kind).sort()).toEqual(["gift_ideas", "wish_message"]);
  });

  /* Aucune nature ouverte : l'écran se replie sur son état vide. Il n'a plus de
     raison d'être, et des lignes qui ne reprennent rien vaudraient moins. */
  it("ne rend rien quand aucune nature n'est ouverte", () => {
    const liste = composeLesReprises(
      [execution(1, { vise: 1 }), execution(2, { kind: "portrait" })],
      [echeance(1, 3)],
      RIEN,
    );
    expect(liste).toEqual([]);
  });

  /* LE DRAPEAU GOUVERNE LA PORTE, pas le contenu. La carte n'existe que pour
     son bouton « Reprendre », et il mène à un écran que `ecranEteint` retire.
     Le message déjà payé reste lisible par `/me/messages/{id}`, qui n'est pas
     sous le même drapeau — on retire un raccourci, pas un contenu. */
  it("retire une reprise dont la nature vient d'être éteinte", () => {
    const deja = [execution(1, { kind: "portrait" })];
    expect(composeLesReprises(deja, [], TOUT)).toHaveLength(1);
    expect(composeLesReprises(deja, [], PORTRAIT_FERME)).toEqual([]);
  });

  /* Une table TOTALE, pas un `switch` : une quatrième nature livrée sans son
     drapeau paraîtrait quel que soit l'état du registre. */
  it("chaque nature du contrat a son drapeau et son libellé", () => {
    for (const [kind, nature] of Object.entries(NATURES)) {
      expect(nature.drapeau, kind).toMatch(/^generation\./);
      expect(nature.libelle, kind).toMatch(/^reprise/);
      expect(nature.icone, kind).not.toBe("");
    }
  });
});

describe("ce que l'écran retient", () => {
  /* L'écran montre ce que le serveur PRODUIT et ce qu'il A PRODUIT. Un échec a
     rendu son crédit et n'a rien laissé : « Reprendre » n'y reprendrait rien. */
  it("écarte les échecs, garde ce qui tourne et ce qui a abouti", () => {
    const liste = composeLesReprises(
      [
        execution(1, { status: "failed", vise: 1 }),
        execution(2, { status: "running" }),
        execution(3, { status: "succeeded", vise: 1 }),
      ],
      [echeance(1, 3)],
      TOUT,
    );
    expect(liste.map((r) => r.enCours)).toEqual([false, true]);
  });

  /* L'identifiant de l'EXÉCUTION, jamais celui du résultat : c'est l'exécution
     qu'on reprend, et une exécution en cours n'a pas encore de résultat. */
  it("porte l'identifiant de l'exécution", () => {
    const [r] = composeLesReprises([execution(4, { vise: 1 })], [echeance(1, 3)], TOUT);
    expect(r?.id).toBe(uuid(104));
  });

  /* La cible se lit à travers le RÉSULTAT, et il est nul tant que l'exécution
     n'a pas abouti. Une reprise `running` n'a donc ni nom ni décompte — la
     carte se replie plutôt que d'inventer une cible. */
  it("laisse la cible vide tant que la production n'a pas abouti", () => {
    const [r] = composeLesReprises([execution(5, { status: "running" })], [echeance(1, 3)], TOUT);
    expect(r).toMatchObject({ qui: null, jours: null, extrait: null, enCours: true });
  });

  it("nomme la cible et son décompte quand l'échéance est connue", () => {
    const [r] = composeLesReprises(
      [execution(6, { vise: 2 })], [echeance(1, 40, "Sarah"), echeance(2, 3, "Célarine")], TOUT,
    );
    expect(r).toMatchObject({ qui: "Célarine", jours: 3 });
  });

  /* La jointure peut manquer sans que ce soit un défaut : l'échéance visée peut
     tomber hors de la fenêtre ou au-delà du plafond de la page. Mieux vaut une
     carte sans nom qu'un nom emprunté à une autre — le défaut le plus coûteux
     de l'écran serait de proposer de reprendre un mot au nom de quelqu'un
     d'autre. */
  it("n'emprunte pas le nom d'une autre échéance quand la sienne manque", () => {
    const [r] = composeLesReprises(
      [execution(7, { vise: 42 })], [echeance(1, 3, "Sarah")], TOUT,
    );
    expect(r).toMatchObject({ qui: null, jours: null });
    // Le brouillon existe, lui : il ne disparaît pas parce que sa date manque.
    expect(r?.extrait).not.toBeNull();
  });
});

describe("du plus urgent au moins urgent", () => {
  /* L'occasion la plus proche d'abord, et non la dernière commencée : ce qui
     presse n'est pas ce qu'on a commencé en dernier. */
  it("met la plus proche en tête", () => {
    expect(ordonne([reprise(12), reprise(0), reprise(3)]).map((r) => r.jours))
      .toEqual([0, 3, 12]);
  });

  // « Les dates dépassées ferment la liste » : le travail existe encore, mais
  // il ne presse plus, et le laisser en tête repousserait sous le pli ce qui
  // tombe demain.
  it("referme la liste sur les dates dépassées", () => {
    expect(ordonne([reprise(-6), reprise(12), reprise(0)]).map((r) => r.jours))
      .toEqual([0, 12, -6]);
  });

  /* Entre dépassées, LA PLUS RÉCENTE D'ABORD — l'inverse du kit, qui les trie
     comme les autres. Il n'avait qu'une date passée sur sa planche, donc
     l'ordre ne s'y voyait pas ; à trois, son tri croissant enterre au fond
     celle d'avant-hier, la seule qu'on puisse encore rattraper. */
  it("place la plus fraîchement dépassée avant la plus ancienne", () => {
    expect(ordonne([reprise(-270), reprise(-2), reprise(-30)]).map((r) => r.jours))
      .toEqual([-2, -30, -270]);
  });

  /* Une exécution en cours n'a pas de cible, donc pas d'urgence à comparer. La
     mettre après les dépassées la ferait passer pour close alors qu'elle
     travaille. */
  it("range ce qui n'a pas de date entre l'à-venir et le dépassé", () => {
    expect(ordonne([reprise(-6), reprise(null), reprise(3)]).map((r) => r.jours))
      .toEqual([3, null, -6]);
  });

  // Le tri est STABLE, et on s'en sert : dans le groupe sans date, l'ordre reçu
  // du serveur — le plus récent d'abord — est déjà le bon.
  it("garde l'ordre reçu entre deux reprises sans date", () => {
    expect(ordonne([reprise(null, "a"), reprise(null, "b")]).map((r) => r.id))
      .toEqual(["a", "b"]);
  });

  // Aujourd'hui n'est pas dépassé : `daysUntil` vaut 0 le jour même.
  it("ne rejette pas le jour même dans les dépassées", () => {
    expect(ordonne([reprise(0), reprise(-1)]).map((r) => r.jours)).toEqual([0, -1]);
  });

  it("ne bouscule pas une liste vide", () => {
    expect(ordonne([])).toEqual([]);
  });
});

describe("l'extrait", () => {
  /* Le repli des blancs vient d'abord : un message porte des paragraphes, et
     les laisser passer ferait une carte haute de six lignes au milieu d'une
     liste de cartes basses. */
  it("aplatit les retours à la ligne", () => {
    expect(extraitDe("Célarine,\n\n  cette année encore.")).toBe("Célarine, cette année encore.");
  });

  // Sur un mot entier : couper au caractère près donne « le moulin à ca… », et
  // on lit le défaut avant de lire la phrase.
  it("coupe sur un mot entier", () => {
    const extrait = extraitDe("a".repeat(40) + " " + "b".repeat(40) + " " + "c".repeat(40));
    expect(extrait).toBe("a".repeat(40) + " " + "b".repeat(40) + "…");
  });

  it("n'élide pas ce qui tient", () => {
    expect(extraitDe("Trois pistes, dont le moulin à café")).toBe("Trois pistes, dont le moulin à café");
  });

  // La ponctuation qui traînait avant l'élision ferait « le moulin,… ».
  it("ne laisse pas une virgule contre l'élision", () => {
    const texte = "x".repeat(LONGUEUR_DE_LEXTRAIT - 12) + ", encore un peu de texte après";
    expect(extraitDe(texte)).not.toMatch(/[,;:.]…$/u);
    expect(extraitDe(texte)?.endsWith("…")).toBe(true);
  });

  /* Nul plutôt que vide : la carte est alors obligée de traiter l'absence, au
     lieu d'afficher une citation qui ne cite rien. */
  it("rend nul plutôt qu'une citation vide", () => {
    expect(extraitDe("   \n  ")).toBeNull();
  });

  // Un mot unique plus long que la coupe n'a pas d'espace où se rompre : on
  // coupe quand même, plutôt que de rendre tout le pavé.
  it("coupe quand même un mot plus long que la limite", () => {
    const extrait = extraitDe("z".repeat(200));
    expect(extrait).toHaveLength(LONGUEUR_DE_LEXTRAIT + 1);
  });
});

describe("la fenêtre d'échéances", () => {
  /* DOUZE MOIS EN ARRIÈRE, contre un seul pour §3.14 : un brouillon peut dormir
     depuis un an, et « La date est passée » sans dire de qui il s'agit ne se
     reprend pas. */
  it("remonte d'un an et descend d'un an", () => {
    expect(fenetreDesReprises("2026-08-27")).toEqual({ from: "2025-08-27", to: "2027-08-27" });
  });
});

describe("une production en cours dit pour qui elle travaille", () => {
  /* LE DÉFAUT QUE LA CORRECTION DU CONTRAT A LEVÉ.
   *
   * La cible ne se lisait qu'à travers le résultat — `message.occurrenceId` —,
   * et « ce résultat est nul tant que l'exécution n'a pas abouti ». Une reprise
   * `running` n'avait donc ni nom ni décompte : l'écran disait qu'une
   * production était en cours sans dire pour qui, et la liste devenait une
   * liste d'identifiants.
   *
   * `occurrenceId` est désormais porté par l'EXÉCUTION, connu dès le
   * lancement. C'est justement au moment où l'on attend qu'on se demande pour
   * qui — et ce test rougirait si l'on revenait à ne lire que le résultat. */
  it("nomme sa cible avant d'avoir produit", () => {
    const [reprise] = composeLesReprises(
      [execution(1, { kind: "wish_message", status: "running", vise: 1 })],
      [echeance(1, 3)],
      LANCEMENT,
    );
    expect(reprise?.enCours).toBe(true);
    expect(reprise?.extrait).toBeNull();
    expect(reprise?.qui).toBe("Proche 1");
    expect(reprise?.jours).toBe(3);
  });

  /* Une cible qu'on ne sait pas joindre reste sans nom : l'échéance peut
     tomber hors de la fenêtre demandée. Mieux vaut une carte muette qu'un nom
     emprunté à quelqu'un d'autre — ce serait proposer de reprendre un mot au
     nom d'un tiers. */
  it("reste muette plutôt que d'emprunter un nom", () => {
    const [reprise] = composeLesReprises(
      [execution(1, { kind: "wish_message", status: "running", vise: 1 })],
      [echeance(2, 3)],
      LANCEMENT,
    );
    expect(reprise?.qui).toBeNull();
    expect(reprise?.jours).toBeNull();
  });
});
