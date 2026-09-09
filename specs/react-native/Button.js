import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { theme, font, size, radius, touchMin } from "./tokens";

/* Le bouton — porté.
 *
 * Le survol n'existe pas sur un téléphone : l'état PRESSÉ est le seul retour
 * que reçoit le doigt, donc chaque rang doit en avoir un qui se voit. Le web
 * s'en sortait pour « destructive » avec filter: brightness(), qui n'existe pas
 * ici — il faut une couleur pressée explicite, sinon le bouton le plus grave
 * du système ne répond pas au toucher.
 *
 * L'icône reçoit la couleur du rang par cloneElement : le web l'héritait par
 * currentColor, notion absente de RN. Sans injection, une icône reste noire
 * dans un bouton violet.
 *
 * Le libellé ne se tronque pas. Le châssis iPhone SE existe pour RÉVÉLER les
 * libellés trop longs — l'anglais les allonge d'un tiers — pas pour les cacher.
 * Le bouton grandit donc, et le défaut se voit à la revue. */

const rangs = (c) => ({
  primary: {
    fond: c.action, fondPresse: c.actionPress,
    texte: c.textOnAccent, bord: "transparent"
  },
  outline: {
    fond: "transparent", fondPresse: c.actionQuietBg,
    texte: c.textAccent, bord: c.actionEdge
  },
  text: {
    fond: "transparent", fondPresse: c.actionQuietBg,
    texte: c.textAccent, bord: "transparent"
  },
  destructive: {
    fond: c.fbError, fondPresse: c.fbErrorPress,
    texte: c.surfacePage, bord: "transparent"
  },
  destructiveOutline: {
    fond: "transparent", fondPresse: c.fbErrorBg,
    texte: c.fbError, bord: c.fbError
  },
  neutral: {
    fond: "transparent", fondPresse: c.actionQuietBg,
    texte: c.textSecondary, bord: c.borderObject
  }
});

export function Button({
  children, variant = "primary", full = false, disabled = false,
  icon = null, onPress, nuit = false, style
}) {
  const c = theme(nuit);
  const r = rangs(c)[variant] || rangs(c).primary;

  /* L'icône prend la couleur du texte qu'elle accompagne — la règle de la
     charte, appliquée à la main puisque RN n'a pas currentColor. */
  const iconeTeintee = icon
    ? React.cloneElement(icon, { color: icon.props.color || r.texte })
    : null;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        {
          alignSelf: full ? "stretch" : "flex-start",
          backgroundColor: pressed && !disabled ? r.fondPresse : r.fond,
          borderColor: r.bord,
          opacity: disabled ? 0.45 : 1,
          paddingHorizontal: variant === "text" ? 14 : 18
        },
        style
      ]}
    >
      {iconeTeintee}
      <Text style={[styles.libelle, { color: r.texte }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    /* 44 pt, comme le bouton mobile du web et comme la charte. Le pilote
       affichait 48 en le disant « de la charte » : c'était faux. */
    minHeight: touchMin,
    paddingVertical: 13,
    borderRadius: radius.md,
    /* 1 pt, pas hairlineWidth * 2 : celui-ci rend 0,67 sur un écran 3x et 1
       sur un 2x, donc la bordure change d'épaisseur selon l'appareil. */
    borderWidth: 1
  },
  libelle: {
    fontFamily: font.bodySemiBold,
    fontSize: size.bodyM,
    lineHeight: Math.round(size.bodyM * 1.2),
    /* Le libellé peut s'étendre sur deux lignes : mieux vaut un bouton plus
       haut qu'un mot coupé. */
    flexShrink: 1,
    textAlign: "center"
  }
});
