import React from "react";

/** Les logos des réseaux sociaux — les vraies marques, pas des pictogrammes
 *  approchants. Ils sont posés en masque plutôt qu'en `<img>` : le glyphe prend
 *  ainsi la couleur du texte qui l'accompagne, comme toute icône du système, et
 *  reste lisible sur les deux thèmes.
 *
 *  Ce sont des marques déposées : on les emploie pour désigner un compte, on ne
 *  les recolore pas dans leur teinte propre et on ne les modifie pas. Sources :
 *  Simple Icons (CC0) pour Instagram, TikTok, X, Facebook, YouTube ; le glyphe
 *  LinkedIn, retiré de Simple Icons à la demande de la marque, est le glyphe
 *  officiel. Fichiers dans `assets/social/`. */
export function SocialGlyph({ reseau, size = 17, color = "currentColor", base = "../../" }) {
  const url = base + "assets/social/" + reseau + ".svg";
  return (
    <span aria-hidden="true" style={{
      display: "inline-block", flex: "none", width: size, height: size,
      background: color,
      WebkitMaskImage: "url(" + url + ")", maskImage: "url(" + url + ")",
      WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
      WebkitMaskPosition: "center", maskPosition: "center",
      WebkitMaskSize: "contain", maskSize: "contain"
    }} />
  );
}
