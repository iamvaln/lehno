import type { ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { BadgesMagasins } from "../BadgesMagasins.js";

// L'aplat de clôture quitte l'encre pour le violet profond en thème sombre —
// c'est @lehno/tokens qui le décide, sous le rôle « band ». L'abricot du bouton
// avant-lancement porte un moment heureux (l'inscription, pas encore ouverte) ;
// jamais le violet d'action, déjà réservé au formulaire du héros.
export function ClosingBand(
  { t, langue, avantLancement }: { t: Messages; langue: Langue; avantLancement: boolean },
): ReactNode {
  return (
    <section style={{ background: "var(--surface-band)", color: "var(--on-band)" }}>
      <div
        style={{
          maxWidth: "var(--page-max)", margin: "0 auto", padding: "clamp(52px,8vw,88px) var(--page-gutter)",
          // Flex et non grille : la maquette veut un titre qui prend toute la
          // largeur disponible et une action qui se serre à droite, alignés
          // par le bas. Une grille en colonnes égales bridait le titre à la
          // moitié de la bande et le recentrait — c'est ce qui se voyait.
          display: "flex", gap: "clamp(28px,5vw,64px)",
          alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap",
        }}
      >
        <h2
          className="titre"
          style={{
            fontWeight: "var(--font-display-medium)", fontSize: "clamp(34px,6vw,60px)", lineHeight: "var(--leading-display)",
            letterSpacing: "var(--tracking-display)", margin: 0,
            flex: "1 1 0", minWidth: 0, textWrap: "balance",
          }}
        >
          {t.finTitre}
        </h2>
        <div
          style={{
            display: "flex", gap: "var(--space-14)", alignItems: "center",
            flexWrap: "nowrap", flex: "0 0 auto",
          }}
        >
          {avantLancement ? (
            <a
              href={`/${langue}#commencer`}
              style={{
                // La maquette donne 16px/30px, rayon 12, texte 17 : une action
                // de clôture est plus grosse qu'un bouton de formulaire.
                background: "var(--celebrate)", color: "var(--on-celebrate)", padding: "var(--space-16) var(--space-32)",
                borderRadius: "var(--radius-md)", fontWeight: "var(--font-body-bold)", fontSize: "var(--text-body-l)",
                textDecoration: "none", fontFamily: "var(--font-body)",
              }}
            >
              {t.cta}
            </a>
          ) : (
            <BadgesMagasins t={t} langue={langue} surBande />
          )}
        </div>
      </div>
    </section>
  );
}
