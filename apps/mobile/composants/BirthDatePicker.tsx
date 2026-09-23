import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid, type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  nativeBorder, nativeFont, nativeRadius, nativeSize, nativeSpace,
} from "@lehno/tokens";
import { Icon, useCouleurs } from "@lehno/ui-native";
import { ANNEE_DE_SUPPORT, type SaisieDeNaissance } from "../lib/carnet.js";
import { Bascule } from "./Bascule.js";

/**
 * THE STANDARD PLATFORM DATE PICKER — §2 of the test log.
 *
 * Three screens (person identity, own profile, event) each rebuilt the same
 * day-of-birth field by hand: a horizontally scrolling row of thirty-one day
 * chips, a twelve-tile month grid, and a free-text year. It was slow to use,
 * it didn't match anything else on the device, and — because none of the
 * three bounded the day row to the chosen month — it let a person pick
 * February 31st: `naissanceAEnvoyer` composed the string without checking the
 * calendar, and `dateCivileSchema` at the contract only validated a SHAPE
 * (`\d{4}-\d{2}-\d{2}`), not a real date. A native picker makes that
 * combination unrepresentable in the UI itself: nobody can spin the wheel to
 * a day that doesn't exist in the displayed month.
 *
 * Direct instruction, verbatim: "Fais un datepicker standard alors." No
 * three-chip reinvention, no custom wheel — the platform's own control.
 *
 * WHY THE TWO PLATFORMS DIFFER, and it isn't a choice made here — it's how
 * this library works everywhere: iOS has no imperative "show a dialog" API,
 * so the wheel is a component toggled into and out of the tree. Android's
 * picker IS a dialog, opened once and torn down by the OS; rendering a
 * persistent component for it would leave a phantom node with nothing to
 * show.
 *
 * THE YEAR NEVER LEAKS WHEN IT'S UNKNOWN. The wheel always needs a real date
 * to spin on — there is no "day and month only" mode — so an unknown year
 * still shows one, on `ANNEE_DE_SUPPORT` (2000, deliberately a leap year:
 * see `carnet.ts`, someone born on the 29th of February must stay pickable).
 * What the wheel displays and what gets kept apart the moment "I don't know
 * the year" is on: `appliquer` drops whatever year the picker lands on and
 * keeps `annee: null`. Toggling the switch does not, by itself, touch the
 * day or the month already chosen.
 */
export function BirthDatePicker({
  label, unknownYearLabel, value, onChange,
}: {
  // Optional: a caller that already has its own section heading right above
  // (`SectionLabel`) doesn't need a second, redundant one on the field.
  label?: string | undefined;
  unknownYearLabel: string;
  value: SaisieDeNaissance;
  onChange: (valeur: SaisieDeNaissance) => void;
}) {
  const couleurs = useCouleurs();
  // iOS only: whether the inline wheel is currently shown. Android never
  // reads this — its dialog is its own top-level window, nothing to toggle
  // in this tree.
  const [roueOuverte, setRoueOuverte] = useState(false);

  const dateActuelle = versDate(value);

  const appliquer = (choisie: Date): void => {
    onChange({
      jour: choisie.getDate(),
      mois: choisie.getMonth() + 1,
      // The wheel always resolves to SOME year; an unknown one is never kept,
      // whatever the wheel happened to land on.
      annee: value.anneeConnue ? choisie.getFullYear() : null,
      anneeConnue: value.anneeConnue,
    });
  };

  const ouvrir = (): void => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: dateActuelle,
        mode: "date",
        onChange: (evt: DateTimePickerEvent, choisie?: Date) => {
          if (evt.type === "set" && choisie) appliquer(choisie);
        },
      });
    } else {
      setRoueOuverte((v) => !v);
    }
  };

  return (
    <View style={styles.conteneur}>
      <Text style={[styles.etiquette, { color: couleurs.textSecondary }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={ouvrir}
        style={[styles.champ, {
          borderColor: couleurs.borderObject, backgroundColor: couleurs.surfaceCard,
        }]}
      >
        <Text style={[styles.texte, { color: couleurs.textBody }]}>
          {formatee(value)}
        </Text>
        <Icon name="chevron-down" size={16} color={couleurs.textMention} />
      </Pressable>

      {Platform.OS === "ios" && roueOuverte ? (
        <DateTimePicker
          value={dateActuelle}
          mode="date"
          display="spinner"
          onChange={(evt: DateTimePickerEvent, choisie?: Date) => {
            if (choisie) appliquer(choisie);
          }}
        />
      ) : null}

      <View style={styles.bascule}>
        <Bascule
          actif={!value.anneeConnue}
          libelle={unknownYearLabel}
          premier
          onBascule={(inconnue) => {
            /* Toggling this does not touch the day or month already chosen —
               only whether a year travels with them. Flipping TO "known"
               without a year picked yet falls back to the year the wheel is
               already showing, so the field never jumps to a blank state the
               person didn't ask for. */
            onChange({
              ...value,
              anneeConnue: !inconnue,
              annee: inconnue ? null : (value.annee ?? dateActuelle.getFullYear()),
            });
          }}
        />
      </View>
    </View>
  );
}

/* THE FORM THIS SCREEN ASKS FOR, but never something a real calendar would
   refuse: `Date`'s own constructor rolls an out-of-range day into the next
   month rather than throwing, so this can't itself produce a February 31st —
   it can only ever hold a day that genuinely exists in that month. */
function versDate(saisie: SaisieDeNaissance): Date {
  const annee = saisie.anneeConnue ? (saisie.annee ?? new Date().getFullYear()) : ANNEE_DE_SUPPORT;
  const mois = saisie.mois ?? 1;
  const jour = saisie.jour ?? 1;
  return new Date(annee, mois - 1, jour);
}

/* WHAT THE CLOSED FIELD SHOWS: numbers, not month names — `dd/mm` or
   `dd/mm/yyyy`. Deliberately locale-neutral rather than routed through the
   caller's dictionary: it reads the same in French and in English, so this
   component takes no `langue` prop and stays usable from any screen without
   plumbing one through just for this. */
function formatee(saisie: SaisieDeNaissance): string {
  if (saisie.jour === null || saisie.mois === null) return "—";
  const jj = String(saisie.jour).padStart(2, "0");
  const mm = String(saisie.mois).padStart(2, "0");
  return saisie.anneeConnue && saisie.annee !== null
    ? `${jj}/${mm}/${saisie.annee}`
    : `${jj}/${mm}`;
}

const styles = StyleSheet.create({
  conteneur: { gap: nativeSpace[6] },
  etiquette: { fontFamily: nativeFont.bodyRegular, fontSize: nativeSize.bodyXs },
  champ: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: nativeBorder.width, borderRadius: nativeRadius.sm,
    paddingVertical: nativeSpace[14], paddingHorizontal: 15,
  },
  texte: { fontFamily: nativeFont.bodyRegular, fontSize: nativeSize.bodyM },
  bascule: { marginTop: nativeSpace[4] },
});
