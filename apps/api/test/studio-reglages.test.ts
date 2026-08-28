import { describe, expect, it } from "vitest";
import {
  catalogueServi, matierePourEmpreinte, reglagesDeDepart,
  ORIENTATIONS, groupesAtteignables, valideSelection,
  type ProfilContenu, type StudioReglages,
} from "@lehno/contracts";
import { axesManquants } from "../src/studio/couverture.js";

/* Les réglages du studio, sans base ni réseau.
 *
 * Tout ce qui décide de la règle de publication se joue ici : l'empreinte dit
 * ce qui exige une prévisualisation, et la projection dit ce qu'un utilisateur
 * verra. Deux fautes silencieuses les guettent, exactement opposées — une
 * empreinte trop LARGE rend la §3 inapplicable et use la règle par excès de
 * zèle ; une empreinte trop ÉTROITE laisse publier une consigne que personne
 * n'a vue tourner. Ces cas gardent les deux bords. */

const modifier = (f: (r: StudioReglages) => void): StudioReglages => {
  const r = JSON.parse(JSON.stringify(reglagesDeDepart())) as StudioReglages;
  f(r);
  return r;
};

describe("l'empreinte de la partie lue par le modèle", () => {
  const depart = reglagesDeDepart();
  const empreinte = (r: StudioReglages) => matierePourEmpreinte(r);

  // LE BORD LARGE. Sans lui, réordonner l'écran redemanderait de régénérer —
  // et on ferait valider une image identique à la précédente. Une validation
  // qui ne prouve rien s'apprend très vite à cliquer sans regarder.
  it("ne bouge pas quand on change un libellé", () => {
    const apres = modifier((r) => { r.orientations[0]!.libelle.fr = "Tout autre chose"; });
    expect(empreinte(apres)).toBe(empreinte(depart));
  });

  it("ne bouge pas quand on réordonne les orientations", () => {
    const apres = modifier((r) => { r.orientations.reverse(); });
    expect(empreinte(apres)).toBe(empreinte(depart));
  });

  // Le cas qui surprend : désactiver retire de l'écran, ça ne change rien à ce
  // que le modèle lit quand on demande une AUTRE orientation.
  it("ne bouge pas quand on désactive une orientation", () => {
    const apres = modifier((r) => { r.orientations[3]!.actif = false; });
    expect(empreinte(apres)).toBe(empreinte(depart));
  });

  it("ne bouge pas quand on change un avertissement ou une description", () => {
    const apres = modifier((r) => {
      r.orientations[0]!.description = { fr: "autre", en: "other" };
      r.orientations[11]!.avertissement = null;
    });
    expect(empreinte(apres)).toBe(empreinte(depart));
  });

  // LE BORD ÉTROIT. Sans ces cas, on publierait un texte que personne n'a vu
  // tourner, sur la foi d'un essai passé avec un autre.
  it("bouge quand on change une consigne d'orientation", () => {
    const apres = modifier((r) => { r.orientations[0]!.consigne.fr = "Dites autre chose."; });
    expect(empreinte(apres)).not.toBe(empreinte(depart));
  });

  it("bouge quand on change le modèle appelé", () => {
    const apres = modifier((r) => { r.modeles.message = "deepseek:deepseek-chat"; });
    expect(empreinte(apres)).not.toBe(empreinte(depart));
  });

  it("bouge quand on ajoute un garde-fou", () => {
    const apres = modifier((r) => { r.gardeFous.push("jamais de point d'exclamation"); });
    expect(empreinte(apres)).not.toBe(empreinte(depart));
  });

  it("bouge quand on retire un champ du proche", () => {
    const apres = modifier((r) => { r.champsDuProche = ["relation"]; });
    expect(empreinte(apres)).not.toBe(empreinte(depart));
  });

  /* L'ordre des garde-fous, lui, COMPTE : ils partent dans l'invite dans cet
     ordre, donc le texte reçu par le modèle n'est pas le même. Les trier dans
     la projection ferait passer pour identiques deux consignes qui ne le sont
     pas — l'erreur symétrique du tri des orientations, et bien plus discrète. */
  it("bouge quand on réordonne les garde-fous", () => {
    const avec = modifier((r) => { r.gardeFous = ["un", "deux"]; });
    const inverse = modifier((r) => { r.gardeFous = ["deux", "un"]; });
    expect(empreinte(avec)).not.toBe(empreinte(inverse));
  });

  /* `JSON.stringify` suit l'ordre d'INSERTION des clés. Sans sérialisation
     canonique, les mêmes réglages relus de la base — où l'ordre des clés est
     celui de l'écriture — rendraient une autre empreinte que ceux venus du
     formulaire, et la publication réclamerait un essai pour un changement qui
     n'existe pas. */
  it("ne dépend pas de l'ordre des clés d'un objet", () => {
    const remonte = JSON.parse(JSON.stringify(depart)) as StudioReglages;
    const desordre = {
      ...remonte,
      modeles: {
        photo_style: remonte.modeles.photo_style,
        message: remonte.modeles.message,
        illustration: remonte.modeles.illustration,
      },
    } as StudioReglages;
    expect(empreinte(desordre)).toBe(empreinte(depart));
  });
});

