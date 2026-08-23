import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DataTable,
  Pagination,
  FilterBar,
  EmptyState,
  StatusPill,
  type Colonne,
} from "../src/composants/donnees/index.js";

// Trois comptes délibérément dans le désordre alphabétique : c'est ce désordre
// qui prouve que le tableau n'ordonne rien de lui-même.
interface Compte {
  id: string;
  pseudo: string;
  credits: number;
}

const LIGNES: Compte[] = [
  { id: "c", pseudo: "Charlie", credits: 3 },
  { id: "a", pseudo: "Alice", credits: 12 },
  { id: "b", pseudo: "Bob", credits: 7 },
];

const COLONNES: Colonne<Compte>[] = [
  { cle: "pseudo", titre: "Pseudo", triable: true },
  { cle: "credits", titre: "Crédits", aligne: "right" },
];

function pseudosRendus(): string[] {
  const corps = screen.getAllByRole("rowgroup")[1]!;
  return within(corps)
    .getAllByRole("row")
    .map((tr) => tr.querySelectorAll("td")[0]!.textContent!.trim());
}

describe("DataTable", () => {
  it("rend les lignes dans l'ordre reçu, sans les réordonner", () => {
    render(<DataTable colonnes={COLONNES} lignes={LIGNES} />);
    expect(pseudosRendus()).toEqual(["Charlie", "Alice", "Bob"]);
  });

  // Le test central : le tri est un état affiché et un événement remonté, pas
  // un calcul. La page trie, interroge, et rend de nouvelles lignes ; le
  // tableau ne bouge pas tout seul.
  it("ne réordonne pas les lignes au clic sur un en-tête triable", async () => {
    const onTri = vi.fn();
    render(
      <DataTable
        colonnes={COLONNES}
        lignes={LIGNES}
        tri={{ cle: "pseudo", sens: "asc" }}
        onTri={onTri}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Pseudo/ }));

    expect(onTri).toHaveBeenCalledOnce();
    expect(onTri).toHaveBeenCalledWith("pseudo");
    expect(pseudosRendus()).toEqual(["Charlie", "Alice", "Bob"]);
  });

  it("affiche l'état du tri sur la colonne concernée", () => {
    render(
      <DataTable
        colonnes={COLONNES}
        lignes={LIGNES}
        tri={{ cle: "pseudo", sens: "desc" }}
        onTri={vi.fn()}
      />,
    );
    const entetes = screen.getAllByRole("columnheader");
    expect(entetes[0]).toHaveAttribute("aria-sort", "descending");
    expect(entetes[1]).toHaveAttribute("aria-sort", "none");
  });

  it("ne rend pas d'en-tête cliquable sans onTri", () => {
    render(<DataTable colonnes={COLONNES} lignes={LIGNES} />);
    expect(screen.queryByRole("button", { name: /Pseudo/ })).toBeNull();
  });

  it("n'affiche aucune case à cocher sans onSelection", () => {
    render(<DataTable colonnes={COLONNES} lignes={LIGNES} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("affiche la colonne de cases dès que onSelection est fourni", async () => {
    const onSelection = vi.fn();
    render(
      <DataTable
        colonnes={COLONNES}
        lignes={LIGNES}
        selection={[]}
        onSelection={onSelection}
        nom={(l) => l.pseudo}
        libelles={{ toutSelectionner: "Tout sélectionner", selectionner: "Sélectionner {nom}" }}
      />,
    );

    // Une case par ligne, plus celle de l'en-tête.
    expect(screen.getAllByRole("checkbox")).toHaveLength(LIGNES.length + 1);

    await userEvent.click(screen.getByRole("checkbox", { name: "Sélectionner Alice" }));
    expect(onSelection).toHaveBeenCalledOnce();
    expect(onSelection).toHaveBeenCalledWith(["a"]);
  });

  it("coche tout puis décoche tout depuis l'en-tête", async () => {
    const onSelection = vi.fn();
    const { rerender } = render(
      <DataTable
        colonnes={COLONNES}
        lignes={LIGNES}
        selection={[]}
        onSelection={onSelection}
        libelles={{ toutSelectionner: "Tout sélectionner" }}
      />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Tout sélectionner" }));
    expect(onSelection).toHaveBeenCalledOnce();
    expect(onSelection).toHaveBeenCalledWith(["c", "a", "b"]);

    onSelection.mockClear();
    rerender(
      <DataTable
        colonnes={COLONNES}
        lignes={LIGNES}
        selection={["c", "a", "b"]}
        onSelection={onSelection}
        libelles={{ toutSelectionner: "Tout sélectionner" }}
      />,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Tout sélectionner" }));
    expect(onSelection).toHaveBeenCalledOnce();
    expect(onSelection).toHaveBeenCalledWith([]);
  });

  it("marque la ligne cochée par un attribut, pas par une couleur en ligne", () => {
    render(
      <DataTable
        colonnes={COLONNES}
        lignes={LIGNES}
        selection={["a"]}
        onSelection={vi.fn()}
        libelles={{ toutSelectionner: "Tout sélectionner" }}
      />,
    );
    const corps = screen.getAllByRole("rowgroup")[1]!;
    const lignes = within(corps).getAllByRole("row");
    expect(lignes[1]).toHaveAttribute("data-cochee", "true");
    expect(lignes[0]).toHaveAttribute("data-cochee", "false");
    expect(lignes[1]!.getAttribute("style") ?? "").not.toMatch(/background/);
  });

  it("remonte la ligne ouverte, sans la confondre avec la case à cocher", async () => {
    const onOuvrir = vi.fn();
    const onSelection = vi.fn();
    render(
      <DataTable
        colonnes={COLONNES}
        lignes={LIGNES}
        onOuvrir={onOuvrir}
        selection={[]}
        onSelection={onSelection}
        nom={(l) => l.pseudo}
        libelles={{ toutSelectionner: "Tout", selectionner: "Sélectionner {nom}" }}
      />,
    );

    await userEvent.click(screen.getByText("Bob"));
    expect(onOuvrir).toHaveBeenCalledOnce();
    expect(onOuvrir).toHaveBeenCalledWith(LIGNES[2]);

    onOuvrir.mockClear();
    await userEvent.click(screen.getByRole("checkbox", { name: "Sélectionner Bob" }));
    expect(onOuvrir).not.toHaveBeenCalled();
    expect(onSelection).toHaveBeenCalledOnce();
  });

  it("emploie le rendu déclaré par la colonne", () => {
    render(
      <DataTable
        colonnes={[{ cle: "credits", titre: "Crédits", rendu: (l) => <b>{l.credits} ✦</b> }]}
        lignes={LIGNES}
      />,
    );
    expect(screen.getByText("12 ✦")).toBeInTheDocument();
  });

  it("rend l'état vide à la place du tableau quand il n'y a rien", () => {
    render(
      <DataTable
        colonnes={COLONNES}
        lignes={[]}
        vide={<EmptyState titre="Aucun compte ne correspond" />}
      />,
    );
    expect(screen.getByText("Aucun compte ne correspond")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("ouvre le menu d'actions d'une ligne et remonte le choix", async () => {
    const onAction = vi.fn();
    render(
      <DataTable
        colonnes={COLONNES}
        lignes={LIGNES}
        actions={() => [{ id: "suspendre", label: "Suspendre", danger: true }]}
        onAction={onAction}
        libelles={{ actions: "Actions" }}
      />,
    );

    expect(screen.queryByRole("menu")).toBeNull();
    await userEvent.click(screen.getAllByRole("button", { name: "Actions" })[1]!);
    await userEvent.click(within(screen.getByRole("menu")).getByText("Suspendre"));

    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledWith("suspendre", LIGNES[1]);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("ferme le menu d'actions par Échap", async () => {
    render(
      <DataTable
        colonnes={COLONNES}
        lignes={LIGNES}
        actions={() => [{ id: "voir", label: "Voir" }]}
        onAction={vi.fn()}
        libelles={{ actions: "Actions" }}
      />,
    );
    await userEvent.click(screen.getAllByRole("button", { name: "Actions" })[0]!);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("Pagination", () => {
  const libelles = { precedent: "Précédent", suivant: "Suivant" };

  it("rend deux commandes, sans total ni numéro de page", () => {
    const { container } = render(
      <Pagination
        aPrecedent
        curseurSuivant="eyJ2IjoyfQ"
        onPrecedent={vi.fn()}
        onSuivant={vi.fn()}
        libelles={libelles}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
    // Ni « 1–25 sur 312 », ni « 2 / 13 » : le curseur ne connaît pas le total.
    expect(container.textContent).not.toMatch(/\d+\s*(sur|\/|–|-)\s*\d+/);
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("désactive Suivant quand le curseur suivant est absent", () => {
    render(
      <Pagination aPrecedent onPrecedent={vi.fn()} onSuivant={vi.fn()} libelles={libelles} />,
    );
    expect(screen.getByRole("button", { name: "Suivant" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Précédent" })).toBeEnabled();
  });

  it("désactive Précédent en tête de parcours", () => {
    render(
      <Pagination
        curseurSuivant="abc"
        onPrecedent={vi.fn()}
        onSuivant={vi.fn()}
        libelles={libelles}
      />,
    );
    expect(screen.getByRole("button", { name: "Précédent" })).toBeDisabled();
  });

  it("remonte les deux sens de parcours", async () => {
    const onPrecedent = vi.fn();
    const onSuivant = vi.fn();
    render(
      <Pagination
        aPrecedent
        curseurSuivant="abc"
        onPrecedent={onPrecedent}
        onSuivant={onSuivant}
        libelles={libelles}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Suivant" }));
    await userEvent.click(screen.getByRole("button", { name: "Précédent" }));
    expect(onSuivant).toHaveBeenCalledOnce();
    expect(onPrecedent).toHaveBeenCalledOnce();
  });

  it("n'affiche le sélecteur de taille que si on le demande", async () => {
    const onParPage = vi.fn();
    const { rerender } = render(
      <Pagination onPrecedent={vi.fn()} onSuivant={vi.fn()} libelles={libelles} />,
    );
    expect(screen.queryByRole("combobox")).toBeNull();

    rerender(
      <Pagination
        onPrecedent={vi.fn()}
        onSuivant={vi.fn()}
        parPage={25}
        onParPage={onParPage}
        libelles={{ ...libelles, parPage: "Par page" }}
      />,
    );
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Par page" }), "50");
    expect(onParPage).toHaveBeenCalledOnce();
    expect(onParPage).toHaveBeenCalledWith(50);
  });
});

describe("FilterBar", () => {
  it("remonte la frappe et porte le placeholder reçu", async () => {
    const onRecherche = vi.fn();
    render(<FilterBar recherche="" onRecherche={onRecherche} placeholder="Rechercher un compte" />);
    await userEvent.type(screen.getByPlaceholderText("Rechercher un compte"), "a");
    expect(onRecherche).toHaveBeenCalledOnce();
  });

  it("rend les sélecteurs déclarés et remonte leur changement", async () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        recherche=""
        onRecherche={vi.fn()}
        filtres={[
          {
            cle: "etat",
            label: "État",
            valeur: "tous",
            options: [
              { value: "tous", label: "Tous" },
              { value: "actif", label: "Actifs" },
            ],
            onChange,
          },
        ]}
      />,
    );
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "État" }), "actif");
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("n'affiche la remise à zéro que si on la fournit", () => {
    const { rerender } = render(<FilterBar recherche="" onRecherche={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(
      <FilterBar
        recherche=""
        onRecherche={vi.fn()}
        onReinitialiser={vi.fn()}
        reinitialiser="Tout effacer"
      />,
    );
    expect(screen.getByRole("button", { name: "Tout effacer" })).toBeInTheDocument();
  });

  it("affiche le compte de résultats reçu", () => {
    render(<FilterBar recherche="" onRecherche={vi.fn()} resultats="42 résultats" />);
    expect(screen.getByText("42 résultats")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("annonce le titre, et le texte et l'action quand ils existent", () => {
    const { rerender } = render(<EmptyState titre="Aucun signalement en attente" />);
    expect(screen.getByText("Aucun signalement en attente")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();

    rerender(
      <EmptyState
        titre="Aucun signalement en attente"
        texte="Les contenus signalés arrivent ici."
        action={<button type="button">Inviter</button>}
      />,
    );
    expect(screen.getByText("Les contenus signalés arrivent ici.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inviter" })).toBeInTheDocument();
  });
});

describe("StatusPill", () => {
  it("porte son ton en attribut, jamais en couleur écrite en ligne", () => {
    const { container } = render(<StatusPill ton="attente">Paiement en attente</StatusPill>);
    const pastille = container.querySelector("[data-ton]")!;
    expect(pastille).toHaveAttribute("data-ton", "attente");
    expect(pastille.textContent).toContain("Paiement en attente");
    expect(pastille.getAttribute("style")).toBeNull();
  });

  it("retombe sur le ton neutre par défaut", () => {
    const { container } = render(<StatusPill>Brouillon</StatusPill>);
    expect(container.querySelector("[data-ton]")).toHaveAttribute("data-ton", "neutre");
  });
});

// --------------------------------------------------------------------------
// Adhérence : ce que le lint ne couvre pas encore pour apps/admin (ses règles
// de jetons ne visent que apps/web) est vérifié ici, sur le texte des fichiers.
// --------------------------------------------------------------------------

const FICHIERS = ["DataTable", "Pagination", "FilterBar", "EmptyState", "StatusPill", "index"].map(
  (nom) => [nom, readFileSync(`src/composants/donnees/${nom}.tsx`, "utf-8")] as const,
);
const CSS = readFileSync("src/styles/donnees.css", "utf-8");

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("adhérence des composants de données", () => {
  it.each(FICHIERS)("%s n'écrit aucune couleur en dur", (_nom, source) => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
  });

  it.each(FICHIERS)("%s ne porte aucune chaîne destinée à l'écran", (_nom, source) => {
    // Un libellé français finit toujours par trahir un accent. Les commentaires,
    // eux, ont le droit d'en porter : ils ne sont pas rendus.
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

  it("teinte la ligne cochée par color-mix, faute de jeton --surface-selected", () => {
    expect(CSS).not.toMatch(/--surface-selected/);
    expect(CSS).toMatch(
      /\.admin-ligne\[data-cochee="true"\]\s*\{\s*background:\s*color-mix\(in oklab, var\(--action\) 7%, var\(--surface-card\)\);\s*\}/,
    );
    expect(CSS).toMatch(
      /\.lehno-nuit \.admin-ligne\[data-cochee="true"\]\s*\{\s*background:\s*color-mix\(in oklab, var\(--action\) 18%, var\(--surface-card\)\);\s*\}/,
    );
  });

  it("fait défiler le tableau plutôt que de l'écraser sous 900 px", () => {
    expect(CSS).toMatch(/overflow-x:\s*auto/);
    expect(CSS).toMatch(/min-width:\s*900px/);
  });
});
