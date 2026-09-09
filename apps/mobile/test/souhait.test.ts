import { describe, expect, it } from "vitest";
import {
  updateOwnerWishSchema, updateWishSchema, type OwnerWish, type Wish,
} from "@lehno/contracts";
import {
  cheminDEcriture, cheminDeLecture, cibleDuSouhait, corpsDePosition, corpsDeRetouche,
  corpsDeVisibilite, domaineDuLien, ecranDuSouhait, lienOuvrable, origineDeLIdee,
  ouvreLIdee, ouvreLeMien, peutEnregistrer, peutRetoucher, positionCourante,
  positionsDuSouhait, prixAffichable, reservationDuSouhait, retoucheDuSouhait,
  retraitEmporteUneReservation, saisieDepuis,
  type SouhaitOuvert,
} from "../lib/souhait.js";

const LISTE = "11111111-1111-4111-8111-111111111111";
const OCCASION = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";

const MIEN: OwnerWish = {
  id: ID,
  wishlistId: LISTE,
  label: "Un moulin à café manuel",
  link: "https://www.torrefacteur-bonapriso.cm/moulins?ref=abc",
  imageUrl: null,
  imageKey: null,
  details: "Le précédent rend l'âme.",
  price: 12000,
  currency: "XAF",
  status: "available",
  isPublic: true,
  position: 0,
  reservedByName: null,
};

const IDEE: Wish = {
  id: ID,
  occurrenceId: OCCASION,
  label: "Un vinyle de Manu Dibango",
  link: null,
  imageUrl: null,
  imageKey: null,
  details: null,
  price: null,
  currency: null,
  status: "available",
  origin: "collected",
  isShortlisted: false,
  reservedByName: null,
};

const mien = (champs: Partial<OwnerWish> = {}): SouhaitOuvert =>
  ({ genre: "mien", souhait: { ...MIEN, ...champs } });
const idee = (champs: Partial<Wish> = {}): SouhaitOuvert =>
  ({ genre: "idee", souhait: { ...IDEE, ...champs } });

/* CE QUI VIENT DE LA NAVIGATION N'EST PAS UNE AUTORISATION.
 *
 * Ces paramètres partent dans un CHEMIN d'API. La faille n'est pas théorique :
 * `…/souhait?liste=../../admin&id=<uuid>` ferait interroger une route que
 * personne n'a voulue, de l'autorité de la session ouverte. */
describe("la cible se lit sur des paramètres qui ne sont pas de confiance", () => {
  it("refuse un contenant qui n'est pas un identifiant", () => {
    expect(cibleDuSouhait({ id: ID, liste: "../../admin" })).toBeNull();
    expect(cibleDuSouhait({ id: ID, liste: "" })).toBeNull();
    expect(cibleDuSouhait({ id: ID, liste: 12 })).toBeNull();
  });

  it("refuse un souhait qui n'est pas un identifiant", () => {
    expect(cibleDuSouhait({ id: "moi", liste: LISTE })).toBeNull();
    expect(cibleDuSouhait({ liste: LISTE })).toBeNull();
  });

  /* Les départager par un ordre de préférence ferait garder l'écran par le
     MAUVAIS drapeau : une idée privée s'ouvrirait sous la règle des listes
     partagées, ou l'inverse. */
  it("refuse les deux contenants à la fois plutôt que d'en préférer un", () => {
    expect(cibleDuSouhait({ id: ID, liste: LISTE, occasion: OCCASION })).toBeNull();
  });

  it("refuse une adresse qui ne nomme aucun contenant", () => {
    expect(cibleDuSouhait({ id: ID })).toBeNull();
  });

  it("reconnaît les deux natures", () => {
    expect(cibleDuSouhait({ id: ID, liste: LISTE }))
      .toEqual({ genre: "mien", contenant: LISTE, souhait: ID });
    expect(cibleDuSouhait({ id: ID, occasion: OCCASION }))
      .toEqual({ genre: "idee", contenant: OCCASION, souhait: ID });
  });
});

