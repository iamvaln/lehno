import React from "react";

const FILES = {
  violet:   "assets/brand/lehno-icone-512.svg",
  ronde:    "assets/brand/lehno-icone-ronde-512.svg",
  claire:   "assets/brand/lehno-icone-claire-512.svg",
  encre:    "assets/brand/lehno-icone-sombre-512.svg",
  uneEncre: "assets/brand/lehno-icone-une-encre-512.svg",
  favicon:  "assets/brand/lehno-favicon-28.svg"
};

export function BrandMark({ variant = "violet", size = 32, base = "", style, ...rest }) {
  return (
    <img
      src={base + (FILES[variant] || FILES.violet)}
      alt=""
      aria-hidden="true"
      style={{ display: "block", width: size, height: size, flex: "none", ...style }}
      {...rest}
    />
  );
}
