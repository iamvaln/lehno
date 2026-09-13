import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { DataTable, EmptyState, FilterBar, StatusPill, type Colonne } from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { Button } from "../composants/base/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { AdminRole, TypeClient, VersionApp } from "@lehno/contracts";

/**
 * The version registry — what we agree to serve.
 *
 * **SETTING `forcesUpdate` IS THE HEAVIEST GESTURE IN THE PANEL**, heavier than
 * cutting off an API client, because nobody sees it coming: every device below
 * that build stops being served, at once.
 *
 * **THE COUNT STATES THE SCALE, IT DOES NOT DECIDE.** We force an update when
 * there is a breaking change or a mandatory security fix — and then everyone has
 * to move, ten devices or ten thousand. Reading it as a criterion would mislead
 * backwards: the more people sitting on a broken build, the more urgent it is to
 * get them off it. It is there to prepare what follows — support warned, an
 * announcement written.
 *
 * **NOTHING IS DELETED.** There is no delete route: a version removed becomes
 * unknown again, so its users go from "please update" to… "please update", and
 * the trace of what shipped is lost. `isRetired` says the same thing and can
 * still be read a year later.
 */
export interface VersionsProps {
  role: AdminRole;
  langue?: Langue;
  versions: VersionApp[];
  platform?: TypeClient | "all";
  onPlatform?: (platform: TypeClient | "all") => void;
  onRegister?: (
    entry: { platform: TypeClient; version: string; buildNumber: number; storeUrl?: string },
    reason: string, reasonCode?: string,
  ) => void;
  /** Toggles `forcesUpdate` — the gesture the whole screen is built around. */
  onForce?: (version: VersionApp, reason: string, reasonCode?: string) => void;
  onRetire?: (version: VersionApp, reason: string, reasonCode?: string) => void;
  onBack?: (id: string) => void;
  reasonsFor?: (gesture: string) => readonly { code: string; libelle: string }[];
}

/* THE SERVER'S NAME FOR THE GESTURE, and it cannot be guessed from this
   screen's. The registry files its reasons under `app_version_update`, and the
   server REFUSES a gesture that offers reasons but receives no code — so asking
   the registry for "force" would return nothing, and the write would fail after
   the operator had already confirmed. */
const GESTURES = {
  register: "app_version_register",
  force: "app_version_update",
  retire: "app_version_update",
} as const;

type Gesture =
  | { kind: "register" }
  | { kind: "force"; version: VersionApp }
  | { kind: "retire"; version: VersionApp };