describe("les chemins suivent la nature, jamais l'inverse", () => {
  it("lit le contenant et écrit le souhait", () => {
    const cible = cibleDuSouhait({ id: ID, liste: LISTE })!;
    expect(cheminDeLecture(cible)).toBe(`/me/wishlists/${LISTE}/wishes`);
    expect(cheminDEcriture(cible)).toBe(`/me/owner-wishes/${ID}`);
  });

  it("ne confond pas une idée avec un souhait à soi", () => {
    const cible = cibleDuSouhait({ id: ID, occasion: OCCASION })!;
    expect(cheminDeLecture(cible)).toBe(`/me/occurrences/${OCCASION}/wishes`);
    expect(cheminDEcriture(cible)).toBe(`/me/wishes/${ID}`);
  });

  /* `wishlist.own` et `wishlist` ne ferment pas les mêmes routes : garder
     l'écran avec l'autre clé le laisserait s'ouvrir sur un 404 que la personne
     lirait comme une panne. */
  it("chaque nature réclame son drapeau", () => {
    expect(ecranDuSouhait("mien")).toBe("listes");
    expect(ecranDuSouhait("idee")).toBe("souhait");
  });
});

describe("retrouver le souhait dans la réponse du contenant", () => {
  /* Aucune route ne sert un souhait seul. Un identifiant qui ne figure pas dans
     le contenant — retiré ailleurs, ou nommé au hasard par un lien profond —
     laisse l'appel réussir : c'est « introuvable », pas une panne. */
  it("rend rien plutôt qu'une coquille quand le souhait n'y est pas", () => {
    expect(ouvreLeMien([MIEN], OCCASION)).toBeNull();
    expect(ouvreLIdee([], ID)).toBeNull();
  });

  it("noue le genre à la forme", () => {
    expect(ouvreLeMien([MIEN], ID)).toEqual({ genre: "mien", souhait: MIEN });
    expect(ouvreLIdee([IDEE], ID)).toEqual({ genre: "idee", souhait: IDEE });
  });
});

describe("où en est ce souhait", () => {
  it("lit les trois états d'un souhait à moi", () => {
    expect(positionCourante(mien())).toBe("disponible");
    expect(positionCourante(mien({ status: "reserved" }))).toBe("reserve");
    expect(positionCourante(mien({ status: "fulfilled" }))).toBe("offert");
  });

  /* Un souhait déjà offert reste souvent marqué « retenu » — c'est bien parce
     qu'on l'avait retenu qu'on l'a offert. Lire le repère d'abord annoncerait
     « retenu » sur un cadeau déjà donné, et on le rachèterait. */
  it("fait primer « déjà offert » sur le repère personnel", () => {
    expect(positionCourante(idee({ status: "fulfilled", isShortlisted: true })))
      .toBe("offert");
    expect(positionCourante(idee({ isShortlisted: true }))).toBe("retenu");
    expect(positionCourante(idee())).toBe("etudier");
  });

  /* « Réservé » est un état du modèle : le taire ici laisserait croire
     disponible un souhait que quelqu'un a déjà pris. Il se lit, et ne s'écrit
     pas — le contrat refuse de le poser. */
  it("montre « réservé » sans le rendre posable", () => {
    const cases = positionsDuSouhait(mien({ status: "reserved" }));
    const reserve = cases.find((c) => c.cle === "reserve");
    expect(reserve).toEqual({ cle: "reserve", active: true, reglable: false });
    expect(cases.filter((c) => c.reglable).map((c) => c.cle))
      .toEqual(["disponible", "offert"]);
  });

  /* Le contrat ne porte pas « écarté » : ni `status` ni `isShortlisted` ne
     savent le dire. Une case qui colorerait une pastille sans rien enregistrer
     ferait croire l'idée rangée, et elle reviendrait « à étudier ». */
  it("n'offre pas à une idée une case que le contrat ne sait pas garder", () => {
    expect(positionsDuSouhait(idee()).map((c) => c.cle))
      .toEqual(["etudier", "retenu", "offert"]);
  });

  /* Revenir d'« offert » ne suffit pas à écrire le repère : sans le statut,
     le souhait reste offert et la pastille rebascule au premier rechargement. */
  it("ramène le statut ET le repère quand une idée quitte « déjà offert »", () => {
    expect(corpsDePosition("retenu", "idee"))
      .toEqual({ status: "available", isShortlisted: true });
    expect(corpsDePosition("etudier", "idee"))
      .toEqual({ status: "available", isShortlisted: false });
    expect(corpsDePosition("offert", "idee")).toEqual({ status: "fulfilled" });
  });

  it("n'écrit jamais « réservé » sur un souhait à moi", () => {
    for (const position of ["disponible", "reserve"] as const) {
      expect(corpsDePosition(position, "mien")).toEqual({ status: "available" });
    }
    expect(corpsDePosition("offert", "mien")).toEqual({ status: "fulfilled" });
  });

  it("passe par le contrat, qui refuserait « reserved »", () => {
    expect(updateOwnerWishSchema.safeParse(corpsDePosition("offert", "mien")).success)
      .toBe(true);
    expect(updateWishSchema.safeParse(corpsDePosition("retenu", "idee")).success)
      .toBe(true);
    // La preuve par la panne : le statut interdit, lui, est bien refusé.
    expect(updateOwnerWishSchema.safeParse({ status: "reserved" }).success).toBe(false);
  });
});

