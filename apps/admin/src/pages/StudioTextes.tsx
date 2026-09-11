import { useState, type ReactNode } from "react";
import type {
  AdminRole, CandidatsStudio, ConfigurationTexte, EssaiStudio,
  NatureTexte, ProfilStudio, ReglagesTexte,
} from "@lehno/contracts";
import { NATURES_TEXTE } from "@lehno/contracts";

import { Breadcrumb, PageHeader, FormRow } from "../composants/page/index.js";
import { EmptyState, StatusPill } from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { Button, Icon, TextField } from "../composants/base/index.js";
import { messages, type Langue } from "../i18n/index.js";

/* L'ATELIER DES TEXTES — le message, les idées, le brief du portrait.
 *
 * UN ÉCRAN, TROIS ONGLETS, JAMAIS TROIS ÉCRANS. L'API a tranché ainsi et pour
 * la même raison : le geste est rigoureusement le même — lire ce qui tourne et
 * ce qu'on compose, enregistrer, essayer, publier, revenir en arrière. Seule la
 * FORME des réglages diffère. Trois écrans jumeaux divergeraient au premier
 * durcissement, et l'un des trois garderait l'ancienne règle sans que personne
 * ne le voie avant qu'un administrateur ne publie par le mauvais chemin.
 *
 * ON COMPOSE TOUJOURS À PARTIR DE CE QUI EXISTE : le brouillon s'il y en a un,
 * la version en service sinon. Partir d'une page blanche ferait perdre, au
 * premier enregistrement, tout ce que la version en service portait.
 *
 * LA PUBLICATION NE SE DÉCIDE PAS ICI. Le serveur rend `publiable` et
 * `blocage` ; l'écran les LIT. Recalculer la règle à l'écran ferait deux
 * autorités sur la même question, et c'est celle du serveur qui compte — on
 * offrirait un bouton que la publication refuserait.
 */

export interface StudioTextesProps {
  role: AdminRole;
  langue?: Langue;
  nature: NatureTexte;
  onNature: (nature: NatureTexte) => void;
  /** Le brouillon s'il existe, la version en service sinon. */
  depart: ConfigurationTexte;
  enService: ConfigurationTexte | null;
  profils: ProfilStudio[];
  candidats: CandidatsStudio;
  /** Le dernier essai de la séance. Nul avant le premier. */
  dernier: EssaiStudio | null;
  enCours?: boolean;
  onEnregistrer?: (reglages: ReglagesTexte) => void;
  onEssayer?: (reglages: ReglagesTexte, profileId: string) => void;
  onPublier?: (configId: string, note: string) => void;
  onRetour?: (id: string) => void;
}

/* Les réglages en cours d'édition. On les tient en une seule valeur plutôt
   qu'en un champ par propriété : c'est l'objet ENTIER que le contrat valide, et
   le découper ici ferait diverger la forme de l'écran de celle qu'on envoie. */
type Brouillon = Record<string, unknown>;

const estMessage = (n: NatureTexte): boolean => n === "message";
const estIdees = (n: NatureTexte): boolean => n === "idees";
const estBrief = (n: NatureTexte): boolean => n === "portrait_brief";

type Orientation = {
  id: string; actif: boolean;
  libelle: { fr: string; en: string };
};

