import React from "react";
import { EventCard } from "../../components/content/EventCard.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";
import { LoadingState } from "../../components/feedback/LoadingState.jsx";
import { Button } from "../../components/core/Button.jsx";
import { Icon } from "../../components/core/Icon.jsx";

/* La phrase d'accueil se compose selon la situation — spec 3.2 : « aucune date
   à l'horizon, une seule aujourd'hui, plusieurs dans la semaine, rien avant
   plusieurs semaines ». Chaque variante est écrite en entier dans les deux
   langues : le singulier et le pluriel ne s'accordent pas pareil. */
function phraseEtat(t, echeances) {
  if (!echeances.length) return t.etatRien;
  const aujourdhui = echeances.filter((e) => e.jours === 0).length;
  const semaine = echeances.filter((e) => e.jours > 0 && e.jours <= 7).length;
  if (aujourdhui && semaine) return t.etatUnAujourdhuiEtSemaine(semaine);
  if (aujourdhui) return t.etatUnAujourdhui;
  if (semaine === 1) return t.etatUnSemaine;
  if (semaine === 2) return t.etatDeuxSemaine;
  if (semaine > 2) return t.etatPlusieursSemaine(semaine);
  const p = echeances[0];
  return t.etatLointain(t.langue === "fr" ? p.date : p.dateEn);
}

export function AccueilScreen({ t, prenom = "Valentine", echeances = [], etat = "nominal", onOpen }) {
  if (etat === "chargement") {
    return (
      <div style={{ padding: "0 16px 18px" }}>
        <h1 className="lehno-display" style={{ fontSize: 27, letterSpacing: "-.025em", margin: "6px 0 18px", fontWeight: 500 }}>
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

  return (
    <div style={{ padding: "0 16px 18px" }}>
      <h1 className="lehno-display" style={{
        fontSize: 27, letterSpacing: "-.025em", margin: "6px 0 2px", fontWeight: 500
      }}>{t.salut(prenom)}</h1>
      <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--text-secondary)" }}>
        {phraseEtat(t, vide ? [] : echeances)}
      </p>

      {vide ? (
        <>
          <EmptyState illustration="rien-approche" titre={t.videRienTitre} texte={t.videRienTexte} />
          <Button platform="mobile" full icon="plus" style={{ marginTop: 8 }}
            onClick={() => onOpen && onOpen("note")}>{t.laisserNote}</Button>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
            <span className="lehno-kicker">{t.ceQuiApproche}</span>
            <button type="button" onClick={() => onOpen && onOpen("dates")} className="lehno-focusable"
              style={{
                all: "unset", cursor: "pointer", marginLeft: "auto",
                fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-accent)"
              }}>{t.voirTout}</button>
          </div>

          {echeances.slice(0, 3).map((e, i) => (
            <EventCard key={e.id}
              imminent={i === 0}
              nom={t.langue === "fr" ? e.nom : (e.nomEn || e.nom)}
              type={e.type}
              dateLabel={e.jours === 0 ? t.aujourdhui : (t.langue === "fr" ? e.date : e.dateEn)}
              precision={t.langue === "fr" ? e.precision : (e.precisionEn || e.precision)}
              jours={e.jours}
              note={i === 0 ? (t.langue === "fr" ? e.note : e.noteEn) : undefined}
              noteOrigine={i === 0 ? (t.langue === "fr" ? e.noteOrigine : e.noteOrigineEn) : undefined}
              noteDate={i === 0 ? (t.langue === "fr" ? e.noteDate : e.noteDateEn) : undefined}
              actions={[t.preparer, t.marquerEnvoye]}
              onPreparer={() => onOpen && onOpen("preparation")}
              onEnvoye={() => onOpen && onOpen("envoye")}
              onOuvrir={() => onOpen && onOpen("occasion", e)}
              style={{ marginBottom: 10 }} />
          ))}

          <Button platform="mobile" full icon="plus" style={{ marginTop: 8 }}
            onClick={() => onOpen && onOpen("note")}>{t.laisserNote}</Button>
        </>
      )}
    </div>
  );
}
