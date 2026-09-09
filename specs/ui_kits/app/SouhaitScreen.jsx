import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { Card } from "../../components/core/Card.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Quote } from "../../components/content/Quote.jsx";
import { Provenance } from "../../components/content/Provenance.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";
import { OfflineBanner } from "../../components/feedback/OfflineBanner.jsx";
import { Banner } from "../../components/feedback/Banner.jsx";

/* Détail et gestion d'un souhait (3.19).
 *
 * L'ÉTAT A TROIS VALEURS — disponible, réservé, déjà offert — et il se change
 * ici. Le montrer en étiquette seule laissait « déjà offert » n'exister que
 * comme bouton : un état du modèle qu'on ne peut pas lire n'en est pas un.
 *
 * LA RÉSERVATION DIT QUI, OU DIT QU'ELLE NE LE DIT PAS. La spec est explicite :
 * le nom du réservant apparaît s'il a choisi de se faire connaître, sinon la
 * réservation reste anonyme. Une réservation muette laisserait croire à un
 * défaut d'affichage.
 *
 * DEUX SOUHAITS DIFFÉRENTS, UN SEUL ÉCRAN. Ce que JE demande peut paraître sur
 * ma liste partagée : la visibilité est un vrai interrupteur, et c'est le geste
 * le plus conséquent de l'écran. Une idée que j'ai notée POUR QUELQU'UN n'a pas
 * de visibilité du tout — elle ne se publie nulle part, et l'interrupteur n'a
 * pas à exister sur cet écran-là. Son vocabulaire change aussi : elle est à
 * étudier, retenue, écartée ou offerte, pas « disponible » ou « réservée ».
 * Le Mur n'a rien à voir dans les deux cas : il porte les mots reçus le jour J.
 *
 * « RETIRER » vit en bas, en contour : trouvable sans être offert. */

const ETATS = [
  ["disponible", "souhaitDisponible"],
  ["reserve", "souhaitReserve"],
  ["offert", "souhaitOffertEtat"]
];

/* Une idée notée pour quelqu'un : quatre positions, aucune publique. */
const ETATS_CANDIDAT = [
  ["etudier", "souhaitAEtudier"],
  ["retenu", "souhaitRetenu"],
  ["ecarte", "souhaitEcarte"],
  ["offert", "souhaitOffertEtat"]
];

