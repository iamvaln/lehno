"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { PublicCollectForm, PublicSubmission } from "@lehno/contracts";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { interpoler } from "../../lib/texte.js";
import { PublicShell } from "../PublicShell.js";
import { Avatar, Banner, Button, TextField } from "../ui/index.js";
import { DejaEnvoye } from "./DejaEnvoye.js";

type Souhait = { label: string; prix: string; lien: string };
type Etat = "saisie" | "envoi" | "erreur";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const VIDE: Souhait = { label: "", prix: "", lien: "" };

/**
 * La collecte — silhouette « conversation, puis formulaire ».
 *
 * Un proche doit répondre vite et bien, **sans se sentir interrogé**. La page
 * ouvre donc sur qui demande et pourquoi, et le formulaire vient après,
 * resserré. Le titre est moyen, pas héroïque : ce n'est pas une page qui
 * séduit, c'est un service qu'on rend à quelqu'un.
 *
 * **On salue d'abord la personne**, et c'est seulement après qu'on dit de qui
 * vient l'invitation. L'inverse, c'est une machine qui se présente avant de
 * dire bonjour.
 *
 * Deux variantes. `nominatif` : le propriétaire sait qui il invite, la fiche
 * existe, la date est parfois pré-remplie, et l'adresse reste facultative —
 * il n'y a rien à vérifier chez quelqu'un qu'il a lui-même nommé. `public` :
 * n'importe qui répond, d'où deux champs de plus (le nom, et d'où l'on se
 * connaît) et une adresse requise.
 *
 * **Ce qui manque au modèle n'est pas simulé.** Pas de citation du
 * propriétaire (`CollectionLink.invitation_message` n'existe pas — mettre en
 * italique une phrase qu'il n'a pas écrite lui fait dire ce qu'il n'a pas dit),
 * pas de photo ni de précisions par souhait (`SubmittedWish` ne les porte pas),
 * pas de champ « pseudo Lehno » (un rattachement auto-déclaré, invérifiable,
 * que la plupart des répondants ne peuvent pas remplir — il viendra du lien
 * profond).
 */
