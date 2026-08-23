import type { CSSProperties, ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { Countdown, Provenance, Quote, SectionLabel, Tag } from "../ui/index.js";
import { FeatureRow } from "./FeatureRow.js";

const CARTE: CSSProperties = {
  border: "var(--border-width) solid var(--border-object)",
  borderRadius: "var(--radius-xl)",
  padding: "var(--space-24)",
  minWidth: 0,
  boxSizing: "border-box",
};

function FicheProche({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  return (
    <div style={CARTE}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-12)" }}>
        <div className="titre" style={{ fontSize: "var(--text-display-xs)", fontWeight: "var(--font-display-medium)" }}>Valery Bah</div>
        <Countdown days={3} locale={langue} size="m" />
      </div>
      <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
        {t.anniv} · {t.date24} · {t.registre}
      </div>
      <div style={{ marginTop: "var(--space-20)", display: "grid", gap: "var(--space-14)" }}>
        <div>
          <SectionLabel>{t.gouts}</SectionLabel>
          <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap", marginTop: "var(--space-8)" }}>
            <Tag>{t.tag1}</Tag>
            <Tag>{t.tag2}</Tag>
            <Tag>{t.tag3}</Tag>
          </div>
        </div>
        <div>
          <SectionLabel>{t.idees}</SectionLabel>
          <div style={{ marginTop: "var(--space-8)" }}>
            <Quote size={14.5} tone="muted">{t.ideeParole}</Quote>
            <Provenance origin={t.provIdee} />
          </div>
        </div>
        <div>
          <SectionLabel>{t.nogo}</SectionLabel>
          <div style={{ marginTop: "var(--space-8)" }}>
            <Quote size={14.5} tone="muted">{t.nogoParole}</Quote>
            <Provenance origin={t.provNogo} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Calendrier({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  const dates: { date: string; nom: string; detail: string; jours: number }[] = [
    { date: t.date21, nom: "Celarine", detail: `${t.anniv} · ${t.age29}`, jours: 0 },
    { date: t.date24, nom: "Valery Bah", detail: `${t.anniv} · ${t.age36}`, jours: 3 },
    { date: t.date30, nom: "Mathias & Rose", detail: `${t.mariage} · ${t.an5}`, jours: 9 },
    { date: t.date2, nom: t.maman, detail: t.retraite, jours: 12 },
  ];

  return (
    <div style={{ background: "var(--surface-card)", border: "var(--border-width) solid var(--border-object)", borderRadius: "var(--radius-xl)", overflow: "hidden", minWidth: 0 }}>
      <div style={{ display: "grid" }}>
        {dates.map(({ date, nom, detail, jours }, index) => (
          <div
            key={nom}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-14)", padding: "var(--space-14) var(--space-20)",
              borderBottom: index < dates.length - 1 ? "var(--border-width) solid var(--border-hairline)" : undefined,
            }}
          >
            <div className="titre" style={{ fontSize: 18, fontWeight: "var(--font-display-medium)", color: "var(--text-accent)", minWidth: 62 }}>{date}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="titre" style={{ fontSize: 17, fontWeight: "var(--font-display-medium)" }}>{nom}</div>
              <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-secondary)" }}>{detail}</div>
            </div>
            <Countdown days={jours} locale={langue} size="s" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Brouillon({ t }: { t: Messages }): ReactNode {
  return (
    <div style={{ background: "var(--surface-panel)", borderRadius: "var(--radius-xl)", padding: "var(--space-24)", minWidth: 0, boxSizing: "border-box" }}>
      <SectionLabel style={{ color: "var(--text-accent)" }}>{t.brouillon}</SectionLabel>
      <div style={{ marginTop: "var(--space-14)" }}>
        <Quote size={19}>{t.brouillonTexte}</Quote>
        <Provenance origin={t.provBrouillon} />
      </div>
      <div style={{ display: "flex", gap: "var(--space-10)", marginTop: "var(--space-20)", flexWrap: "wrap" }}>
        {/* Fragment d'écran, pas une action réelle de la page : comme dans
            l'aperçu d'application ci-dessus, ce sont des éléments décoratifs,
            pas des <button> — la page ne met en avant qu'une seule action. */}
        <span style={{ background: "var(--action)", color: "var(--text-on-accent)", padding: "var(--space-10) var(--space-16)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-body-s)", fontWeight: "var(--font-body-semibold)" }}>
          {t.modifier}
        </span>
        <span style={{ background: "var(--surface-card)", color: "var(--text-accent)", padding: "var(--space-10) var(--space-16)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-body-s)", fontWeight: "var(--font-body-semibold)" }}>
          {t.regenerer}
        </span>
      </div>
    </div>
  );
}

// Trois stations, en aplats alternés — blanc, lilas, blanc — plutôt qu'en filets :
// c'est l'alternance qui donne le rythme, pas les séparations.
export function Content({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  return (
    <>
      <FeatureRow id="contenu" kicker={t.contenuKicker} titre={t.blocFicheTitre} texte={t.blocFiche}>
        <FicheProche t={t} langue={langue} />
      </FeatureRow>

      <FeatureRow titre={t.blocDatesTitre} texte={t.blocDates} panel>
        <Calendrier t={t} langue={langue} />
      </FeatureRow>

      <FeatureRow
        titre={t.blocMotTitre}
        texte={t.blocMot}
        extra={
          <>
            <SectionLabel style={{ marginTop: "var(--space-20)" }}>{t.ideesKicker}</SectionLabel>
            <ul style={{ display: "grid", gap: "var(--space-8)", marginTop: "var(--space-12)", padding: 0, listStyle: "none" }}>
              {[t.idee1, t.idee2, t.idee3].map((idee) => (
                <li key={idee} style={{ display: "flex", gap: "var(--space-12)", alignItems: "baseline", fontSize: "var(--text-body-s)", color: "var(--text-secondary)" }}>
                  <span className="titre" style={{ color: "var(--text-accent)", fontSize: 17 }} aria-hidden="true">·</span>
                  {idee}
                </li>
              ))}
            </ul>
          </>
        }
      >
        <Brouillon t={t} />
      </FeatureRow>
    </>
  );
}
