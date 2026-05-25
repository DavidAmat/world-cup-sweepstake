"use client";

import { useState } from "react";

type Props = {
  name?: string;
  value?: string;
  defaultValue?: string | number;
  onChange?: (next: string) => void;
  max?: number;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
  id?: string;
};

// Text-based numeric input — no native spinners, no scroll-to-change.
// Strips non-digits on input and caps the value at `max`. Width is driven
// by the caller via className; the input doesn't grow past its container.
export function NumberInput({
  name,
  value,
  defaultValue,
  onChange,
  max = 99,
  required,
  className,
  ariaLabel,
  placeholder,
  id,
}: Props) {
  const maxLen = String(max).length;
  const controlled = value !== undefined;

  const [internal, setInternal] = useState<string>(
    value ?? (defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : ""),
  );

  const display = controlled ? (value as string) : internal;

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, maxLen);
    let next = "";
    if (digits !== "") next = String(Math.min(Number(digits), max));
    if (!controlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={display}
      onChange={(e) => handle(e.target.value)}
      onWheel={(e) => e.currentTarget.blur()}
      required={required}
      aria-label={ariaLabel}
      placeholder={placeholder}
      maxLength={maxLen}
      autoComplete="off"
      className={`tabular-nums ${className ?? ""}`}
    />
  );
}
