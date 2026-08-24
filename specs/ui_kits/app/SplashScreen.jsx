import React from "react";
import { Wordmark } from "../../components/brand/Wordmark.jsx";

/* L'écran d'ouverture. Ce n'est pas une illustration à dessiner : c'est l'actif
   de marque posé sur son aplat, et la séquence de lancement du logo animé — la
   pastille se pose, le h s'écrit à l'intérieur. Une fois par session, jamais en
   boucle. Sous « mouvement réduit », tout est là d'emblée : c'est l'une des
   deux manières prévues d'afficher la marque, pas une dégradation.

   L'aplat est violet dans les deux thèmes. Un écran d'ouverture n'a pas de
   thème : il précède l'application, et la marque ne change pas de couleur
   parce que le téléphone est en sombre. */

const CLES = `
@keyframes lehno-splash-pose {
  from { opacity: 0; transform: scale(.92); }
  to   { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .lehno-splash-pose { animation: none !important; }
}
`;

export function SplashScreen({ t, base = "../../", statique = false }) {
  return (
    <div style={{
      flex: 1, alignSelf: "stretch", background: "var(--lehno-violet)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "56px 24px 40px", boxSizing: "border-box"
    }}>
      <style>{CLES}</style>

      {/* Le logotype seul. Le verrouillage empilé — pastille au-dessus du mot —
          suppose une pastille dont on voit le cadre ; sur l'aplat violet ce
          cadre disparaît et il ne reste qu'un h posé au-dessus du mot qui
          contient déjà son h. L'icône est de toute façon ce qu'on vient de
          toucher pour arriver ici : c'est le nom qu'on présente. */}
      <div className={statique ? undefined : "lehno-splash-pose"} style={{
        lineHeight: 0,
        animation: statique ? undefined : "lehno-splash-pose .6s cubic-bezier(.22,.8,.24,1) both"
      }}>
        <Wordmark base={base} variant="blanc" height={44} />
      </div>

      {/* Rien d'autre. Pas de signature, pas de version, pas d'indicateur de
          chargement : l'écran dure moins longtemps qu'il n'en faut pour lire. */}
    </div>
  );
}
