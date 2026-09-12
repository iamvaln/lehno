import { describe, expect, it } from "vitest";
import {
  createCollectionLinkSchema,
  type CollectionLink, type PublicCollectForm, type Submission,
} from "@lehno/contracts";
import {
  aTrancherPour, corpsDeCreation, dateDejaProposee, designeUneFiche,
  estVivant, etatDeLaCollecte, lienPublicVivant, lienVivantPour, proposeLeMur,
  recuesPour,
} from "../lib/collecte.js";

const uuid = (n: number): string =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

const lien = (n: number, p: Partial<CollectionLink> = {}): CollectionLink => ({
  id: uuid(n), type: "nominatif", token: `tok${n}`, personId: uuid(50),
  url: `https://lehno.io/c/tok${n}`, message: null, isActive: true, createdAt: "2026-08-01T00:00:00.000Z", ...p,
});

describe("un lien révoqué ne se rallume pas", () => {
  /* « Le lien est durable : pas d'expiration, seulement une révocation. » Le
     contrat n'offre que la création et la suppression. La copie propose
     « Réactiver un lien » et se contredit deux lignes plus bas — « vous pouvez
     en créer un autre ». C'est la seconde qui dit vrai. */
  it("distingue le vivant du révoqué", () => {
    expect(estVivant(lien(1))).toBe(true);
    expect(estVivant(lien(2, { isActive: false }))).toBe(false);
  });
});

describe("le lien qu'on montre pour une fiche", () => {
  /* Plusieurs révoqués peuvent traîner derrière un proche — créé, révoqué,
     recréé. En montrer plusieurs ferait choisir entre des adresses dont une
     seule répond. */
  it("écarte les révoqués", () => {
    const trouve = lienVivantPour([
      lien(1, { isActive: false }), lien(2),
    ], uuid(50));
    expect(trouve?.id).toBe(uuid(2));
  });

  it("ne rend rien quand aucun ne vit", () => {
    expect(lienVivantPour([lien(1, { isActive: false })], uuid(50))).toBeNull();
  });

  it("ne rend pas le lien d'un autre proche", () => {
    expect(lienVivantPour([lien(1, { personId: uuid(99) })], uuid(50))).toBeNull();
  });

  // Un lien public ne vise personne : il ne peut pas répondre pour une fiche.
  it("ne confond pas un public avec un nominatif", () => {
    expect(lienVivantPour([lien(1, { type: "public", personId: null })], uuid(50)))
      .toBeNull();
  });
});

describe("le lien public du compte", () => {
  it("se trouve parmi les vivants", () => {
    const trouve = lienPublicVivant([
      lien(1), lien(2, { type: "public", personId: null }),
    ]);
    expect(trouve?.id).toBe(uuid(2));
  });

  it("ignore un public révoqué", () => {
    expect(lienPublicVivant([lien(1, { type: "public", personId: null, isActive: false })]))
      .toBeNull();
  });
});

describe("ce qu'on envoie pour en créer un", () => {
  it("porte la fiche sur un nominatif", () => {
    const corps = corpsDeCreation("nominatif", uuid(50));
    expect(corps).toEqual({ type: "nominatif", personId: uuid(50) });
  });

  /* Le contrat refuse les deux autres combinaisons, et il a raison : poser une
     fiche sur un lien public laisserait croire qu'on sait déjà où ranger ce qui
     reviendra — alors que c'est précisément la question que la validation
     posera. */
  it("n'emporte jamais de fiche sur un public", () => {
    expect(corpsDeCreation("public", uuid(50))).toEqual({ type: "public" });
  });

  it("compose des corps que le contrat accepte", () => {
    expect(createCollectionLinkSchema.safeParse(corpsDeCreation("public", null)).success)
      .toBe(true);
    expect(createCollectionLinkSchema.safeParse(corpsDeCreation("nominatif", uuid(50))).success)
      .toBe(true);
  });

  // Un nominatif sans fiche est refusé par le contrat — « un lien nominatif
  // désigne une fiche ». On ne compose donc pas un corps qu'il rejettera.
  it("refuse de composer un nominatif sans fiche", () => {
    expect(() => corpsDeCreation("nominatif", null)).toThrow();
  });
});

const contribution = (n: number, p: Partial<Submission> = {}): Submission => ({
  id: uuid(n), linkType: "nominatif", personId: uuid(50),
  personDisplayName: "Bila", submitterName: null,
  relationHint: null, birthDate: null, personalNote: null, status: "pending",
  wishes: [], createdAt: "2026-08-01T00:00:00.000Z", ...p,
});

const page = (p: Partial<PublicCollectForm> = {}): PublicCollectForm => ({
  type: "nominatif", ownerDisplayName: "Valentine", personDisplayName: "Valery",
  message: null, birthDate: null, ownerWallUsername: null, ...p,
});

