import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CompteDetail } from "@lehno/contracts";
import { Liste } from "../src/pages/Liste.js";
import { Detail } from "../src/pages/Detail.js";
import { Edition } from "../src/pages/Edition.js";
import { Suppressions } from "../src/pages/Suppressions.js";
import { fr } from "../src/i18n/index.js";
import { compteDetail, interventions, parametres, suppressions } from "../src/fixtures/index.js";

// Ce que Suppressions met en tête d'elle-même : l'échéance la plus proche —
// c'est l'ordre dans lequel on traite, et la page l'établit seule.
const parEcheance = [...suppressions.items].sort((a, b) => a.echeance.localeCompare(b.echeance));

// Ce que la page rend dans la première colonne de son tableau, dans l'ordre du
// DOM : c'est cet ordre qui prouve que la page ordonne, et pas le tableau.
function premiereColonne(): string[] {
  const corps = screen.getAllByRole("rowgroup")[1]!;
  return within(corps)
    .getAllByRole("row")
    .map((tr) => tr.querySelectorAll("td")[0]!.textContent!.trim());
}

async function ouvrirLeMenu(rang: number): Promise<void> {
  const boutons = screen.getAllByRole("button", { name: fr.table.actions });
  await userEvent.click(boutons[rang]!);
}

describe("Liste — le gabarit des quinze sections", () => {
  // « La page trie et découpe, le tableau non » : DataTable remonte onTri, et
  // c'est la page qui rend les lignes dans le nouvel ordre.
  it("trie elle-même quand le tableau remonte un tri", async () => {
    render(<Liste role="admin" />);

    await userEvent.click(screen.getByRole("button", { name: fr.comptes.col.pseudo }));
    expect(premiereColonne()).toEqual(["awa", "celarine", "mathias", "nour", "valery"]);

    await userEvent.click(screen.getByRole("button", { name: fr.comptes.col.pseudo }));
    expect(premiereColonne()).toEqual(["valery", "nour", "mathias", "celarine", "awa"]);
  });

  it("trie les nombres en nombres, pas en mots", async () => {
    render(<Liste role="admin" />);

    await userEvent.click(screen.getByRole("button", { name: fr.comptes.col.credits }));
    expect(premiereColonne()).toEqual(["valery", "nour", "mathias", "awa", "celarine"]);
  });

  it("filtre sur la recherche, et la remise à zéro rend la liste entière", async () => {
    render(<Liste role="admin" />);

    await userEvent.type(screen.getByRole("searchbox"), "awa");
    expect(premiereColonne()).toEqual(["awa"]);

    await userEvent.click(screen.getByRole("button", { name: fr.table.reinitialiser }));
    expect(premiereColonne()).toHaveLength(5);
  });

  it("dit ce qui est possible quand rien ne répond aux filtres", async () => {
    render(<Liste role="admin" />);

    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText(fr.comptes.vide.titre)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("découpe elle-même : la taille de page gouverne le nombre de lignes", async () => {
    render(<Liste role="admin" parPage={2} />);

    expect(premiereColonne()).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: fr.table.suivant }));
    expect(premiereColonne()).toHaveLength(2);
    expect(premiereColonne()).not.toContain("celarine");
  });

  it("ouvre un compte au clic sur la ligne", async () => {
    const onOuvrir = vi.fn();
    render(<Liste role="support" onOuvrir={onOuvrir} />);

    const corps = screen.getAllByRole("rowgroup")[1]!;
    await userEvent.click(within(corps).getAllByRole("row")[0]!);
    expect(onOuvrir).toHaveBeenCalledTimes(1);
  });

  it("réserve l'export et l'ajustement de solde à l'administrateur", async () => {
    const { unmount } = render(<Liste role="support" />);
    expect(screen.queryByRole("button", { name: new RegExp(fr.exporter.bouton) })).not.toBeInTheDocument();

    await ouvrirLeMenu(0);
    expect(screen.getByRole("menuitem", { name: fr.comptes.actions.ouvrir })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: fr.comptes.actions.ajuster })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: fr.comptes.actions.suspendre })).not.toBeInTheDocument();
    unmount();

    render(<Liste role="admin" />);
    expect(screen.getByRole("button", { name: new RegExp(fr.exporter.bouton) })).toBeInTheDocument();
    await ouvrirLeMenu(0);
    expect(screen.getByRole("menuitem", { name: fr.comptes.actions.ajuster })).toBeInTheDocument();
  });

  it("n'applique une suspension qu'avec un motif", async () => {
    const onSuspendre = vi.fn();
    render(<Liste role="admin" onSuspendre={onSuspendre} />);

    await ouvrirLeMenu(0);
    await userEvent.click(screen.getByRole("menuitem", { name: fr.comptes.actions.suspendre }));

    const confirmer = screen.getByRole("button", { name: fr.confirmation.confirmer });
    expect(confirmer).toBeDisabled();
    expect(onSuspendre).not.toHaveBeenCalled();

    const motif = fr.comptes.suspendre.motifs[0]!;
    await userEvent.selectOptions(screen.getByLabelText(fr.confirmation.motif), motif);
    await userEvent.click(screen.getByRole("button", { name: fr.confirmation.confirmer }));

    expect(onSuspendre).toHaveBeenCalledTimes(1);
    expect(onSuspendre.mock.calls[0]![1]).toBe(motif);
  });
});

