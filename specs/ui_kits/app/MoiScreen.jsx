import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { Icon } from "../../components/core/Icon.jsx";

/* Moi (3.17) — ce que je montre de moi.

   L'onglet s'est séparé des réglages parce que les deux moitiés du produit n'ont
   pas la même mécanique. Célébrer les autres est intime. Être célébré est public :
   un Mur, une liste se partagent en un statut et atteignent des dizaines de
   personnes d'un coup. Ranger cette moitié dans les réglages revenait à mettre la
   porte d'entrée dans un placard.

   D'où le dessin : les deux objets qui se partagent sont des cartes, avec leur
   état et leur geste de partage. Le reste est en lignes — on vient les consulter,
   pas les travailler. */

function Rang({ libelle, valeur, icone, onOuvrir }) {
  return (
    <button type="button" onClick={onOuvrir} className="lehno-focusable" style={{
      all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
      display: "flex", alignItems: "center", gap: 11, padding: "13px 0",
      minHeight: "var(--touch-min)", borderTop: "1px solid var(--border-hairline)"
    }}>
      {icone ? <Icon name={icone} size={17} color="var(--text-mention)" /> : null}
      <span style={{ flex: 1, fontSize: 14.5 }}>{libelle}</span>
      {valeur ? (
        <span style={{ fontSize: 13, color: "var(--text-mention)" }}>{valeur}</span>
      ) : null}
      <Icon name="chevron-right" size={15} color="var(--text-mention)" />
    </button>
  );
}

/* Une surface publique : son état, et le geste qui la fait circuler. */
function Surface({ titre, etat, actif, action, onAction, onOuvrir, illustration }) {
  return (
    <Card padding={13} radius="lg" style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={onOuvrir} className="lehno-focusable" style={{
          all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minWidth: 0,
          display: "flex", alignItems: "center", gap: 10, minHeight: "var(--touch-min)"
        }}>
          <Icon name={illustration} size={17} color="var(--text-mention)" />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="lehno-display" style={{ fontSize: 16.5, fontWeight: 500, display: "block" }}>{titre}</span>
            <span style={{
              display: "block", fontSize: 12.5, whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis",
              color: actif ? "var(--text-secondary)" : "var(--text-mention)"
            }}>{etat}</span>
          </span>
        </button>
        <Button platform="mobile" variant={actif ? "outline" : "primary"}
          icon={actif ? "share-2" : "plus"} onClick={onAction}
          style={{ flex: "none", minHeight: 40, padding: "9px 14px" }}>{action}</Button>
      </div>
    </Card>
  );
}

export function MoiScreen({ t, etat = "nominal", base = "../../", onOpen }) {
  const murPublie = etat !== "prive";
  const sansListe = etat === "sansListe" || etat === "premier";
  const listes = sansListe ? 0 : 2;
  const mots = etat === "premier" ? 0 : 14;

  return (
    <div style={{ padding: "var(--ry-haut) 16px 18px" }}>
      <button type="button" onClick={() => onOpen && onOpen("profil")}
        className="lehno-focusable" style={{
          all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
          display: "flex", alignItems: "center", gap: 13, margin: "0 0 var(--ry-item)",
          minHeight: "var(--touch-min)"
        }}>
        <Avatar name="Valentine" src={base + "assets/valentine.png"} size={54} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="lehno-display" style={{ fontSize: 21, display: "block" }}>Valentine</span>
          <span style={{ display: "block", fontSize: 13, color: "var(--text-secondary)" }}>
            lehno.app/valentine
          </span>
        </span>
        <Icon name="chevron-right" size={16} color="var(--text-mention)" />
      </button>
      <p style={{ margin: "0 0 var(--ry-bloc)", fontSize: 13.5, color: "var(--text-secondary)" }}>{t.moiSous}</p>

      <SectionLabel>{t.moiVitrine}</SectionLabel>
      <div style={{ marginTop: 9 }}>
        <Surface titre={t.moiMonMur} illustration="globe"
          etat={murPublie ? t.moiMurVisible : t.moiMurDesactive}
          actif={murPublie}
          action={murPublie ? t.moiPartager : t.moiPublierMur}
          onAction={() => onOpen && onOpen(murPublie ? "surface" : "monmur",
            murPublie ? { etat: "mur", nom: "Valentine" } : undefined)}
          onOuvrir={() => onOpen && onOpen("monmur")} />

        <Surface titre={t.moiListes} illustration="gift"
          etat={listes === 0 ? t.moiListesAucune : listes === 1 ? t.moiListesUne : t.moiListesN(listes)}
          actif={listes > 0}
          action={listes > 0 ? t.moiPartager : t.moiCreerListe}
          onAction={() => onOpen && onOpen(listes > 0 ? "surface" : "listes",
            listes > 0 ? { etat: "liste", nom: "Valentine", listeId: "anniv" } : undefined)}
          onOuvrir={() => onOpen && onOpen("listes")} />

        <Rang libelle={t.moiLienVoeux} icone="link"
          valeur={etat === "premier" ? t.moiLienVoeuxFerme : t.moiLienVoeuxOuvert}
          onOuvrir={() => onOpen && onOpen("surface", { etat: "voeu", nom: "Valentine" })} />
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionLabel>{t.moiRetour}</SectionLabel>
        <div style={{ marginTop: 4 }}>
          <Rang libelle={t.moiMotsRecus} icone="message-square"
            valeur={mots === 0 ? t.moiMotsAucun : t.moiMotsN(mots)}
            onOuvrir={() => onOpen && onOpen("monmur", { onglet: "mots" })} />
          <Rang libelle={t.moiReservations} icone="bookmark"
            onOuvrir={() => onOpen && onOpen("reservations")} />
        </div>
      </div>
    </div>
  );
}