export function StudioTextes({
  role, langue = "fr", nature, onNature, depart, enService, profils, candidats,
  dernier, enCours = false, onEnregistrer, onEssayer, onPublier, onRetour,
}: StudioTextesProps): ReactNode {
  const t = messages(langue);
  const a = t.studioTextes;

  /* La clé de remontage : changer d'onglet doit repartir des réglages de la
     NOUVELLE nature, pas garder ceux de l'ancienne. Sans elle, on publierait
     un jour les garde-fous du message sur les idées. */
  const [cle, setCle] = useState(nature);
  const [reglages, setReglages] = useState<Brouillon>(depart.reglages as Brouillon);
  const [profileId, setProfileId] = useState(profils[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [publication, setPublication] = useState(false);
  const [nouveauGardeFou, setNouveauGardeFou] = useState("");

  if (cle !== nature) {
    setCle(nature);
    setReglages(depart.reglages as Brouillon);
    setNouveauGardeFou("");
  }

  const poser = (champ: string, valeur: unknown): void =>
    setReglages((avant) => ({ ...avant, [champ]: valeur }));

  const gardeFous = (reglages["gardeFous"] as string[] | undefined) ?? [];
  const champs = (reglages["champsDuProche"] as string[] | undefined) ?? [];
  const orientations = (reglages["orientations"] as Orientation[] | undefined) ?? [];

  /* AU MOINS UNE ORIENTATION ACTIVE : le contrat le refuse à l'enregistrement,
     et l'écran le dit AVANT d'envoyer. Un studio sans orientation est un écran
     client vide — le refus doit tomber ici, pas après un aller-retour. */
  const sansOrientation = estMessage(nature) && !orientations.some((o) => o.actif);
  const complet = !sansOrientation;

  const deplacer = (index: number, pas: -1 | 1): void => {
    const cible = index + pas;
    if (cible < 0 || cible >= orientations.length) return;
    const suite = [...orientations];
    const [pris] = suite.splice(index, 1);
    suite.splice(cible, 0, pris!);
    poser("orientations", suite);
  };

  const modelesDeTexte = candidats.modeles.filter((m) => m.capacite === "text");

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: t.sections.studio }, { label: a.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader titre={a.titre} sous={a.sous} />

      {/* LES TROIS NATURES, en onglets. Une entrée de menu par nature ferait
          trois adresses pour un seul outil — et trois écrans à tenir d'accord. */}
      <div className="admin-onglets" role="tablist" aria-label={a.titre}>
        {NATURES_TEXTE.map((n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={n === nature}
            className="admin-onglet admin-focus"
            onClick={() => onNature(n)}
          >
            {a.natures[n]}
          </button>
        ))}
      </div>

      <section className="admin-section">
        <h2 className="admin-section-titre">{a.enService.titre}</h2>
        <p className="admin-section-sous">
          {enService
            ? `${a.enService.version} ${enService.version ?? "—"} · ${enService.publieeLe?.slice(0, 10) ?? "—"}`
            : a.enService.aucune}
        </p>
      </section>

      <div className="gabarit-form">
        <FormRow champId="txt-consigne" label={a.champs.consigne} aide={a.champs.consigneAide}>
          <textarea
            id="txt-consigne"
            className="admin-champ admin-focus gabarit-saisie"
            rows={5}
            maxLength={4000}
            value={String(reglages["consigneCommune"] ?? "")}
            onChange={(e) => poser("consigneCommune", e.target.value)}
          />
        </FormRow>

        {/* LES GARDE-FOUS, un par un — et retirés au clic. Un collage
            multiligne irait plus vite et se raterait plus souvent : quarante
            entrées collées d'un bloc ne se relisent pas. */}
        <FormRow champId="txt-gardefou" label={a.champs.gardeFous} aide={a.champs.gardeFousAide}>
          <div className="admin-etiquettes">
            {gardeFous.map((g, i) => (
              <span key={`${g}-${i}`} className="admin-etiquette">
                {g}
                <button
                  type="button"
                  className="admin-etiquette-retirer admin-focus"
                  aria-label={`${a.champs.retirer} ${g}`}
                  onClick={() => poser("gardeFous", gardeFous.filter((_, j) => j !== i))}
                >
                  <Icon name="x" size={15} />
                </button>
              </span>
            ))}
          </div>
          <TextField
            id="txt-gardefou"
            value={nouveauGardeFou}
            onChange={(e) => setNouveauGardeFou(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || nouveauGardeFou.trim() === "") return;
              e.preventDefault();
              poser("gardeFous", [...gardeFous, nouveauGardeFou.trim()]);
              setNouveauGardeFou("");
            }}
          />
        </FormRow>

        {/* CE QUE LE MODÈLE REÇOIT DE LA FICHE — donc ce qui sort de chez nous.
            Décocher « notes », c'est décider que les confidences ne traversent
            pas : ce n'est pas un réglage de qualité, c'est un réglage de fuite. */}
        <FormRow label={a.champs.champsDuProche} aide={a.champs.champsDuProcheAide}>
          <div className="admin-cases">
            {candidats.champsDuProche.map((c) => (
              <label key={c} className="admin-case-ligne">
                <input
                  type="checkbox"
                  className="admin-case admin-focus"
                  checked={champs.includes(c)}
                  onChange={(e) => poser(
                    "champsDuProche",
                    e.target.checked ? [...champs, c] : champs.filter((x) => x !== c),
                  )}
                />
                {/* Le serveur rend la liste des champs en texte libre ; le
                    dictionnaire n'en connaît que quatre. Un champ ajouté demain
                    s'affiche sous sa CLÉ plutôt que de faire tomber l'écran —
                    laide, mais lisible, et le manque se voit. */}
                {(a.champsProche as Record<string, string>)[c] ?? c}
              </label>
            ))}
          </div>
        </FormRow>

        <FormRow champId="txt-modele" label={a.champs.modele} aide={a.champs.modeleAide}>
          <select
            id="txt-modele"
            className="admin-champ admin-focus"
            value={String(reglages["modele"] ?? "")}
            onChange={(e) => poser("modele", e.target.value)}
          >
            {modelesDeTexte.map((m) => (
              <option key={m.id} value={m.cle}>
                {m.cle}{m.actif ? "" : ` · ${a.modeleEteint}`}
              </option>
            ))}
          </select>
        </FormRow>

        {estIdees(nature) ? (
          <FormRow champId="txt-nombre" label={a.champs.nombreDemande} aide={a.champs.nombreDemandeAide}>
            <input
              id="txt-nombre"
              type="number"
              min={3}
              max={6}
              className="admin-champ admin-focus gabarit-saisie"
              value={Number(reglages["nombreDemande"] ?? 3)}
              onChange={(e) => poser("nombreDemande", Number(e.target.value))}
            />
          </FormRow>
        ) : null}

        {estBrief(nature) ? (
          <>
            <Bornes
              id="txt-mots-portrait"
              label={a.champs.motsDuPortrait}
              aide={a.champs.motsDuPortraitAide}
              libelles={a.bornes}
              valeur={reglages["motsDuPortrait"] as { min: number; max: number } | undefined}
              onChange={(v) => poser("motsDuPortrait", v)}
            />
            <Bornes
              id="txt-mots-phrase"
              label={a.champs.motsDeLaPhrase}
              /* LE PLAFOND EST UNE CONTRAINTE DE COMPOSITION, pas de goût :
                 au-delà de vingt-quatre mots, la troisième ligne déborde de la
                 bande et la dédicace sort tronquée. L'aide le DIT — sans elle,
                 quelqu'un le desserrera un jour pour « laisser de la place ». */
              aide={a.champs.motsDeLaPhraseAide}
              libelles={a.bornes}
              valeur={reglages["motsDeLaPhrase"] as { min: number; max: number } | undefined}
              onChange={(v) => poser("motsDeLaPhrase", v)}
            />
          </>
        ) : null}

        {estMessage(nature) ? (
          <section className="admin-section">
            <h2 className="admin-section-titre">{a.orientations.titre}</h2>
            {/* L'ORDRE EST CELUI DE L'ÉCRAN CLIENT, ET LE PREMIER ACTIF EST LE
                DÉFAUT. Il n'y a pas de champ « orientation par défaut », et il
                ne doit pas y en avoir : un défaut désigné pointerait un jour
                sur une orientation qu'on vient d'éteindre, et l'écran du client
                s'ouvrirait sans sélection. On règle le défaut en réordonnant. */}
            <p className="admin-section-sous">{a.orientations.aide}</p>
            {sansOrientation ? (
              <p className="gabarit-note" data-ton="alerte">{a.orientations.aucuneActive}</p>
            ) : null}
            <ol className="admin-liste-ordonnee">
              {orientations.map((o, i) => (
                <li key={o.id} className="admin-rang-ordonne">
                  <span className="admin-rang-position">{i + 1}</span>
                  <span className="admin-rang-titre">
                    {o.libelle[langue]}
                    {i === orientations.findIndex((x) => x.actif) ? (
                      <StatusPill ton="actif">{a.orientations.defaut}</StatusPill>
                    ) : null}
                  </span>
                  <label className="admin-case-ligne">
                    <input
                      type="checkbox"
                      className="admin-case admin-focus"
                      checked={o.actif}
                      onChange={(e) => poser(
                        "orientations",
                        orientations.map((x) => (x.id === o.id ? { ...x, actif: e.target.checked } : x)),
                      )}
                    />
                    {a.orientations.active}
                  </label>
                  <Button
                    variant="text"
                    disabled={i === 0}
                    aria-label={`${a.orientations.monter} ${o.libelle[langue]}`}
                    onClick={() => deplacer(i, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="text"
                    disabled={i === orientations.length - 1}
                    aria-label={`${a.orientations.descendre} ${o.libelle[langue]}`}
                    onClick={() => deplacer(i, 1)}
                  >
                    ↓
                  </Button>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* L'ESSAI SE FAIT SUR UNE ÉPROUVETTE. Sans profil, aucun essai n'est
            possible : on le dit plutôt que d'offrir un bouton qui échouerait. */}
        {profils.length === 0 ? (
          <EmptyState titre={a.sansProfil.titre} texte={a.sansProfil.texte} />
        ) : (
          <FormRow champId="txt-profil" label={a.champs.profil} aide={a.champs.profilAide}>
            <select
              id="txt-profil"
              className="admin-champ admin-focus"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
            >
              {profils.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
            </select>
          </FormRow>
        )}

        {dernier ? (
          <section className="admin-section">
            <h2 className="admin-section-titre">{a.essai.titre}</h2>
            <p className="admin-section-sous">
              {a.essai.etat} {a.etats[dernier.etat] ?? dernier.etat}
              {" · "}
              {/* « On ne sait pas » n'est pas « gratuit » : un modèle non
                  tarifé rend un coût nul, et l'écrire « 0 » ferait croire que
                  l'essai n'a rien coûté. */}
              {a.essai.cout} {dernier.cout === null ? a.essai.coutInconnu : dernier.cout}
              {dernier.erreur ? ` · ${dernier.erreur}` : ""}
            </p>
          </section>
        ) : null}

        <div className="gabarit-form-pied">
          <Button
            disabled={role !== "admin" || enCours || !complet}
            onClick={() => onEnregistrer?.(reglages as unknown as ReglagesTexte)}
          >
            {a.gestes.enregistrer}
          </Button>
          <Button
            variant="outline"
            disabled={role !== "admin" || enCours || !complet || profils.length === 0}
            onClick={() => onEssayer?.(reglages as unknown as ReglagesTexte, profileId)}
          >
            {a.gestes.essayer}
          </Button>
          {/* PUBLIER NE PARAÎT QUE SI LE SERVEUR LE PERMET. `publiable` et
              `blocage` viennent de lui ; recalculer la règle ici ferait deux
              autorités sur la même question, et l'écran offrirait un geste que
              la publication refuserait. */}
          {depart.publiable ? (
            <Button
              variant="outline"
              disabled={role !== "admin" || enCours}
              onClick={() => setPublication(true)}
            >
              {a.gestes.publier}
            </Button>
          ) : (
            <p className="gabarit-note">
              {depart.blocage ? a.blocages[depart.blocage] : a.gestes.publierImpossible}
            </p>
          )}
        </div>
      </div>

      {publication ? (
        <ConfirmWithReason
          titre={a.dialoguePublier.titre}
          consequence={a.dialoguePublier.consequence}
          motifs={[...a.dialoguePublier.motifs]}
          libelles={{
            motif: t.confirmation.motif,
            choisir: t.confirmation.motifManquant,
            autre: t.confirmation.autre,
            precision: t.confirmation.autrePlaceholder,
            journal: t.confirmation.motifAide,
            annuler: t.confirmation.annuler,
            confirmer: t.confirmation.confirmer,
          }}
          onAnnuler={() => setPublication(false)}
          onConfirmer={(motif) => {
            /* LA NOTE DIT CE QUI CHANGE, et c'est elle qui sera relue dans
               l'historique — pas le diff des réglages. */
            onPublier?.(depart.id, note.trim() === "" ? motif : note.trim());
            setPublication(false);
            setNote("");
          }}
        >
          <FormRow champId="txt-note" label={a.dialoguePublier.note} aide={a.dialoguePublier.noteAide}>
            <TextField id="txt-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </FormRow>
        </ConfirmWithReason>
      ) : null}
    </>
  );
}

/** Deux bornes qui vont ensemble. Séparées en deux rangs, on lirait « minimum »
 *  et « maximum » comme deux réglages indépendants — et l'on poserait un
 *  minimum au-dessus du maximum, que le contrat refuse. */
function Bornes({
  id, label, aide, libelles, valeur, onChange,
}: {
  id: string;
  label: string;
  aide: string;
  libelles: { min: string; max: string };
  valeur: { min: number; max: number } | undefined;
  onChange: (v: { min: number; max: number }) => void;
}): ReactNode {
  const bornes = valeur ?? { min: 1, max: 1 };
  return (
    <FormRow champId={`${id}-min`} label={label} aide={aide}>
      <div className="admin-bornes">
        <label htmlFor={`${id}-min`}>{libelles.min}</label>
        <input
          id={`${id}-min`}
          type="number"
          className="admin-champ admin-focus"
          value={bornes.min}
          onChange={(e) => onChange({ ...bornes, min: Number(e.target.value) })}
        />
        <label htmlFor={`${id}-max`}>{libelles.max}</label>
        <input
          id={`${id}-max`}
          type="number"
          className="admin-champ admin-focus"
          value={bornes.max}
          onChange={(e) => onChange({ ...bornes, max: Number(e.target.value) })}
        />
      </div>
    </FormRow>
  );
}
