import type { ReactNode } from "react";
import type { Langue } from "../lib/langues";
import type { Messages } from "../messages";
import { BadgesMagasins } from "./BadgesMagasins";

// L'aplat de clôture quitte l'encre pour le violet profond en thème sombre — c'est
// @lehno/tokens qui le décide, sous le rôle « band ». L'encre ne tranche pas sur l'encre.
export function Cloture(
  { t, langue, avantLancement }: { t: Messages; langue: Langue; avantLancement: boolean },
): ReactNode {
  return (
    <section style={{ background: "var(--band)", color: "var(--on-band)" }}>
      <div
        style={{
          maxWidth: 1160, margin: "0 auto", padding: "clamp(52px,8vw,88px) 20px",
          display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: "clamp(28px,4vw,56px)", alignItems: "center",
        }}
      >
        <h2 className="titre" style={{ fontWeight: 500, fontSize: "clamp(32px,5vw,52px)", lineHeight: 1.06, letterSpacing: "-.032em", margin: 0, maxWidth: "20ch", textWrap: "balance" }}>
          {t.finTitre}
        </h2>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          {avantLancement ? (
            <a
              href="#commencer"
              style={{
                background: "var(--apricot)", color: "var(--on-apricot)", padding: "12px 20px",
                borderRadius: 10, fontWeight: 700, fontSize: 15,
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
