import { useState, type ReactNode } from "react";
import type { AdminRole, MaintenanceStatus, Parametre, Parametres } from "@lehno/contracts";
import { Breadcrumb, FormRow, PageHeader, PageTabs } from "../composants/page/index.js";
import { DataTable, type Colonne } from "../composants/donnees/index.js";
import { ConfirmWithReason, RoleGate } from "../composants/actions/index.js";
import { Toast } from "../composants/signaux/index.js";
import { Button } from "../composants/base/index.js";
import { messages, type Langue, type Messages } from "../i18n/index.js";
import { parametres as parametresDemo } from "../fixtures/index.js";

/* Le gabarit de formulaire — réservé aux sections de configuration, monté ici
 * sur sa section pilote : Configurations.
 *
 * Trois choses le distinguent d'un formulaire ordinaire, et ce sont les trois
 * que la spec impose :
 *
 * — **la valeur précédente est rappelée** sous chaque réglage, parce qu'on ne
 *   change pas un paramètre qui pilote le produit sans voir ce qu'on quitte ;
 * — **l'enregistrement est explicite** : aucune saisie ne part au serveur, un
 *   geste nommé le fait, et lui seul ;
 * — **le geste est journalisé**, et la page le dit avant, pas après.
 */

type Onglet = "economie" | "occasions";
type TypeOccasion = Parametres["typesEvenement"][number];

const ENTIER_POSITIF = /^\d+$/;

/** Les trois clés que le bloc d'arrêt gouverne.
 *
 *  Elles restent en base et le serveur les sert, mais **elles ne se saisissent
 *  pas ici**. Deux commandes pour la même chose invitent à les désaccorder — et
 *  celle du formulaire demanderait de taper `true` et une date ISO à la main,
 *  quand le bloc au-dessus fait le même geste en deux clics.
 *
 *  Filtrées à l'affichage seulement : le serveur reste la source, et le jour où
 *  le bloc disparaîtrait, elles redeviendraient réglables sans rien migrer. */
const CLES_ARRET = new Set([
  "maintenance_mode", "maintenance_retry_after_seconds", "maintenance_until",
]);

/** Les durées proposées. Une liste fermée plutôt qu'un champ libre : on
 *  annonce un ordre de grandeur, pas une minute précise, et un champ libre
 *  inviterait à saisir « 90 » en croyant dire une heure et demie de travail
 *  quand on veut dire « je ne sais pas ». */
const DUREES = [
  { cle: "m15", minutes: 15 },
  { cle: "m30", minutes: 30 },
  { cle: "h1", minutes: 60 },
  { cle: "h2", minutes: 120 },
  { cle: "inconnue", minutes: null },
] as const;

/**
 * L'arrêt pour intervention, en tête des paramètres.
 *
 * **Il est ici et pas dans Fonctionnalités, et c'est voulu.** Éteindre une
 * fonctionnalité retire une surface ; arrêter le service les suspend toutes et
 * annonce un délai. Les poser au même endroit inviterait à les confondre — et
 * l'un des deux enferme l'équipe dehors s'il est pris pour l'autre.
 */
