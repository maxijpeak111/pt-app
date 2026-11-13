"use client";

import { DurationField, NumberField, inputClass } from "@/components/ui/fields";
import { newExercise } from "@/lib/sessions/defaults";
import type { Exercise, ExerciseKind, SessionType } from "@/lib/sessions/types";

const KINDS: { kind: ExerciseKind; label: string }[] = [
  { kind: "strength", label: "Strength" },
  { kind: "cardio", label: "Cardio" },
];

export default function ExerciseCard({
  exercise,
  sessionType,
  onChange,
  onRemove,
}: {
  exercise: Exercise;
  sessionType: SessionType;
  onChange: (exercise: Exercise) => void;
  onRemove: () => void;
}) {
  function switchKind(kind: ExerciseKind) {
    if (kind === exercise.kind) return;
    onChange({ ...newExercise(kind, sessionType, exercise.name), id: exercise.id });
  }

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex gap-2">
        <input
          value={exercise.name}
          onChange={(e) => onChange({ ...exercise, name: e.target.value })}
          placeholder="Exercise name"
          aria-label="Exercise name"
          className={`${inputClass} font-semibold`}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${exercise.name || "exercise"}`}
          className="flex size-12 shrink-0 items-center justify-center rounded-md border border-line text-neutral-400 active:border-brand active:text-brand"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex rounded-md border border-line p-1" role="group" aria-label="Exercise type">
        {KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            onClick={() => switchKind(kind)}
            aria-pressed={exercise.kind === kind}
            className={`h-10 flex-1 rounded text-xs font-semibold uppercase tracking-widest ${
              exercise.kind === kind ? "bg-white text-black" : "text-neutral-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* keyed by kind so the boxes reset when switching between strength and cardio */}
      <div key={exercise.kind} className="mt-3 grid grid-cols-3 gap-2">
        {exercise.kind === "strength" ? (
          <>
            <NumberField label="Sets" value={exercise.sets} onChange={(sets) => onChange({ ...exercise, sets })} placeholder="3" />
            <NumberField label="Reps" value={exercise.reps} onChange={(reps) => onChange({ ...exercise, reps })} placeholder="10" />
            <NumberField label="Kg" decimal value={exercise.weight} onChange={(weight) => onChange({ ...exercise, weight })} placeholder="60" />
          </>
        ) : (
          <>
            <NumberField
              label={exercise.distanceUnit === "m" ? "Metres" : "Km"}
              decimal={exercise.distanceUnit === "km"}
              value={exercise.distance}
              onChange={(distance) => onChange({ ...exercise, distance })}
              placeholder={exercise.distanceUnit === "m" ? "1500" : "8"}
            />
            <DurationField
              label={exercise.distanceUnit === "m" ? "Pace /100m" : "Pace /km"}
              value={exercise.pace}
              onChange={(pace) => onChange({ ...exercise, pace })}
              placeholder={exercise.distanceUnit === "m" ? "2:00" : "5:30"}
            />
            <DurationField label="Time" value={exercise.time} onChange={(time) => onChange({ ...exercise, time })} placeholder="45:00" />
          </>
        )}
      </div>
    </div>
  );
}
