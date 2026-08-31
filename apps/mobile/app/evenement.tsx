import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  metadataSchema, personListSchema, type EventKind, type Person,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeRadius, nativeSpace, nativeTouchMin,
} from "@lehno/tokens";
import { Avatar, Banner, Button, Icon, SectionLabel, TextField, useCouleurs } from "@lehno/ui-native";
import { useLangue } from "../lib/langue.js";
import { appel, ErreurDApi } from "../lib/api.js";
import { messageDErreur } from "../lib/session.js";
import { useTypesOuverts } from "../lib/MetadonneesProvider.js";
import { dateCourte, offreLeType } from "../lib/carnet.js";
import {
  RANG_DE_RAPPEL_PAR_DEFAUT,
  anneesOffertes, aujourdhuiCivil, borneLeJour, corpsDeCreation, dateDEvenement,
  demandeLAnnee, demandeLaDate, demandeLeChoixDuType, demandeLeLibelle,
  enToutesLettres, joursDuMois, joursJusqua, lireLeRefus, nomsDesMois,
  pretAEnregistrer, prochaineEcheance, typeInitial,
} from "../lib/evenement.js";

/* Ajouter une date (§3.6).
 *
 * L'ÉCRAN NE DÉCIDE RIEN : tout ce qui se décide est dans `lib/evenement.ts`,
 * où Vitest sait le lire. Ici il ne reste que du dessin, un appel et trois
 * états.
 *
 * AU LANCEMENT IL N'Y A QU'UNE NATURE. `events.other` éteint, `/me/metadata`
 * rend `["birthday"]`, la rangée de choix sort de l'écran — elle ne se grise
 * pas — et ce qu'elle disait passe dans le titre : « Nouvel anniversaire ».
 * Le drapeau n'est jamais testé ici : c'est la liste qu'on lit.
 *
 * LA DATE D'UN ANNIVERSAIRE SE LIT, ELLE NE SE SAISIT PAS. Le contrat la
 * calcule depuis `person.birthDate` ; des sélecteurs feraient choisir un jour
 * que l'événement ne prendrait pas.
 *
 * LE BOUTON MONTE AVEC LE CLAVIER — `padding` sur iOS, rien sur Android, où le
 * système redimensionne déjà la fenêtre.
 */
