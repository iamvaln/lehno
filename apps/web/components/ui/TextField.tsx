import { useId } from "react";
import type { CSSProperties, InputHTMLAttributes, ReactElement, TextareaHTMLAttributes } from "react";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Aide sous le champ ; passe en rouge quand `invalid`. */
  hint?: string;
  multiline?: boolean;
  rows?: number;
  invalid?: boolean;
  /** mobile force 16 px de texte (pas de zoom iOS) et 44 px de hauteur minimale. */
  platform?: "web" | "mobile";
}

// Ajout intentionnel : la charte ne documente pas encore les formulaires ; les
// valeurs reprennent celles observées sur la landing (voir
// components/forms/TextField.prompt.md du paquet de passation). À revoir
// quand la charte les traitera.
export function TextField(
  {
    label, hint, multiline = false, rows = 4, invalid = false,
    platform = "web", id, style, ...rest
  }: TextFieldProps,
): ReactElement {
  const idGenere = useId();
  const idChamp = id ?? idGenere;
  const idAide = hint ? `${idChamp}-aide` : undefined;

  // La taille de texte ne descend jamais sous 16 px (specs/design-system-lehno.md
  // §5.5) : en dessous, le navigateur mobile agrandit la page à la mise au
  // point. Ce n'est pas une règle propre au mode mobile, donc pas de branche
  // selon `platform` ici — seule la hauteur minimale en dépend.
  const styleChamp: CSSProperties = {
    boxSizing: "border-box",
    width: "100%",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-body-m)",
    color: "var(--text-body)",
    background: "var(--surface-card)",
    border: `var(--border-width) solid ${invalid ? "var(--feedback-error)" : "var(--border-object)"}`,
    borderRadius: "var(--radius-sm)",
    padding: "var(--space-14) var(--space-16)",
    minHeight: platform === "mobile" ? "var(--touch-min)" : undefined,
    resize: multiline ? "vertical" : undefined,
    lineHeight: multiline ? "var(--leading-body)" : undefined,
    transition: "border-color var(--duration-state) var(--ease-state)",
    ...style,
  };

  const styleLabel: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-body-xs)",
    color: "var(--text-secondary)",
  };

  const styleAide: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-mention-s)",
    color: invalid ? "var(--feedback-error)" : "var(--text-mention)",
  };

  return (
    <div style={{ display: "grid", gap: "var(--space-6)", fontFamily: "var(--font-body)" }}>
      {label ? (
        <label htmlFor={idChamp} style={styleLabel}>
          {label}
        </label>
      ) : null}
      {multiline ? (
        <textarea
          id={idChamp}
          rows={rows}
          aria-invalid={invalid || undefined}
          aria-describedby={idAide}
          style={styleChamp}
          // Le contrat du composant reprend les attributs natifs d'un
          // <input> (voir TextFieldProps) ; en mode multiligne, ils
          // s'appliquent tout aussi bien à un <textarea> — value, onChange,
          // placeholder, name… Seule leur forme TypeScript diffère.
          {...(rest as unknown as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={idChamp}
          aria-invalid={invalid || undefined}
          aria-describedby={idAide}
          style={styleChamp}
          {...rest}
        />
      )}
      {hint ? (
        <div id={idAide} style={styleAide}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
