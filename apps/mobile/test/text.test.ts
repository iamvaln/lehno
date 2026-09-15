import { describe, expect, it } from "vitest";
import { elideBefore, endSentence } from "../lib/text.js";
import { dateCourte } from "../lib/carnet.js";
import { fr } from "../messages/fr.js";
import { en } from "../messages/en.js";

describe("ending a sentence", () => {
  it("adds the full stop when there is none", () => {
    expect(endSentence("Rien avant le 4 mars")).toBe("Rien avant le 4 mars.");
  });

  it("does not double one that is already there", () => {
    expect(endSentence("Rien avant le 7 nov.")).toBe("Rien avant le 7 nov.");
  });
});

/* LE DÉFAUT, VU À L'ÉCRAN : « Rien avant le 7 nov.. ».
 *
 * Il ne se montre que pour les mois que le français abrège — et « mars » ne
 * l'est pas, ni aucun mois en anglais. Onze cas sur douze cachaient le
 * douzième, et c'est pourquoi ce cas parcourt L'ANNÉE plutôt qu'une date. */
describe("le résumé lointain, sur les douze mois", () => {
  const jours = Array.from({ length: 12 }, (_, m) => `2026-${String(m + 1).padStart(2, "0")}-07`);

  it("n'écrit jamais deux points en français", () => {
    for (const jour of jours) {
      const phrase = fr.etatLointain(dateCourte(jour, "fr"));
      expect(phrase, `${jour} → ${phrase}`).not.toMatch(/\.\./);
      expect(phrase.endsWith("."), `${jour} → ${phrase}`).toBe(true);
    }
  });

  it("ni en anglais", () => {
    for (const jour of jours) {
      const phrase = en.etatLointain(dateCourte(jour, "en"));
      expect(phrase, `${jour} → ${phrase}`).not.toMatch(/\.\./);
      expect(phrase.endsWith("."), `${jour} → ${phrase}`).toBe(true);
    }
  });
});

/* L'ÉLISION, ET POURQUOI ELLE COMPTE ICI PLUS QU'AILLEURS.
 *
 * « La wishlist de Awa » et « Le Mur de Awa » sont les titres des pages qu'on
 * ENVOIE à ses proches — les deux chaînes les plus publiques de l'application.
 * Tous les prénoms à initiale vocalique les rendaient fautives, et ce sont des
 * prénoms courants ici : Awa, Élise, Ines, Omar, Ada.
 */
describe("l'élision devant un prénom", () => {
  it("élide devant une voyelle", () => {
    expect(elideBefore("de", "Awa")).toBe("d'Awa");
    expect(elideBefore("de", "Ines")).toBe("d'Ines");
    expect(elideBefore("de", "Omar")).toBe("d'Omar");
  });

  // Les prénoms accentués sont la moitié du carnet dans un produit francophone.
  it("élide devant une voyelle accentuée", () => {
    expect(elideBefore("de", "Élise")).toBe("d'Élise");
    expect(elideBefore("de", "Ève")).toBe("d'Ève");
  });

  it("n'élide pas devant une consonne", () => {
    expect(elideBefore("de", "Valentine")).toBe("de Valentine");
    expect(elideBefore("de", "Célarine")).toBe("de Célarine");
  });

  /* PAS DEVANT UN H, et c'est une décision. Le français élide devant un h muet
     — « d'Henri » — et pas devant un h aspiré — « de Hugo ». Rien dans
     l'orthographe ne les distingue, et sur un prénom il n'y a aucune liste à
     consulter. « de Hugo » paraît un peu guindé ; « d'Hugo » paraît une faute
     sur le nom de quelqu'un, ce qui est pire dans un produit dont toute la
     promesse est de bien le dire. */
  it("laisse le h tranquille, dans les deux sens", () => {
    expect(elideBefore("de", "Hugo")).toBe("de Hugo");
    expect(elideBefore("de", "Henri")).toBe("de Henri");
  });

  // La règle ne vaut pas que pour « de » : « que », « le », « la », « ce ».
  it("vaut pour les autres mots élidables", () => {
    expect(elideBefore("que", "Awa")).toBe("qu'Awa");
    expect(elideBefore("que", "Valentine")).toBe("que Valentine");
    expect(elideBefore("la", "Awa")).toBe("l'Awa");
  });

  /* Un nom vide ne doit pas produire « d' » tout seul, ni « de  » à deux
     espaces : l'écran affiche parfois un nom qui n'est pas encore chargé. */
  it("ne fabrique rien sur un nom absent", () => {
    expect(elideBefore("de", "")).toBe("de ");
    expect(elideBefore("de", "   ")).toBe("de ");
  });

  it("rogne les espaces autour du nom", () => {
    expect(elideBefore("de", "  Awa  ")).toBe("d'Awa");
  });
});

/* LES LIBELLÉS EUX-MÊMES, et pas seulement la fonction. C'est là que le défaut
   vivait : la fonction n'existait pas, chaque libellé collait « de » au nom. */
describe("les libellés qui nomment quelqu'un", () => {
  const voyelles = ["Awa", "Élise", "Ines", "Omar"];

  it("n'écrivent jamais « de » devant une voyelle", () => {
    for (const nom of voyelles) {
      for (const phrase of [
        fr.pubListeTitre(nom), fr.pubMurTitre(nom), fr.evtSansNaissance(nom),
        fr.portraitAttenteSansNote(nom), fr.collecteApercuInvite(nom), fr.murGoutsLabel(nom),
      ]) {
        expect(phrase, phrase).not.toMatch(/\b(de|que) [AEIOUYÀÂÄÉÈÊËÎÏÔÖÙÛÜŸ]/);
      }
    }
  });

  it("gardent la forme pleine devant une consonne", () => {
    expect(fr.pubListeTitre("Valentine")).toBe("La wishlist de Valentine");
    expect(fr.murGoutsLabel("Valentine")).toBe("Ce que Valentine aime");
  });
});
