import { newId } from "@/lib/id";
import type { Exercise, ExerciseKind, SessionTemplate, SessionType } from "./types";

// Runs and swims start with cardio exercises; everything else starts with strength.
export function defaultExerciseKind(type: SessionType): ExerciseKind {
  return type === "run" || type === "swim" ? "cardio" : "strength";
}

export function newExercise(kind: ExerciseKind, sessionType: SessionType, name = ""): Exercise {
  if (kind === "strength") {
    return { id: newId(), kind, name, sets: null, reps: null, weight: null };
  }
  return {
    id: newId(),
    kind,
    name,
    distance: null,
    distanceUnit: sessionType === "swim" ? "m" : "km",
    pace: null,
    time: null,
  };
}

export function newSessionTemplate(): SessionTemplate {
  const now = new Date().toISOString();
  return { id: newId(), name: "", type: "strength", exercises: [], createdAt: now, updatedAt: now };
}
