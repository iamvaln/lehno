import React from "react";

const FILES = {
  couleur:  "assets/brand/lehno-logotype-couleur.svg",
  blanc:    "assets/brand/lehno-logotype-blanc.svg",
  inverse:  "assets/brand/lehno-logotype-inverse.svg",
  uneEncre: "assets/brand/lehno-logotype-une-encre.svg"
};

export function Wordmark({ variant = "couleur", height = 24, base = "", style, ...rest }) {
  return (
    <img
      src={base + (FILES[variant] || FILES.couleur)}
      alt="Lehno"
      style={{ display: "block", height, width: "auto", ...style }}
      {...rest}
    />
  );
}
