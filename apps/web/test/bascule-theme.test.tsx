import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BasculeTheme } from "../components/BasculeTheme.js";
import { messages } from "../messages/index.js";

// La tâche 5 a changé le mécanisme de thème (classe lehno-nuit sur le corps,
// plus attribut data-theme sur la racine), mais avait laissé ce bouton écrire
// l'ancien attribut : cliquer ne changeait plus rien à l'écran. Aucun test ne
// l'attrapait — celui-ci le prouve.
describe("bascule de thème", () => {
  const t = messages("fr");

  beforeEach(() => {
    document.documentElement.className = "";
    document.body.className = "";
    localStorage.clear();
  });

  it("part du clair : un clic pose la classe sur le corps et la retient, un second la retire", () => {
    render(<BasculeTheme t={t} />);
    const bouton = screen.getByRole("button", { name: t.themeBascule });

    expect(document.body.classList.contains("lehno-nuit")).toBe(false);

    fireEvent.click(bouton);
    expect(document.body.classList.contains("lehno-nuit")).toBe(true);
    expect(localStorage.getItem("lehno.theme")).toBe("dark");

    fireEvent.click(bouton);
    expect(document.body.classList.contains("lehno-nuit")).toBe(false);
    expect(localStorage.getItem("lehno.theme")).toBe("light");
  });

  // Le script de tête (lib/theme-script.ts) pose la classe sur <html>, <body>
  // n'existant pas encore à l'exécution. Le bouton doit reconnaître cet état
  // au premier clic, pas seulement l'état qu'il a lui-même posé sur le corps.
  it("reconnaît le sombre posé par le script sur la racine, et le retire des deux au clic", () => {
    document.documentElement.classList.add("lehno-nuit");
    render(<BasculeTheme t={t} />);
    const bouton = screen.getByRole("button", { name: t.themeBascule });

    fireEvent.click(bouton);

    expect(document.documentElement.classList.contains("lehno-nuit")).toBe(false);
    expect(document.body.classList.contains("lehno-nuit")).toBe(false);
    expect(localStorage.getItem("lehno.theme")).toBe("light");
  });
});
