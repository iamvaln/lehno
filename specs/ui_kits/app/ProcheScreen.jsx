import React from "react";
import { Avatar } from "../../components/core/Avatar.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { Card } from "../../components/core/Card.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Quote } from "../../components/content/Quote.jsx";
import { Provenance } from "../../components/content/Provenance.jsx";
import { Countdown } from "../../components/content/Countdown.jsx";
import { Button } from "../../components/core/Button.jsx";

/* « qui » vient du clic : sans lui, toucher Célarine dans une liste ouvrait la fiche
   de Valery. Le défaut par défaut n'est qu'un repli pour la planche. */
const NOTES = [
  { id: "n1", nature: "idee", origine: "noté", origineEn: "noted", quand: "en mars", quandEn: "in March" },
  { id: "n2", nature: "eviter", origine: "dit par Valery", origineEn: "said by Valery", quand: "en janvier", quandEn: "in January" }
];

/* Les goûts d'un proche ne se plafonnent pas : c'est la matière que l'utilisateur
   apporte, et un plafond arbitraire lui ferait choisir lesquels sacrifier. C'est
   la fiche qui se borne — six d'abord, le reste d'un appui. */
const GOUTS = {
  fr: ["vinyles", "rando", "café de spécialité", "cuisine thaï", "vélo", "romans policiers", "jardinage", "photo argentique", "jazz", "poterie"],
  en: ["vinyl", "hiking", "specialty coffee", "Thai food", "cycling", "crime novels", "gardening", "film photography", "jazz", "pottery"]
};
const VISIBLES = 6;

