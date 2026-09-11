import { useEffect, useState, type ReactNode } from "react";
import type { AdminRole, AxeCouverture, ProfilStudio } from "@lehno/contracts";

import { Breadcrumb, PageHeader, FormRow } from "../composants/page/index.js";
import { DataTable, EmptyState, StatusPill, type Colonne } from "../composants/donnees/index.js";
import { Button, TextField } from "../composants/base/index.js";
import { messages, type Langue } from "../i18n/index.js";

/* LES PROFILS DE SIMULATION DU STUDIO.
 *
 * Ce sont les éprouvettes : des fiches fictives sur lesquelles on essaie une
 * configuration avant de la mettre en service. L'Atelier les CHOISIT dans une
 * liste déroulante ; personne ne pouvait les renommer, les marquer sensibles
 * ni les retirer — `PATCH` et `DELETE` existaient sans appelant.
 *
 * LA COUVERTURE SE DIT ICI, et elle vient du serveur : « la règle est au
 * dictionnaire, pas dans le dessin — deux implémentations de la même liste
 * finiraient par ne plus dire la même chose ». Elle était servie et affichée
 * nulle part ; or c'est elle qui dit qu'on essaie sur un jeu borgne.
 *
 * ON NE CRÉE PAS DE PROFIL D'ICI, et c'est délibéré : le contenu d'une
 * éprouvette porte jusqu'à soixante notes, des genres, un lien de parenté et
 * des interdits. Un formulaire au rabais produirait des profils pauvres, qui
 * donneraient des essais rassurants sur une configuration qui ne l'est pas.
 * Le semis les pose ; cet écran les entretient.
 */

export interface StudioProfilsProps {
  role: AdminRole;
  langue?: Langue;
  profils: ProfilStudio[];
  /** Les axes qu'aucun profil ne couvre. Vide veut dire « rien ne manque ». */
  manquant: AxeCouverture[];
  onRenommer?: (id: string, champs: { libelle?: string; sensible?: boolean }) => void;
  onSupprimer?: (id: string) => void;
  onRetour?: (id: string) => void;
}

type Ouvert =
  | { quoi: "renommer"; profil: ProfilStudio }
  | { quoi: "supprimer"; profil: ProfilStudio };

