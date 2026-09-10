import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { creditBalanceSchema } from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeLetterSpacing, nativeRadius, nativeSpace,
  nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Banner, Card, CreditIndicator, Icon, SectionLabel, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import type { Langue } from "../../messages/index.js";

/* Les deux langues, déclarées UNE fois. Les écrire à l'appel du `map` en
   ferait une seconde liste à tenir à jour à côté du dictionnaire. */
const LANGUES: readonly Langue[] = ["fr", "en"];
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { effaceLesJetons, litLesJetons } from "../../lib/jetons.js";
import { corpsDeDeconnexion, sectionsDeReglages, type Rang, type Section } from "../../lib/reglages.js";

/* Réglages — §3.28, le quatrième onglet du lancement.
 *
 * ON Y VIENT RAREMENT : l'écran ne cherche pas à être élégant, il cherche à
 * être trouvable. Des sections nommées, des rangs qui se ressemblent, aucun
 * raccourci décoratif.
 *
 * IL EXISTE PARCE QUE « MOI » N'EXISTE PAS AU LANCEMENT. Les quatre sections de
 * 3.17 sont éteintes, l'onglet part — et emportait le solde, le profil, la
 * sécurité, l'aide et la déconnexion, dont aucun ne suit de drapeau. Tant que
 * cet écran manquait, on ne pouvait pas se déconnecter du tout.
 *
 * Les gestes de création vivent ailleurs — sur l'accueil, dans Dates, sur une
 * fiche. Ce hub ne réunit que ce qui relève de « mon compte » : c'est ce qui
 * l'empêche de devenir un second menu.
 */
