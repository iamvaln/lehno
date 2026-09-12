import { describe, expect, it } from "vitest";
import { catalogueServi, reglagesMessageDeDepart, reglagesPortraitDeDepart, type ReglagesPortrait } from "@lehno/contracts";
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
      composition: "papier", orientation: "notre_relation", image: "illustration", illustration_family: "nature",
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
      composition: "papier", orientation: "notre_relation", image: "illustration", illustration_family: "nature",
    })).toThrow(/is not offered/);
  });

  /* LES DEUX VOIES PARTAGENT LEUR FAMILLE — révisé le 11 septembre.
   *
   * Ce cas éprouvait qu'un « style de photo » demandé sur la voie illustration
   * était refusé. Il n'y a plus de styles de photo : nature, animal et abstrait
   * servent les deux voies, et ce que la photo change n'est pas le sujet mais
   * d'où l'on part. Le contrôle qu'il gardait n'a plus d'objet — il n'existe
   * aucune ambiance du « mauvais » groupe.
   *
   * CE QUI RESTE VRAI, et que ce cas garde maintenant : « aucune image »
   * n'ouvre aucun groupe. Demander une ambiance avec cette voie est la seule
   * incohérence qui subsiste, et elle se refuse AVANT le débit — après, on
   * aurait payé pour un motif de marque qu'aucune ambiance ne décore. */
  it("refuse une ambiance quand la voie n'en ouvre aucune", () => {
    const toutes = avec((r) => r);

    expect(() => verifierLaSelection(toutes, {
      composition: "papier", orientation: "notre_relation",
      image: "aucune", illustration_family: "nature",
    })).toThrow();

    // Sans ambiance, cette voie passe : c'est la fin du choix.
    expect(verifierLaSelection(toutes, {
      composition: "papier", orientation: "notre_relation", image: "aucune",
    }).ambiance).toBeNull();
  });

  /* LA MÊME FAMILLE SERT LES DEUX VOIES. Sans ce cas, on pourrait remettre un
     groupe par voie sans que rien ne tombe — et la voie photo redeviendrait
     invisible, faute d'ambiance à lui donner. */
  it("accepte la même ambiance sur l'illustration et sur la photo", () => {
    const avecPhoto = avec((r) => ({
      ...r,
      voiesImage: r.voiesImage.map((v) => (v.id === "photo" ? { ...v, actif: true } : v)),
    }));

    expect(verifierLaSelection(avecPhoto, {
      composition: "papier", orientation: "notre_relation",
      image: "illustration", illustration_family: "nature",
    }).ambiance?.id).toBe("nature");

    expect(verifierLaSelection(avecPhoto, {
      composition: "papier", orientation: "notre_relation",
      image: "photo", illustration_family: "nature",
    }).ambiance?.id).toBe("nature");
  });

  /* `photo` est inactive faute de styles nommés. Un client qui la demanderait
     obtiendrait un écran sans suite APRÈS paiement — d'où le refus ici, avant
     le débit. */
  it("refuse une voie que le catalogue n'offre pas", () => {
    expect(() => verifierLaSelection(REGLAGES, {
      composition: "papier", orientation: "notre_relation", image: "photo", illustration_family: "argentique",
    })).toThrow(/is not offered/);
  });

  /* La voie « aucune » n'ouvre aucun groupe : le motif de marque tient tout le
     fond, et aucun appel de modèle n'a lieu. */
  it("accepte « aucune » sans ambiance, et la refuse avec", () => {
    const s = verifierLaSelection(REGLAGES, { composition: "papier", orientation: "un_hommage", image: "aucune" });
    expect(s.ambiance).toBeNull();

    // Une ambiance envoyée avec elle est un client qui n'a pas suivi le
    // catalogue. On le dit plutôt que de l'ignorer : sinon il croira que son
    // choix a porté.
    expect(() => verifierLaSelection(REGLAGES, {
      composition: "papier", orientation: "un_hommage", image: "aucune", illustration_family: "nature",
    })).toThrow(/takes no ambiance/);
  });

  it("exige une ambiance sur une voie qui en ouvre une", () => {
    expect(() => verifierLaSelection(REGLAGES, {
      composition: "papier", orientation: "notre_relation", image: "illustration",
    })).toThrow(/an ambiance is required/);
  });

  // Une orientation hors registre ne se devine pas : c'est le gabarit du texte
  // qui la lit, et une valeur inconnue n'aurait aucune consigne derrière elle.
  /* LA COMPOSITION EST LE SECOND PARAMÈTRE QUE LE CLIENT DONNE, et elle se
     vérifie comme le reste — avant le débit. Une gamme retirée du catalogue
     hier et demandée aujourd'hui ferait dessiner sur un fond qu'on ne sert
     plus : un lilas clair sur une encre qu'on vient de supprimer, illisible. */
  it("exige une composition, et la vérifie contre le catalogue", () => {
    expect(() => verifierLaSelection(REGLAGES, {
      orientation: "notre_relation", image: "aucune",
    })).toThrow(/a composition is required/);

    expect(() => verifierLaSelection(REGLAGES, {
      composition: "inventee", orientation: "notre_relation", image: "aucune",
    })).toThrow(/unknown composition/);

    const eteinte = avec((r) => ({
      ...r,
      compositions: r.compositions.map((c) => (c.id === "encre" ? { ...c, actif: false } : c)),
    }));
    expect(() => verifierLaSelection(eteinte, {
      composition: "encre", orientation: "notre_relation", image: "aucune",
    })).toThrow(/is not offered/);
  });

  /* CHAQUE COMPOSITION A SA GAMME, et c'est ce qui traverse jusqu'au modèle.
     Une illustration destinée à un fond d'encre n'emploie pas celle du papier :
     elle y disparaîtrait. */
  it("rend la gamme de la composition choisie, pas une autre", () => {
    const papier = verifierLaSelection(REGLAGES, {
      composition: "papier", orientation: "notre_relation", image: "aucune",
    });
    const encre = verifierLaSelection(REGLAGES, {
      composition: "encre", orientation: "notre_relation", image: "aucune",
    });

    expect(papier.composition.id).toBe("papier");
    expect(encre.composition.id).toBe("encre");
    expect(papier.composition.palette).not.toEqual(encre.composition.palette);
  });

  it("refuse une orientation que le registre ne connaît pas", () => {
    expect(() => verifierLaSelection(REGLAGES, {
      composition: "papier", orientation: "une_orientation_inventee", image: "aucune",
    })).toThrow(/unknown orientation/);
  });

  // Une sélection absente est le cas du client qui n'a rien envoyé : il ne doit
  // pas retomber sur un défaut choisi par le serveur.
  it("refuse une sélection vide plutôt que d'en inventer une", () => {
    expect(() => verifierLaSelection(REGLAGES, undefined)).toThrow(/unknown orientation/);
  });
  /* ─── L'ALLER-RETOUR ────────────────────────────────────────────────────────
   *
   * LE CAS QUI MANQUAIT, ET QUI AURAIT TOUT ARRÊTÉ PLUS TÔT.
   *
   * Le catalogue servait les groupes `orientation, composition, image,
   * illustration_family` ; le validateur lisait `orientation, composition,
   * visual, illustrationFamily`. Deux listes qui devaient être la même, et rien
   * ne les tenait d'accord : un client qui répondait à TOUS les groupes annoncés
   * se faisait refuser « unknown visual path ». Aucun portrait ne pouvait être
   * produit, par aucun client.
   *
   * POURQUOI AUCUN CAS NE LE DISAIT : tous passaient au validateur des
   * sélections écrites à la main, donc avec les clés qu'il attendait. Ils
   * éprouvaient ses règles sans jamais éprouver qu'on puisse l'atteindre.
   *
   * Celui-ci part du catalogue SERVI, répond à chaque groupe par son défaut —
   * exactement ce que fait `selectionParDefaut` côté client — et exige que le
   * serveur accepte. Il tombe dès que l'une des deux listes bouge sans l'autre. */
  describe("du catalogue servi au validateur", () => {
    const servi = (r = reglagesPortraitDeDepart()) =>
      catalogueServi(reglagesMessageDeDepart(), r, "fr", new Map());

    /** Répondre à chaque groupe par son défaut, indexé par identifiant de
     *  groupe — la forme même de `StudioSelection`. */
    const parDefaut = (catalogue: ReturnType<typeof servi>): Record<string, string> =>
      Object.fromEntries(
        catalogue.groups
          .filter((g) => g.defaultChoiceId !== null)
          .map((g) => [g.id, g.defaultChoiceId!]),
      );

    it("accepte une sélection bâtie sur ce que le catalogue annonce", () => {
      const r = reglagesPortraitDeDepart();
      const retenue = verifierLaSelection(r, parDefaut(servi(r)));

      expect(retenue.orientation).toBe("notre_relation");
      expect(retenue.voie).toBe("illustration");
      expect(retenue.ambiance?.id).toBe("nature");
      expect(retenue.composition.id).toBe("papier");
    });

    /* CHAQUE GROUPE SERVI EST UNE CLÉ QUE LE VALIDATEUR LIT. Sans ce cas, on
       pourrait ajouter un groupe au catalogue que personne ne lirait — et le
       choix qu'il porte serait ignoré en silence, ce qui est pire qu'un refus. */
    it("ne sert aucun groupe que le validateur ignorerait", () => {
      const r = reglagesPortraitDeDepart();
      const complete = parDefaut(servi(r));

      for (const groupe of Object.keys(complete)) {
        const ampute = { ...complete };
        delete ampute[groupe];
        expect(() => verifierLaSelection(r, ampute)).toThrow();
      }
    });

    /* ET LA VOIE PHOTO PASSE AUSSI. Les deux voies partagent leur famille
       d'ambiances : si le validateur lisait une clé propre à la photo, ce cas le
       dirait. */
    it("accepte la voie photo par le même chemin", () => {
      const r = reglagesPortraitDeDepart();
      const avecPhoto = {
        ...r,
        voiesImage: r.voiesImage.map((v) => (v.id === "photo" ? { ...v, actif: true } : v)),
      };
      const selection = { ...parDefaut(servi(avecPhoto)), image: "photo" };

      expect(verifierLaSelection(avecPhoto, selection).voie).toBe("photo");
    });
  });
});
