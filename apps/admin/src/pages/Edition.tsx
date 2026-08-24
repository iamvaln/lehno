import { useState, type ReactNode } from "react";
import type { AdminRole, Parametre, Parametres } from "@lehno/contracts";
import { Breadcrumb, FormRow, PageHeader, PageTabs } from "../composants/page/index.js";
import { DataTable, type Colonne } from "../composants/donnees/index.js";
import { RoleGate } from "../composants/actions/index.js";
import { Toast } from "../composants/signaux/index.js";
import { Button } from "../composants/base/index.js";
import { messages, type Langue } from "../i18n/index.js";
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

export interface EditionProps {
  role: AdminRole;
  langue?: Langue;
  parametres?: Parametres;
  onEnregistrer?: (valeurs: Parametres) => void;
  onRetour?: (id?: string) => void;
}

function avecUnite(valeur: string | number, unite: string | null): string {
  return unite === null ? String(valeur) : `${valeur} ${unite}`;
}

// Un réglage numérique ne se laisse pas vider ni mettre à zéro : le contrôle est
// le même que celui du serveur, et il se lit sous le champ, pas après l'appel.
function invalide(parametre: Parametre, saisie: string): boolean {
  if (typeof parametre.valeur !== "number") return saisie.trim() === "";
  return !ENTIER_POSITIF.test(saisie.trim()) || Number(saisie) <= 0;
}

export function Edition({
  role,
  langue = "fr",
  parametres = parametresDemo,
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

  const saisieDe = (parametre: Parametre) => saisies[parametre.cle] ?? String(parametre.valeur);
  const actifDe = (type: TypeOccasion) => occasions[type.id] ?? type.actif;

  const valide = reference.economie.every((p) => !invalide(p, saisieDe(p)));
  const modifie =
    reference.economie.some((p) => saisieDe(p) !== String(p.valeur)) ||
    reference.typesEvenement.some((type) => actifDe(type) !== type.actif);

  // Rien ne part avant ce geste. La valeur qu'on quitte devient la valeur
  // précédente : c'est ce que le prochain écran rappellera.
  const enregistrer = () => {
    if (!valide) return;
    if (!modifie) {
      setAccuse(t.parametres.rienAEnregistrer);
      return;
    }
    const valeurs: Parametres = {
      economie: reference.economie.map((p) => ({
        ...p,
        valeur: typeof p.valeur === "number" ? Number(saisieDe(p)) : saisieDe(p),
        valeurPrecedente: p.valeur,
      })),
      typesEvenement: reference.typesEvenement.map((type) => ({ ...type, actif: actifDe(type) })),
    };
    setReference(valeurs);
    onEnregistrer?.(valeurs);
    setAccuse(t.parametres.enregistre);
  };

  const colonnes: Colonne<TypeOccasion>[] = [
    { cle: "libelle", titre: t.parametres.occasions.col.nom },
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
          aria-label={type.libelle}
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
          {reference.economie.map((parametre) => {
            const saisie = saisieDe(parametre);
            const champId = `config-${parametre.cle}`;
            return (
              <FormRow
                key={parametre.cle}
                champId={champId}
                label={parametre.libelle}
                aide={parametre.aide ?? ""}
                erreur={invalide(parametre, saisie) ? t.parametres.erreurEntier : ""}
                precedente={
                  parametre.valeurPrecedente === null
                    ? null
                    : t.parametres.precedente.replace(
                        "{valeur}",
                        avecUnite(parametre.valeurPrecedente, parametre.unite),
                      )
                }
              >
                <input
                  id={champId}
                  className="admin-champ admin-focus gabarit-saisie"
                  inputMode={typeof parametre.valeur === "number" ? "numeric" : "text"}
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
          <p className="gabarit-note">{t.parametres.occasions.noteSensible}</p>
          {pied}
        </div>
      )}

      {accuse ? (
        <Toast libelleFermer={t.commun.fermer} onDismiss={() => setAccuse(null)}>
          {accuse}
        </Toast>
      ) : null}
    </>
  );
}
