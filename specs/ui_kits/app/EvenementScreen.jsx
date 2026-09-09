import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { SensitiveBanner } from "../../components/feedback/SensitiveBanner.jsx";
import { Banner } from "../../components/feedback/Banner.jsx";

/* Les mois viennent du système : ils suivent la langue sans être recopiés. */
const nomMois = (m, langue) => new Intl.DateTimeFormat(
  langue === "fr" ? "fr-FR" : "en-GB", { month: "long" }
).format(new Date(2026, m, 1));
const mois = (langue) => Array.from({ length: 12 }, (_, m) => ({
  value: String(m), label: nomMois(m, langue)
}));
const joursDuMois = (m, annee) => new Date(annee, Number(m) + 1, 0).getDate();

const aujourdhui = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
/* Un événement se prépare : sa date est devant. Le jour et le mois suffisent
   donc à la poser — l'année est celle de la prochaine occurrence. */
const prochaineAnnee = (jour, m) => {
  const auj = aujourdhui();
  const a = auj.getFullYear();
  return new Date(a, Number(m), Number(jour)) < auj ? a + 1 : a;
};
const enToutesLettres = (jour, m, annee, langue) => new Intl.DateTimeFormat(
  langue === "fr" ? "fr-FR" : "en-GB",
  { weekday: "long", day: "numeric", month: "long", year: "numeric" }
).format(new Date(annee, Number(m), Number(jour)));

/* D'où qu'elle vienne — une case du calendrier, la fiche d'un proche — la date
   arrive en mots : on retrouve son rang. */
const lireDate = (texte, langue) => {
  if (!texte) return null;
  const j = (texte.match(/\d+/) || [])[0];
  if (!j) return null;
  const mot = texte.replace(/[\d\s.]/g, "").toLowerCase();
  const rang = mois(langue).findIndex((o) => o.label.toLowerCase().indexOf(mot.slice(0, 3)) === 0);
  return rang < 0 ? null : { jour: String(Number(j)), mois: String(rang) };
};
const rangMois = (depuis) => {
  if (!depuis) return null;
  const trouve = (langue, nom) => mois(langue).findIndex((o) => o.label === nom);
  const i = depuis.moisFr ? trouve("fr", depuis.moisFr) : -1;
  const j = i < 0 && depuis.moisEn ? trouve("en", depuis.moisEn) : i;
  return j < 0 ? null : String(j);
};

