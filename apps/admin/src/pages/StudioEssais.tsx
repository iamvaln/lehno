import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { EmptyState, FilterBar, StatusPill } from "../composants/donnees/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { ConfigurationPortrait, EssaiStudio } from "@lehno/contracts";

/**
 * Les essais — ce qui a été produit, et ce qu'on en a pensé.
 *
 * **Il existe parce que le journal de l'Atelier ne porte que la journée.** Un
 * essai gardé la semaine dernière était introuvable : il fallait refaire la
 * configuration de mémoire, et repayer l'appel pour revoir ce qu'on avait déjà
 * vu.
 *
 * **On voit les RÉSULTATS, pas une liste de réglages.** C'est ce qui a été
 * produit qu'on vient juger — donc des vignettes, et la fiche technique en
 * légende. Une table de modèles et de dates ne dit pas si le portrait était bon.
 *
 * **Trois sorts, et le troisième est le but.** Gardé et écarté viennent du
 * verdict ; publié se DÉDUIT de l'état de la configuration — ce n'est pas
 * l'essai qu'on publie. Un essai écarté ne disparaît pas : on l'a jugé mauvais,
 * c'est une information, et le revoir évite de refaire le même.
 *
 * **Aucun essai ne s'efface à la main.** Ce qui a coûté un appel se garde ; ce
 * qui encombre se filtre. Un bouton de suppression n'aurait servi qu'à perdre la
 * trace d'une dépense.
 *
 * **Les liens d'image ne se rangent pas.** La clé devient une URL au moment où
 * le serveur rend, et le lien ne vaut que quelques minutes : l'écran redemande
 * plutôt que de garder, et le serveur redécide à chaque fois qui a le droit.
 */
export interface StudioEssaisProps {
  langue?: Langue;
  essais: EssaiStudio[];
  /** Les configurations publiées : c'est d'elles que se déduit le sort
   *  « publié », qui n'est pas un verdict. */
  publiees: ConfigurationPortrait[];
  onRetour?: (id: string) => void;
}

type Sort = "kept" | "discarded" | "publie" | "nonJuge";

const remplir = (gabarit: string, valeurs: Record<string, string | number>): string =>
  Object.entries(valeurs).reduce((a, [c, v]) => a.split(`{${c}}`).join(String(v)), gabarit);

export function StudioEssais(
  { langue = "fr", essais, publiees, onRetour }: StudioEssaisProps,
): ReactNode {
  const t = messages(langue);
  const d = t.studioEssais;
  const [filtre, setFiltre] = useState<Sort | "tout">("tout");
  const [ambiance, setAmbiance] = useState<string>("tout");

  const idsPubliees = new Set(publiees.map((c) => c.id));

  /* « Publié » l'emporte sur le verdict : un essai dont la configuration est en
     service a fait mieux que d'être gardé, et le dire « gardé » perdrait la
     seule information qui compte. */
  const sortDe = (e: EssaiStudio): Sort =>
    idsPubliees.has(e.configId) ? "publie" : e.verdict ?? "nonJuge";

  /* Les ambiances proposées sont celles qui ont PRODUIT quelque chose : offrir
     un filtre qui ne rend jamais rien fait douter du filtre, pas des données.
     « Sans ambiance » couvre les essais antérieurs à la colonne et ceux du
     message, qui n'en éprouvent aucune. */
  const ambiances = [...new Set(
    essais.map((e) => e.ambianceId).filter((a): a is string => a !== null),
  )];
  const parAmbiance = ambiance === "tout"
    ? essais
    : essais.filter((e) => (ambiance === "sans" ? e.ambianceId === null : e.ambianceId === ambiance));
  const visibles = filtre === "tout"
    ? parAmbiance
    : parAmbiance.filter((e) => sortDe(e) === filtre);

  const quand = (iso: string): string =>
    new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
      day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: d.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader titre={d.titre} sous={d.sous} />
      <p className="admin-section-sous">{d.pourquoi}</p>

      {essais.length === 0 ? (
        <EmptyState titre={d.vide.titre} texte={d.vide.texte} />
      ) : (
        <>
          <FilterBar
            filtres={[{
              cle: "sort",
              label: d.filtre.libelle,
              valeur: filtre,
              options: ([
                ["tout", d.filtre.tout],
                ["kept", d.filtre.kept],
                ["discarded", d.filtre.discarded],
                ["publie", d.filtre.publie],
                ["nonJuge", d.filtre.nonJuge],
              ] as const).map(([value, label]) => ({ value, label })),
              onChange: (e) => setFiltre(e.target.value as Sort | "tout"),
            },
            ...(ambiances.length === 0 ? [] : [{
              cle: "ambiance",
              label: d.filtre.ambiance,
              valeur: ambiance,
              options: [
                { value: "tout", label: d.filtre.toutesAmbiances },
                ...ambiances.map((a) => ({ value: a, label: a })),
                ...(essais.some((e) => e.ambianceId === null)
                  ? [{ value: "sans", label: d.filtre.sansAmbiance }]
                  : []),
              ],
              onChange: (e: { target: { value: string } }) => setAmbiance(e.target.value),
            }]),
            ]}
          />

          {visibles.length === 0 ? (
            <EmptyState titre={d.videFiltre.titre} texte={d.videFiltre.texte} />
          ) : (
            <ul className="admin-vignettes">
              {visibles.map((e) => (
                <li key={e.id} className="admin-vignette">
                  {/* Le résultat d'abord : c'est lui qu'on vient juger. */}
                  {e.etat === "success" ? (
                    <Vignette sortie={e.sortie} alt={d.carte.alt} />
                  ) : (
                    <p>{remplir(d.carte.echoue, { code: e.erreur ?? "—" })}</p>
                  )}

                  <p>
                    <StatusPill
                      ton={sortDe(e) === "publie" ? "actif"
                        : sortDe(e) === "kept" ? "info"
                          : sortDe(e) === "discarded" ? "arrete" : "neutre"}
                    >
                      {d.sorts[sortDe(e)]}
                    </StatusPill>
                  </p>

                  {/* La fiche technique en légende, jamais à la place du
                      résultat : elle explique ce qu'on regarde, elle ne le
                      remplace pas. */}
                  <p className="admin-section-sous">
                    {e.modele.cle} · {quand(e.quand)}
                    {e.parQui === null ? null : ` · ${remplir(d.carte.par, { qui: e.parQui })}`}
                    {" · "}
                    {e.cout === null ? d.carte.coutInconnu : remplir(d.carte.cout, { cout: e.cout })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="admin-section-sous">{d.rappel}</p>
    </>
  );
}

/* La clé devient une URL au moment où le serveur rend, et le lien ne vaut que
   quelques minutes : on l'emploie tout de suite, on ne le range pas. */
function Vignette({ sortie, alt }: { sortie: unknown; alt: string }): ReactNode {
  if (sortie === null || typeof sortie !== "object") return null;
  const contenu = sortie as { url?: unknown; message?: unknown };
  if (typeof contenu.url === "string") {
    return <img src={contenu.url} alt={alt} className="admin-vignette-image" />;
  }
  if (typeof contenu.message === "string") return <p>{contenu.message}</p>;
  return null;
}
