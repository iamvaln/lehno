import * as React from "react";

export interface OfflineBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Générations et partages mis en file. Le texte change au singulier. */
  enAttente?: number;
}

export declare function OfflineBanner(props: OfflineBannerProps): React.ReactElement;