export function EvenementScreen({
  t, etat = "nominal", qui, gens = [], depuis, flags = {}, onEnregistrer
}) {
  const langue = t.langue === "fr" ? "fr" : "en";
  const auj = aujourdhui();
  /* AU LANCEMENT, IL N'Y A QU'UN TYPE. Le drapeau des autres natures éteint,
     le choix ne se grise pas et ne se réduit pas à une seule case : il sort de
     l'écran. Ce que la rangée disait passe dans le titre de la barre — « Nouvel
     anniversaire » —, et l'année cesse d'être une question puisqu'un
     anniversaire tombe à la prochaine occurrence. Le formulaire commence donc
     par ce qui reste sa vraie première question : pour qui. */
  const autresTypes = flags.eventsOther !== false;
  const [type, setType] = React.useState("anniversaire");
  const [rappel, setRappel] = React.useState(t.evtRappelDefaut);

  /* Pour qui — même geste que sur la note : des puces, et un nom de plus quand
     la date concerne deux personnes. */
  /* Ouvert depuis une fiche, la personne est déjà là ; ouvert depuis le
     calendrier, la ligne reste vide tant qu'on n'a désigné personne. */
  const [pour, setPour] = React.useState(qui ? [qui] : []);
  const [choix, setChoix] = React.useState(false);
  const [filtre, setFiltre] = React.useState("");
  const carnet = gens.length ? gens : [];
  const nomDe = (g) => (langue === "fr" ? g.nom : (g.nomEn || g.nom));
  const candidats = carnet.map(nomDe).filter((n) => pour.indexOf(n) < 0);
  const trouves = candidats.filter(
    (n) => n.toLowerCase().indexOf(filtre.trim().toLowerCase()) >= 0
  );

  const [jour, setJour] = React.useState(
    String((depuis && depuis.jour) || auj.getDate())
  );
  const [moisRetenu, setMoisRetenu] = React.useState(
    rangMois(depuis) || String(auj.getMonth())
  );
  React.useEffect(() => {
    if (!depuis) return;
    if (depuis.jour) setJour(String(depuis.jour));
    const r = rangMois(depuis);
    if (r) setMoisRetenu(r);
  }, [depuis && depuis.jour, depuis && depuis.moisFr]);

  /* Le premier proche désigné apporte sa date de naissance quand elle est
     connue : le jour et le mois se remplissent, l'année reste la prochaine. */
  const apporterNaissance = (nom) => {
    const g = carnet.find((x) => nomDe(x) === nom);
    const d = g && g.type === "anniversaire"
      ? lireDate(langue === "fr" ? g.date : (g.dateEn || g.date), langue) : null;
    if (d) { setJour(d.jour); setMoisRetenu(d.mois); }
  };

  const maxJour = joursDuMois(moisRetenu, prochaineAnnee(1, moisRetenu));
  const jourSur = String(Math.min(Number(jour), maxJour));
  const JOURS = Array.from({ length: maxJour }, (_, i) => String(i + 1));

  /* L'année n'est pas une question : c'est celle où la date tombe ensuite.
     Pour les autres événements, elle se déplace d'un an, jamais en arrière. */
  const annees = [prochaineAnnee(jourSur, moisRetenu)];
  annees.push(annees[0] + 1);
  const [annee, setAnnee] = React.useState(null);
  const anneeRetenue = type === "anniversaire" || annees.indexOf(Number(annee)) < 0
    ? annees[0] : Number(annee);
  const sensible = etat === "sensible";
  const dansCombien = Math.round(
    (new Date(anneeRetenue, Number(moisRetenu), Number(jourSur)) - auj) / 86400000
  );

  const puce = (nom, retirable) => (
    <span key={nom} style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      background: "var(--action-quiet-bg)", color: "var(--text-accent)",
      borderRadius: "var(--radius-pill)", padding: "0 12px 0 6px",
      minHeight: "var(--touch-min)", boxSizing: "border-box",
      fontFamily: "var(--font-body)", fontSize: 13.5
    }}>
      <Avatar name={nom} size={24} />
      {nom}
      {retirable ? (
        <button type="button" aria-label={nom} className="lehno-focusable"
          onClick={() => setPour((v) => v.filter((x) => x !== nom))}
          style={{
            all: "unset", cursor: "pointer", display: "grid", placeItems: "center",
            width: 22, height: 22, color: "var(--text-accent)"
          }}><Icon name="x" size={13} strokeWidth={2} /></button>
      ) : null}
    </span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {sensible ? <SensitiveBanner texte={t.sensibleForm} /> : null}
      {etat === "erreur" ? <Banner intent="warning">{t.evtDejaAnniv}</Banner> : null}

      <div style={{ padding: "var(--ry-haut) 16px 18px", flex: 1 }}>
        {autresTypes ? (
        <>
        {/* Deux types, une rangée : le choix se voit d'un coup d'œil au lieu de
            se répartir entre une carte et un lien. */}
        <SectionLabel>{t.evtType}</SectionLabel>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 9,
          padding: 4, borderRadius: "var(--radius-lg)", background: "var(--surface-panel)"
        }}>
          {[["anniversaire", t.typeAnniversaire, "cake"], ["autre", t.typeAutre, "calendar"]]
            .map(([k, label, ic]) => {
              const actif = type === k;
              return (
                <button key={k} type="button" onClick={() => setType(k)} aria-pressed={actif}
                  className="lehno-focusable" style={{
                    all: "unset", boxSizing: "border-box", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    minHeight: 42, borderRadius: "var(--radius-md)", textAlign: "center",
                    background: actif ? "var(--surface-card)" : "transparent",
                    border: "1px solid " + (actif ? "var(--action)" : "transparent"),
                    color: actif ? "var(--text-accent)" : "var(--text-secondary)",
                    fontFamily: "var(--font-body)", fontSize: 14.5,
                    fontWeight: actif ? 600 : 400
                  }}>
                  <Icon name={ic} size={17} /> {label}
                </button>
              );
            })}
        </div>
        </>
        ) : null}

        <div style={{ marginTop: autresTypes ? "var(--ry-bloc)" : 0 }}>
          <SectionLabel>{t.evtPourQui}</SectionLabel>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
            {pour.map((n) => puce(n, true))}
            {choix || !candidats.length ? null : (
              pour.length ? (
                <button type="button" onClick={() => { setFiltre(""); setChoix(true); }}
                  className="lehno-focusable"
                  style={{
                    all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
                    gap: 7, minHeight: "var(--touch-min)", padding: "0 14px",
                    borderRadius: "var(--radius-pill)", boxSizing: "border-box",
                    border: "1px dashed var(--border-object)",
                    fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--text-secondary)"
                  }}>
                  <Icon name="plus" size={14} strokeWidth={2} /> {t.noteAjouterProche}
                </button>
              ) : (
                /* Personne encore : la ligne se présente comme un champ à ouvrir. */
                <button type="button" onClick={() => { setFiltre(""); setChoix(true); }}
                  className="lehno-focusable"
                  style={{
                    all: "unset", cursor: "pointer", boxSizing: "border-box", width: "100%",
                    display: "flex", alignItems: "center", gap: 9, padding: "0 13px",
                    minHeight: "var(--touch-min)", borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-object)", background: "var(--surface-card)",
                    fontFamily: "var(--font-body)", fontSize: 14.5, color: "var(--text-mention)"
                  }}>
                  <span style={{ flex: 1 }}>{t.rechercher}</span>
                  <Icon name="chevron-down" size={15} />
                </button>
              )
            )}
          </div>
          {choix ? (
            /* Un carnet se cherche : cinquante noms ne se parcourent pas à l'œil. */
            <div style={{
              marginTop: 8, borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-object)", background: "var(--surface-card)",
              overflow: "hidden"
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 9, padding: "0 12px",
                minHeight: "var(--touch-min)", borderBottom: "1px solid var(--border-hairline)"
              }}>
                <Icon name="search" size={15} color="var(--text-mention)" />
                <input autoFocus value={filtre} onChange={(ev) => setFiltre(ev.target.value)}
                  placeholder={t.rechercher} style={{
                    all: "unset", flex: 1, minWidth: 0, fontFamily: "var(--font-body)",
                    fontSize: 14.5, color: "var(--text-body)", padding: "10px 0"
                  }} />
                <button type="button" aria-label={t.rechercher} className="lehno-focusable"
                  onClick={() => setChoix(false)} style={{
                    all: "unset", cursor: "pointer", display: "grid", placeItems: "center",
                    width: 26, height: 26, color: "var(--text-mention)"
                  }}><Icon name="x" size={15} strokeWidth={2} /></button>
              </div>
              <div style={{ maxHeight: 168, overflowY: "auto" }}>
                {trouves.length ? trouves.map((n) => (
                  <button key={n} type="button" className="lehno-focusable"
                    onClick={() => {
                      setPour((v) => { if (!v.length) apporterNaissance(n); return [...v, n]; });
                      setChoix(false);
                    }}
                    style={{
                      all: "unset", cursor: "pointer", boxSizing: "border-box", width: "100%",
                      display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
                      minHeight: "var(--touch-min)", fontFamily: "var(--font-body)",
                      fontSize: 14.5, color: "var(--text-body)"
                    }}>
                    <Avatar name={n} size={26} />{n}
                  </button>
                )) : (
                  <div style={{
                    padding: "14px 12px", fontSize: 13.5, color: "var(--text-mention)"
                  }}>{t.videRechercheTitre}</div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {autresTypes && type === "autre" ? (
          <div style={{ marginTop: "var(--ry-bloc)" }}>
            <TextField platform="mobile" label={t.evtLabel}
              defaultValue={langue === "fr" ? "Mariage" : "Wedding"} hint={t.evtLabelAide} />
          </div>
        ) : null}

        <div style={{ marginTop: "var(--ry-bloc)" }}>
          <SectionLabel>{t.evtDate}</SectionLabel>
          <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
            {/* Jour et mois se choisissent ; l'année suit. */}
            <div style={{ flex: 1 }}><TextField platform="mobile" label={t.evtJour}
              options={JOURS} value={jourSur}
              onChange={(ev) => setJour(ev.target.value)} /></div>
            <div style={{ flex: 2 }}><TextField platform="mobile" label={t.evtMois}
              options={mois(langue)} value={moisRetenu}
              onChange={(ev) => setMoisRetenu(ev.target.value)} /></div>
            {autresTypes && type === "autre" ? (
              <div style={{ flex: 1.2 }}><TextField platform="mobile" label={t.evtAnnee}
                options={annees.map(String)} value={String(anneeRetenue)}
                onChange={(ev) => setAnnee(ev.target.value)} /></div>
            ) : null}
          </div>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 10
          }}>
            <span className="lehno-display" style={{ fontSize: 16.5 }}>
              {enToutesLettres(jourSur, moisRetenu, anneeRetenue, langue)}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-mention)" }}>
              {t.evtDansJours(dansCombien)}
            </span>
          </div>
        </div>

        {/* Le rappel est le seul réglage de cet écran : la nature d'une date se
            reconnaît à son type et se corrige après coup, elle n'est pas une
            question à poser au moment de poser la date. */}
        <div style={{ marginTop: "var(--ry-bloc)" }}>
          <TextField platform="mobile" label={t.evtRappel}
            options={t.evtRappelChoix} value={rappel}
            onChange={(ev) => setRappel(ev.target.value)} />
        </div>
      </div>

      <div style={{ padding: "0 16px 16px", flex: "none" }}>
        <Button platform="mobile" full onClick={onEnregistrer}>{t.enregistrer}</Button>
      </div>
    </div>
  );
}
