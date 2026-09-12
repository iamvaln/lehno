import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { EmptyState, FilterBar, StatusPill } from "../composants/donnees/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { AdminRole, ConfigurationPortrait, EssaiStudio, NatureStudio } from "@lehno/contracts";
import { Button } from "../composants/base/index.js";

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
  role?: AdminRole;
  langue?: Langue;
  essais: EssaiStudio[];
  /** Les configurations publiées : c'est d'elles que se déduit le sort
   *  « publié », qui n'est pas un verdict. */
  publiees: ConfigurationPortrait[];
  /** LA TÊTE — le brouillon s'il existe, ce qui tourne sinon. C'est elle que le
   *  serveur ajuste en posant une vignette, et donc elle qui dit laquelle
   *  chaque ambiance porte aujourd'hui. */
  tete?: ConfigurationPortrait | null;
  /** Fait de cet essai la vignette de son ambiance. Le verdict part avec. */
  onVignette?: (essaiId: string) => void;
  onRetour?: (id: string) => void;
}

type Sort = "kept" | "discarded" | "publie" | "nonJuge";

const remplir = (gabarit: string, valeurs: Record<string, string | number>): string =>
  Object.entries(valeurs).reduce((a, [c, v]) => a.split(`{${c}}`).join(String(v)), gabarit);

export function StudioEssais(
  { role = "admin", langue = "fr", essais, publiees, tete = null, onVignette, onRetour }: StudioEssaisProps,
): ReactNode {
  const t = messages(langue);
  const d = t.studioEssais;
  const [filtre, setFiltre] = useState<Sort | "tout">("tout");
  const [ambiance, setAmbiance] = useState<string>("tout");
  const [nature, setNature] = useState<NatureStudio | "tout">("tout");

  const idsPubliees = new Set(publiees.map((c) => c.id));

  /* « Publié » l'emporte sur le verdict : un essai dont la configuration est en
     service a fait mieux que d'être gardé, et le dire « gardé » perdrait la
     seule information qui compte. */
  const sortDe = (e: EssaiStudio): Sort =>
    idsPubliees.has(e.configId) ? "publie" : e.verdict ?? "nonJuge";

  /* LES QUATRE NATURES SE MÊLENT ICI, et c'est voulu : elles partagent la
     table des essais, et l'on vient revoir ce qu'on a produit, pas ce qu'on a
     réglé. Ce qui manquait était de pouvoir les DIRE — deux essais du même
     modèle, l'un pour le portrait et l'autre pour les idées, se ressemblaient.
     La forme de la sortie ne les sépare pas : les trois natures de texte
     rendent toutes un message.
     Le filtre ne paraît qu'à partir de deux natures présentes, pour la raison
     qui vaut pour l'ambiance juste en dessous. */
  const natures = [...new Set(essais.map((e) => e.nature))];
  const parNature = nature === "tout" ? essais : essais.filter((e) => e.nature === nature);

  /* Les ambiances proposées sont celles qui ont PRODUIT quelque chose : offrir
     un filtre qui ne rend jamais rien fait douter du filtre, pas des données.
     « Sans ambiance » couvre les essais antérieurs à la colonne et ceux des
     trois natures de TEXTE, qui n'en éprouvent aucune. */
  const ambiances = [...new Set(
    parNature.map((e) => e.ambianceId).filter((a): a is string => a !== null),
  )];
  const parAmbiance = ambiance === "tout"
    ? parNature
    : parNature.filter((e) => (ambiance === "sans" ? e.ambianceId === null : e.ambianceId === ambiance));
  const visibles = filtre === "tout"
    ? parAmbiance
    : parAmbiance.filter((e) => sortDe(e) === filtre);

  /* LA VIGNETTE D'UNE AMBIANCE — quatre conditions, et le serveur refuse en 400
     chacune des trois dernières. L'écran ferme le geste d'avance plutôt que
     d'offrir un bouton qui échouerait :
       — le support ne pose rien ;
       — l'essai doit avoir PRODUIT UNE IMAGE (une sortie de texte porte
         `{ message }`, pas `{ cle }`) ;
       — il doit porter une AMBIANCE, puisque c'est elle qu'il représente ;
       — et cette ambiance doit encore exister dans la tête.
     Le verdict, lui, n'est pas une condition : le geste le pose. */
  const cleDe = (e: EssaiStudio): string | null => {
    const s = e.sortie;
    if (s === null || typeof s !== "object" || Array.isArray(s)) return null;
    const cle = (s as Record<string, unknown>)["cle"];
    return typeof cle === "string" ? cle : null;
  };

  const ambiancesDeLaTete = tete?.reglages.ambiances ?? [];

  const posable = (e: EssaiStudio): boolean =>
    role === "admin" && e.ambianceId !== null && cleDe(e) !== null
    && ambiancesDeLaTete.some((a) => a.id === e.ambianceId);

  /** Cet essai EST déjà la vignette de son ambiance : on le dit, on ne l'offre pas. */
  const estLaVignette = (e: EssaiStudio): boolean => {
    const cle = cleDe(e);
    return cle !== null
      && ambiancesDeLaTete.some((a) => a.id === e.ambianceId && a.apercuCle === cle);
  };

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
      {/* Ce que la vignette fait, dit UNE fois en tête plutôt qu'à chaque carte :
          répété soixante fois, il cesserait d'être lu. */}
      {role === "admin" ? <p className="admin-section-sous">{d.vignette.aide}</p> : null}

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
            ...(natures.length < 2 ? [] : [{
              cle: "nature",
              label: d.filtre.nature,
              valeur: nature,
              options: [
                { value: "tout", label: d.filtre.toutesNatures },
                ...natures.map((n) => ({ value: n, label: d.natures[n] })),
              ],
              onChange: (e: { target: { value: string } }) => {
                setNature(e.target.value as NatureStudio | "tout");
                /* L'AMBIANCE SE REMET, sinon on garderait celle d'une nature
                   qu'on vient de quitter : les textes n'en portent aucune, et
                   la galerie s'ouvrirait vide sans dire pourquoi. */
                setAmbiance("tout");
              },
            }]),
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

                  {/* LA VIGNETTE. Gratuite — elle n'entre pas dans l'empreinte,
                      c'est ce que l'humain regarde et non ce que le modèle lit —
                      et elle écrit un BROUILLON : retenir un essai ne change
                      rien pour les utilisateurs tant que personne n'a publié. */}
                  {estLaVignette(e) ? (
                    <p><StatusPill ton="info">{d.vignette.estLa}</StatusPill></p>
                  ) : posable(e) ? (
                    <p>
                      <Button variant="text" onClick={() => onVignette?.(e.id)}>
                        {d.vignette.poser}
                      </Button>
                    </p>
                  ) : null}

                  {/* La fiche technique en légende, jamais à la place du
                      résultat : elle explique ce qu'on regarde, elle ne le
                      remplace pas. */}
                  {/* La nature EN TÊTE de la légende : c'est la première chose
                      qu'on demande devant une vignette qu'on ne reconnaît pas. */}
                  <p className="admin-section-sous">
                    {d.natures[e.nature]} · {e.modele.cle} · {quand(e.quand)}
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
