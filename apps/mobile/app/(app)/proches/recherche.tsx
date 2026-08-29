import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { personListSchema, type Person } from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeRadius, nativeSpace, nativeTouchMin,
} from "@lehno/tokens";
import { Avatar, Countdown, EmptyState, Icon, Tag, useCouleurs } from "@lehno/ui-native";
import { useLangue } from "../../../lib/langue.js";
import { appel } from "../../../lib/api.js";
import { dateCourte, presseAssezPourSAfficher } from "../../../lib/carnet.js";
import { libelleDeLEcheance } from "../../../lib/libelles.js";

/* La recherche.
 *
 * ELLE SE PARCOURT : sans saisie, elle montre le carnet entier plutôt qu'une
 * page blanche — chercher commence souvent par parcourir.
 *
 * ELLE FILTRE CHEZ ELLE, et c'est une exception assumée : `/me/persons` n'a pas
 * de paramètre de recherche. Le carnet est personnel — quelques centaines de
 * fiches au plus —, donc on le charge en entier, par pages de cent, et on
 * filtre en mémoire. Un `?q=` au contrat rendrait ce chargement inutile ; c'est
 * demandé au serveur.
 *
 * Le tri est ALPHABÉTIQUE ici, pas par date : on cherche un nom.
 */

// Cent, le plafond du contrat. Un carnet de quatre cents fiches tient en
// quatre appels — au-delà, c'est le `?q=` qu'il faudra, pas une page de plus.
const PAR_APPEL = 100;

export default function Recherche() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [saisie, setSaisie] = useState("");
  const [carnet, setCarnet] = useState<Person[] | null>(null);

  const charge = useCallback(async () => {
    const tout: Person[] = [];
    let total = Infinity;
    while (tout.length < total) {
      const page = personListSchema.parse(await appel<unknown>(
        `/me/persons?sort=alpha&direction=asc&offset=${tout.length}&limit=${PAR_APPEL}`,
      ));
      total = page.total;
      // Une page vide arrête la boucle : sans cette garde, un total qui ne
      // descend jamais ferait tourner l'appel indéfiniment.
      if (page.persons.length === 0) break;
      tout.push(...page.persons);
    }
    setCarnet(tout);
  }, []);

  useEffect(() => { void charge(); }, [charge]);

  const resultats = useMemo(() => {
    const q = saisie.trim().toLocaleLowerCase(langue);
    if (!carnet) return [];
    if (!q) return carnet;
    /* Le nom d'usage compte autant que le nom des listes : qui cherche
       « maman » doit trouver Marie-Ange. */
    return carnet.filter((p) =>
      p.displayName.toLocaleLowerCase(langue).includes(q)
      || (p.callingName ?? "").toLocaleLowerCase(langue).includes(q));
  }, [carnet, saisie, langue]);

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.surfacePage, paddingTop: insets.top + nativeSpace[6] }}>
      <View style={[styles.barre]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.retour}
          onPress={() => routeur.back()}
          style={[styles.retour]}
        >
          <Icon name="chevron-left" size={22} color={couleurs.textBody} />
        </Pressable>
        <View style={[styles.champ, { borderColor: couleurs.action }]}>
          <Icon name="search" size={17} color={couleurs.textMention} />
          <TextInput
            value={saisie}
            onChangeText={setSaisie}
            placeholder={t.rechercher}
            placeholderTextColor={couleurs.textMention}
            accessibilityLabel={t.rechercher}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={[styles.saisie, { color: couleurs.textBody }]}
          />
          {saisie ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t.effacer} onPress={() => setSaisie("")}>
              <Icon name="x" size={15} strokeWidth={2} color={couleurs.textMention} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: nativeSpace[16],
          paddingBottom: insets.bottom + nativeSpace[20],
        }}
        keyboardShouldPersistTaps="handled"
      >
        {resultats.length ? (
          resultats.map((p, rang) => {
            const jours = p.nextOccurrence?.daysUntil ?? null;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() => routeur.push({ pathname: "/(app)/proches/[id]", params: { id: p.id } })}
                style={[styles.ligne, rang ? {
                  borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
                } : null]}
              >
                <Avatar name={p.displayName} size={40} {...(p.avatarUrl ? { source: p.avatarUrl } : {})} />
                <View style={[styles.identite]}>
                  <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>
                    {p.displayName}
                  </Text>
                  {p.nextOccurrence ? (
                    <View style={[styles.repere]}>
                      <Tag tone={p.nextOccurrence.kind === "birthday" ? "outline" : "quiet"}>
                        {libelleDeLEcheance(p.nextOccurrence.kind, p.nextOccurrence.label, t)}
                      </Tag>
                      <Text style={[styles.date, { color: couleurs.textSecondary }]}>
                        {dateCourte(p.nextOccurrence.occurrenceDate, langue)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {presseAssezPourSAfficher(jours) ? (
                  <Countdown
                    size="s"
                    today={jours === 0}
                    label={jours === 0 ? t.aujourdhui : t.decompteBarre(jours ?? 0)}
                  />
                ) : null}
              </Pressable>
            );
          })
        ) : carnet === null ? null : (
          <EmptyState
            illustration="recherche-sans-resultat"
            title={t.videRechercheTitre}
            text={t.videRechercheTexte}
            actionLabel={t.ajouterCeProche}
            onAction={() => routeur.push("/(app)/proches/identite")}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[8],
    paddingHorizontal: nativeSpace[12], paddingBottom: nativeSpace[12],
  },
  retour: { width: nativeTouchMin, height: nativeTouchMin, alignItems: "center", justifyContent: "center", marginLeft: -nativeSpace[8] },
  champ: {
    flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: nativeSpace[8],
    minHeight: nativeTouchMin, paddingHorizontal: nativeSpace[12],
    borderRadius: nativeRadius.sm, borderWidth: nativeBorder.width,
  },
  saisie: { flex: 1, minWidth: 0, fontFamily: nativeFont.bodyRegular, fontSize: 16 },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
  },
  identite: { flex: 1, minWidth: 0 },
  nom: { fontFamily: nativeFont.displayRegular, fontSize: 16 },
  repere: { flexDirection: "row", alignItems: "center", gap: nativeSpace[6], marginTop: 2 },
  date: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5 },
});
