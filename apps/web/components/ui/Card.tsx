import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export type CarteSurface = "card" | "panel" | "plain";
export type CarteRayon = "lg" | "xl" | "2xl";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** card — fond de carte + bordure. panel — aplat lilas, sans bordure. plain — bordure seule. */
  surface?: CarteSurface;
  padding?: number | string;
  radius?: CarteRayon;
}

const SURFACES: Record<CarteSurface, CSSProperties> = {
  card: { background: "var(--surface-card)", border: "var(--border-width) solid var(--border-object)" },
  panel: { background: "var(--surface-panel)", border: "var(--border-width) solid transparent" },
  plain: { background: "transparent", border: "var(--border-width) solid var(--border-object)" },
};

const RAYONS: Record<CarteRayon, string> = {
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
};

export function Card({
  children,
  surface = "card",
  padding = "var(--space-24)",
  radius = "xl",
  style,
  ...rest
}: CardProps) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        padding,
        borderRadius: RAYONS[radius] ?? RAYONS.xl,
        color: "var(--text-body)",
        fontFamily: "var(--font-body)",
        ...SURFACES[surface],
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
