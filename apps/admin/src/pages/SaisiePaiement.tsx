import { useState, type ReactNode } from "react";
import { FormRow } from "../composants/page/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { Button } from "../composants/base/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { CompteLigne, Palier, Canal, CompteCollecte } from "@lehno/contracts";

/**
 * Saisir un versement déjà reçu.
 *
 * **Aucun champ de montant.** Le montant et les crédits viennent du palier —
 * « on achète un palier, jamais un montant libre » — et le contrat n'a même pas
 * de champ pour les recevoir. Offrir une case ici laisserait croire qu'on peut
 * créditer ce qu'on veut, puis se ferait refuser au dernier moment.
 *
 * **On ne propose que ce qui est en service.** Un palier retiré ne se vend
 * plus, un compte fermé ne reçoit plus, un canal désactivé n'a plus de barème.
 * Les proposer ferait échouer la saisie sur un refus qu'on ne saurait pas
 * expliquer à qui vient de remplir quatre champs.
 */
export interface SaisiePaiementProps {
  langue?: Langue;
  comptes: CompteLigne[];
  paliers: Palier[];
  canaux: Canal[];
  comptesCollecte: CompteCollecte[];
  onEnregistrer: (saisie: {
    utilisateurId: string; palierId: string; canalId: string;
    compteCollecteId: string; reason: string;
  }) => void;
  onAnnuler: () => void;
}

/**
 * Ce que le client verse, et ce qu'on doit voir arriver.
 *
 * Le même calcul que le serveur, à l'aperçu : l'administrateur doit savoir
 * combien il devrait voir sur le compte **avant** de constater un écart. Le
 * serveur refait le calcul et fige le sien — celui-ci n'engage rien, il montre.
 */
function apercu(palier: Palier | undefined, canal: Canal | undefined) {
  if (!palier || !canal) return null;
  const brut = (palier.montant * canal.fraisPourcent) / 100 + canal.fraisFixe;
  const borne = Math.min(canal.fraisMax ?? Number.POSITIVE_INFINITY, Math.max(canal.fraisMin ?? 0, brut));
  const frais = Math.ceil(borne);
  return canal.fraisPortesPar === "payer"
    ? { aVerser: palier.montant + frais, attendu: palier.montant, devise: palier.devise }
    : { aVerser: palier.montant, attendu: Math.max(0, palier.montant - frais), devise: palier.devise };
}

export function SaisiePaiement({
  langue = "fr", comptes, paliers, canaux, comptesCollecte, onEnregistrer, onAnnuler,
}: SaisiePaiementProps): ReactNode {
  const t = messages(langue);
  const [utilisateurId, setUtilisateurId] = useState("");
  const [palierId, setPalierId] = useState("");
  const [canalId, setCanalId] = useState("");
  const [compteCollecteId, setCompteCollecteId] = useState("");
  const [demandeMotif, setDemandeMotif] = useState(false);

  const nombre = new Intl.NumberFormat(langue === "en" ? "en-GB" : "fr-FR");

  // Seulement ce qui est en service — voir l'en-tête du fichier.
  const paliersOfferts = paliers.filter((p) => p.actif);
  const canauxOfferts = canaux.filter((c) => c.actif);
  const comptesOfferts = comptesCollecte.filter((c) => c.actif);

  const palier = paliersOfferts.find((p) => p.id === palierId);
  const canal = canauxOfferts.find((c) => c.id === canalId);
  const calcul = apercu(palier, canal);

  const complet = utilisateurId !== "" && palierId !== "" && canalId !== "" && compteCollecteId !== "";

  const choix = (
    id: string, label: string, valeur: string, onChoix: (v: string) => void,
    options: { value: string; label: string }[],
  ): ReactNode => (
    <FormRow champId={id} label={label}>
      <select
        id={id}
        className="admin-champ admin-focus gabarit-saisie"
        value={valeur}
        onChange={(e) => onChoix(e.target.value)}
      >
        <option value="">{t.credits.saisie.choisir}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </FormRow>
  );

  return (
    <div className="gabarit-form">
      <h2 className="gabarit-groupe-titre">{t.credits.saisie.titre}</h2>
      <p className="gabarit-note">{t.credits.saisie.sous}</p>

      {choix("saisie-compte", t.credits.saisie.champs.compteClient, utilisateurId, setUtilisateurId,
        comptes.map((c) => ({ value: c.id, label: `${c.pseudo} — ${c.email}` })))}

      {choix("saisie-palier", t.credits.saisie.champs.palier, palierId, setPalierId,
        paliersOfferts.map((p) => ({
          value: p.id,
          label: `${nombre.format(p.montant)} ${p.devise} — ${nombre.format(p.credits)} crédits`,
        })))}

      {choix("saisie-canal", t.credits.saisie.champs.canal, canalId, setCanalId,
        canauxOfferts.map((c) => ({ value: c.id, label: `${c.libelle} (${c.pays})` })))}

      {choix("saisie-collecte", t.credits.saisie.champs.compte, compteCollecteId, setCompteCollecteId,
        comptesOfferts.map((c) => ({ value: c.id, label: `${c.libelle} — ${c.numero}` })))}

      {/* L'aperçu paraît dès que le palier et le canal sont choisis : savoir
          combien on doit voir arriver est ce qui permet, plus tard, de
          constater un écart plutôt que de le deviner. */}
      {calcul ? (
        <section className="gabarit-groupe">
          <h3 className="gabarit-groupe-titre">{t.credits.saisie.apercu.titre}</h3>
          <div className="gabarit-champ">
            <span className="gabarit-cle">{t.credits.saisie.apercu.aVerser}</span>
            <span className="gabarit-valeur">{nombre.format(calcul.aVerser)} {calcul.devise}</span>
          </div>
          <div className="gabarit-champ">
            <span className="gabarit-cle">{t.credits.saisie.apercu.attendu}</span>
            <span className="gabarit-valeur">{nombre.format(calcul.attendu)} {calcul.devise}</span>
          </div>
          <div className="gabarit-champ">
            <span className="gabarit-cle">{t.credits.saisie.apercu.credits}</span>
            <span className="gabarit-valeur">{nombre.format(palier?.credits ?? 0)}</span>
          </div>
        </section>
      ) : null}

      <div className="gabarit-form-pied">
        <Button disabled={!complet} onClick={() => setDemandeMotif(true)}>
          {t.credits.saisie.enregistrer}
        </Button>
        <Button variant="text" onClick={onAnnuler}>{t.credits.saisie.annuler}</Button>
      </div>

      {demandeMotif ? (
        <ConfirmWithReason
          titre={t.credits.saisie.dialogue.titre}
          consequence={t.credits.saisie.dialogue.consequence}
          motifs={[...t.credits.saisie.motifs]}
          libelles={{
            motif: t.confirmation.motif,
            choisir: t.confirmation.motifManquant,
            autre: t.confirmation.autre,
            precision: t.confirmation.autrePlaceholder,
            journal: t.confirmation.motifAide,
            annuler: t.confirmation.annuler,
            confirmer: t.confirmation.confirmer,
          }}
          onAnnuler={() => setDemandeMotif(false)}
          onConfirmer={(motif) => {
            setDemandeMotif(false);
            onEnregistrer({ utilisateurId, palierId, canalId, compteCollecteId, reason: motif });
          }}
        />
      ) : null}
    </div>
  );
}
