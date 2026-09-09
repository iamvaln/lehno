import React from "react";
import { EventCard } from "../../components/content/EventCard.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";
import { LoadingState } from "../../components/feedback/LoadingState.jsx";
import { Button } from "../../components/core/Button.jsx";
import { Icon } from "../../components/core/Icon.jsx";

const TYPE_CLE = {
  anniversaire: "typeAnniversaire", mariage: "typeMariage", retraite: "typeRetraite",
  naissance: "typeNaissance", etape: "typeEtape", fete: "typeFete", autre: "typeAutre"
};

/* La phrase d'accueil se compose selon la situation — spec 3.2 : « aucune date
   à l'horizon, une seule aujourd'hui, plusieurs dans la semaine, rien avant
   plusieurs semaines ». Chaque variante est écrite en entier dans les deux
   langues : le singulier et le pluriel ne s'accordent pas pareil. */

/* L'autre moitié du produit, proposée sans insister : une ligne, un chevron.
   Elle disparaît dès qu'une liste existe — une invitation qui reste après avoir
   été acceptée devient un reproche. Elle tient dans l'état nominal et dans
   l'état vide, où l'écran n'a précisément rien d'autre à proposer ; pas au
   premier lancement, qui ne poursuit qu'un but. */
function Invitation({ t, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen && onOpen("listes")} className="lehno-focusable"
      style={{
        all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
        display: "flex", alignItems: "center", gap: 11, marginTop: "var(--ry-item)", paddingTop: "var(--ry-item)",
        minHeight: "var(--touch-min)", borderTop: "1px solid var(--border-hairline)"
      }}>
      <Icon name="gift" size={17} color="var(--text-mention)" />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, color: "var(--text-accent)", fontWeight: 600 }}>
          {t.accueilFaireListe}
        </span>
      </span>
      <Icon name="chevron-right" size={15} color="var(--text-mention)" />
    </button>
  );
}