describe("Detail — un compte, ses faces, sa traçabilité", () => {
  it("rend l'historique des interventions en pied de page", () => {
    render(<Detail role="admin" />);

    // L'historique est la seule liste ordonnée de la page : ce qu'il porte se
    // lit là, avec son motif — un journal sans raison ne prouve rien.
    const journal = within(screen.getByRole("list"));
    for (const entree of interventions.items) {
      expect(journal.getByText(entree.action)).toBeInTheDocument();
      expect(journal.getByText(entree.motif)).toBeInTheDocument();
    }
    expect(journal.getAllByText(interventions.items[0]!.auteur).length).toBeGreaterThan(0);
  });

  // Spec §6 : le journal d'audit est réservé à l'administrateur. Le prototype
  // l'ouvrait au support ; c'est la spec qui tranche.
  it("garde le journal d'audit hors de portée du support", () => {
    render(<Detail role="support" />);

    expect(screen.queryByText(interventions.items[0]!.action)).not.toBeInTheDocument();
    expect(screen.queryByText(fr.audit.titre)).not.toBeInTheDocument();
  });

  // Le cloisonnement tient en administration : on compte, on n'ouvre pas.
  it("n'expose aucun contenu de fiche, de note ni de souhait", async () => {
    const SECRET = "Il aime les mangues et déteste les surprises";
    const fuite = {
      ...compteDetail,
      fiches: [{ titre: SECRET, texte: SECRET }],
      notes: [{ texte: SECRET }],
      souhaits: [SECRET],
    } as unknown as CompteDetail;

    render(<Detail role="admin" compte={fuite} />);

    for (const onglet of Object.values(fr.compte.onglets)) {
      await userEvent.click(screen.getByRole("tab", { name: new RegExp(onglet) }));
      expect(document.body.textContent).not.toContain(SECRET);
    }
  });

  it("n'en donne que les volumétries", () => {
    render(<Detail role="admin" />);

    expect(screen.getByText(fr.compte.champs.notes)).toBeInTheDocument();
    expect(screen.getByText(String(compteDetail.volumetrie.notes))).toBeInTheDocument();
    expect(screen.getByText(fr.compte.cloisonnement)).toBeInTheDocument();
  });

  it("porte les quatre faces d'un compte", () => {
    render(<Detail role="admin" />);

    for (const onglet of Object.values(fr.compte.onglets))
      expect(screen.getByRole("tab", { name: new RegExp(onglet) })).toBeInTheDocument();
  });

  it("retire du DOM les actions que le rôle ne permet pas — il ne les grise pas", () => {
    const { unmount } = render(<Detail role="support" />);
    expect(screen.queryByRole("button", { name: fr.comptes.actions.ajuster })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fr.comptes.actions.suspendre })).not.toBeInTheDocument();
    unmount();

    render(<Detail role="admin" />);
    expect(screen.getByRole("button", { name: fr.comptes.actions.ajuster })).toBeEnabled();
    expect(screen.getByRole("button", { name: fr.comptes.actions.suspendre })).toBeEnabled();
  });

  it("n'ajuste un solde qu'avec un motif", async () => {
    const onAjuster = vi.fn();
    render(<Detail role="admin" onAjuster={onAjuster} />);

    await userEvent.click(screen.getByRole("button", { name: fr.comptes.actions.ajuster }));
    expect(screen.getByRole("button", { name: fr.confirmation.confirmer })).toBeDisabled();

    const motif = fr.comptes.ajuster.motifs[0]!;
    await userEvent.selectOptions(screen.getByLabelText(fr.confirmation.motif), motif);
    await userEvent.click(screen.getByRole("button", { name: fr.confirmation.confirmer }));
    expect(onAjuster).toHaveBeenCalledWith(motif);
  });
});

