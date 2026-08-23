import type { ReactNode } from "react";

// Le cadre de téléphone de la maquette, réduit à ce qu'il montre : une plaque, un
// écran, l'encoche et la barre d'accueil. Aucune ombre — la profondeur vient du filet.
export function Telephone({ children }: { children: ReactNode }): ReactNode {
  return (
    <div
      style={{
        width: 330, maxWidth: "100%", height: 684, borderRadius: 44, padding: 10,
        background: "var(--band)", flex: "none", position: "relative",
      }}
    >
      <div
        style={{
          position: "relative", width: "100%", height: "100%", borderRadius: 35,
          overflow: "hidden", background: "var(--bg)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
            width: 104, height: 26, borderRadius: 999, background: "var(--band)", zIndex: 2,
          }}
        />
        {children}
        <div
          aria-hidden="true"
          style={{
            position: "absolute", bottom: 7, left: "50%", transform: "translateX(-50%)",
            width: 116, height: 4, borderRadius: 999, background: "var(--edge)", zIndex: 2,
          }}
        />
      </div>
    </div>
  );
}
