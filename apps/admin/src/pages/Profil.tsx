import { useState, type ReactNode } from "react";
import type { ProfilAdmin } from "@lehno/contracts";

import { Button } from "../composants/base/index.js";
import { PageHeader } from "../composants/page/index.js";
import { DataTable, EmptyState, StatusPill, type Colonne } from "../composants/donnees/index.js";
import { messages, type Langue } from "../i18n/index.js";

/* Mon profil — le compte connecté. Quatre choses, et rien d'autre : qui l'on
 * est, ce que le rôle ouvre, comment on est entré, et où le compte est ouvert
 * en ce moment.
 *
 * « Ce que ce rôle ouvre » se dit en clair — « Comptes, crédits, modération,
 * demandes de suppression » —, jamais en liste de permissions techniques :
 * personne ne lit `suppressions:write`, et une liste de codes ne dit pas ce
 * qu'on a le droit de faire.
 *
 * Fermer les autres sessions **remonte à l'appelant** : la page ne connaît
 * aucun serveur. Elle retire les lignes fermées de ce qu'elle montre, parce
 * qu'un tableau qui garde une session révoquée ment sur l'état du compte.
 */

type Session = ProfilAdmin["sessions"][number];

export interface ProfilProps {
  /**
   * Le compte connecté, tel que le serveur le rend.
   *
   * **Exigé, sans valeur par défaut.** L'écran a rendu une fixture pendant tout
   * le premier lot — un e-mail, un rôle et des sessions inventés, avec leurs
   * adresses IP — parce qu'un défaut de props la fournissait et que l'appelant
   * l'avait oublié. Un compte est ce que le serveur en dit, ou l'écran ne se
   * construit pas.
   */
  profil: ProfilAdmin;
  langue?: Langue;
  /** Les sessions fermées, dans l'ordre du tableau. À l'appelant de les révoquer. */
  onFermerSessions?: (ids: string[]) => void;
}

/** Un champ en lecture : la clé au-dessus, la valeur en dessous. Même forme que
 *  les champs d'un détail — c'est la même lecture. */
function Champ({ cle, valeur }: { cle: string; valeur: string }) {
  return (
    <div className="gabarit-champ">
      <div className="gabarit-champ-cle">{cle}</div>
      <div className="gabarit-champ-valeur">{valeur}</div>
    </div>
  );
}

export function Profil({ profil, langue = "fr", onFermerSessions }: ProfilProps): ReactNode {
  const t = messages(langue);
  const [fermees, setFermees] = useState<string[]>([]);

  const visibles = profil.sessions.filter((session) => !fermees.includes(session.id));
  const autres = visibles.filter((session) => !session.courante);
  const libelleRole = profil.role === "admin" ? t.barre.roleAdmin : t.barre.roleSupport;

  // Une session ouverte avant qu'on trace l'appareil ou l'adresse n'en porte
  // pas. On écrit un tiret : une case vide se lit comme un défaut d'affichage,
  // et inventer une valeur serait pire que les deux.
  const dire = (valeur: string | null): string => valeur ?? t.profil.inconnu;

  const colonnes: Colonne<Session>[] = [
    {
      cle: "appareil",
      titre: t.profil.col.appareil,
      rendu: (session) =>
        session.courante ? (
          <>
            {dire(session.appareil)} <StatusPill ton="actif">{t.profil.ici}</StatusPill>
          </>
        ) : (
          dire(session.appareil)
        ),
    },
    { cle: "ip", titre: t.profil.col.ip, discret: true, largeur: 150, rendu: (session) => dire(session.ip) },
    { cle: "depuis", titre: t.profil.col.depuis, discret: true, aligne: "right", largeur: 170 },
  ];

  const fermer = () => {
    const ids = autres.map((session) => session.id);
    setFermees((deja) => [...deja, ...ids]);
    onFermerSessions?.(ids);
  };

  return (
    <>
      <PageHeader titre={t.profil.titre} sous={profil.email} />

      <div className="gabarit-groupes">
        <div className="gabarit-groupe">
          <h2 className="gabarit-groupe-titre">{t.profil.groupes.compte}</h2>
          <Champ cle={t.profil.champs.email} valeur={profil.email} />
          {profil.ajoutePar ? <Champ cle={t.profil.champs.ajoutePar} valeur={profil.ajoutePar} /> : null}
          {profil.derniereConnexion ? (
            <Champ cle={t.profil.champs.derniere} valeur={profil.derniereConnexion} />
          ) : null}
        </div>

        <div className="gabarit-groupe">
          <h2 className="gabarit-groupe-titre">{t.profil.groupes.acces}</h2>
          <Champ cle={t.profil.champs.role} valeur={libelleRole} />
          <Champ cle={t.profil.champs.portee} valeur={t.profil.portee[profil.role]} />
          <Champ cle={t.profil.champs.methode} valeur={t.profil.methode} />
        </div>
      </div>

      <h2 className="gabarit-groupe-titre">{t.profil.sessionsTitre}</h2>
      <DataTable
        colonnes={colonnes}
        lignes={visibles}
        vide={<EmptyState titre={t.profil.vide.titre} texte={t.profil.vide.texte} />}
      />

      {autres.length > 0 ? (
        // La conséquence se lit avant le clic, pas après : on sait ce qu'on
        // engage — les autres appareils devront se reconnecter.
        <div className="gabarit-form-pied">
          <Button variant="outline" onClick={fermer}>
            {t.profil.fermer}
          </Button>
          <span className="gabarit-mention">{t.profil.fermees}</span>
        </div>
      ) : (
        // Rien à fermer : l'écran dit ce qui est, plutôt que d'offrir un bouton
        // qui ne ferait rien.
        <div className="gabarit-pied">
          <EmptyState titre={t.profil.vide.titre} texte={t.profil.vide.texte} />
        </div>
      )}
    </>
  );
}
