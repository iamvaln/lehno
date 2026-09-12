import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { DataTable, EmptyState, StatusPill, type Colonne } from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { Button } from "../composants/base/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { AdminRole, ClientApi, TypeClient, EnvClient } from "@lehno/contracts";

/**
 * The API clients — who is allowed to call, and under what name.
 *
 * **THE KEY APPEARS ONCE, AND THE SCREEN SAYS SO.** It comes back in the clear
 * on creation and on rotation, then never again: the database keeps only its
 * hash. Showing it like ordinary data would lose keys — so it appears in a panel
 * that warns, BEFORE the secret, that it will not come back.
 *
 * **IT IS NOT A SECURITY BOUNDARY**, and the contract says so at more length: a
 * distributed app carries its key in its bundle, so whoever takes the bundle
 * apart has it. What the key buys is REVOCATION — cutting one client cuts one
 * whole application, without touching the others.
 *
 * **WE CUT, WE DO NOT DELETE.** There is no delete route: rows already recorded
 * keep their reference, and the history stays readable.
 */
export interface ClientsApiProps {
  role: AdminRole;
  langue?: Langue;
  clients: ClientApi[];
  /** The key in the clear, for as long as it takes to copy it. Null otherwise. */
  visibleKey?: string | null;
  onCloseKey?: () => void;
  onOpen?: (
    entry: { label: string; clientType: TypeClient; environment: EnvClient },
    reason: string, reasonCode?: string,
  ) => void;
  onRotate?: (client: ClientApi, reason: string, reasonCode?: string) => void;
  onToggle?: (client: ClientApi, reason: string, reasonCode?: string) => void;
  onBack?: (id: string) => void;
  /* THE REGISTRY'S REASONS, WITH THEIR CODE: the server demands it on these
     gestures, and sending only the sentence makes the write fail after the fact.
     The dictionary ones, written in the labels, are the fallback for when the
     registry has nothing for that gesture. */
  reasonsFor?: (gesture: string) => readonly { code: string; libelle: string }[];
}

/* THE SERVER'S NAME FOR THE GESTURE, and it cannot be guessed from this
   screen's. The registry files its reasons under `api_client_create`, not under
   "open": asking it with the screen's own name returned an empty list, so a
   reason went out without its code — and the server REFUSES a gesture that
   offers reasons and receives none. The cut failed after confirmation. */
const GESTURES = {
  open: "api_client_create",
  rotate: "api_client_rotate",
  toggle: "api_client_update",
} as const;

type Gesture =
  | { kind: "open" }
  | { kind: "rotate"; client: ClientApi }
  | { kind: "toggle"; client: ClientApi };

