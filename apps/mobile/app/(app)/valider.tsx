import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { submissionSchema, type Submission } from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, Card, EmptyState, Icon, LoadingState, SectionLabel, Toast,
  useCouleurs,
} from "@lehno/ui-native";
import { Bascule } from "../../composants/Bascule.js";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { dateCourte } from "../../lib/carnet.js";
import {
  aTrancher, corpsDeDecision, corpsDeRejet, pretAEnvoyer,
  type SaisieDuSas, type Sort,
} from "../../lib/sas.js";

/* À valider — §3.8, le sas.
 *
 * « Rien de ce qui vient de l'extérieur n'entre dans vos fiches sans votre
 * accord. »
 *
 * RETENIR N'EST PAS AFFICHER. Retenir veut dire qu'on CONSIDÈRE ce qui est
 * arrivé — un souhait qu'on gardera en vue pour l'achat, une date qui entrera
 * dans la fiche. Écarter, c'est ne pas le considérer, pas le cacher. Rien ici
 * ne règle une visibilité, et c'est ce qui distingue ce sas du Mur — qui,
 * lui, n'a pas de livre d'or.
 *
 * TOUT SOUHAIT SE TRANCHE. « `pending` est l'état d'arrivée, pas une
 * décision » : laisser passer un souhait non tranché le laisserait en suspens
 * sans que rien ne le rappelle.
 */
const listeDeContributions = submissionSchema.array();