export default function Reglages() {
  const { t, langue, choisis } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();

  const [solde, setSolde] = useState<number | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      setSolde(creditBalanceSchema.parse(await appel<unknown>("/me/credits")).balance);
    } catch {
      /* Sans solde, la carte se tait — elle ne montre pas zéro. Un zéro
         inventé ferait croire un compte vide à quelqu'un qui a des crédits,
         et l'enverrait recharger pour rien. */
    }
  }, []);

  // Au retour aussi : on revient ici après avoir dépensé ou reçu des crédits.
  useFocusEffect(useCallback(() => { void charge(); }, [charge]));

  /* SORTIR NE DOIT JAMAIS ÉCHOUER. On révoque la lignée au serveur d'abord —
     dans l'autre ordre, un échec réseau laisserait un jeton de rafraîchissement
     valide dans la nature sans qu'on puisse encore le nommer. Mais si cette
     révocation échoue, on efface quand même : retenir quelqu'un sur un compte
     qu'il veut quitter est pire qu'une lignée qui expirera d'elle-même. */
  const sors = async (): Promise<void> => {
    try {
      const jetons = await litLesJetons();
      const envoi = corpsDeDeconnexion(jetons?.rafraichissement ?? null);
      if (envoi) {
        await appel<unknown>(envoi.chemin, {
          method: "DELETE",
          body: JSON.stringify(envoi.corps),
        });
      }
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      await effaceLesJetons();
      routeur.replace("/(connexion)/ouverture");
    }
  };

  const titreDeSection: Record<Section["cle"], string> = {
    argent: t.reglagesArgent,
    compte: t.reglagesCompte,
    alertes: t.reglagesAlertes,
    aide: t.reglagesAide,
  };

  const libelleDuRang: Record<string, string> = {
    recharge: t.moiRecharger,
    parrainage: t.parrainageTitre,
    paiement: t.moiPaiement,
    profil: t.moiProfil,
    securite: t.moiSecurite,
    rappels: t.moiRappels,
    donnees: t.moiDonnees,
    aide: t.moiAideCentre,
    deconnexion: t.moiDeconnexion,
  };

  /* Tous les rangs n'ont pas de valeur — la table est donc PARTIELLE, et c'est
     voulu : forcer une valeur sur chacun obligerait à en inventer là où le
     libellé se suffit. */
  const valeurDuRang: Partial<Record<Rang["cle"], string>> = {
    donnees: t.moiDonneesValeur,
  };

  /* LA LANGUE S'APPLIQUE AU PREMIER APPUI, sans enregistrement à part.
     C'est la planche qui la pose ici plutôt que dans le profil, et elle a
     raison : quelqu'un dont l'interface est dans la mauvaise langue doit
     pouvoir la corriger SANS traverser un formulaire écrit dans cette
     langue-là. Un réglage de secours ne se met pas au fond d'un tiroir.

     L'interface change d'abord, l'enregistrement suit. `uiLanguage` décide
     aussi de la langue des COURRIELS : la garder au serveur n'est donc pas un
     détail de confort. Son échec est silencieux — interrompre quelqu'un pour
     une préférence d'affichage qu'il vient de voir s'appliquer ferait payer
     cher une chose qui se refait en un appui. */
  const changeLaLangue = (vers: Langue): void => {
    if (vers === langue) return;
    choisis(vers);
    void appel<unknown>("/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ uiLanguage: vers }),
    }).catch(() => { /* silencieux à dessein */ });
  };

  const ouvre = (rang: Rang): void => {
    /* PAS DE CONFIRMATION. La maquette n'en pose pas, et elle a raison : le
       geste se défait en redemandant un code, et une question posée à chaque
       sortie finirait par se cliquer sans être lue. */
    if (rang.geste === "deconnexion") { void sors(); return; }
    if (rang.route) routeur.push(rang.route);
  };

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={[styles.page, {
        paddingTop: insets.top + nativeSpace[20],
        paddingBottom: insets.bottom + nativeSpace[24],
      }]}
    >
      <Text style={[styles.titre, { color: couleurs.textBody }]} accessibilityRole="header">
        {t.reglagesTitre}
      </Text>

      {echec ? (
        <View style={{ marginBottom: nativeSpace[12] }}>
          <Banner intent="error">{echec}</Banner>
        </View>
      ) : null}

      {/* LE SOLDE D'ABORD : c'est ce qu'on vient vérifier le plus souvent, et
          c'est ce que la disparition de « Moi » avait rendu invisible.
          Sans lien de recharge — §3.9 n'est pas portée, et un geste qui
          n'ouvre rien ment davantage qu'un geste absent. */}
      {solde !== null ? (
        <Card surface="panel" padding={15} radius="lg" style={{ marginBottom: nativeSpace[8] }}>
          <CreditIndicator label={t.moiSolde} balance={solde} variant="solde" />
        </Card>
      ) : null}

      {sectionsDeReglages(actives).map((section) => (
        <View key={section.cle} style={styles.bloc}>
          <SectionLabel>{titreDeSection[section.cle]}</SectionLabel>
          {section.rangs.map((rang, i) => (
            <Pressable
              key={rang.cle}
              accessibilityRole="button"
              onPress={() => ouvre(rang)}
              style={[styles.rang, i > 0 ? {
                borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
              } : null]}
            >
              <Icon name={rang.icone} size={17} color={couleurs.textMention} />
              <Text
                style={[styles.libelle, {
                  color: rang.danger ? couleurs.feedbackError : couleurs.textBody,
                }]}
              >
                {libelleDuRang[rang.cle]}
              </Text>
              {/* CE QUE LE RANG CONTIENT, dit avant qu'on l'ouvre. « Mes
                  données » ne se devine pas : la valeur annonce « Exporter,
                  supprimer », et l'on sait s'il faut entrer. Un rang muet oblige
                  à ouvrir pour savoir, puis à revenir. */}
              {valeurDuRang[rang.cle] ? (
                <Text style={[styles.valeur, { color: couleurs.textMention }]}>
                  {valeurDuRang[rang.cle]}
                </Text>
              ) : null}
              {/* Pas de chevron sur un geste : il n'emmène nulle part, et la
                  flèche promettrait un écran derrière. */}
              {rang.geste ? null : (
                <Icon name="chevron-right" size={15} color={couleurs.textMention} />
              )}
            </Pressable>
          ))}
          {/* LA LANGUE SUIT LE PROFIL, comme la planche la pose : c'est le même
              ordre de question — qui je suis, dans quelle langue on me parle. */}
          {section.cle === "compte" ? (
            <View style={[styles.rang, {
              borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
            }]}>
              <Icon name="languages" size={17} color={couleurs.textMention} />
              <Text style={[styles.libelle, { color: couleurs.textBody }]}>{t.moiLangue}</Text>
              <View style={[styles.bascule, { borderColor: couleurs.borderObject }]}>
                {LANGUES.map((cle) => (
                  <Pressable
                    key={cle}
                    accessibilityRole="button"
                    accessibilityState={{ selected: langue === cle }}
                    onPress={() => changeLaLangue(cle)}
                    style={[styles.basculeChoix, langue === cle
                      ? { backgroundColor: couleurs.action } : null]}
                  >
                    <Text style={[styles.basculeTexte, {
                      color: langue === cle ? couleurs.textOnAccent : couleurs.textSecondary,
                    }]}>{cle === "fr" ? "Français" : "English"}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /* Une bascule, pas deux boutons : le cadre commun dit que les deux valeurs
     s'excluent, ce que deux boutons séparés laisseraient croire cumulables. */
  bascule: { flexDirection: "row", borderRadius: nativeRadius.pill, borderWidth: nativeBorder.width, overflow: "hidden" },
  basculeChoix: { paddingHorizontal: nativeSpace[12], paddingVertical: nativeSpace[6] },
  basculeTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 13 },
  valeur: { fontFamily: nativeFont.bodyRegular, fontSize: 13 },
  page: { flexGrow: 1, paddingHorizontal: nativeSpace[16] },
  titre: {
    fontFamily: nativeFont.displayMedium, fontSize: 27,
    letterSpacing: nativeLetterSpacing(27, nativeTracking.display),
    marginBottom: nativeSpace[16],
  },
  bloc: { marginTop: nativeSpace[24] },
  rang: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[10],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
  },
  libelle: { flex: 1, fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
});
