import React from "react";

/* Châssis d'appareil — décor de présentation, rien ici n'appartient au produit.
   Il porte les deux systèmes et trois gabarits, parce que la spec demande que
   les écrans tiennent « d'un petit écran à une tablette » : c'est le SE qui
   révèle les libellés trop longs, et la bascule FR/EN qui les allonge d'un
   tiers. Les deux vont ensemble. */

export const MODELES = {
  se:       { nom: "iPhone SE",     l: 320, h: 568, r: 34, encoche: false, safeTop: 20, safeBas: 0 },
  standard: { nom: "Format courant", l: 390, h: 760, r: 46, encoche: true,  safeTop: 44, safeBas: 20 },
  max:      { nom: "Grand format",  l: 430, h: 800, r: 50, encoche: true,  safeTop: 48, safeBas: 22 }
};

/* Les barres d'état diffèrent assez pour valoir d'être dessinées : iOS centre
   l'heure sous l'encoche, Android la pose à gauche. Un écran qui tient sous
   l'une peut se faire couper sous l'autre. */
function BarreEtat({ os, modele, heure, claire }) {
  const iOS = os === "ios";
  const commun = {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 4,
    height: modele.safeTop, display: "flex", alignItems: "center",
    fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600,
    color: claire ? "#FFFFFF" : "var(--text-body)", pointerEvents: "none",
    padding: iOS ? "0 26px" : "0 16px"
  };
  const jauge = (
    <span style={{ display: "flex", gap: 5, alignItems: "flex-end", opacity: .9 }}>
      {/* Réseau : quatre barres croissantes, la dernière éteinte. */}
      <span style={{ display: "flex", gap: 1.5, alignItems: "flex-end" }}>
        {[4, 6, 8, 10].map((h, i) => (
          <span key={h} style={{
            width: 2.5, height: h, borderRadius: 1,
            background: "currentColor", opacity: i === 3 ? .3 : 1
          }} />
        ))}
      </span>
      {/* Wifi : trois arcs. */}
      <svg width="14" height="11" viewBox="0 0 16 12" fill="none" style={{ display: "block" }}>
        <path d="M1 4.2a10 10 0 0 1 14 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M3.6 6.9a6.4 6.4 0 0 1 8.8 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M6.3 9.5a2.6 2.6 0 0 1 3.4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {/* Batterie : coque, téton, charge. */}
      <span style={{ display: "flex", alignItems: "center", gap: 1 }}>
        <span style={{
          width: 22, height: 11, borderRadius: 3, boxSizing: "border-box",
          border: "1.2px solid currentColor", padding: 1.5, display: "flex"
        }}>
          <span style={{ width: "72%", background: "currentColor", borderRadius: 1.5 }} />
        </span>
        <span style={{ width: 1.6, height: 4, borderRadius: "0 2px 2px 0", background: "currentColor", opacity: .55 }} />
      </span>
    </span>
  );
  if (iOS) {
    return (
      <div style={{ ...commun, justifyContent: "space-between" }}>
        <span>{heure}</span>
        {jauge}
      </div>
    );
  }
  return (
    <div style={{ ...commun, justifyContent: "space-between" }}>
      <span style={{ fontWeight: 500 }}>{heure}</span>
      {jauge}
    </div>
  );
}

/* « auto » : le châssis prend la hauteur de son contenu au lieu de la fixer.
   Le prototype garde la hauteur réelle de l'appareil — c'est ce qui rend le
   défilement honnête. La planche de revue, elle, doit tout montrer d'un coup :
   un écran coupé au milieu d'un bouton ne se valide pas. */
/* « pleinEcran » : l'écran occupe aussi la zone de la barre d'état, comme le
   fait une ouverture ou une photo en pleine page. La barre passe alors en blanc,
   puisque c'est l'écran qui porte son fond et non plus la page. */
