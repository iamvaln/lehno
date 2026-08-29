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
  Banner, Button, Icon, LoadingState, SectionLabel, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { dateCourte } from "../../lib/carnet.js";
import {
  appareils, moyensDeConnexion, natureDeLAppareil, type NatureDAppareil,
} from "../../lib/securite.js";

/* Sécurité et connexions — §3.24.
 *
 * DEUX LISTES : par quoi on entre, et depuis où l'on est entré. On ouvre cet
 * écran rarement, et souvent par inquiétude — il montre donc d'abord ce qui a
 * servi en dernier.
 *
 * CE QUE CET ÉCRAN NE FAIT PAS, et il faut le dire ici plutôt que le découvrir
 * plus tard.
 *
 * 1. Il ne coche pas « Cet appareil ». Ni le contrat ni le client ne savent
 *    quelle lignée est la nôtre — la réponse de connexion ne rend aucun
 *    identifiant de session. Deviner par le `User-Agent` tomberait sur la
 *    mauvaise dès qu'un téléphone a deux sessions ouvertes.
 *
 * 2. Il n'offre pas « Déconnecter les autres appareils ». Le libellé du kit dit
 *    « les autres » dans les deux langues ; `DELETE /me/sessions` révoque
 *    TOUTES les lignées, celle qui appelle comprise — le contrôleur le dit
 *    nommément. Le bouton promettrait donc de rester connecté ici, et
 *    déconnecterait. Il revient dès que le libellé ou la route s'accordent :
 *    c'est une ligne à ajouter, pas un écran à refaire.
 *
 * 3. Il ne porte pas encore la suppression du compte. `me/account` est servi
 *    depuis peu — trois temps : aperçu, code, effacement — et cela vaut son
 *    propre écran plutôt qu'un bouton en pied de liste.
 */
export default function Securite() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [identites, setIdentites] = useState<ExternalIdentity[]>([]);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const [brutSessions, brutIdentites] = await Promise.all([
        appel<unknown>("/me/sessions"),
        appel<unknown>("/me/identities"),
      ]);
      setSessions(sessionsListSchema.parse(brutSessions).sessions);
      setIdentites(identitiesListSchema.parse(brutIdentites).identities);
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useEffect(() => { void charge(); }, [charge]);

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
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
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
