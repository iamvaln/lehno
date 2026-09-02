import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Intervention } from "../components/surfaces/Intervention.js";
import { messages } from "../messages/index.js";

const t = messages("fr");

/* Deux états, parce que l'heure de retour est facultative : avec elle on dit
   quand revenir, sans elle on dit seulement qu'une mise à jour est en cours.
   Pas de « bientôt », pas d'estimation inventée. */
describe("l'arrêt pour intervention", () => {
  it("dit quand revenir quand l'heure est annoncée", () => {
    render(<Intervention t={t} langue="fr" retour="2026-08-31T14:30:00.000Z" />);
    expect(screen.getByRole("heading", { level: 1, name: t.interventionTitre })).toBeInTheDocument();
    expect(screen.getByText(/Le service revient vers/)).toBeInTheDocument();
  });

  it("n'invente rien quand l'heure manque", () => {
    render(<Intervention t={t} langue="fr" retour={null} />);
    expect(screen.getByText(t.interventionSansHeure)).toBeInTheDocument();
    expect(screen.queryByText(/revient vers/)).toBeNull();
  });

  /* Le serveur envoie de l'UTC et ne connaît pas le fuseau du lecteur. Une
     heure affichée dans celui du serveur ferait attendre deux heures de trop,
     ou repartir trop tôt. */
  it("met l'heure à celle du lecteur", () => {
    render(<Intervention t={t} langue="fr" retour="2026-08-31T14:30:00.000Z" />);
    const attendue = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" })
      .format(new Date("2026-08-31T14:30:00.000Z"));
    expect(screen.getByText(new RegExp(attendue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeInTheDocument();
  });
});