export function AccueilScreen({
  t, prenom = "Valentine", echeances = [], etat = "nominal", aListe = false,
  flags = {}, onOpen, onFait
}) {
  /* LA CARTE D'ÉCHÉANCE PERD « PRÉPARER » SI LA GÉNÉRATION EST ÉTEINTE, et ne
     doit pas paraître amputée. Elle ne garde donc pas « Marquer envoyé » seul —
     il n'y a rien à envoyer sans message produit : son action principale change
     d'identité et devient le geste du socle, noter une idée pour la date qui
     approche. Une action au lieu de deux, mais une action pleine. */
  const genere = flags.generation !== false;
  /* « Marquer envoyé » ne mène pas à un écran : c'est un état qui change ici.
     La carte cesse de le proposer, et l'accusé dit à qui. */
  const [envoyes, setEnvoyes] = React.useState({});
  /* L'accueil ne défile pas : c'est un écran qu'on regarde, pas qu'on parcourt.
     Il se remplit donc à la hauteur disponible — on part du maximum de rangs et
     on en retire tant que le contenu dépasse. Mesurer plutôt que calculer : les
     marges, les filets et la hauteur d'une ligne changent avec la langue et le
     modèle, et une constante finit toujours par rogner un rang. */
  const MAX_RANGS = 4;
  /* Trois cartes au plus, deux au moins : sur un petit modèle, trois cartes
     seules dépassent déjà la hauteur, et retirer des rangs n'y change rien —
     la mesure retire donc les rangs d'abord, puis une carte. Ce qui sort n'est
     jamais escamoté : le lien vers Dates porte le compte. */
  const MAX_CARTES = 3;
  const MIN_CARTES = 2;
  const zone = React.useRef(null);
  const [rangs, setRangs] = React.useState(MAX_RANGS);
  const [cartes, setCartes] = React.useState(MAX_CARTES);
  /* LA MESURE NE FAIT QUE RÉTRÉCIR. Comparer la hauteur à chaque rendu pour
     repartir du maximum faisait osciller les deux gestes l'un contre l'autre —
     on retirait, la hauteur changeait, on remettait tout, on retirait à
     nouveau, sans fin. Le retour au maximum n'appartient donc qu'au
     redimensionnement observé, et il ne se déclenche qu'au-delà d'un seuil,
     jamais pour les quelques pixels que notre propre retrait déplace. */
  const dernier = React.useRef(null);
  React.useEffect(() => {
    const z = zone.current;
    if (!z) return;
    if (dernier.current == null) dernier.current = z.clientHeight;
    if (z.scrollHeight <= z.clientHeight) return;
    if (rangs > 0) setRangs((r) => r - 1);
    else if (cartes > MIN_CARTES) setCartes((c) => c - 1);
  }, [rangs, cartes, echeances, t.langue]);
  React.useEffect(() => {
    const z = zone.current;
    if (!z || typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(() => {
      const h = z.clientHeight;
      if (dernier.current != null && Math.abs(h - dernier.current) < 24) return;
      dernier.current = h;
      setRangs(MAX_RANGS); setCartes(MAX_CARTES);
    });
    ro.observe(z);
    return () => ro.disconnect();
  }, []);

  if (etat === "chargement") {
    return (
      <div style={{ padding: "var(--ry-haut) 16px 12px" }}>
        <h1 className="lehno-display" style={{ fontSize: 27, letterSpacing: "-.025em", margin: "0 0 var(--ry-titre)", fontWeight: 500 }}>
          {t.salut(prenom)}
        </h1>
        <LoadingState variant="liste" lignes={3} titre={t.chargement} />
      </div>
    );
  }

  /* Premier lancement : l'écran ne poursuit qu'un but, conduire au premier
     ajout. « Laisser une note » cède la place — il n'y a personne à propos de
     qui écrire. */
  if (etat === "premier") {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="carnet-neuf" titre={t.videCarnetTitre} texte={t.videCarnetTexte}
          action={t.ajouterAnniversaire} onAction={() => onOpen && onOpen("evenement")} />
      </div>
    );
  }

  const vide = etat === "vide";
  /* L'accueil montre la semaine, et trois cartes au plus — au-delà, un quatrième
     bloc ne tient pas sur un petit écran. Ce qui dépasse n'est pas escamoté en
     silence : le lien vers Dates porte alors le compte. */
  const semaine = echeances.filter((e) => e.jours != null && e.jours <= 7);
  /* La semaine en cartes ; ce qui vient après en lignes. Trois cartes au plus
     laissaient un tiers d'écran vide sur les grands modèles, alors que les
     dates existent : elles se lisent juste plus vite, en rangs. */
  const proches = (semaine.length ? semaine : echeances.slice(0, 2)).slice(0, cartes);
  const apres = echeances.filter((e) => proches.indexOf(e) < 0 && e.jours != null);
  const suivantes = apres.slice(0, rangs);
  const reste = echeances.length - proches.length - suivantes.length;

  /* L'écran occupe sa hauteur : la semaine en haut, les deux actions au pied.
     Serrées sous la dernière carte, elles flottaient au milieu du téléphone et
     laissaient un tiers d'écran vide sous elles. */
  return (
    <div style={{
      padding: "var(--ry-haut) 16px 12px", flex: 1, minHeight: 0,
      display: "flex", flexDirection: "column"
    }}>
      <h1 className="lehno-display" style={{
        fontSize: 27, letterSpacing: "-.025em", margin: "0 0 var(--ry-titre)", fontWeight: 500
      }}>{t.salut(prenom)}</h1>

      {vide ? (
        <>
          <EmptyState illustration="rien-approche" titre={t.videRienTitre} texte={t.videRienTexte} />
          <div style={{ marginTop: "auto", paddingTop: "var(--ry-bloc)" }}>
            <Button platform="mobile" full icon="plus"
              onClick={() => onOpen && onOpen("note")}>{t.laisserNote}</Button>
            {aListe || flags.wishlistOwn === false ? null : <Invitation t={t} onOpen={onOpen} />}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "var(--ry-item)" }}>
            <span className="lehno-kicker">{t.ceQuiApproche}</span>
            <button type="button" onClick={() => onOpen && onOpen("dates")} className="lehno-focusable"
              style={{
                all: "unset", cursor: "pointer", marginLeft: "auto",
                minHeight: "var(--touch-min)", minWidth: "var(--touch-min)",
                display: "grid", placeItems: "center", marginTop: -14, marginBottom: -14,
                fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-accent)"
              }}>{reste ? t.voirPlus : t.voirTout}</button>
          </div>

          <div ref={zone} style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <div>
          {proches.map((e, i) => (
            <EventCard key={e.id}
              imminent={i === 0}
              nom={t.langue === "fr" ? e.nom : (e.nomEn || e.nom)}
              type={e.type}
              typeLabel={t[TYPE_CLE[e.type] || "typeAutre"]}
              dateLabel={t.langue === "fr" ? e.date : e.dateEn}
              precision={t.langue === "fr" ? e.precision : (e.precisionEn || e.precision)}
              decompte={e.jours === 0 ? t.aujourdhui : t.decompte(e.jours)}
              aujourdhui={e.jours === 0}
              actions={i === 0
                ? (!genere ? [t.cartNoter]
                   : envoyes[e.id] ? [t.preparer] : [t.preparer, t.marquerEnvoye])
                : undefined}
              onPreparer={() => onOpen && onOpen(genere ? "preparation" : "note", e)}
              onEnvoye={() => {
                setEnvoyes((v) => ({ ...v, [e.id]: true }));
                if (onFait) onFait(t.envoiFait(t.langue === "fr" ? e.nom : (e.nomEn || e.nom)));
              }}
              onOuvrir={() => onOpen && onOpen("occasion", e)}
              style={{ marginBottom: "var(--ry-item)" }} />
          ))}
          </div>

          {suivantes.length ? (
            <>
              <div className="lehno-kicker" style={{ margin: "var(--ry-bloc) 0 var(--ry-item)" }}>
                {t.plusTard}
              </div>
              <div style={{
                border: "1px solid var(--border-object)", borderRadius: "var(--radius-lg)",
                overflow: "hidden"
              }}>
                {suivantes.map((e, i) => (
                  <button key={e.id} type="button" onClick={() => onOpen && onOpen("occasion", e)}
                    className="lehno-focusable" style={{
                      all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
                      display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                      minHeight: "var(--touch-min)",
                      borderTop: i ? "1px solid var(--border-hairline)" : "none"
                    }}>
                    <span className="lehno-display" style={{
                      fontSize: 13.5, color: "var(--text-accent)", minWidth: 56, fontWeight: 500
                    }}>{t.langue === "fr" ? e.date : e.dateEn}</span>
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 14.5, whiteSpace: "nowrap",
                      overflow: "hidden", textOverflow: "ellipsis"
                    }}>{t.langue === "fr" ? e.nom : (e.nomEn || e.nom)}</span>
                    <span style={{ fontSize: 12.5, color: "var(--text-mention)", flex: "none" }}>
                      {t[TYPE_CLE[e.type] || "typeAutre"]}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
          </div>

          <div style={{ paddingTop: "var(--ry-bloc)", flex: "none" }}>
            <Button platform="mobile" full icon="plus"
              onClick={() => onOpen && onOpen("note")}>{t.laisserNote}</Button>
            {aListe || flags.wishlistOwn === false ? null : <Invitation t={t} onOpen={onOpen} />}
          </div>
        </>
      )}
    </div>
  );
}