export function ClientsApi({
  role, langue = "fr", clients, visibleKey = null, onCloseKey,
  onOpen, onRotate, onToggle, onBack, reasonsFor = () => [],
}: ClientsApiProps): ReactNode {
  const t = messages(langue);
  const c = t.clientsApi;

  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [label, setLabel] = useState("");
  const [clientType, setClientType] = useState<TypeClient>("mobile_ios");
  const [environment, setEnvironment] = useState<EnvClient>("prod");

  const day = (iso: string): string =>
    new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
      day: "numeric", month: "short", year: "numeric",
    }).format(new Date(iso));

  const columns: Colonne<ClientApi>[] = [
    { cle: "label", titre: c.col.libelle },
    /* THE IDENTIFIER IS READABLE, the key never is. It is the identifier that
       turns up in a log line, so it is the identifier people come here for. */
    { cle: "clientId", titre: c.col.identifiant, discret: true },
    { cle: "clientType", titre: c.col.type, rendu: (l) => c.types[l.clientType] },
    { cle: "environment", titre: c.col.env, rendu: (l) => c.envs[l.environment] },
    {
      cle: "state",
      titre: c.col.etat,
      rendu: (l) => (
        <StatusPill ton={l.isActive ? "actif" : "arrete"}>
          {l.isActive ? c.etats.ouvert : c.etats.coupe}
        </StatusPill>
      ),
    },
    /* "NEVER ROTATED" IS SAID OUT LOUD, not left blank: a key that has not moved
       since the client was opened is information, not an empty cell. */
    {
      cle: "rotatedAt",
      titre: c.col.tournee,
      discret: true,
      rendu: (l) => (l.rotatedAt === null ? c.jamaisTournee : day(l.rotatedAt)),
    },
  ];

  const dialog = gesture === null
    ? null
    : gesture.kind === "open"
      ? c.dialogueOuvrir
      : gesture.kind === "rotate"
        ? c.dialogueTourner
        : gesture.client.isActive ? c.dialogueCouper : c.dialogueRouvrir;

  const confirm = (reason: string, code?: string): void => {
    if (gesture === null) return;
    if (gesture.kind === "open")
      onOpen?.({ label: label.trim(), clientType, environment }, reason, code);
    else if (gesture.kind === "rotate") onRotate?.(gesture.client, reason, code);
    else onToggle?.(gesture.client, reason, code);
    setGesture(null);
    setLabel("");
  };

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: c.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onBack?.("tableau")}
      />
      <PageHeader titre={c.titre} sous={c.sous} />
      {/* What the key buys, and what it does not — said once, at the top:
          someone would one day trust it as a security boundary if it were
          written nowhere. */}
      <p className="admin-section-sous">{c.portee}</p>

      {role === "admin" ? (
        <div className="admin-actions">
          <Button onClick={() => setGesture({ kind: "open" })}>{c.ouvrir}</Button>
        </div>
      ) : null}

      <DataTable
        colonnes={columns}
        lignes={clients}
        libelles={{ actions: t.table.actions }}
        vide={<EmptyState titre={c.vide.titre} texte={c.vide.texte} />}
        {...(role === "admin"
          ? {
            actions: (l: ClientApi) => [
              { id: "rotate", label: c.tourner },
              { id: "toggle", label: l.isActive ? c.couper : c.rouvrir, danger: l.isActive },
            ],
            onAction: (id: string, l: ClientApi) => {
              setGesture(id === "rotate" ? { kind: "rotate", client: l } : { kind: "toggle", client: l });
            },
          }
          : {})}
      />

      {gesture !== null && dialog !== null ? (
        <ConfirmWithReason
          destructif={gesture.kind === "toggle" && gesture.client.isActive}
          titre={gesture.kind === "open"
            ? dialog.titre
            : dialog.titre.replace("{client}", gesture.client.label)}
          consequence={dialog.consequence}
          /* THE REGISTRY FIRST, the dictionary as fallback: the seeded codes
             (`access_compromised`, `routine_check`, `fixing_an_error`,
             `new_contract`, `load_test`) carry what the server expects, and a
             sentence without a code makes the write fail. */
          motifs={reasonsFor(GESTURES[gesture.kind]).length > 0
            ? reasonsFor(GESTURES[gesture.kind])
            : [...dialog.motifs]}
          libelles={{
            motif: t.confirmation.motif,
            choisir: t.confirmation.motifManquant,
            autre: t.confirmation.autre,
            precision: t.confirmation.autrePlaceholder,
            journal: t.confirmation.motifAide,
            annuler: t.confirmation.annuler,
            confirmer: t.confirmation.confirmer,
          }}
          onAnnuler={() => { setGesture(null); setLabel(""); }}
          onConfirmer={confirm}
          incomplet={gesture.kind === "open" && label.trim().length < 2}
        >
          {gesture.kind !== "open" ? null : (
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
                  value={clientType}
                  onChange={(e) => setClientType(e.target.value as TypeClient)}
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
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as EnvClient)}
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

      {/* THE KEY, ONCE. The warning comes BEFORE the secret: read after it, the
          warning arrives when the window has already closed in the mind of
          whoever copied it — or did not copy it. */}
      {visibleKey === null ? null : (
        <div className="admin-dialogue" role="dialog" aria-modal="true" aria-labelledby="cli-cle-titre">
          <div className="admin-dialogue-panneau">
            <h2 id="cli-cle-titre" className="admin-section-titre">{c.cle.titre}</h2>
            <p className="gabarit-note" data-ton="alerte">{c.cle.unique}</p>
            <pre className="admin-sortie-brute">{visibleKey}</pre>
            <p className="admin-section-sous">{c.cle.perdue}</p>
            <div className="admin-dialogue-actions">
              <Button onClick={() => onCloseKey?.()}>{c.cle.copiee}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
