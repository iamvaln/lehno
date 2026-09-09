import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Wordmark } from "../../components/brand/Wordmark.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { Banner } from "../../components/feedback/Banner.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";
import { Quote } from "../../components/content/Quote.jsx";

/* Les écrans de compte de l'onglet Moi : profil, réglages, sécurité, paiement,
   aide, réservations.

   Ce sont les vues qu'on consulte deux ou trois fois par an. Elles ne cherchent
   donc pas à séduire : sections nommées, rangs identiques, aucune surprise. Le
   soin passe ailleurs — dans ce qu'elles disent quand quelque chose ne va pas.

   Les actions destructrices restent en contour, jamais en plein : trouvables,
   pas offertes. */

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

function Bascule({ libelle, actif, onBascule, premier }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
      minHeight: "var(--touch-min)",
      borderTop: premier ? "none" : "1px solid var(--border-hairline)"
    }}>
      <span style={{ flex: 1, fontSize: 14.5 }}>{libelle}</span>
      <Interrupteur actif={actif} onBascule={onBascule} libelle={libelle} />
    </div>
  );
}

/* ─── Mon profil (3.23) ─────────────────────────────────────────────── */

export function ProfilScreen({ t, etat = "nominal", base = "../../", onEnregistrer, onFait }) {
  const pris = etat === "erreur";
  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ display: "grid", justifyItems: "center", gap: 10, margin: "8px 0 22px" }}>
        <Avatar name="Valentine" src={base + "assets/valentine.png"} size={76} />
        <button type="button" className="lehno-focusable"
          onClick={() => onFait && onFait(t.photoMiseAJour)} style={{
          all: "unset", cursor: "pointer", fontFamily: "var(--font-body)",
          fontSize: 13, color: "var(--text-accent)", fontWeight: 600
        }}>{t.profilPhoto}</button>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <TextField platform="mobile" label={t.champPrenom} defaultValue="Valentine" />
        <TextField platform="mobile" label={t.champPseudo} defaultValue="valentine"
          invalid={pris} hint={pris ? t.pseudoPris : t.pseudoAdresse} />
        <TextField platform="mobile" label={t.champEmail} type="email"
          defaultValue="valentine@exemple.fr" />
        {/* La date et les goûts vivent ici, une fois : le Mur décide seulement
            s'ils paraissent. */}
        <div>
          <SectionLabel>{t.profilNaissance}</SectionLabel>
          <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
          <div style={{ flex: 1 }}><TextField platform="mobile" label={t.evtJour}
            options={Array.from({ length: 31 }, (_, i) => String(i + 1))} defaultValue="3" /></div>
          <div style={{ flex: 2 }}><TextField platform="mobile" label={t.evtMois}
            options={Array.from({ length: 12 }, (_, m) => ({
              value: String(m),
              label: new Intl.DateTimeFormat(t.langue === "fr" ? "fr-FR" : "en-GB",
                { month: "long" }).format(new Date(2026, m, 1))
            }))} defaultValue="8" /></div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-mention)", marginTop: 7 }}>
            {t.profilNaissanceAide}
          </div>
        </div>
        <TextField platform="mobile" label={t.profilGouts}
          defaultValue={t.profilGoutsExemple} hint={t.profilGoutsAide} />
      </div>

      <Button platform="mobile" full style={{ marginTop: "auto" }} onClick={onEnregistrer}>
        {t.enregistrer}
      </Button>
    </div>
  );
}

/* ─── Rappels et notifications (3.11) ───────────────────────────────── */

/* Une rangée de choix exclusifs : l'heure d'envoi, la fréquence du
   récapitulatif. Une liste déroulante pour trois valeurs aurait caché le choix
   derrière un geste. */