export default function Valider() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [contributions, setContributions] = useState<Submission[] | null>(null);
  const [saisies, setSaisies] = useState<Record<string, SaisieDuSas>>({});
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const lues = listeDeContributions.parse(await appel<unknown>("/me/submissions"));
      setContributions(lues);
      /* Chaque contribution part avec ses souhaits NON TRANCHÉS : rien n'est
         pré-coché. Proposer « tout retenir » par défaut ferait valider d'un
         geste ce que le sas existe précisément pour faire lire. */
      setSaisies(Object.fromEntries(aTrancher(lues).map((c) => [
        c.id, { garderLaDate: true, garderLeMot: true, sorts: {}, fiche: null },
      ])));
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useFocusEffect(useCallback(() => { void charge(); }, [charge]));

  const pose = (id: string, quoi: Partial<SaisieDuSas>): void => {
    setSaisies((v) => ({ ...v, [id]: { ...v[id]!, ...quoi } }));
  };

  const tranche = (id: string, souhait: string, sort: Sort): void => {
    setSaisies((v) => ({
      ...v,
      [id]: { ...v[id]!, sorts: { ...v[id]!.sorts, [souhait]: sort } },
    }));
  };

  const envoie = async (c: Submission, corps: unknown, message: string): Promise<void> => {
    setEnvoi(c.id);
    setEchec(null);
    try {
      await appel<unknown>(`/me/submissions/${c.id}/decision`, {
        method: "POST",
        body: JSON.stringify(corps),
      });
      setAccuse(message);
      await charge();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(null);
    }
  };

  if (echec && contributions === null) {
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

  if (contributions === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  const attente = aTrancher(contributions);

  const retour = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.retour}
      onPress={() => routeur.back()}
      style={styles.retour}
    >
      <Icon name="chevron-left" size={20} color={couleurs.textBody} />
    </Pressable>
  );

  if (!attente.length) {
    return (
      <View style={[styles.page, styles.aumilieu, { paddingTop: insets.top + nativeSpace[8] }]}>
        {retour}
        <EmptyState
          illustration="contributions-aucune"
          title={t.validerVideTitre}
          text={t.validerVideTexte}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }}>
      <ScrollView
        contentContainerStyle={[styles.page, {
          paddingTop: insets.top + nativeSpace[8],
          paddingBottom: insets.bottom + nativeSpace[24],
        }]}
      >
        {retour}
        <Text style={[styles.intro, { color: couleurs.textSecondary }]}>{t.validerIntro}</Text>

        {echec ? (
          <View style={{ marginBottom: nativeSpace[12] }}>
            <Banner intent="error">{echec}</Banner>
          </View>
        ) : null}

        {attente.map((c) => {
          const saisie = saisies[c.id];
          if (!saisie) return null;
          return (
            <Card key={c.id} surface="panel" padding={15} radius="lg" style={styles.carte}>
              <Text style={[styles.qui, { color: couleurs.textBody }]} numberOfLines={1}>
                {t.validerPour(c.submitterName ?? t.murPrivSansNom)}
              </Text>
              {/* « On se connaît d'où » — une aide au rangement, pas une
                  taxonomie : on la montre telle quelle. */}
              {c.relationHint ? (
                <Text style={[styles.mention, { color: couleurs.textMention }]} numberOfLines={1}>
                  {c.relationHint}
                </Text>
              ) : null}

              {c.birthDate ? (
                <Bascule
                  premier
                  /* La date seule : aucun libellé générique n'existe pour
                     elle, et en écrire un serait rédiger à la place de qui
                     rédige. Dans ce contexte — sous le nom du répondant — elle
                     se lit sans qu'on la nomme. */
                  libelle={dateCourte(c.birthDate, langue)}
                  actif={saisie.garderLaDate}
                  onBascule={(v) => pose(c.id, { garderLaDate: v })}
                />
              ) : null}
              {c.personalNote ? (
                <Bascule
                  libelle={c.personalNote}
                  actif={saisie.garderLeMot}
                  onBascule={(v) => pose(c.id, { garderLeMot: v })}
                />
              ) : null}

              {/* CHAQUE SOUHAIT SÉPARÉMENT, et aucun n'est pré-tranché : le sas
                  existe pour qu'on lise, pas pour qu'on valide d'un geste. */}
              {c.wishes.length ? (
                <View style={styles.bloc}>
                  <SectionLabel>{t.validerSouhait}</SectionLabel>
                  {c.wishes.map((s) => (
                    <View
                      key={s.id}
                      style={[styles.souhait, {
                        borderTopWidth: nativeBorder.width,
                        borderTopColor: couleurs.borderHairline,
                      }]}
                    >
                      <Text style={[styles.libelle, { color: couleurs.textBody }]} numberOfLines={2}>
                        {s.label}
                      </Text>
                      <Button
                        variant={saisie.sorts[s.id] === "retained" ? "primary" : "text"}
                        onPress={() => tranche(c.id, s.id, "retained")}
                      >
                        {t.validerRetenir}
                      </Button>
                      <Button
                        variant={saisie.sorts[s.id] === "discarded" ? "primary" : "text"}
                        onPress={() => tranche(c.id, s.id, "discarded")}
                      >
                        {t.validerEcarter}
                      </Button>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* UN LIEN PUBLIC NE VISE PERSONNE : sans fiche choisie, le
                  serveur en compose une neuve depuis le nom du répondant — « le
                  cas courant, quelqu'un qu'on ne connaissait pas encore ».
                  L'écran de choix d'une fiche existante attend son lot ; la
                  fiche neuve est le défaut, et c'est un choix, pas un manque. */}

              <View style={styles.actions}>
                <Button
                  full
                  disabled={envoi === c.id || !pretAEnvoyer(c, saisie)}
                  onPress={() => void envoie(c, corpsDeDecision(c, saisie), t.validerRetenu(1))}
                >
                  {t.valider}
                </Button>
                {/* LE REJET GLOBAL NE RÉPARTIT RIEN — « demander le sort de
                    chaque souhait reviendrait à faire trancher ce qu'on vient
                    d'écarter ». Il ne demande donc rien d'autre. */}
                <Button
                  full
                  variant="text"
                  disabled={envoi === c.id}
                  onPress={() => void envoie(c, corpsDeRejet(), t.validerEcarte)}
                >
                  {t.validerEcarter}
                </Button>
              </View>
            </Card>
          );
        })}
      </ScrollView>

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
  aumilieu: { justifyContent: "center" },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  intro: { fontFamily: nativeFont.bodyRegular, fontSize: 14, marginBottom: nativeSpace[8] },
  carte: { marginTop: nativeSpace[12] },
  qui: { fontFamily: nativeFont.displayMedium, fontSize: 17 },
  mention: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[2] },
  bloc: { marginTop: nativeSpace[12] },
  souhait: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[8],
    paddingVertical: nativeSpace[10], minHeight: nativeTouchMin,
  },
  libelle: { flex: 1, fontFamily: nativeFont.bodyRegular, fontSize: 14 },
  actions: { marginTop: nativeSpace[12] },
});