export function StudioProfils({
  role, langue = "fr", profils, manquant, onRenommer, onSupprimer, onRetour,
}: StudioProfilsProps): ReactNode {
  const t = messages(langue);
  const p = t.studioProfils;

  const [ouvert, setOuvert] = useState<Ouvert | null>(null);
  const [libelle, setLibelle] = useState("");
  const [sensible, setSensible] = useState(false);

  // Une sortie au clavier, comme le dialogue de confirmation : un dialogue qui
  // ne se referme qu'au clic enferme celui qui s'est trompé de ligne.
  useEffect(() => {
    if (!ouvert) return undefined;
    const auClavier = (e: KeyboardEvent): void => { if (e.key === "Escape") setOuvert(null); };
    document.addEventListener("keydown", auClavier);
    return () => { document.removeEventListener("keydown", auClavier); };
  }, [ouvert]);

  const ouvrirRenommage = (profil: ProfilStudio): void => {
    setLibelle(profil.libelle); setSensible(profil.sensible);
    setOuvert({ quoi: "renommer", profil });
  };

  const colonnes: Colonne<ProfilStudio>[] = [
    { cle: "libelle", titre: p.col.libelle },
    {
      cle: "sensible", titre: p.col.nature,
      rendu: (r) => (
        <StatusPill ton={r.sensible ? "attente" : "neutre"}>
          {r.sensible ? p.sensible : p.ordinaire}
        </StatusPill>
      ),
    },
    {
      cle: "notes", titre: p.col.notes, aligne: "right", discret: true,
      // Le nombre de notes dit la RICHESSE de l'éprouvette d'un coup d'œil :
      // une fiche à deux notes et une fiche à quarante n'éprouvent pas la
      // même chose, et c'est l'écart qu'on vient chercher ici.
      rendu: (r) => String(r.contenu.notes.length),
    },
    { cle: "creeLe", titre: p.col.creeLe, discret: true, rendu: (r) => r.creeLe.slice(0, 10) },
  ];

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: t.sections.studio }, { label: p.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader titre={p.titre} sous={p.sous} />

      {/* CE QUI MANQUE, AVANT CE QU'ON A. Un jeu d'éprouvettes qui ne couvre
          aucun cas sensible rend des essais rassurants sur une configuration
          qui ne l'est pas — et c'est justement ce qu'on ne verrait pas en
          lisant la liste. */}
      <p className="admin-section-sous" data-ton={manquant.length > 0 ? "alerte" : undefined}>
        {manquant.length === 0
          ? p.couverture.complete
          : `${p.couverture.manque} ${manquant.map((a) => p.axes[a]).join(" · ")}`}
      </p>

      <DataTable
        colonnes={colonnes}
        lignes={profils}
        libelles={{ actions: t.table.actions }}
        {...(role === "admin"
          ? {
            actions: () => [
              { id: "renommer", label: p.renommer },
              { id: "supprimer", label: p.supprimer, danger: true },
            ],
            onAction: (geste: string, ligne: ProfilStudio) => {
              if (geste === "renommer") ouvrirRenommage(ligne);
              else setOuvert({ quoi: "supprimer", profil: ligne });
            },
          }
          : {})}
        vide={<EmptyState titre={p.vide.titre} texte={p.vide.texte} />}
      />

      {ouvert ? (
        <div className="admin-dialogue-couche" role="dialog" aria-modal="true" aria-label={
          ouvert.quoi === "renommer" ? p.dialogueRenommer.titre : p.dialogueSupprimer.titre
        }>
          <div className="admin-dialogue-voile" aria-hidden="true" />
          <div className="admin-dialogue">
            <h2 className="admin-dialogue-titre">
              {ouvert.quoi === "renommer" ? p.dialogueRenommer.titre : p.dialogueSupprimer.titre}
            </h2>
            <p className="admin-dialogue-consequence">
              {ouvert.quoi === "renommer"
                ? p.dialogueRenommer.consequence
                : `${p.dialogueSupprimer.consequence} — « ${ouvert.profil.libelle} »`}
            </p>

            {/* AUCUN MOTIF DEMANDÉ ICI, contrairement aux gestes d'exploitation.
                Ce n'est pas un oubli : ces deux routes n'en acceptent pas, et
                rien ne part au journal d'audit. Réclamer une raison qu'on
                jetterait ensuite apprendrait à ne plus croire le champ. */}
            {ouvert.quoi === "renommer" ? (
              <div className="admin-dialogue-corps">
                <FormRow champId="profil-libelle" label={p.champs.libelle}>
                  <TextField
                    id="profil-libelle"
                    value={libelle}
                    onChange={(e) => setLibelle(e.target.value)}
                  />
                </FormRow>
                <FormRow champId="profil-sensible" label={p.champs.sensible} aide={p.champs.sensibleAide}>
                  <input
                    id="profil-sensible"
                    type="checkbox"
                    className="admin-case admin-focus"
                    checked={sensible}
                    onChange={(e) => setSensible(e.target.checked)}
                  />
                </FormRow>
              </div>
            ) : null}

            <div className="admin-dialogue-actions">
              <Button variant="text" onClick={() => setOuvert(null)}>{t.confirmation.annuler}</Button>
              {ouvert.quoi === "renommer" ? (
                <Button
                  /* RIEN CHANGÉ, RIEN À ENVOYER : le contrat refuse un corps
                     vide — « au moins un champ doit être fourni ». Sans ce
                     verrou, refermer le dialogue sans toucher à rien partirait
                     en 422, et l'écran annoncerait une panne là où il ne s'est
                     rien passé. */
                  disabled={
                    libelle.trim() === ""
                    || (libelle.trim() === ouvert.profil.libelle && sensible === ouvert.profil.sensible)
                  }
                  onClick={() => {
                    /* Ce qui a bougé, rien d'autre : le contrat refuse un corps
                       vide, et renvoyer l'inchangé ferait d'un simple marquage
                       une modification de libellé dans les yeux du prochain
                       lecteur. */
                    const avant = ouvert.profil;
                    onRenommer?.(avant.id, {
                      ...(libelle.trim() !== avant.libelle ? { libelle: libelle.trim() } : {}),
                      ...(sensible !== avant.sensible ? { sensible } : {}),
                    });
                    setOuvert(null);
                  }}
                >
                  {t.confirmation.confirmer}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => { onSupprimer?.(ouvert.profil.id); setOuvert(null); }}
                >
                  {p.supprimer}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
