import type { ReactNode } from "react";

// La pastille est le dessin du palier 28 px, employé à sa taille : chaque palier
// de la marque est un tracé distinct, et réduire un grand donne un trait plus fin
// que le dessin prévu (images/brand/README.md).
export function Marque(
  { alt, taille = 28, mot = 24 }: { alt: string; taille?: number; mot?: number },
): ReactNode {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <img
        src="/brand/lehno-favicon-28.svg"
        alt={alt}
        width={taille}
        height={taille}
        style={{ display: "block", flex: "none" }}
      />
      <span
        className="titre ent-mot"
        style={{ fontWeight: 500, fontSize: mot, letterSpacing: "-.02em" }}
        aria-hidden="true"
      >
        Le<span style={{ color: "var(--violet)" }}>h</span>no
      </span>
    </span>
  );
}
