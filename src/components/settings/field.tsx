import type { InputHTMLAttributes } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  id: string;
}

export default function Field({ label, helperText, id, ...inputProps }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </label>
      <input
        id={id}
        {...inputProps}
        className={`w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light disabled:cursor-not-allowed disabled:bg-paper disabled:text-muted ${
          inputProps.className ?? ""
        }`}
      />
      {helperText && <p className="text-xs text-muted">{helperText}</p>}
    </div>
  );
}