export function Versions({
  role, langue = "fr", versions, platform = "all", onPlatform,
  onRegister, onForce, onRetire, onBack, reasonsFor = () => [],
}: VersionsProps): ReactNode {
  const t = messages(langue);
  const v = t.versions;

  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [number, setNumber] = useState("");
  const [build, setBuild] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [target, setTarget] = useState<TypeClient>("mobile_ios");

  const fill = (template: string, values: Record<string, string | number>): string =>
    Object.entries(values).reduce((a, [k, x]) => a.split(`{${k}}`).join(String(x)), template);

  const day = (iso: string): string =>
    new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
      day: "numeric", month: "short", year: "numeric",
    }).format(new Date(iso));

  const columns: Colonne<VersionApp>[] = [
    { cle: "platform", titre: v.col.plateforme, rendu: (l) => v.plateformes[l.platform] },
    { cle: "version", titre: v.col.version },
    /* THE BUILD IS THE IDENTITY, not the version string: two builds can carry
       the same version — an ordinary recompiled fix — and comparing semver as
       strings would make "1.10.0" older than "1.9.0". */
    { cle: "buildNumber", titre: v.col.build, aligne: "right" },
    {
      cle: "state",
      titre: v.col.etat,
      rendu: (l) => (
        <StatusPill ton={l.isRetired ? "neutre" : l.forcesUpdate ? "arrete" : "actif"}>
          {l.isRetired ? v.etats.declassee : l.forcesUpdate ? v.etats.forcee : v.etats.servie}
        </StatusPill>
      ),
    },
    /* THE SCALE SITS NEXT TO THE STATE, never in its place: this number says how
       many people will have to update, not whether to ask them to. */
    {
      cle: "comptesVusRecemment",
      titre: v.col.vus,
      aligne: "right",
      discret: true,
      rendu: (l) => fill(v.vus, { n: l.comptesVusRecemment }),
    },
    { cle: "publishedAt", titre: v.col.publiee, discret: true, rendu: (l) => day(l.publishedAt) },
  ];

  const dialog = gesture === null
    ? null
    : gesture.kind === "register"
      ? v.dialogueEnregistrer
      : gesture.kind === "force"
        ? (gesture.version.forcesUpdate ? v.dialogueLiberer : v.dialogueForcer)
        : v.dialogueDeclasser;

  const reset = (): void => {
    setGesture(null);
    setNumber(""); setBuild(""); setStoreUrl("");
  };

  const confirm = (reason: string, code?: string): void => {
    if (gesture === null) return;
    if (gesture.kind === "register") {
      onRegister?.({
        platform: target,
        version: number.trim(),
        buildNumber: Number(build),
        ...(storeUrl.trim() === "" ? {} : { storeUrl: storeUrl.trim() }),
      }, reason, code);
    } else if (gesture.kind === "force") onForce?.(gesture.version, reason, code);
    else onRetire?.(gesture.version, reason, code);
    reset();
  };

  /* The store link goes to the server as typed, and the contract demands a URL:
     a malformed one would fail the registration AFTER confirmation, with the
     reason already written. So the dialog stays shut while it does not hold —
     left empty, it simply is not sent. */
  const badUrl = storeUrl.trim() !== "" && !/^https?:\/\/\S+$/.test(storeUrl.trim());
  const incomplete = number.trim() === "" || !(Number(build) > 0) || badUrl;

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: v.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onBack?.("tableau")}
      />
      <PageHeader titre={v.titre} sous={v.sous} />
      {/* What "forcing" means, said once at the top: the gesture does not
          announce itself, so its consequence has to be readable before anyone
          reaches for it. */}
      <p className="admin-section-sous">{v.portee}</p>

      <FilterBar
        filtres={[{
          cle: "platform",
          label: v.col.plateforme,
          valeur: platform,
          options: [
            { value: "all", label: v.toutes },
            ...(Object.keys(v.plateformes) as TypeClient[])
              .map((k) => ({ value: k, label: v.plateformes[k] })),
          ],
          onChange: (e) => onPlatform?.(e.target.value as TypeClient | "all"),
        }]}
      />

      {role === "admin" ? (
        <div className="admin-actions">
          <Button onClick={() => setGesture({ kind: "register" })}>{v.enregistrer}</Button>
        </div>
      ) : null}

      <DataTable
        colonnes={columns}
        lignes={versions}
        libelles={{ actions: t.table.actions }}
        vide={<EmptyState titre={v.vide.titre} texte={v.vide.texte} />}
        {...(role === "admin"
          ? {
            /* A RETIRED VERSION IS NO LONGER FORCED: it is already not served,
               so offering the gesture would offer one without effect. */
            actions: (l: VersionApp) => (l.isRetired
              ? []
              : [
                { id: "force", label: l.forcesUpdate ? v.liberer : v.forcer, danger: !l.forcesUpdate },
                { id: "retire", label: v.declasser, danger: true },
              ]),
            onAction: (id: string, l: VersionApp) => {
              setGesture(id === "force" ? { kind: "force", version: l } : { kind: "retire", version: l });
            },
          }
          : {})}
      />

      {gesture !== null && dialog !== null ? (
        <ConfirmWithReason
          destructif={gesture.kind !== "register"}
          titre={gesture.kind === "register"
            ? dialog.titre
            : fill(dialog.titre, {
              version: gesture.version.version, build: gesture.version.buildNumber,
            })}
          /* THE CONSEQUENCE SAYS WHAT THE GESTURE MEANS, and the head count
             follows it as context — never as the question. It is appended only
             where it changes what happens to people: setting the flag. */
          consequence={gesture.kind === "force" && !gesture.version.forcesUpdate
            ? `${dialog.consequence} ${fill(v.ampleur, { n: gesture.version.comptesVusRecemment })}`
            : dialog.consequence}
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
          onAnnuler={reset}
          onConfirmer={confirm}
          incomplet={gesture.kind === "register" && incomplete}
        >
          {gesture.kind !== "register" ? null : (
            <div className="gabarit-form">
              <div className="admin-rang">
                <label htmlFor="ver-platform">{v.champs.plateforme}</label>
                <select
                  id="ver-platform"
                  className="admin-champ admin-focus"
                  value={target}
                  onChange={(e) => setTarget(e.target.value as TypeClient)}
                >
                  {(Object.keys(v.plateformes) as TypeClient[]).map((k) => (
                    <option key={k} value={k}>{v.plateformes[k]}</option>
                  ))}
                </select>
              </div>
              <div className="admin-rang">
                <label htmlFor="ver-number">{v.champs.version}</label>
                <input
                  id="ver-number"
                  className="admin-champ admin-focus"
                  value={number}
                  maxLength={20}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </div>
              <div className="admin-rang">
                <label htmlFor="ver-build">{v.champs.build}</label>
                <p className="admin-rang-aide">{v.champs.buildAide}</p>
                <input
                  id="ver-build"
                  type="number"
                  min={1}
                  className="admin-champ admin-focus"
                  value={build}
                  onChange={(e) => setBuild(e.target.value)}
                />
              </div>
              <div className="admin-rang">
                <label htmlFor="ver-store">{v.champs.lien}</label>
                <input
                  id="ver-store"
                  className="admin-champ admin-focus"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                />
                {badUrl ? (
                  <p className="gabarit-note" data-ton="alerte">{v.champs.lienInvalide}</p>
                ) : null}
              </div>
            </div>
          )}
        </ConfirmWithReason>
      ) : null}
    </>
  );
}
