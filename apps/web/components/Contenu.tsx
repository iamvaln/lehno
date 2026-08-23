import type { ReactNode } from "react";
import type { Messages } from "../messages";

const bande = {
  maxWidth: 1160, margin: "0 auto", padding: "clamp(52px,7vw,92px) 20px",
} as const;

const duo = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
  gap: "clamp(28px,4vw,56px)", alignItems: "center",
} as const;

const titreBloc = {
  fontWeight: 500, fontSize: "clamp(28px,4vw,38px)", letterSpacing: "-.028em",
  lineHeight: 1.12, margin: "0 0 14px", textWrap: "balance" as const,
};

const texteBloc = {
  margin: 0, color: "var(--muted)", fontSize: "clamp(16px,2vw,18px)", maxWidth: "42ch",
} as const;

const etiquette = {
  fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" as const,
  color: "var(--faint)", fontWeight: 600,
};

const pastille = {
  border: "1px solid var(--line2)", borderRadius: 999, padding: "5px 12px", fontSize: 13,
} as const;

// Quatre stations, en aplats alternés — blanc, lilas, blanc — plutôt qu'en filets :
// c'est l'alternance qui donne le rythme, pas les séparations.
export function Contenu({ t }: { t: Messages }): ReactNode {
  return (
    <>
      <section id="contenu" style={{ background: "var(--bg)" }}>
        <div style={bande}>
          <h2 style={{ ...etiquette, margin: 0 }}>{t.contenuKicker}</h2>
          <div style={{ ...duo, marginTop: 34 }}>
            <div style={{ minWidth: 0 }}>
              <h3 className="titre" style={titreBloc}>{t.blocFicheTitre}</h3>
              <p style={texteBloc}>{t.blocFiche}</p>
            </div>
            <FicheProche t={t} />
          </div>
        </div>
      </section>

      <section style={{ background: "var(--panel)" }}>
        <div style={bande}>
          <div style={duo}>
            <div style={{ minWidth: 0 }}>
              <h3 className="titre" style={titreBloc}>{t.blocDatesTitre}</h3>
              <p style={texteBloc}>{t.blocDates}</p>
            </div>
            <Calendrier t={t} />
          </div>
        </div>
      </section>

      <section style={{ background: "var(--bg)" }}>
        <div style={bande}>
          <div style={duo}>
            <div style={{ minWidth: 0 }}>
              <h3 className="titre" style={titreBloc}>{t.blocMotTitre}</h3>
              <p style={texteBloc}>{t.blocMot}</p>
              <div style={{ ...etiquette, marginTop: 22 }}>{t.ideesKicker}</div>
              <ul style={{ display: "grid", gap: 8, marginTop: 12, padding: 0, listStyle: "none" }}>
                {[t.idee1, t.idee2, t.idee3].map((idee) => (
                  <li key={idee} style={{ display: "flex", gap: 12, alignItems: "baseline", fontSize: 15, color: "var(--muted)" }}>
                    <span className="titre" style={{ color: "var(--violet)", fontSize: 17 }} aria-hidden="true">·</span>
                    {idee}
                  </li>
                ))}
              </ul>
            </div>
            <Brouillon t={t} />
          </div>
        </div>
      </section>
    </>
  );
}

function FicheProche({ t }: { t: Messages }): ReactNode {
  return (
    <div style={{ border: "1px solid var(--line2)", borderRadius: 18, padding: "24px 22px", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div className="titre" style={{ fontSize: 24, fontWeight: 500 }}>Valery Bah</div>
        <div className="titre" style={{ fontSize: 20, fontWeight: 500, color: "var(--violet-deep)" }}>{t.j3}</div>
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{t.anniv} · {t.date24} · {t.registre}</div>
      <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
        <div>
          <div style={etiquette}>{t.gouts}</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}>
            <span style={pastille}>{t.tag1}</span>
            <span style={pastille}>{t.tag2}</span>
            <span style={pastille}>{t.tag3}</span>
          </div>
        </div>
        <div>
          <div style={etiquette}>{t.idees}</div>
          <p style={{ margin: "8px 0 0", fontSize: 14.5, color: "var(--muted)" }}>
            {t.ideeTexte} <span style={{ color: "var(--faint)" }}>{t.ideeDate}</span>
          </p>
        </div>
        <div>
          <div style={etiquette}>{t.nogo}</div>
          <p style={{ margin: "8px 0 0", fontSize: 14.5, color: "var(--muted)" }}>{t.nogoTexte}</p>
        </div>
      </div>
    </div>
  );
}

function Calendrier({ t }: { t: Messages }): ReactNode {
  const dates: { date: string; nom: string; detail: string; reste: string }[] = [
    { date: t.date24, nom: "Valery Bah", detail: `${t.anniv} · ${t.age36}`, reste: t.j3 },
    { date: t.date30, nom: "Mathias & Rose", detail: `${t.mariage} · ${t.an5}`, reste: t.j9 },
    { date: t.date2, nom: t.maman, detail: t.retraite, reste: t.j12 },
    { date: t.date14, nom: t.nourEtMoi, detail: t.sixMois, reste: t.j24 },
  ];

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 18, overflow: "hidden", minWidth: 0 }}>
      <div style={{ display: "grid" }}>
        {dates.map(({ date, nom, detail, reste }, index) => (
          <div
            key={nom}
            style={{
              display: "flex", alignItems: "center", gap: 14, padding: "15px 20px",
              borderBottom: index < dates.length - 1 ? "1px solid var(--line)" : undefined,
            }}
          >
            <div className="titre" style={{ fontSize: 18, fontWeight: 500, color: "var(--violet-deep)", minWidth: 62 }}>{date}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="titre" style={{ fontSize: 17, fontWeight: 500 }}>{nom}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{detail}</div>
            </div>
            <span style={{ background: "var(--panel)", color: "var(--violet-deep)", padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{reste}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Brouillon({ t }: { t: Messages }): ReactNode {
  return (
    <div style={{ background: "var(--panel)", borderRadius: 18, padding: "26px 24px", minWidth: 0 }}>
      <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--violet-deep)", fontWeight: 600 }}>{t.brouillon}</div>
      <p className="titre" style={{ fontSize: "clamp(18px,2.4vw,21px)", lineHeight: 1.45, fontWeight: 400, margin: "14px 0 0", color: "var(--text)", textWrap: "pretty" }}>
        {t.brouillonTexte}
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
        <span style={{ background: "var(--violet)", color: "var(--on-violet)", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600 }}>{t.modifier}</span>
        <span style={{ background: "var(--card)", color: "var(--violet-deep)", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600 }}>{t.regenerer}</span>
      </div>
    </div>
  );
}
