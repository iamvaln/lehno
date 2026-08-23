import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Landing from "../app/[locale]/page.js";
import type { ConfigPublique } from "../lib/config-publique.js";

const config: ConfigPublique = {
  signupFreeCredits: 5, creditUnitPrice: 100, currency: "XAF", referralBonusInvited: 0,
};

// La configuration n'entre pas par une prop : Next refuse toute propriété de page
// hors « params ». On pose donc le serveur, ce qui a l'avantage d'éprouver le
// chemin réel — celui qui tournera en production.
const rendre = async (locale: string, servi: ConfigPublique | null = config): Promise<void> => {
  vi.stubEnv("API_URL", "http://api.test");
  vi.stubGlobal(
    "fetch",
    servi === null
      ? vi.fn().mockRejectedValue(new Error("injoignable"))
      : vi.fn().mockResolvedValue({ ok: true, json: async () => servi }),
  );
  render(await Landing({ params: Promise.resolve({ locale }) }));
};

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("landing", () => {
  it("rend le titre dans la langue demandée", async () => {
    await rendre("fr");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Soyez là le jour J");
  });

  it("rend le titre anglais, écrit et non traduit mot à mot", async () => {
    await rendre("en");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Be there on the day");
  });

  it("affiche le prix venu de la configuration, jamais une valeur écrite en dur", async () => {
    await rendre("fr", { ...config, creditUnitPrice: 150 });
    expect(screen.getByText(/150/)).toBeInTheDocument();
    expect(screen.queryByText(/\b100 F\b/)).not.toBeInTheDocument();
  });

  it("affiche les crédits offerts venus de la configuration", async () => {
    await rendre("fr", { ...config, signupFreeCredits: 12 });
    expect(screen.getByText(/12 crédits offerts/)).toBeInTheDocument();
  });

  it("porte un seul h1", async () => {
    await rendre("fr");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("chaque image porte un texte de remplacement", async () => {
    await rendre("fr");
    for (const img of screen.getAllByRole("img")) expect(img).toHaveAccessibleName();
  });

  // Le repli du plan n'était couvert par aucun test : rien n'empêchait de le
  // supprimer. Une page de pré-lancement doit survivre à une panne du serveur.
  it("s'affiche même quand l'API ne répond pas", async () => {
    await rendre("fr", null);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Soyez là le jour J");
    expect(screen.getByText(/100 F/)).toBeInTheDocument();
  });
});
