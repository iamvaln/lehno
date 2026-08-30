"use client";

import { useState, type ReactNode } from "react";
import type { PublicWishForm } from "@lehno/contracts";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { dateEnToutesLettres } from "../../lib/dates.js";
import { interpoler } from "../../lib/texte.js";
import { PublicShell } from "../PublicShell.js";
import { Banner, Countdown } from "../ui/index.js";
import { FormulaireVoeu } from "./FormulaireVoeu.js";

/**
 * Le dépôt d'un mot pour l'anniversaire de quelqu'un — silhouette « billet ».
 *
 * **La page s'ouvre même hors fenêtre**, et dit alors quand revenir : c'est le
 * dépôt qui refuse, pas la lecture (§3.9). Une page qui refuserait de se
 * charger ne pourrait pas donner la date, et le visiteur repartirait sans
 * savoir s'il s'est trompé de lien.
 *
 * Hors fenêtre, **le formulaire n'est pas grisé — il n'est pas là.** Un champ
 * désactivé se lit comme une panne ; une phrase qui dit la date se lit comme
 * une règle.
 *
 * Le décompte est ramené à la ligne de contexte : il dit pourquoi la page est
 * ouverte aujourd'hui, il n'est pas la vedette.
 *
 * Composant CLIENT, et pour une seule raison : **l'invitation de pied change
 * après le geste**. Avant, le générique — promettre « ayez votre Mur » à
 * quelqu'un qui n'a pas encore écrit, c'est lui parler d'autre chose que de ce
 * qu'il est venu faire.
 */
export function DepotVoeu(
  { t, langue, jeton, formulaire, joursRestants, aujourdhui }: {
    t: Messages; langue: Langue; jeton: string;
    formulaire: PublicWishForm;
    /** Calculés par la page, jamais ici : le rendu serveur et le rendu client
     *  liraient deux horloges, et l'hydratation s'en plaindrait. */
    joursRestants: number;
    aujourdhui: string;
  },
): ReactNode {
  const [envoye, setEnvoye] = useState(false);
  const { recipientDisplayName, windowOpensOn, windowClosesOn, isOpen } = formulaire;

  /* Fermé AVANT ou APRÈS : deux phrases, parce qu'elles n'appellent pas la
     même chose. « Ça s'ouvre le 7 » invite à revenir ; « ça s'est refermé le
     7 » clôt. Les confondre en un « ce n'est pas ouvert » ferait attendre une
     réouverture qui n'aura pas lieu.
     La comparaison se fait sur les chaînes ISO, qui s'ordonnent comme les
     dates — pas de fuseau, pas de dérive d'un jour. */
  const etatFenetre = aujourdhui < windowOpensOn
    ? interpoler(t.voeuxAvantOuverture, { date: dateEnToutesLettres(windowOpensOn, langue) })
    : interpoler(t.voeuxApresFermeture, { date: dateEnToutesLettres(windowClosesOn, langue) });

  return (
    <PublicShell
      t={t} langue={langue}
      // Avant le geste, le générique : la coquille le pose quand la prop est
      // absente. `exactOptionalPropertyTypes` interdit de passer `undefined`,
      // et c'est tant mieux — « absente » et « nulle » ne se confondent pas.
      {...(envoye
        ? { acquisition: { titre: t.acqVoeuxTitre, texte: t.acqVoeuxTexte, action: t.acqVoeuxAction } }
        : {})}
    >
      <section
        style={{
          maxWidth: "52rem", margin: "0 auto",
          padding: "clamp(40px,7vw,72px) var(--page-gutter)",
        }}
      >
        {envoye ? (
          <>
            <div style={{ marginBottom: "var(--space-20)" }}>
              <Banner intent="success">{t.voeuxConfirmeTitre}</Banner>
            </div>
            <p style={{ margin: 0, textWrap: "pretty" }}>{t.voeuxConfirmeTexte}</p>
          </>
        ) : (
          <>
            <div
              style={{
                display: "flex", alignItems: "baseline", gap: "var(--space-10)",
                flexWrap: "wrap", marginBottom: "var(--space-10)",
              }}
            >
              <Countdown days={joursRestants} locale={langue} size="s" />
              <span style={{ color: "var(--text-secondary)" }}>
                {interpoler(t.voeuxContexte, { nom: recipientDisplayName })}
              </span>
            </div>

            <h1
              className="titre"
              style={{
                margin: "0 0 var(--space-20)",
                fontWeight: "var(--font-display-regular)",
                fontSize: "clamp(26px,3.4vw,34px)",
                lineHeight: "var(--leading-display)",
                letterSpacing: "var(--tracking-display)",
                textWrap: "balance",
              }}
            >
              {interpoler(t.voeuxTitre, { nom: recipientDisplayName })}
            </h1>

            {isOpen ? (
              <FormulaireVoeu t={t} jeton={jeton} onEnvoye={() => setEnvoye(true)} />
            ) : (
              <p style={{ margin: 0, maxWidth: "56ch", textWrap: "pretty" }}>
                {etatFenetre} {t.voeuxRevenir}
              </p>
            )}
          </>
        )}
      </section>
    </PublicShell>
  );
}
