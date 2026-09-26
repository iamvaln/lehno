import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* « MARQUER ENVOYÉ » — §13 du relevé des essais.
 *
 * Deux défauts, sur la même carte de l'accueil :
 *
 * — Le geste ne faisait qu'un `setState` et un accusé. Aucun appel réseau,
 *   donc aucune trace, et le bouton revenait au premier rechargement — vu à
 *   l'appareil : « Message marqué comme envoyé à Awa », et pourtant aucune
 *   trace nulle part de ce qui avait été « envoyé ».
 *
 * — Le geste s'offrait dès que la nature « message » était ouverte sur le
 *   compte, qu'un brouillon existe ou non — la carte proposait de marquer
 *   envoyé un texte qui n'avait jamais été écrit.
 *
 * `react-native` est typé en Flow et un test qui monterait l'écran ne
 * compilerait pas — même contrainte que `carte-echeance.test.ts`. Ces gardes
 * lisent donc la SOURCE, et c'est voulu : la décision fautive vivait dans
 * l'écran, pas dans une bibliothèque qu'un test de rendu aurait pu éprouver.
 */
const accueil = readFileSync(
  new URL("../app/(app)/accueil/index.tsx", import.meta.url), "utf8",
);

describe("« Marquer envoyé »", () => {
  it("ne s'offre que si un brouillon existe pour cette échéance", () => {
    expect(accueil).toContain("e.draftMessageId !== null && !envoyes[e.id]");
  });

  it("appelle réellement le serveur, sur la route déclarative des messages", () => {
    expect(accueil).toContain("appel<unknown>(`/me/messages/${messageId}`");
    expect(accueil).toContain('method: "PATCH"');
    expect(accueil).toContain("markSent: true");
  });

  /* Le piège qu'on ne rouvre pas : un geste qui accuse réception sans avoir
     appelé quoi que ce soit — exactement le défaut d'origine. */
  it("n'accuse réception qu'après la réponse du serveur, jamais avant", () => {
    const bloc = accueil.slice(accueil.indexOf("onMarkSent: () => {"));
    const appelRang = bloc.indexOf("await appel<unknown>(`/me/messages/");
    const accuseRang = bloc.indexOf("setAccuse(t.envoiFait(");
    expect(appelRang).toBeGreaterThan(-1);
    expect(accuseRang).toBeGreaterThan(appelRang);
  });

  it("dit l'échec plutôt que de le taire", () => {
    expect(accueil).toContain("setEchecMarquage(");
    expect(accueil).toContain('<Toast intent="error" onDismiss={() => setEchecMarquage(null)}>');
  });
});
