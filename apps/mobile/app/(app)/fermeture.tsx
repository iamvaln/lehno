import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  deletionAcceptedSchema, deletionPreviewSchema, profileSchema,
  type DeletionAccepted, type DeletionPreview, type DeletionReason,
} from "@lehno/contracts";
import { nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin, nativeTracking } from "@lehno/tokens";
import {
  Banner, Button, Icon, LoadingState, SectionLabel, TextField, Toast, useCouleurs,
} from "@lehno/ui-native";
import { Choix } from "../../composants/Choix.js";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { effaceLesJetons } from "../../lib/jetons.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import {
  cequiPart, corpsDeFermeture, etatDuRemboursement, impactVide, MOTIFS_OFFERTS,
  peutFermer, TEMPS, type LigneDImpact,
} from "../../lib/fermeture.js";

/* Fermer son compte — §3.24, en trois temps.
 *
 * ON NE FERME PAS UN COMPTE D'UN BOUTON. Les trois temps ne sont pas une
 * cérémonie : chacun montre quelque chose qu'on ne peut pas deviner de
 * l'extérieur — ce qui part, ce que devient l'argent, et ce qu'il faut prouver.
 *
 * LE COMPTE N'EST PAS EFFACÉ à la confirmation : il est désactivé, et la date
 * d'effacement est annoncée. C'est la seule réponse honnête à un geste qu'on
 * promet réversible — et le délai comme l'adresse de l'assistance viennent du
 * SERVEUR, jamais d'une phrase figée ici.
 */