function Rangee({ options, valeur, poser, libelle }) {
  return (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}
      role="radiogroup" aria-label={libelle}>
      {options.map((o) => {
        const actif = valeur === o;
        return (
          <button key={o} type="button" role="radio" aria-checked={actif}
            onClick={() => poser(o)} className="lehno-focusable" style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer",
              display: "inline-flex", alignItems: "center", minHeight: 38,
              padding: "0 14px", borderRadius: "var(--radius-pill)",
              fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
              border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
              background: actif ? "var(--action)" : "transparent",
              color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
            }}>{o}</button>
        );
      })}
    </div>
  );
}

export function RappelsScreen({ t, etat = "nominal", onFait }) {
  const refuse = etat === "refuse";
  const muet = etat === "muet";
  const [quand, setQuand] = React.useState({ j7: true, j1: true, jour: true });
  const [heure, setHeure] = React.useState(t.reglagesHeures[0]);
  /* Cinq natures, pas une : les dates qui approchent ne sont qu'une des choses
     que Lehno a à dire. Sans les quatre autres, couper les dates coupait tout,
     et une contribution à valider passait inaperçue. */
  const [autres, setAutres] = React.useState({
    recap: true, valider: true, relances: true, compte: false
  });
  const [freq, setFreq] = React.useState(t.reglagesRecapFreq[0]);
  const [comment, setComment] = React.useState({
    push: !refuse && !muet, email: !muet
  });
  React.useEffect(() => {
    setComment({ push: !refuse && !muet, email: !muet });
  }, [refuse, muet]);
  const rien = !comment.push && !comment.email;

  return (
    <div style={{ padding: "0 16px 18px" }}>
      {/* Le refus système se dit d'emblée, avec ce qui prend le relais : sans
          cette phrase, on croirait ne plus rien recevoir. */}
      {refuse ? (
        <Banner intent="warning" style={{ margin: "0 -16px 16px" }}>{t.reglagesRefus}</Banner>
      ) : rien ? (
        <Banner intent="warning" style={{ margin: "0 -16px 16px" }}>{t.reglagesMuet}</Banner>
      ) : null}

      <SectionLabel>{t.reglagesQuand}</SectionLabel>
      <div style={{ marginTop: 4 }}>
        <Bascule premier libelle={t.reglagesJ7} actif={quand.j7}
          onBascule={() => setQuand((v) => ({ ...v, j7: !v.j7 }))} />
        <Bascule libelle={t.reglagesJ1} actif={quand.j1}
          onBascule={() => setQuand((v) => ({ ...v, j1: !v.j1 }))} />
        <Bascule libelle={t.reglagesJour} actif={quand.jour}
          onBascule={() => setQuand((v) => ({ ...v, jour: !v.jour }))} />
      </div>

      <div style={{ marginTop: 20 }}>
        <SectionLabel>{t.reglagesHeure}</SectionLabel>
        <Rangee options={t.reglagesHeures} valeur={heure} poser={setHeure}
          libelle={t.reglagesHeure} />
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.reglagesAutres}</SectionLabel>
        <div style={{ marginTop: 4 }}>
          <Bascule premier libelle={t.reglagesRecap} actif={autres.recap}
            onBascule={() => setAutres((v) => ({ ...v, recap: !v.recap }))} />
          {autres.recap ? (
            <div style={{ padding: "0 0 12px" }}>
              <Rangee options={t.reglagesRecapFreq} valeur={freq} poser={setFreq}
                libelle={t.reglagesRecap} />
            </div>
          ) : null}
          <Bascule libelle={t.reglagesValider} actif={autres.valider}
            onBascule={() => setAutres((v) => ({ ...v, valider: !v.valider }))} />
          <Bascule libelle={t.reglagesRelances} actif={autres.relances}
            onBascule={() => setAutres((v) => ({ ...v, relances: !v.relances }))} />
          <Bascule libelle={t.reglagesVieCompte} actif={autres.compte}
            onBascule={() => setAutres((v) => ({ ...v, compte: !v.compte }))} />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.reglagesComment}</SectionLabel>
        <div style={{ marginTop: 4, opacity: refuse ? 0.55 : 1 }}>
          <Bascule premier libelle={t.reglagesPush} actif={comment.push}
            onBascule={refuse ? undefined : () => setComment((v) => ({ ...v, push: !v.push }))} />
          <Bascule libelle={t.reglagesEmail} actif={comment.email}
            onBascule={() => setComment((v) => ({ ...v, email: !v.email }))} />
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginTop: 11,
          fontSize: 12.5, color: "var(--text-mention)"
        }}>
          <Icon name="shield" size={14} style={{ flex: "none" }} />
          <span>{t.reglagesSecuriteToujours}</span>
        </div>
      </div>

      {refuse ? (
        <Button platform="mobile" full variant="outline" icon="settings" style={{ marginTop: 20 }}
          onClick={() => onFait && onFait(t.rappelsActivesFait)}>
          {t.reglagesActiver}
        </Button>
      ) : null}
    </div>
  );
}

