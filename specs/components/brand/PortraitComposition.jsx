import React from "react";
import { Wordmark } from "./Wordmark.jsx";

/* Le portrait — l'image qu'on compose pour un proche et qu'on lui envoie.
 *
 * TROIS GABARITS, un par voie d'image (spec §3). Ils partagent la bande basse
 * et le pied de marque ; ce qui change, c'est ce qui occupe le haut.
 *
 *   illustration — l'illustration en haut, la bande basse porte le texte
 *   photo        — même structure, le traitement remplace l'illustration
 *   aucune       — le motif prend TOUT le fond, le texte respire dessus.
 *                  C'est le gabarit le plus typographique : une affiche.
 *
 * DEUX MOTIFS, JAMAIS LES DEUX SUR UN MÊME PORTRAIT (§3.4) :
 *   la trame de hampes dans la bande — le seul motif qui accepte du texte
 *   par-dessus ; les registres en fond plein du gabarit sans image — le seul
 *   qui ait quelque chose à dire, une suite qui revient.
 *
 * L'ORDRE DE LA BANDE est fixé par le §3.5, et il n'est pas négociable : le nom
 * du proche, le message, la note de l'expéditeur, le pied de marque. Le nom
 * d'abord parce que c'est de cette personne qu'il s'agit ; le pied en dernier
 * parce que le portrait appartient à celui qui l'offre.
 *
 * LE FORMAT VERTICAL PREND LA VERSION COURTE du message (§4.1) — dix à quinze
 * mots. Agrandir le texte long dans un cadre haut le ferait déborder ; la
 * génération produit donc deux longueurs, et le gabarit choisit.
 *
 * L'HOMMAGE EST À PART (§2.1) : il neutralise l'abricot et écarte toute
 * illustration vive. Une occasion sensible ne peut pas partager le gabarit
 * d'une déclaration de fierté.
 */

export const AMBIANCES = {
  papier: {
    nom: "Papier",
    fond: "#FFFFFF",
    bande: "#FFFFFF",
    motif: "rgba(123,107,183,.22)",
    voile: "rgba(255,255,255,.62)",
    illustration: ["#EDEAF7", "#7B6BB7", "#F0CFB4", "#5A4B93"],
    titre: "#221F2B",
    message: "#221F2B",
    mention: "#6B6579",
    filet: "#EDEBF2",
    marque: "couleur"
  },
  lilas: {
    nom: "Lilas",
    fond: "#EDEAF7",
    bande: "#FBFAFE",
    motif: "rgba(90,75,147,.24)",
    voile: "rgba(251,250,254,.6)",
    illustration: ["#E2DDF0", "#5A4B93", "#F0CFB4", "#7B6BB7"],
    titre: "#221F2B",
    message: "#221F2B",
    mention: "#6B6579",
    filet: "#E2DDF0",
    marque: "couleur"
  },
  encre: {
    nom: "Encre",
    fond: "#221F2B",
    bande: "#17161F",
    motif: "rgba(240,207,180,.26)",
    voile: "rgba(23,22,31,.58)",
    illustration: ["#3A3348", "#9C8BD8", "#F0CFB4", "#5A4B93"],
    titre: "#FFFFFF",
    message: "#FFFFFF",
    mention: "#B9B4C6",
    filet: "#3D3757",
    marque: "blanc"
  }
};

/* Deux formats seulement (§3.6) : le carré est la référence, le vertical en
   dérive. Pas d'aperçu de lien — le portrait ne s'expose sur aucune page. */
export const FORMATS = {
  carre: { nom: "Carré", ratio: "1 / 1", export: "1080 × 1080" },
  story: { nom: "Story", ratio: "9 / 16", export: "1080 × 1920" }
};

export const VOIES = ["illustration", "photo", "aucune"];
export const FAMILLES = ["nature", "animal", "abstrait"];
export const STYLES_PHOTO = ["lumiere", "serigraphie", "silhouette"];

/* Les bornes du nom, exportées : la planche les affiche au lieu de les
   recopier. Une prose qui répète des nombres finit toujours par les démentir. */
export const BORNES_NOM = { hautCar: 5, haut: 11.5, basCar: 20, bas: 6.4 };

export function tailleNom(nom) {
  const n = (nom || "").length;
  const B = BORNES_NOM;
  if (n <= B.hautCar) return B.haut;
  if (n >= B.basCar) return B.bas;
  return B.haut - ((n - B.hautCar) / (B.basCar - B.hautCar)) * (B.haut - B.bas);
}

export const PALIERS_MESSAGE = [
  { jusqua: 16, base: 6.4 },
  { jusqua: 30, base: 5.2 },
  { jusqua: 46, base: 4.4 },
  { jusqua: Infinity, base: 3.8 }
];

export function tailleMessage(message) {
  const mots = String(message || "").trim().split(/\s+/).filter(Boolean).length;
  const p = PALIERS_MESSAGE.find((x) => mots <= x.jusqua) || PALIERS_MESSAGE[PALIERS_MESSAGE.length - 1];
  return p.base;
}