export default function Fermeture() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();

  const [apercu, setApercu] = useState<DeletionPreview | null>(null);
  const [pseudoReel, setPseudoReel] = useState<string | null>(null);
  const [temps, setTemps] = useState(1);

  const [motif, setMotif] = useState<DeletionReason | null>(null);
  const [precision, setPrecision] = useState("");
  const [methode, setMethode] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState("");
  const [code, setCode] = useState("");

  const [envoi, setEnvoi] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const [fini, setFini] = useState<DeletionAccepted | null>(null);

  const charge = useCallback(async () => {
    try {
      const [brutApercu, brutProfil] = await Promise.all([
        appel<unknown>("/me/account/deletion-preview"),
        appel<unknown>("/me/profile"),
      ]);
      setApercu(deletionPreviewSchema.parse(brutApercu));
      setPseudoReel(profileSchema.parse(brutProfil).username);
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useEffect(() => { void charge(); }, [charge]);

  /* LE CODE PART QUAND ON ARRIVE AU TROISIÈME TEMPS, pas avant : le demander à
     l'ouverture enverrait un courrier à quelqu'un qui lisait seulement ce qu'il
     risque de perdre — et l'envoi est borné en débit, cinq par heure. */
  const demandeLeCode = async (): Promise<void> => {
    setEchec(null);
    try {
      await appel<unknown>("/me/account/deletion-code", { method: "POST" });
      setAccuse(t.supprCodeRenvoye);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  const avance = (): void => {
    const suivant = temps + 1;
    setTemps(suivant);
    if (suivant === TEMPS) void demandeLeCode();
  };

  const ferme = async (): Promise<void> => {
    if (!pseudoReel) return;
    setEnvoi(true);
    setEchec(null);
    try {
      const brut = await appel<unknown>("/me/account", {
        method: "DELETE",
        body: JSON.stringify(corpsDeFermeture({ pseudo, code, motif, precision, methode })),
      });
      const rendu = deletionAcceptedSchema.parse(brut);
      /* LA SESSION MEURT AVEC LE COMPTE. On efface le trousseau tout de suite :
         garder des jetons vers un compte désactivé ferait échouer le prochain
         appel sans qu'on sache pourquoi. L'écran final se lit sans session — il
         ne fait plus aucune demande. */
      await effaceLesJetons();
      setFini(rendu);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  /* CE QUI RESTE APRÈS, et c'est le seul écran de l'application qui se lit sans
     compte. Le délai et l'adresse viennent du serveur : une phrase figée ici
     vieillirait en silence, et quelqu'un écrirait à une adresse morte pendant
     que le délai court. */
  if (fini) {
    return (
      <View style={[styles.page, styles.centre, {
        paddingTop: insets.top + nativeSpace[40], paddingBottom: insets.bottom + nativeSpace[24],
      }]}>
        {/* Pas d'illustration : le jeu porté n'en a aucune pour un compte
            fermé, et `Illustration` rend `null` sur un nom inconnu — le trou
            serait passé inaperçu. Mieux vaut l'absence assumée. */}
        <Text style={[styles.titre, { color: couleurs.textBody }]} accessibilityRole="header">
          {t.supprFait}
        </Text>
        <Text style={[styles.texte, styles.auMilieu, { color: couleurs.textSecondary }]}>
          {t.supprGrace(apercu?.gracePeriodDays ?? 0, fini.supportEmail)}
        </Text>
        <View style={styles.pied}>
          <Button full onPress={() => routeur.replace("/(connexion)")}>{t.supprRevenir}</Button>
        </View>
      </View>
    );
  }

  if (echec && !apercu) {
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

  if (!apercu || pseudoReel === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  const remboursement = etatDuRemboursement(apercu);
  const libelleDeLigne: Record<LigneDImpact, string[]> = {
    socle: [...t.supprSocle],
    wishlists: [t.supprPartWishlists],
    mur: [t.supprPartMur],
    liens: [t.supprPartLiens],
  };
  const compte = apercu.impact;

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

        <Text style={[styles.titre, { color: couleurs.textBody }]} accessibilityRole="header">
          {t.supprTitre}
        </Text>
        {/* Le rang du temps, dit en clair : on doit pouvoir savoir combien il en
            reste avant de s'engager plus loin. */}
        <Text style={[styles.rang, { color: couleurs.textMention }]}>{t.supprPas(temps)}</Text>

        {echec ? (
          <View style={{ marginTop: nativeSpace[12] }}>
            <Banner intent="error">{echec}</Banner>
          </View>
        ) : null}

        {temps === 1 ? (
          <View style={styles.bloc}>
            <SectionLabel>{t.supprCeQuiPart}</SectionLabel>
            {/* LES DÉCOMPTES D'ABORD : « 47 notes » fait peser le geste comme
                aucune phrase ne le ferait. Ils viennent du serveur, jamais le
                contenu — le rendre en entier ferait de cet aperçu un second
                export, avec les mêmes obligations et aucune des protections.
                Un compte vide n'a rien à compter : on n'écrit pas « 0 proche ». */}
            {impactVide(compte) ? null : (
              <Text style={[styles.compte, { color: couleurs.textBody }]}>
                {[compte.persons, compte.notes, compte.events, compte.generatedMessages]
                  .join(" · ")}
              </Text>
            )}
            {cequiPart(actives).flatMap((l) => libelleDeLigne[l]).map((ligne) => (
              <View key={ligne} style={styles.puce}>
                <Icon name="minus" size={14} color={couleurs.textMention} />
                <Text style={[styles.texte, { color: couleurs.textSecondary }]}>{ligne}</Text>
              </View>
            ))}
            <Text style={[styles.mention, { color: couleurs.textMention }]}>
              {t.supprCeQuiReste}
            </Text>
          </View>
        ) : null}

        {temps === 2 ? (
          <View style={styles.bloc}>
            <Text style={[styles.texte, { color: couleurs.textBody }]}>
              {t.supprSolde(apercu.refund.balance)}
            </Text>
            {/* TROIS ÉTATS, ET ILS NE DISENT PAS LA MÊME CHOSE. Rien à rendre ;
                une méthode qui convient ; ou des crédits à rendre sans méthode
                éligible — ce dernier n'est pas une erreur, c'est l'état que
                §3.24 décrit, et l'écran oriente vers l'assistance. */}
            {remboursement === "rien" ? (
              <Text style={[styles.mention, { color: couleurs.textMention }]}>
                {t.supprSoldeVide}
              </Text>
            ) : (
              <>
                <Text style={[styles.mention, { color: couleurs.textMention }]}>
                  {t.supprSoldeRemboursable}
                </Text>
                {remboursement === "possible" ? (
                  <Choix
                    options={apercu.refund.eligibleMethods.map((m) => m.id)}
                    libelle={(id) => {
                      const m = apercu.refund.eligibleMethods.find((x) => x.id === id);
                      return [m?.brand, m?.last4].filter(Boolean).join(" ") || "—";
                    }}
                    valeur={methode}
                    pose={setMethode}
                  />
                ) : (
                  <Text style={[styles.mention, { color: couleurs.textMention }]}>
                    {apercu.supportEmail}
                  </Text>
                )}
              </>
            )}
          </View>
        ) : null}

        {temps === 3 ? (
          <>
            <View style={styles.bloc}>
              <SectionLabel>{t.supprRaison}</SectionLabel>
              <Text style={[styles.mention, { color: couleurs.textMention }]}>
                {t.supprRaisonFacultatif}
              </Text>
              {/* SEULS LES MOTIFS QU'ON SAIT NOMMER. Le contrat en porte sept,
                  la copie quatre, et l'un des quatre ne correspond à aucun : le
                  ranger de force enverrait une raison fausse dans une donnée qui
                  sert à décider du produit. Le champ libre prend le relais. */}
              <Choix
                options={MOTIFS_OFFERTS.map((m) => m.motif)}
                libelle={(m) => {
                  const offert = MOTIFS_OFFERTS.find((x) => x.motif === m);
                  return t.supprRaisons[offert?.indice ?? 0] ?? m;
                }}
                valeur={motif}
                pose={setMotif}
              />
              <View style={{ marginTop: nativeSpace[12] }}>
                <TextField
                  multiline
                  label={t.supprRaisonAutre}
                  value={precision}
                  onChangeText={setPrecision}
                />
              </View>
            </View>

            <View style={styles.bloc}>
              <SectionLabel>{t.supprConfirmer}</SectionLabel>
              {/* DEUX PREUVES. Le pseudo prouve l'intention — on ne le saisit pas
                  par accident ; le code prouve l'accès à la boîte — sans lui, un
                  téléphone déverrouillé une minute suffirait. */}
              <TextField
                label={t.supprPseudo}
                nature="pseudo"
                value={pseudo}
                onChangeText={setPseudo}
              />
              <View style={{ marginTop: nativeSpace[12] }}>
                <TextField
                  label={t.supprCode}
                  nature="code"
                  value={code}
                  onChangeText={setCode}
                />
              </View>
              <Button variant="text" full onPress={() => void demandeLeCode()}>
                {t.supprCodeRenvoyer}
              </Button>
            </View>
          </>
        ) : null}

        <View style={styles.pied}>
          {temps < TEMPS ? (
            <Button full onPress={avance}>{t.supprSuivant}</Button>
          ) : (
            <Button
              full
              variant="outline"
              icon="trash-2"
              disabled={envoi || !peutFermer(pseudo, pseudoReel, code)}
              onPress={() => void ferme()}
            >
              {t.supprFermer}
            </Button>
          )}
          <Button variant="text" full onPress={() => routeur.back()}>{t.supprRenoncer}</Button>
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
  centre: { alignItems: "center" },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  titre: {
    fontFamily: nativeFont.displayMedium, fontSize: 22, marginTop: nativeSpace[8],
    letterSpacing: nativeLetterSpacing(22, nativeTracking.display),
  },
  rang: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[4] },
  bloc: { marginTop: nativeSpace[24] },
  compte: { fontFamily: nativeFont.displayMedium, fontSize: 19, marginTop: nativeSpace[8] },
  puce: { flexDirection: "row", alignItems: "flex-start", gap: nativeSpace[8], marginTop: nativeSpace[8] },
  texte: { flex: 1, fontFamily: nativeFont.bodyRegular, fontSize: 14 },
  auMilieu: { textAlign: "center", marginTop: nativeSpace[12] },
  mention: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[8] },
  pied: { marginTop: "auto", paddingTop: nativeSpace[28] },
});