export function Collecte(
  { t, langue, jeton, formulaire, devise, dejaEnvoye }: {
    t: Messages; langue: Langue; jeton: string;
    formulaire: PublicCollectForm;
    /** La devise de la plateforme, servie par `/public/config` : « 12 000 » ne
     *  dit ni des francs CFA ni des euros, et le propriétaire lira ce montant. */
    devise: string;
    dejaEnvoye: PublicSubmission[];
  },
): ReactNode {
  const { type, ownerDisplayName, personDisplayName, birthDate, ownerWallUsername } = formulaire;
  const ouvert = type === "public";

  const [etat, setEtat] = useState<Etat>("saisie");
  const [envoye, setEnvoye] = useState(false);
  const [date, setDate] = useState(birthDate ?? "");
  const [souhaits, setSouhaits] = useState<Souhait[]>([{ ...VIDE }]);
  const [mot, setMot] = useState("");
  const [nom, setNom] = useState("");
  const [relation, setRelation] = useState("");
  const [email, setEmail] = useState("");
  const [leurre, setLeurre] = useState("");

  const rendu = useRef<number | null>(null);
  useEffect(() => { rendu.current = Date.now(); }, []);

  const emailInvalide = email.length > 0 && !EMAIL_RE.test(email);
  /* Même règle que `collectSubmitSchema` : une contribution porte au moins une
     date, un souhait ou un mot. Une soumission vide n'apprend rien et encombre
     la file de validation. */
  const utile = date !== "" || souhaits.some((s) => s.label.trim() !== "") || mot.trim() !== "";
  const complet = utile
    && !emailInvalide
    && (!ouvert || (nom.trim() !== "" && email !== ""));

  const majSouhait = (rang: number, cle: keyof Souhait, valeur: string): void =>
    setSouhaits((liste) => liste.map((s, i) => (i === rang ? { ...s, [cle]: valeur } : s)));

  const envoyer = async (evenement: FormEvent<HTMLFormElement>): Promise<void> => {
    evenement.preventDefault();
    setEtat("envoi");
    const base = process.env["NEXT_PUBLIC_API_URL"] ?? "";

    /* Un souhait sans intitulé n'est pas un souhait : la ligne vide reste à
       l'écran pour qu'on puisse écrire dedans, elle ne part pas. Et un prix ne
       part jamais sans sa devise — le contrat le refuserait, à raison. */
    const retenus = souhaits
      .filter((s) => s.label.trim() !== "")
      .map((s) => {
        const prix = Number(s.prix.replace(/\s/g, "").replace(",", "."));
        return {
          label: s.label.trim(),
          ...(s.lien.trim() === "" ? {} : { link: s.lien.trim() }),
          ...(s.prix.trim() === "" || Number.isNaN(prix) ? {} : { price: prix, currency: devise }),
        };
      });

    try {
      const reponse = await fetch(`${base}/v1/public/collect/${encodeURIComponent(jeton)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(date === "" ? {} : { birthDate: date }),
          ...(retenus.length === 0 ? {} : { wishes: retenus }),
          ...(mot.trim() === "" ? {} : { personalNote: mot.trim() }),
          ...(email === "" ? {} : { submitterEmail: email }),
          ...(ouvert && nom.trim() !== "" ? { submitterName: nom.trim() } : {}),
          ...(ouvert && relation.trim() !== "" ? { relationHint: relation.trim() } : {}),
          website: leurre,
          ...(rendu.current === null ? {} : { renderedAt: rendu.current }),
        }),
      });
      if (!reponse.ok) { setEtat("erreur"); return; }
      setEnvoye(true);
      setEtat("saisie");
    } catch {
      setEtat("erreur");
    }
  };

  /* « Ajouter autre chose » remet un formulaire NEUF, pas le précédent
     rerempli : renvoyer les mêmes souhaits ferait deux fois la même ligne dans
     la file du propriétaire. */
  const recommencer = (): void => {
    setDate(birthDate ?? "");
    setSouhaits([{ ...VIDE }]);
    setMot("");
    setEnvoye(false);
  };

  return (
    <PublicShell
      t={t} langue={langue}
      // Avant le geste, le générique : promettre « tenez la liste de vos
      // proches » à quelqu'un qui n'a pas encore répondu, c'est lui parler
      // d'autre chose que de ce qu'il est venu faire.
      {...(envoye
        ? { acquisition: { titre: t.acqCollecteTitre, texte: t.acqCollecteTexte, action: t.acqCollecteAction } }
        : {})}
    >
      <section
        style={{
          maxWidth: "46rem", margin: "0 auto",
          padding: "clamp(40px,7vw,72px) var(--page-gutter)",
        }}
      >
        {envoye ? (
          <>
            <div style={{ marginBottom: "var(--space-24)" }}>
              <Banner intent="success">{t.collecteConfirmeTitre}</Banner>
            </div>
            <p style={{ margin: "0 0 var(--space-24)", textWrap: "pretty" }}>
              {interpoler(t.collecteConfirmeTexte, { nom: ownerDisplayName })}
            </p>
            <Button variant="outline" onClick={recommencer}>{t.collecteAjouterEncore}</Button>
          </>
        ) : (
          <>
            <header style={{ marginBottom: "var(--space-32)" }}>
              <h1
                className="titre"
                style={{
                  margin: 0,
                  fontWeight: "var(--font-display-regular)",
                  fontSize: "clamp(27px,3.6vw,37px)",
                  lineHeight: "var(--leading-display)",
                  letterSpacing: "var(--tracking-display)",
                  textWrap: "balance",
                }}
              >
                {personDisplayName
                  ? interpoler(t.collecteSalut, { nom: personDisplayName })
                  : t.collecteSalutPublic}
              </h1>

              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)", marginTop: "var(--space-20)" }}>
                <Avatar name={ownerDisplayName} size={42} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: "var(--font-body-semibold)" }}>{ownerDisplayName}</div>
                  <div style={{ fontSize: "var(--text-mention-s)", color: "var(--text-mention)" }}>
                    {ouvert ? t.collecteDemandePublic : t.collecteDemandeNominatif}
                  </div>
                </div>
              </div>

              <p style={{ margin: "var(--space-14) 0 0", color: "var(--text-secondary)", textWrap: "pretty" }}>
                {dejaEnvoye.length > 0
                  ? t.collecteChapeauRetour
                  : interpoler(
                      ouvert ? t.collecteChapeauPublic : t.collecteChapeauNominatif,
                      { nom: ownerDisplayName },
                    )}
              </p>

              {/* Nul si le propriétaire n'a pas publié son Mur : proposer un
                  lien vers une page dépubliée apprendrait qu'elle existe. */}
              {ownerWallUsername ? (
                <p style={{ margin: "var(--space-14) 0 0" }}>
                  <a className="lien" href={`/${langue}/m/${ownerWallUsername}`}>
                    {interpoler(t.collecteVoirMur, { nom: ownerDisplayName })}
                  </a>
                </p>
              ) : null}
            </header>

            <form onSubmit={envoyer} style={{ display: "grid", gap: "var(--space-24)" }}>
              {ouvert ? (
                <>
                  <TextField
                    label={t.collecteLabelNom}
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    autoComplete="name"
                    required
                  />
                  <TextField
                    label={t.collecteLabelRelation}
                    hint={t.collecteAideRelation}
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    maxLength={120}
                  />
                </>
              ) : null}

              <TextField
                label={t.collecteLabelDate}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                hint={interpoler(
                  ouvert ? t.collecteAideDatePublic : t.collecteAideDateNominatif,
                  { nom: ownerDisplayName },
                )}
              />

              <div style={{ display: "grid", gap: "var(--space-10)" }}>
                <div style={{ fontSize: "var(--text-body-xs)", color: "var(--text-secondary)" }}>
                  {t.collecteLabelSouhaits}
                </div>

                {/* L'historique se range ICI, pas en tête de page : c'est un
                    historique de CE champ. Il évite de proposer deux fois la
                    même chose, donc il doit se lire juste avant d'écrire — pas
                    trois écrans plus haut. */}
                {dejaEnvoye.length > 0 ? (
                  <DejaEnvoye t={t} langue={langue} contributions={dejaEnvoye} />
                ) : null}

                {souhaits.map((souhait, rang) => (
                  <div
                    key={rang}
                    style={{
                      border: "var(--border-width) solid var(--border-hairline)",
                      borderRadius: "var(--radius-lg)",
                      padding: "var(--space-12)", display: "grid", gap: "var(--space-10)",
                    }}
                  >
                    <TextField
                      aria-label={t.collecteLabelSouhaits}
                      placeholder={t.collectePlaceholderSouhait}
                      value={souhait.label}
                      onChange={(e) => majSouhait(rang, "label", e.target.value)}
                      maxLength={200}
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "var(--space-12)" }}>
                      <TextField
                        label={interpoler(t.collecteLabelPrix, { devise })}
                        inputMode="numeric"
                        value={souhait.prix}
                        onChange={(e) => majSouhait(rang, "prix", e.target.value)}
                      />
                      <TextField
                        label={t.collecteLabelLien}
                        type="url"
                        value={souhait.lien}
                        onChange={(e) => majSouhait(rang, "lien", e.target.value)}
                      />
                    </div>
                    {souhaits.length > 1 ? (
                      <div>
                        <Button
                          variant="text"
                          onClick={() => setSouhaits((l) => l.filter((_, i) => i !== rang))}
                        >
                          {t.collecteRetirerSouhait}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}

                <div>
                  <Button variant="text" onClick={() => setSouhaits((l) => [...l, { ...VIDE }])}>
                    {t.collecteAjouterSouhait}
                  </Button>
                </div>
              </div>

              <TextField
                label={interpoler(t.collecteLabelMot, { nom: ownerDisplayName })}
                multiline
                rows={4}
                value={mot}
                onChange={(e) => setMot(e.target.value)}
                hint={t.collecteAideMot}
                maxLength={2000}
              />

              <div
                style={{
                  paddingTop: "var(--space-20)",
                  borderTop: "var(--border-width) solid var(--border-hairline)",
                  display: "grid", gap: "var(--space-24)",
                }}
              >
                {ouvert ? null : (
                  <div className="surtitre" style={{ color: "var(--text-mention)" }}>{t.collecteFacultatif}</div>
                )}
                <TextField
                  label={t.collecteLabelEmail}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  invalid={emailInvalide}
                  autoComplete="email"
                  hint={interpoler(
                    ouvert ? t.collecteAideEmailPublic : t.collecteAideEmail,
                    { nom: ownerDisplayName },
                  )}
                  {...(ouvert ? { required: true } : {})}
                />
              </div>

              <div>
                <Button type="submit" disabled={!complet || etat === "envoi"}>
                  {interpoler(t.collecteEnvoyer, { nom: ownerDisplayName })}
                </Button>
              </div>

              {/*
                Champ leurre. Hors du flux, hors du clavier, hors des lecteurs
                d'écran et hors du remplissage automatique — même motif que
                ContactForm.
              */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
                <label htmlFor="collecte-website">Site web</label>
                <input
                  id="collecte-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={leurre}
                  onChange={(e) => setLeurre(e.target.value)}
                />
              </div>

              {etat === "erreur" && <Banner intent="error">{t.collecteErreur}</Banner>}
            </form>
          </>
        )}
      </section>
    </PublicShell>
  );
}
