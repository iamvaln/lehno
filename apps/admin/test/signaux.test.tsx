import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StatCard, AlertPill, AuditTrail, Toast } from "../src/composants/signaux/index.js";
import { RoleGate, ConfirmWithReason, ExportButton } from "../src/composants/actions/index.js";
import { PageHeader, PageTabs, Breadcrumb, FormRow } from "../src/composants/page/index.js";

// --------------------------------------------------------------------------
// StatCard — un chiffre, son libellé, sa variation, et le chemin vers sa section
// --------------------------------------------------------------------------

describe("StatCard", () => {
  it("rend le libellé, la valeur et la variation", () => {
    render(<StatCard libelle="Comptes actifs" valeur="1 284" variation="+38 ce mois" sens="hausse" />);
    expect(screen.getByText("Comptes actifs")).toBeInTheDocument();
    expect(screen.getByText("1 284")).toBeInTheDocument();
    expect(screen.getByText("+38 ce mois")).toBeInTheDocument();
  });

  // Le sens descend en attribut : la teinte se décide dans la feuille, où elle
  // peut différer d'un thème à l'autre sans que le composant connaisse un jeton.
  it("porte le sens de la variation en attribut, jamais en couleur écrite en ligne", () => {
    const { container } = render(<StatCard libelle="Échecs" valeur="22 %" variation="+7 pts" sens="baisse" />);
    const variation = container.querySelector("[data-sens]")!;
    expect(variation).toHaveAttribute("data-sens", "baisse");
    expect(variation.getAttribute("style")).toBeNull();
  });

  it("n'est pas cliquable sans onClick", () => {
    render(<StatCard libelle="Comptes actifs" valeur="1 284" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("mène à sa section quand on lui donne un onClick", async () => {
    const aller = vi.fn();
    render(<StatCard libelle="Comptes actifs" valeur="1 284" onClick={aller} />);
    await userEvent.click(screen.getByRole("button", { name: /Comptes actifs/ }));
    expect(aller).toHaveBeenCalledOnce();
  });
});

// --------------------------------------------------------------------------
// AlertPill — une anomalie en une ligne ; « notifié » dit que le mail est parti
// --------------------------------------------------------------------------

describe("AlertPill", () => {
  it("dit l'anomalie en une ligne", () => {
    render(<AlertPill>22 % d'échecs — Rédaction longue</AlertPill>);
    expect(screen.getByText(/22 % d'échecs/)).toBeInTheDocument();
  });

  it("retombe sur le ton d'alerte et porte son ton en attribut", () => {
    const { container } = render(<AlertPill>2 paiements bloqués</AlertPill>);
    expect(container.querySelector("[data-ton]")).toHaveAttribute("data-ton", "alerte");
  });

  // Le panel et le courriel sont deux vues d'un même événement : la pastille
  // rappelle que l'alerte est déjà partie, pour qu'on ne prévienne pas deux fois.
  it("rappelle que le courriel est déjà parti", () => {
    render(<AlertPill notifie="notifié à 14 h">2 suppressions ce soir</AlertPill>);
    expect(screen.getByText("notifié à 14 h")).toBeInTheDocument();
  });

  it("ne porte pas le détail : il vit dans l'attribut de survol", () => {
    render(<AlertPill titre="22 % des générations ont échoué depuis 6 h.">22 % d'échecs</AlertPill>);
    expect(screen.getByTitle("22 % des générations ont échoué depuis 6 h.")).toBeInTheDocument();
  });

  it("mène à la section concernée", async () => {
    const aller = vi.fn();
    render(<AlertPill onClick={aller}>2 suppressions ce soir</AlertPill>);
    await userEvent.click(screen.getByRole("button"));
    expect(aller).toHaveBeenCalledOnce();
  });
});

// --------------------------------------------------------------------------
// AuditTrail — la traçabilité se lit depuis l'objet, motif compris
// --------------------------------------------------------------------------

const HISTORIQUE = [
  {
    id: "i1",
    date: "12 mars 2026, 14 h 02",
    auteur: "claire@lehno.app",
    action: "Compte suspendu",
    motif: "Signalement pour usurpation",
  },
  {
    id: "i2",
    date: "3 mars 2026, 09 h 41",
    auteur: "valentine@lehno.app",
    action: "Solde ajusté de +2 crédits",
    motif: "Achat non crédité",
  },
];

describe("AuditTrail", () => {
  // Le cœur de la règle : une entrée sans son motif ne prouve rien. Date,
  // auteur, action et motif se lisent ensemble, sur la même ligne.
  it("rend la date, l'auteur, l'action et le motif de chaque intervention", () => {
    render(<AuditTrail entrees={HISTORIQUE} libelleMotif="Motif" />);
    const entrees = screen.getAllByRole("listitem");
    expect(entrees).toHaveLength(2);

    const premiere = within(entrees[0]!);
    expect(premiere.getByText("Compte suspendu")).toBeInTheDocument();
    expect(premiere.getByText("claire@lehno.app")).toBeInTheDocument();
    expect(premiere.getByText("12 mars 2026, 14 h 02")).toBeInTheDocument();
    expect(premiere.getByText(/Signalement pour usurpation/)).toBeInTheDocument();
  });

  it("titre l'historique quand la page lui donne un titre, et se tait sinon", () => {
    const { rerender } = render(<AuditTrail entrees={HISTORIQUE} titre="Historique des interventions" />);
    expect(screen.getByRole("heading", { name: "Historique des interventions" })).toBeInTheDocument();
    rerender(<AuditTrail entrees={HISTORIQUE} />);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("rend une liste vide sans se casser", () => {
    render(<AuditTrail entrees={[]} />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

// --------------------------------------------------------------------------
// Toast — accuse un geste et s'efface seul
// --------------------------------------------------------------------------

describe("Toast", () => {
  it("accuse le geste sans arrêter la lecture", () => {
    render(<Toast>Solde de valentine ajusté de +2 crédits.</Toast>);
    expect(screen.getByRole("status")).toHaveTextContent("Solde de valentine ajusté");
  });

  // Une erreur se dit plus fort qu'un accusé — mais une erreur bloquante n'est
  // pas un toast : elle reste sous les yeux, en bannière.
  it("hausse le ton pour un échec", () => {
    render(<Toast intent="error">L'export a échoué.</Toast>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("s'efface seul au bout de sa durée", () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<Toast onDismiss={onDismiss} duree={6000}>Compte suspendu.</Toast>);
      expect(onDismiss).not.toHaveBeenCalled();
      act(() => void vi.advanceTimersByTime(6000));
      expect(onDismiss).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ne s'efface pas quand la durée est nulle", () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<Toast onDismiss={onDismiss} duree={0}>Compte suspendu.</Toast>);
      act(() => void vi.advanceTimersByTime(60000));
      expect(onDismiss).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("offre une sortie au geste qu'il accuse", async () => {
    const annuler = vi.fn();
    render(<Toast action="Annuler" onAction={annuler}>Solde ajusté.</Toast>);
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(annuler).toHaveBeenCalledOnce();
  });
});

// --------------------------------------------------------------------------
// RoleGate — il retire, il ne grise pas
// --------------------------------------------------------------------------

describe("RoleGate", () => {
  // Un bouton grisé promet une permission qu'on n'a pas : il faut qu'il ne
  // reste rien du tout, pas même un conteneur vide.
  it("ne laisse rien dans le DOM quand le rôle n'a pas le droit", () => {
    const { container } = render(
      <RoleGate role="support" autorise="admin">
        <button type="button">Ajuster le solde</button>
      </RoleGate>,
    );
    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("button", { hidden: true })).toBeNull();
  });

  it("rend les enfants tels quels quand le rôle a le droit", () => {
    const { container } = render(
      <RoleGate role="admin" autorise="admin">
        <button type="button">Ajuster le solde</button>
      </RoleGate>,
    );
    expect(screen.getByRole("button", { name: "Ajuster le solde" })).toBeInTheDocument();
    // Aucun emballage : l'enfant est le premier nœud du conteneur.
    expect(container.firstElementChild!.tagName).toBe("BUTTON");
  });

  it("accepte une liste de rôles", () => {
    render(
      <RoleGate role="support" autorise={["support", "admin"]}>
        <button type="button">Voir le compte</button>
      </RoleGate>,
    );
    expect(screen.getByRole("button", { name: "Voir le compte" })).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------
// ConfirmWithReason — le motif est obligatoire, et il fait six caractères
// --------------------------------------------------------------------------

const LIBELLES_CONFIRMATION = {
  motif: "Motif",
  choisir: "Choisir un motif",
  autre: "Autre — préciser",
  precision: "Préciser le motif",
  journal: "Ce motif est inscrit au journal d'audit avec votre nom.",
  annuler: "Annuler",
  confirmer: "Confirmer",
};

function poserLaConfirmation(onConfirmer = vi.fn(), onAnnuler = vi.fn()) {
  render(
    <ConfirmWithReason
      destructif
      titre="Suspendre ce compte ?"
      consequence="Plus de connexion possible, et les surfaces publiques cessent de répondre."
      motifs={["Spam", "Fraude suspectée"]}
      libelles={LIBELLES_CONFIRMATION}
      onConfirmer={onConfirmer}
      onAnnuler={onAnnuler}
    />,
  );
  return { onConfirmer, onAnnuler, bouton: () => screen.getByRole("button", { name: "Confirmer" }) };
}

describe("ConfirmWithReason", () => {
  it("écrit la conséquence en clair", () => {
    poserLaConfirmation();
    expect(screen.getByRole("dialog")).toHaveTextContent("les surfaces publiques cessent de répondre");
  });

  it("reste inopérant tant que le motif est vide", async () => {
    const { onConfirmer, bouton } = poserLaConfirmation();
    expect(bouton()).toBeDisabled();
    await userEvent.click(bouton());
    expect(onConfirmer).not.toHaveBeenCalled();
  });

  // Le contrat serveur (motifSchema) impose six caractères après élagage : un
  // motif de deux lettres satisferait la lettre de la règle et la viderait.
  it("reste inopérant sur un motif trop court", async () => {
    const { onConfirmer, bouton } = poserLaConfirmation();
    await userEvent.selectOptions(screen.getByLabelText("Motif"), "Spam");
    expect(bouton()).toBeDisabled();
    await userEvent.click(bouton());
    expect(onConfirmer).not.toHaveBeenCalled();
  });

  it("s'ouvre dès que le motif suffit, et le remonte tel quel", async () => {
    const { onConfirmer, bouton } = poserLaConfirmation();
    await userEvent.selectOptions(screen.getByLabelText("Motif"), "Fraude suspectée");
    expect(bouton()).toBeEnabled();
    await userEvent.click(bouton());
    expect(onConfirmer).toHaveBeenCalledWith("Fraude suspectée");
  });

  it("ajoute « Autre — préciser » d'office et accepte un motif écrit", async () => {
    const { onConfirmer, bouton } = poserLaConfirmation();
    expect(screen.getByRole("option", { name: "Autre — préciser" })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Motif"), screen.getByRole("option", { name: "Autre — préciser" }));
    const champ = screen.getByLabelText("Préciser le motif");

    await userEvent.type(champ, "abc");
    expect(bouton()).toBeDisabled();

    await userEvent.clear(champ);
    await userEvent.type(champ, "  Demande du titulaire  ");
    expect(bouton()).toBeEnabled();
    await userEvent.click(bouton());
    // Le motif part élagué, comme le serveur le recevra.
    expect(onConfirmer).toHaveBeenCalledWith("Demande du titulaire");
  });

  it("laisse toujours une sortie", async () => {
    const { onAnnuler } = poserLaConfirmation();
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onAnnuler).toHaveBeenCalledOnce();
  });

  it("se referme à la touche d'échappement", async () => {
    const { onAnnuler } = poserLaConfirmation();
    await userEvent.keyboard("{Escape}");
    expect(onAnnuler).toHaveBeenCalledOnce();
  });
});

// --------------------------------------------------------------------------
// ExportButton — il dit ce qu'il emporte
// --------------------------------------------------------------------------

const LIBELLES_EXPORT = {
  exporter: "Exporter",
  avecPortee: "Exporter {portee}",
  encours: "Préparation de l'export…",
  formats: { csv: "CSV", json: "JSON" },
  journal: "Tout export est inscrit au journal d'audit.",
};

describe("ExportButton", () => {
  // Sans la portée, personne ne sait s'il emporte la page, le filtre ou la base.
  it("dit la portée de ce qu'il sort", () => {
    render(<ExportButton portee="12 comptes sélectionnés" libelles={LIBELLES_EXPORT} onExport={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Exporter 12 comptes sélectionnés" })).toBeInTheDocument();
  });

  it("exporte au clic quand il n'a qu'un format", async () => {
    const onExport = vi.fn();
    render(<ExportButton libelles={LIBELLES_EXPORT} onExport={onExport} />);
    await userEvent.click(screen.getByRole("button", { name: "Exporter" }));
    expect(onExport).toHaveBeenCalledWith("csv");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("ouvre un menu quand il en a plusieurs", async () => {
    const onExport = vi.fn();
    render(<ExportButton formats={["csv", "json"]} libelles={LIBELLES_EXPORT} onExport={onExport} />);
    const declencheur = screen.getByRole("button", { name: "Exporter" });
    expect(declencheur).toHaveAttribute("aria-haspopup", "menu");

    await userEvent.click(declencheur);
    expect(onExport).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("menuitem", { name: "JSON" }));
    expect(onExport).toHaveBeenCalledWith("json");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("montre sa préparation à la place du bouton", () => {
    render(<ExportButton etat="encours" libelles={LIBELLES_EXPORT} onExport={vi.fn()} />);
    expect(screen.getByText("Préparation de l'export…")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

// --------------------------------------------------------------------------
// PageHeader · PageTabs · Breadcrumb · FormRow
// --------------------------------------------------------------------------

describe("PageHeader", () => {
  it("rend le titre, le sous-titre et les actions", () => {
    render(
      <PageHeader titre="Comptes" sous="1 284 comptes actifs" actions={<button type="button">Exporter</button>} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Comptes" })).toBeInTheDocument();
    expect(screen.getByText("1 284 comptes actifs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exporter" })).toBeInTheDocument();
  });
});

describe("PageTabs", () => {
  const ONGLETS = [
    { id: "economie", label: "Économie" },
    { id: "evenements", label: "Types d'événements", compte: 6 },
  ];

  it("marque l'onglet actif et remonte le choix", async () => {
    const onSelect = vi.fn();
    render(<PageTabs onglets={ONGLETS} actif="economie" onSelect={onSelect} />);
    const [economie, evenements] = screen.getAllByRole("tab");
    expect(economie).toHaveAttribute("aria-selected", "true");
    expect(evenements).toHaveAttribute("aria-selected", "false");

    await userEvent.click(evenements!);
    expect(onSelect).toHaveBeenCalledWith("evenements");
  });

  it("affiche le compte derrière l'onglet quand il aide à choisir", () => {
    render(<PageTabs onglets={ONGLETS} actif="economie" onSelect={vi.fn()} />);
    expect(screen.getByText("6")).toBeInTheDocument();
  });
});

describe("Breadcrumb", () => {
  const RACINE = { id: "tableau", label: "Tableau de bord" };

  it("pose sa racine lui-même : items ne porte que la suite", () => {
    render(
      <Breadcrumb
        racine={RACINE}
        items={[{ id: "comptes", label: "Comptes" }, { label: "Valentine" }]}
        libelle="Fil d'Ariane"
      />,
    );
    const fil = screen.getByRole("navigation", { name: "Fil d'Ariane" });
    expect(fil).toHaveTextContent(/Tableau de bord.*Comptes.*Valentine/);
  });

  it("ne fait pas un lien du dernier élément", () => {
    render(<Breadcrumb racine={RACINE} items={[{ label: "Valentine" }]} onNavigate={vi.fn()} />);
    expect(screen.getByText("Valentine")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "Valentine" })).toBeNull();
  });

  it("remonte la cible du segment cliqué", async () => {
    const aller = vi.fn();
    render(
      <Breadcrumb racine={RACINE} items={[{ id: "comptes", label: "Comptes" }, { label: "Valentine" }]} onNavigate={aller} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Comptes" }));
    expect(aller).toHaveBeenCalledWith("comptes");
  });
});

describe("FormRow", () => {
  // Rappeler la valeur précédente est ce qui distingue un réglage qui pilote le
  // produit d'un champ ordinaire.
  it("rappelle la valeur précédente à côté du champ", () => {
    render(
      <FormRow label="Prix du crédit" aide="Prend effet dès l'enregistrement." precedente="80 F" libellePrecedente="Valeur précédente">
        <input aria-label="Prix du crédit" defaultValue="100" />
      </FormRow>,
    );
    expect(screen.getByText("Prix du crédit")).toBeInTheDocument();
    expect(screen.getByText("Prend effet dès l'enregistrement.")).toBeInTheDocument();
    expect(screen.getByText(/80 F/)).toBeInTheDocument();
    expect(screen.getByLabelText("Prix du crédit")).toHaveValue("100");
  });

  it("porte l'erreur du champ", () => {
    const { container } = render(
      <FormRow label="Prix du crédit" erreur="Un prix ne peut pas être négatif.">
        <input aria-label="Prix du crédit" defaultValue="-1" />
      </FormRow>,
    );
    expect(screen.getByText("Un prix ne peut pas être négatif.")).toBeInTheDocument();
    expect(container.querySelector("[data-erreur]")).toHaveAttribute("data-erreur", "true");
  });

  it("ne rend ni aide, ni valeur précédente, ni erreur quand on ne lui en donne pas", () => {
    const { container } = render(
      <FormRow label="Prix du crédit">
        <input aria-label="Prix du crédit" />
      </FormRow>,
    );
    expect(container.querySelector(".admin-rang-aide")).toBeNull();
    expect(container.querySelector(".admin-rang-precedente")).toBeNull();
    expect(container.querySelector(".admin-rang-erreur")).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Adhérence — les mêmes vérifications textuelles que pour les composants de
// données : aucune couleur en dur, aucune chaîne destinée à l'écran.
// --------------------------------------------------------------------------

const FICHIERS = [
  ...["StatCard", "AlertPill", "AuditTrail", "Toast", "index"].map((n) => [`signaux/${n}`] as const),
  ...["RoleGate", "ConfirmWithReason", "ExportButton", "index"].map((n) => [`actions/${n}`] as const),
  ...["PageHeader", "PageTabs", "Breadcrumb", "FormRow", "index"].map((n) => [`page/${n}`] as const),
].map(([chemin]) => [chemin, readFileSync(`src/composants/${chemin}.tsx`, "utf-8")] as const);

const CSS = readFileSync("src/styles/signaux.css", "utf-8");

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("adhérence des composants de signal, d'action et de page", () => {
  it.each(FICHIERS)("%s n'écrit aucune couleur en dur", (_nom, source) => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
  });

  it.each(FICHIERS)("%s ne porte aucune chaîne destinée à l'écran", (_nom, source) => {
    expect(sansCommentaires(source)).not.toMatch(/["'`][^"'`]*[àâäéèêëîïôöùûüçÀÉÈÊ][^"'`]*["'`]/);
  });

  it.each(FICHIERS)("%s ne rend aucun texte en clair dans le JSX", (_nom, source) => {
    expect(sansCommentaires(source)).not.toMatch(/>[^<>{}\n]*\p{L}[^<>{}\n]*</u);
  });

  it("la feuille n'écrit ni couleur, ni ombre, ni rayon, ni durée en dur", () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CSS).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    expect(CSS).not.toMatch(/box-shadow/);
    expect(CSS).not.toMatch(/border-radius:(?!\s*var\()/);
    expect(CSS).not.toMatch(/\b\d+m?s\b/);
  });
});
