"use client";

// Saves session templates in the browser's local storage (on the device).
// All reading/writing goes through this file, so it can be swapped for a database later.

import { useSyncExternalStore } from "react";
import type { SessionTemplate } from "./types";

const STORAGE_KEY = "pt.sessionTemplates.v1";

let cachedRaw: string | null | undefined;
let cachedList: SessionTemplate[] = [];
const listeners = new Set<() => void>();

function readAll(): SessionTemplate[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // storage unavailable (e.g. private mode) — treat as empty
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      cachedList = Array.isArray(parsed) ? parsed : [];
    } catch {
      cachedList = [];
    }
  }
  return cachedList;
}

function writeAll(list: SessionTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); // throws if storage is full
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** All saved templates, or null while the page is still loading. */
export function useSessionTemplates(): SessionTemplate[] | null {
  return useSyncExternalStore<SessionTemplate[] | null>(subscribe, readAll, () => null);
}

export function saveSessionTemplate(template: SessionTemplate) {
  const list = readAll();
  const exists = list.some((t) => t.id === template.id);
  writeAll(exists ? list.map((t) => (t.id === template.id ? template : t)) : [...list, template]);
}

export function deleteSessionTemplate(id: string) {
  writeAll(readAll().filter((t) => t.id !== id));
}