/* La trame de hampes : le seul motif qui accepte du texte par-dessus. */
function Trame({ A, id }) {
  return (
    <svg width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true"
      style={{ position: "absolute", inset: 0 }}>
      <defs>
        <pattern id={id} width="22" height="26" patternUnits="userSpaceOnUse">
          <rect x="9" y="3" width="3" height="20" rx="1.5" fill={A.motif} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={"url(#" + id + ")"} />
    </svg>
  );
}

/* Les registres : une suite qui revient. Fond plein du gabarit sans image. */
function Registres({ A, id }) {
  return (
    <svg width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true"
      style={{ position: "absolute", inset: 0 }}>
      <defs>
        <pattern id={id} width="100" height="20" patternUnits="userSpaceOnUse">
          <rect y="18.4" width="100" height="1.6" fill={A.motif} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={"url(#" + id + ")"} />
    </svg>
  );
}

/* L'illustration — trois ou quatre éléments au plus, une scène et non un
   catalogue, aucun visage, aucun symbole d'occasion (§4.2).

   ELLE EST TRACÉE POUR UNE BANDE LARGE, pas pour un carré. La zone qu'elle
   occupe fait entre 2,6 et 4 de ratio, et sa hauteur varie avec la longueur du
   message — un dessin en viewBox carré s'y faisait couper de moitié, horizon
   compris. Le viewBox est donc large (100 × 30) et le sujet vit entre y=3 et
   y=27 : ce qui déborde au rognage n'est jamais ce qui porte la scène.

   PAS DE ZONE CALME DANS LE TRACÉ : la bande la fournit. Un horizon bas dans
   l'illustration serait mangé par la bande elle-même.

   La grammaire est celle de « Illustration.jsx » — aplats pleins, aucun
   contour, aucune ombre, trois rôles de couleur : la masse, le remplissage, et
   l'accent qui ne fait jamais masse. */
function SceneIllustree({ A, famille, sensible }) {
  const [clair, moyen, accent, profond] = A.illustration;
  /* Pour un hommage, l'accent chaud cède : palette froide, rien de vif. */
  const vif = sensible ? profond : accent;

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
      style={{ display: "block", width: "100%", height: "100%" }}>
      <rect width="100" height="30" fill={clair} />

      {famille === "nature" ? (
        <>
          {/* Un relief et un astre : deux éléments, une scène. Le relief monte
              du bas du cadre, l'astre respire à droite. */}
          <path d="M0 30 q18 -17 34 -6 q14 -12 28 1 q12 -9 22 5 v6 Z" fill={moyen} />
          <path d="M30 30 q14 -12 26 -3 q10 -8 20 3 v0 Z" fill={profond} opacity=".85" />
          <circle cx="76" cy="9" r="5.4" fill={vif} />
        </>
      ) : famille === "animal" ? (
        <>
          {/* Une silhouette, jamais un visage. Elle se tient sur une ligne de
              sol qui la pose sans dessiner de décor. */}
          <rect y="26" width="100" height="4" fill={moyen} />
          <path d="M38 26 q-1 -9 5 -11 q1 -5 4 -1.6 q2.4 -3.4 3.6 1.6 q6 1.4 5 11 Z" fill={profond} />
          <path d="M51 21 q7 -1.4 9 -6 q1.4 4 -2 6 Z" fill={profond} />
          <circle cx="20" cy="10" r="4.6" fill={vif} />
          <path d="M64 26 q8 -6 16 -2 q6 -4 12 2 Z" fill={moyen} />
        </>
      ) : (
        <>
          {/* Un mouvement et une lumière — pour qui échappe aux deux autres.
              Des arcs qui se recouvrent, sans rien figurer. */}
          <path d="M0 30 a34 34 0 0 1 68 0 Z" fill={moyen} />
          <path d="M26 30 a26 26 0 0 1 52 0 Z" fill={profond} opacity=".9" />
          <circle cx="22" cy="9" r="5" fill={vif} />
        </>
      )}
    </svg>
  );
}

/* La photo : une illustration DÉRIVÉE de la photo, pas un filtre. Les trois
   styles sont des traitements nommés par la marque ; l'utilisateur choisit. */
function Photo({ A, style, src }) {
  const [clair, moyen, accent, profond] = A.illustration;
  const traitements = {
    lumiere: { filter: "grayscale(1) contrast(1.25) brightness(.92)", teinte: profond, mix: "screen", op: 0.55 },
    serigraphie: { filter: "grayscale(1) contrast(2.4)", teinte: moyen, mix: "multiply", op: 0.6 },
    silhouette: { filter: "grayscale(1) contrast(4) brightness(.7)", teinte: profond, mix: "multiply", op: 0.85 }
  };
  const tr = traitements[style] || traitements.silhouette;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: clair, overflow: "hidden" }}>
      {src ? (
        <img src={src} alt="" style={{
          width: "100%", height: "100%", objectFit: "cover", filter: tr.filter
        }} />
      ) : null}
      <div style={{
        position: "absolute", inset: 0, background: tr.teinte,
        mixBlendMode: tr.mix, opacity: tr.op
      }} />
      {style === "lumiere" ? (
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(circle at 62% 34%, " + accent + "55, transparent 58%)"
        }} />
      ) : null}
    </div>
  );
}

