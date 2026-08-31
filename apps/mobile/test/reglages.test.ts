import { describe, expect, it } from "vitest";
import { corpsDeDeconnexion, sectionsDeReglages } from "../lib/reglages.js";

// La configuration décidée pour la première version : anniversaires seuls,
// versement manuel, collecte et parrainage ouverts, et le message généré.
const LANCEMENT = ["collect", "referral", "topup.manual", "generation.message"];

const cles = (actives: readonly string[]): string[] =>
  sectionsDeReglages(actives).flatMap((s) => s.rangs.map((r) => r.cle));

describe("ce que les réglages montrent", () => {
  /* LA RAISON D'ÊTRE DE L'ÉCRAN. « Moi » disparaît au lancement — ses quatre
     sections sont éteintes — et emportait la déconnexion avec lui. Tant que ce
     rang n'est pas là, personne ne peut sortir de son compte. */
  it("porte la déconnexion, quels que soient les drapeaux", () => {
    expect(cles(LANCEMENT)).toContain("deconnexion");
    expect(cles([])).toContain("deconnexion");
  });

  /* UN GESTE N'EST PAS UNE DESTINATION. La déconnexion n'ouvre aucun écran :
     sans le marqueur `geste`, le filtre qui retire les rangs sans route
     l'emporterait avec les écrans à venir — et l'écran ne servirait plus à
     rien, ce qui est exactement le défaut qu'il vient corriger. */
  it("ne confond pas « pas encore d'écran » avec « rien à faire »", () => {
    const deconnexion = sectionsDeReglages(LANCEMENT)
      .flatMap((s) => s.rangs).find((r) => r.cle === "deconnexion");
    expect(deconnexion?.route).toBeNull();
    expect(deconnexion?.geste).toBe("deconnexion");
  });

  /* Un rang dont l'écran n'existe pas ne s'affiche pas — même règle que les
     sorties de la fiche d'un proche. Ouvrir vers rien apprend à ne pas croire
     les rangs, et c'est plus coûteux qu'un rang absent. Aucun rang n'est
     aujourd'hui dans ce cas : le filtre reste, parce que c'est lui qui rend
     l'arrivée d'un écran indolore. */
  it("tait les rangs dont l'écran n'est pas porté", () => {
    const sansRoute = sectionsDeReglages(LANCEMENT)
      .flatMap((s) => s.rangs)
      .filter((r) => r.route === null && r.geste === undefined);
    expect(sansRoute).toEqual([]);
  });

  /* « Crédits et paiements » DISPARAÎT AU LANCEMENT, et c'est voulu : il ne
     lui reste que les méthodes de paiement, gouvernées par `topup.provider`.
     Le solde, la recharge et le parrainage ont quitté cet écran pour « Moi » —
     « on ouvre le solde plusieurs fois par semaine ; les réglages se
     consultent deux fois par an ». Une section vidée part avec son titre. */
  it("retire une section qui n'a plus aucun rang", () => {
    const sections = sectionsDeReglages(LANCEMENT).map((s) => s.cle);
    expect(sections).not.toContain("argent");
    expect(sections).toContain("alertes");
    expect(sections).toContain("aide");
  });

  /* §3.25 EST PORTÉE désormais : seul le drapeau décide, et la section revient
     entière quand le paiement automatique tient. C'est le chemin qu'on avait
     préparé — « un écran qui arrive n'a qu'à renseigner sa route ». */
  it("la rouvre quand le paiement automatique tient", () => {
    expect(sectionsDeReglages([...LANCEMENT, "topup.provider"]).map((s) => s.cle))
      .toContain("argent");
  });

  /* Un écran qui arrive n'a qu'à renseigner sa route : le rang paraît alors
     de lui-même, sans qu'on touche à l'écran des réglages. Le profil est le
     premier à faire le chemin. */
  it("montre les rangs dont l'écran est porté", () => {
    expect(cles(LANCEMENT)).toContain("profil");
    expect(cles(LANCEMENT)).toContain("securite");
    expect(cles(LANCEMENT)).toContain("rappels");
    expect(cles(LANCEMENT)).toContain("donnees");
    expect(cles(LANCEMENT)).toContain("aide");
  });

  /* Les méthodes de paiement suivent `topup.provider`, éteint au lancement :
     il n'y a rien à enregistrer quand on verse à la main. Le drapeau seul les
     retient maintenant — et le rang paraît dès qu'il tient. */
  it("ouvre les méthodes de paiement avec le paiement automatique, jamais sans", () => {
    expect(cles(LANCEMENT)).not.toContain("paiement");
    expect(cles([...LANCEMENT, "topup.provider"])).toContain("paiement");
  });
});

describe("se déconnecter", () => {
  /* On révoque la LIGNÉE avant d'effacer le trousseau. Le contrat prend le
     jeton dans le CORPS : celui d'accès dit qui, celui-ci dit laquelle. */
  it("nomme la lignée à révoquer", () => {
    expect(corpsDeDeconnexion("r-42")).toEqual({
      chemin: "/auth/session",
      corps: { refreshToken: "r-42" },
    });
  });

  /* Une session déjà morte n'a rien à révoquer — et ça ne doit pas empêcher de
     sortir. Appeler quand même enverrait un corps vide que le schéma refuse,
     et l'échec retiendrait quelqu'un sur un compte dont il veut partir. */
  it("n'appelle rien sans jeton, et laisse sortir quand même", () => {
    expect(corpsDeDeconnexion(null)).toBeNull();
    expect(corpsDeDeconnexion("")).toBeNull();
  });
});