function ArretPourIntervention({ t, langue, etat, onArreter, onRouvrir }: {
  t: Messages;
  langue: Langue;
  etat: MaintenanceStatus;
  onArreter?: (dureeMinutes: number | null, motif: string) => void;
  onRouvrir?: (motif: string) => void;
}): ReactNode {
  const [duree, setDuree] = useState<string>("h1");
  const [geste, setGeste] = useState<"arreter" | "rouvrir" | null>(null);

  // L'heure vient du serveur en UTC ; c'est ici qu'elle passe à celle de qui
  // lit. Le serveur ne connaît pas le fuseau du navigateur, et une heure
  // affichée en UTC ferait annoncer un retour à la mauvaise heure.
  const heure = etat.until === null
    ? null
    : new Intl.DateTimeFormat(langue === "fr" ? "fr-FR" : "en-GB", {
      dateStyle: "short", timeStyle: "short",
    }).format(new Date(etat.until));

  const minutes = DUREES.find((d) => d.cle === duree)?.minutes ?? null;

  return (
    <section className="admin-arret" aria-labelledby="arret-titre">
      <h2 id="arret-titre" className="admin-section-titre">{t.arret.titre}</h2>
      <p className="admin-section-sous">{t.arret.sous}</p>

      <p className="admin-arret-etat">
        <strong>{etat.maintenance ? t.arret.etats.arrete : t.arret.etats.ouvert}</strong>
        {etat.maintenance
          ? ` — ${heure === null ? t.arret.sansHeure : t.arret.jusqua.replace("{heure}", heure)}`
          : null}
      </p>

      <div className="admin-arret-gestes">
        <select
          className="admin-champ admin-focus"
          aria-label={t.arret.duree}
          value={duree}
          onChange={(e) => setDuree(e.target.value)}
        >
          {DUREES.map((d) => (
            <option key={d.cle} value={d.cle}>{t.arret.durees[d.cle]}</option>
          ))}
        </select>

        {/* Aucune action pleine ici : la vue en a déjà une, « Enregistrer », et
            deux boutons de même rang ne diraient plus lequel fait avancer.
            L'emphase est portée par la ligne d'état, qui dit en gras si le
            service est ouvert ou fermé — c'est l'information, pas le geste. */}
        <Button
          variant={etat.maintenance ? "outline" : "destructive"}
          onClick={() => setGeste("arreter")}
        >
          {etat.maintenance ? t.arret.prolonger : t.arret.arreter}
        </Button>

        {etat.maintenance ? (
          <Button variant="outline" onClick={() => setGeste("rouvrir")}>
            {t.arret.rouvrir}
          </Button>
        ) : null}
      </div>

      {geste === "arreter" ? (
        <ConfirmWithReason
          titre={t.arret.dialogueArreter.titre}
          consequence={t.arret.dialogueArreter.consequence}
          destructif
          motifs={t.arret.dialogueArreter.motifs}
          libelles={t.confirmation}
          onConfirmer={(motif) => { setGeste(null); onArreter?.(minutes, motif); }}
          onAnnuler={() => setGeste(null)}
        />
      ) : null}

      {geste === "rouvrir" ? (
        <ConfirmWithReason
          titre={t.arret.dialogueRouvrir.titre}
          consequence={t.arret.dialogueRouvrir.consequence}
          motifs={t.arret.dialogueRouvrir.motifs}
          libelles={t.confirmation}
          onConfirmer={(motif) => { setGeste(null); onRouvrir?.(motif); }}
          onAnnuler={() => setGeste(null)}
        />
      ) : null}
    </section>
  );
}

export interface EditionProps {
  role: AdminRole;
  langue?: Langue;
  parametres?: Parametres;
  /** L'état de l'arrêt. Absent tant que le serveur ne l'a pas rendu. */
  arret?: MaintenanceStatus;
  onArreter?: (dureeMinutes: number | null, motif: string) => void;
  onRouvrir?: (motif: string) => void;
  /** Le motif accompagne toujours l'enregistrement : sans lui, le serveur refuse. */
  onEnregistrer?: (valeurs: Parametres, motif: string) => void;
  onRetour?: (id?: string) => void;
}

function avecUnite(valeur: string | number, unite: string | null): string {
  return unite === null ? String(valeur) : `${valeur} ${unite}`;
}

/**
 * Le serveur transporte une clé, jamais une phrase composée : c'est ce qui rend
 * l'outil bilingue sans qu'il ait à connaître la langue de qui l'appelle.
 *
 * Une clé que le dictionnaire ne connaît pas s'affiche telle quelle. C'est
 * volontairement laid : ça se voit et ça se corrige, là où une ligne vide
 * passerait pour une place libre.
 */
function dire(t: Messages, cle: string): { libelle: string; aide: string | null; unite: string | null } {
  const connu = (t.parametres.cles as Record<string, { libelle: string; aide: string; unite: string | null } | undefined>)[cle];
  return connu ?? { libelle: cle, aide: null, unite: null };
}

// Un réglage numérique ne se laisse pas vider ni mettre à zéro : le contrôle est
// le même que celui du serveur, et il se lit sous le champ, pas après l'appel.
function estNumerique(parametre: Parametre): boolean {
  return parametre.type === "number" || parametre.type === "money" || parametre.type === "duration";
}

