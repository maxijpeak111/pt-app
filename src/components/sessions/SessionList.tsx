"use client";

import Link from "next/link";
import { useSessionTemplates } from "@/lib/sessions/storage";
import { SESSION_TYPE_LABELS } from "@/lib/sessions/types";

export default function SessionList() {
  const templates = useSessionTemplates();

  return (
    <>
      <Link
        href="/sessions/new"
        className="flex h-14 items-center justify-center rounded-lg bg-brand text-sm font-bold uppercase tracking-widest active:bg-red-700"
      >
        + New session
      </Link>

      {templates === null ? (
        <p className="mt-6 text-neutral-500">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line bg-panel p-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-neutral-400">No sessions yet</p>
          <p className="mt-2 text-neutral-300">Create your first session template, e.g. “Chest” or “Tempo run”.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {[...templates]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((t) => (
              <li key={t.id}>
                <Link
                  href={`/sessions/${t.id}`}
                  className="flex items-center gap-3 rounded-lg border border-line bg-panel p-4 active:border-brand"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brand">
                      {SESSION_TYPE_LABELS[t.type]}
                    </p>
                    <p className="mt-1 truncate text-xl font-bold">{t.name}</p>
                    <p className="mt-1 truncate text-sm text-neutral-400">
                      {t.exercises.length === 0
                        ? "No exercises"
                        : `${t.exercises.length} exercise${t.exercises.length === 1 ? "" : "s"} · ${t.exercises
                            .map((e) => e.name)
                            .join(", ")}`}
                    </p>
                  </div>
                  <span aria-hidden className="text-2xl text-neutral-600">›</span>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </>
  );
}
