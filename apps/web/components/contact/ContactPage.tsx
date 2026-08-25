import type { ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { PublicShell } from "../PublicShell.js";
import { Card, Icon, SocialGlyph } from "../ui/index.js";
import type { Plateforme } from "../ui/index.js";
import { ContactForm } from "./ContactForm.js";

// Les six comptes publics de Lehno, dans l'ordre de la maquette
// (design_handoff_surfaces_publiques/ui_kits/web/pages.html, table « contact »).
// Mêmes poignées en français et en anglais : ce ne sont pas des libellés, mais
// des identifiants de compte — ils ne vivent donc pas dans messages/.
const RESEAUX: { plateforme: Plateforme; compte: string; url: string }[] = [
  { plateforme: "instagram", compte: "@lehno.app", url: "https://instagram.com/lehno.app" },
  { plateforme: "tiktok", compte: "@lehno.app", url: "https://tiktok.com/@lehno.app" },
  { plateforme: "x", compte: "@lehnoapp", url: "https://x.com/lehnoapp" },
  { plateforme: "linkedin", compte: "Lehno", url: "https://linkedin.com/company/lehno" },
  { plateforme: "facebook", compte: "lehno.app", url: "https://facebook.com/lehno.app" },
  { plateforme: "youtube", compte: "@lehno", url: "https://youtube.com/@lehno" },
];

/** La page contact. Deux canaux, comme la maquette
 *  (design_handoff_surfaces_publiques/ui_kits/web/ContactPage.jsx) : le
 *  formulaire, reçu par apps/api/src/public/contact, et les comptes publics
 *  des réseaux. Une liste de moyens de contact est une liste de promesses —
 *  ni l'un ni l'autre n'est là pour la forme. */
export function ContactPage({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  return (
    <PublicShell t={t} langue={langue}>
        <div
          style={{
            maxWidth: "var(--page-max)", margin: "0 auto",
            padding: "var(--section-pad-y) var(--page-gutter)",
          }}
        >
          {/* Pas de <header> ici : imbriqué sous <main>, il resterait sans
              rôle exposé pour la plupart des lecteurs d'écran, mais certains
              moteurs de rôle ARIA le comptent quand même comme un second
              bandeau — <div> lève toute ambiguïté avec le vrai bandeau du site. */}
          <div style={{ marginBottom: "var(--space-40)", maxWidth: "var(--measure)" }}>
            <div className="surtitre" style={{ color: "var(--text-mention)", marginBottom: "var(--space-12)" }}>
              {t.contactKicker}
            </div>
            <h1
              className="titre"
              style={{
                margin: 0, fontWeight: "var(--font-display-regular)",
                fontSize: "clamp(34px,4.4vw,52px)", lineHeight: "var(--leading-display)",
                textWrap: "balance",
              }}
            >
              {t.contactTitre}
            </h1>
            <p
              style={{
                margin: "var(--space-16) 0 0", fontSize: "var(--text-body-l)",
                lineHeight: "var(--leading-roomy)", color: "var(--text-secondary)", textWrap: "pretty",
              }}
            >
              {t.contactChapeau}
            </p>
          </div>

          <div
            style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
              gap: "var(--space-32)", alignItems: "start",
            }}
          >
            <Card surface="card" radius="2xl">
              <ContactForm t={t} />
            </Card>

            <Card surface="panel" radius="2xl">
              <h2
                className="titre"
                style={{ margin: "0 0 var(--space-4)", fontWeight: "var(--font-display-medium)", fontSize: "var(--text-display-xs)" }}
              >
                {t.contactAilleursTitre}
              </h2>
              <p
                style={{
                  margin: "0 0 var(--space-16)", fontSize: "var(--text-body-s)",
                  lineHeight: "var(--leading-roomy)", color: "var(--text-secondary)",
                }}
              >
                {t.contactAilleursTexte}
              </p>
              <div style={{ display: "grid" }}>
                {RESEAUX.map(({ plateforme, compte, url }, index) => (
                  <a
                    key={plateforme}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: "var(--space-10)",
                      minHeight: "var(--touch-min)", padding: "var(--space-6) 0",
                      textDecoration: "none", color: "var(--text-body)", fontSize: "var(--text-body-s)",
                      borderTop: index > 0 ? "var(--border-width) solid var(--border-hairline)" : undefined,
                    }}
                  >
                    <SocialGlyph platform={plateforme} size={17} />
                    <span style={{ flex: 1, minWidth: 0 }}>{compte}</span>
                    <Icon name="arrow-up-right" size={15} color="var(--text-mention)" />
                  </a>
                ))}
              </div>
            </Card>
          </div>
        </div>
    </PublicShell>
  );
}
