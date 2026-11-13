"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ExerciseCard from "@/components/sessions/ExerciseCard";
import { inputClass } from "@/components/ui/fields";
import { defaultExerciseKind, newExercise, newSessionTemplate } from "@/lib/sessions/defaults";
import { deleteSessionTemplate, saveSessionTemplate, useSessionTemplates } from "@/lib/sessions/storage";
import { SESSION_TYPES, SESSION_TYPE_LABELS, type Exercise, type SessionTemplate } from "@/lib/sessions/types";

/** Loads the session (or starts a new one), then shows the form. */
export default function SessionEditor({ id }: { id?: string }) {
  const templates = useSessionTemplates();

  // null until the page is running on the device, so the form only ever renders there
  if (templates === null) return <p className="text-neutral-500">Loading…</p>;

  if (!id) return <SessionForm initial={null} />;

  const existing = templates.find((t) => t.id === id);
  if (!existing) {
    return (
      <div className="space-y-4">
        <p className="text-neutral-300">This session doesn’t exist on this device.</p>
        <Link href="/sessions" className="font-semibold uppercase tracking-widest text-brand">
          ← Back to sessions
        </Link>
      </div>
    );
  }
  return <SessionForm key={existing.id} initial={existing} />;
}

function SessionForm({ initial: existing }: { initial: SessionTemplate | null }) {
  const router = useRouter();
  const isNew = existing === null;
  const [initial] = useState(() => existing ?? newSessionTemplate());
  const [name, setName] = useState(initial.name);
  const [type, setType] = useState(initial.type);
  const [exercises, setExercises] = useState<Exercise[]>(initial.exercises);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The "tap again to delete" state wears off after a few seconds.
  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  function updateExercise(updated: Exercise) {
    setExercises((list) => list.map((e) => (e.id === updated.id ? updated : e)));
  }

  function save() {
    if (!name.trim()) return setError("Give the session a name.");
    if (exercises.some((e) => !e.name.trim())) return setError("Give every exercise a name, or remove it.");
    try {
      saveSessionTemplate({
        ...initial,
        name: name.trim(),
        type,
        exercises: exercises.map((e) => ({ ...e, name: e.name.trim() })),
        updatedAt: new Date().toISOString(),
      });
      router.push("/sessions");
    } catch {
      setError("Couldn’t save. Your phone’s storage may be full.");
    }
  }

  function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    deleteSessionTemplate(initial.id);
    router.push("/sessions");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {/* Top bar stays visible while scrolling */}
      <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-5 -mt-6 mb-6 flex items-center justify-between border-b border-line bg-ink/95 px-5 py-2 backdrop-blur">
        <Link href="/sessions" className="flex h-12 items-center pr-4 text-sm font-semibold uppercase tracking-widest text-neutral-400">
          Cancel
        </Link>
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
          {isNew ? "New session" : "Edit session"}
        </span>
        <button type="submit" className="h-12 rounded-md bg-brand px-5 text-sm font-bold uppercase tracking-widest active:bg-red-700">
          Save
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-brand bg-brand/10 p-3 text-sm text-white">
          {error}
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.3em] text-brand">Session name</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Chest, Tempo run"
          className={`${inputClass} h-14 text-lg font-bold`}
        />
      </label>

      <fieldset className="mt-6">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-brand">Type</legend>
        <div className="grid grid-cols-3 gap-2">
          {SESSION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={`h-12 rounded-md border text-sm font-semibold uppercase tracking-widest ${
                type === t ? "border-brand bg-brand text-white" : "border-line bg-panel text-neutral-300"
              }`}
            >
              {SESSION_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </fieldset>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-brand">
          Exercises <span className="text-neutral-500">({exercises.length})</span>
        </h2>
        <div className="space-y-3">
          {exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              sessionType={type}
              onChange={(e) => {
                updateExercise(e);
                setError(null);
              }}
              onRemove={() => setExercises((list) => list.filter((e) => e.id !== exercise.id))}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExercises((list) => [...list, newExercise(defaultExerciseKind(type), type)])}
          className="mt-3 h-14 w-full rounded-lg border border-dashed border-neutral-600 text-sm font-semibold uppercase tracking-widest text-white active:border-brand"
        >
          + Add exercise
        </button>
      </section>

      {!isNew && (
        <button
          type="button"
          onClick={remove}
          className={`mt-12 h-14 w-full rounded-lg border text-sm font-semibold uppercase tracking-widest ${
            confirmDelete ? "border-brand bg-brand text-white" : "border-line text-brand"
          }`}
        >
          {confirmDelete ? "Tap again to delete" : "Delete session"}
        </button>
      )}
    </form>
  );
}
