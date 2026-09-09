import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { CreditIndicator } from "../../components/content/CreditIndicator.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";

/* Mes wishlists (3.29) — ce que je demande, rangé par occasion.
 *
 * UNE LISTE PAR OCCASION, ET UNE SANS. Un anniversaire n'attend pas les mêmes
 * choses qu'un déménagement, et certaines envies ne dépendent d'aucune date :
 * la liste sans occasion vaut d'une année sur l'autre.
 *
 * LE PARTAGE PASSE PAR L'APERÇU. On ne diffuse pas une page qu'on n'a pas vue :
 * « Partager » montre d'abord ce que verront les visiteurs, l'envoi vient après.
 *
 * L'ÉTAT DE CHAQUE SOUHAIT SE LIT ICI, mais côté propriétaire il reste sobre :
 * savoir qu'un souhait est réservé gâche la surprise, donc la liste dit
 * « réservé » sans dire par qui. C'est la fiche du souhait qui le nomme, quand
 * la personne a choisi de se faire connaître.
 */

export function ListesScreen({
  t, etat = "nominal", qui, souhaits = [], listes = [], mesDates = [], flags = {},
  onOpen, onLancer, onFait
}) {
  const [choisie, setChoisie] = React.useState(listes.length ? listes[0].id : null);
  const liste = listes.find((x) => x.id === choisie) || listes[0] || { nom: "", souhaits: [] };
  /* Créer une liste : un nom, et une occasion — l'une de mes dates, ou aucune.
     Sans occasion, la liste vaut d'une année sur l'autre, donc rien à clore. */
  const [creation, setCreation] = React.useState(etat === "creation");
  React.useEffect(() => { setCreation(etat === "creation"); }, [etat]);
  const [occasion, setOccasion] = React.useState(null);
  const [cloture, setCloture] = React.useState(true);

  if (creation) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
        <div style={{ padding: "var(--ry-haut) 16px 12px", flex: 1, display: "grid", gap: 18, alignContent: "start" }}>
          <h1 className="lehno-display" style={{
            fontSize: 21, letterSpacing: "-.02em", margin: 0, fontWeight: 500
          }}>{t.listeCreer}</h1>
          <TextField platform="mobile" autoFocus label={t.listeNouvNom}
            placeholder={t.listeNouvNomExemple} />

          <div>
            <SectionLabel>{t.listeNouvOccasion}</SectionLabel>
            <div style={{ display: "grid", gap: 2, marginTop: 9 }}>
              {[[null, t.listeNouvSansOccasion, t.listeNouvSansOccasionAide]]
                .concat(mesDates.map((d) => [d.id, d.quoi, d.quand]))
                .map(([k, nom, sous], i) => {
                  const actif = occasion === k;
                  return (
                    <button key={k || "aucune"} type="button" role="radio" aria-checked={actif}
                      onClick={() => setOccasion(k)} className="lehno-focusable" style={{
                        all: "unset", boxSizing: "border-box", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 11, padding: "11px 0",
                        minHeight: "var(--touch-min)",
                        borderTop: i ? "1px solid var(--border-hairline)" : "none"
                      }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: "50%", flex: "none",
                        display: "grid", placeItems: "center", boxSizing: "border-box",
                        border: "1px solid " + (actif ? "var(--action)" : "var(--border-object)")
                      }}>
                        {actif ? <span style={{
                          width: 10, height: 10, borderRadius: "50%", background: "var(--action)"
                        }} /> : null}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 14.5 }}>{nom}</span>
                        <span style={{ fontSize: 12.5, color: "var(--text-mention)" }}>{sous}</span>
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {occasion ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, minHeight: "var(--touch-min)"
            }}>
              <span style={{ flex: 1, fontSize: 14.5 }}>{t.listeNouvCloture}</span>
              <button type="button" role="switch" aria-checked={cloture}
                aria-label={t.listeNouvCloture} onClick={() => setCloture((v) => !v)}
                className="lehno-focusable" style={{
                  all: "unset", cursor: "pointer", flex: "none", width: 44, height: 26,
                  borderRadius: 999, padding: 3, boxSizing: "border-box",
                  background: cloture ? "var(--action)" : "var(--border-object)",
                  transition: "background var(--transition-state)"
                }}>
                <span style={{
                  display: "block", width: 20, height: 20, borderRadius: "50%",
                  background: "var(--surface-page)",
                  transform: cloture ? "translateX(18px)" : "translateX(0)",
                  transition: "transform var(--transition-state)"
                }} />
              </button>
            </div>
          ) : null}
        </div>

        <div style={{ padding: "0 16px 16px", flex: "none", display: "grid", gap: 8 }}>
          <Button platform="mobile" full onClick={() => {
            setCreation(false);
            if (onFait) onFait(t.listeNouvFait);
          }}>{t.enregistrer}</Button>
          <Button platform="mobile" full variant="text"
            onClick={() => setCreation(false)}>{t.feuillePasMaintenant}</Button>
        </div>
      </div>
    );
  }

  if (qui) {
    const pastille = (s) => s.etat === "offert" ? t.souhaitOffertEtat
      : s.etat === "ecarte" ? t.souhaitEcarte
      : s.etat === "retenu" ? t.listeRetenu : null;
    return (
      <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "var(--ry-haut) 16px 12px", flex: 1, minHeight: 0, overflowY: "auto" }}>
          <h1 className="lehno-display" style={{
            fontSize: 22, letterSpacing: "-.02em", margin: "0 0 var(--ry-item)", fontWeight: 500
          }}>{t.listeDe(qui)}</h1>

          <div style={{
            border: "1px solid var(--border-object)", borderRadius: "var(--radius-lg)",
            overflow: "hidden"
          }}>
            {souhaits.map((s, i) => (
              <button key={s.id} type="button"
                onClick={() => onOpen && onOpen("souhait", { ...s, mien: false, pour: qui })}
                className="lehno-focusable" style={{
                  all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
                  display: "flex", alignItems: "center", gap: 12, padding: "13px 14px",
                  minHeight: "var(--touch-min)",
                  borderTop: i ? "1px solid var(--border-hairline)" : "none"
                }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="lehno-display" style={{
                    fontSize: 16, display: "block", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis"
                  }}>{s.quoi}</span>
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{s.prix}</span>
                </span>
                {pastille(s) ? (
                  <Tag tone="quiet" style={{ fontSize: 11, padding: "2px 9px", flex: "none" }}>
                    {pastille(s)}
                  </Tag>
                ) : null}
                <Icon name="chevron-right" size={15} color="var(--text-mention)" style={{ flex: "none" }} />
              </button>
            ))}
          </div>
        </div>

        {/* Deux façons d'allonger la liste : la sienne, ou celle que Lehno
            propose — et celle-là se paie, donc elle le dit. */}
        <div style={{ flex: "none", padding: "8px 16px 12px", display: "grid", gap: 8 }}>
          <Button platform="mobile" full variant="outline" icon="plus"
            onClick={() => onOpen && onOpen("souhait", { nouveau: true, mien: false, pour: qui })}>{t.souhaitAjouter}</Button>
          <div>
            <Button platform="mobile" full icon="sparkles"
              onClick={() => onLancer && onLancer("idees")}>{t.listeChercher}</Button>
            {flags.credits === false ? null : (
              <CreditIndicator t={t} cout={1} style={{ marginTop: 7 }} />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (etat === "vide") {
    return (
      <div style={{
        padding: "8px 16px 18px", minHeight: "100%", display: "flex",
        flexDirection: "column", justifyContent: "center"
      }}>
        <EmptyState illustration="souhaits-vide" titre={t.videListesTitre}
          texte={t.videListesTexte} action={t.listeCreer}
          onAction={() => setCreation(true)} />
      </div>
    );
  }

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "var(--ry-haut) 16px 12px", flex: 1, minHeight: 0, overflowY: "auto" }}>
        {/* Les listes en tête : on passe de l'une à l'autre sans revenir. */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: "var(--ry-bloc)" }}>
          {listes.map((l) => {
            const actif = l.id === liste.id;
            return (
              <button key={l.id} type="button" onClick={() => setChoisie(l.id)}
                aria-pressed={actif} className="lehno-focusable" style={{
                  all: "unset", boxSizing: "border-box", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", minHeight: 38,
                  padding: "0 14px", borderRadius: "var(--radius-pill)",
                  border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
                  background: actif ? "var(--action)" : "transparent",
                  fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
                  color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
                }}>{l.nom}</button>
            );
          })}
          <button type="button" onClick={() => setCreation(true)}
            aria-label={t.listeCreer} className="lehno-focusable" style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer",
              display: "grid", placeItems: "center", width: 38, minHeight: 38,
              borderRadius: "var(--radius-pill)",
              border: "1px dashed var(--border-object)", color: "var(--text-accent)"
            }}><Icon name="plus" size={15} strokeWidth={2} /></button>
        </div>

        <div style={{
          display: "flex", alignItems: "baseline", gap: 8, marginBottom: "var(--ry-item)"
        }}>
          <h1 className="lehno-display" style={{
            fontSize: 22, letterSpacing: "-.02em", margin: 0, fontWeight: 500, flex: 1
          }}>{liste.nom}</h1>
          <span style={{ fontSize: 12.5, color: "var(--text-mention)" }}>
            {liste.quand || t.listeSansDate}
          </span>
        </div>

        <div style={{
          border: "1px solid var(--border-object)", borderRadius: "var(--radius-lg)",
          overflow: "hidden"
        }}>
          {liste.souhaits.map((s, i) => (
            <button key={s.id} type="button" onClick={() => onOpen && onOpen("souhait", s)}
              className="lehno-focusable" style={{
                all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
                display: "flex", alignItems: "center", gap: 12, padding: "13px 14px",
                minHeight: "var(--touch-min)",
                borderTop: i ? "1px solid var(--border-hairline)" : "none"
              }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="lehno-display" style={{ fontSize: 16, display: "block" }}>{s.quoi}</span>
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{s.prix}</span>
              </span>
              {s.etat ? (
                <Tag tone="quiet" style={{ fontSize: 11, padding: "2px 9px", flex: "none" }}>
                  {s.etat === "reserve" ? t.souhaitReserve : t.souhaitOffertEtat}
                </Tag>
              ) : null}
              <Icon name="chevron-right" size={15} color="var(--text-mention)" style={{ flex: "none" }} />
            </button>
          ))}
        </div>

        <Button platform="mobile" full variant="outline" icon="plus"
          style={{ marginTop: "var(--ry-item)" }}
          onClick={() => onOpen && onOpen("souhait", { nouveau: true })}>{t.souhaitAjouter}</Button>
      </div>

      {/* On regarde avant de diffuser : le partage passe par l'aperçu. */}
      <div style={{ flex: "none", padding: "8px 16px 12px" }}>
        <Button platform="mobile" full icon="eye"
          onClick={() => onOpen && onOpen("surface", { etat: "liste", nom: "Valentine", listeId: liste.id })}>
          {t.listeApercu}
        </Button>
      </div>
    </div>
  );
}
