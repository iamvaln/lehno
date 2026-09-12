import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { DataTable, EmptyState, StatusPill, type Colonne } from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { Button } from "../composants/base/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { AdminRole, ClientApi, TypeClient, EnvClient } from "@lehno/contracts";

/**
 * Les clients de l'API — qui a le droit d'appeler, et sous quel nom.
 *
 * **LA CLÉ NE PARAÎT QU'UNE FOIS, ET L'ÉCRAN LE DIT.** Elle est rendue en clair
 * à la création et à la rotation, puis jamais plus : la base n'en garde que le
 * haché. L'afficher comme une donnée ordinaire ferait perdre des clés — on la
 * montre donc dans un panneau qui annonce, avant le secret, qu'il ne
 * reviendra pas.
 *
 * **CE N'EST PAS UNE FRONTIÈRE DE SÉCURITÉ**, et le contrat le dit plus
 * longuement : une application distribuée porte sa clé dans son paquet, donc
 * quiconque la démonte l'obtient. Ce qu'on achète est la RÉVOCATION — couper un
 * client coupe une application entière, sans toucher aux autres.
 *
 * **ON COUPE, ON NE SUPPRIME PAS.** Il n'y a pas de route de suppression : les
 * lignes déjà notées gardent leur référence, et l'historique reste lisible.
 */
export interface ClientsApiProps {
  role: AdminRole;
  langue?: Langue;
  clients: ClientApi[];
  /** La clé en clair, le temps qu'on la copie. Nulle le reste du temps. */
  cleVisible?: string | null;
  onFermerLaCle?: () => void;
  onOuvrir?: (entree: { label: string; clientType: TypeClient; environment: EnvClient }, motif: string) => void;
  onTourner?: (client: ClientApi, motif: string) => void;
  onBasculer?: (client: ClientApi, motif: string) => void;
  onRetour?: (id: string) => void;
  /* LES MOTIFS DU REGISTRE, avec leur CODE : le serveur l'exige sur ces gestes,
     et n'envoyer que la phrase ferait refuser l'écriture après coup. Ceux du
     dictionnaire, écrits ici, servent de repli quand le registre n'a rien pour
     ce geste. */
  motifsDuGeste?: (geste: string) => readonly { code: string; libelle: string }[];
}

type Geste =
  | { quoi: "ouvrir" }
  | { quoi: "tourner"; client: ClientApi }
  | { quoi: "basculer"; client: ClientApi };