export function ProcheScreen({
  t, qui = "Valery Bah", personne, gouts, flags = {}, onOpen
}) {
  /* LES GÉNÉRATIONS ÉTEINTES, LA FICHE NE DOIT PAS PARAÎTRE AMPUTÉE. « Préparer
     le 24 août » et « Ses portraits » partent ensemble — l'un mène à la
     production, l'autre à ce qu'elle a produit. Ce qui reste est le socle :
     noter ce qu'on apprend, poser une date de plus, corriger l'identité. Le
     geste principal change donc d'identité au lieu de laisser un vide en haut :
     c'est « Ajouter une note » qui prend la pleine largeur. */
  const genere = flags.generation !== false;
  const collecte = flags.collect !== false;
  const TYPE_CLE = {
    anniversaire: "typeAnniversaire", mariage: "typeMariage", retraite: "typeRetraite",
    naissance: "typeNaissance", etape: "typeEtape", fete: "typeFete", autre: "typeAutre"
  };
  const dateDite = personne
    ? (t.langue === "fr" ? personne.date : (personne.dateEn || personne.date))
    : (t.langue === "fr" ? "24 août" : "24 Aug");
  const sousTitre = personne
    ? [t[TYPE_CLE[personne.type] || "typeAutre"], dateDite].filter(Boolean).join(" · ")
    : t.ficheSousTitre;
  const jours = personne && personne.jours != null ? personne.jours : 3;
  const [tousGouts, setTousGouts] = React.useState(false);
  /* Le dictionnaire est déjà dans la langue courante ; seules les mentions de
     provenance, écrites dans la donnée d'aperçu, portent leurs deux versions. */
  const notes = NOTES.map((n) => ({
    ...n, texte: n.nature === "idee" ? t.ficheIdeeTexte : t.ficheNogoTexte
  }));
  return (
    <div style={{ padding: "var(--ry-haut) 16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: "var(--ry-item)" }}>
        <Avatar name={qui} size={54} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="lehno-display" style={{ fontSize: 22, textWrap: "pretty" }}>{qui}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{sousTitre}</div>
        </div>
        <Countdown size="s" today={jours === 0} style={{ flex: "none" }}
          label={jours === 0 ? t.aujourdhui : t.decompte(jours)} />
      </div>

      <div style={{ margin: "var(--ry-bloc) 0 var(--ry-item)" }}>
        <SectionLabel>{t.ficheInterets}</SectionLabel>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}>
          {(() => {
            const liste = gouts || GOUTS[t.langue === "fr" ? "fr" : "en"];
            const montres = tousGouts ? liste : liste.slice(0, VISIBLES);
            const reste = liste.length - montres.length;
            return (
              <>
                {montres.map((g) => <Tag key={g}>{g}</Tag>)}
                {reste ? (
                  <button type="button" onClick={() => setTousGouts(true)}
                    className="lehno-focusable" style={{
                      all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
                      minHeight: 30, padding: "0 12px", borderRadius: "var(--radius-pill)",
                      border: "1px dashed var(--border-object)", color: "var(--text-accent)",
                      fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600
                    }}>{t.ficheGoutsReste(reste)}</button>
                ) : null}
              </>
            );
          })()}
        </div>
      </div>

      <SectionLabel>{t.ficheNotes}</SectionLabel>
      <div style={{ display: "grid", gap: "var(--ry-item)", margin: "var(--ry-item) 0 var(--ry-bloc)", flex: "none" }}>
        {notes.map((n) => {
          const eviter = n.nature === "eviter";
          return (
            <button key={n.id} type="button" onClick={() => onOpen && onOpen("note", { nom: qui, note: n })}
              className="lehno-focusable" style={{
                all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
                display: "block", padding: 15, borderRadius: "var(--radius-lg)",
                border: eviter ? "1px dashed var(--border-object)" : "1px solid var(--border-object)",
                background: eviter ? "transparent" : "var(--surface-card)"
              }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontFamily: "var(--font-body)", fontSize: 12, letterSpacing: ".04em",
                textTransform: "uppercase", fontWeight: 600,
                color: eviter ? "var(--text-secondary)" : "var(--text-accent)"
              }}>
                <Icon name={eviter ? "ban" : "lightbulb"} size={13} strokeWidth={2} />
                {eviter ? t.noteEviter : t.noteIdee}
              </span>
              <Quote size={15} style={{ marginTop: 6 }}>{n.texte}</Quote>
              <Provenance origin={t.langue === "fr" ? n.origine : n.origineEn}
                date={t.langue === "fr" ? n.quand : n.quandEn} />
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {genere ? (
          <Button platform="mobile" full onClick={() => onOpen("preparation", { nom: qui })}>
            {t.fichePreparer(dateDite)}
          </Button>
        ) : (
          <Button platform="mobile" full icon="plus"
            onClick={() => onOpen("note", { nom: qui })}>{t.ficheAjouterNote}</Button>
        )}
        {/* Deux ajouts de même poids : ce qu'on a appris, et une date de plus
            pour cette personne. Côte à côte, ils ne poussent pas la fiche. */}
        <div style={{
          display: "grid", gap: 8,
          gridTemplateColumns: genere ? "1fr 1fr" : "1fr"
        }}>
          {genere ? (
            <Button platform="mobile" full variant="outline" icon="plus"
              onClick={() => onOpen("note", { nom: qui })}>{t.ficheAjouterNote}</Button>
          ) : null}
          <Button platform="mobile" full variant="outline" icon="plus"
            onClick={() => onOpen("evenement", {
              nom: qui, jour: 24, moisFr: "août", moisEn: "August"
            })}>{t.ficheAjouterDate}</Button>
        </div>

        {/* Les trois sorties de la fiche que la spec nomme : faire compléter
            par le proche, corriger ce qui oriente la génération, revoir les
            portraits déjà produits. Empilées pleine largeur, elles pesaient
            autant que les deux actions du dessus et faisaient défiler la fiche.
            En rangée, elles se lisent d'un coup et gardent leur cible de 44 px. */}
        {(() => {
          /* Les renvois disparaissent plutôt que de mener à un écran éteint, et
             la rangée se resserre sur ce qui reste : à un seul, la tuile
             carrée deviendrait une case orpheline — elle passe en ligne. */
          const sorties = [
            collecte ? { cle: "collecte", icone: "link", libelle: t.ficheCollecteCourt } : null,
            { cle: "identite", icone: "user-pen", libelle: t.ficheIdentiteCourt },
            genere ? { cle: "portrait", icone: "sparkles", libelle: t.fichePortraitsCourt } : null
          ].filter(Boolean);
          if (sorties.length === 1) {
            const a = sorties[0];
            return (
              <Button platform="mobile" full variant="outline" icon={a.icone}
                style={{ marginTop: 2 }}
                onClick={() => onOpen(a.cle, { nom: qui })}>{a.libelle}</Button>
            );
          }
          return (
        <div style={{
          display: "grid", gap: 8, marginTop: 2,
          gridTemplateColumns: "repeat(" + sorties.length + ", 1fr)"
        }}>
          {sorties.map((a) => (
            <button key={a.cle} type="button" onClick={() => onOpen(a.cle, { nom: qui })}
              className="lehno-focusable" style={{
                all: "unset", boxSizing: "border-box", cursor: "pointer",
                display: "grid", gap: 5, justifyItems: "center", alignContent: "center",
                minHeight: 66, padding: "8px 4px", textAlign: "center",
                border: "1px solid var(--border-object)", borderRadius: "var(--radius-sm)",
                color: "var(--text-accent)", fontFamily: "var(--font-body)",
                fontSize: 12, lineHeight: 1.2
              }}>
              <Icon name={a.icone} size={18} />
              <span>{a.libelle}</span>
            </button>
          ))}
        </div>
          );
        })()}
      </div>
    </div>
  );
}