describe("la réservation dit qui, ou dit qu'elle ne le dit pas", () => {
  it("nomme le réservant quand il s'est fait connaître", () => {
    expect(reservationDuSouhait(mien({ status: "reserved", reservedByName: "Awa" })))
      .toEqual({ anonyme: false, qui: "Awa" });
  });

  /* Nul ne veut pas dire « personne n'a réservé » mais « aucun nom n'a été
     donné » : les confondre ferait racheter le même cadeau. */
  it("dit la réservation muette plutôt que de la taire", () => {
    expect(reservationDuSouhait(mien({ status: "reserved" }))).toEqual({ anonyme: true });
  });

  it("ne dit rien sur un souhait libre", () => {
    expect(reservationDuSouhait(mien())).toBeNull();
  });

  /* Le serveur ne pose jamais `reserved` sur un souhait de proche — « une
     WishReservation pointe un OwnerWish, jamais un WishlistItem ». Y afficher
     une phrase de réservation installerait une promesse fausse. */
  it("n'installe pas de réservation sur une idée, même si le champ est rempli", () => {
    expect(reservationDuSouhait(idee({ status: "reserved", reservedByName: "Awa" })))
      .toBeNull();
    expect(retraitEmporteUneReservation(idee({ status: "reserved" }))).toBe(false);
    expect(retraitEmporteUneReservation(mien({ status: "reserved" }))).toBe(true);
  });
});

describe("ce qui s'affiche", () => {
  /* Une adresse entière avec ses paramètres de suivi s'enroule sur quatre
     lignes et ne dit pas mieux chez qui aller. */
  it("réduit le lien à son domaine", () => {
    expect(domaineDuLien("https://www.torrefacteur-bonapriso.cm/moulins?ref=abc"))
      .toBe("torrefacteur-bonapriso.cm");
    expect(domaineDuLien("http://boutique.example.com:8080/a#b")).toBe("boutique.example.com");
  });

  it("montre entière une adresse qu'il ne sait pas découper", () => {
    expect(domaineDuLien("moulin-a-cafe")).toBe("moulin-a-cafe");
  });

  /* Le contrat n'exige qu'une URL, et `z.string().url()` accepte
     `javascript:`. Ce lien vient d'un formulaire de collecte rempli par un
     inconnu : c'est une saisie qui a fait un aller-retour, pas une donnée de
     confiance. */
  it("ne remet à l'appareil que http et https", () => {
    expect(lienOuvrable("javascript:alert(1)")).toBeNull();
    expect(lienOuvrable("tel:+237600000000")).toBeNull();
    expect(lienOuvrable(null)).toBeNull();
    expect(lienOuvrable("https://exemple.cm")).toBe("https://exemple.cm");
  });

  /* « 12 000 » ne dit ni des francs CFA ni des euros. En lecture les deux
     champs sont nullables séparément : un prix orphelin ne s'affiche pas
     plutôt que de s'afficher à moitié. */
  it("n'affiche pas un prix sans sa devise", () => {
    expect(prixAffichable({ price: 12000, currency: null }, "fr")).toBeNull();
    expect(prixAffichable({ price: null, currency: "XAF" }, "fr")).toBeNull();
    expect(prixAffichable({ price: 0, currency: "XAF" }, "fr")).not.toBeNull();
  });

  /* Le contrat n'accepte que trois majuscules, pas la liste ISO : une devise
     inconnue traverse jusqu'ici. Elle doit s'afficher — avec son code, faute de
     mieux — et surtout ne pas faire tomber l'écran. */
  it("affiche encore un prix dont la devise n'est pas connue", () => {
    const affiche = prixAffichable({ price: 12000, currency: "ZZZ" }, "fr");
    expect(affiche).toContain("ZZZ");
    expect(affiche).toMatch(/12/);
  });

  /* `origin` dit d'où vient une idée, donc ce qu'elle vaut. Je sais d'où vient
     ce que je demande moi-même : rien à afficher sur un souhait à moi. */
  it("nomme la provenance d'une idée et se tait sur la mienne", () => {
    expect(origineDeLIdee(idee({ origin: "collected" }))).toBe("souhaitOrigineConfie");
    expect(origineDeLIdee(idee({ origin: "accepted_idea" }))).toBe("souhaitOrigineIdee");
    expect(origineDeLIdee(idee({ origin: "owner" }))).toBe("souhaitOrigine");
    expect(origineDeLIdee(mien())).toBeNull();
  });

  it("ferme la retouche d'un souhait déjà offert", () => {
    expect(peutRetoucher(MIEN)).toBe(true);
    expect(peutRetoucher({ ...MIEN, status: "fulfilled" })).toBe(false);
  });
});

