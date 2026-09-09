import * as React from "react";

export interface AvatarProps extends React.HTMLAttributes<HTMLElement> {
  /** Sert d'alt et, sans photo, fournit l'initiale. */
  name?: string;
  /** Photo de profil. Sans elle, l'initiale en Fraunces sur lilas. */
  src?: string;
  size?: number;
}

export declare function Avatar(props: AvatarProps): React.ReactElement;
