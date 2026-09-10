import { describe, expect, it } from "vitest";
import { reglagesPortraitDeDepart, type ReglagesPortrait } from "@lehno/contracts";
import { verifierLaSelection } from "../src/studio/selection.js";

/**
 * La sélection du studio, vérifiée contre le catalogue PUBLIÉ.
 *
 * Le contrat commun l'annonce depuis le début — « la cohérence se vérifie
 * contre le catalogue reçu, puis de nouveau côté serveur, qui décide seul » —
 * et ce second contrôle n'existait pas. Ces cas éprouvent ce qu'il empêche.
 *
 * Sans base ni serveur : il ne lit que des réglages qu'on lui passe.
 */
describe("la sélection du studio", () => {
  const REGLAGES = reglagesPortraitDeDepart();

  const avec = (modif: (r: ReglagesPortrait) => ReglagesPortrait): ReglagesPortrait =>
    modif(structuredClone(REGLAGES));

  it("accepte une voie et une ambiance toutes deux actives", () => {
    const s = verifierLaSelection(REGLAGES, {
      orientation: "notre_relation", visual: "illustration", illustrationFamily: "nature",
    });
    expect(s.voie).toBe("illustration");
    expect(s.ambiance?.id).toBe("nature");
    // La consigne voyage avec : c'est elle que le modèle lira.
    expect(s.ambiance?.consigne.fr).toContain("élément naturel");
  });

  /* LE PARC NE SE MET PAS À JOUR D'UN BLOC. Un téléphone garde son catalogue en
     mémoire et propose encore ce qu'on vient de retirer. Sans ce contrôle, le
     crédit part et le modèle produit dans un style qu'on ne veut plus servir. */
  it("refuse une ambiance qu'on vient de désactiver", () => {
    const eteinte = avec((r) => ({
      ...r,
      ambiances: r.ambiances.map((a) => (a.id === "nature" ? { ...a, actif: false } : a)),
    }));
    expect(() => verifierLaSelection(eteinte, {
      orientation: "notre_relation", visual: "illustration", illustrationFamily: "nature",
    })).toThrow(/is not offered/);
  });

  /* LE CONTRÔLE QUI COMPTE LE PLUS. Un style de photo demandé sur la voie
     illustration passerait par le mauvais modèle, et la consigne d'un dessin
     partirait à un traitement de photo. */
  it("refuse une ambiance du mauvais groupe", () => {
    const avecStyle = avec((r) => ({
      ...r,
      voiesImage: r.voiesImage.map((v) => (v.id === "photo" ? { ...v, actif: true } : v)),
      ambiances: [...r.ambiances, {
        id: "argentique", groupe: "photo_style" as const, actif: true,
        libelle: { fr: "Argentique", en: "Film" },
        description: null,
        consigne: { fr: "Un grain argentique.", en: "Film grain." },
      }],
    }));

    expect(() => verifierLaSelection(avecStyle, {
      orientation: "notre_relation", visual: "illustration", illustrationFamily: "argentique",
    })).toThrow(/does not belong/);

    // Et sur sa propre voie, elle passe.
    expect(verifierLaSelection(avecStyle, {
      orientation: "notre_relation", visual: "photo", photoStyle: "argentique",
    }).ambiance?.id).toBe("argentique");
  });

  /* `photo` est inactive faute de styles nommés. Un client qui la demanderait
     obtiendrait un écran sans suite APRÈS paiement — d'où le refus ici, avant
     le débit. */
  it("refuse une voie que le catalogue n'offre pas", () => {
    expect(() => verifierLaSelection(REGLAGES, {
      orientation: "notre_relation", visual: "photo", photoStyle: "argentique",
    })).toThrow(/is not offered/);
  });

  /* La voie « aucune » n'ouvre aucun groupe : le motif de marque tient tout le
     fond, et aucun appel de modèle n'a lieu. */
  it("accepte « aucune » sans ambiance, et la refuse avec", () => {
    const s = verifierLaSelection(REGLAGES, { orientation: "un_hommage", visual: "aucune" });
    expect(s.ambiance).toBeNull();

    // Une ambiance envoyée avec elle est un client qui n'a pas suivi le
    // catalogue. On le dit plutôt que de l'ignorer : sinon il croira que son
    // choix a porté.
    expect(() => verifierLaSelection(REGLAGES, {
      orientation: "un_hommage", visual: "aucune", illustrationFamily: "nature",
    })).toThrow(/takes no ambiance/);
  });

  it("exige une ambiance sur une voie qui en ouvre une", () => {
    expect(() => verifierLaSelection(REGLAGES, {
      orientation: "notre_relation", visual: "illustration",
    })).toThrow(/an ambiance is required/);
  });

  // Une orientation hors registre ne se devine pas : c'est le gabarit du texte
  // qui la lit, et une valeur inconnue n'aurait aucune consigne derrière elle.
  it("refuse une orientation que le registre ne connaît pas", () => {
    expect(() => verifierLaSelection(REGLAGES, {
      orientation: "une_orientation_inventee", visual: "aucune",
    })).toThrow(/unknown orientation/);
  });

  // Une sélection absente est le cas du client qui n'a rien envoyé : il ne doit
  // pas retomber sur un défaut choisi par le serveur.
  it("refuse une sélection vide plutôt que d'en inventer une", () => {
    expect(() => verifierLaSelection(REGLAGES, undefined)).toThrow(/unknown orientation/);
  });
});