function invalide(parametre: Parametre, saisie: string): boolean {
  // Le type vient du serveur, qui le tient de la base. S'en remettre à la forme
  // de la valeur reçue serait fragile : « 100 » arrive en chaîne, et le champ
  // deviendrait libre au premier paramètre servi ainsi.
  //
  // Un paramètre TEXTE peut légitimement être vide, et le refuser coûtait cher :
  // `maintenance_until` est vide par défaut — « vide : aucune annonce » —, donc
  // le formulaire était invalide en permanence et « Enregistrer » restait éteint
  // pour TOUS les réglages du produit. Le serveur, lui, ne vérifie que les types
  // numériques et booléens : l'écran était plus strict que l'autorité.
  if (!estNumerique(parametre)) return false;
  return !ENTIER_POSITIF.test(saisie.trim()) || Number(saisie) <= 0;
}

export function Edition({
  role,
  langue = "fr",
  parametres = parametresDemo,
  arret,
  onArreter,
  onRouvrir,
  onEnregistrer,
  onRetour,
}: EditionProps): ReactNode {
  const t = messages(langue);
  const [onglet, setOnglet] = useState<Onglet>("economie");
  // L'état de référence, c'est le dernier enregistrement : c'est lui qui dit ce
  // qui a changé, et lui que la valeur précédente rappelle.
  const [reference, setReference] = useState<Parametres>(parametres);
  const [saisies, setSaisies] = useState<Record<string, string>>(() =>
    Object.fromEntries(parametres.economie.map((p) => [p.cle, String(p.valeur)])),
  );
  const [occasions, setOccasions] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(parametres.typesEvenement.map((type) => [type.id, type.actif])),
  );
  const [accuse, setAccuse] = useState<string | null>(null);
  // Le serveur refuse une écriture sans motif d'au moins six caractères — la
  // contrainte est posée en base, pas dans un service. L'écran le demande donc
  // avant d'appeler, plutôt que d'essuyer un refus qu'il ne saurait pas
  // expliquer à qui vient de cliquer.
  const [demandeMotif, setDemandeMotif] = useState(false);

  const saisieDe = (parametre: Parametre) => saisies[parametre.cle] ?? String(parametre.valeur);
  const actifDe = (type: TypeOccasion) => occasions[type.id] ?? type.actif;

  // Ce que le formulaire montre et gouverne : tout sauf ce que le bloc d'arrêt
  // pilote déjà.
  const reglages = reference.economie.filter((p) => !CLES_ARRET.has(p.cle));

  const valide = reglages.every((p) => !invalide(p, saisieDe(p)));
  const changes = reglages.filter((p) => saisieDe(p) !== String(p.valeur));
  const modifie =
    changes.length > 0 ||
    reference.typesEvenement.some((type) => type.reglable && actifDe(type) !== type.actif);

  // Rien ne part avant ce geste. La valeur qu'on quitte devient la valeur
  // précédente : c'est ce que le prochain écran rappellera.
  const enregistrer = () => {
    if (!valide) return;
    if (!modifie) {
      setAccuse(t.parametres.rienAEnregistrer);
      return;
    }
    setDemandeMotif(true);
  };

  const confirmer = (motif: string) => {
    setDemandeMotif(false);
    const valeurs: Parametres = {
      economie: reference.economie.map((p) => ({
        ...p,
        // La valeur reste telle qu'elle a été saisie. La base stocke du texte et
        // porte le type à côté ; convertir ici ferait perdre « 07 » ou « 1.50 »
        // avant même que le serveur ait pu dire s'il les accepte.
        valeur: saisieDe(p),
        valeurPrecedente: p.valeur,
      })),
      typesEvenement: reference.typesEvenement.map((type) => ({ ...type, actif: actifDe(type) })),
    };
    setReference(valeurs);
    onEnregistrer?.(valeurs, motif);
    setAccuse(t.parametres.enregistre);
  };

  const colonnes: Colonne<TypeOccasion>[] = [
    { cle: "id", titre: t.parametres.occasions.col.nom },
    {
      cle: "registre",
      titre: t.parametres.occasions.col.registre,
      discret: true,
      largeur: 200,
      rendu: (type) => (type.sensible ? t.parametres.occasions.sensible : t.parametres.occasions.courant),
    },
    {
      cle: "actif",
      titre: t.parametres.occasions.col.etat,
      largeur: 170,
      rendu: (type) => (
        <select
          className="admin-champ admin-focus"
          aria-label={type.id}
          // Un interrupteur qui n'enregistre rien est pire que pas
          // d'interrupteur : l'administrateur croit avoir réglé quelque chose.
          disabled={!type.reglable}
          value={actifDe(type) ? "propose" : "masque"}
          onChange={(e) =>
            setOccasions((courant) => ({ ...courant, [type.id]: e.target.value === "propose" }))
          }
        >
          <option value="propose">{t.parametres.occasions.etats.propose}</option>
          <option value="masque">{t.parametres.occasions.etats.masque}</option>
        </select>
      ),
    },
  ];

  const pied = (
    <div className="gabarit-form-pied">
      {/* Le rôle retire : le support lit les configurations, il ne les change pas. */}
      <RoleGate role={role} autorise="admin">
        <Button disabled={!valide} onClick={enregistrer}>
          {t.parametres.enregistrer}
        </Button>
        <Button variant="text" onClick={() => onRetour?.("tableau")}>
          {t.parametres.annuler}
        </Button>
      </RoleGate>
      <span className="gabarit-mention">{t.parametres.journal}</span>
    </div>
  );

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: t.parametres.titre }]}
        libelle={t.fil.libelle}
        onNavigate={(id) => onRetour?.(id)}
      />

      <PageHeader
        titre={t.parametres.titre}
        sous={onglet === "economie" ? t.parametres.sous : t.parametres.occasions.sous}
      />

      {arret ? (
        <ArretPourIntervention
          t={t}
          langue={langue}
          etat={arret}
          {...(onArreter ? { onArreter } : {})}
          {...(onRouvrir ? { onRouvrir } : {})}
        />
      ) : null}

      <PageTabs
        actif={onglet}
        onSelect={(id) => setOnglet(id as Onglet)}
        onglets={[
          { id: "economie", label: t.parametres.onglets.economie },
          { id: "occasions", label: t.parametres.onglets.occasions, compte: reference.typesEvenement.length },
        ]}
      />

      {onglet === "economie" ? (
        <div className="gabarit-form">
          {reglages.map((parametre) => {
            const saisie = saisieDe(parametre);
            const champId = `config-${parametre.cle}`;
            return (
              <FormRow
                key={parametre.cle}
                champId={champId}
                label={dire(t, parametre.cle).libelle}
                aide={dire(t, parametre.cle).aide ?? ""}
                erreur={invalide(parametre, saisie) ? t.parametres.erreurEntier : ""}
                precedente={
                  parametre.valeurPrecedente === null
                    ? null
                    : t.parametres.precedente.replace(
                        "{valeur}",
                        avecUnite(parametre.valeurPrecedente, dire(t, parametre.cle).unite),
                      )
                }
              >
                <input
                  id={champId}
                  className="admin-champ admin-focus gabarit-saisie"
                  inputMode={estNumerique(parametre) ? "numeric" : "text"}
                  value={saisie}
                  aria-invalid={invalide(parametre, saisie) || undefined}
                  onChange={(e) =>
                    setSaisies((courant) => ({ ...courant, [parametre.cle]: e.target.value }))
                  }
                />
              </FormRow>
            );
          })}
          {pied}
        </div>
      ) : (
        <div className="gabarit-form">
          <DataTable colonnes={colonnes} lignes={reference.typesEvenement} />
          {reference.typesEvenement.every((type) => !type.reglable) ? (
            <p className="gabarit-note">{t.parametres.nonReglable}</p>
          ) : null}
          <p className="gabarit-note">{t.parametres.occasions.noteSensible}</p>
          {pied}
        </div>
      )}

      {demandeMotif ? (
        <ConfirmWithReason
          titre={t.parametres.motif.titre}
          consequence={t.parametres.motif.consequence}
          motifs={[...t.parametres.motif.motifs]}
          libelles={{
            motif: t.parametres.motif.question,
            choisir: t.confirmation.motifManquant,
            autre: t.confirmation.autre,
            precision: t.confirmation.autrePlaceholder,
            journal: t.confirmation.motifAide,
            annuler: t.confirmation.annuler,
            confirmer: t.confirmation.confirmer,
          }}
          onAnnuler={() => setDemandeMotif(false)}
          onConfirmer={confirmer}
        />
      ) : null}

      {accuse ? (
        <Toast libelleFermer={t.commun.fermer} onDismiss={() => setAccuse(null)}>
          {accuse}
        </Toast>
      ) : null}
    </>
  );
}
