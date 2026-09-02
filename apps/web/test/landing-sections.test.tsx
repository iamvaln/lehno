import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { Landing } from "../components/landing/Landing.js";
import { messages } from "../messages/index.js";

// Une section entière de la maquette a déjà disparu du code sans que rien ne
// le signale : l'aperçu du Mur, retiré avec l'ancien composant ApercuMur lors
// de la refonte, et jamais reconstruit. Le test des classes orphelines ne le
// voyait pas — il regarde le CSS, pas ce que la page raconte.
//
// Ce test compare les ancres de section de la maquette à celles que la page
// rend. Il n'a rien à savoir du contenu : il constate qu'aucune section n'a
// été perdue en route.
// Résolu depuis le fichier de test, pas depuis le répertoire courant :
// « pnpm --filter » s'exécute déjà dans apps/web, et un chemin relatif au cwd
// passerait ou échouerait selon d'où on lance la suite.
const maquette = readFileSync(
  join(import.meta.dirname, "..", "..", "..", "specs", "Landing Lehno v3.dc.html"),
  "utf-8",
);

const ancresDeLaMaquette = (): string[] =>
  [...maquette.matchAll(/<section[^>]*\sid="([a-z0-9-]+)"/g)].map((m) => m[1]!);

const configuration = { creditUnitPrice: 150, currency: "XAF", launched: false } as never;

/* Tout est ouvert : un test qui ne parle pas des drapeaux ne doit pas changer
   de sujet à cause d'eux. Ceux qui les éprouvent passent leur propre liste. */
const TOUTES = [
  "wall", "wishes", "wishlist.own", "reservation", "referral",
  "generation.message", "generation.ideas", "generation.portrait",
];

describe("sections de la landing", () => {
  it("la maquette déclare bien des sections à comparer", () => {
    expect(ancresDeLaMaquette()).toEqual(["comment", "contenu", "mur", "prix"]);
  });

  it.each(["fr", "en"] as const)("rend toutes les sections de la maquette, en %s", (langue) => {
    const { container } = render(
      <Landing t={messages(langue)} langue={langue} configuration={configuration} avantLancement features={TOUTES} />,
    );
    const rendues = new Set(
      [...container.querySelectorAll("section[id]")].map((s) => s.getAttribute("id")),
    );

    const manquantes = ancresDeLaMaquette().filter((a) => !rendues.has(a));
    expect(manquantes, `sections de la maquette absentes du rendu : ${manquantes.join(", ")}`).toEqual([]);
  });

  // L'aperçu du Mur en particulier : c'est celui qui avait disparu.
  it("montre l'aperçu du Mur avec ce qu'il promet", () => {
    render(
      <Landing t={messages("fr")} langue="fr" configuration={configuration} avantLancement features={TOUTES} />,
    );

    expect(screen.getByText(messages("fr").murTitre)).toBeInTheDocument();
    expect(screen.getByText(messages("fr").murPiedTitre)).toBeInTheDocument();
    expect(screen.getByText(messages("fr").murPoint3Titre)).toBeInTheDocument();
  });
});