export default function Evenement() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { personId } = useLocalSearchParams<{ personId?: string }>();

  /* Les types ouverts viennent du fournisseur. `relus` est la liste que NOUS
     avons redemandée après le filet du serveur : elle l'emporte, le temps de
     cette saisie. Le fournisseur ne relit qu'au changement de session, et il
     n'expose pas de quoi le lui demander. */
  const duFournisseur = useTypesOuverts();
  const [relus, setRelus] = useState<readonly EventKind[] | null>(null);
  const ouverts = relus ?? duFournisseur;

  /* Le type suit la liste tant que personne n'a choisi — et il y retourne si
     la liste relue ne le porte plus. Un état gardé de son côté ferait rester
     « autre » sélectionné après que le serveur l'a fermé. */
  const [choisi, setChoisi] = useState<EventKind | null>(null);
  const type = choisi && offreLeType(ouverts, choisi) ? choisi : typeInitial(ouverts);

  const [carnet, setCarnet] = useState<Person[]>([]);
  const [proche, setProche] = useState<Person | null>(null);
  const [ouvreLeChoix, setOuvreLeChoix] = useState(false);
  const [filtre, setFiltre] = useState("");

  const [libelle, setLibelle] = useState("");
  const aujourdhui = useMemo(() => aujourdhuiCivil(new Date()), []);
  const [jour, setJour] = useState(() => Number(aujourdhui.slice(8, 10)));
  const [mois, setMois] = useState(() => Number(aujourdhui.slice(5, 7)));
  const [rangDAnnee, setRangDAnnee] = useState(0);
  const [rangDuRappel, setRangDuRappel] = useState(RANG_DE_RAPPEL_PAR_DEFAUT);

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [deja, setDeja] = useState(false);

  /* Le carnet en entier, comme la recherche : `/me/persons` n'a pas de `?q=`,
     et un carnet personnel tient en quelques centaines de fiches. */
  const charge = useCallback(async () => {
    const page = personListSchema.parse(await appel<unknown>(
      "/me/persons?sort=alpha&direction=asc&offset=0&limit=100",
    ));
    setCarnet(page.persons);
  }, []);

  useEffect(() => { void charge(); }, [charge]);

  /* Ouvert depuis une fiche, la personne est déjà là ; ouverte depuis Dates, la
     ligne reste vide tant qu'on n'a désigné personne. */
  useEffect(() => {
    if (!personId || proche) return;
    const trouve = carnet.find((p) => p.id === personId);
    if (trouve) setProche(trouve);
  }, [carnet, personId, proche]);

  const annees = anneesOffertes(jour, mois, aujourdhui);
  const annee = annees[rangDAnnee === 1 ? 1 : 0];
  const date = dateDEvenement(jour, mois, annee);

  /* Ce que le bloc « La date » affiche : la date saisie pour un événement
     libre, la prochaine échéance calculée pour un anniversaire. Rien tant
     qu'aucun proche n'est désigné, ou qu'il n'a pas de naissance connue — le
     serveur le dira, et c'est lui qui a le dernier mot. */
  const dateLue = !type
    ? null
    : demandeLaDate(type)
      ? date
      : (proche?.birthDate ? prochaineEcheance(proche.birthDate, aujourdhui) : null);

  const pret = pretAEnregistrer({
    personId: proche?.id ?? null,
    kind: type,
    libelle,
    date: type && demandeLaDate(type) ? date : "",
  });

  const enregistre = async () => {
    if (!proche || !type) return;
    setErreur(null);
    setDeja(false);
    setEnvoi(true);
    try {
      await appel<unknown>("/me/events", {
        method: "POST",
        body: JSON.stringify(corpsDeCreation({
          personId: proche.id, kind: type, libelle, date, rangDuRappel,
        })),
      });
      /* §3.6 mène ensuite à la page de l'occasion créée (3.21). Elle n'existe
         pas encore : on revient d'où l'on vient plutôt que d'inventer une
         destination. */
      routeur.back();
    } catch (e) {
      const echec = e instanceof ErreurDApi ? e : null;
      switch (lireLeRefus(echec?.statut ?? 0, echec?.code ?? null)) {
        case "relire":
          /* LE FILET, ET IL NE SE MONTRE PAS. Nous avons proposé un type que
             la liste ne portait plus : c'est notre liste qui était périmée, pas
             le geste de quelqu'un. On relit, et on se tait. */
          try {
            const lu = metadataSchema.parse(await appel<unknown>("/me/metadata"));
            setRelus(lu.eventKinds);
          } catch {
            // Même la relecture peut échouer : on ne dit rien de plus pour
            // autant. Le formulaire garde ce qu'il sait, et rien n'est perdu.
          }
          break;
        case "deja":
          setDeja(true);
          break;
        case "dire":
          setErreur(messageDErreur(echec?.enveloppe ?? null, langue));
          break;
      }
    } finally {
      setEnvoi(false);
    }
  };

  const candidats = carnet.filter((p) => p.id !== proche?.id);
  const trouves = candidats.filter((p) =>
    p.displayName.toLocaleLowerCase(langue).includes(filtre.trim().toLocaleLowerCase(langue))
    || (p.callingName ?? "").toLocaleLowerCase(langue).includes(filtre.trim().toLocaleLowerCase(langue)));

  const mois12 = nomsDesMois(langue);
  const jours = Array.from({ length: joursDuMois(annee, mois) }, (_, i) => i + 1);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: couleurs.surfacePage }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + nativeSpace[12],
          paddingBottom: nativeSpace[20],
          paddingHorizontal: nativeSpace[16],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.retour}
          onPress={() => routeur.back()}
          style={styles.retour}
        >
          <Icon name="chevron-left" size={22} color={couleurs.textBody} />
        </Pressable>

        {/* Une seule nature ouverte : le titre porte ce que la rangée disait. */}
        {demandeLeChoixDuType(ouverts) ? null : (
          <Text style={[styles.titre, { color: couleurs.textBody }]}>{t.evtTitreAnniv}</Text>
        )}

        {deja ? (
          <View style={styles.bandeau}>
            <Banner intent="warning">
              {t.evtDejaAnniv(
                proche?.displayName ?? "",
                dateLue ? dateCourte(dateLue, langue) : "",
              )}
            </Banner>
          </View>
        ) : null}

        {demandeLeChoixDuType(ouverts) ? (
          <View style={styles.bloc}>
            <SectionLabel>{t.evtType}</SectionLabel>
            <View style={styles.pastilles}>
              <Pastille
                actif={type === "birthday"}
                icone="cake"
                libelle={t.typeAnniversaire}
                appuie={() => setChoisi("birthday")}
              />
              <Pastille
                actif={type === "other"}
                icone="calendar"
                libelle={t.typeAutre}
                appuie={() => setChoisi("other")}
              />
            </View>
          </View>
        ) : null}

        {/* Pour qui. UN SEUL PROCHE : le contrat porte un `personId`, pas une
            liste. Le kit dessine plusieurs puces — deux noms sur une même date
            demanderaient deux événements, et un anniversaire à deux n'existe
            pas. Désigner quelqu'un d'autre remplace. */}
        <View style={styles.bloc}>
          <SectionLabel>{t.evtPourQui}</SectionLabel>
          <View style={styles.puces}>
            {proche ? (
              <View style={[styles.puce, { backgroundColor: couleurs.actionQuietBg }]}>
                <Avatar name={proche.displayName} size={24} />
                <Text style={[styles.puceTexte, { color: couleurs.textAccent }]}>
                  {proche.displayName}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.effacer}
                  onPress={() => setProche(null)}
                  hitSlop={8}
                >
                  <Icon name="x" size={13} strokeWidth={2} color={couleurs.textAccent} />
                </Pressable>
              </View>
            ) : null}
            {ouvreLeChoix ? null : (
              <Pressable
                accessibilityRole="button"
                onPress={() => { setFiltre(""); setOuvreLeChoix(true); }}
                style={[
                  proche ? styles.ajout : styles.champVide,
                  { borderColor: couleurs.borderObject },
                  proche ? null : { backgroundColor: couleurs.surfaceCard },
                ]}
              >
                {proche ? (
                  <>
                    <Icon name="plus" size={14} strokeWidth={2} color={couleurs.textSecondary} />
                    <Text style={[styles.puceTexte, { color: couleurs.textSecondary }]}>
                      {t.noteAjouterProche}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.champVideTexte, { color: couleurs.textMention }]}>
                      {t.rechercher}
                    </Text>
                    <Icon name="chevron-down" size={15} color={couleurs.textMention} />
                  </>
                )}
              </Pressable>
            )}
          </View>

          {/* Un carnet se cherche : cinquante noms ne se parcourent pas à l'œil. */}
          {ouvreLeChoix ? (
            <View style={[styles.liste, {
              borderColor: couleurs.borderObject, backgroundColor: couleurs.surfaceCard,
            }]}>
              <View style={[styles.recherche, { borderBottomColor: couleurs.borderHairline }]}>
                <Icon name="search" size={15} color={couleurs.textMention} />
                <TextInput
                  value={filtre}
                  onChangeText={setFiltre}
                  placeholder={t.rechercher}
                  placeholderTextColor={couleurs.textMention}
                  accessibilityLabel={t.rechercher}
                  autoFocus
                  autoCorrect={false}
                  style={[styles.rechercheSaisie, { color: couleurs.textBody }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.retour}
                  onPress={() => setOuvreLeChoix(false)}
                  hitSlop={8}
                >
                  <Icon name="x" size={15} strokeWidth={2} color={couleurs.textMention} />
                </Pressable>
              </View>
              {trouves.length ? trouves.slice(0, 6).map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  onPress={() => { setProche(p); setOuvreLeChoix(false); }}
                  style={styles.ligne}
                >
                  <Avatar name={p.displayName} size={26} />
                  <Text style={[styles.ligneTexte, { color: couleurs.textBody }]}>
                    {p.displayName}
                  </Text>
                </Pressable>
              )) : (
                <Text style={[styles.vide, { color: couleurs.textMention }]}>
                  {t.videRechercheTitre}
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {type && demandeLeLibelle(type) ? (
          <View style={styles.bloc}>
            <TextField
              label={t.evtLabel}
              value={libelle}
              onChangeText={setLibelle}
              hint={t.evtLabelAide}
            />
          </View>
        ) : null}

        <View style={styles.bloc}>
          <SectionLabel>{t.evtDate}</SectionLabel>

          {type && demandeLaDate(type) ? (
            <>
              <Text style={[styles.sousTitre, { color: couleurs.textSecondary }]}>{t.evtJour}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.rangee}
              >
                {jours.map((j) => (
                  <Pastille
                    key={j}
                    actif={borneLeJour(jour, mois, annee) === j}
                    libelle={String(j)}
                    appuie={() => setJour(j)}
                  />
                ))}
              </ScrollView>

              <Text style={[styles.sousTitre, { color: couleurs.textSecondary }]}>{t.evtMois}</Text>
              <View style={styles.pastilles}>
                {mois12.map((nom, i) => (
                  <Pastille
                    key={nom}
                    actif={mois === i + 1}
                    libelle={nom}
                    appuie={() => setMois(i + 1)}
                  />
                ))}
              </View>

              {demandeLAnnee(type) ? (
                <>
                  <Text style={[styles.sousTitre, { color: couleurs.textSecondary }]}>
                    {t.evtAnnee}
                  </Text>
                  <View style={styles.pastilles}>
                    {annees.map((a, i) => (
                      <Pastille
                        key={a}
                        actif={annee === a}
                        libelle={String(a)}
                        appuie={() => setRangDAnnee(i)}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : null}

          {/* La date en toutes lettres, et dans combien de jours. Pour un
              anniversaire, c'est TOUT le bloc : elle se lit, elle ne se pose
              pas — le contrat la calcule depuis la naissance du proche. */}
          {dateLue ? (
            <View style={styles.enLettres}>
              <Text style={[styles.lettres, { color: couleurs.textBody }]}>
                {enToutesLettres(dateLue, langue)}
              </Text>
              <Text style={[styles.combien, { color: couleurs.textMention }]}>
                {t.evtDansJours(joursJusqua(dateLue, aujourdhui))}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Le rappel est le seul réglage de cet écran : la nature d'une date se
            reconnaît à son type et se corrige après coup — ce n'est pas une
            question à poser au moment de poser la date. */}
        <View style={styles.bloc}>
          <SectionLabel>{t.evtRappel}</SectionLabel>
          <View style={styles.pastilles}>
            {t.evtRappelChoix.map((choix, i) => (
              <Pastille
                key={choix}
                actif={rangDuRappel === i}
                libelle={choix}
                appuie={() => setRangDuRappel(i)}
              />
            ))}
          </View>
        </View>

        {erreur ? (
          <Text style={[styles.erreur, { color: couleurs.feedbackError }]}>{erreur}</Text>
        ) : null}
      </ScrollView>

      {/* Hors du défilement : le bouton se pose au-dessus du clavier plutôt que
          de disparaître dessous. Cet écran ne vit pas dans les onglets, il
          porte donc l'inset du bas. */}
      <View style={{
        paddingHorizontal: nativeSpace[16],
        paddingBottom: insets.bottom + nativeSpace[16],
      }}>
        <Button variant="primary" full disabled={envoi || !pret} onPress={() => void enregistre()}>
          {t.enregistrer}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

/* Une pastille de choix, comme sur l'identité : trois à douze valeurs se lisent
   d'un coup, et un sélecteur natif cacherait le choix derrière un geste de
   plus. La cible tactile ne descend pas sous le minimum du système. */
function Pastille({ actif, libelle, icone, appuie }: {
  actif: boolean;
  libelle: string;
  icone?: string | undefined;
  appuie: () => void;
}) {
  const couleurs = useCouleurs();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      onPress={appuie}
      style={[styles.pastille, {
        borderColor: actif ? "transparent" : couleurs.borderObject,
        backgroundColor: actif ? couleurs.action : "transparent",
      }]}
    >
      {icone ? (
        <Icon name={icone} size={16} color={actif ? couleurs.textOnAccent : couleurs.textSecondary} />
      ) : null}
      <Text style={[styles.pastilleTexte, {
        color: actif ? couleurs.textOnAccent : couleurs.textSecondary,
      }]}>{libelle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  titre: { fontFamily: nativeFont.displayRegular, fontSize: 22, marginBottom: nativeSpace[4] },
  bandeau: { marginTop: nativeSpace[12] },
  bloc: { marginTop: nativeSpace[20] },
  sousTitre: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[12] },
  pastilles: { flexDirection: "row", flexWrap: "wrap", gap: nativeSpace[6], marginTop: nativeSpace[8] },
  rangee: { flexDirection: "row", gap: nativeSpace[6], paddingTop: nativeSpace[8] },
  pastille: {
    minHeight: 38, minWidth: 38, paddingHorizontal: nativeSpace[14],
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: nativeSpace[6],
    borderRadius: nativeRadius.pill, borderWidth: nativeBorder.width,
  },
  pastilleTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 13 },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: nativeSpace[6], marginTop: nativeSpace[8] },
  puce: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[6],
    minHeight: nativeTouchMin, borderRadius: nativeRadius.pill,
    paddingLeft: nativeSpace[6], paddingRight: nativeSpace[12],
  },
  puceTexte: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5 },
  ajout: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[6],
    minHeight: nativeTouchMin, paddingHorizontal: nativeSpace[14],
    borderRadius: nativeRadius.pill, borderWidth: nativeBorder.width, borderStyle: "dashed",
  },
  champVide: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[8], flexGrow: 1,
    minHeight: nativeTouchMin, paddingHorizontal: nativeSpace[12],
    borderRadius: nativeRadius.lg, borderWidth: nativeBorder.width,
  },
  champVideTexte: { flex: 1, fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  liste: {
    marginTop: nativeSpace[8], borderRadius: nativeRadius.lg,
    borderWidth: nativeBorder.width, overflow: "hidden",
  },
  recherche: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[8],
    paddingHorizontal: nativeSpace[12], minHeight: nativeTouchMin,
    borderBottomWidth: nativeBorder.width,
  },
  rechercheSaisie: { flex: 1, minWidth: 0, fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[10],
    paddingHorizontal: nativeSpace[12], minHeight: nativeTouchMin,
  },
  ligneTexte: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  vide: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, padding: nativeSpace[14] },
  enLettres: {
    flexDirection: "row", alignItems: "baseline", flexWrap: "wrap",
    gap: nativeSpace[8], marginTop: nativeSpace[10],
  },
  lettres: { fontFamily: nativeFont.displayRegular, fontSize: 16.5 },
  combien: { fontFamily: nativeFont.bodyRegular, fontSize: 13 },
  erreur: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginTop: nativeSpace[12] },
});
