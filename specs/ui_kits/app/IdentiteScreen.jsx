import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { Provenance } from "../../components/content/Provenance.jsx";

/* Identité d'un proche (3.18) — aligné sur l'entité Person du dictionnaire.
 *
 * L'intro dit pourquoi ces champs existent : ils orientent ce que Lehno écrit.
 * Sans elle, ils passeraient pour un classement administratif.
 *
 * Quatre décisions qui viennent du dictionnaire :
 *
 * 1. LE NOM D'USAGE est un champ à part. « Maman », « mon vieux » : c'est ce
 *    nom-là qui apparaît dans les messages, pas celui des listes. Les confondre
 *    faisait écrire « Bonjour Marie-Ange Nkoulou » à quelqu'un qui dit « Maman ».
 *
 * 2. LE REGISTRE a trois valeurs — familier, amical, formel — et pas quatre.
 *    Le kit en avait inventé une quatrième ; un choix qui n'existe pas dans le
 *    modèle ne se sauvegarde pas.
 *
 * 3. LE LIEN coexiste avec LE SOUVENIR. L'enum sert la génération, le texte
 *    libre garde ce que l'enum écrase — « on a fait la fac ensemble ». Le
 *    dictionnaire insiste sur cette coexistence : ce ne sont pas deux façons de
 *    dire la même chose.
 *
 * 4. LE GENRE N'A PAS DE CHAMP. Le dictionnaire le dit lui-même : signal de
 *    dernier recours, jamais un champ à remplir, et `unspecified` est une
 *    valeur légitime. Lui donner une place ici en ferait une question posée.
 *
 * La suppression vit en bas, en rouge de contour : trouvable sans être offerte.
 */

const REGISTRES = ["registreFamilier", "registreAmical", "registreFormel"];

const RELATIONS = [
  "relFamilleProche", "relFamilleEtendue", "relAmi", "relPartenaire",
  "relCollegue", "relPro", "relConnaissance"
];

const CANAUX = ["canalWhatsapp", "canalSms", "canalEmail", "canalAutre"];

function Choix({ options, valeur, onSet, t }) {
  return (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
      {options.map((k) => {
        const actif = valeur === k;
        return (
          <button key={k} type="button" onClick={() => onSet(k)} aria-pressed={actif}
            className="lehno-focusable" style={{
              fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
              padding: "8px 14px", minHeight: 38, borderRadius: "var(--radius-pill)",
              cursor: "pointer",
              border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
              background: actif ? "var(--action)" : "transparent",
              color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
            }}>{t[k]}</button>
        );
      })}
    </div>
  );
}

export function IdentiteScreen({ t, etat = "nominal", qui = "Valery Bah", onEnregistrer }) {
  const [registre, setRegistre] = React.useState("registreAmical");
  const [relation, setRelation] = React.useState("relAmi");
  const [canal, setCanal] = React.useState("canalWhatsapp");
  const venueDeCollecte = etat === "collecte";

  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13, margin: "6px 0 18px" }}>
        <Avatar name={qui} size={52} />
        <div>
          <div className="lehno-display" style={{ fontSize: 20 }}>{t.identiteTitre}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 1 }}>
            {t.identiteIntro}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <TextField platform="mobile" label={t.champNom} defaultValue={qui} />
        {/* Le nom d'usage, distinct du nom des listes : c'est lui qui parle. */}
        <TextField platform="mobile" label={t.champAppelle} defaultValue={qui.split(" ")[0]}
          hint={t.champAppelleAide} />
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionLabel>{t.champRelation}</SectionLabel>
        <Choix options={RELATIONS} valeur={relation} onSet={setRelation} t={t} />
      </div>

      {/* Le souvenir garde la nuance que la liste écrase. */}
      <div style={{ marginTop: 20 }}>
        <TextField platform="mobile" label={t.champRelationHint}
          defaultValue={t.langue === "fr" ? "On a fait la fac ensemble" : "We were at uni together"}
          hint={t.champRelationHintAide} />
      </div>

      {venueDeCollecte ? (
        <Provenance origin={t.langue === "fr" ? "renseigné par Valery" : "filled in by Valery"}
          date={t.langue === "fr" ? "en mars" : "in March"} />
      ) : null}

      <div style={{ marginTop: 22 }}>
        <SectionLabel>{t.champRegistre}</SectionLabel>
        <Choix options={REGISTRES} valeur={registre} onSet={setRegistre} t={t} />
        <p style={{ margin: "9px 0 0", fontSize: 12.5, color: "var(--text-mention)" }}>
          {t.identiteRegistreAide}
        </p>
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionLabel>{t.champCanal}</SectionLabel>
        <Choix options={CANAUX} valeur={canal} onSet={setCanal} t={t} />
        <p style={{ margin: "9px 0 0", fontSize: 12.5, color: "var(--text-mention)" }}>
          {t.champCanalAide}
        </p>
      </div>

      <div style={{ marginTop: 22, display: "grid", gap: 14 }}>
        <TextField platform="mobile" label={t.champVille} defaultValue="Douala"
          hint={t.champVilleAide} />
        <TextField platform="mobile" label={t.champLangueProche}
          defaultValue={t.langue === "fr" ? "Français" : "English"} />
      </div>

      <Button platform="mobile" full style={{ marginTop: 24 }} onClick={onEnregistrer}>
        {t.enregistrer}
      </Button>

      <div style={{
        marginTop: "auto", paddingTop: 28, borderTop: "1px solid var(--border-hairline)"
      }}>
        <Button platform="mobile" full variant="destructive-outline" icon="trash-2">
          {t.identiteSupprimer}
        </Button>
        <p style={{
          margin: "8px 0 0", fontSize: 12, color: "var(--text-mention)", textAlign: "center"
        }}>{t.identiteSupprimerAide}</p>
      </div>
    </div>
  );
}
