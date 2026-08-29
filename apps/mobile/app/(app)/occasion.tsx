import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  creditBalanceSchema, generationsSchema, noteListSchema, occurrenceSchema,
  type GeneratedMessage, type GenerationKind, type Note, type Occurrence,
} from "@lehno/contracts";
import {
  nativeFont, nativeLetterSpacing, nativeRadius, nativeSpace, nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Avatar, Banner, Button, Card, Countdown, CreditIndicator, Icon, LoadingState,
  Provenance, Quote, SectionLabel, SensitiveBanner, Tag, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { useActionsPayantes } from "../../lib/MetadonneesProvider.js";
import { dateCourte } from "../../lib/carnet.js";
import { libelleDeLEcheance } from "../../lib/libelles.js";
import { coutDe, pistesOffertes } from "../../lib/preparation.js";
import {
  estPassee, messageDeLOccasion, montreLesSouhaits, montreLesVoeux, notesDeLOccasion,
} from "../../lib/occasion.js";

/* Une occasion — §3.21.
 *
 * LA PORTE QUI MANQUAIT. Préparer vise une occasion, jamais une personne : le
 * contrat refuse un lancement qui ne cite pas d'occurrence. Tant que cet écran
 * n'existait pas, §3.7 et tout ce qui en découle étaient bâtis sans que rien
 * n'y mène.
 *
 * DEUX MOMENTS. Avant, on prépare. Après, il n'y a plus rien à préparer — on
 * relit ce qui a été envoyé. Ce n'est pas un état dégradé : c'est l'autre
 * moitié de la vie d'une date.
 */
export default function Occasion() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { occurrenceId } = useLocalSearchParams<{ occurrenceId: string }>();
  const { actives } = useDrapeaux();
  const prix = useActionsPayantes();

  const [occasion, setOccasion] = useState<Occurrence | null>(null);
  const [notes, setNotes] = useState<readonly Note[]>([]);
  const [messages, setMessages] = useState<readonly (GeneratedMessage | null)[]>([]);
  const [solde, setSolde] = useState<number | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    if (!occurrenceId) return;
    try {
      /* L'occasion D'ABORD, seule : les notes se demandent par PROCHE, et on
         ne connaît le proche qu'une fois l'occasion lue. Les enchaîner est ici
         une dépendance réelle, pas une maladresse. */
      const occ = occurrenceSchema.parse(await appel<unknown>(`/me/occurrences/${occurrenceId}`));

      const [brutNotes, brutGenerations, brutCredits] = await Promise.all([
        appel<unknown>(`/me/persons/${occ.personId}/notes`),
        appel<unknown>("/me/generations"),
        appel<unknown>("/me/credits"),
      ]);

      setOccasion(occ);
      setNotes(noteListSchema.parse(brutNotes));
      setMessages(generationsSchema.parse(brutGenerations).generations.map((g) => g.message));
      setSolde(creditBalanceSchema.parse(brutCredits).balance);
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [occurrenceId, langue]);

  /* AU RETOUR, PAS SEULEMENT À L'ARRIVÉE. On quitte cet écran pour écrire une
     note ou lancer un message, et on y revient : lire une seule fois au
     montage montrerait l'état d'avant le geste qu'on vient de faire. */
  useFocusEffect(useCallback(() => { void charge(); }, [charge]));

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
  const ecrit = messageDeLOccasion(messages, occasion.id);
  const pistes = passee ? [] : pistesOffertes(occasion, actives);

  if (montreLesSouhaits(actives, occasion)) {
    /* Réservé : la wishlist de l'occasion (3.19) arrivera avec son lot. La
       règle est calculée ici pour qu'elle ne s'invente pas ailleurs — le
       drapeau ET la nature, car une occasion sensible se prépare sans cadeau
       quel que soit le drapeau. */
  }
  if (passee && montreLesVoeux(actives)) {
    /* Réservé de même : les vœux reçus (3.12) suivent `wishes`, éteint au
       lancement. Un « aucun mot » sur une capacité fermée annoncerait un
       silence qui n'en est pas un. */
  }

  const sousTitre = [
    libelleDeLEcheance(occasion.kind, occasion.label, t),
    dateCourte(occasion.occurrenceDate, langue),
  ].join(" · ");

  const titreDeLaPiste: Record<GenerationKind, string> = {
    wish_message: t.occMessage,
    gift_ideas: t.occIdees,
    portrait: t.fichePortraits,
  };

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={[styles.page, {
        paddingTop: insets.top + nativeSpace[8],
        paddingBottom: insets.bottom + nativeSpace[24],
      }]}
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
        <SensitiveBanner>
          {t.sensibleApproche(dateCourte(occasion.occurrenceDate, langue))}
        </SensitiveBanner>
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
            size="m"
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
          </Card>
        </View>
      ) : null}

      {/* LES NOTES DE CETTE CÉLÉBRATION — celles qui portent son identifiant,
          jamais les durables : une note qui décrit le proche reviendrait chaque
          année sous un titre qui la dément. */}
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
              <Provenance origin={null} date={dateCourte(n.createdAt.slice(0, 10), langue)} />
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
      {pistes.length ? (
        <View style={styles.bloc}>
          <SectionLabel>{t.occPreparer}</SectionLabel>
          {pistes.map(({ kind }) => {
            const cout = coutDe(prix, kind);
            return (
              <View key={kind} style={{ marginTop: nativeSpace[10] }}>
                {/* Une piste dont le prix n'est pas servi ne se lance pas : son
                    bouton reste éteint plutôt que d'ouvrir une confirmation qui
                    ne saurait quoi annoncer. */}
                <Button
                  full
                  variant={kind === "wish_message" ? "primary" : "outline"}
                  icon="sparkles"
                  disabled={cout === null}
                  onPress={() => routeur.push({
                    pathname: "/(app)/preparation", params: { occurrenceId: occasion.id },
                  })}
                >
                  {titreDeLaPiste[kind]}
                </Button>
                {cout !== null ? (
                  <View style={{ marginTop: nativeSpace[6] }}>
                    <CreditIndicator label={t.creditUnite(cout)} cost={cout} />
                  </View>
                ) : null}
              </View>
            );
          })}
          {/* LE SOLDE UNE SEULE FOIS, en pied de bloc : le répéter sous chaque
              action le transforme en bruit. Sans lien de recharge — §3.9 n'est
              pas portée, et un geste qui n'ouvre rien ment davantage qu'un
              geste absent. */}
          {solde !== null ? (
            <View style={{ marginTop: nativeSpace[10] }}>
              <CreditIndicator label={t.creditReste(solde)} balance={solde} variant="solde" />
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
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
  rien: {
    fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginTop: nativeSpace[8],
    borderRadius: nativeRadius.sm,
  },
});
