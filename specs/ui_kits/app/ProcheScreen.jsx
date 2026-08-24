import React from "react";
import { Avatar } from "../../components/core/Avatar.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { Card } from "../../components/core/Card.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Quote } from "../../components/content/Quote.jsx";
import { Provenance } from "../../components/content/Provenance.jsx";
import { Countdown } from "../../components/content/Countdown.jsx";
import { Button } from "../../components/core/Button.jsx";

export function ProcheScreen({ t, onOpen }) {
  return (
    <div style={{ padding: "0 16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
        <Avatar name="Valery Bah" size={54} />
        <div style={{ flex: 1 }}>
          <div className="lehno-display" style={{ fontSize: 22 }}>Valery Bah</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Anniversaire · 24 août · registre amical</div>
        </div>
        <Countdown days={3} size="m" />
      </div>

      <div style={{ margin: "18px 0" }}>
        <SectionLabel>{t.ficheInterets}</SectionLabel>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}>
          <Tag>vinyles</Tag><Tag>rando</Tag><Tag>café de spécialité</Tag>
        </div>
      </div>

      <Card padding={15} radius="lg" style={{ marginBottom: 10 }}>
        <SectionLabel>{t.ficheIdees}</SectionLabel>
        <Quote size={15} style={{ marginTop: 6 }}>{t.ficheIdeeTexte}</Quote>
        <Provenance origin="noté" date="en mars" />
      </Card>

      <Card padding={15} radius="lg" style={{ marginBottom: 18 }}>
        <SectionLabel>{t.ficheNogo}</SectionLabel>
        <Quote size={15} style={{ marginTop: 6 }}>{t.ficheNogoTexte}</Quote>
        <Provenance origin={t.langue === "fr" ? "dit par Valery" : "said by Valery"}
          date={t.langue === "fr" ? "en janvier" : "in January"} />
      </Card>

      <div style={{ display: "grid", gap: 10 }}>
        <Button platform="mobile" full onClick={() => onOpen("preparation")}>
          {t.fichePreparer(t.langue === "fr" ? "24 août" : "24 Aug")}
        </Button>
        <Button platform="mobile" full variant="outline" icon="plus"
          onClick={() => onOpen("note")}>{t.ficheAjouterNote}</Button>

        {/* Les trois sorties de la fiche que la spec nomme : faire compléter
            par le proche, corriger ce qui oriente la génération, revoir les
            portraits déjà produits. */}
        <Button platform="mobile" full variant="text" icon="link"
          onClick={() => onOpen("collecte")}>{t.ficheCollecte}</Button>
        <Button platform="mobile" full variant="text" icon="user-pen"
          onClick={() => onOpen("identite")}>{t.ficheIdentite}</Button>
        <Button platform="mobile" full variant="text" icon="sparkles"
          onClick={() => onOpen("portrait")}>{t.fichePortraits}</Button>
      </div>
    </div>
  );
}
