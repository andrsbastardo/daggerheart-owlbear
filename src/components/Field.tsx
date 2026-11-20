import type { ReactNode } from "react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function TextField({
  label,
  value,
  disabled,
  placeholder,
  onChange,
}: TextFieldProps) {
  return (
    <Field label={label}>
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  disabled?: boolean;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export function NumberField({
  label,
  value,
  disabled,
  min = -10,
  max = 99,
  onChange,
}: NumberFieldProps) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
      />
    </Field>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  onChange: (value: string) => void;
}

export function TextAreaField({
  label,
  value,
  disabled,
  placeholder,
  rows = 3,
  onChange,
}: TextAreaFieldProps) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
