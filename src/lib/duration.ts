// Helpers for times like "5:30" or "1:30:00", typed as digits only ("530", "13000").

export function secondsToDigits(seconds: number | null): string {
  if (seconds == null) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}${String(m).padStart(2, "0")}${String(s).padStart(2, "0")}`.replace(/^0+/, "");
}

export function formatDigits(digits: string): string {
  if (!digits) return "";
  const padded = digits.padStart(3, "0");
  const sec = padded.slice(-2);
  const rest = padded.slice(0, -2);
  if (rest.length <= 2) return `${Number(rest)}:${sec}`;
  return `${Number(rest.slice(0, -2))}:${rest.slice(-2)}:${sec}`;
}

export function digitsToSeconds(digits: string): number | null {
  if (!digits) return null;
  const p = digits.padStart(6, "0");
  return Number(p.slice(0, 2)) * 3600 + Number(p.slice(2, 4)) * 60 + Number(p.slice(4, 6));
}

export function formatSeconds(seconds: number | null): string {
  return formatDigits(secondsToDigits(seconds));
}