/* ─── Sécurité et connexions (3.24) ─────────────────────────────────── */

export function SecuriteScreen({ t, etat = "nominal", onFait }) {
  const inhabituelle = etat === "inhabituelle";
  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {inhabituelle ? (
        <Banner intent="warning" style={{ margin: "0 -16px 16px" }}>{t.securiteInhabituelle}</Banner>
      ) : null}

      <SectionLabel>{t.securiteMoyens}</SectionLabel>
      <div style={{ marginTop: 4 }}>
        {[["Google", "valentine@exemple.fr"], [t.champEmail, "valentine@exemple.fr"]].map(([nom, val], i) => (
          <div key={nom} style={{
            display: "flex", alignItems: "center", gap: 11, padding: "13px 0",
            borderTop: i ? "1px solid var(--border-hairline)" : "none"
          }}>
            <Icon name="key-round" size={16} color="var(--text-mention)" />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14.5 }}>{nom}</span>
              <span style={{ fontSize: 12.5, color: "var(--text-mention)" }}>{val}</span>
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.securiteAppareils}</SectionLabel>
        <div style={{ marginTop: 4 }}>
          {[[t.securiteCetAppareil, "iPhone · Douala", true],
            ["Chrome", t.langue === "fr" ? "Ordinateur · il y a 3 jours" : "Desktop · 3 days ago", false]].map(([nom, val, ici], i) => (
            <div key={nom} style={{
              display: "flex", alignItems: "center", gap: 11, padding: "13px 0",
              borderTop: i ? "1px solid var(--border-hairline)" : "none"
            }}>
              <Icon name={ici ? "smartphone" : "monitor"} size={16} color="var(--text-mention)" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5 }}>{nom}</span>
                <span style={{ fontSize: 12.5, color: "var(--text-mention)" }}>{val}</span>
              </span>
              {ici ? <Icon name="check" size={15} color="var(--feedback-success)" /> : null}
            </div>
          ))}
        </div>
        <Button platform="mobile" full variant="outline" style={{ marginTop: 14 }}
          onClick={() => onFait && onFait(t.securiteDeconnecteFait)}>
          {t.securiteDeconnecterTout}
        </Button>
      </div>

    </div>
  );
}

/* ─── Mes données (3.31) ────────────────────────────────────────────────
   Deux gestes, et rien entre les deux : emporter une copie, ou tout effacer.
   La suppression du compte vient d'ici et non de la page des identifiants —
   c'est le sort de ce qu'on a écrit qui se décide, pas un mot de passe. */

