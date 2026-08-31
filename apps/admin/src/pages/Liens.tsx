import type { ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { Icon } from "../composants/base/index.js";
import { LIENS } from "../liens.js";
import { messages, type Langue } from "../i18n/index.js";

/**
 * Les liens externes — ux-admin §5.14.
 *
 * La seule page de l'outil qui n'appelle pas le serveur : elle rend un registre
 * tenu dans le code. Pas d'état de chargement, pas d'erreur, pas de vide — la
 * liste est là ou l'outil ne se construit pas.
 *
 * **Chaque lien sort de l'outil.** Il s'ouvre donc dans un nouvel onglet, pour
 * ne pas emporter une session de travail en cours, et avec `rel="noreferrer"` :
 * la page ouverte n'a pas à savoir d'où l'on vient, ni à garder une poignée sur
 * la fenêtre qu'elle quitte. Le nom accessible du lien dit qu'il ouvre ailleurs,
 * sans quoi rien ne l'annoncerait à qui ne voit pas l'icône.
 *
 * Ouverte au support : « consulter le tableau de bord, les métriques, les
 * connexions et les liens externes » (§6). Aucune action, donc aucun rôle à
 * distinguer — c'est une page de portes, pas de gestes.
 */
export interface LiensProps {
  langue?: Langue;
  onRetour?: (id: string) => void;
}

export function Liens({ langue = "fr", onRetour }: LiensProps): ReactNode {
  const t = messages(langue);

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: t.liens.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader titre={t.liens.titre} sous={t.liens.sous} />

      {/* Ce que ces liens ne sont pas, dit une fois pour toutes plutôt que
          répété sous chacun : ils ne donnent aucun accès par eux-mêmes. */}
      <p className="admin-liens-note">{t.liens.horsOutil}</p>

      {LIENS.map(({ groupe, entrees }) => (
        <section
          key={groupe}
          className="admin-liens-groupe"
          aria-labelledby={`liens-${groupe}`}
        >
          <h2 id={`liens-${groupe}`} className="admin-liens-titre">
            {t.liens.groupes[groupe]}
          </h2>
          <ul className="admin-liens-liste">
            {entrees.map(({ cle, nom, url }) => (
              <li key={cle} className="admin-liens-entree">
                <a
                  className="admin-liens-lien"
                  href={url}
                  target="_blank"
                  // « noreferrer » emporte « noopener » ; on garde les deux,
                  // le second seul étant honoré par de vieux moteurs.
                  rel="noopener noreferrer"
                  aria-label={t.liens.ouvrir.replace("{nom}", nom)}
                >
                  <span className="admin-liens-nom">{nom}</span>
                  <Icon name="external-link" size={17} />
                </a>
                <p className="admin-liens-usage">
                  {t.liens.usages[cle as keyof typeof t.liens.usages]}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
