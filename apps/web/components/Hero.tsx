import type { ReactNode } from "react";
import type { Langue } from "../lib/langues";
import type { Messages } from "../messages";
import { FormulaireAttente } from "./FormulaireAttente";
import { BadgesMagasins } from "./BadgesMagasins";
import { Telephone } from "./Telephone";
import { ApercuApplication } from "./ApercuApplication";

// Deux états, un seul drapeau : avant lancement on prend une adresse, après on
// renvoie vers les magasins. Rien d'autre ne change dans le héros.
export function Hero(
  { t, langue, avantLancement }: { t: Messages; langue: Langue; avantLancement: boolean },
): ReactNode {
  return (
    <section
      className="hero-grille"
      style={{
        maxWidth: 1160, margin: "0 auto",
        padding: "clamp(36px,6vw,76px) 20px clamp(44px,7vw,84px)",
        display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
        gap: "clamp(32px,5vw,64px)", alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          className="titre"
          style={{
            fontWeight: 500, fontSize: "clamp(40px,7.5vw,76px)", lineHeight: 1.02,
            letterSpacing: "-.035em", margin: 0, textWrap: "balance",
          }}
        >
          {t.heroTitre}
        </h1>
        <p style={{ fontSize: "clamp(17px,2.2vw,21px)", lineHeight: 1.5, color: "var(--muted)", maxWidth: "34ch", margin: "22px 0 0", textWrap: "pretty" }}>
          {t.heroSous}
        </p>
        <div id="commencer" style={{ marginTop: 32 }}>
          {avantLancement ? <FormulaireAttente t={t} /> : <BadgesMagasins t={t} langue={langue} />}
        </div>
      </div>

      <div style={{ background: "var(--panel)", borderRadius: 28, padding: "clamp(24px,4vw,44px) 20px 0", display: "flex", justifyContent: "center", minWidth: 0 }}>
        <Telephone><ApercuApplication t={t} /></Telephone>
      </div>
    </section>
  );
}
