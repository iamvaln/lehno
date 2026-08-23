// Calcul du contraste WCAG entre deux couleurs hexadécimales. Isolé ici parce
// que ce calcul ne dépend d'aucun thème : il sert à mesurer, pas à décider.

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)];
  const [hi, lo] = a! > b! ? [a!, b!] : [b!, a!];
  return (hi + 0.05) / (lo + 0.05);
}
