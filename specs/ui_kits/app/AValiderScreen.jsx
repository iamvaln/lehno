import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { Button } from "../../components/core/Button.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { Quote } from "../../components/content/Quote.jsx";
import { Provenance } from "../../components/content/Provenance.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";

/* À valider (3.8) — le sas. Rien de ce qui vient de l'extérieur n'entre dans
   une fiche sans passer ici : c'est la garantie que le produit donne, et cet
   écran est l'endroit où elle se tient.

   Deux actions par contribution, et pas de troisième : retenir ou écarter. Un
   « plus tard » ferait s'empiler ce que personne ne rouvre.

   « Écarter » ne dit pas « supprimer » : la contribution n'était pas fausse,
   elle n'entre pas. La nuance compte quand c'est un proche qui a écrit. */

const CONTRIBS = {
  fr: [
    { id: "c1", qui: "Valery Bah", genre: "validerSouhait",
      texte: "Un moulin à café manuel, le mien rend l'âme.",
      origine: "déposé par Valery", quand: "hier" },
    { id: "c2", qui: "Awa Diop", genre: "validerGout",
      texte: "La céramique, depuis le cours de l'an dernier.",
      origine: "déposé par Awa", quand: "hier" },
    { id: "c3", qui: "Vous", genre: "validerVoeu",
      texte: "Bon anniversaire — cette année encore, tu as tenu tout le monde debout.",
      origine: "déposé par Awa", quand: "il y a 3 jours" }
  ],
  en: [
    { id: "c1", qui: "Valery Bah", genre: "validerSouhait",
      texte: "A hand coffee grinder, mine is giving up.",
      origine: "sent by Valery", quand: "yesterday" },
    { id: "c2", qui: "Awa Diop", genre: "validerGout",
      texte: "Ceramics, since last year's class.",
      origine: "sent by Awa", quand: "yesterday" },
    { id: "c3", qui: "You", genre: "validerVoeu",
      texte: "Happy birthday — another year of keeping everyone standing.",
      origine: "sent by Awa", quand: "3 days ago" }
  ]
};

export function AValiderScreen({ t, etat = "nominal", onFait }) {
  const langue = t.langue === "fr" ? "fr" : "en";
  const [restants, setRestants] = React.useState(CONTRIBS[langue].map((c) => c.id));

  React.useEffect(() => { setRestants(CONTRIBS[langue].map((c) => c.id)); }, [langue]);

  const traiter = (id, retenu) => {
    setRestants((v) => v.filter((x) => x !== id));
    if (onFait) onFait(retenu ? t.validerRetenu(1) : t.validerEcarte);
  };

  const liste = CONTRIBS[langue].filter((c) => restants.indexOf(c.id) >= 0);

  if (etat === "vide" || !liste.length) {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="contributions-aucune"
          titre={t.validerVideTitre} texte={t.validerVideTexte} />
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 18px" }}>
      <p style={{
        margin: "4px 0 18px", fontSize: 14, color: "var(--text-secondary)", maxWidth: "38ch"
      }}>{t.validerIntro}</p>

      {liste.map((c) => (
        <Card key={c.id} padding={15} radius="lg" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={c.qui} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {t.validerPour(c.qui)}
              </div>
            </div>
            <Tag tone="quiet" style={{ fontSize: 11, padding: "3px 9px" }}>{t[c.genre]}</Tag>
          </div>

          {/* La contribution est une parole : elle se compose en italique,
              comme tout ce qui vient de quelqu'un. */}
          <Quote size={15} style={{ marginTop: 10 }}>{c.texte}</Quote>
          <Provenance origin={c.origine} date={c.quand} />

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Button platform="mobile" onClick={() => traiter(c.id, true)}
              style={{ flex: 1, minHeight: 42 }}>{t.validerRetenir}</Button>
            <Button platform="mobile" variant="text" onClick={() => traiter(c.id, false)}
              style={{ minHeight: 42 }}>{t.validerEcarter}</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
