import type { CSSProperties, ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { Avatar, Tag } from "../ui/index.js";
import { Telephone } from "../Telephone.js";

// L'aperçu du Mur : la page qu'un utilisateur partage à ses proches. Deux
// colonnes — ce que le Mur apporte, et à quoi il ressemble sur un téléphone.
//
// Cette section avait disparu du code lors de la refonte de la landing, avec
// l'ancien composant ApercuMur, sans que rien ne le signale. Le test
// test/landing-sections.test.tsx compare désormais les ancres de la maquette
// à celles que la page rend, pour qu'une section ne puisse plus s'évaporer.

const SURTITRE: CSSProperties = {
  fontSize: "var(--text-kicker)",
  letterSpacing: "var(--tracking-kicker)",
  textTransform: "uppercase",
  color: "var(--text-mention)",
  fontWeight: "var(--font-body-semibold)",
};

export function WallPreview({ t, langue, ouvert }: { t: Messages; langue: Langue;
    /** Une fonctionnalité est-elle ouverte ? Le serveur a déjà résolu les
     *  dépendances ; la page ne connaît aucune règle. */
    ouvert: (cle: string) => boolean;
  }): ReactNode {
  const points: { titre: string; texte: string }[] = [
    { titre: t.murPoint1Titre, texte: t.murPoint1 },
    { titre: t.murPoint2Titre, texte: t.murPoint2 },
    { titre: t.murPoint3Titre, texte: t.murPoint3 },
  ];

  return (
    <section id="mur" style={{ background: "var(--surface-panel)" }}>
      <div
        style={{
          maxWidth: "var(--page-max)", margin: "0 auto",
          padding: "clamp(52px,7vw,92px) var(--page-gutter) clamp(44px,6vw,80px)",
        }}
      >
        <div
          style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
            gap: "clamp(28px,4vw,56px)", alignItems: "center",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              className="titre"
              style={{
                fontWeight: "var(--font-display-medium)", fontSize: "var(--text-display-m)",
                letterSpacing: "var(--tracking-display)", lineHeight: "var(--leading-display)",
                margin: "0 0 var(--space-14)", textWrap: "balance",
              }}
            >
              {t.murTitre}
            </h2>
            <p
              style={{
                margin: 0, color: "var(--text-secondary)",
                fontSize: "var(--text-body-l)", maxWidth: "var(--measure)",
              }}
            >
              {t.murTexte}
            </p>

            {/* Filets entre les points plutôt que des cartes : la liste se lit
                d'un trait, et rien ne vient concurrencer le téléphone à côté. */}
            <div
              style={{
                display: "grid", gap: 0,
                marginTop: "clamp(22px,3vw,30px)", maxWidth: "var(--measure)",
              }}
            >
              {points.map((point, rang) => (
                <div
                  key={point.titre}
                  style={{
                    borderTop: "var(--border-width) solid var(--border-hairline)",
                    borderBottom: rang === points.length - 1
                      ? "var(--border-width) solid var(--border-hairline)"
                      : undefined,
                    padding: "var(--space-14) 0",
                  }}
                >
                  <div
                    className="titre"
                    style={{
                      fontSize: "var(--text-body-l)", fontWeight: "var(--font-display-medium)",
                      letterSpacing: "var(--tracking-title)",
                    }}
                  >
                    {point.titre}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-body-s)", color: "var(--text-secondary)",
                      marginTop: "var(--space-2)",
                    }}
                  >
                    {point.texte}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", minWidth: 0 }}>
            <Telephone>
              <div
                style={{
                  background: "var(--surface-page)", height: "100%", boxSizing: "border-box",
                  overflow: "hidden", fontFamily: "var(--font-body)", color: "var(--text-body)",
                }}
              >
                <div
                  style={{
                    background: "var(--surface-panel)",
                    padding: "var(--space-44) var(--space-24) var(--space-14)",
                    textAlign: "center",
                  }}
                >
                  <Avatar
                    name="Valentine"
                    src="/portraits/valentine.jpg"
                    size={52}
                    style={{ margin: "0 auto var(--space-8)" }}
                  />
                  <div
                    className="titre"
                    style={{
                      fontSize: "var(--text-display-xs)", fontWeight: "var(--font-display-medium)",
                      letterSpacing: "var(--tracking-title)", lineHeight: "var(--leading-title)",
                    }}
                  >
                    {t.murHello}
                  </div>
                  <div
                    className="citation"
                    style={{
                      fontSize: "var(--text-body-s)", color: "var(--text-secondary)",
                      marginTop: "var(--space-6)",
                    }}
                  >
                    {t.murSous}
                  </div>
                </div>

                <div style={{ padding: "var(--space-14) var(--space-16) var(--space-12)" }}>
                  <div style={SURTITRE}>{t.murAime}</div>
                  <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap", marginTop: "var(--space-8)" }}>
                    {[t.murTag1, t.murTag2, t.murTag3].map((tag) => (
                      <Tag key={tag} tone="outline">{tag}</Tag>
                    ))}
                  </div>

                  {/* Ce qu'on évite se dit en pointillé : la même forme que les
                      goûts, mais une bordure qui n'affirme pas. */}
                  <div style={{ ...SURTITRE, marginTop: "var(--space-10)" }}>{t.murEvite}</div>
                  <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap", marginTop: "var(--space-8)" }}>
                    {[t.murNo1, t.murNo2].map((no) => (
                      <span
                        key={no}
                        style={{
                          border: "var(--border-width) dashed var(--border-hairline)",
                          borderRadius: "var(--radius-pill)",
                          padding: "var(--space-4) var(--space-12)",
                          fontSize: "var(--text-body-s)", color: "var(--text-secondary)",
                        }}
                      >
                        {no}
                      </span>
                    ))}
                  </div>

                  <div style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)", marginTop: "var(--space-10)" }}>
                    {t.murDate}
                  </div>

                  <div
                    style={{
                      border: "var(--border-width) solid var(--action)",
                      borderRadius: "var(--radius-lg)", padding: "var(--space-10)",
                      textAlign: "center", marginTop: "var(--space-10)",
                    }}
                  >
                    <div style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)" }}>{t.murIdee}</div>
                    {/* La liste ne s'annonce que si elle existe. */}
                    {ouvert("wishlist.own") ? (
                      <div
                        style={{
                          marginTop: "var(--space-8)", color: "var(--text-accent)",
                          border: "var(--border-width) solid var(--action)",
                          borderRadius: "var(--radius-md)", padding: "var(--space-6)",
                          fontSize: "var(--text-body-s)", fontWeight: "var(--font-body-semibold)",
                        }}
                      >
                        {t.murListe}
                      </div>
                    ) : null}
                  </div>

                  {/* Et le mot ne se propose que si on peut en déposer un. */}
                  {ouvert("wishes") ? (
                    <div
                      style={{
                        marginTop: "var(--space-8)", background: "var(--action)",
                        color: "var(--text-on-accent)", textAlign: "center",
                        borderRadius: "var(--radius-md)", padding: "var(--space-10)",
                        fontWeight: "var(--font-body-semibold)", fontSize: "var(--text-body-m)",
                      }}
                    >
                      {t.murMot}
                    </div>
                  ) : null}

                  {/* Le pied du Mur déborde des marges du téléphone : c'est la
                      seule chose de cet aperçu qui parle au visiteur plutôt
                      qu'au propriétaire, et elle doit se distinguer. */}
                  <div
                    style={{
                      margin: "var(--space-10) calc(var(--space-16) * -1) calc(var(--space-12) * -1)",
                      background: "var(--surface-panel)",
                      padding: "var(--space-12) var(--space-16) var(--space-14)",
                      textAlign: "center",
                    }}
                  >
                    <div
                      className="titre"
                      style={{
                        fontSize: "var(--text-body-m)", fontWeight: "var(--font-display-medium)",
                        letterSpacing: "var(--tracking-title)", lineHeight: "var(--leading-title)",
                      }}
                    >
                      {t.murPiedTitre}
                    </div>
                    <div
                      style={{
                        marginTop: "var(--space-8)",
                        border: "var(--border-width) solid var(--action)",
                        color: "var(--text-accent)", borderRadius: "var(--radius-md)",
                        padding: "var(--space-6)", fontSize: "var(--text-body-s)",
                        fontWeight: "var(--font-body-semibold)",
                      }}
                    >
                      {t.murPiedLien}
                    </div>
                    <img
                      src="/brand/lehno-icone-512.svg"
                      alt=""
                      lang={langue}
                      style={{ display: "block", width: 20, height: 20, margin: "var(--space-10) auto 0" }}
                    />
                  </div>
                </div>
              </div>
            </Telephone>
          </div>
        </div>
      </div>
    </section>
  );
}
