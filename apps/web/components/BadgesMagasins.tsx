import type { ReactNode } from "react";
import type { Langue } from "../lib/langues.js";
import type { Messages } from "../messages/index.js";

// Le badge Apple existe en noir et en blanc : le noir sur fond clair, le blanc sur
// fond sombre. Le thème n'étant connu qu'au navigateur, les deux sont rendus et le
// thème posé sur <html> en cache un — même procédé que la bascule.
// Google Play ne fournit qu'un seul dessin par langue, qui tient sur les deux fonds.
export function BadgesMagasins(
  { t, langue, surBande = false }: { t: Messages; langue: Langue; surBande?: boolean },
): ReactNode {
  const apple = (variante: "noir" | "blanc"): string => `/badges/appstore-${langue}-${variante}.svg`;
  const hauteur = 45;

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <a href="#" style={{ display: "block", lineHeight: 0 }}>
        {surBande ? (
          <img src={apple("blanc")} alt={t.altApple} height={hauteur} style={{ display: "block", height: hauteur, width: "auto" }} />
        ) : (
          <>
            <img className="si-clair" src={apple("noir")} alt={t.altApple} height={hauteur} style={{ height: hauteur, width: "auto" }} />
            <img className="si-sombre" src={apple("blanc")} alt={t.altApple} height={hauteur} style={{ height: hauteur, width: "auto" }} />
          </>
        )}
      </a>
      <a href="#" style={{ display: "block", lineHeight: 0 }}>
        <img src={`/badges/googleplay-${langue}.png`} alt={t.altGoogle} height={hauteur} style={{ display: "block", height: hauteur, width: "auto" }} />
      </a>
    </div>
  );
}