export function DonneesScreen({ t, etat = "nominal", solde = 4, onFait, onFerme }) {
  const [demande, setDemande] = React.useState(false);
  /* Fermer son compte se fait en trois temps, dans l'écran : ce qui part, ce
     qu'on récupère, puis l'identité. Un seul bouton et une feuille auraient
     demandé de confirmer sans avoir rien lu. */
  const [pas, setPas] = React.useState(etat === "suppression" ? 1 : 0);
  React.useEffect(() => { setPas(etat === "suppression" ? 1 : 0); }, [etat]);
  const [raisons, setRaisons] = React.useState({});

  if (pas > 0) {
    const titre = pas === 1 ? t.supprCeQuiPart : pas === 2 ? t.supprSolde(solde) : t.supprConfirmer;
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
        <div style={{ padding: "var(--ry-haut) 16px 12px", flex: 1 }}>
          <div style={{
            fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase",
            fontWeight: 600, color: "var(--text-mention)"
          }}>{t.supprPas(pas)}</div>
          <h1 className="lehno-display" style={{
            fontSize: 22, letterSpacing: "-.02em", margin: "7px 0 0", fontWeight: 500
          }}>{titre}</h1>

          {pas === 1 ? (
            <>
              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                {t.supprListe.map((ligne) => (
                  <div key={ligne} style={{
                    display: "flex", gap: 10, alignItems: "flex-start",
                    fontSize: 14.5, lineHeight: 1.5
                  }}>
                    <Icon name="minus" size={15} color="var(--feedback-error)"
                      strokeWidth={2.4} style={{ marginTop: 3, flex: "none" }} />
                    <span>{ligne}</span>
                  </div>
                ))}
              </div>
              <p style={{
                margin: "18px 0 0", paddingTop: 14, fontSize: 13.5, lineHeight: 1.5,
                color: "var(--text-secondary)", borderTop: "1px solid var(--border-hairline)"
              }}>{t.supprCeQuiReste}</p>
            </>
          ) : pas === 2 ? (
            <>
              <p style={{
                margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.55,
                color: "var(--text-secondary)"
              }}>{solde > 0 ? t.supprSoldeRemboursable : t.supprSoldeVide}</p>

              <div style={{ marginTop: 22 }}>
                <SectionLabel>{t.supprRaison}</SectionLabel>
                <div style={{ fontSize: 12.5, color: "var(--text-mention)", marginTop: 3 }}>
                  {t.supprRaisonFacultatif}
                </div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 11 }}>
                  {t.supprRaisons.map((r) => {
                    const actif = !!raisons[r];
                    return (
                      <button key={r} type="button" aria-pressed={actif}
                        onClick={() => setRaisons((v) => ({ ...v, [r]: !v[r] }))}
                        className="lehno-focusable" style={{
                          all: "unset", boxSizing: "border-box", cursor: "pointer",
                          display: "inline-flex", alignItems: "center", minHeight: 38,
                          padding: "0 14px", borderRadius: "var(--radius-pill)",
                          fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
                          border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
                          background: actif ? "var(--action)" : "transparent",
                          color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
                        }}>{r}</button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 12 }}>
                  <TextField platform="mobile" multiline rows={2} label={t.supprRaisonAutre} />
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              <TextField platform="mobile" autoFocus label={t.supprPseudo}
                placeholder="@valentine" />
              <div>
                <TextField platform="mobile" label={t.supprCode} inputMode="numeric"
                  placeholder="000000" />
                <button type="button" className="lehno-focusable"
                  onClick={() => onFait && onFait(t.supprCodeRenvoye)} style={{
                    all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
                    minHeight: "var(--touch-min)", fontFamily: "var(--font-body)",
                    fontSize: 13, color: "var(--text-accent)"
                  }}>{t.supprCodeRenvoyer}</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "0 16px 16px", flex: "none", display: "grid", gap: 8 }}>
          {pas < 3 ? (
            <Button platform="mobile" full variant="outline"
              onClick={() => setPas(pas + 1)}>{t.supprSuivant}</Button>
          ) : (
            <Button platform="mobile" full variant="destructive" icon="trash-2"
              onClick={() => onFerme && onFerme()}>{t.supprFermer}</Button>
          )}
          <Button platform="mobile" full variant="text"
            onClick={() => { setPas(0); setRaisons({}); }}>{t.supprRenoncer}</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <p style={{ margin: "6px 0 0", fontSize: 14.5, lineHeight: 1.55, color: "var(--text-secondary)" }}>
        {t.donneesExportAide}
      </p>
      {demande ? (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 9, marginTop: 14,
          padding: "13px 14px", borderRadius: "var(--radius-lg)",
          background: "var(--action-quiet-bg)", fontSize: 13.5, lineHeight: 1.5,
          color: "var(--text-accent)"
        }}>
          <Icon name="mail" size={16} style={{ marginTop: 2, flex: "none" }} />
          <span>{t.donneesExportDemande}</span>
        </div>
      ) : (
        <Button platform="mobile" full variant="outline" icon="mail" style={{ marginTop: 14 }}
          onClick={() => { setDemande(true); if (onFait) onFait(t.donneesExportFait); }}>
          {t.donneesExport}
        </Button>
      )}

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.donneesCollecte}</SectionLabel>
        <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)" }}>
          {t.donneesCollecteTexte}
        </p>
      </div>

      <div style={{
        marginTop: "auto", paddingTop: 28, borderTop: "1px solid var(--border-hairline)"
      }}>
        <Button platform="mobile" full variant="destructive-outline" icon="trash-2"
          onClick={() => setPas(1)}>
          {t.securiteSupprimer}
        </Button>
        <p style={{
          margin: "8px 0 0", fontSize: 12, color: "var(--text-mention)", textAlign: "center"
        }}>{t.securiteSupprimerAide}</p>
      </div>
    </div>
  );
}

