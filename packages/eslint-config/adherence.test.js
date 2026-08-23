import { describe, expect, it } from "vitest";
import { Linter } from "eslint";
import { adherence } from "./adherence.js";

const linter = new Linter({ configType: "flat" });
const check = (code) =>
  linter.verify(code, [...adherence, { files: ["**/*.tsx"] }], "composant.tsx");

describe("adhérence au système de design", () => {
  it("refuse une couleur écrite en dur", () => {
    const messages = check(`export const C = () => <div style={{ color: "#7B6BB7" }} />;`);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toMatch(/jeton/i);
  });

  it("accepte un jeton sémantique", () => {
    expect(check(`export const C = () => <div style={{ color: "var(--text-body)" }} />;`)).toEqual([]);
  });

  it("refuse une ombre, sauf celle du cadre d'appareil", () => {
    expect(check(`export const C = () => <div style={{ boxShadow: "0 2px 4px #0003" }} />;`)).toHaveLength(1);
    expect(check(`export const C = () => <div style={{ boxShadow: "var(--shadow-device)" }} />;`)).toEqual([]);
  });

  it("refuse une durée écrite en dur", () => {
    const messages = check(`export const C = () => <div style={{ transition: "color 150ms" }} />;`);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toMatch(/durée|mouvement/i);
  });

  it("laisse passer ce qui n'est pas du style", () => {
    expect(check(`export const C = () => <div data-id="#7B6BB7" />;`)).toEqual([]);
  });

  // A. Liste blanche des variables : dérivée de ce que @lehno/tokens émet
  // réellement, pas d'une convention de préfixe. `--violet` est le nom
  // périmé trouvé tel quel dans Marque.tsx (apps/web/components/Marque.tsx) :
  // il n'est plus émis, et doit donc être refusé, exactement comme une
  // primitive `--lehno-*` l'aurait été avant l'inversion de la règle.
  describe("A. liste blanche dérivée des jetons", () => {
    it("refuse var(--violet), le nom périmé de Marque.tsx", () => {
      const messages = check(`export const C = () => <span style={{ color: "var(--violet)" }} />;`);
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toMatch(/--violet/);
      expect(messages[0].message).toMatch(/pas émise/i);
    });

    it("accepte var(--action), réellement émis par le système de design", () => {
      expect(check(`export const C = () => <button style={{ background: "var(--action)" }} />;`)).toEqual([]);
    });
  });

  // B. Rayons numériques : la règle d'origine ne voyait que des chaînes, donc
  // `borderRadius: 14` — 32 occurrences réelles dans apps/web — passait sans
  // contrôle.
  describe("B. rayons numériques", () => {
    it("refuse borderRadius: 14", () => {
      const messages = check(`export const C = () => <div style={{ borderRadius: 14 }} />;`);
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toMatch(/rayon/i);
    });

    it("accepte un rayon exprimé en jeton", () => {
      expect(check(`export const C = () => <div style={{ borderRadius: "var(--radius-lg)" }} />;`)).toEqual([]);
    });

    it("accepte borderRadius: 0, l'absence de rayon", () => {
      expect(check(`export const C = () => <div style={{ borderRadius: 0 }} />;`)).toEqual([]);
    });
  });

  // C. Attributs JSX : la règle d'origine n'implémentait que Property, donc
  // les 8 fill="#…" / stroke="#…" des drapeaux SVG (apps/web/components/
  // BasculeLangue.tsx) passaient sans contrôle.
  describe("C. attributs JSX (fill, stroke)", () => {
    it("refuse fill=\"#012169\" (drapeau du Royaume-Uni, BasculeLangue.tsx)", () => {
      const messages = check(`export const C = () => <path fill="#012169" />;`);
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toMatch(/jeton/i);
    });

    it("refuse fill={\"#012169\"}", () => {
      const messages = check(`export const C = () => <path fill={"#012169"} />;`);
      expect(messages).toHaveLength(1);
    });

    it("accepte fill=\"currentColor\"", () => {
      expect(check(`export const C = () => <path fill="currentColor" />;`)).toEqual([]);
    });

    it("accepte fill=\"none\"", () => {
      expect(check(`export const C = () => <path fill="none" />;`)).toEqual([]);
    });
  });

  // D. Détection élargie de la couleur en dur : hexadécimal, mais aussi
  // rgb()/hsl() et les couleurs nommées CSS.
  describe("D. couleur en dur, formes élargies", () => {
    it("refuse rgb(122, 74, 34)", () => {
      const messages = check(`export const C = () => <div style={{ color: "rgb(122, 74, 34)" }} />;`);
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toMatch(/jeton/i);
    });

    it("refuse une couleur nommée CSS (white)", () => {
      const messages = check(`export const C = () => <div style={{ color: "white" }} />;`);
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toMatch(/jeton/i);
    });
  });
});