describe("le catalogue servi à l'application", () => {
  it("rend les douze orientations dans l'ordre de l'écran", () => {
    const c = catalogueServi(reglagesDeDepart(), "fr");
    const orientation = c.groups.find((g) => g.id === "orientation");
    expect(orientation?.choices.map((x) => x.id)).toEqual([...ORIENTATIONS]);
  });

  /* LA propriété qui justifie le catalogue en base : « on désactive les autres
     sans livraison ». Si elle tombe, il faut publier une version de
     l'application pour retirer une orientation — c'est-à-dire attendre que le
     parc se mette à jour, ce qu'il ne fait jamais d'un bloc. */
  it("ne rend pas une orientation désactivée", () => {
    const c = catalogueServi(modifier((r) => { r.orientations[2]!.actif = false; }), "fr");
    const ids = c.groups.find((g) => g.id === "orientation")?.choices.map((x) => x.id) ?? [];
    expect(ids).not.toContain(reglagesDeDepart().orientations[2]!.id);
    expect(ids).toHaveLength(ORIENTATIONS.length - 1);
  });

  // Le défaut est le PREMIER ACTIF, jamais un identifiant désigné à part : un
  // défaut nommé pointerait un jour sur ce qu'on vient de désactiver, et
  // l'écran s'ouvrirait sans sélection.
  it("prend le premier choix actif pour défaut", () => {
    const c = catalogueServi(modifier((r) => { r.orientations[0]!.actif = false; }), "fr");
    const orientation = c.groups.find((g) => g.id === "orientation");
    expect(orientation?.defaultChoiceId).toBe(ORIENTATIONS[1]);
  });

  it("résout les libellés dans la langue demandée", () => {
    const fr = catalogueServi(reglagesDeDepart(), "fr");
    const en = catalogueServi(reglagesDeDepart(), "en");
    const premier = (c: typeof fr) => c.groups[0]!.choices[0]!.label;
    expect(premier(fr)).toBe("Notre relation");
    expect(premier(en)).toBe("Our relationship");
  });

  /* L'avertissement s'affiche AU MOMENT du choix. Le perdre ferait découvrir
     après coup que l'hommage change tout — c'est-à-dire après avoir payé. */
  it("porte l'avertissement de l'hommage", () => {
    const c = catalogueServi(reglagesDeDepart(), "fr");
    const hommage = c.groups[0]!.choices.find((x) => x.id === "un_hommage");
    expect(hommage?.warning).toContain("sobre");
  });

  /* Une voie d'image dont le groupe d'ambiances est vide se retire AVEC lui.
     La garder produirait un choix qui ouvre un groupe inexistant : on choisit
     « une photo », et rien n'apparaît. C'est l'état du jour — les trois noms
     de style de photo ne sont pas tranchés. */
  it("retire une voie d'image dont le groupe d'ambiances est vide", () => {
    const c = catalogueServi(modifier((r) => {
      r.voiesImage.find((v) => v.id === "photo")!.actif = true;
    }), "fr");
    const image = c.groups.find((g) => g.id === "image");
    expect(image?.choices.map((x) => x.id)).not.toContain("photo");
    expect(c.groups.map((g) => g.id)).not.toContain("photo_style");
  });

  it("rend la voie photo dès qu'un style existe", () => {
    const c = catalogueServi(modifier((r) => {
      r.voiesImage.find((v) => v.id === "photo")!.actif = true;
      r.ambiances.push({
        id: "argentique", groupe: "photo_style", actif: true,
        libelle: { fr: "Argentique", en: "Film" }, description: null,
        consigne: { fr: "Grain argentique, couleurs sourdes.", en: "Film grain, muted colours." },
      });
    }), "fr");
    expect(c.groups.find((g) => g.id === "image")?.choices.map((x) => x.id)).toContain("photo");
    expect(c.groups.map((g) => g.id)).toContain("photo_style");
  });

  /* Le catalogue servi doit être NAVIGABLE par les fonctions que le client
     emploie. Un catalogue valide au schéma mais qui ouvre un groupe vide
     passerait le `parse` et casserait l'écran. */
  it("se laisse parcourir et valider par le client", () => {
    const c = catalogueServi(reglagesDeDepart(), "fr");
    const atteignables = groupesAtteignables(c, {});
    const selection = Object.fromEntries(
      atteignables.map((g) => [g, c.groups.find((x) => x.id === g)!.defaultChoiceId]),
    );
    expect(valideSelection(c, selection)).toEqual([]);
  });
});

describe("la couverture des profils de simulation", () => {
  const profil = (over: Partial<ProfilContenu> = {}, sensible = false) => ({
    sensible,
    contenu: {
      langue: "fr", orientation: "notre_relation", nomDUsage: "Léa",
      registre: "familier", lien: "famille_proche", relation: "ma sœur",
      genreDuProche: "female", genreDeLAuteur: "male", occasionSensible: false,
      notes: [], aEviter: [], texteLibre: null, age: null,
      ...over,
    } as ProfilContenu,
  });

  it("dit ce qui manque, pas ce qui est là", () => {
    expect(axesManquants([profil()])).toContain("langue_en");
    expect(axesManquants([profil()])).toContain("cas_sensible");
  });

  /* Marquer « sensible » un profil dont l'occasion ne l'est pas produirait un
     essai qui ne dit rien du cas qu'on craint — et la couverture se
     déclarerait complète sur cette foi-là. C'est celui-là qui révèle si un
     gabarit dérape. */
  it("ne compte pas un profil marqué sensible dont l'occasion ne l'est pas", () => {
    expect(axesManquants([profil({}, true)])).toContain("cas_sensible");
    expect(axesManquants([profil({ occasionSensible: true }, true)])).not.toContain("cas_sensible");
  });

  // Les seuils sont disjoints à dessein : sinon trois notes satisferaient
  // « riche » et « pauvre » à la fois, et un seul profil médiocre suffirait à
  // faire croire la couverture complète.
  it("ne laisse pas une seule fiche couvrir riche et pauvre", () => {
    const notes = Array.from({ length: 3 }, (_, i) => ({
      categorie: null, date: "2026-01-0" + (i + 1), contenu: "note",
    }));
    const manquants = axesManquants([profil({ notes })]);
    expect(manquants).toContain("fiche_riche");
    expect(manquants).toContain("fiche_pauvre");
  });
});