export function SouhaitScreen({
  t, etat = "nominal", souhait, nouveau = false, mien = true,
  onOpen, onRetour, onRetirer, onFait, onEnregistrer
}) {
  const quoi = (souhait && souhait.quoi) || t.souhaitExemple;
  const prix = (souhait && souhait.prix) || t.souhaitPrix;
  const precisions = souhait ? souhait.precisions : t.souhaitPrecisionsTexte;
  /* Une parole vient d'une personne : elle ne s'affiche que si le souhait en
     porte une, et jamais sur ce que je demande moi-même. */
  const parole = souhait ? souhait.parole : t.souhaitParole;
  const lien = souhait ? souhait.lien : t.souhaitLienTexte;
  const parQui = souhait ? souhait.reservePar : "Célarine";
  /* UNE SEULE SOURCE pour l'état. Le ternaire ignorait « anonyme » et retombait
     sur « disponible », pendant que le bandeau passait par une seconde branche :
     l'écran annonçait donc à la fois disponible et réservé. « anonyme » ne
     décide plus que la PHRASE, pas l'état. */
  const depuisListe = souhait && souhait.etat;
  const sortInitial = () => mien
    ? (depuisListe === "offert" ? "offert"
       : depuisListe === "reserve" ? "reserve"
       : etat === "offert" ? "offert"
       : etat === "reserve" || etat === "anonyme" ? "reserve" : "disponible")
    : (depuisListe === "offert" ? "offert"
       : depuisListe === "retenu" ? "retenu"
       : depuisListe === "ecarte" ? "ecarte"
       : etat === "offert" ? "offert" : "etudier");
  const [valeur, setValeur] = React.useState(sortInitial);
  React.useEffect(() => { setValeur(sortInitial()); }, [etat, mien, souhait && souhait.id]);
  const [visible, setVisible] = React.useState(true);
  /* Retirer est irréversible : la demande monte au niveau de l'appareil, pour
     que le voile couvre aussi l'en-tête. L'écran ne garde que l'issue. */
  /* Modifier réutilise le formulaire de création, avec les valeurs en place :
     le même écran écrit et récrit un souhait. */
  const [edite, setEdite] = React.useState(false);
  React.useEffect(() => { setEdite(false); }, [etat, souhait && souhait.id]);
  const [retire, setRetire] = React.useState(etat === "retire");
  React.useEffect(() => { setRetire(etat === "retire"); }, [etat]);
  const anonyme = etat === "anonyme";
  const reserve = mien && valeur === "reserve";
  const positions = mien ? ETATS : ETATS_CANDIDAT;

  if (nouveau || edite) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
        <div style={{ padding: "var(--ry-haut) 16px 12px", flex: 1, display: "grid", gap: 14, alignContent: "start" }}>
          {edite ? (
            <h1 className="lehno-display" style={{
              fontSize: 21, letterSpacing: "-.02em", margin: 0, fontWeight: 500
            }}>{t.souhaitModifierTitre}</h1>
          ) : null}
          <button type="button" className="lehno-focusable"
            onClick={() => onFait && onFait(t.photoMiseAJour)} style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
              height: 110, borderRadius: "var(--radius-lg)", background: "var(--surface-panel)",
              display: "grid", placeItems: "center"
            }}>
            <span style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              color: "var(--text-accent)", fontFamily: "var(--font-body)",
              fontSize: 13, fontWeight: 600
            }}>
              <Icon name="image-plus" size={22} />
              {t.souhaitPhotoAjouter}
            </span>
          </button>

          <TextField platform="mobile" autoFocus label={t.souhaitQuoi}
            key={edite ? "e-quoi" : "n-quoi"}
            placeholder={t.souhaitQuoiExemple} defaultValue={edite ? quoi : undefined} />
          <TextField platform="mobile" label={t.souhaitCombien} placeholder="12 000"
            key={edite ? "e-prix" : "n-prix"} defaultValue={edite ? prix : undefined} />
          <TextField platform="mobile" label={t.souhaitLien} placeholder="https://"
            key={edite ? "e-lien" : "n-lien"} defaultValue={edite ? (lien || "") : undefined} />
          <TextField platform="mobile" multiline rows={3} label={t.souhaitPrecisions}
            key={edite ? "e-prec" : "n-prec"}
            placeholder={t.souhaitPrecisionsExemple}
            defaultValue={edite ? (precisions || "") : undefined} />
        </div>
        <div style={{ padding: "0 16px 16px", flex: "none", display: "grid", gap: 8 }}>
          <Button platform="mobile" full onClick={() => {
            if (!edite) { if (onEnregistrer) onEnregistrer(); return; }
            setEdite(false);
            if (onFait) onFait(t.souhaitModifieEnregistre);
          }}>{t.enregistrer}</Button>
          {edite ? (
            <Button platform="mobile" full variant="text"
              onClick={() => setEdite(false)}>{t.feuillePasMaintenant}</Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (etat === "vide") {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="souhaits-vide" titre={t.videSouhaitsTitre}
          texte={t.videSouhaitsTexte} action={t.souhaitAjouter} />
      </div>
    );
  }

  if (retire) {
    return (
      <div style={{ padding: "12px 16px 18px" }}>
        <Banner intent="success">{t.souhaitRetireFait}</Banner>
        <div style={{ marginTop: 16 }}>
          <Button platform="mobile" full variant="outline" icon="arrow-left"
            onClick={onRetour}>{t.souhaitRetourListe}</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", minHeight: "100%", position: "relative"
    }}>
      {etat === "horsligne" ? <OfflineBanner t={t} enAttente={1} /> : null}

      <div style={{ padding: "8px 16px 18px", flex: 1 }}>
        {/* La photo de l'objet, facultative — et remplaçable : la spec en fait
            une action, pas un décor. */}
        <button type="button" className="lehno-focusable"
          onClick={() => onFait && onFait(t.photoMiseAJour)} style={{
          all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
          height: 132, borderRadius: "var(--radius-lg)", background: "var(--surface-panel)",
          display: "grid", placeItems: "center", marginBottom: 8
        }}>
          <span style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            color: "var(--text-accent)", fontFamily: "var(--font-body)",
            fontSize: 13, fontWeight: 600
          }}>
            <Icon name="image-plus" size={22} />
            {t.souhaitPhotoAjouter}
          </span>
        </button>

        <h1 className="lehno-display" style={{
          fontSize: 22, letterSpacing: "-.02em", margin: "12px 0 0", fontWeight: 500
        }}>{quoi}</h1>

        <div className="lehno-display" style={{
          fontSize: 26, fontWeight: 400, letterSpacing: "-.02em", marginTop: 8
        }}>{prix}</div>

        {/* L'état se lit ET se change : trois valeurs, pas deux. */}
        <div style={{ marginTop: 20 }}>
          <SectionLabel>{mien ? t.souhaitEtat : t.souhaitCandidatEtat}</SectionLabel>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
            {positions.map(([k, cle]) => {
              const actif = valeur === k;
              return (
                <button key={k} type="button" onClick={() => setValeur(k)} aria-pressed={actif}
                  className="lehno-focusable" style={{
                    all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
                    minHeight: 38, padding: "0 14px", borderRadius: "var(--radius-pill)",
                    fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
                    border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
                    background: actif ? "var(--action)" : "transparent",
                    color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
                  }}>{t[cle]}</button>
              );
            })}
          </div>
        </div>

        {/* Une réservation dit qui, ou dit qu'elle ne le dit pas. */}
        {reserve ? (
          <div style={{
            marginTop: 14, padding: "12px 14px", borderRadius: "var(--radius-lg)",
            background: "var(--surface-panel)", display: "flex", gap: 9,
            alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.5
          }}>
            <Icon name="bookmark" size={16} color="var(--text-accent)" style={{ marginTop: 2 }} />
            <span>{anonyme || !parQui ? t.souhaitReserveAnonyme : t.souhaitReservePar(parQui)}</span>
          </div>
        ) : null}

        {precisions ? (
          <div style={{ marginTop: 20 }}>
            <SectionLabel>{t.souhaitPrecisions}</SectionLabel>
            <p style={{ margin: "7px 0 0", fontSize: 14.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {precisions}
            </p>
          </div>
        ) : null}

        {/* Le lien : « où le trouver » est ce qui rend un souhait offrable — et
            un lien faux vaut moins que pas de lien. Tout ne s'achète pas en
            boutique : un cours, des gants n'en portent pas. */}
        {lien ? (
          <div style={{ marginTop: 18 }}>
            <SectionLabel>{t.souhaitLien}</SectionLabel>
            <a href="#" onClick={(e) => { e.preventDefault(); if (onFait) onFait(t.lienOuvreDehors); }}
              style={{
              display: "inline-flex", alignItems: "center", gap: 7, marginTop: 7,
              minHeight: "var(--touch-min)", fontSize: 14.5, color: "var(--text-accent)"
            }}>
              <Icon name="link" size={15} />{lien}
            </a>
          </div>
        ) : null}

        {!mien && parole ? (
          <Card padding={14} radius="lg" style={{ marginTop: 18 }}>
            <SectionLabel>{t.souhaitProvenance}</SectionLabel>
            <Quote size={14.5} style={{ marginTop: 6 }}>{parole}</Quote>
            <Provenance origin={(souhait && souhait.origine) || t.souhaitOrigine}
              date={(souhait && souhait.origineDate) || t.souhaitOrigineDate} />
          </Card>
        ) : null}

        {/* Le geste le plus conséquent de l'écran : il rend un souhait public. */}
        {mien ? (
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 12, marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--border-hairline)"
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5 }}>{t.souhaitVisible}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-mention)", marginTop: 2 }}>
              {t.souhaitVisibleAide}
            </div>
          </div>
          <button type="button" role="switch" aria-checked={visible}
            onClick={() => setVisible((x) => !x)} className="lehno-focusable"
            aria-label={t.souhaitVisible} style={{
              all: "unset", cursor: "pointer", flex: "none", width: 44, height: 26,
              borderRadius: 999, padding: 3, boxSizing: "border-box",
              background: visible ? "var(--action)" : "var(--border-object)",
              transition: "background var(--transition-state)"
            }}>
            <span style={{
              display: "block", width: 20, height: 20, borderRadius: "50%",
              background: "var(--surface-page)",
              transform: visible ? "translateX(18px)" : "translateX(0)",
              transition: "transform var(--transition-state)"
            }} />
          </button>
        </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 20, paddingTop: 14,
            borderTop: "1px solid var(--border-hairline)",
            fontSize: 12.5, color: "var(--text-mention)"
          }}>
            <Icon name="lock" size={14} style={{ flex: "none" }} />
            <span>{t.souhaitPrive}</span>
          </div>
        )}
      </div>

      <div style={{ padding: "0 16px 16px", flex: "none", display: "grid", gap: 8 }}>
        {/* Un souhait déjà offert ne se retouche plus : ni son prix, ni son
            lien, ni sa photo n'ont encore un sens à changer. */}
        <Button platform="mobile" full variant="outline" icon="pencil"
          disabled={valeur === "offert"}
          onClick={() => setEdite(true)}>{t.modifier}</Button>
        <Button platform="mobile" full variant="destructive-outline" icon="trash-2"
          onClick={() => (onRetirer ? onRetirer(reserve, () => setRetire(true)) : setRetire(true))}>
          {mien ? t.souhaitRetirer : t.souhaitRetirerCandidat}
        </Button>
      </div>

    </div>
  );
}