/* ─── Compte fermé ──────────────────────────────────────────────────────
   L'issue de la fermeture : une page pleine, sans en-tête ni cloche — il n'y a
   plus d'application derrière. Le seul chemin repart de la connexion. */

export function CompteFermeScreen({ t, base = "../../", onSuite }) {
  return (
    <div style={{
      minHeight: "100%", boxSizing: "border-box", padding: "28px 24px 24px",
      display: "flex", flexDirection: "column", alignItems: "center",
      textAlign: "center", background: "var(--surface-page)"
    }}>
      <Wordmark base={base} variant={t.nuit ? "blanc" : "couleur"} height={22}
        style={{ marginBottom: "auto", opacity: .9 }} />

      <h1 className="lehno-display" style={{
        fontSize: 25, letterSpacing: "-.025em", fontWeight: 500, margin: 0, maxWidth: "18ch"
      }}>{t.supprFait}</h1>
      <p style={{
        margin: "12px 0 0", fontSize: 14, lineHeight: 1.55, maxWidth: "32ch",
        color: "var(--text-secondary)"
      }}>{t.supprGrace}</p>

      <div style={{ marginTop: "auto", width: "100%" }}>
        <Button platform="mobile" full variant="outline" onClick={onSuite}>
          {t.supprRevenir}
        </Button>
      </div>
    </div>
  );
}

/* ─── Méthodes de paiement (3.25) ───────────────────────────────────── */

