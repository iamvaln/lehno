import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Quote } from "../../components/content/Quote.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";

/* Mon Mur, côté privé (3.10).

   Deux choses seulement : ce qui est public, et ce qu'on y a reçu. Le premier
   se règle élément par élément — un Mur n'est pas un profil qu'on remplit, c'est
   une vitrine dont on choisit chaque objet.

   Un Mur hors ligne reste consultable ici : on doit pouvoir préparer sa page
   avant de l'ouvrir. C'est pour ça que la bascule vit en haut et non enfouie
   dans des réglages — et que le bouton du bas ouvre un APERÇU tant que la page
   n'est pas publiée : on regarde avant d'ouvrir, pas après.

   LES MOTS REÇUS SONT PRIVÉS, ET ÉPINGLABLES UN PAR UN. Le propriétaire décide
   lesquels paraissent sur sa page ; les autres ne sortent pas de cet écran. Ce
   n'est donc pas un livre d'or qui se remplit tout seul : c'est un choix, geste
   par geste. Un mot sans signature s'épingle sans signature. */

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

function Mot({ t, mot, epingle, onBascule }) {
  return (
    <Card padding={15} radius="lg">
      <Quote size={15}>{mot.texte}</Quote>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginTop: 10,
        fontSize: 12, color: "var(--text-mention)"
      }}>
        <Icon name="user" size={13} />
        <span style={{ flex: 1, minWidth: 0 }}>
          {(mot.auteur || t.murPrivSansNom) + ", " + mot.quand}
        </span>
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginTop: 11,
        paddingTop: 11, borderTop: "1px solid var(--border-hairline)"
      }}>
        {epingle ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 600, color: "var(--text-accent)"
          }}>
            <Icon name="pin" size={13} />{t.murPrivEpingle}
          </span>
        ) : null}
        <button type="button" onClick={onBascule} className="lehno-focusable" style={{
          all: "unset", boxSizing: "border-box", cursor: "pointer",
          marginLeft: "auto", minHeight: "var(--touch-min)",
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
          color: epingle ? "var(--text-mention)" : "var(--text-accent)"
        }}>
          {epingle ? null : <Icon name="pin" size={14} />}
          {epingle ? t.murPrivDetacher : t.murPrivEpingler}
        </button>
      </div>
    </Card>
  );
}

export function MonMurScreen({ t, etat = "nominal", onglet = "page", onOpen, onFait }) {
  const [publie, setPublie] = React.useState(etat !== "prive");
  const [expose, setExpose] = React.useState(
    etat === "rienexpose" ? {} : { gouts: true, date: true, souhaits: true }
  );
  const [copie, setCopie] = React.useState(false);
  /* Deux moitiés distinctes : ce que la page montre, et ce qu'elle a reçu. Les
     empiler faisait défiler tout un panneau de réglages pour lire un mot, et
     deux rangs de « Moi » menaient au même haut d'écran. */
  const [vue, setVue] = React.useState(onglet === "mots" ? "mots" : "page");
  React.useEffect(() => { setVue(onglet === "mots" ? "mots" : "page"); }, [onglet]);
  const [epingles, setEpingles] = React.useState(etat === "epingle" ? { 0: true } : {});
  React.useEffect(() => {
    setPublie(etat !== "prive");
    setExpose(etat === "rienexpose" ? {} : { gouts: true, date: true, souhaits: true });
    setEpingles(etat === "epingle" ? { 0: true } : {});
    setCopie(false);
  }, [etat]);

  const bascule = (k) => setExpose((v) => ({ ...v, [k]: !v[k] }));
  const rien = !Object.values(expose).some(Boolean);
  const mots = t.murPrivMotsListe || [];

  React.useEffect(() => {
    if (!copie) return;
    const id = setTimeout(() => setCopie(false), 2200);
    return () => clearTimeout(id);
  }, [copie]);

  const onglets = [["page", t.murPrivOngletPage], ["mots", t.murPrivOngletMots(mots.length)]];

  return (
    <div style={{ padding: "0 16px 18px" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, margin: "4px 0 16px",
        padding: 4, borderRadius: "var(--radius-lg)", background: "var(--surface-panel)"
      }}>
        {onglets.map(([k, label]) => {
          const actif = vue === k;
          return (
            <button key={k} type="button" onClick={() => setVue(k)} aria-pressed={actif}
              className="lehno-focusable" style={{
                all: "unset", boxSizing: "border-box", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: 40, borderRadius: "var(--radius-md)", textAlign: "center",
                background: actif ? "var(--surface-card)" : "transparent",
                border: "1px solid " + (actif ? "var(--action)" : "transparent"),
                fontFamily: "var(--font-body)", fontSize: 14,
                fontWeight: actif ? 600 : 400,
                color: actif ? "var(--text-accent)" : "var(--text-secondary)"
              }}>{label}</button>
          );
        })}
      </div>

      {vue === "mots" ? null : (
      <>
      <Card padding={15} radius="lg">
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
        {/* Une adresse qu'on ne peut pas copier est une adresse qu'on recopie à
            la main. Le geste vit avec elle, pas dans un menu. */}
        {publie ? (
          <button type="button" onClick={() => setCopie(true)} className="lehno-focusable" style={{
            all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
            minHeight: "var(--touch-min)", marginTop: 4,
            display: "inline-flex", alignItems: "center", gap: 7,
            fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600,
            color: copie ? "var(--feedback-success)" : "var(--text-accent)"
          }}>
            <Icon name={copie ? "check" : "link"} size={15} />
            {copie ? t.murPrivCopie : t.murPrivCopier}
          </button>
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

      </>
      )}

      {vue === "page" ? null : (
      <div>
        {etat === "aucunmot" ? (
          <div style={{ marginTop: 6 }}>
            <EmptyState illustration="mur-aucun-mot"
              titre={t.murPrivAucunMotTitre} texte={t.murPrivAucunMotTexte} />
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: "var(--text-mention)", margin: "7px 0 4px" }}>
              {t.murPrivMotsCompte(mots.length)}
            </div>
            <p style={{
              margin: "0 0 11px", fontSize: 12.5, color: "var(--text-mention)", textWrap: "pretty"
            }}>{t.murPrivEpinglesAide}</p>
            <div style={{ display: "grid", gap: 10 }}>
              {mots.map((m, i) => (
                <Mot key={i} t={t} mot={m} epingle={!!epingles[i]}
                  onBascule={() => setEpingles((v) => ({ ...v, [i]: !v[i] }))} />
              ))}
            </div>
          </>
        )}
      </div>
      )}

      <div style={{ display: "grid", gap: 8, marginTop: 20 }}>
        <Button platform="mobile" full variant="outline" icon="eye"
          onClick={() => onOpen && onOpen("surface", { etat: "mur", nom: "Valentine" })}>
          {t.murPrivApercu}
        </Button>
        {publie ? (
          <Button platform="mobile" full variant="text" icon="external-link"
            onClick={() => onFait && onFait(t.murVoirDehors)}>
            {t.murPrivVoir}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