describe("Edition — les configurations", () => {
  it("rappelle la valeur précédente de chaque réglage", () => {
    render(<Edition role="admin" />);

    // Le rappel se lit dans le rang du réglage qu'il concerne, pas ailleurs :
    // deux réglages peuvent quitter la même valeur sans dire la même chose.
    const offerts = parametres.economie[1]!;
    const rang = screen.getByLabelText(offerts.libelle).closest(".admin-rang");
    expect(within(rang as HTMLElement).getByText(
      fr.parametres.precedente.replace("{valeur}", `${offerts.valeurPrecedente} ${offerts.unite}`),
    )).toBeInTheDocument();
  });

  it("n'enregistre que sur le geste explicite", async () => {
    const onEnregistrer = vi.fn();
    render(<Edition role="admin" onEnregistrer={onEnregistrer} />);

    const champ = screen.getByLabelText(parametres.economie[1]!.libelle);
    await userEvent.clear(champ);
    await userEvent.type(champ, "7");
    expect(onEnregistrer).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: fr.parametres.enregistrer }));
    expect(onEnregistrer).toHaveBeenCalledTimes(1);
    expect(onEnregistrer.mock.calls[0]![0].economie[1].valeur).toBe(7);
    expect(onEnregistrer.mock.calls[0]![0].economie[1].valeurPrecedente).toBe(parametres.economie[1]!.valeur);
  });

  it("refuse d'enregistrer un réglage qui n'est pas un entier positif", async () => {
    const onEnregistrer = vi.fn();
    render(<Edition role="admin" onEnregistrer={onEnregistrer} />);

    const champ = screen.getByLabelText(parametres.economie[0]!.libelle);
    await userEvent.clear(champ);
    await userEvent.type(champ, "0");

    expect(screen.getByText(fr.parametres.erreurEntier)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: fr.parametres.enregistrer }));
    expect(onEnregistrer).not.toHaveBeenCalled();
  });

  it("porte les types d'occasions sur leur propre face", async () => {
    render(<Edition role="admin" />);

    await userEvent.click(screen.getByRole("tab", { name: new RegExp(fr.parametres.onglets.occasions) }));
    expect(screen.getByText(parametres.typesEvenement[0]!.libelle)).toBeInTheDocument();
    expect(screen.getByText(fr.parametres.occasions.noteSensible)).toBeInTheDocument();
  });

  it("réserve l'enregistrement à l'administrateur", () => {
    render(<Edition role="support" />);
    expect(screen.queryByRole("button", { name: fr.parametres.enregistrer })).not.toBeInTheDocument();
  });
});

describe("Suppressions — les deux gestes du délai de grâce", () => {
  it("n'efface sans attendre qu'avec un motif", async () => {
    const onEffacer = vi.fn();
    render(<Suppressions role="admin" onEffacer={onEffacer} />);

    await ouvrirLeMenu(0);
    await userEvent.click(screen.getByRole("menuitem", { name: fr.suppressions.effacer }));

    expect(screen.getByText(fr.suppressions.dialogueEffacer.consequence)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fr.confirmation.confirmer })).toBeDisabled();
    expect(onEffacer).not.toHaveBeenCalled();

    const motif = fr.suppressions.dialogueEffacer.motifs[0]!;
    await userEvent.selectOptions(screen.getByLabelText(fr.confirmation.motif), motif);
    await userEvent.click(screen.getByRole("button", { name: fr.confirmation.confirmer }));

    expect(onEffacer).toHaveBeenCalledTimes(1);
    expect(onEffacer.mock.calls[0]![0].id).toBe(parEcheance[0]!.id);
    expect(onEffacer.mock.calls[0]![1]).toBe(motif);
  });

  it("ne restaure qu'avec un motif", async () => {
    const onRestaurer = vi.fn();
    render(<Suppressions role="support" onRestaurer={onRestaurer} />);

    await ouvrirLeMenu(0);
    await userEvent.click(screen.getByRole("menuitem", { name: fr.suppressions.restaurer }));

    expect(screen.getByRole("button", { name: fr.confirmation.confirmer })).toBeDisabled();
    expect(onRestaurer).not.toHaveBeenCalled();

    const motif = fr.suppressions.dialogueRestaurer.motifs[0]!;
    await userEvent.selectOptions(screen.getByLabelText(fr.confirmation.motif), motif);
    await userEvent.click(screen.getByRole("button", { name: fr.confirmation.confirmer }));

    expect(onRestaurer).toHaveBeenCalledTimes(1);
    expect(onRestaurer.mock.calls[0]![1]).toBe(motif);
  });

  it("un motif trop court ne suffit pas — le contrat serveur fait le plancher", async () => {
    render(<Suppressions role="admin" />);

    await ouvrirLeMenu(0);
    await userEvent.click(screen.getByRole("menuitem", { name: fr.suppressions.restaurer }));
    await userEvent.selectOptions(screen.getByLabelText(fr.confirmation.motif), fr.confirmation.autre);
    await userEvent.type(screen.getByLabelText(fr.confirmation.autrePlaceholder), "non");

    expect(screen.getByRole("button", { name: fr.confirmation.confirmer })).toBeDisabled();
  });

  it("retire l'effacement sans attente au support", async () => {
    render(<Suppressions role="support" />);

    await ouvrirLeMenu(0);
    expect(screen.getByRole("menuitem", { name: fr.suppressions.restaurer })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: fr.suppressions.effacer })).not.toBeInTheDocument();
  });

  it("filtre sur l'état et dit ce qui est possible quand rien n'attend", async () => {
    render(<Suppressions role="admin" />);
    expect(premiereColonne()).toHaveLength(suppressions.items.length);

    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText(fr.suppressions.vide.titre)).toBeInTheDocument();
  });
});
