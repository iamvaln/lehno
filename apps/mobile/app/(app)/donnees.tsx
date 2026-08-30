import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  dataExportRequestSchema, lastDataExportSchema, type DataExportRequest,
} from "@lehno/contracts";
import { nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, Icon, SectionLabel, Toast, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { etatDeLExport, peutDemander } from "../../lib/donnees.js";

/* Mes données — §3.30.
 *
 * Deux choses qui ne se ressemblent pas : demander une copie de ce qu'on a
 * écrit, et lire ce que le service garde. La première est un geste, la seconde
 * une phrase — et la phrase compte autant, parce qu'on vient ici pour être
 * rassuré autant que pour agir.
 *
 * AUCUN TÉLÉCHARGEMENT ICI, et c'est délibéré au contrat : le fichier n'est pas
 * rendu sur ce chemin. « Rendre l'URL en ferait une adresse qu'on peut
 * redemander indéfiniment depuis n'importe quelle session encore ouverte. » Il
 * part par courriel, avec un lien signé qui expire.
 */
export default function Donnees() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [derniere, setDerniere] = useState<DataExportRequest | null>(null);
  const [lu, setLu] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const brut = await appel<unknown>("/me/data-export");
      setDerniere(lastDataExportSchema.parse(brut).request);
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setLu(true);
    }
  }, [langue]);

  useEffect(() => { void charge(); }, [charge]);

  const demande = async (): Promise<void> => {
    setEnvoi(true);
    setEchec(null);
    try {
      const brut = await appel<unknown>("/me/data-export", { method: "POST" });
      setDerniere(dataExportRequestSchema.parse(brut));
      setAccuse(t.donneesExportFait);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  const etat = etatDeLExport(derniere);

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
          <SectionLabel>{t.moiDonnees}</SectionLabel>
          <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
            {t.donneesExportAide}
          </Text>

          {/* LE BOUTON S'ÉTEINT PENDANT LA PRÉPARATION. Le serveur refuse la
              seconde demande par un `conflict` ; un bouton qui part pour
              revenir en erreur dirait le contraire du refus qu'il reçoit.
              On attend d'avoir lu l'état avant de proposer quoi que ce soit —
              sinon le premier appui tomberait sur une préparation en cours. */}
          <View style={{ marginTop: nativeSpace[12] }}>
            <Button
              full
              icon="download"
              disabled={!lu || envoi || !peutDemander(derniere)}
              onPress={() => void demande()}
            >
              {t.donneesExport}
            </Button>
          </View>

          {/* Ce qu'on attend, dit une seule fois. « Le fichier vous parvient par
              e-mail dans les 24 heures » vaut pour la demande en cours comme
              pour celle qu'on vient de faire — c'est la même attente. */}
          {etat === "en_cours" ? (
            <Text style={[styles.mention, { color: couleurs.textMention }]}>
              {t.donneesExportDemande}
            </Text>
          ) : null}
        </View>

        <View style={styles.bloc}>
          <SectionLabel>{t.donneesCollecte}</SectionLabel>
          <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
            {t.donneesCollecteTexte}
          </Text>
        </View>

        {/* FERMER SON COMPTE VIT ICI, pas en pied de l'écran de sécurité : c'est
            une affaire de données, et on la cherche là où l'on cherche ce que le
            service garde. Le geste lui-même prend trois temps et son propre
            écran — il n'a pas sa place au bout d'une liste. */}
        <View style={styles.danger}>
          <Button
            full
            variant="outline"
            icon="trash-2"
            onPress={() => routeur.push("/(app)/fermeture")}
          >
            {t.supprTitre}
          </Button>
          <Text style={[styles.mention, { color: couleurs.textMention }]}>
            {t.securiteSupprimerAide}
          </Text>
        </View>
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
  texte: { fontFamily: nativeFont.bodyRegular, fontSize: 14, marginTop: nativeSpace[8] },
  mention: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[8] },
  danger: { marginTop: nativeSpace[40] },
});
