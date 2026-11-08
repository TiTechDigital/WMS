"use client";
import * as React from "react";

/**
 * Links a form control to its <Field> label, hint and error without each call site wiring
 * ids by hand. Inputs, textareas and select triggers read this context.
 */
export interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
}

export const FieldContext = React.createContext<FieldContextValue | null>(null);

export function useFieldControlProps<P extends { id?: string; "aria-describedby"?: string; "aria-invalid"?: React.AriaAttributes["aria-invalid"] }>(props: P) {
  const ctx = React.useContext(FieldContext);
  if (!ctx) return props;
  return {
    ...props,
    id: props.id ?? ctx.id,
    "aria-describedby": [props["aria-describedby"], ctx.describedBy].filter(Boolean).join(" ") || undefined,
    "aria-invalid": props["aria-invalid"] ?? (ctx.invalid || undefined),
  };
}
