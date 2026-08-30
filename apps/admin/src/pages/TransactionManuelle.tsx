import { useState, type ReactNode } from "react";
import { Breadcrumb, FormRow, PageHeader } from "../composants/page/index.js";
import { SelecteurCompte, type CompteChoisi } from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { Button } from "../composants/base/index.js";
import { messages, type Langue } from "../i18n/index.js";

/** Ce que le formulaire compose, et que le contrat reçoit. */
export interface MouvementManuel {
  utilisateurId: string;
  /** Signé : le sens vient de la nature choisie, jamais d'un moins tapé à la main. */
  montant: number;
  nature: "gift" | "reward" | "correction";
  reason: string;
}

/**
 * Écrire un mouvement de crédits sur un compte.
 *
 * **Le sens ne se tape pas non plus.** Le contrat attend un montant signé ;
 * l'écran ne demande jamais de saisir un moins. Chaque option de nature dit ce
 * qu'elle fait — « Reprise de crédits — au débit » —, et la ligne sous le champ
 * le redit une fois l'option retenue, quand elle a défilé. Un signe tapé se
 * perd d'un doigt ; une nature choisie se relit.
 *
 * **Trois natures au contrat, quatre options à l'écran.** « Correction » est la
 * seule qui aille dans les deux sens : un cadeau négatif n'existe pas, et
 * l'offrir laisserait annoncer « Cadeau » à quelqu'un dont on reprend cinq
 * crédits.
 */
export interface TransactionManuelleProps {
  langue?: Langue;
  /** Les comptes que la recherche a rendus. L'appelant interroge, l'écran montre. */
  comptes: CompteChoisi[];
  onChercher: (terme: string) => void;
  onEcrire: (mouvement: MouvementManuel) => void;
  onRetour?: (id?: string) => void;
}

type Option = "gift" | "reward" | "correctionPlus" | "correctionMoins";

/** Ce que chaque option envoie : sa nature au contrat, et son sens. */
const OPTIONS: Record<Option, { nature: MouvementManuel["nature"]; signe: 1 | -1 }> = {
  gift: { nature: "gift", signe: 1 },
  reward: { nature: "reward", signe: 1 },
  correctionPlus: { nature: "correction", signe: 1 },
  correctionMoins: { nature: "correction", signe: -1 },
};

const ENTIER_POSITIF = /^\d+$/;

export function TransactionManuelle({
  langue = "fr", comptes, onChercher, onEcrire, onRetour,
}: TransactionManuelleProps): ReactNode {
  const t = messages(langue);
  const d = t.transactionManuelle;

  const [compte, setCompte] = useState<CompteChoisi | null>(null);
  const [option, setOption] = useState<Option>("gift");
  const [montant, setMontant] = useState("");
  const [confirme, setConfirme] = useState(false);

  const quantite = ENTIER_POSITIF.test(montant.trim()) ? Number(montant) : 0;
  // Le geste reste fermé tant qu'un compte RÉEL n'est pas retenu : ce qui est
  // écrit dans la boîte de recherche ne vaut pas sélection.
  const pret = compte !== null && quantite > 0;
  const signe = OPTIONS[option].signe;

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: d.titre }]}
        libelle={t.fil.libelle}
        onNavigate={(id) => onRetour?.(id)}
      />

      <PageHeader titre={d.titre} sous={d.sous} />

      <FormRow label={d.compte}>
        <SelecteurCompte
          comptes={comptes}
          valeur={compte}
          onChoisir={setCompte}
          onChercher={onChercher}
          libelles={{
            chercher: d.chercher,
            placeholder: d.chercherPlaceholder,
            aucun: d.aucunCompte,
            solde: d.solde,
            changer: d.changer,
          }}
        />
      </FormRow>

      <FormRow label={d.nature}>
        <select
          className="admin-champ admin-focus"
          aria-label={d.nature}
          value={option}
          onChange={(e) => setOption(e.target.value as Option)}
        >
          {(Object.keys(OPTIONS) as Option[]).map((cle) => (
            <option key={cle} value={cle}>{d.natures[cle]}</option>
          ))}
        </select>
      </FormRow>

      <FormRow label={d.montant} aide={d.montantAide}>
        <input
          className="admin-champ admin-focus"
          inputMode="numeric"
          aria-label={d.montant}
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
        />
      </FormRow>

      {/* La phrase ne paraît que lorsqu'elle a quelque chose à dire : « le compte
          recevra 0 crédits » n'informe pas, il meuble. */}
      {quantite > 0 ? (
        <p className="admin-section-sous">
          {(signe === 1 ? d.sensCredit : d.sensDebit).replace("{n}", String(quantite))}
        </p>
      ) : null}

      <div className="admin-gestes">
        <Button variant="primary" disabled={!pret} onClick={() => setConfirme(true)}>
          {d.ecrire}
        </Button>
        <Button variant="text" onClick={() => onRetour?.()}>{d.annuler}</Button>
      </div>

      {confirme && compte ? (
        <ConfirmWithReason
          titre={d.dialogue.titre}
          consequence={d.dialogue.consequence}
          destructif={signe === -1}
          motifs={d.dialogue.motifs}
          libelles={t.confirmation}
          onConfirmer={(motif) => {
            setConfirme(false);
            onEcrire({
              utilisateurId: compte.id,
              montant: signe * quantite,
              nature: OPTIONS[option].nature,
              reason: motif,
            });
          }}
          onAnnuler={() => setConfirme(false)}
        />
      ) : null}
    </>
  );
}
