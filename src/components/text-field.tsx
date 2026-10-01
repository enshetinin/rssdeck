import type { InputHTMLAttributes } from "react";

type TextFieldProps = {
  id: string;
  label: string;
  hint?: string;
  /** Present only while the value is invalid. */
  error?: string | null;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "aria-describedby" | "aria-invalid">;

/**
 * A labelled input wired per the yev-design Field contract: visible label,
 * optional hint, and an error that exists only while invalid, all linked
 * through aria-describedby (hint first, then error).
 */
export function TextField({ id, label, hint, error, ...inputProps }: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <p id={hintId ?? undefined} className="field-hint">
          {hint}
        </p>
      ) : null}
      <input
        {...inputProps}
        id={id}
        className="field-control"
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p id={errorId ?? undefined} className="field-error">
          <span className="field-error-prefix">Error:</span> {error}
        </p>
      ) : null}
    </div>
  );
}
