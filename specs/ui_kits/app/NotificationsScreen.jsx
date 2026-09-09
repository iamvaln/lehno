import React from "react";
import { Icon } from "../../components/core/Icon.jsx";
import { Countdown } from "../../components/content/Countdown.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";

/* Le centre de notifications (3.13) — ce qu'on ouvre depuis la cloche.

   Il rassemble, il ne trie pas par importance : l'ordre est chronologique,
   parce qu'une hiérarchie inventée par le produit ferait manquer ce qu'il a
   sous-estimé. Chaque ligne mène quelque part — une notification qui ne
   s'ouvre pas est un constat, pas un signalement.

   Le non-lu se marque par un point, pas par un fond coloré : la liste reste
   lisible quand tout est neuf. */

function Ligne({ icone, texte, quand, nonLu, decompte, onOuvrir, t }) {
  return (
    <button type="button" onClick={onOuvrir} className="lehno-focusable" style={{
      all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
      display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 0",
      minHeight: "var(--touch-min)", borderTop: "1px solid var(--border-hairline)"
    }}>
      <span style={{
        width: 34, height: 34, borderRadius: "var(--radius-xs)", flex: "none",
        background: "var(--action-quiet-bg)", color: "var(--text-accent)",
        display: "grid", placeItems: "center", marginTop: 1
      }}>
        <Icon name={icone} size={17} />
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: "block", fontSize: 14.5, lineHeight: 1.4,
          color: "var(--text-body)",
          fontWeight: nonLu ? "var(--font-body-medium)" : "var(--font-body-regular)"
        }}>{texte}</span>
        <span style={{ fontSize: 12, color: "var(--text-mention)" }}>{quand}</span>
      </span>

      {decompte != null ? (
        <Countdown size="s" today={decompte === 0}
          label={decompte === 0 ? t.aujourdhui : t.decompte(decompte)} />
      ) : null}
      {nonLu ? (
        <span style={{
          width: 7, height: 7, borderRadius: "50%", background: "var(--action)",
          flex: "none", marginTop: 7
        }} />
      ) : null}
    </button>
  );
}

export function NotificationsScreen({ t, etat = "nominal", flags = {}, onOpen }) {
  /* CINQ NATURES, ET ELLE DOIT RESTER CRÉDIBLE À TROIS. La collecte éteinte
     retire les contributions et les vœux ; les portraits éteints retirent
     l'avis de production. Ce qui reste — les dates, les rappels, les crédits —
     se recolle : les intertitres de jour ne survivent pas à leur contenu, et
     une journée vidée de ses lignes disparaît avec son titre. */
  const collecte = flags.collect !== false;
  const portraits = flags.generation !== false;
  const argent = flags.credits !== false;
  if (etat === "vide") {
    return (
      /* Un écran vide n'a pas de contenu à aligner en haut : le bloc se pose au
         milieu de la hauteur disponible. */
      <div style={{
        padding: "8px 16px 18px", minHeight: "100%", display: "flex",
        flexDirection: "column", justifyContent: "center"
      }}>
        <EmptyState illustration="rien-approche" titre={t.notifsVideTitre} texte={t.notifsVideTexte} />
      </div>
    );
  }

  const hier = t.langue === "fr" ? "hier" : "yesterday";
  const jours = (n) => t.langue === "fr" ? "il y a " + n + " jours" : n + " days ago";

  return (
    <div style={{ padding: "0 16px 18px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "4px 0 14px" }}>
        <h1 className="lehno-display" style={{
          fontSize: 24, letterSpacing: "-.025em", margin: 0, fontWeight: 500
        }}>{t.notifsTitre}</h1>
        <button type="button" className="lehno-focusable" style={{
          all: "unset", cursor: "pointer", marginLeft: "auto",
          fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--text-accent)"
        }}>{t.notifsToutLu}</button>
      </div>

      {[
        { cle: "jour", titre: t.notifsAujourdhui, lignes: [
          <Ligne key="a" t={t} icone="cake" nonLu decompte={0}
            texte={t.notifAujourdhui("Célarine")}
            quand={t.langue === "fr" ? "ce matin" : "this morning"}
            onOuvrir={() => onOpen && onOpen("occasion", { nom: "Célarine" })} />,
          collecte ? (
            <Ligne key="b" t={t} icone="inbox" nonLu
              texte={t.notifContribution(2)}
              quand={t.langue === "fr" ? "ce matin" : "this morning"}
              onOuvrir={() => onOpen && onOpen("valider")} />
          ) : null
        ].filter(Boolean) },
        { cle: "avant", titre: t.notifsAvant, lignes: [
          <Ligne key="c" t={t} icone="calendar" decompte={3}
            texte={t.notifRappel("Valery Bah", 3)} quand={hier}
            onOuvrir={() => onOpen && onOpen("occasion", { nom: "Valery Bah" })} />,
          portraits ? (
            <Ligne key="d" t={t} icone="sparkles"
              texte={t.notifPortrait("Célarine")} quand={hier}
              onOuvrir={() => onOpen && onOpen("generation")} />
          ) : null,
          argent ? (
            <Ligne key="e" t={t} icone="coins"
              texte={t.notifCredits(2)} quand={jours(4)}
              onOuvrir={() => onOpen && onOpen("recharge")} />
          ) : null
        ].filter(Boolean) }
      ].filter((g) => g.lignes.length).map((g, i) => (
        <div key={g.cle} style={{ marginTop: i ? 22 : 0 }}>
          <div className="lehno-kicker">{g.titre}</div>
          <div style={{ marginTop: 4 }}>{g.lignes}</div>
        </div>
      ))}
    </div>
  );
}