export function PaiementScreen({ t, etat = "nominal", onOpen, onFait }) {
  const [ajout, setAjout] = React.useState(false);
  const [moyen, setMoyen] = React.useState("mobile");
  const [defaut, setDefaut] = React.useState(false);
  React.useEffect(() => { setAjout(false); }, [etat]);

  if (ajout) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
        <div style={{ padding: "var(--ry-haut) 16px 12px", flex: 1, display: "grid", gap: 14, alignContent: "start" }}>
          <div>
            <SectionLabel>{t.rechargeMoyen}</SectionLabel>
            <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
              {[["mobile", t.rechargeMobile], ["carte", t.rechargeCarte]].map(([k, l]) => {
                const actif = moyen === k;
                return (
                  <button key={k} type="button" onClick={() => setMoyen(k)} aria-pressed={actif}
                    className="lehno-focusable" style={{
                      all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
                      minHeight: 40, padding: "0 15px", borderRadius: "var(--radius-pill)",
                      boxSizing: "border-box", fontFamily: "var(--font-body)", fontSize: 13.5,
                      fontWeight: 600,
                      border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
                      background: actif ? "var(--action)" : "transparent",
                      color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
                    }}>{l}</button>
                );
              })}
            </div>
          </div>

          {moyen === "mobile" ? (
            <TextField platform="mobile" autoFocus label={t.paiementNumero}
              type="tel" placeholder="+237 6 …" />
          ) : (
            <>
              <TextField platform="mobile" autoFocus label={t.paiementCarteNum}
                placeholder="4242 4242 4242 4242" />
              <TextField platform="mobile" label={t.paiementCarteExp} placeholder="12/27" />
            </>
          )}

          <button type="button" role="checkbox" aria-checked={defaut}
            onClick={() => setDefaut((v) => !v)} className="lehno-focusable" style={{
              all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 9,
              minHeight: "var(--touch-min)", fontFamily: "var(--font-body)",
              fontSize: 13.5, color: "var(--text-secondary)"
            }}>
            <span style={{
              width: 20, height: 20, borderRadius: 5, flex: "none",
              display: "grid", placeItems: "center",
              border: "1px solid " + (defaut ? "transparent" : "var(--border-object)"),
              background: defaut ? "var(--action)" : "transparent"
            }}>
              {defaut ? <Icon name="check" size={13} strokeWidth={2.6}
                color="var(--text-on-accent)" /> : null}
            </span>
            {t.paiementParDefaut}
          </button>
        </div>

        <div style={{ padding: "0 16px 16px", flex: "none", display: "grid", gap: 8 }}>
          <Button platform="mobile" full
            onClick={() => { setAjout(false); if (onFait) onFait(t.paiementAjoutFait); }}>
            {t.enregistrer}
          </Button>
          <Button platform="mobile" full variant="text"
            onClick={() => setAjout(false)}>{t.feuillePasMaintenant}</Button>
        </div>
      </div>
    );
  }

  if (etat === "vide") {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="paiement-attente"
          titre={t.paiementAucuneTitre} texte={t.paiementAucuneTexte}
          action={t.paiementAjouter} onAction={() => setAjout(true)} />
      </div>
    );
  }

  const expire = etat === "expire";
  return (
    <div style={{ padding: "0 16px 18px" }}>
      <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
        <Card padding={15} radius="lg">
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Icon name="smartphone" size={17} color="var(--text-mention)" />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14.5 }}>{t.rechargeMobile}</span>
              <span style={{ fontSize: 12.5, color: "var(--text-mention)" }}>+237 6•• •• 41 08</span>
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase",
              color: "var(--feedback-success)"
            }}>{t.paiementDefaut}</span>
          </div>
        </Card>

        <Card padding={15} radius="lg" style={{
          borderColor: expire ? "var(--feedback-error)" : undefined
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Icon name="credit-card" size={17}
              color={expire ? "var(--feedback-error)" : "var(--text-mention)"} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14.5 }}>•••• 4218</span>
              <span style={{
                fontSize: 12.5, color: expire ? "var(--feedback-error)" : "var(--text-mention)"
              }}>{expire ? t.paiementExpire : "12/27"}</span>
            </span>
          </div>
        </Card>
      </div>

      <Button platform="mobile" full variant="outline" icon="plus" style={{ marginTop: 16 }}
        onClick={() => setAjout(true)}>
        {t.paiementAjouter}
      </Button>
    </div>
  );
}

/* ─── Aide (3.26) ───────────────────────────────────────────────────── */

export function AideScreen({ t }) {
  /* Les trois rangs quittent l'application : deux vers le site, un vers la fiche
     du magasin. Un rang qui sort porte la flèche oblique, pas le chevron. */
  const rangs = [
    [t.aideQuestions, "circle-help", "../web/pages.html#faq"],
    [t.aideContact, "mail", "../web/pages.html#contact"],
    [t.aideNoter, "star", null]
  ];
  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ marginTop: 4 }}>
        {rangs.map(([l, ic, href], i) => {
          const Rang = href ? "a" : "button";
          return (
            <Rang key={l} type={href ? undefined : "button"}
              href={href || undefined} target={href ? "_blank" : undefined}
              rel={href ? "noopener" : undefined}
              className="lehno-focusable" style={{
                all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
                display: "flex", alignItems: "center", gap: 11, padding: "14px 0",
                minHeight: "var(--touch-min)", color: "var(--text-body)",
                borderTop: i ? "1px solid var(--border-hairline)" : "none"
              }}>
              <Icon name={ic} size={17} color="var(--text-mention)" />
              <span style={{ flex: 1, fontSize: 14.5 }}>{l}</span>
              <Icon name="arrow-up-right" size={15} color="var(--text-mention)" />
            </Rang>
          );
        })}
      </div>
      <div style={{
        marginTop: "auto", paddingTop: 24, textAlign: "center",
        fontSize: 12, color: "var(--text-mention)"
      }}>{t.aideVersion} 1.0</div>
    </div>
  );
}

