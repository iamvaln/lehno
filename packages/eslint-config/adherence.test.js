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

  // Une primitive marche, mais elle nomme une couleur au lieu d'une intention :
  // c'est ce qui oblige à relire chaque usage le jour où la couleur change.
  it("refuse une primitive employée directement", () => {
    const messages = check(`export const C = () => <div style={{ color: "var(--lehno-violet)" }} />;`);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toMatch(/primitive/i);
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
});
