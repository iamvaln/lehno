import { describe, expect, it } from "vitest";
import { horsConnexion } from "../lib/reseau.js";

describe("savoir qu'on est hors connexion", () => {
  it("l'est quand aucune interface n'est montée", () => {
    expect(horsConnexion({ isConnected: false, isInternetReachable: false })).toBe(true);
  });

  /* LE PORTAIL CAPTIF. Un hôtel, un aéroport : l'interface est montée, rien ne
     passe. C'est le cas où l'on se croit en ligne — et le seul que
     `isConnected` seul manque. */
  it("l'est derrière un portail captif, interface montée comprise", () => {
    expect(horsConnexion({ isConnected: true, isInternetReachable: false })).toBe(true);
  });

  it("ne l'est pas quand tout répond", () => {
    expect(horsConnexion({ isConnected: true, isInternetReachable: true })).toBe(false);
  });

  /* NUL NE VEUT PAS DIRE « INJOIGNABLE », il veut dire « on ne sait pas encore ».
     Retenir une action sur ce doute ferait attendre quelqu'un dont le réseau va
     parfaitement — et la première action d'une session tombe précisément dans
     cette fenêtre, avant que la mesure soit faite. */
  it("laisse passer tant que la mesure n'est pas faite", () => {
    expect(horsConnexion({ isConnected: true, isInternetReachable: null })).toBe(false);
    expect(horsConnexion({ isConnected: null, isInternetReachable: null })).toBe(false);
    expect(horsConnexion(null)).toBe(false);
  });

  /* Une interface tombée tranche même sans mesure de joignabilité : il n'y a
     rien au bout d'un câble débranché, et attendre la mesure ferait envoyer une
     requête qu'on sait perdue. */
  it("tranche sur l'interface même sans mesure", () => {
    expect(horsConnexion({ isConnected: false, isInternetReachable: null })).toBe(true);
  });

  /* `undefined` DIT LA MÊME CHOSE QUE `null` : la plateforme ne sait pas
     répondre. Les traiter différemment ferait dépendre le comportement du
     système d'exploitation plutôt que de l'état du réseau — et le bogue ne
     paraîtrait que sur l'un des deux. */
  it("traite l'absence de valeur comme l'absence de mesure", () => {
    expect(horsConnexion({})).toBe(false);
    expect(horsConnexion({ isConnected: true })).toBe(false);
    expect(horsConnexion({ isConnected: false })).toBe(true);
    expect(horsConnexion({ isInternetReachable: false })).toBe(true);
  });
});
