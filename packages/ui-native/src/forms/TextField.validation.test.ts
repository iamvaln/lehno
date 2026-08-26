import { describe, expect, it } from "vitest";
import { ressembleAUneAdresse, nettoiePourLaNature } from "./TextField.nature.js";

describe("ce qui ressemble à une adresse", () => {
  /* Le serveur tranche — c'est lui qui décide. Mais laisser partir une saisie
     manifestement incomplète coûte un aller-retour et une erreur à lire, là
     où le bouton pouvait rester éteint. */
  it("accepte une adresse ordinaire", () => {
    expect(ressembleAUneAdresse("awa@exemple.fr")).toBe(true);
    expect(ressembleAUneAdresse("valery.bah+lehno@exemple.co.uk")).toBe(true);
  });

  it("refuse ce qui n'en est visiblement pas une", () => {
    for (const saisie of ["valentine", "valentine@", "@exemple.fr", "a b@c.fr", "a@b", ""]) {
      expect(ressembleAUneAdresse(saisie), saisie).toBe(false);
    }
  });

  // Les espaces de bord viennent du collage et d'un clavier qui en ajoute un
  // après l'autocomplétion. Les refuser serait pointilleux ; les retirer, juste.
  it("ne bute pas sur les espaces de bord", () => {
    expect(ressembleAUneAdresse("  awa@exemple.fr ")).toBe(true);
  });
});

describe("le nettoyage à la saisie", () => {
  /* Ce que le clavier peut encore laisser passer malgré les réglages : un
     collage, une dictée, un clavier tiers. La nature du champ le rattrape à la
     frappe plutôt qu'à l'envoi. */
  it("abaisse la casse d'une adresse", () => {
    expect(nettoiePourLaNature("email", "Awa@Exemple.FR")).toBe("awa@exemple.fr");
  });

  /* Le pseudo garde sa casse : le serveur accepte les majuscules, et l'abaisser
     changerait ce que la personne a choisi de montrer. C'est son nom sur le
     Mur, pas une clé de recherche. */
  it("garde la casse du pseudo", () => {
    expect(nettoiePourLaNature("pseudo", "Awa.Diop")).toBe("Awa.Diop");
  });

  /* Le motif du serveur : lettres, chiffres, point, tiret, tiret bas. Il forme
     l'adresse du Mur — ce qui n'entre pas dans une URL n'a pas sa place. */
  it("écarte du pseudo ce que le serveur refuse", () => {
    expect(nettoiePourLaNature("pseudo", "awa diop")).toBe("awadiop");
    expect(nettoiePourLaNature("pseudo", "awa@diop!")).toBe("awadiop");
    expect(nettoiePourLaNature("pseudo", "Awa-Diop_2.0")).toBe("Awa-Diop_2.0");
  });

  /* Un pseudo commence par une lettre ou un chiffre. Retirer les signes de tête
     à la frappe évite un refus que rien n'expliquerait — on tape « .awa », le
     point ne s'affiche pas, et la règle se comprend d'elle-même. */
  it("refuse un signe en tête de pseudo", () => {
    expect(nettoiePourLaNature("pseudo", ".awa")).toBe("awa");
    expect(nettoiePourLaNature("pseudo", "--awa")).toBe("awa");
    expect(nettoiePourLaNature("pseudo", "_")).toBe("");
  });

  it("ne garde que des chiffres dans un code", () => {
    expect(nettoiePourLaNature("code", "4a1b9c2")).toBe("4192");
  });

  // Une note se tape comme elle vient : rien ne s'y retire.
  it("ne touche pas au texte ordinaire", () => {
    expect(nettoiePourLaNature("texte", "Awa a parlé de céramique.")).toBe("Awa a parlé de céramique.");
  });
});
