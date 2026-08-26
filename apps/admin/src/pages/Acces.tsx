import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader, FormRow } from "../composants/page/index.js";
import { DataTable, EmptyState, StatusPill, type Colonne } from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { Button } from "../composants/base/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { CompteAdmin } from "@lehno/contracts";

/**
 * Les comptes d'exploitation — qui entre, et avec quels droits.
 *
 * Trois règles du serveur que l'écran n'a pas le droit de contredire, sous
 * peine de proposer un geste qui sera refusé :
 *
 * **On n'agit pas sur soi-même.** Ni son rôle, ni son accès. Un outil qui
 * laisse fermer la dernière porte derrière soi est un outil cassé — plus
 * personne ne peut rétablir qui que ce soit.
 *
 * **Un accès se retire, il ne s'efface pas.** Le journal d'audit garde un
 * acteur sans clé étrangère, précisément pour que la trace survive au compte ;
 * mais elle doit encore désigner quelqu'un qu'on puisse nommer. Un compte
 * révoqué reste donc dans la liste, marqué.
 *
 * **La révocation ferme les sessions ouvertes.** C'est ce qui distingue
 * « retirer l'accès » de « le retirer plus tard », et le dialogue le dit.
 */
export interface AccesProps {
  langue?: Langue;
  /** L'identifiant de celui qui regarde : c'est lui qu'on ne peut pas toucher. */
  moiId: string;
  comptes: CompteAdmin[];
  onInviter: (invitation: { email: string; role: "admin" | "support"; reason: string }) => void;
  onChangerRole: (id: string, role: "admin" | "support", reason: string) => void;
  onRevoquer: (id: string, reason: string) => void;
  onRetour?: (id: string) => void;
}

type LigneAcces = CompteAdmin;
type Geste = { compte: CompteAdmin; quoi: "role" | "revocation" };

export function Acces({
  langue = "fr", moiId, comptes, onInviter, onChangerRole, onRevoquer, onRetour,
}: AccesProps): ReactNode {
  const t = messages(langue);
  const [geste, setGeste] = useState<Geste | null>(null);
  const [invitation, setInvitation] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "support">("support");
  const [confirmeInvitation, setConfirmeInvitation] = useState(false);

  const jour = (iso: string) => new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));

  const colonnes: Colonne<LigneAcces>[] = [
    { cle: "email", titre: t.acces.col.email },
    {
      cle: "displayName", titre: t.acces.col.nom, largeur: 180,
      rendu: (a) => (a.id === moiId ? t.acces.soiMeme : a.displayName ?? t.acces.sansNom),
    },
    { cle: "role", titre: t.acces.col.role, largeur: 170, rendu: (a) => t.acces.roles[a.role] },
    {
      cle: "isActive", titre: t.acces.col.etat, largeur: 160,
      rendu: (a) => (
        <StatusPill ton={a.isActive ? "actif" : "arrete"}>
          {a.isActive ? t.acces.etats.actif : t.acces.etats.revoque}
        </StatusPill>
      ),
    },
    { cle: "createdAt", titre: t.acces.col.depuis, discret: true, rendu: (a) => jour(a.createdAt) },
  ];

  const dialogue = geste?.quoi === "revocation" ? t.acces.dialogueRevocation : t.acces.dialogueRole;
  const nomme = (c: CompteAdmin) => c.displayName ?? c.email;

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: t.acces.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader
        titre={t.acces.titre}
        sous={t.acces.sous}
        actions={<Button onClick={() => setInvitation(true)}>{t.acces.inviter.ouvrir}</Button>}
      />

      {invitation ? (
        <div className="gabarit-form">
          <h2 className="gabarit-groupe-titre">{t.acces.inviter.titre}</h2>
          <p className="gabarit-note">{t.acces.inviter.sous}</p>

          <FormRow champId="invite-email" label={t.acces.inviter.email}>
            <input
              id="invite-email"
              className="admin-champ admin-focus gabarit-saisie"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormRow>

          <FormRow champId="invite-role" label={t.acces.inviter.role}>
            <select
              id="invite-role"
              className="admin-champ admin-focus gabarit-saisie"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "support")}
            >
              <option value="support">{t.acces.roles.support}</option>
              <option value="admin">{t.acces.roles.admin}</option>
            </select>
          </FormRow>

          <div className="gabarit-form-pied">
            <Button disabled={email.trim() === ""} onClick={() => setConfirmeInvitation(true)}>
              {t.acces.inviter.confirmer}
            </Button>
            <Button variant="text" onClick={() => setInvitation(false)}>{t.acces.inviter.annuler}</Button>
          </div>
        </div>
      ) : null}

      <DataTable
        colonnes={colonnes}
        lignes={comptes}
        libelles={{ actions: t.table.actions }}
        // Aucun geste sur soi-même, aucun sur un compte déjà retiré : le
        // serveur refuse les deux, et l'écran ne doit pas les proposer.
        actions={(a: LigneAcces) => (a.id === moiId || !a.isActive ? [] : [
          {
            id: "role",
            label: a.role === "support" ? t.acces.gestes.promouvoir : t.acces.gestes.retrograder,
          },
          { id: "revocation", label: t.acces.gestes.revoquer, danger: true },
        ])}
        onAction={(quoi: string, a: LigneAcces) => setGeste({ compte: a, quoi: quoi as Geste["quoi"] })}
        vide={<EmptyState titre={t.acces.vide.titre} texte={t.acces.vide.texte} />}
      />

      {geste ? (
        <ConfirmWithReason
          destructif={geste.quoi === "revocation"}
          titre={dialogue.titre.replace("{compte}", nomme(geste.compte))}
          consequence={dialogue.consequence}
          motifs={[...dialogue.motifs]}
          libelles={{
            motif: t.confirmation.motif,
            choisir: t.confirmation.motifManquant,
            autre: t.confirmation.autre,
            precision: t.confirmation.autrePlaceholder,
            journal: t.confirmation.motifAide,
            annuler: t.confirmation.annuler,
            confirmer: t.confirmation.confirmer,
          }}
          onAnnuler={() => setGeste(null)}
          onConfirmer={(motif) => {
            const { compte, quoi } = geste;
            setGeste(null);
            if (quoi === "revocation") onRevoquer(compte.id, motif);
            else onChangerRole(compte.id, compte.role === "support" ? "admin" : "support", motif);
          }}
        />
      ) : null}

      {confirmeInvitation ? (
        <ConfirmWithReason
          titre={t.acces.inviter.dialogue.titre}
          consequence={t.acces.inviter.dialogue.consequence}
          motifs={[...t.acces.inviter.motifs]}
          libelles={{
            motif: t.confirmation.motif,
            choisir: t.confirmation.motifManquant,
            autre: t.confirmation.autre,
            precision: t.confirmation.autrePlaceholder,
            journal: t.confirmation.motifAide,
            annuler: t.confirmation.annuler,
            confirmer: t.confirmation.confirmer,
          }}
          onAnnuler={() => setConfirmeInvitation(false)}
          onConfirmer={(motif) => {
            setConfirmeInvitation(false);
            setInvitation(false);
            onInviter({ email: email.trim(), role, reason: motif });
            setEmail("");
          }}
        />
      ) : null}
    </>
  );
}
