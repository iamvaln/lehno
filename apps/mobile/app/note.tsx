import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  occurrenceSchema, personListSchema, type Occurrence, type Person,
} from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeRadius, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Avatar, Banner, Button, Icon, LoadingState, SectionLabel, TextField,
  chassisDeFeuille, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../lib/langue.js";
import { appel, ErreurDApi } from "../lib/api.js";
import { messageDErreur } from "../lib/session.js";
import { dateCourte } from "../lib/carnet.js";
import { libelleDeLEcheance } from "../lib/libelles.js";
import {
  ajouteLeProche, candidatsAAjouter, envoiDeLaNote, occasionRetenue,
  occasionsOffertes, peutEnregistrer, retireLeProche,
} from "../lib/note.js";

/* §3.5 — la saisie d'une note.
 *
 * ELLE MONTE EN FEUILLE, elle ne pousse pas. Une note s'écrit *à propos* de ce
 * qu'on a sous les yeux : le voile laisse voir l'écran derrière, et le fermer
 * est le même geste que l'annuler. C'est la décision native n°1.
 *
 * LE CURSEUR EST DANS LE TEXTE À L'OUVERTURE, et le reste se remplit dessous
 * pendant qu'on écrit : le carnet arrive en tâche de fond, les occasions
 * ensuite. Aucun de ces chargements ne retient la frappe.
 *
 * LE BOUTON PLEIN MONTE AVEC LE CLAVIER — `padding` sur iOS, rien sur Android
 * où le système redimensionne déjà. C'est la décision native n°3, et c'est ici
 * qu'elle compte le plus : sans elle, il faut fermer le clavier pour valider.
 *
 * AUCUN CHOIX DE CATÉGORIE. `createNoteSchema` n'a pas de champ `categories` :
 * c'est le SERVEUR qui range. L'écran dit ce qu'il fait pendant qu'il le fait
 * (« Rangement »), et ne propose ni catégorie ni repli fourre-tout.
 *
 * ELLE CRÉE, ELLE NE MODIFIE PAS. Le contrat n'offre ni PATCH ni DELETE sur une
 * note : le bouton de suppression du kit n'a pas de destination, et un geste
 * muet vaut moins qu'un geste absent.
 */

// Cent, le plafond du contrat — le même appel que la recherche. Le carnet est
// personnel : quelques centaines de fiches au plus.
const PAR_APPEL = 100;

// Ce qu'on demande d'échéances pour un proche. Bien au-delà de ce qu'une
// personne en a, et sous le plafond de 200 du contrat.
const OCCASIONS_DEMANDEES = 50;

/* Le contrat nomme `noteListSchema` mais pas son équivalent pour les
   échéances. On le compose ici depuis `occurrenceSchema` — sans importer zod,
   que le mobile ne porte pas en dépendance et que `lib/api.ts` raconte avoir
   retiré pour exactement cette raison. */
const listeDEcheances = occurrenceSchema.array();

// La feuille laisse voir l'écran derrière : elle ne monte jamais jusqu'en haut.
const RESPIRATION_DU_HAUT = nativeSpace[44];

