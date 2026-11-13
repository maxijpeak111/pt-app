// Makes a unique id. crypto.randomUUID only works on https, and the phone reaches the
// dev server over plain http, so fall back to a time + random id there.
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
