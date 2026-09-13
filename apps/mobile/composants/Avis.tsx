import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { feedbackReasonsSchema, type FeedbackReason, type NatureAvis } from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeRadius, nativeSpace } from "@lehno/tokens";
import { Button, TextField, chassisDeFeuille, useCouleurs } from "@lehno/ui-native";
import { appel } from "../lib/api.js";
import { useLangue } from "../lib/langue.js";
import { needsReason, ratingCall, reasonsPath, wanted, type RatingCall } from "../lib/rating.js";

/* Deux pouces, et la question qui suit le pouce baissé.
 *
 * CE N'EST PAS LE VERDICT. Garder un portrait et l'aimer sont deux questions :
 * l'une engage l'objet, l'autre dit ce qu'on en pense. On peut garder sans
 * admirer, et cette réponse-là dit quelque chose qu'aucune des deux ne dirait
 * seule. Les fondre détruirait la seule mesure qui dise si l'atelier progresse.
 *
 * LA QUESTION VIENT AVANT L'ENVOI, jamais après. Enregistrer le rejet puis
 * demander pourquoi laisserait un avis sans la seule chose qu'on vient
 * chercher — et quelqu'un qui ferme la question ne serait plus jamais
 * interrogé.
 *
 * LES MOTIFS VIENNENT DU SERVEUR, par nature. « Ne lui ressemble pas » n'a
 * aucun sens sous un message, « hors budget » aucun sous un portrait : filtrer
 * ici ferait proposer un motif que le serveur refuserait, après que la personne
 * a répondu.
 */
export function Avis({ nature, id, valeur, surChangement }: {
  nature: NatureAvis;
  id: string;
  valeur: "up" | "down" | null;
  /** Rend l'appel à faire. L'écran le joue, parce que c'est lui qui sait relire. */
  surChangement: (appelAFaire: RatingCall) => void | Promise<void>;
}) {
  const { t } = useLangue();
  const couleurs = useCouleurs();
  const c = chassisDeFeuille({ couleurs });
  const [demande, setDemande] = useState(false);
  const [motifs, setMotifs] = useState<readonly FeedbackReason[]>([]);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [note, setNote] = useState("");

  /* Les motifs se lisent À L'OUVERTURE de la question, pas au montage : la
     plupart des gens ne rejetteront jamais rien, et charger une liste qu'ils ne
     verront pas coûterait un appel par production affichée. */
  useEffect(() => {
    if (!demande || motifs.length > 0) return;
    let vivant = true;
    void (async () => {
      try {
        const lu = feedbackReasonsSchema.parse(await appel<unknown>(reasonsPath(nature)));
        if (vivant) setMotifs(lu.items);
      } catch { /* Sans liste, il reste le champ libre : voir le bouton d'envoi. */ }
    })();
    return () => { vivant = false; };
  }, [demande, motifs.length, nature]);

  const presse = (pouce: "up" | "down"): void => {
    const suite = wanted({ feedback: valeur }, pouce);
    if (needsReason(suite)) { setDemande(true); return; }
    void surChangement(ratingCall(nature, id, suite));
  };

  const envoieLeRejet = (): void => {
    if (choisi === null) return;
    void surChangement(ratingCall(nature, id, "down", { code: choisi, note }));
    setDemande(false);
    setChoisi(null);
    setNote("");
  };

  return (
    <>
      <View style={styles.pouces}>
        <Pouce
          actif={valeur === "up"}
          libelle={t.avisJaime}
          onPress={() => presse("up")}
        />
        <Pouce
          actif={valeur === "down"}
          libelle={t.avisJaimePas}
          onPress={() => presse("down")}
        />
      </View>

      {demande ? (
        /* LE MÊME CHÂSSIS QUE LES DEUX AUTRES FEUILLES du kit — il n'y a pas
           de `Sheet` générique, seulement ce châssis, et le recopier à la main
           ferait diverger une troisième feuille des deux premières. */
        <View style={c.scene}>
          {/* Le voile ferme aussi : une question qui monte doit pouvoir se
              refuser sans viser un bouton — et ici le refus a un sens, c'est
              « je ne veux pas dire pourquoi ». */}
          <Pressable
            onPress={() => setDemande(false)}
            accessibilityRole="button"
            accessibilityLabel={t.annuler}
            style={c.voile}
          />
          <View style={c.feuille} accessibilityViewIsModal accessibilityLabel={t.avisPourquoi}>
            <View style={c.poignee} accessibilityElementsHidden importantForAccessibility="no" />
            <Text style={c.titre} accessibilityRole="header">{t.avisPourquoi}</Text>
          {motifs.map((m) => {
            const actif = choisi === m.code;
            return (
              <Pressable
                key={m.code}
                accessibilityRole="radio"
                accessibilityState={{ selected: actif, checked: actif }}
                onPress={() => setChoisi(m.code)}
                style={[styles.motif, {
                  borderColor: actif ? couleurs.action : couleurs.borderObject,
                  borderWidth: actif ? nativeBorder.widthFirm : nativeBorder.width,
                }]}
              >
                <Text style={{ color: couleurs.textBody }}>{m.label}</Text>
              </Pressable>
            );
          })}

          {/* LE CHAMP LIBRE RESTE FACULTATIF. Obligatoire, il ferait taper
              « rien » à tout le monde, et on aurait remplacé une liste vide par
              du bruit. */}
          <TextField
            multiline
            label={t.avisNote}
            value={note}
            onChangeText={setNote}
          />

          {/* LE MOTIF, LUI, NE L'EST PAS : c'est toute la raison d'être de cette
              question. Sans lui, on saurait qu'une version déplaît sans savoir
              en quoi — et la consigne suivante n'avancerait pas. */}
            <Button full disabled={choisi === null} onPress={envoieLeRejet}>
              {t.avisEnvoyer}
            </Button>
          </View>
        </View>
      ) : null}
    </>
  );
}

function Pouce({ actif, libelle, onPress }: {
  actif: boolean;
  libelle: string;
  onPress: () => void;
}) {
  const couleurs = useCouleurs();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      accessibilityLabel={libelle}
      onPress={onPress}
      style={[styles.pouce, {
        borderColor: actif ? couleurs.action : couleurs.borderObject,
        borderWidth: actif ? nativeBorder.widthFirm : nativeBorder.width,
      }]}
    >
      <Text style={[styles.pouceTexte, { color: actif ? couleurs.action : couleurs.textMention }]}>
        {libelle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pouces: { flexDirection: "row", gap: nativeSpace[8] },
  pouce: {
    minHeight: 38, paddingHorizontal: nativeSpace[14],
    justifyContent: "center", borderRadius: nativeRadius.pill,
  },
  pouceTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 13 },
  titre: { fontFamily: nativeFont.displayMedium, fontSize: 19, marginBottom: nativeSpace[12] },
  motif: {
    padding: nativeSpace[12], borderRadius: nativeRadius.md,
    marginBottom: nativeSpace[8],
  },
});