describe("l'état de la collecte pour une fiche", () => {
  /* Trois cas, et non les deux que dessine la maquette : un banc d'essai part
     toujours d'un lien créé, l'application ouvre l'écran sur une fiche qui n'en
     a jamais eu. Confondre « aucun » et « révoqué » ferait lire « ce lien ne
     mène plus à rien » à quelqu'un qui n'en a jamais posé. */
  it("dit « aucun » quand la fiche n'a jamais eu de lien", () => {
    expect(etatDeLaCollecte([], uuid(50))).toBe("aucun");
  });

  it("dit « actif » dès qu'un lien vit", () => {
    expect(etatDeLaCollecte([lien(1, { isActive: false }), lien(2)], uuid(50))).toBe("actif");
  });

  it("dit « révoqué » quand il reste une trace et rien de vivant", () => {
    expect(etatDeLaCollecte([lien(1, { isActive: false })], uuid(50))).toBe("revoque");
  });

  // Le lien d'un autre proche ne dit rien de celle-ci : le compter ferait
  // annoncer « révoqué » sur une fiche vierge.
  it("ignore le lien d'un autre proche", () => {
    expect(etatDeLaCollecte([lien(1, { personId: uuid(99), isActive: false })], uuid(50)))
      .toBe("aucun");
  });

  // Un lien public ne vise personne : il ne peut pas répondre pour une fiche.
  it("ignore le lien public du compte", () => {
    expect(etatDeLaCollecte([lien(1, { type: "public", personId: null })], uuid(50)))
      .toBe("aucun");
  });
});

describe("ce qui est revenu par le lien de cette fiche", () => {
  it("compte les contributions nominatives de la fiche", () => {
    expect(recuesPour([contribution(1), contribution(2)], uuid(50))).toHaveLength(2);
  });

  /* LA CONFUSION QUI COMPTERAIT DOUBLE. Une contribution venue d'un lien PUBLIC
     reçoit le `personId` de la fiche AU MOMENT DE LA VALIDATION. La compter ici
     créditerait le lien nominatif de ce qu'un autre a rapporté — le décompte
     grossirait tout seul sans qu'on ait rien envoyé. `linkType` est le seul
     séparateur que le contrat offre. */
  it("écarte une contribution publique rangée sur la fiche", () => {
    expect(recuesPour([contribution(1, { linkType: "public" })], uuid(50))).toEqual([]);
  });

  it("écarte la contribution d'un autre proche", () => {
    expect(recuesPour([contribution(1, { personId: uuid(99) })], uuid(50))).toEqual([]);
  });

  // « Ce qui est revenu » est une histoire, pas une file : ce qui a été tranché
  // est bien revenu, et le taire ferait mentir le décompte après la validation.
  it("compte aussi ce qui a déjà été tranché", () => {
    expect(recuesPour([
      contribution(1, { status: "validated" }), contribution(2, { status: "rejected" }),
    ], uuid(50))).toHaveLength(2);
  });
});

describe("ce qui attend encore une décision", () => {
  /* Deux nombres plutôt qu'un : « trois réponses reçues » reste vrai une fois
     tranchées, mais la ligne ne doit plus mener au sas — le sas ne montre que
     ce qui attend, et on y ouvrirait un écran vide. */
  it("ne retient que ce qui est en attente", () => {
    const contributions = [contribution(1), contribution(2, { status: "validated" })];
    expect(recuesPour(contributions, uuid(50))).toHaveLength(2);
    expect(aTrancherPour(contributions, uuid(50))).toHaveLength(1);
  });

  it("hérite du tri par lien de la fiche", () => {
    expect(aTrancherPour([contribution(1, { linkType: "public" })], uuid(50))).toEqual([]);
  });
});

describe("l'aperçu de la page qui s'ouvrira", () => {
  /* Sur un lien PUBLIC le serveur tait la fiche À DESSEIN — « ce lien se
     partage au monde, et y servir une fiche l'exposerait à quiconque relaie
     l'adresse ». Le nul n'est pas une donnée manquante à combler. */
  it("ne voit pas de fiche là où le serveur n'en sert pas", () => {
    expect(designeUneFiche(page({ type: "public", personDisplayName: null }))).toBe(false);
    expect(designeUneFiche(page())).toBe(true);
  });

  /* L'état particulier que nomme §3.20 — « fiche sans date encore renseignée :
     le lien sert justement à la recueillir » — et la seule chose que l'aperçu
     apprend vraiment : le répondant trouvera-t-il un champ pré-rempli. */
  it("dit si la date est déjà proposée", () => {
    expect(dateDejaProposee(page())).toBe(false);
    expect(dateDejaProposee(page({ birthDate: "1990-04-12" }))).toBe(true);
  });

  /* Nul « si le propriétaire n'a pas publié son Mur : proposer un lien vers une
     page dépubliée apprendrait qu'elle existe ». On lit la réponse du serveur,
     on ne rejoue pas sa règle. */
  it("dit si le Mur est proposé au répondant", () => {
    expect(proposeLeMur(page())).toBe(false);
    expect(proposeLeMur(page({ ownerWallUsername: "valentine" }))).toBe(true);
  });
});
