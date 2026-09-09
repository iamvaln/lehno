import * as React from "react";

export interface QuoteProps extends Omit<React.HTMLAttributes<HTMLParagraphElement>, "children"> {
  /** Ce que quelqu'un a dit ou écrit. */
  children: React.ReactNode;
  /** Forcer les guillemets. Par défaut : au-delà de 90 caractères. */
  guillemets?: boolean;
  size?: number;
  tone?: "body" | "muted";
}

export declare function Quote(props: QuoteProps): React.ReactElement;
