import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Countdown, Provenance, Quote, Banner, TextField } from "../components/ui/index.js";

describe("contenu, message, saisie", () => {
  it("le décompte suit la notation de sa langue", () => {
    const { rerender } = render(<Countdown days={3} locale="fr" />);
    expect(screen.getByText(/J.3/)).toBeInTheDocument();
    rerender(<Countdown days={3} locale="en" />);
    expect(screen.getByText("3 days")).toBeInTheDocument();
  });

  it("à zéro jour, le décompte devient « aujourd'hui »", () => {
    render(<Countdown days={0} locale="fr" />);
    expect(screen.getByText(/aujourd'hui/i)).toBeInTheDocument();
  });

  it("le singulier anglais n'est pas au pluriel", () => {
    render(<Countdown days={1} locale="en" />);
    expect(screen.getByText("1 day")).toBeInTheDocument();
  });

  it.each(["info", "success", "warning", "error"] as const)(
    "le bandeau %s n'emploie que des jetons et annonce son rôle",
    (intent) => {
      const { container } = render(<Banner intent={intent}>message</Banner>);
      const style = container.firstElementChild!.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style).toContain(`var(--feedback-${intent})`);
    },
  );

  // Un message d'erreur qui n'est pas annoncé n'existe pas pour qui n'y regarde pas.
  it("le bandeau d'erreur est annoncé aux technologies d'assistance", () => {
    render(<Banner intent="error">adresse invalide</Banner>);
    expect(screen.getByRole("alert")).toHaveTextContent("adresse invalide");
  });

  it("le bandeau ne se ferme que si on lui donne de quoi le faire", async () => {
    const fermer = vi.fn();
    const { rerender } = render(<Banner intent="info">x</Banner>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<Banner intent="info" onDismiss={fermer}>x</Banner>);
    await userEvent.click(screen.getByRole("button"));
    expect(fermer).toHaveBeenCalledOnce();
  });

  it("le champ lie son libellé à sa saisie", async () => {
    render(<TextField label="Votre adresse" />);
    await userEvent.type(screen.getByLabelText("Votre adresse"), "a@b.fr");
    expect(screen.getByLabelText("Votre adresse")).toHaveValue("a@b.fr");
  });

  it("un champ invalide le dit, et son aide devient le message d'erreur", () => {
    render(<TextField label="Adresse" hint="Cette adresse ne convient pas" invalid />);
    const champ = screen.getByLabelText("Adresse");
    expect(champ).toHaveAttribute("aria-invalid", "true");
    expect(champ).toHaveAccessibleDescription("Cette adresse ne convient pas");
  });

  // Sous 16 px, le navigateur mobile agrandit la page à la mise au point.
  it("le champ mobile ne descend pas sous 16 px", () => {
    const { container } = render(<TextField platform="mobile" label="x" />);
    expect(container.querySelector("input")!.getAttribute("style")).toContain("var(--text-body-m)");
  });

  it("la citation met les guillemets au-delà du seuil, pas avant", () => {
    const court = "Merci pour l'été dernier.";
    const long = "Karim, 36 ans et toujours cette manie de refaire le monde à minuit, merci pour tout.";
    const { rerender } = render(<Quote>{court}</Quote>);
    expect(screen.getByText(court)).not.toHaveTextContent("«");
    rerender(<Quote>{long}</Quote>);
    expect(screen.getByText(/«/)).toBeInTheDocument();
  });

  it("la provenance rend son origine et sa date", () => {
    render(<Provenance origin="noté" date="en mars" />);
    expect(screen.getByText(/noté.*en mars/)).toBeInTheDocument();
  });
});
