import type { ReactNode } from "react";
import type { PublicWishForm } from "@lehno/contracts";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { dateEnToutesLettres } from "../../lib/dates.js";
import { interpoler } from "../../lib/texte.js";
import { PublicShell } from "../PublicShell.js";
import { FormulaireVoeu } from "./FormulaireVoeu.js";

/**
 * Le dépôt d'un mot pour l'anniversaire de quelqu'un.
 *
 * **La page s'ouvre même hors fenêtre**, et dit alors quand revenir : c'est le
 * dépôt qui refuse, pas la lecture (§3.9). Une page qui refuserait de se
 * charger ne pourrait pas donner la date, et le visiteur repartirait sans
 * savoir s'il s'est trompé de lien.
 *
 * Hors fenêtre, **le formulaire n'est pas grisé — il n'est pas là.** Un champ
 * désactivé se lit comme une panne ; une phrase qui dit la date se lit comme
 * une règle.
 */
export function DepotVoeu(
  { t, langue, jeton, formulaire }: {
    t: Messages; langue: Langue; jeton: string; formulaire: PublicWishForm;
  },
): ReactNode {
  const { recipientDisplayName, occurrenceDate, windowOpensOn, windowClosesOn, isOpen } = formulaire;

  /* Fermé AVANT ou APRÈS : deux phrases, parce qu'elles n'appellent pas la
     même chose. « Ça s'ouvre le 7 » invite à revenir ; « ça s'est refermé le
     7 » clôt. Les confondre en un « ce n'est pas ouvert » ferait attendre une
     réouverture qui n'aura pas lieu.
     La comparaison se fait sur les chaînes ISO, qui s'ordonnent comme les
     dates — pas de fuseau, pas de dérive d'un jour. */
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const attente = !isOpen && aujourdhui < windowOpensOn;

  const etatFenetre = isOpen
    ? interpoler(t.voeuxOuvertJusqu, { date: dateEnToutesLettres(windowClosesOn, langue) })
    : attente
      ? interpoler(t.voeuxAvantOuverture, { date: dateEnToutesLettres(windowOpensOn, langue) })
      : interpoler(t.voeuxApresFermeture, { date: dateEnToutesLettres(windowClosesOn, langue) });

  return (
    <PublicShell t={t} langue={langue}>
      <section
        style={{
          maxWidth: "var(--page-max)", margin: "0 auto",
          padding: "clamp(48px,8vw,88px) var(--page-gutter)",
          display: "grid", gap: "var(--space-24)",
        }}
      >
        <div>
          <h1
            className="titre"
            style={{
              fontWeight: "var(--font-display-medium)",
              fontSize: "clamp(28px,5vw,44px)",
              lineHeight: "var(--leading-display)",
              letterSpacing: "var(--tracking-display)",
              margin: 0, maxWidth: "22ch", textWrap: "balance",
            }}
          >
            {interpoler(t.voeuxTitre, { nom: recipientDisplayName })}
          </h1>
          <p style={{ margin: "var(--space-10) 0 0", color: "var(--text-secondary)" }}>
            {interpoler(t.voeuxOccasion, { date: dateEnToutesLettres(occurrenceDate, langue) })}
          </p>
        </div>

        <p style={{ margin: 0 }}>
          {etatFenetre}
          {isOpen ? null : <> {t.voeuxRevenir}</>}
        </p>

        {isOpen ? (
          <div style={{ maxWidth: "56ch" }}>
            <FormulaireVoeu t={t} jeton={jeton} />
          </div>
        ) : null}
      </section>
    </PublicShell>
  );
}
