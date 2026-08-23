import type { HTMLAttributes, ReactNode } from "react";

export interface SectionLabelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

// Sur-titre en capitales — la seule place des capitales dans le système.
export function SectionLabel({ children, style, ...rest }: SectionLabelProps) {
  return (
    <div
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-kicker)",
        fontWeight: "var(--font-body-semibold)",
        letterSpacing: "var(--tracking-kicker)",
        textTransform: "uppercase",
        color: "var(--text-mention)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
