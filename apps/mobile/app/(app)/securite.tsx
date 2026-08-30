import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  identitiesListSchema, sessionsListSchema,
  type ExternalIdentity, type SessionSummary,
} from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, ConfirmSheet, Icon, LoadingState, SectionLabel, Toast,
  useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { dateCourte } from "../../lib/carnet.js";
import {
  appareils, autresAppareils, estCetAppareil, moyensDeConnexion,
  natureDeLAppareil, type NatureDAppareil,
} from "../../lib/securite.js";
import { litLaLignee } from "../../lib/jetons.js";

/* Sécurité et connexions — §3.24.
 *
 * DEUX LISTES : par quoi on entre, et depuis où l'on est entré. On ouvre cet
 * écran rarement, et souvent par inquiétude — il montre donc d'abord ce qui a
 * servi en dernier.
 *
 * DEUX MANQUES ONT ÉTÉ LEVÉS PAR LE SERVEUR. La connexion rend désormais
 * `sessionId` — la LIGNÉE, celle que `/me/sessions` porte comme `id` — donc
 * « cet appareil » se coche au lieu de se deviner. Et `DELETE /me/sessions`
 * épargne la lignée appelante, son paramètre s'appelle `sauf` : le libellé
 * « les AUTRES » dit enfin la vérité, là où le bouton aurait promis de rester
 * connecté ici et aurait déconnecté.
 *
 * CE QUE CET ÉCRAN NE FAIT PAS, et il faut le dire ici plutôt que le découvrir
 * plus tard.
 *
 * 1. Il ne porte pas encore la suppression du compte. `me/account` est servi
 *    depuis peu — trois temps : aperçu, code, effacement — et cela vaut son
 *    propre écran plutôt qu'un bouton en pied de liste.
 */
export default function Securite() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [lignee, setLignee] = useState<string | null>(null);
  const [ferme, setFerme] = useState(false);
  const [demande, setDemande] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [identites, setIdentites] = useState<ExternalIdentity[]>([]);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const [brutSessions, brutIdentites] = await Promise.all([
        appel<unknown>("/me/sessions"),
        appel<unknown>("/me/identities"),
      ]);
      setSessions(sessionsListSchema.parse(brutSessions).sessions);
      /* La lignée vient du TROUSSEAU, pas d'un appel : elle a été posée à la
         connexion. La redemander au serveur supposerait une route qui dit
         « qui suis-je » — il en existe une, mais elle ferait un aller-retour
         pour une chose qu'on a déjà sous la main. */
      setLignee(await litLaLignee());
      setIdentites(identitiesListSchema.parse(brutIdentites).identities);
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useEffect(() => { void charge(); }, [charge]);

  /* FERMER LES AUTRES.
   *
   * La route épargne désormais la lignée appelante — le service nomme son
   * paramètre `sauf` — donc le libellé « les AUTRES » dit enfin la vérité.
   *
   * ON RECHARGE PLUTÔT QUE DE FILTRER SUR PLACE : le serveur sait ce qu'il a
   * révoqué, et retirer les lignes à la main ferait diverger l'écran de ce qui
   * s'est réellement passé — une session ouverte entre-temps y échapperait, et
   * on la croirait fermée. */
  const fermeLesAutres = async (): Promise<void> => {
    setDemande(false);
    setFerme(true);
    try {
      await appel<unknown>("/me/sessions", { method: "DELETE" });
      await charge();
      setAccuse(t.securiteDeconnecteFait);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setFerme(false);
    }
  };

  if (echec && sessions === null) {
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

  if (sessions === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  const icone: Record<NatureDAppareil, string> = {
    mobile: "smartphone",
    ordinateur: "monitor",
    // Rien de reconnu : un point d'interrogation plutôt qu'un appareil inventé.
    inconnu: "circle-question-mark",
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

      {echec ? (
        <View style={{ marginBottom: nativeSpace[12] }}>
          <Banner intent="error">{echec}</Banner>
        </View>
      ) : null}

      <SectionLabel>{t.securiteMoyens}</SectionLabel>
      <View style={styles.liste}>
        {moyensDeConnexion(identites).map((moyen, i) => (
          <View
            key={moyen.sorte === "code" ? "code" : moyen.identite.provider}
            style={[styles.rang, i > 0 ? {
              borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
            } : null]}
          >
            <Icon name="key-round" size={16} color={couleurs.textMention} />
            <View style={styles.corps}>
              <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>
                {moyen.sorte === "code"
                  ? t.champEmail
                  : moyen.identite.provider === "google" ? "Google" : "Apple"}
              </Text>
              {/* Une date de rattachement pour les moyens externes ; rien pour
                  le code, qui n'a pas été « rattaché » — il a toujours été là. */}
              {moyen.sorte === "externe" ? (
                <Text style={[styles.detail, { color: couleurs.textMention }]} numberOfLines={1}>
                  {dateCourte(moyen.identite.linkedAt.slice(0, 10), langue)}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <View style={{ marginTop: nativeSpace[24] }}>
        <SectionLabel>{t.securiteAppareils}</SectionLabel>
        <View style={styles.liste}>
          {appareils(sessions).map((s, i) => (
            <View
              key={s.id}
              style={[styles.rang, i > 0 ? {
                borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
              } : null]}
            >
              <Icon name={icone[natureDeLAppareil(s.userAgent)]} size={16} color={couleurs.textMention} />
              <View style={styles.corps}>
                {/* L'en-tête TEL QUEL, sans en tirer un nom d'appareil : il est
                    déclaré et jamais vérifié — « un indice de reconnaissance
                    pour la personne qui lit l'écran, pas une preuve ». En faire
                    « iPhone de Valentine » serait une affirmation. */}
                <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>
                  {s.userAgent ?? "—"}
                </Text>
                <Text style={[styles.detail, { color: couleurs.textMention }]} numberOfLines={1}>
                  {dateCourte(s.lastActiveAt.slice(0, 10), langue)}
                  {/* « Cet appareil » se dit DANS la ligne, pas à côté : c'est
                      la même information que la date — de quoi reconnaître
                      laquelle est la sienne avant d'en fermer d'autres. */}
                  {estCetAppareil(s, lignee) ? " · " + t.securiteCetAppareil : ""}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ON NE L'OFFRE QUE S'IL Y A DES AUTRES. Un bouton qui ne ferait rien,
            sur un écran qu'on ouvre par inquiétude, se presse quand même — et
            son silence se lirait comme une panne plutôt que comme « il n'y
            avait rien à fermer ». */}
        {autresAppareils(sessions, lignee) > 0 ? (
          <View style={{ marginTop: nativeSpace[16] }}>
            <Button
              variant="destructiveOutline"
              full
              disabled={ferme}
              onPress={() => setDemande(true)}
            >
              {t.securiteDeconnecterTout}
            </Button>
          </View>
        ) : null}
      </View>

      {demande ? (
        <ConfirmSheet
          titre={t.securiteDeconnecterTout}
          texte={t.securiteDeconnecterTousTexte}
          confirmer={t.securiteDeconnecterTout}
          annuler={t.annuler}
          destructif
          insetBas={insets.bottom}
          onConfirmer={() => { void fermeLesAutres(); }}
          onAnnuler={() => setDemande(false)}
        />
      ) : null}

      {accuse ? (
        <Toast intent="success" insetBas={insets.bottom} onDismiss={() => setAccuse(null)}>
          {accuse}
        </Toast>
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
  liste: { marginTop: nativeSpace[4] },
  rang: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[10],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
  },
  corps: { flex: 1, minWidth: 0 },
  nom: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  detail: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[2] },
});
