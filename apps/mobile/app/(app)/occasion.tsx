import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFocusEffect, useLocalSearchParams, useRouter, type Href,
} from "expo-router";
import {
  creditBalanceSchema, generationResultSchema, generationsSchema, noteListSchema,
  occurrenceSchema, receivedWishListSchema, wishSchema,
  type GenerationResult, type Note, type Occurrence, type ReceivedWish, type Wish,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeLetterSpacing, nativeRadius, nativeSpace,
  nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Avatar, Banner, Button, Card, Countdown, CreditIndicator, Icon, LoadingState,
  PaidActionSheet, Provenance, Quote, SectionLabel, SensitiveBanner, Tag, TextField,
  Toast, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { useActionsPayantes } from "../../lib/MetadonneesProvider.js";
import { dateCourte } from "../../lib/carnet.js";
import { libelleDeLEcheance } from "../../lib/libelles.js";
import { coutDe, pistesOffertes } from "../../lib/preparation.js";
import { offreDeRefaire, relanceDuMessage } from "../../lib/generation.js";
import {
  corpsDeRetenu, corpsDuSouhait, estPassee, etatDuSouhait, identifiantDOccasion,
  ideesDeLOccasion, messageDeLOccasion, montreLeBlocDesSouhaits, montreLesSouhaits,
  montreLesVoeux, notesDeLOccasion, offreToutLaWishlist, socleEnPied, souhaitsMontres,
  voeuxDeLOccasion, type SaisieDeSouhait,
} from "../../lib/occasion.js";

/* Une occasion — §3.21.
 *
 * LA PORTE QUI MANQUAIT. Préparer vise une occasion, jamais une personne : le
 * contrat refuse un lancement qui ne cite pas d'occurrence. Tant que cet écran
 * n'existait pas, §3.7 et tout ce qui en découle étaient bâtis sans que rien
 * n'y mène.
 *
 * DEUX MOMENTS. Avant, on prépare — les souhaits, les notes de circonstance,
 * les pistes de génération. Après, il n'y a plus rien à préparer : on relit ce
 * qui a été envoyé et les mots reçus. Ce n'est pas un état dégradé, c'est
 * l'autre moitié de la vie d'une date.
 *
 * TROIS DRAPEAUX TOUCHENT CETTE PAGE, et aucun n'est le socle. `wishlist`
 * emporte le bloc des souhaits en entier ; `wishes` emporte les vœux reçus ;
 * les drapeaux de génération emportent la préparation. Ce qui reste — le
 * proche, la date, les notes — ne s'éteint pas, et c'est pour ça que l'écran
 * lui-même n'est pas gouverné.
 *
 * IL N'Y A PAS DE DRAPEAU `credits`. Le kit dessine un mode « gratuit » où les
 * coûts sortent de l'écran ; le registre l'interdit nommément — l'éteindre
 * « laissait des soldes indépensables ». Ce qui se paie s'annonce, toujours.
 */

/* Le contrat nomme `receivedWishListSchema` mais pas son équivalent pour les
   souhaits d'une occasion. On le compose ici depuis `wishSchema` — sans
   importer zod, que le mobile ne porte pas en dépendance et que `lib/api.ts`
   raconte avoir retiré pour exactement cette raison. */
const listeDeSouhaits = wishSchema.array();

// La devise par défaut de la saisie. Le contrat exige qu'un prix la porte, et
// le produit sert d'abord des monnaies que l'euro ne couvre pas.
const DEVISE = "XAF";

const SAISIE_VIERGE: SaisieDeSouhait = { intitule: "", prix: "", devise: DEVISE, details: "" };

export default function Occasion() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { occurrenceId } = useLocalSearchParams<{ occurrenceId: string }>();
  const { actives } = useDrapeaux();
  const prix = useActionsPayantes();

  /* CE QUI VIENT DE LA ROUTE N'EST PAS DE CONFIANCE. Un lien profond pose ce
     qu'il veut, et ce paramètre part dans un chemin d'API : sans cette garde,
     `?occurrenceId=../../admin` ferait fabriquer au client la requête qu'on ne
     voulait pas. La forme est celle du CONTRAT, pas une expression recopiée. */
  const idOccasion = identifiantDOccasion(occurrenceId);

  const [occasion, setOccasion] = useState<Occurrence | null>(null);
  const [notes, setNotes] = useState<readonly Note[]>([]);
  const [resultats, setResultats] = useState<readonly GenerationResult[]>([]);
  const [souhaits, setSouhaits] = useState<readonly Wish[] | null>(null);
  const [voeux, setVoeux] = useState<readonly ReceivedWish[]>([]);
  const [solde, setSolde] = useState<number | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const [tout, setTout] = useState(false);
  const [saisie, setSaisie] = useState<SaisieDeSouhait>(SAISIE_VIERGE);
  const [ouvreLaSaisie, setOuvreLaSaisie] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  /* RIEN NE SE PAIE EN SILENCE : « Refaire » repasse par la feuille qui annonce
     le coût et le solde, comme le premier lancement. */
  const [aRefaire, setARefaire] = useState(false);

  const sors = useCallback((): void => {
    if (routeur.canGoBack()) routeur.back();
    else routeur.replace("/(app)/accueil");
  }, [routeur]);

  const charge = useCallback(async () => {
    if (!idOccasion) return;
    try {
      /* L'occasion D'ABORD, seule : les notes se demandent par PROCHE, et on
         ne connaît le proche qu'une fois l'occasion lue. Les souhaits et les
         vœux dépendent en plus de sa NATURE et de sa date. Les enchaîner est
         ici une dépendance réelle, pas une maladresse. */
      const occ = occurrenceSchema.parse(await appel<unknown>(`/me/occurrences/${idOccasion}`));

      /* Les deux surfaces gouvernées ne se demandent que si elles ont lieu
         d'être : drapeau éteint, le serveur rend 404 par `@Feature`, et un
         appel lancé pour rien poserait un bandeau rouge sur un compte sain.
         `gouvernee` le dit aussi à la couture qui surveille les pannes. */
      const veutDesSouhaits = montreLesSouhaits(actives, occ);
      const veutDesVoeux = montreLesVoeux(actives) && estPassee(occ);

      const [brutNotes, brutGenerations, brutCredits, brutSouhaits, brutVoeux] = await Promise.all([
        appel<unknown>(`/me/persons/${occ.personId}/notes`),
        appel<unknown>("/me/generations"),
        appel<unknown>("/me/credits"),
        veutDesSouhaits
          ? appel<unknown>(`/me/occurrences/${occ.id}/wishes`, { gouvernee: true })
          : null,
        veutDesVoeux ? appel<unknown>("/me/received-wishes", { gouvernee: true }) : null,
      ]);

      setOccasion(occ);
      setNotes(noteListSchema.parse(brutNotes));
      setResultats(generationsSchema.parse(brutGenerations).generations);
      setSolde(creditBalanceSchema.parse(brutCredits).balance);
      setSouhaits(brutSouhaits === null ? null : listeDeSouhaits.parse(brutSouhaits));
      /* Les vœux se demandent tous et se trient ici : le contrat n'offre pas
         de filtre par occasion, et « on en reçoit quelques-uns, pas des
         milliers ». */
      setVoeux(brutVoeux === null ? [] : voeuxDeLOccasion(
        receivedWishListSchema.parse(brutVoeux), occ.id,
      ));
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [idOccasion, actives, langue]);

  /* AU RETOUR, PAS SEULEMENT À L'ARRIVÉE. On quitte cet écran pour écrire une
     note ou lancer un message, et on y revient : lire une seule fois au
     montage montrerait l'état d'avant le geste qu'on vient de faire.

     Arriver sans identifiant valide n'est pas un état à dessiner, c'est une
     navigation qui n'aurait pas dû partir : on ressort, sans avoir appelé. */
  useFocusEffect(useCallback(() => {
    if (!idOccasion) { sors(); return; }
    void charge();
  }, [idOccasion, sors, charge]));

  const ajoute = async (): Promise<void> => {
    if (!occasion) return;
    setEnvoi(true);
    setEchec(null);
    try {
      await appel<unknown>(`/me/occurrences/${occasion.id}/wishes`, {
        method: "POST",
        body: JSON.stringify(corpsDuSouhait(saisie)),
        gouvernee: true,
      });
      setSaisie(SAISIE_VIERGE);
      setOuvreLaSaisie(false);
      setAccuse(t.souhaitAjouterTitre);
      await charge();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  /* Le repère personnel se pose ici, et nulle part ailleurs : il n'existe pas
     d'écran dédié aux souhaits d'un proche, et un souhait qu'on ne peut jamais
     marquer rendrait l'étiquette « Retenu » inatteignable. */
  const marque = async (s: Wish): Promise<void> => {
    setEchec(null);
    try {
      await appel<unknown>(`/me/wishes/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify(corpsDeRetenu(s)),
        gouvernee: true,
      });
      await charge();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  /* REFAIRE EST UNE NOUVELLE DEMANDE, et elle se paie. Elle passe par
     `relanceDuMessage`, qui n'emporte PAS de clé d'idempotence : celle du
     premier lancement (`wish_message:<occasion>`) ferait rejoindre la
     génération précédente au lieu d'en produire une autre — on aurait appuyé
     sur « Refaire » pour relire le même texte. */
  const refais = async (): Promise<void> => {
    const relance = relanceDuMessage(occasion?.id);
    if (!relance) return;
    setEnvoi(true);
    setEchec(null);
    try {
      const brut = await appel<unknown>(relance.chemin, {
        method: "POST",
        body: JSON.stringify(relance.corps),
        gouvernee: true,
      });
      const lu = generationResultSchema.parse(brut);
      routeur.push({ pathname: "/generation", params: { id: lu.generation.id } } as Href);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  const ouvreLaGeneration = (id: string): void => {
    routeur.push({ pathname: "/generation", params: { id } } as Href);
  };

  if (echec && !occasion) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <Banner intent="error">{echec}</Banner>
        <View style={{ marginTop: nativeSpace[12] }}>
          <Button variant="outline" full icon="refresh-cw" onPress={() => void charge()}>
            {t.maintReessayer}
          </Button>
        </View>
      </View>
    );
  }

  if (!occasion) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  const passee = estPassee(occasion);
  const sensible = occasion.nature === "sensitive";
  const siennes = notesDeLOccasion(notes, occasion.id);
  const ecrit = messageDeLOccasion(resultats, occasion.id);
  const idees = ideesDeLOccasion(resultats, occasion.id);
  const pistes = passee ? [] : pistesOffertes(occasion, actives);

  const blocDesSouhaits = !passee && montreLeBlocDesSouhaits(actives);
  const listeDesSouhaits = montreLesSouhaits(actives, occasion);
  const tousLesSouhaits = souhaits ?? [];

  /* CE QUI EXISTE DÉJÀ NE SE REDEMANDE PAS. Un message produit sort de la
     liste des pistes : il se relit dans sa propre carte, avec « Refaire » qui
     redit son prix. Reproposer « Écrire le message » ferait repayer sans le
     dire — le crédit se débite à la DEMANDE, pas à l'affichage. */
  const aLancer = pistes.filter(({ kind }) => !(kind === "wish_message" && ecrit !== null));
  const coutDuMessage = coutDe(prix, "wish_message");
  const peutRefaire = ecrit !== null && offreDeRefaire(actives) && coutDuMessage !== null;
  const montrePreparer = aLancer.length > 0 || (idees !== null && !passee);

  const sousTitre = [
    libelleDeLEcheance(occasion.kind, occasion.label, t),
    dateCourte(occasion.occurrenceDate, langue),
  ].join(" · ");

  const dite = dateCourte(occasion.occurrenceDate, langue);

  const ditLEtat: Record<ReturnType<typeof etatDuSouhait>, string> = {
    offert: t.souhaitOffertEtat,
    retenu: t.listeRetenu,
    a_etudier: t.souhaitAEtudier,
  };

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }}>
      <ScrollView
        contentContainerStyle={[styles.page, {
          paddingTop: insets.top + nativeSpace[8],
          paddingBottom: insets.bottom + nativeSpace[24],
        }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.retour}
          onPress={() => routeur.back()}
          style={styles.retour}
        >
          <Icon name="chevron-left" size={20} color={couleurs.textBody} />
        </Pressable>

        {/* La bannière avant tout le reste : elle change la façon de lire ce qui
            suit, et arriver dessus après coup serait arriver trop tard. */}
        {sensible ? (
          <SensitiveBanner>{t.sensibleApproche(dite)}</SensitiveBanner>
        ) : null}

        {echec ? (
          <View style={{ marginBottom: nativeSpace[12] }}>
            <Banner intent="error">{echec}</Banner>
          </View>
        ) : null}

        {/* L'en-tête mène à la FICHE : on vient souvent ici depuis une liste, et
            « qui est-ce déjà » est la première question. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => routeur.push({
            pathname: "/(app)/proches/[id]", params: { id: occasion.personId },
          })}
          style={styles.entete}
        >
          <Avatar name={occasion.personDisplayName} size={46} />
          <View style={styles.identite}>
            <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>
              {occasion.personDisplayName}
            </Text>
            <Text style={[styles.quoi, { color: couleurs.textSecondary }]} numberOfLines={1}>
              {sousTitre}
            </Text>
          </View>
          {passee ? (
            <Tag tone="quiet">{t.occPassee}</Tag>
          ) : (
            <Countdown
              label={occasion.daysUntil === 0 ? t.aujourdhui : t.decompteBarre(occasion.daysUntil)}
              today={occasion.daysUntil === 0}
              size="s"
            />
          )}
        </Pressable>

        {/* CE QUI A ÉTÉ ÉCRIT, quand il y a quelque chose. Le titre dit lequel
            des deux états : envoyé, ou prêt et pas encore parti. */}
        {ecrit ? (
          <View style={styles.bloc}>
            <SectionLabel>
              {ecrit.etat === "envoye" ? t.occMessageEnvoye : t.occMessagePret}
            </SectionLabel>
            <Card surface="panel" padding={15} radius="lg" style={{ marginTop: nativeSpace[8] }}>
              <Quote size={15}>{ecrit.message.content}</Quote>
              {/* La provenance ne s'invente pas : le contrat ne dit pas de quelles
                  notes le texte est sorti. On date, et c'est tout — et « envoyé
                  le » ne se dit que lorsqu'il l'a été. */}
              <Provenance
                origin={ecrit.etat === "envoye" ? t.occEnvoyeLe : null}
                date={dateCourte(ecrit.message.createdAt.slice(0, 10), langue)}
              />
              {/* On ne repropose pas de payer ce qui est déjà écrit : « Voir »
                  le relit, « Refaire » seul redit son prix.

                  RIEN DE TOUT CELA SUR UNE DATE PASSÉE. Le mot est parti : il
                  n'y a plus ni ajustement à faire ni raison d'en repayer un
                  autre, et la carte redevient ce qu'elle est — un souvenir. */}
              {passee ? null : (
                <View style={styles.deuxGestes}>
                  <View style={{ flex: 1 }}>
                    <Button
                      full
                      variant="outline"
                      onPress={() => ouvreLaGeneration(ecrit.generationId)}
                    >
                      {t.prepVoir}
                    </Button>
                  </View>
                  {peutRefaire ? (
                    <Button variant="text" disabled={envoi} onPress={() => setARefaire(true)}>
                      {t.prepRelancer}
                    </Button>
                  ) : null}
                </View>
              )}
            </Card>
          </View>
        ) : null}

        {passee ? (
          /* LES MOTS REÇUS — et seulement ceux qu'on a acceptés. La section
             suit son drapeau : « aucun mot » sur une capacité fermée
             annoncerait un silence qui n'en est pas un. */
          montreLesVoeux(actives) ? (
            <View style={styles.bloc}>
              <SectionLabel>{t.occVoeuxRecus}</SectionLabel>
              {voeux.length ? (
                voeux.map((v) => (
                  <Card
                    key={v.id}
                    surface="panel"
                    padding={14}
                    radius="lg"
                    style={{ marginTop: nativeSpace[8] }}
                  >
                    <Quote size={14.5}>{v.content}</Quote>
                    {/* Un vœu anonyme reste un vœu : on ne comble pas le nom
                        manquant par un « quelqu'un » que personne n'a signé. */}
                    <Provenance
                      origin={v.authorName}
                      date={dateCourte(v.createdAt.slice(0, 10), langue)}
                    />
                  </Card>
                ))
              ) : (
                <Text style={[styles.rien, { color: couleurs.textSecondary }]}>
                  {t.occAucunVoeu}
                </Text>
              )}
            </View>
          ) : null
        ) : (
          <>
            {/* LA WISHLIST DE L'OCCASION. Le drapeau emporte le bloc entier ;
                la nature, elle, n'en change que le contenu — une occasion
                sensible garde son titre et dit pourquoi il n'y a rien. */}
            {blocDesSouhaits ? (
              <View style={styles.bloc}>
                <View style={styles.enteteDeBloc}>
                  <SectionLabel>{t.occSouhaits}</SectionLabel>
                  {/* « Ajouter » se tait sur une date sensible. Le kit le
                      garde, mais proposer « ce que c'est / combien » pour un
                      deuil dément la phrase qui suit juste au-dessous. */}
                  {listeDesSouhaits ? (
                    <Text
                      accessibilityRole="button"
                      onPress={() => setOuvreLaSaisie((o) => !o)}
                      style={[styles.lien, { color: couleurs.textAccent }]}
                    >
                      {t.souhaitAjouter}
                    </Text>
                  ) : null}
                </View>

                {!listeDesSouhaits ? (
                  <Text style={[styles.rien, { color: couleurs.textMention }]}>
                    {t.occSansSouhait}
                  </Text>
                ) : (
                  <>
                    {souhaitsMontres(tousLesSouhaits, tout).map((s, i) => {
                      const etat = etatDuSouhait(s);
                      return (
                        <Pressable
                          key={s.id}
                          accessibilityRole="button"
                          accessibilityLabel={`${s.label} — ${t.listeRetenu}`}
                          accessibilityState={{ selected: s.isShortlisted }}
                          onPress={() => void marque(s)}
                          style={[styles.ligne, i ? {
                            borderTopWidth: nativeBorder.width,
                            borderTopColor: couleurs.borderHairline,
                          } : null]}
                        >
                          <Text
                            style={[styles.libelle, { color: couleurs.textBody }]}
                            numberOfLines={1}
                          >
                            {s.label}
                          </Text>
                          <Tag tone={etat === "retenu" ? "outline" : "quiet"}>
                            {ditLEtat[etat]}
                          </Tag>
                          {/* L'étoile est l'affordance du seul geste que le
                              contrat offre ici : poser ou retirer le repère
                              personnel. Un chevron promettrait un écran de
                              détail qui n'existe pas. */}
                          <Icon
                            name="star"
                            size={16}
                            color={s.isShortlisted ? couleurs.textAccent : couleurs.textMention}
                          />
                        </Pressable>
                      );
                    })}

                    {/* Le reste s'ouvre SUR PLACE : il n'existe pas d'écran
                        pour les souhaits d'un proche, et un lien vers rien
                        vaut moins qu'un lien absent. */}
                    {offreToutLaWishlist(tousLesSouhaits, tout) ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setTout(true)}
                        style={[styles.ligne, {
                          borderTopWidth: nativeBorder.width,
                          borderTopColor: couleurs.borderHairline,
                        }]}
                      >
                        <Text style={[styles.davantage, { color: couleurs.textAccent }]}>
                          {t.occSouhaitsTout(tousLesSouhaits.length)}
                        </Text>
                        <Icon name="chevron-down" size={15} color={couleurs.textAccent} />
                      </Pressable>
                    ) : null}

                    {tousLesSouhaits.length === 0 && !ouvreLaSaisie ? (
                      <Text style={[styles.rien, { color: couleurs.textMention }]}>
                        {t.videSouhaitsTitre}
                      </Text>
                    ) : null}

                    {ouvreLaSaisie ? (
                      <View style={styles.saisie}>
                        <TextField
                          label={t.souhaitQuoi}
                          placeholder={t.souhaitQuoiExemple}
                          value={saisie.intitule}
                          onChangeText={(v) => setSaisie({ ...saisie, intitule: v })}
                        />
                        <View style={{ marginTop: nativeSpace[12] }}>
                          <TextField
                            label={t.souhaitCombien}
                            value={saisie.prix}
                            onChangeText={(v) => setSaisie({ ...saisie, prix: v })}
                          />
                        </View>
                        <View style={{ marginTop: nativeSpace[12] }}>
                          <TextField
                            multiline
                            label={t.souhaitPrecisions}
                            placeholder={t.souhaitPrecisionsExemple}
                            value={saisie.details}
                            onChangeText={(v) => setSaisie({ ...saisie, details: v })}
                          />
                        </View>
                        <View style={{ marginTop: nativeSpace[12] }}>
                          {/* Un intitulé vide n'est pas un souhait : le bouton
                              le dit avant l'aller-retour, plutôt que d'aller
                              chercher un refus. */}
                          <Button
                            full
                            icon="plus"
                            disabled={envoi || saisie.intitule.trim().length === 0}
                            onPress={() => void ajoute()}
                          >
                            {t.souhaitAjouter}
                          </Button>
                        </View>
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            ) : null}

            {/* LES NOTES DE CETTE CÉLÉBRATION — celles qui portent son
                identifiant, jamais les durables : une note qui décrit le proche
                reviendrait chaque année sous un titre qui la dément. */}
            <View style={styles.bloc}>
              <View style={styles.enteteDeBloc}>
                <SectionLabel>{t.occNotes}</SectionLabel>
                <Text
                  accessibilityRole="button"
                  onPress={() => routeur.push({
                    pathname: "/note",
                    params: { personId: occasion.personId, occurrenceId: occasion.id },
                  })}
                  style={[styles.lien, { color: couleurs.textAccent }]}
                >
                  {t.noteAjouter}
                </Text>
              </View>
              {siennes.length ? (
                siennes.map((n) => (
                  <Card
                    key={n.id}
                    surface="panel"
                    padding={14}
                    radius="lg"
                    style={{ marginTop: nativeSpace[8] }}
                  >
                    <Quote size={14.5}>{n.content}</Quote>
                    {/* « noté » et la date : la provenance dit d'où vient le
                        texte, et une note vient de la main de son auteur. */}
                    <Provenance
                      origin={t.souhaitOrigine}
                      date={dateCourte(n.createdAt.slice(0, 10), langue)}
                    />
                  </Card>
                ))
              ) : (
                <Text style={[styles.rien, { color: couleurs.textMention }]}>
                  {t.procheAucuneNote}
                </Text>
              )}
            </View>

            {/* PRÉPARER — et rien de tel sur une date passée : il n'y a plus de
                moment à préparer, seulement un souvenir à relire. */}
            {montrePreparer ? (
              <View style={styles.bloc}>
                <SectionLabel>{t.occPreparer}</SectionLabel>

                {/* DES IDÉES DÉJÀ TROUVÉES SE REVOIENT, elles ne se rachètent
                    pas. Le bouton change de verbe et perd son coût : il
                    n'ouvre plus une demande, il ouvre un résultat.

                    Et il paraît même drapeau éteint : celui-ci garde la
                    PRODUCTION, pas la relecture — un jeu d'idées déjà payé ne
                    disparaît pas parce qu'on a fermé la génération. */}
                {idees !== null ? (
                  <View style={{ marginTop: nativeSpace[10] }}>
                    <Button
                      full
                      variant="outline"
                      icon="sparkles"
                      onPress={() => ouvreLaGeneration(idees)}
                    >
                      {t.prepVoirIdees}
                    </Button>
                  </View>
                ) : null}

                {aLancer.map(({ kind }) => {
                  if (kind === "gift_ideas" && idees !== null) return null;
                  const cout = coutDe(prix, kind);
                  return (
                    <View key={kind} style={{ marginTop: nativeSpace[10] }}>
                      {/* Une piste dont le prix n'est pas servi ne se lance pas :
                          son bouton reste éteint plutôt que d'ouvrir une
                          confirmation qui ne saurait quoi annoncer. */}
                      <Button
                        full
                        variant={kind === "wish_message" ? "primary" : "outline"}
                        icon="sparkles"
                        disabled={cout === null}
                        onPress={() => routeur.push({
                          pathname: "/(app)/preparation", params: { occurrenceId: occasion.id },
                        })}
                      >
                        {kind === "wish_message" ? t.occMessage : t.occIdees}
                      </Button>
                      {cout !== null ? (
                        <View style={{ marginTop: nativeSpace[6] }}>
                          <CreditIndicator label={t.creditUnite(cout)} cost={cout} />
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                {/* LE SOLDE UNE SEULE FOIS, en pied de bloc : le répéter sous
                    chaque action le transforme en bruit. Sans lien de recharge —
                    §3.9 n'est pas portée, et un geste qui n'ouvre rien ment
                    davantage qu'un geste absent. */}
                {solde !== null ? (
                  <View style={{ marginTop: nativeSpace[10] }}>
                    <CreditIndicator label={t.creditReste(solde)} balance={solde} variant="solde" />
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* NI SOUHAITS NI PRÉPARATION : le geste du socle prend la place en
                pied plutôt que de laisser 450 px de vide sous une carte de
                note. C'est le seul qui reste, il devient l'action principale. */}
            {socleEnPied({ souhaits: blocDesSouhaits, pistes: montrePreparer ? 1 : 0 }) ? (
              <View style={styles.socle}>
                <Button
                  full
                  icon="plus"
                  onPress={() => routeur.push({
                    pathname: "/note",
                    params: { personId: occasion.personId, occurrenceId: occasion.id },
                  })}
                >
                  {t.occNoterPour(dite)}
                </Button>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* « Refaire » est une nouvelle demande, et rien ne se paie en silence :
          la feuille annonce le coût et le solde avant que quoi que ce soit
          parte. */}
      {aRefaire && coutDuMessage !== null && solde !== null ? (
        <PaidActionSheet
          surTitre={t.prepPour(occasion.personDisplayName)}
          titre={t.prepMessageTitre}
          resultat={t.prepMessageTexte}
          coutLibelle={t.creditUnite(coutDuMessage)}
          soldeLibelle={t.creditReste(solde)}
          lancer={t.feuilleLancer}
          recharger={t.feuilleRecharger}
          pasMaintenant={t.feuillePasMaintenant}
          cout={coutDuMessage}
          solde={solde}
          onConfirmer={() => { setARefaire(false); void refais(); }}
          onAnnuler={() => setARefaire(false)}
        />
      ) : null}

      {accuse ? (
        <Toast intent="success" insetBas={insets.bottom} onDismiss={() => setAccuse(null)}>
          {accuse}
        </Toast>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: nativeSpace[16] },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  entete: { flexDirection: "row", alignItems: "center", gap: nativeSpace[12] },
  identite: { flex: 1, minWidth: 0 },
  nom: {
    fontFamily: nativeFont.displayRegular, fontSize: 20,
    letterSpacing: nativeLetterSpacing(20, nativeTracking.display),
  },
  quoi: { fontFamily: nativeFont.bodyRegular, fontSize: 13, marginTop: nativeSpace[2] },
  bloc: { marginTop: nativeSpace[24] },
  enteteDeBloc: { flexDirection: "row", alignItems: "baseline", gap: nativeSpace[10] },
  lien: {
    marginLeft: "auto", fontFamily: nativeFont.bodyRegular, fontSize: 13,
    minHeight: nativeTouchMin, textAlignVertical: "center", lineHeight: nativeTouchMin,
  },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[10],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
  },
  libelle: { flex: 1, minWidth: 0, fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  davantage: { flex: 1, fontFamily: nativeFont.bodySemibold, fontSize: 13.5 },
  deuxGestes: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[8],
    marginTop: nativeSpace[12],
  },
  saisie: { marginTop: nativeSpace[16] },
  socle: { marginTop: "auto", paddingTop: nativeSpace[24] },
  rien: {
    fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginTop: nativeSpace[8],
    borderRadius: nativeRadius.sm,
  },
});
