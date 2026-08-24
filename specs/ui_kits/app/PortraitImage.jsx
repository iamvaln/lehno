import React from "react";

/* L'image du portrait — l'objet que Lehno compose et qu'on partage comme
   fichier, pas comme lien.

   Ce n'est pas un paragraphe mis en page : c'est un graphique. Des formes
   colorées se superposent en transparence, le prénom occupe le centre, les
   mots tirés des notes se dispersent à des tailles et des couleurs
   différentes — leur variété EST le portrait, elle dit que la personne ne
   tient pas dans une seule ligne. La phrase et la signature ne viennent qu'en
   pied, séparées d'un filet.

   Exception assumée à la palette : cette image élargit les cinq couleurs de la
   charte à un vert, un bleu et un ocre. Elle vit hors application — c'est le
   même régime que les motifs, et la seule surface où la marque s'autorise plus
   de deux teintes. Dans l'interface, la règle reste entière. */

export const PALETTE_PORTRAIT = {
  fond: "#FBEDE9",
  formes: ["#E8A896", "#A8CFC0", "#F2C48B", "#B3B7DE"],
  mots: ["#C4562A", "#9A7B1F", "#A8324B", "#3B3F8F", "#2F7D5B", "#7A6A60"],
  nom: "#5C2C1C",
  texte: "#7A6A60"
};

/* Chaque mot a sa taille, son angle et sa place : une grille les alignerait,
   et l'image redeviendrait une liste. */
const POSES = [
  { x: 8, y: 46, taille: 1.00, rot: -7 },
  { x: 56, y: 44, taille: 0.92, rot: 3 },
  { x: 44, y: 56, taille: 1.30, rot: -2 },
  { x: 12, y: 60, taille: 0.86, rot: 4 },
  { x: 68, y: 58, taille: 0.74, rot: -5 },
  { x: 18, y: 70, taille: 0.80, rot: 0, italique: true }
];

/* « signature » est le nom de qui offre, non une formule : « comment je te
   vois » a été retiré du produit. */
export function PortraitImage({ t, nom = "Karim", annee = 2026, signature, style }) {
  const P = PALETTE_PORTRAIT;
  const mots = t.portraitMots || [];

  return (
    <div style={{
      position: "relative", aspectRatio: "4 / 5", width: "100%",
      background: P.fond, borderRadius: "var(--radius-xl)", overflow: "hidden",
      containerType: "inline-size", ...style
    }}>
      {/* Les formes : trois ellipses qui se chevauchent, plus deux points qui
          cassent la symétrie. La transparence fait les couleurs mêlées. */}
      <svg viewBox="0 0 100 125" width="100%" height="100%" aria-hidden="true"
        style={{ position: "absolute", inset: 0 }}>
        <ellipse cx="41" cy="26" rx="33" ry="25" fill={P.formes[0]} opacity=".72" />
        <ellipse cx="66" cy="24" rx="24" ry="24" fill={P.formes[1]} opacity=".62" />
        <ellipse cx="46" cy="38" rx="26" ry="19" fill={P.formes[2]} opacity=".62" />
        <ellipse cx="70" cy="41" rx="14" ry="14" fill={P.formes[3]} opacity=".58" />
        <circle cx="24" cy="21" r="2.4" fill={P.mots[0]} opacity=".8" />
        <circle cx="66" cy="19" r="2" fill={P.formes[1]} opacity=".95" />
      </svg>

      {/* Le prénom, au centre et en grand : c'est de cette personne qu'il
          s'agit, et l'image le dit avant tout le reste. */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: "26%",
        textAlign: "center", fontFamily: "var(--font-display)",
        fontVariationSettings: "var(--font-display-settings)",
        fontWeight: 400, fontSize: "18cqw", lineHeight: 1,
        letterSpacing: "-.02em", color: P.nom
      }}>{nom}</div>

      {/* Les mots des notes, dispersés. */}
      {mots.map((m, i) => {
        const p = POSES[i] || POSES[POSES.length - 1];
        return (
          <div key={m} style={{
            position: "absolute", left: p.x + "%", top: p.y + "%",
            fontFamily: "var(--font-display)",
            fontVariationSettings: "var(--font-display-settings)",
            fontStyle: p.italique ? "italic" : "normal",
            fontWeight: 400, fontSize: (p.taille * 6.6) + "cqw", lineHeight: 1,
            color: P.mots[i % P.mots.length],
            transform: "rotate(" + p.rot + "deg)", whiteSpace: "nowrap"
          }}>{m}</div>
        );
      })}

      {/* Le pied : un filet, la phrase, la signature. */}
      <div style={{
        position: "absolute", left: "10%", right: "10%", bottom: "7%", textAlign: "center"
      }}>
        <div style={{ height: 1, background: "rgba(122,106,96,.34)", marginBottom: "6cqw" }} />
        <div style={{
          fontFamily: "var(--font-display)",
          fontVariationSettings: "var(--font-display-settings)",
          fontStyle: "italic", fontWeight: 500, fontSize: "6.4cqw",
          color: P.nom, lineHeight: 1.3
        }}>{t.portraitPhrase}</div>
        {signature ? (
          <div style={{
            fontFamily: "var(--font-body)", fontSize: "4cqw",
            color: P.texte, marginTop: "3.4cqw"
          }}>{signature}{annee ? " · " + annee : ""}</div>
        ) : null}
      </div>
    </div>
  );
}
