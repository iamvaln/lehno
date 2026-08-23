import type { CSSProperties, HTMLAttributes } from "react";

export interface AvatarProps extends HTMLAttributes<HTMLElement> {
  /** Sert d'alt et, sans photo, fournit l'initiale. */
  name?: string;
  /** Photo de profil. Sans elle, l'initiale en Fraunces sur lilas. */
  src?: string;
  size?: number;
}

// Portrait d'une personne — photo si elle existe, sinon l'initiale en
// Fraunces sur lilas. Toujours rond : --radius-pill, un rayon assez large
// pour composer un cercle sur n'importe quelle taille carrée.
export function Avatar({ name = "", src, size = 48, style, ...rest }: AvatarProps) {
  const initiale = name.trim().charAt(0).toUpperCase() || "?";
  const commun: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "var(--radius-pill)",
    flex: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxSizing: "border-box",
    ...style,
  };

  if (src) {
    return <img src={src} alt={name} style={{ ...commun, objectFit: "cover" }} {...rest} />;
  }

  return (
    <div
      role="img"
      aria-label={name}
      style={{
        ...commun,
        background: "var(--action-quiet-bg)",
        color: "var(--text-accent)",
        fontFamily: "var(--font-display)",
        fontVariationSettings: "var(--font-display-settings)",
        fontWeight: "var(--font-display-medium)",
        fontSize: Math.round(size * 0.4),
      }}
      {...rest}
    >
      {initiale}
    </div>
  );
}