export function PortraitComposition({
  nom = "Karim",
  message = "",
  messageCourt,
  note,
  ambiance = "papier",
  format = "carre",
  voie = "illustration",
  famille = "nature",
  stylePhoto = "silhouette",
  photo,
  hommage = false,
  base = "",
  style,
  ...rest
}) {
  const A = AMBIANCES[ambiance] || AMBIANCES.papier;
  const F = FORMATS[format] || FORMATS.carre;
  const story = format === "story";
  const sansImage = voie === "aucune";
  const uid = ambiance + format + voie;

  /* Le vertical prend la version courte : agrandir le texte long dans un cadre
     haut le ferait déborder. */
  const texte = story && messageCourt ? messageCourt : message;
  const tNom = tailleNom(nom) * (story ? 0.82 : 1);
  const tMsg = tailleMessage(texte) * (story ? 0.86 : 1);

  const pied = (
    <div style={{
      display: "flex", alignItems: "center", gap: "2.2cqw", flexWrap: "wrap",
      marginTop: "3cqw", paddingTop: "2.6cqw", borderTop: "1px solid " + A.filet
    }}>
      <Wordmark base={base} variant={A.marque === "blanc" ? "blanc" : "couleur"}
        style={{ flex: "none", opacity: .92, height: (story ? 2.4 : 3.2) + "cqw" }} />
      <span style={{
        fontFamily: "var(--font-body)", fontSize: (story ? 1.8 : 2.3) + "cqw",
        color: A.mention, lineHeight: 1.3
      }}>lehno.app · @lehno.app</span>
    </div>
  );

  /* L'ordre du §3.5 : le nom, le message, la note de l'expéditeur, le pied. */
  const contenu = (
    <>
      <div style={{
        fontFamily: "var(--font-display)",
        fontVariationSettings: "var(--font-display-settings)",
        fontWeight: 500, fontSize: tNom + "cqw", lineHeight: 1.05,
        letterSpacing: "-.025em", color: A.titre, wordBreak: "break-word"
      }}>{nom}</div>

      <p className="lehno-parole" style={{
        margin: "2.6cqw 0 0", fontSize: tMsg + "cqw", lineHeight: 1.42,
        color: A.message, textWrap: "pretty"
      }}>{texte}</p>

      {note ? (
        <div style={{
          fontFamily: "var(--font-body)", fontSize: (story ? 2 : 2.6) + "cqw",
          color: A.mention, marginTop: "2.6cqw"
        }}>{note}</div>
      ) : null}

      {pied}
    </>
  );

  return (
    <div style={{
      position: "relative", width: "100%", aspectRatio: F.ratio,
      background: A.fond, overflow: "hidden", containerType: "inline-size",
      display: "flex", flexDirection: "column", ...style
    }} {...rest}>

      {sansImage ? (
        /* Le gabarit sans image : les registres prennent tout le fond, sous un
           voile plus léger, et le texte respire sur toute la surface. */
        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
          <Registres A={A} id={"reg-" + uid} />
          <div style={{
            position: "absolute", inset: 0,
            background: A.voile.replace(/[\d.]+\)$/, "0.42)")
          }} />
          <div style={{
            position: "relative", flex: 1, display: "flex", flexDirection: "column",
            justifyContent: "center",
            padding: story ? "12cqw 9cqw" : "10cqw 9cqw", boxSizing: "border-box"
          }}>{contenu}</div>
        </div>
      ) : (
        <>
          {/* L'image occupe le haut. Sa part est plus grande en vertical, où le
              cadre en donne les moyens. */}
          {/* L'image cède, la bande non : c'est aussi ce que dit la spec —
              « l'illustration occupe le haut », la bande porte le texte. Un
              plafond, pas une part fixe. */}
          <div style={{
            position: "relative", flex: "1 1 auto", minHeight: 0,
            maxHeight: story ? "44%" : "46%", overflow: "hidden"
          }}>
            {voie === "photo"
              ? <Photo A={A} style={stylePhoto} src={photo} />
              : <SceneIllustree A={A} famille={famille} sensible={hommage} />}
          </div>

          {/* La bande basse : le motif en fond sous un voile qui garantit la
              lisibilité. La trame est le seul motif qui accepte du texte. */}
          <div style={{
            position: "relative", flex: "0 0 auto", background: A.bande,
            display: "flex", flexDirection: "column", justifyContent: "flex-end"
          }}>
            <Trame A={A} id={"tra-" + uid} />
            <div style={{ position: "absolute", inset: 0, background: A.voile }} />
            <div style={{
              position: "relative",
              padding: story ? "7cqw 8cqw 8cqw" : "6cqw 7cqw 7cqw", boxSizing: "border-box"
            }}>{contenu}</div>
          </div>
        </>
      )}
    </div>
  );
}