describe("la retouche n'envoie que ce qui a changé", () => {
  it("n'envoie rien sur un formulaire intact", () => {
    expect(retoucheDuSouhait(saisieDepuis(MIEN), MIEN)).toEqual({});
    expect(peutEnregistrer(saisieDepuis(MIEN), MIEN)).toBe(false);
  });

  /* Le contrat refuse un corps vide — « au moins un champ ». Un bouton actif
     sur un formulaire intact promet un effet qu'il n'aura pas. */
  it("refuse d'enregistrer un intitulé vidé, même si le reste a bougé", () => {
    const saisie = { ...saisieDepuis(MIEN), intitule: "  ", details: "autre chose" };
    expect(peutEnregistrer(saisie, MIEN)).toBe(false);
    expect(retoucheDuSouhait(saisie, MIEN)).not.toHaveProperty("label");
  });

  /* Vidé, un lien redevient NUL. Une chaîne vide serait une adresse qui existe
     et ne mène nulle part — et le schéma la refuserait, puisqu'il attend une
     URL. */
  it("remet à nul ce qu'on vide, plutôt qu'à la chaîne vide", () => {
    const corps = retoucheDuSouhait({ ...saisieDepuis(MIEN), lien: "", details: "" }, MIEN);
    expect(corps).toEqual({ link: null, details: null });
    expect(updateOwnerWishSchema.safeParse(corps).success).toBe(true);
    expect(updateOwnerWishSchema.safeParse({ link: "" }).success).toBe(false);
  });

  /* Le contrat refuse un prix sans devise. N'envoyer que le montant parce que
     le code n'a pas bougé ferait rejeter l'enregistrement entier avec un
     message qui parle d'un champ que personne n'a touché. */
  it("fait partir la devise avec le prix, toujours", () => {
    const corps = retoucheDuSouhait({ ...saisieDepuis(MIEN), prix: "15000" }, MIEN);
    expect(corps).toEqual({ price: 15000, currency: "XAF" });
    expect(updateOwnerWishSchema.safeParse(corps).success).toBe(true);
    expect(updateOwnerWishSchema.safeParse({ price: 15000 }).success).toBe(false);
  });

  it("emmène la devise quand le prix est vidé", () => {
    expect(retoucheDuSouhait({ ...saisieDepuis(MIEN), prix: "" }, MIEN))
      .toEqual({ price: null, currency: null });
  });

  /* « douze mille » n'est pas zéro. Écrire 0 ferait annoncer gratuit un objet
     à douze mille francs — sur une liste que des visiteurs lisent. */
  it("laisse le prix tel quel quand la saisie est illisible", () => {
    expect(retoucheDuSouhait({ ...saisieDepuis(MIEN), prix: "douze mille" }, MIEN))
      .toEqual({});
    expect(retoucheDuSouhait({ ...saisieDepuis(MIEN), prix: "-3" }, MIEN)).toEqual({});
  });

  it("accepte la virgule, qui est la façon d'écrire d'ici", () => {
    expect(retoucheDuSouhait({ ...saisieDepuis(MIEN), prix: "1,5" }, MIEN))
      .toEqual({ price: 1.5, currency: "XAF" });
  });

  it("relit le corps par le schéma de la nature ouverte", () => {
    const saisie = { ...saisieDepuis(IDEE), intitule: "Un vinyle rare" };
    expect(corpsDeRetouche(saisie, idee())).toEqual({ label: "Un vinyle rare" });
    expect(corpsDeRetouche({ ...saisieDepuis(MIEN), lien: "" }, mien()))
      .toEqual({ link: null });
  });
});

describe("la visibilité n'existe que sur ce que je demande", () => {
  it("bascule ce qui paraît sur la liste partagée", () => {
    expect(corpsDeVisibilite(mien())).toEqual({ isPublic: false });
    expect(corpsDeVisibilite(mien({ isPublic: false }))).toEqual({ isPublic: true });
  });

  /* `isPublic` n'existe pas sur une idée : elle ne se publie nulle part, et un
     interrupteur inerte y annoncerait une exposition qui n'a pas lieu. */
  it("ne propose rien à basculer sur une idée", () => {
    expect(corpsDeVisibilite(idee())).toBeNull();
  });
});