export function ClientsApi({
  role, langue = "fr", clients, cleVisible = null, onFermerLaCle,
  onOuvrir, onTourner, onBasculer, onRetour, motifsDuGeste = () => [],
}: ClientsApiProps): ReactNode {
  const t = messages(langue);
  const c = t.clientsApi;

  const [geste, setGeste] = useState<Geste | null>(null);
  const [label, setLabel] = useState("");
  const [typeClient, setTypeClient] = useState<TypeClient>("mobile_ios");
  const [env, setEnv] = useState<EnvClient>("prod");

  const date = (iso: string): string =>
    new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
      day: "numeric", month: "short", year: "numeric",
    }).format(new Date(iso));

  const colonnes: Colonne<ClientApi>[] = [
    { cle: "label", titre: c.col.libelle },
    /* L'IDENTIFIANT SE LIT, la clé jamais. C'est lui qu'on retrouve dans une
       ligne de journal, donc lui qu'on vient chercher ici. */
    { cle: "clientId", titre: c.col.identifiant, discret: true },
    { cle: "clientType", titre: c.col.type, rendu: (l) => c.types[l.clientType] },
    { cle: "environment", titre: c.col.env, rendu: (l) => c.envs[l.environment] },
    {
      cle: "isActive",
      titre: c.col.etat,
      rendu: (l) => (
        <StatusPill ton={l.isActive ? "actif" : "arrete"}>
          {l.isActive ? c.etats.ouvert : c.etats.coupe}
        </StatusPill>
      ),
    },
    /* JAMAIS TOURNÉE se dit, et ne se tait pas : une clé qui n'a jamais bougé
       depuis l'ouverture est une information, pas une case vide. */
    {
      cle: "rotatedAt",
      titre: c.col.tournee,
      discret: true,
      rendu: (l) => (l.rotatedAt === null ? c.jamaisTournee : date(l.rotatedAt)),
    },
  ];

  const dialogue = geste === null
    ? null
    : geste.quoi === "ouvrir"
      ? c.dialogueOuvrir
      : geste.quoi === "tourner"
        ? c.dialogueTourner
        : geste.client.isActive ? c.dialogueCouper : c.dialogueRouvrir;

  const confirmer = (motif: string): void => {
    if (geste === null) return;
    if (geste.quoi === "ouvrir") onOuvrir?.({ label: label.trim(), clientType: typeClient, environment: env }, motif);
    else if (geste.quoi === "tourner") onTourner?.(geste.client, motif);
    else onBasculer?.(geste.client, motif);
    setGeste(null);
    setLabel("");
  };

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: c.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader titre={c.titre} sous={c.sous} />
      {/* Ce que la clé achète, et ce qu'elle n'achète pas — dit une fois, en
          tête : quelqu'un s'y fierait un jour comme à une frontière de
          sécurité si ce n'était écrit nulle part. */}
      <p className="admin-section-sous">{c.portee}</p>

      {role === "admin" ? (
        <div className="admin-actions">
          <Button onClick={() => setGeste({ quoi: "ouvrir" })}>{c.ouvrir}</Button>
        </div>
      ) : null}

      <DataTable
        colonnes={colonnes}
        lignes={clients}
        libelles={{ actions: t.table.actions }}
        vide={<EmptyState titre={c.vide.titre} texte={c.vide.texte} />}
        {...(role === "admin"
          ? {
            actions: (l: ClientApi) => [
              { id: "tourner", label: c.tourner },
              {
                id: "basculer",
                label: l.isActive ? c.couper : c.rouvrir,
                danger: l.isActive,
              },
            ],
            onAction: (id: string, l: ClientApi) => {
              setGeste(id === "tourner" ? { quoi: "tourner", client: l } : { quoi: "basculer", client: l });
            },
          }
          : {})}
      />

      {geste !== null && dialogue !== null ? (
        <ConfirmWithReason
          destructif={geste.quoi === "basculer" && geste.client.isActive}
          titre={geste.quoi === "ouvrir"
            ? dialogue.titre
            : dialogue.titre.replace("{client}", geste.client.label)}
          consequence={dialogue.consequence}
          /* LE REGISTRE D'ABORD, le dictionnaire en repli : les codes semés
             (`access_compromised`, `routine_check`, `fixing_an_error`,
             `new_contract`, `load_test`) portent ce que le serveur attend, et
             une phrase sans code ferait refuser l'écriture. */
          motifs={motifsDuGeste(geste.quoi).length > 0
            ? motifsDuGeste(geste.quoi)
            : [...dialogue.motifs]}
          libelles={{
            motif: t.confirmation.motif,
            choisir: t.confirmation.motifManquant,
            autre: t.confirmation.autre,
            precision: t.confirmation.autrePlaceholder,
            journal: t.confirmation.motifAide,
            annuler: t.confirmation.annuler,
            confirmer: t.confirmation.confirmer,
          }}
          onAnnuler={() => { setGeste(null); setLabel(""); }}
          onConfirmer={confirmer}
          incomplet={geste.quoi === "ouvrir" && label.trim().length < 2}
        >
          {geste.quoi !== "ouvrir" ? null : (
            <div className="gabarit-form">
              <div className="admin-rang">
                <label htmlFor="cli-label">{c.champs.libelle}</label>
                <input
                  id="cli-label"
                  className="admin-champ admin-focus"
                  value={label}
                  maxLength={100}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div className="admin-rang">
                <label htmlFor="cli-type">{c.champs.type}</label>
                <select
                  id="cli-type"
                  className="admin-champ admin-focus"
                  value={typeClient}
                  onChange={(e) => setTypeClient(e.target.value as TypeClient)}
                >
                  {(Object.keys(c.types) as TypeClient[]).map((k) => (
                    <option key={k} value={k}>{c.types[k]}</option>
                  ))}
                </select>
              </div>
              <div className="admin-rang">
                <label htmlFor="cli-env">{c.champs.env}</label>
                <select
                  id="cli-env"
                  className="admin-champ admin-focus"
                  value={env}
                  onChange={(e) => setEnv(e.target.value as EnvClient)}
                >
                  {(Object.keys(c.envs) as EnvClient[]).map((k) => (
                    <option key={k} value={k}>{c.envs[k]}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </ConfirmWithReason>
      ) : null}

      {/* LA CLÉ, UNE SEULE FOIS. L'avertissement vient AVANT le secret : lu
          après, il arrive quand la fenêtre est déjà fermée dans la tête de
          celui qui l'a copiée — ou pas copiée. */}
      {cleVisible === null ? null : (
        <div className="admin-dialogue" role="dialog" aria-modal="true" aria-labelledby="cli-cle-titre">
          <div className="admin-dialogue-panneau">
            <h2 id="cli-cle-titre" className="admin-section-titre">{c.cle.titre}</h2>
            <p className="gabarit-note" data-ton="alerte">{c.cle.unique}</p>
            <pre className="admin-sortie-brute">{cleVisible}</pre>
            <p className="admin-section-sous">{c.cle.perdue}</p>
            <div className="admin-dialogue-actions">
              <Button onClick={() => onFermerLaCle?.()}>{c.cle.copiee}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