export function PhoneFrame({ children, os = "ios", modele = "standard", heure = "8:30", etiquette, auto = false, pleinEcran = false, feuille, onVoile }) {
  const m = MODELES[modele] || MODELES.standard;
  const iOS = os === "ios";
  const encoche = m.encoche && iOS;

  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
      <div style={{
        width: m.l, height: auto ? "auto" : m.h, minHeight: auto ? m.h : undefined,
        flex: "none", position: "relative", boxSizing: "border-box",
        background: "#0B0A10", borderRadius: m.r, padding: 9, boxShadow: "var(--shadow-device)"
      }}>
        {/* En « auto », l'écran ne peut pas être en hauteur relative : un
            pourcentage se résout contre le min-height du parent et ne lui
            apprend jamais que le contenu est plus haut. D'où la hauteur
            intrinsèque — mais le découpage reste, sinon un aplat pleine page
            passe par-dessus les angles arrondis du châssis. */}
        <div style={{
          position: "relative", width: "100%",
          height: auto ? "auto" : "100%",
          minHeight: auto ? (m.h - 18) + "px" : undefined,
          overflow: "hidden",
          borderRadius: m.r - 9, background: "var(--surface-page)",
          display: "flex", flexDirection: "column"
        }}>
          <BarreEtat os={os} modele={m} heure={heure} claire={pleinEcran} />

          {encoche ? (
            <div style={{
              position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
              width: Math.round(m.l * 0.29), height: 26, background: "#0B0A10",
              borderRadius: 14, zIndex: 5
            }} />
          ) : null}

          {!iOS && m.encoche ? (
            <div style={{
              position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
              width: 10, height: 10, background: "#0B0A10", borderRadius: "50%", zIndex: 5
            }} />
          ) : null}

          {/* Le modèle est écrit sur le conteneur d'écran : un écran serré — la
              saisie d'un code, une confirmation — peut alors se resserrer sur
              un petit téléphone sans qu'on lui passe une propriété de plus.

              La racine d'un écran est en border-box : presque toutes portent
              une hauteur de 100 % et un rembourrage, et en content-box les
              deux s'additionnent — l'écran dépassait de son propre rembourrage
              et faisait défiler une page qui tenait. */}
          <div data-modele={modele} style={{
            flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
            paddingTop: pleinEcran ? 0 : m.safeTop,
            paddingBottom: auto && m.safeBas && !pleinEcran ? m.safeBas : 0
          }}>
            {/* Le rythme vertical est écrit ici, une fois, et dépend du gabarit :
                le SE se resserre, les autres respirent. Sans ça, les valeurs
                trouvées pour le petit écran devenaient la règle partout, et un
                écran courant se retrouvait tassé en haut avec un vide au pied. */}
            <style>{`
              [data-modele] > *, [data-modele] > * > * { box-sizing: border-box; }
              [data-modele] { --ry-haut: 8px; --ry-titre: 16px; --ry-bloc: 20px; --ry-item: 10px; }
              [data-modele="se"] { --ry-haut: 2px; --ry-titre: 8px; --ry-bloc: 12px; --ry-item: 8px; }
            `}</style>
            {children}
          </div>

          {/* Une feuille modale se monte ici, au-dessus de l'en-tête : posée
              dans l'écran, elle laissait la flèche de retour cliquable et le
              bandeau du haut en pleine lumière pendant la question. */}
          {feuille ? (
            <>
              <div onClick={onVoile} style={{
                position: "absolute", inset: 0, zIndex: 8,
                background: "rgba(15,13,19,.42)"
              }} />
              <div style={{
                position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 9
              }}>{feuille}</div>
            </>
          ) : null}

          {/* iOS a son indicateur d'accueil ; Android sa barre de navigation. */}
          {m.safeBas ? (iOS ? (
            <div style={{
              position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)",
              width: Math.round(m.l * 0.3), height: 4, borderRadius: 3,
              background: "var(--text-body)", opacity: .35, zIndex: 5
            }} />
          ) : (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 22, zIndex: 5,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 40,
              color: "var(--text-mention)", pointerEvents: "none"
            }}>
              <span style={{ width: 9, height: 9, border: "1.6px solid currentColor", borderRadius: 2 }} />
              <span style={{ width: 10, height: 10, border: "1.6px solid currentColor", borderRadius: "50%" }} />
              <span style={{ width: 11, height: 2, background: "currentColor" }} />
            </div>
          )) : null}
        </div>
      </div>

      {etiquette ? (
        <div style={{
          fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: ".1em",
          textTransform: "uppercase", fontWeight: 600, color: "var(--text-mention)"
        }}>{etiquette}</div>
      ) : null}
    </div>
  );
}
