import { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { createSupportRequestSchema, type LegalDocument } from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, Icon, SectionLabel, TextField, Toast, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { DOCUMENTS_ETIQUETES, lienDuMagasin } from "../../lib/aide.js";

/* Aide — §3.26.
 *
 * TROIS RANGS À LA MAQUETTE, et ils n'ont pas tous une destination.
 *
 * « Nous écrire » en a une : `POST /me/support-requests`, avec la version et la
 * plateforme jointes AUTOMATIQUEMENT — « pour ne pas les demander ». Ce sont
 * des indices de diagnostic déclarés par le client, pas des faits vérifiés.
 *
 * « Noter l'application » mène au MAGASIN — décision du 29/08 : une note
 * publique pèse sur le classement et la découverte, ce qu'un avis interne ne
 * fait pas. L'URL se déclare dans la configuration ; tant qu'elle manque, le
 * rang ne paraît pas. `POST /me/feedback` existe au contrat et reste inemployé
 * par cet écran — c'est un choix, pas un oubli.
 *
 * « Questions fréquentes » n'en a AUCUNE : les seuls documents servis sont les
 * trois légaux, et aucun n'est une FAQ. Le rang est absent plutôt que muet.
 */
export default function Aide() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const version = Constants.expoConfig?.version ?? null;
  const magasin = lienDuMagasin(
    Constants.expoConfig?.extra as { appStoreUrl?: unknown; playStoreUrl?: unknown } | undefined,
    Platform.OS,
  );

  const ecris = async (): Promise<void> => {
    setEnvoi(true);
    setEchec(null);
    try {
      /* Le corps repasse par le schéma : la version et la plateforme sont
         facultatives et ne partent que si on les connaît — `undefined` sur un
         champ `.optional()` d'un objet `strict()` passe, une chaîne vide non. */
      const corps = createSupportRequestSchema.parse({
        body: texte.trim(),
        ...(version ? { appVersion: version } : {}),
        ...(Platform.OS === "ios" || Platform.OS === "android" ? { platform: Platform.OS } : {}),
      });
      await appel<unknown>("/me/support-requests", {
        method: "POST",
        body: JSON.stringify(corps),
      });
      setTexte("");
      setAccuse(t.donneesExportFait);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  const libelleDuDocument: Record<LegalDocument, string> = {
    cgu: t.connexionPiedCgu,
    confidentialite: t.connexionPiedConf,
    // Sans libellé : il n'est pas dans la liste proposée. Voir `lib/aide.ts`.
    mentions: "",
  };

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }}>
      <ScrollView
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

        <View style={styles.bloc}>
          <SectionLabel>{t.aideContact}</SectionLabel>
          <TextField
            multiline
            label={t.aideContact}
            value={texte}
            onChangeText={setTexte}
          />
          <View style={{ marginTop: nativeSpace[12] }}>
            {/* Un envoi vide n'est pas une demande : le schéma exige au moins un
                caractère, et le bouton le dit avant l'aller-retour. */}
            <Button
              full
              icon="mail"
              disabled={envoi || texte.trim().length === 0}
              onPress={() => void ecris()}
            >
              {t.aideContact}
            </Button>
          </View>
        </View>

        {/* LES DOCUMENTS QU'ON A ACCEPTÉS, lisibles autrement qu'au moment de la
            connexion : on les cherche justement APRÈS, quand une question se
            pose. */}
        <View style={styles.bloc}>
          <SectionLabel>{t.aideQuestions}</SectionLabel>
          {DOCUMENTS_ETIQUETES.map((document, i) => (
            <Pressable
              key={document}
              accessibilityRole="button"
              onPress={() => routeur.push({ pathname: "/legal", params: { document } })}
              style={[styles.rang, i > 0 ? {
                borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
              } : null]}
            >
              <Icon name="file-text" size={17} color={couleurs.textMention} />
              <Text style={[styles.libelle, { color: couleurs.textBody }]}>
                {libelleDuDocument[document]}
              </Text>
              <Icon name="chevron-right" size={15} color={couleurs.textMention} />
            </Pressable>
          ))}
        </View>

        {/* LE RANG DU MAGASIN NE PARAÎT QUE SI L'URL EST DÉCLARÉE. Un paquet
            déclaré n'est pas une fiche publiée : composer l'adresse depuis
            `com.lehno.app` mènerait à une page absente jusqu'à la mise en
            ligne. Le jour où la valeur est renseignée, ce rang paraît seul. */}
        {magasin ? (
          <View style={styles.bloc}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openURL(magasin)}
              style={styles.rang}
            >
              <Icon name="star" size={17} color={couleurs.textMention} />
              <Text style={[styles.libelle, { color: couleurs.textBody }]}>{t.aideNoter}</Text>
              <Icon name="chevron-right" size={15} color={couleurs.textMention} />
            </Pressable>
          </View>
        ) : null}

        {version ? (
          <Text style={[styles.version, { color: couleurs.textMention }]}>
            {t.aideVersion} {version}
          </Text>
        ) : null}
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
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  bloc: { marginTop: nativeSpace[24] },
  rang: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[10],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
  },
  libelle: { flex: 1, fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  version: {
    fontFamily: nativeFont.bodyRegular, fontSize: 12, textAlign: "center",
    marginTop: nativeSpace[40],
  },
});
