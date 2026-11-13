"use client";

import { useState } from "react";
import { digitsToSeconds, formatDigits, secondsToDigits } from "@/lib/duration";

// text-base (16px) on inputs stops iPhone Safari from zooming in when you tap them.
export const inputClass =
  "h-12 w-full rounded-md border border-line bg-ink px-3 text-base text-white placeholder:text-neutral-600 outline-none focus:border-brand";

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Number box. Keeps what you type (e.g. "12.") while storing a real number. Accepts comma decimals. */
export function NumberField({
  label,
  value,
  onChange,
  decimal = false,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  decimal?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));

  function handleChange(input: string) {
    let v = input.replace(",", ".").replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "");
    const [whole, ...rest] = v.split(".");
    if (rest.length > 1) v = `${whole}.${rest.join("")}`;
    setText(v);
    const n = parseFloat(v);
    onChange(Number.isFinite(n) ? n : null);
  }

  return (
    <FieldLabel label={label}>
      <input
        inputMode={decimal ? "decimal" : "numeric"}
        value={text}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
        className={`${inputClass} text-center`}
      />
    </FieldLabel>
  );
}

/** Time box: type digits only, the colons are added for you ("530" → 5:30, "13000" → 1:30:00). */
export function DurationField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (seconds: number | null) => void;
  placeholder?: string;
}) {
  const [digits, setDigits] = useState(secondsToDigits(value));

  function handleChange(input: string) {
    const d = input.replace(/\D/g, "").replace(/^0+/, "").slice(0, 6);
    setDigits(d);
    onChange(digitsToSeconds(d));
  }

  return (
    <FieldLabel label={label}>
      <input
        inputMode="numeric"
        value={formatDigits(digits)}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
        className={`${inputClass} text-center`}
      />
    </FieldLabel>
  );
}