export default function Note() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const routeur = useRouter();
  /* D'où l'on vient. La fiche passe son proche ; la carte d'échéance passe les
     deux — `occurrenceSchema` porte déjà `personId`, donc rien à redemander. */
  const { personId, occurrenceId } = useLocalSearchParams<{
    personId?: string;
    occurrenceId?: string;
  }>();

  const [texte, setTexte] = useState("");
  const [choisis, setChoisis] = useState<readonly string[]>(personId ? [personId] : []);
  const [occasion, setOccasion] = useState<string | null>(occurrenceId ?? null);

  const [carnet, setCarnet] = useState<Person[] | null>(null);
  const [echeances, setEcheances] = useState<Occurrence[]>([]);
  const [choix, setChoix] = useState(false);
  const [filtre, setFiltre] = useState("");

  /* DEUX échecs, pas un. Ils ne se réparent pas ensemble : les échéances qui
     reviennent effaceraient le message du carnet qui manque toujours, et la
     section « Pour qui » resterait vide sans plus rien pour l'expliquer. */
  const [echecCarnet, setEchecCarnet] = useState<string | null>(null);
  const [echecEcheances, setEchecEcheances] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const c = chassisDeFeuille({ couleurs, insetBas: insets.bottom });

  /* Le carnet, en tâche de fond. Il sert deux choses : nommer les proches déjà
     désignés — un identifiant de route ne s'affiche pas — et remplir la liste
     de ceux qu'on peut ajouter. */
  const chargeLeCarnet = useCallback(async () => {
    try {
      const tout: Person[] = [];
      let total = Infinity;
      while (tout.length < total) {
        const page = personListSchema.parse(await appel<unknown>(
          `/me/persons?sort=alpha&direction=asc&offset=${tout.length}&limit=${PAR_APPEL}`,
        ));
        total = page.total;
        if (page.persons.length === 0) break;
        tout.push(...page.persons);
      }
      setCarnet(tout);
      setEchecCarnet(null);
    } catch (e) {
      /* Un chargement qui échoue doit se DIRE, avec une sortie. Sans cela la
         section « Pour qui » resterait muette pour toujours, et la note ne
         pourrait plus s'enregistrer sans qu'on sache pourquoi. Le texte déjà
         saisi, lui, n'est pas perdu : rien ne se remonte. */
      setEchecCarnet(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useEffect(() => { void chargeLeCarnet(); }, [chargeLeCarnet]);

  /* Les occasions n'ont de sens qu'avec UN proche désigné : une échéance
     appartient à une personne. À deux, la section n'existe pas — et l'occasion
     qui restait sélectionnée tombe (voir `occasionRetenue`). */
  const seul = choisis.length === 1 ? choisis[0] : null;

  const chargeLesEcheances = useCallback(async () => {
    if (!seul) { setEcheances([]); setEchecEcheances(null); return; }
    try {
      const liste = listeDEcheances.parse(await appel<unknown>(
        `/me/occurrences?personId=${seul}&limit=${OCCASIONS_DEMANDEES}`,
      ));
      setEcheances(liste);
      setEchecEcheances(null);
    } catch (e) {
      setEchecEcheances(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [seul, langue]);

  useEffect(() => { void chargeLesEcheances(); }, [chargeLesEcheances]);

  const nomDe = useCallback((id: string): string => {
    return carnet?.find((p) => p.id === id)?.displayName ?? "";
  }, [carnet]);

  const candidats = useMemo(
    () => candidatsAAjouter(carnet ?? [], choisis, filtre, langue),
    [carnet, choisis, filtre, langue],
  );

  const offertes = useMemo(
    () => (seul ? occasionsOffertes(echeances, seul) : []),
    [echeances, seul],
  );

  const retenue = occasionRetenue(occasion, choisis);
  const pret = peutEnregistrer(texte, choisis) && !envoiEnCours;

  const enregistre = async () => {
    const envoi = envoiDeLaNote(texte, choisis, occasion);
    if (!envoi) return;
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      await appel<unknown>(envoi.chemin, { method: "POST", body: JSON.stringify(envoi.corps) });
      // La note est rangée : on retourne d'où l'on vient, et l'écran de
      // derrière — fiche ou accueil — se relit en reprenant la main.
      routeur.back();
    } catch (e) {
      setErreur(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
      setEnvoiEnCours(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.plein}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={c.scene}>
        {/* Le voile ferme : une feuille qui monte doit pouvoir se refuser sans
            viser un bouton, et fermer vaut annuler. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.retour}
          onPress={() => routeur.back()}
          style={c.voile}
        />

        <View
          style={[c.feuille, { maxHeight: height - insets.top - RESPIRATION_DU_HAUT }]}
          accessibilityViewIsModal
          accessibilityLabel={t.laisserNote}
        >
          <View style={c.poignee} accessibilityElementsHidden importantForAccessibility="no" />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.corpsDefilant}
            contentContainerStyle={styles.corps}
            showsVerticalScrollIndicator={false}
          >
            {/* Le curseur y est à l'ouverture : c'est la raison d'être de
                l'écran, et tout le reste se remplit pendant qu'on écrit. */}
            <TextField
              label={t.noteLabel}
              value={texte}
              onChangeText={setTexte}
              multiline
              autoFocus
            />

            <View style={styles.bloc}>
              <SectionLabel>{t.notePourQui}</SectionLabel>
              {/* Les puces attendent le carnet : un identifiant de route ne
                  s'affiche pas, et une puce sans nom ne se retire pas en
                  connaissance de cause. */}
              {carnet === null && choisis.length ? (
                <LoadingState variant="liste" rows={1} title={t.chargement} />
              ) : (
              <View style={styles.puces}>
                {choisis.map((id) => (
                  <View
                    key={id}
                    style={[styles.puce, { backgroundColor: couleurs.actionQuietBg }]}
                  >
                    <Avatar name={nomDe(id)} size={24} />
                    <Text style={[styles.puceTexte, { color: couleurs.textAccent }]}>
                      {nomDe(id)}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={nomDe(id)}
                      hitSlop={8}
                      onPress={() => setChoisis((v) => retireLeProche(v, id))}
                    >
                      <Icon name="x" size={13} strokeWidth={2} color={couleurs.textAccent} />
                    </Pressable>
                  </View>
                ))}
                {choix ? null : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => { setFiltre(""); setChoix(true); }}
                    style={[styles.ajout, { borderColor: couleurs.borderObject }]}
                  >
                    <Icon name="plus" size={14} strokeWidth={2} color={couleurs.textMention} />
                    <Text style={[styles.ajoutTexte, { color: couleurs.textMention }]}>
                      {t.noteAjouterProche}
                    </Text>
                  </Pressable>
                )}
              </View>
              )}

              {/* Un carnet se cherche : cinquante noms ne se parcourent pas à
                  l'œil. La liste s'ouvre ICI, sans quitter le texte en cours. */}
              {choix ? (
                <View style={[styles.liste, {
                  borderColor: couleurs.borderObject,
                  backgroundColor: couleurs.surfaceCard,
                }]}>
                  <View style={[styles.barre, { borderBottomColor: couleurs.borderHairline }]}>
                    <Icon name="search" size={15} color={couleurs.textMention} />
                    <TextInput
                      value={filtre}
                      onChangeText={setFiltre}
                      placeholder={t.rechercher}
                      placeholderTextColor={couleurs.textMention}
                      accessibilityLabel={t.rechercher}
                      autoCorrect={false}
                      autoCapitalize="none"
                      style={[styles.saisie, { color: couleurs.textBody }]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t.retour}
                      hitSlop={8}
                      onPress={() => setChoix(false)}
                    >
                      <Icon name="x" size={15} strokeWidth={2} color={couleurs.textMention} />
                    </Pressable>
                  </View>

                  {carnet === null ? (
                    <View style={styles.rembourre}>
                      <LoadingState variant="liste" rows={2} title={t.chargement} />
                    </View>
                  ) : candidats.length ? (
                    <ScrollView
                      style={styles.defile}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                    >
                      {candidats.map((p) => (
                        <Pressable
                          key={p.id}
                          accessibilityRole="button"
                          onPress={() => {
                            setChoisis((v) => ajouteLeProche(v, p.id));
                            setChoix(false);
                          }}
                          style={styles.rang}
                        >
                          <Avatar
                            name={p.displayName}
                            size={26}
                            {...(p.avatarUrl ? { source: p.avatarUrl } : {})}
                          />
                          <Text style={[styles.rangTexte, { color: couleurs.textBody }]}>
                            {p.displayName}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={[styles.vide, { color: couleurs.textMention }]}>
                      {t.videRechercheTitre}
                    </Text>
                  )}
                </View>
              ) : null}

              {/* Le message dit POURQUOI le bouton est éteint. Sans lui, un
                  bouton qui ne répond pas passe pour une panne. */}
              {choisis.length === 0 ? (
                <Text style={[styles.faute, { color: couleurs.feedbackError }]}>
                  {t.noteSansProche}
                </Text>
              ) : null}
            </View>

            {/* À DEUX, PAS D'OCCASION : une échéance appartient à une seule
                personne, et la rattacher aux deux poserait chez la seconde une
                note accrochée à une date qui n'est pas la sienne. Pas de titre
                de section sans contenu — la section s'en va tout entière. */}
            {seul ? (
              <View style={styles.bloc}>
                <SectionLabel>{t.noteOccasion}</SectionLabel>
                {offertes.length ? (
                  <>
                    {/* Une seule rangée qui défile, plutôt que des pastilles
                        qui s'empilent : dans une feuille, quatre rangs de plus
                        repoussent le bouton hors de vue. Le kit posait une
                        liste déroulante pour la même raison — RN n'en a pas
                        d'équivalent qui ne soit pas un second écran.

                        « Aucune » est un CHOIX, pas une absence de choix :
                        c'est lui qui fait la note durable. */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.rangee}
                    >
                      <Pastille
                        actif={retenue === null}
                        libelle={t.noteOccasionDurable}
                        onPress={() => setOccasion(null)}
                      />
                      {offertes.map((o) => (
                        <Pastille
                          key={o.id}
                          actif={retenue === o.id}
                          libelle={`${libelleDeLEcheance(o.kind, o.label, t)} · ${dateCourte(o.occurrenceDate, langue)}`}
                          onPress={() => setOccasion(retenue === o.id ? null : o.id)}
                        />
                      ))}
                    </ScrollView>
                    <Text style={[styles.aide, { color: couleurs.textMention }]}>
                      {t.noteOccasionAide}
                    </Text>
                  </>
                ) : (
                  /* Aucune date : on le dit, plutôt que de laisser une rangée
                     vide. La note reste durable, ce qui est le cas ordinaire. */
                  <Text style={[styles.aide, { color: couleurs.textMention }]}>
                    {t.noteOccasionAucune(nomDe(seul))}
                  </Text>
                )}
              </View>
            ) : null}

            {echecCarnet ?? echecEcheances ? (
              <View style={styles.bloc}>
                <Banner intent="error">{echecCarnet ?? echecEcheances}</Banner>
                <Button
                  variant="outline"
                  full
                  icon="refresh-cw"
                  onPress={() => {
                    void chargeLeCarnet();
                    void chargeLesEcheances();
                  }}
                  style={{ marginTop: nativeSpace[8] }}
                >
                  {t.maintReessayer}
                </Button>
              </View>
            ) : null}

            {erreur ? (
              <Text style={[styles.faute, { color: couleurs.feedbackError, marginTop: nativeSpace[12] }]}>
                {erreur}
              </Text>
            ) : null}
          </ScrollView>

          {/* LE PIED NE DÉFILE PAS : c'est lui qui monte avec le clavier.
              Pendant l'envoi, il dit ce que le serveur fait — il RANGE, et ce
              n'est pas nous qui rangeons. */}
          <View style={styles.pied}>
            {envoiEnCours ? (
              <LoadingState variant="envoi" title={t.noteRangement} />
            ) : (
              <Button full disabled={!pret} onPress={() => void enregistre()}>
                {t.enregistrer}
              </Button>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* Une pastille de choix unique, comme celles de l'identité — mais en rangée qui
   défile, parce qu'une feuille n'a pas la hauteur d'un écran. Réappuyer sur
   l'active la retire : une occasion choisie par erreur doit se défaire sans
   vider la note. */
function Pastille({ actif, libelle, onPress }: {
  actif: boolean;
  libelle: string;
  onPress: () => void;
}) {
  const couleurs = useCouleurs();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      onPress={onPress}
      style={[styles.pastille, {
        borderColor: actif ? "transparent" : couleurs.borderObject,
        backgroundColor: actif ? couleurs.action : "transparent",
      }]}
    >
      <Text
        numberOfLines={1}
        style={[styles.pastilleTexte, {
          color: actif ? couleurs.textOnAccent : couleurs.textSecondary,
        }]}
      >
        {libelle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1 },
  // Le corps CÈDE, le pied non : sans quoi une longue liste de proches
  // pousserait le bouton plein hors de la feuille.
  corpsDefilant: { flexShrink: 1 },
  corps: { paddingBottom: nativeSpace[16] },
  bloc: { marginTop: nativeSpace[16] },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: nativeSpace[8], marginTop: nativeSpace[8] },
  puce: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[6],
    minHeight: nativeTouchMin, paddingLeft: nativeSpace[6], paddingRight: nativeSpace[12],
    borderRadius: nativeRadius.pill,
  },
  puceTexte: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5 },
  ajout: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[6],
    minHeight: nativeTouchMin, paddingHorizontal: nativeSpace[14],
    borderRadius: nativeRadius.pill, borderWidth: nativeBorder.width, borderStyle: "dashed",
  },
  ajoutTexte: { fontFamily: nativeFont.bodyRegular, fontSize: 13 },
  liste: {
    marginTop: nativeSpace[8], borderRadius: nativeRadius.lg,
    borderWidth: nativeBorder.width, overflow: "hidden",
  },
  barre: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[8],
    paddingHorizontal: nativeSpace[12], minHeight: nativeTouchMin,
    borderBottomWidth: nativeBorder.width,
  },
  saisie: { flex: 1, minWidth: 0, fontFamily: nativeFont.bodyRegular, fontSize: 14.5, paddingVertical: nativeSpace[10] },
  defile: { maxHeight: 168 },
  rembourre: { padding: nativeSpace[12] },
  rang: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[10],
    paddingHorizontal: nativeSpace[12], minHeight: nativeTouchMin,
  },
  rangTexte: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  vide: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, padding: nativeSpace[14] },
  faute: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[8] },
  rangee: { gap: nativeSpace[6], paddingTop: nativeSpace[8], paddingRight: nativeSpace[4] },
  pastille: {
    minHeight: 38, maxWidth: 260, paddingHorizontal: nativeSpace[14], justifyContent: "center",
    borderRadius: nativeRadius.pill, borderWidth: nativeBorder.width,
  },
  pastilleTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 13 },
  aide: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[8] },
  pied: { paddingTop: nativeSpace[12] },
});
