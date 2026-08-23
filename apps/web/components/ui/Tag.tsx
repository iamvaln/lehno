import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export type EtiquetteTon = "outline" | "quiet" | "celebrate";

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  /** outline — étiquette de goût. quiet — décompte, état. celebrate — « aujourd'hui ». */
  tone?: EtiquetteTon;
}

const TONS: Record<EtiquetteTon, CSSProperties> = {
  outline: {
    border: "var(--border-width) solid var(--border-object)",
    background: "transparent",
    color: "var(--text-body)",
  },
  quiet: {
    border: "var(--border-width) solid transparent",
    background: "var(--action-quiet-bg)",
    color: "var(--text-accent)",
  },
  // L'abricot : réservé aux moments heureux, jamais décoratif.
  celebrate: {
    border: "var(--border-width) solid transparent",
    background: "var(--celebrate)",
    color: "var(--on-celebrate)",
  },
};

export function Tag({ children, tone = "outline", style, ...rest }: TagProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-body-xs)",
        fontWeight: "var(--font-body-regular)",
        lineHeight: "var(--leading-body)",
        padding: "var(--space-6) var(--space-12)",
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        ...TONS[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
