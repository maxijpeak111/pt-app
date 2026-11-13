// The shape of a session template and its exercises.
// Kept free of personal data so it can later belong to any user (add a userId when going multi-user).

export const SESSION_TYPES = ["strength", "run", "swim", "mma", "other"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  strength: "Strength",
  run: "Run",
  swim: "Swim",
  mma: "MMA",
  other: "Other",
};

export type ExerciseKind = "strength" | "cardio";
export type DistanceUnit = "km" | "m";

export interface StrengthExercise {
  id: string;
  kind: "strength";
  name: string;
  sets: number | null;
  reps: number | null;
  weight: number | null; // kg
}

export interface CardioExercise {
  id: string;
  kind: "cardio";
  name: string;
  distance: number | null; // in distanceUnit
  distanceUnit: DistanceUnit;
  pace: number | null; // seconds per km, or per 100 m when distanceUnit is "m"
  time: number | null; // seconds
}

export type Exercise = StrengthExercise | CardioExercise;

export interface SessionTemplate {
  id: string;
  name: string;
  type: SessionType;
  exercises: Exercise[];
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}
