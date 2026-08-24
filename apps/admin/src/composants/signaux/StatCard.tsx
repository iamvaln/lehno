import type { ReactNode } from "react";

/** Le sens d'une variation, tel que le rend `indicateurSchema` — pas sa couleur :
 *  une hausse d'échecs n'est pas une bonne nouvelle, c'est la page qui tranche. */
export type SensVariation = "hausse" | "baisse" | "neutre";

export interface StatCardProps {
  /** Le chiffre, déjà formaté par l'appelant : le composant ne met rien en forme. */
  valeur: ReactNode;
  libelle: string;
  /** La variation, déjà formulée : « +38 ce mois ». */
  variation?: ReactNode;
  sens?: SensVariation;
  /** Un chiffre du tableau de bord mène à la section qui l'explique. */
  onClick?: () => void;
}

/** Un indicateur du tableau de bord : un chiffre, son libellé, sa variation —
 *  rien d'autre. Le détail vit dans la section, et le clic y mène.
 *
 *  Le sens descend en attribut, jamais en couleur écrite en ligne : la teinte se
 *  décide dans signaux.css, où elle peut différer entre le thème clair et le
 *  thème sombre sans que le composant connaisse un seul jeton. */
export function StatCard({ valeur, libelle, variation, sens = "neutre", onClick }: StatCardProps) {
  const contenu = (
    <>
      <span className="admin-stat-libelle">{libelle}</span>
      <span className="admin-stat-valeur">{valeur}</span>
      {variation != null ? (
        <span className="admin-stat-variation" data-sens={sens}>{variation}</span>
      ) : null}
    </>
  );

  // Un chiffre qui mène quelque part est un bouton, pas une carte au curseur
  // changé : il s'atteint au clavier et s'annonce comme une commande.
  if (!onClick) return <div className="admin-stat">{contenu}</div>;

  return (
    <button type="button" className="admin-stat admin-focus" data-cliquable="true" onClick={onClick}>
      {contenu}
    </button>
  );
}
