import { describe, expect, it } from "vitest";
import { startGenerationSchema } from "@lehno/contracts";
import {
  cleDeDemande, composeLaDemande, etatDeLaPiste, pistesOffertes,
} from "../lib/preparation.js";

const OCCASION = "11111111-1111-4111-8111-111111111111";
const PROCHE = "22222222-2222-4222-8222-222222222222";

describe("les deux pistes, chacune sur son drapeau", () => {
  /* Les trois natures de génération sont TROIS drapeaux, pas un interrupteur.
     Au lancement seul le message est allumé : c'est le cas NOMINAL, et l'écran
     s'ouvre quand même — §3.7 tient dès qu'une des deux natures tient. */
  it("le message seul suffit — c'est le lancement", () => {
    const pistes = pistesOffertes({ nature: "happy" }, ["generation.message"]);
    expect(pistes.map((p) => p.kind)).toEqual(["wish_message"]);
  });

  it("les idées seules aussi", () => {
    const pistes = pistesOffertes({ nature: "happy" }, ["generation.ideas"]);
    expect(pistes.map((p) => p.kind)).toEqual(["gift_ideas"]);
  });

  it("les deux éteintes, il ne reste rien à proposer", () => {
    expect(pistesOffertes({ nature: "happy" }, [])).toEqual([]);
  });
});

describe("une occasion sensible n'a pas d'idées de cadeau", () => {
  /* La tonalité commande le ton de ce qui sera écrit, et FAIT DISPARAÎTRE les
     idées de cadeau — le contrat le dit sur `EVENT_NATURES`. On ne propose pas
     d'offrir quelque chose pour un deuil, et laisser le bouton grisé serait
     pire : il dirait qu'on y avait pensé. */
  it("retire les idées, garde le message", () => {
    const pistes = pistesOffertes(
      { nature: "sensitive" }, ["generation.message", "generation.ideas"],
    );
    expect(pistes.map((p) => p.kind)).toEqual(["wish_message"]);
  });

  // C'est même le seul moment où le message compte vraiment : une occasion
  // sensible sans aucune piste laisserait l'écran muet là où il sert le plus.
  it("laisse le message quand il est seul allumé", () => {
    expect(pistesOffertes({ nature: "sensitive" }, ["generation.message"]))
      .toHaveLength(1);
  });

  // Une occasion heureuse garde les deux : la règle ne vaut que pour ce qu'elle
  // vise, et l'étendre priverait tout le monde des idées.
  it("ne retire rien d'une occasion heureuse", () => {
    expect(pistesOffertes({ nature: "happy" }, ["generation.message", "generation.ideas"]))
      .toHaveLength(2);
  });
});

describe("la clé qui empêche de payer deux fois", () => {
  /* « Une même demande relancée rejoint la génération en cours et ne débite
     qu'une fois. » Encore faut-il qu'elle soit RECONNAISSABLE : une clé tirée
     au hasard à chaque appui ferait de deux touches maladroites deux
     générations, et deux débits. */
  it("rend la même clé pour la même demande", () => {
    expect(cleDeDemande("wish_message", OCCASION)).toBe(cleDeDemande("wish_message", OCCASION));
  });

  // Pas d'horodatage : il rendrait deux appuis distincts, ce qui est
  // précisément le cas qu'on veut fondre.
  it("ne dépend pas du moment", async () => {
    const avant = cleDeDemande("wish_message", OCCASION);
    await new Promise((r) => setTimeout(r, 5));
    expect(cleDeDemande("wish_message", OCCASION)).toBe(avant);
  });

  /* Mais deux demandes DIFFÉRENTES restent différentes : fondre le message et
     les idées d'une même occasion ne rendrait qu'une production sur deux. */
  it("distingue les natures et les cibles", () => {
    expect(cleDeDemande("wish_message", OCCASION)).not.toBe(cleDeDemande("gift_ideas", OCCASION));
    expect(cleDeDemande("wish_message", OCCASION)).not.toBe(cleDeDemande("wish_message", PROCHE));
  });

  it("tient dans la borne du contrat", () => {
    expect(cleDeDemande("wish_message", OCCASION).length).toBeLessThanOrEqual(128);
  });
});

describe("ce qu'on envoie passe le contrat", () => {
  /* La cible dépend de la nature, et le contrat REFUSE les deux ensemble. Les
     corps sont repassés dans le schéma réel : sans ça, le test ne prouverait
     que notre cohérence avec nous-mêmes. */
  it("un message vise une occasion, jamais un proche", () => {
    const corps = composeLaDemande("wish_message", OCCASION);
    expect(startGenerationSchema.safeParse(corps).success).toBe(true);
    expect("personId" in corps).toBe(false);
  });

  it("un portrait vise un proche, jamais une occasion", () => {
    const corps = composeLaDemande("portrait", PROCHE);
    expect(startGenerationSchema.safeParse(corps).success).toBe(true);
    expect("occurrenceId" in corps).toBe(false);
  });

  it("les idées visent une occasion", () => {
    expect(startGenerationSchema.safeParse(composeLaDemande("gift_ideas", OCCASION)).success)
      .toBe(true);
  });

  /* Le contrat refuse ce que nous ne composons jamais. Ce test montre ce que
     l'inversion aurait cassé — et il rougirait si la règle bougeait d'un côté
     sans l'autre. */
  it("le contrat refuse les deux cibles ensemble", () => {
    const r = startGenerationSchema.safeParse({
      kind: "wish_message", occurrenceId: OCCASION, personId: PROCHE,
    });
    expect(r.success).toBe(false);
  });
});

describe("ce qui existe ne se redemande pas", () => {
  /* Une occasion qui porte déjà un message produit n'offre plus « Préparer »
     mais « Voir ». Reproposer le geste initial ferait repayer sans le dire —
     le crédit est débité à la DEMANDE, pas à l'affichage. */
  it("bascule sur « voir » quand la production existe", () => {
    expect(etatDeLaPiste(true)).toBe("a_voir");
    expect(etatDeLaPiste(false)).toBe("a_faire");
  });
});
