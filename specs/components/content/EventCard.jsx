import React from "react";
import { Card } from "../core/Card.jsx";
import { Tag } from "../core/Tag.jsx";
import { Button } from "../core/Button.jsx";
import { Countdown } from "./Countdown.jsx";
import { Quote } from "./Quote.jsx";
import { Provenance } from "./Provenance.jsx";

/** Les types d'échéance. L'anniversaire est le cas courant, donc muet ; les
 *  autres se signalent, sans couleur nouvelle — on réutilise les tons de Tag.
 *  **Le libellé n'est pas écrit ici** : il vient du dictionnaire de
 *  l'application, par `typeLabel`. Un mot en dur ne se traduit pas. */
const TYPES = {
  anniversaire: { ton: "outline", muet: true },
  mariage:      { ton: "quiet" },
  retraite:     { ton: "quiet" },
  naissance:    { ton: "quiet" },
  etape:        { ton: "quiet" },
  fete:         { ton: "quiet" },
  autre:        { ton: "quiet" }
};

export function EventCard({
  nom, type = "anniversaire", typeLabel, dateLabel, decompte, aujourdhui = false, precision,
  note, noteOrigine, noteDate,
  imminent = false, actions,
  onPreparer, onEnvoye, onOuvrir, style, ...rest
}) {
  const t = TYPES[type] || TYPES.autre;
  const etiquette = t.muet ? null : typeLabel;
  const cliquable = !!onOuvrir;

  const entete = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="lehno-display" style={{ fontSize: imminent ? 19 : 17, fontWeight: 500 }}>{nom}</span>
          {etiquette ? <Tag tone={t.ton} style={{ fontSize: 11.5, padding: "3px 9px" }}>{etiquette}</Tag> : null}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 1 }}>
          {[dateLabel, precision].filter(Boolean).join(" · ")}
        </div>
      </div>
      {decompte ? (
        <Countdown label={decompte} today={aujourdhui} size={imminent ? "m" : "s"} />
      ) : null}
    </div>
  );

  if (!imminent) {
    return (
      <Card padding={15} radius="lg" style={style} {...rest}>
        {cliquable ? (
          <button type="button" onClick={onOuvrir} className="lehno-focusable"
            style={{ all: "unset", cursor: "pointer", width: "100%", boxSizing: "border-box", minHeight: "var(--touch-min)", display: "block" }}>
            {entete}
          </button>
        ) : entete}
      </Card>
    );
  }

  return (
    <Card surface="panel" padding={16} radius="lg" style={style} {...rest}>
      {cliquable ? (
        <button type="button" onClick={onOuvrir} className="lehno-focusable"
          style={{ all: "unset", cursor: "pointer", width: "100%", boxSizing: "border-box", minHeight: "var(--touch-min)", display: "block" }}>
          {entete}
        </button>
      ) : entete}
      {note ? (
        <>
          <Quote size={14} style={{ marginTop: 10 }}>{note}</Quote>
          {noteOrigine || noteDate ? <Provenance origin={noteOrigine} date={noteDate} /> : null}
        </>
      ) : null}
      {actions && actions.length ? (
        <div style={{
          display: "grid", gap: 8, marginTop: 14,
          gridTemplateColumns: actions[1] ? "1fr auto" : "1fr"
        }}>
          <Button platform="mobile" full onClick={onPreparer}>{actions[0]}</Button>
          {actions[1] ? (
            <Button platform="mobile" variant="text" onClick={onEnvoye}
              style={{ whiteSpace: "nowrap" }}>{actions[1]}</Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
