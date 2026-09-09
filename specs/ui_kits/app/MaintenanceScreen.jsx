import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { Wordmark } from "../../components/brand/Wordmark.jsx";

/* Maintenance (3.30) — l'écran qu'on voit quand l'application ne répond pas.
 *
 * IL N'EXPLIQUE PAS, IL OCCUPE LE TEMPS. Une page de maintenance qui détaille
 * l'incident demande à l'utilisateur de s'intéresser à nos affaires. Elle dit
 * ce qui se passe en une ligne, l'heure de retour quand on la connaît, et donne
 * quelque chose à regarder pendant ce temps-là.
 *
 * L'ANIMATION EST UN MOIS QUI SE REMPLIT. La grille d'un calendrier, une vague
 * diagonale qui allume les cases l'une après l'autre puis les laisse retomber ;
 * une seule case garde l'abricot — le jour J. Le vocabulaire de Lehno est le
 * temps qui avance, pas un sablier ni un spinner.
 *
 * `prefers-reduced-motion` la remplace par la même grille, immobile : la mise en
 * page ne bouge pas, seul le mouvement disparaît.
 *
 * PAS DE BOUTON PRINCIPAL. Réessayer est un geste en contour : le résultat ne
 * dépend pas de l'utilisateur, et un bouton pleine teinte promettrait le
 * contraire. */

const COLONNES = 7;
const LIGNES = 5;
const JOUR = 24;

export function MaintenanceScreen({ t, etat = "nominal", base = "../../", onReessayer, onFait }) {
  const heure = etat === "heure";
  const cases = Array.from({ length: COLONNES * LIGNES }, (_, i) => ({
    i,
    /* La vague est diagonale : le retard suit la somme ligne + colonne. */
    retard: ((Math.floor(i / COLONNES) + (i % COLONNES)) * 0.18).toFixed(2)
  }));

  return (
    <div style={{
      minHeight: "100%", boxSizing: "border-box", padding: "28px 24px 24px",
      display: "flex", flexDirection: "column", alignItems: "center",
      textAlign: "center", background: "var(--surface-page)"
    }}>
      <style>{`
        @keyframes lehno-maint-remplit {
          0%, 100% { opacity: .22; transform: scale(1); }
          22% { opacity: .85; transform: scale(1.12); }
          48% { opacity: .22; transform: scale(1); }
        }
        @keyframes lehno-maint-jour {
          0%, 100% { transform: scale(1); }
          22% { transform: scale(1.28); }
        }
        @keyframes lehno-maint-souffle {
          0%, 100% { opacity: .55; }
          50% { opacity: 1; }
        }
        .lehno-maint-case { animation: lehno-maint-remplit 4.6s ease-in-out infinite; }
        .lehno-maint-jour { animation: lehno-maint-jour 4.6s ease-in-out infinite; }
        .lehno-maint-mot { animation: lehno-maint-souffle 4.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .lehno-maint-case, .lehno-maint-jour, .lehno-maint-mot { animation: none; }
          .lehno-maint-case { opacity: .3; }
        }
      `}</style>

      <Wordmark base={base} variant={t.nuit ? "blanc" : "couleur"} height={22}
        style={{ marginBottom: "auto", opacity: .9 }} />

      {/* Le mois qui se remplit. */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(" + COLONNES + ", 14px)",
        gap: 10, margin: "0 0 30px"
      }}>
        {cases.map(({ i, retard }) => (
          i === JOUR ? (
            <span key={i} className="lehno-maint-jour" style={{
              width: 14, height: 14, borderRadius: "50%",
              background: "var(--celebrate)", animationDelay: retard + "s"
            }} />
          ) : (
            <span key={i} className="lehno-maint-case" style={{
              width: 14, height: 14, borderRadius: 4,
              background: "var(--action)", animationDelay: retard + "s"
            }} />
          )
        ))}
      </div>

      <h1 className="lehno-display lehno-maint-mot" style={{
        fontSize: 27, letterSpacing: "-.025em", fontWeight: 500, margin: 0, maxWidth: "18ch"
      }}>{t.maintTitre}</h1>

      <p style={{
        margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.55,
        color: "var(--text-secondary)", maxWidth: "30ch"
      }}>{heure ? t.maintHeure(t.maintHeureExemple) : t.maintTexte}</p>

      {/* Un seul geste : un lien « état du service » aurait renvoyé vers une
          page qui n'existe pas, depuis l'écran qui annonce la panne. */}
      <div style={{ marginTop: "auto", width: "100%" }}>
        <Button platform="mobile" full variant="outline" icon="refresh-cw"
          onClick={onReessayer}>{t.maintReessayer}</Button>
      </div>
    </div>
  );
}
