import { describe, expect, it } from "vitest";
import {
  DRAPEAUX, CLES_DRAPEAUX, CLES_PUBLIQUES, CLES_APPLICATION, type CleDrapeau,
} from "./flags.js";

describe("registre des drapeaux", () => {
  // La liste de la spécification technique §6.3, à la clé près. Un drapeau
  // ajouté au code sans l'être à la spécification — ou l'inverse — casse la
  // référence commune entre le serveur, le mobile et le back-office.
  it("porte les treize clés de la spécification, et rien d'autre", () => {
    expect([...CLES_DRAPEAUX].sort()).toEqual([
      "collect", "credits", "generation.ideas", "generation.message",
      "generation.portrait", "launch.live", "referral", "reservation",
      "topup.manual", "wall", "wishes", "wishlist", "wishlist.own",
    ]);
  });

  // Le socle — proches, notes, dates, occasions, rappels, compte — n'a PAS de
  // drapeau (§6.3). S'il s'éteignait, il n'y aurait plus d'application : un
  // interrupteur dessus ne sert qu'à casser le produit. Ce cas existe parce
  // qu'un drapeau « me.persons » avait été posé sur l'annuaire des proches
  // avant que la règle ne soit écrite, et qu'il a fallu le retirer.
  it("ne gouverne aucune capacité du socle", () => {
    const socle = ["me.persons", "persons", "notes", "events", "occurrences", "reminders", "account"];
    for (const interdit of socle) {
      expect(CLES_DRAPEAUX, `« ${interdit} » relève du socle : il ne se pilote pas`)
        .not.toContain(interdit);
    }
  });

  // `requiert` est typé string[] et non CleDrapeau[] — le type serait
  // circulaire. Une dépendance vers une clé inexistante est donc ÉCRIVABLE, et
  // elle ne bloquerait jamais rien : la fonctionnalité resterait allumée alors
  // que le registre prétend le contraire. Ce test est la seule chose qui
  // sépare une dépendance réelle d'une dépendance décorative.
  it("chaque dépendance déclarée désigne un drapeau qui existe", () => {
    for (const cle of CLES_DRAPEAUX) {
      for (const requis of DRAPEAUX[cle].requiert) {
        expect(CLES_DRAPEAUX, `« ${cle} » dépend de « ${requis} », qui n'existe pas`)
          .toContain(requis);
      }
    }
  });

  // Un cycle rendrait la résolution infinie, ou pire : silencieusement
  // tronquée par une garde de profondeur, donc fausse.
  it("les dépendances ne forment aucun cycle", () => {
    const visiter = (cle: CleDrapeau, chemin: CleDrapeau[]): void => {
      expect(chemin, `cycle : ${[...chemin, cle].join(" → ")}`).not.toContain(cle);
      for (const r of DRAPEAUX[cle].requiert) visiter(r as CleDrapeau, [...chemin, cle]);
    };
    for (const cle of CLES_DRAPEAUX) visiter(cle, []);
  });

  // La couverture est la référence commune : le back-office l'affiche pour
  // qu'un administrateur voie ce qu'il éteint AVANT de basculer. Un drapeau
  // sans couverture rendrait cette promesse vide sans qu'on le remarque.
  it("chaque drapeau dit ce qu'il couvre", () => {
    for (const cle of CLES_DRAPEAUX) {
      const e = DRAPEAUX[cle];
      expect(e.gouverne.length, `« ${cle} » ne dit pas ce qu'il gouverne`).toBeGreaterThan(0);
      expect(e.portee.length, `« ${cle} » n'a aucune portée`).toBeGreaterThan(0);
      expect(
        e.ecrans.length + e.chemins.length,
        `« ${cle} » ne couvre ni écran ni point d'entrée`,
      ).toBeGreaterThan(0);
    }
  });

  it("les listes par portée se dérivent de « portee »", () => {
    expect([...CLES_PUBLIQUES].sort()).toEqual([
      "collect", "launch.live", "referral", "reservation", "wall", "wishes", "wishlist.own",
    ]);
    expect(CLES_APPLICATION).not.toContain("launch.live");
    expect(CLES_APPLICATION).toContain("wall");
  });

  // §6.4, mot pour mot : « credits éteint : les générations restent
  // disponibles et gratuites si leur propre drapeau est allumé. Éteindre
  // l'achat ne doit pas éteindre le produit. » C'est le piège que la
  // spécification signale elle-même ; une dépendance ajoutée par réflexe
  // couperait la génération à tout le monde le jour où le paiement tombe.
  it("aucune génération ne dépend de « credits »", () => {
    for (const cle of CLES_DRAPEAUX.filter((c) => c.startsWith("generation."))) {
      expect(DRAPEAUX[cle].requiert, `« ${cle} » ne doit pas dépendre de l'achat`)
        .not.toContain("credits");
    }
  });
});
