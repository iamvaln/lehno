import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button, Card, Tag, SectionLabel, Avatar, Icon } from "../components/ui/index.js";

describe("noyau", () => {
  it("le bouton rend un vrai bouton, accessible par son libellé", () => {
    render(<Button>Commencer</Button>);
    expect(screen.getByRole("button", { name: "Commencer" })).toBeInTheDocument();
  });

  it("le bouton désactivé l'est pour les technologies d'assistance", () => {
    render(<Button disabled>Commencer</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  // Aucune valeur littérale : c'est ce qui rend la bascule de thème fiable.
  it.each(["primary", "outline", "text", "destructive", "destructive-outline", "neutral"] as const)(
    "le rang %s n'emploie que des jetons",
    (variant) => {
      const { container } = render(<Button variant={variant}>x</Button>);
      const style = container.querySelector("button")!.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style).not.toMatch(/var\(--lehno-/);
    },
  );

  it("la cible tactile du bouton mobile atteint le minimum de la charte", () => {
    const { container } = render(<Button platform="mobile">x</Button>);
    expect(container.querySelector("button")!.getAttribute("style")).toContain("var(--touch-min)");
  });

  it("l'avatar sans photo montre l'initiale et reste nommé", () => {
    render(<Avatar name="Valentine" />);
    expect(screen.getByText("V")).toBeInTheDocument();
    expect(screen.getByLabelText("Valentine")).toBeInTheDocument();
  });

  it("l'avatar avec photo porte un texte de remplacement", () => {
    render(<Avatar name="Valentine" src="/v.jpg" />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Valentine");
  });

  // Une icône accompagne un texte : elle ne doit pas être annoncée deux fois.
  it("l'icône décorative est masquée aux technologies d'assistance", () => {
    const { container } = render(<Icon name="calendar" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("l'icône prend la couleur du texte qu'elle accompagne", () => {
    const { container } = render(<Icon name="calendar" />);
    expect(container.querySelector("svg")).toHaveAttribute("stroke", "currentColor");
  });

  it.each(["card", "panel", "plain"] as const)("la carte %s n'emploie que des jetons", (surface) => {
    const { container } = render(<Card surface={surface}>x</Card>);
    const style = container.firstElementChild!.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("aucun composant du noyau ne porte d'ombre", () => {
    for (const element of [<Button key="b">x</Button>, <Card key="c">x</Card>, <Tag key="t">x</Tag>]) {
      const { container } = render(element);
      expect(container.innerHTML).not.toMatch(/box-shadow/i);
    }
  });

  it("le surtitre et l'étiquette rendent leur contenu", () => {
    render(<><SectionLabel>Ce qui approche</SectionLabel><Tag tone="celebrate">aujourd'hui</Tag></>);
    expect(screen.getByText("Ce qui approche")).toBeInTheDocument();
    expect(screen.getByText("aujourd'hui")).toBeInTheDocument();
  });
});
