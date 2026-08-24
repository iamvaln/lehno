import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { Quote } from "../../components/content/Quote.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";

/* Mon Mur, côté privé (3.10).

   Deux choses seulement : ce qui est public, et ce qu'on y a reçu. Le premier
   se règle élément par élément — un Mur n'est pas un profil qu'on remplit, c'est
   une vitrine dont on choisit chaque objet.

   Un Mur hors ligne reste consultable ici : on doit pouvoir préparer sa page
   avant de l'ouvrir. C'est pour ça que la bascule vit en haut et non enfouie
   dans des réglages. */

function Interrupteur({ actif, onBascule, libelle }) {
  return (
    <button type="button" role="switch" aria-checked={actif} onClick={onBascule}
      aria-label={libelle} className="lehno-focusable" style={{
        all: "unset", cursor: "pointer", flex: "none", width: 44, height: 26,
        borderRadius: 999, padding: 3, boxSizing: "border-box",
        background: actif ? "var(--action)" : "var(--border-object)",
        transition: "background var(--transition-state)"
      }}>
      <span style={{
        display: "block", width: 20, height: 20, borderRadius: "50%",
        background: "var(--surface-page)",
        transform: actif ? "translateX(18px)" : "translateX(0)",
        transition: "transform var(--transition-state)"
      }} />
    </button>
  );
}

function Rang({ libelle, actif, onBascule }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
      minHeight: "var(--touch-min)", borderTop: "1px solid var(--border-hairline)"
    }}>
      <span style={{ flex: 1, fontSize: 14.5 }}>{libelle}</span>
      <Interrupteur actif={actif} onBascule={onBascule} libelle={libelle} />
    </div>
  );
}

export function MonMurScreen({ t, etat = "nominal", onOpen }) {
  const [publie, setPublie] = React.useState(etat !== "prive");
  const [expose, setExpose] = React.useState(
    etat === "rienexpose" ? {} : { gouts: true, date: true, souhaits: true }
  );
  const bascule = (k) => setExpose((v) => ({ ...v, [k]: !v[k] }));
  const rien = !Object.values(expose).some(Boolean);

  return (
    <div style={{ padding: "0 16px 18px" }}>
      <Card padding={15} radius="lg" style={{ marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5 }}>{t.murPrivAdresse}</div>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase",
              marginTop: 3, color: publie ? "var(--feedback-success)" : "var(--text-mention)"
            }}>{publie ? t.murPrivPublie : t.murPrivPrive}</div>
          </div>
          <Interrupteur actif={publie} onBascule={() => setPublie((v) => !v)}
            libelle={t.murPrivBascule} />
        </div>
        {publie ? (
          <div style={{ fontSize: 12.5, color: "var(--text-mention)", marginTop: 9 }}>
            {t.moiMurVisible}
          </div>
        ) : null}
      </Card>

      <div style={{ marginTop: 22 }}>
        <SectionLabel>{t.murPrivExpose}</SectionLabel>
        <div style={{ marginTop: 4 }}>
          <Rang libelle={t.murPrivGouts} actif={!!expose.gouts} onBascule={() => bascule("gouts")} />
          <Rang libelle={t.murPrivDate} actif={!!expose.date} onBascule={() => bascule("date")} />
          <Rang libelle={t.murPrivSouhaits} actif={!!expose.souhaits} onBascule={() => bascule("souhaits")} />
        </div>
        {rien ? (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--text-mention)" }}>
            {t.murPrivRienExpose}
          </p>
        ) : null}
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.murPrivMots}</SectionLabel>
        {etat === "aucunmot" ? (
          <div style={{ marginTop: 6 }}>
            <EmptyState illustration="mur-aucun-mot"
              titre={t.murPrivAucunMotTitre} texte={t.murPrivAucunMotTexte} />
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: "var(--text-mention)", margin: "7px 0 10px" }}>
              {t.murPrivMotsCompte(4)}
            </div>
            <Card padding={15} radius="lg">
              <Quote size={15}>
                {t.langue === "fr"
                  ? "Bon anniversaire — cette année encore, tu as tenu tout le monde debout."
                  : "Happy birthday — another year of keeping everyone standing."}
              </Quote>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginTop: 10,
                fontSize: 12, color: "var(--text-mention)"
              }}>
                <Icon name="user" size={13} />
                <span>{t.langue === "fr" ? "Awa, il y a deux jours" : "Awa, two days ago"}</span>
              </div>
            </Card>
          </>
        )}
      </div>

      <Button platform="mobile" full variant="outline" icon="external-link"
        style={{ marginTop: 20 }}>{t.murPrivVoir}</Button>
    </div>
  );
}
