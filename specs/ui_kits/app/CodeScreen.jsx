import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Banner } from "../../components/feedback/Banner.jsx";
import { Illustration } from "../../components/brand/Illustration.jsx";

/* Le code a deux horloges. Celle de sa validité (dix minutes) rassure : elle
   dit qu'on a le temps. Celle du renvoi (trente secondes) retient : elle empêche
   de réclamer un second code avant que le premier soit arrivé. La première
   s'affiche tant qu'elle court, la seconde ne s'affiche que tant qu'elle bloque. */
const VALIDITE = 600;
const RENVOI = 30;

/* Sous la minute on ne compose plus « 0 min 48 » : on dit les secondes. Et les
   secondes portent leur unité — sans elle, « 9 min 48 » se lit comme un nombre
   décimal. En anglais, la même règle avec « min » et « s ». */
function duree(total, langue) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (!m) return s + " s";
  return m + " min " + String(s).padStart(2, "0") + " s";
}

/* Sur un SE, la page dépassait de quatre-vingts pixels : on faisait défiler
   pour atteindre « Valider », sur l'écran le plus court du parcours. Rien n'est
   retiré — l'illustration, le titre et les blancs se resserrent, ce qui suffit.
   Les cases restent à 44 px de côté : c'est la cible tactile, pas une marge. */
const SERRE = `
.lehno-code-ill { width: 140px; margin: 10px auto 0; line-height: 0; }
.lehno-code-ill svg, .lehno-code-ill img { width: 100%; height: auto; }
.lehno-code-titre { font-size: 23px; margin: 10px 0 6px; }
.lehno-code-texte { margin-bottom: 22px; }
.lehno-code-case { width: 42px; height: 52px; font-size: 24px; }
.lehno-code-valider { margin-top: 18px; }
[data-modele="se"] .lehno-code-ill { width: 84px; margin-top: 0; }
[data-modele="se"] .lehno-code-titre { font-size: 21px; margin-top: 6px; }
[data-modele="se"] .lehno-code-texte { margin-bottom: 12px; }
[data-modele="se"] .lehno-code-case { width: 38px; height: 44px; font-size: 22px; }
[data-modele="se"] .lehno-code-valider { margin-top: 10px; }
`;

export function CodeScreen({ t, etat = "nominal", onRetour, onSuite }) {
  const expire = etat === "expire";
  const [reste, setReste] = React.useState(expire ? 0 : VALIDITE);
  const [avantRenvoi, setAvantRenvoi] = React.useState(expire ? 0 : RENVOI);

  React.useEffect(() => {
    const t = setInterval(() => {
      setReste((v) => (v > 0 ? v - 1 : 0));
      setAvantRenvoi((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const perime = reste === 0;
  const renvoyer = () => { setReste(VALIDITE); setAvantRenvoi(RENVOI); };

  const chiffres = etat === "erreur" ? ["4", "1", "9", "2", "", ""]
    : perime ? ["", "", "", "", "", ""] : ["4", "1", "9", "", "", ""];
  return (
    <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <button type="button" onClick={onRetour} aria-label={t.retour} className="lehno-focusable"
        style={{
          all: "unset", cursor: "pointer", color: "var(--text-body)", alignSelf: "flex-start",
          minWidth: "var(--touch-min)", minHeight: "var(--touch-min)",
          display: "grid", placeItems: "center", marginLeft: -11
        }}>
        <Icon name="chevron-left" size={22} />
      </button>

      <style>{SERRE}</style>

      <div className="lehno-code-ill">
        <Illustration nom="verification-code" largeur={140} />
      </div>

      <h1 className="lehno-display lehno-code-titre" style={{
        letterSpacing: "-.02em", fontWeight: 500, textAlign: "center"
      }}>{t.codeTitre}</h1>
      <p style={{
        margin: 0, fontSize: 14.5, color: "var(--text-secondary)",
        textAlign: "center", maxWidth: "32ch", marginInline: "auto"
      }} className="lehno-code-texte">{t.codeTexte}</p>

      {etat === "erreur" ? (
        <Banner intent="error" style={{ margin: "0 -20px 18px" }}>{t.codeErreur}</Banner>
      ) : perime ? (
        <Banner intent="warning" style={{ margin: "0 -20px 18px" }}>{t.codeExpire}</Banner>
      ) : null}

      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {chiffres.map((c, i) => (
          <div key={i} className="lehno-code-case" style={{
            borderRadius: "var(--radius-sm)",
            border: "1px solid " + (etat === "erreur" ? "var(--feedback-error)"
              : c ? "var(--action)" : "var(--border-object)"),
            display: "grid", placeItems: "center",
            fontFamily: "var(--font-display)", fontVariationSettings: "var(--font-display-settings)",
            fontSize: 24, fontWeight: 500, color: "var(--text-body)"
          }}>{c}</div>
        ))}
      </div>

      {/* La validité se dit sous les cases, là où l'on tape : c'est là que la
          question se pose. Elle disparaît quand le code est périmé — le bandeau
          l'a déjà dit, et deux fois vaut une fois. */}
      {perime ? null : (
        <p style={{
          margin: "12px 0 0", fontSize: 12.5, color: "var(--text-mention)", textAlign: "center"
        }}>{t.codeValidite(duree(reste, t.langue))}</p>
      )}

      <div className="lehno-code-valider">
        <Button platform="mobile" full disabled={perime}
          onClick={onSuite}>{t.valider}</Button>
      </div>

      <Button platform="mobile" full variant="text" style={{ marginTop: 4 }}
        disabled={avantRenvoi > 0} onClick={renvoyer}>
        {avantRenvoi > 0 ? t.codeRenvoiAttente(avantRenvoi) : t.renvoyerCode}
      </Button>
    </div>
  );
}
