"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { createWorkoutAction } from "@/app/dashboard/workout/new/actions";
import { DatePicker } from "@/components/_base/date-picker";
import {
  ExerciseCombobox,
  type ExerciseOption,
} from "@/components/exercise-combobox";
import { ExerciseRest, type RestMode } from "@/components/exercise-rest";
import { ExerciseSet, type SetState } from "@/components/exercise-set";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface ExerciseState {
  key: string;
  /** Set when the exercise comes from the catalog. */
  exerciseId?: string;
  /** Display name — a catalog name or a newly typed one. */
  name: string;
  /** True when typed in rather than picked from the catalog. */
  isNew: boolean;
  /** "exercise" — one rest applies to every set; "set" — rest per set. */
  restMode: RestMode;
  /** Shared rest in seconds; used when restMode is "exercise". */
  exerciseRest: string;
  sets: SetState[];
}

function newSet(): SetState {
  return {
    key: crypto.randomUUID(),
    weight: "",
    reps: "",
    rpe: "",
    rest: "",
    isWarmup: false,
  };
}

function newExercise(): ExerciseState {
  return {
    key: crypto.randomUUID(),
    name: "",
    isNew: false,
    restMode: "exercise",
    exerciseRest: "",
    sets: [newSet()],
  };
}

/** Parse an optional numeric input; blank → null, otherwise the number. */
function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface WorkoutFormProps {
  /** The user's exercise catalog, used to populate the picker. */
  exercises: ExerciseOption[];
}

/**
 * Form for logging a new workout with its exercises and sets. Builds a typed
 * payload and hands it to {@link createWorkoutAction}; the action redirects to
 * the dashboard on success. See `docs/data-mutations.md`.
 */
export function WorkoutForm({ exercises }: WorkoutFormProps) {
  const [name, setName] = React.useState("");
  const [performedAt, setPerformedAt] = React.useState<Date>(new Date());
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<ExerciseState[]>([newExercise()]);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function updateExercise(key: string, patch: Partial<ExerciseState>) {
    setItems((prev) =>
      prev.map((e) => (e.key === key ? { ...e, ...patch } : e)),
    );
  }

  function updateSet(
    exerciseKey: string,
    setKey: string,
    patch: Partial<SetState>,
  ) {
    setItems((prev) =>
      prev.map((e) =>
        e.key === exerciseKey
          ? {
              ...e,
              sets: e.sets.map((s) =>
                s.key === setKey ? { ...s, ...patch } : s,
              ),
            }
          : e,
      ),
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const chosen = items.filter((e) => e.name.trim() !== "");
    if (chosen.length === 0) {
      setError("Add at least one exercise.");
      return;
    }

    const payload = {
      name: name.trim() || undefined,
      performedAt,
      notes: notes.trim() || undefined,
      exercises: chosen.map((e) => ({
        exerciseId: e.exerciseId,
        newName: e.exerciseId ? undefined : e.name.trim(),
        sets: e.sets.map((s) => ({
          weight: parseOptionalNumber(s.weight),
          reps: parseOptionalNumber(s.reps),
          rpe: parseOptionalNumber(s.rpe),
          restSeconds:
            e.restMode === "exercise"
              ? parseOptionalNumber(e.exerciseRest)
              : parseOptionalNumber(s.rest),
          isWarmup: s.isWarmup,
        })),
      })),
    };

    startTransition(async () => {
      try {
        await createWorkoutAction(payload);
      } catch (err) {
        // A redirect throws a special error that must propagate to Next.
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          typeof err.digest === "string" &&
          err.digest.startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        setError("Something went wrong saving the workout. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="workout-name">Name</Label>
          <Input
            id="workout-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Push day"
            maxLength={255}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Date</Label>
          <DatePicker
            value={performedAt}
            onChange={(date) => date && setPerformedAt(date)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="workout-notes">Notes</Label>
          <Textarea
            id="workout-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this session"
            maxLength={2000}
          />
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Exercises</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => [...prev, newExercise()])}
          >
            <Plus />
            Add exercise
          </Button>
        </div>

        {items.map((exercise) => {
          const restPerSet = exercise.restMode === "set";
          const gridCols = restPerSet
            ? "grid-cols-[2rem_1fr_1fr_1fr_1fr_auto_2rem]"
            : "grid-cols-[2rem_1fr_1fr_1fr_auto_2rem]";
          return (
          <div
            key={exercise.key}
            className="flex flex-col gap-4 rounded-xl border p-4"
          >
            <div className="flex items-start gap-2">
              <ExerciseCombobox
                exercises={exercises}
                value={exercise.name}
                onSelectExisting={(option) =>
                  updateExercise(exercise.key, {
                    exerciseId: option.id,
                    name: option.name,
                    isNew: false,
                  })
                }
                onCreate={(typed) =>
                  updateExercise(exercise.key, {
                    exerciseId: undefined,
                    name: typed,
                    isNew: true,
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove exercise"
                disabled={items.length === 1}
                onClick={() =>
                  setItems((prev) => prev.filter((e) => e.key !== exercise.key))
                }
              >
                <Trash2 />
              </Button>
            </div>

            <ExerciseRest
              restMode={exercise.restMode}
              exerciseRest={exercise.exerciseRest}
              onUpdate={(patch) => updateExercise(exercise.key, patch)}
            />

            <div className="flex flex-col gap-2">
              <div
                className={`grid ${gridCols} items-center gap-2 text-xs text-muted-foreground`}
              >
                <span>#</span>
                <span>Weight (kg)</span>
                <span>Reps</span>
                <span>RPE</span>
                {restPerSet && <span>Rest (sec)</span>}
                <span>Warmup</span>
                <span className="sr-only">Remove</span>
              </div>

              {exercise.sets.map((set, setIndex) => (
                <ExerciseSet
                  key={set.key}
                  set={set}
                  index={setIndex}
                  restPerSet={restPerSet}
                  gridCols={gridCols}
                  canRemove={exercise.sets.length > 1}
                  onUpdate={(patch) => updateSet(exercise.key, set.key, patch)}
                  onRemove={() =>
                    updateExercise(exercise.key, {
                      sets: exercise.sets.filter((s) => s.key !== set.key),
                    })
                  }
                />
              ))}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() =>
                  updateExercise(exercise.key, {
                    sets: [...exercise.sets, newSet()],
                  })
                }
              >
                <Plus />
                Add set
              </Button>
            </div>
          </div>
          );
        })}
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save workout"}
        </Button>
      </div>
    </form>
  );
}