/* ─── Mes réservations (3.27) ───────────────────────────────────────── */

const RESERVATIONS = {
  fr: [
    { id: "v1", quoi: "Un moulin à café manuel", qui: "Valery Bah", quand: "24 août", jours: 3 },
    { id: "v2", quoi: "Un cours de céramique", qui: "Célarine", quand: "22 août", jours: 0 },
    { id: "v3", quoi: "Une paire de gants de jardin", qui: "Maman", quand: "2 sept.", jours: 12, retire: true }
  ],
  en: [
    { id: "v1", quoi: "A hand coffee grinder", qui: "Valery Bah", quand: "24 Aug", jours: 3 },
    { id: "v2", quoi: "A ceramics class", qui: "Célarine", quand: "22 Aug", jours: 0 },
    { id: "v3", quoi: "A pair of garden gloves", qui: "Maman", quand: "2 Sep", jours: 12, retire: true }
  ]
};

export function ReservationsScreen({ t, etat = "nominal", onFait }) {
  const langue = t.langue === "fr" ? "fr" : "en";
  /* Une réservation a deux issues : le cadeau part, ou la place se libère pour
     quelqu'un d'autre. Marquer offert n'efface pas la ligne — c'est ce qu'on
     relit l'année suivante pour ne pas se répéter. */
  const [offerts, setOfferts] = React.useState({});
  React.useEffect(() => { setOfferts({}); }, [etat, langue]);

  if (etat === "vide") {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="souhait-reserve"
          titre={t.reservVideTitre} texte={t.reservVideTexte} />
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 18px" }}>
      <p style={{
        margin: "4px 0 16px", fontSize: 14, color: "var(--text-secondary)", maxWidth: "36ch"
      }}>{t.reservIntro}</p>

      {RESERVATIONS[langue].map((r) => (
        <Card key={r.id} padding={15} radius="lg" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
            <Avatar name={r.qui} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="lehno-display" style={{ fontSize: 16 }}>{r.quoi}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>
                {t.procheProchaine(r.qui, r.quand)}
              </div>
            </div>
          </div>

          {/* Un souhait retiré par son propriétaire se signale : on doit savoir
              qu'il ne faut plus l'offrir, sans que la réservation disparaisse. */}
          {r.retire ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 7, marginTop: 10,
              paddingTop: 9, borderTop: "1px solid var(--border-hairline)",
              fontSize: 12.5, color: "var(--feedback-warning)"
            }}>
              <Icon name="circle-alert" size={14} strokeWidth={2} />
              <span>{t.reservRetire}</span>
            </div>
          ) : null}

          {offerts[r.id] ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 7, marginTop: 10,
              paddingTop: 9, borderTop: "1px solid var(--border-hairline)",
              fontSize: 12.5, fontWeight: 600, color: "var(--feedback-success)"
            }}>
              <Icon name="check" size={14} strokeWidth={2.4} />
              <span>{t.reservDejaOffert}</span>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Button platform="mobile" variant="outline" icon="gift" style={{ flex: 1 }}
                onClick={() => {
                  setOfferts((v) => ({ ...v, [r.id]: true }));
                  if (onFait) onFait(t.reservOffertFait);
                }}>{t.reservOffert}</Button>
              <Button platform="mobile" variant="text" style={{ flex: "none" }}
                onClick={() => onFait && onFait(t.reservLibereFait)}>
                {t.reservLiberer}
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
