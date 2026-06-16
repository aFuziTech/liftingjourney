"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { createWorkoutAction } from "@/app/dashboard/workout/new/actions";
import { DatePicker } from "@/components/_base/date-picker";
import {
  ExerciseCombobox,
  type ExerciseOption,
} from "@/components/exercise-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

/** How rest between sets is entered for an exercise. */
type RestMode = "exercise" | "set";

interface SetState {
  key: string;
  weight: string;
  reps: string;
  rpe: string;
  /** Per-set rest in seconds; used when the exercise's restMode is "set". */
  rest: string;
  isWarmup: boolean;
}

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

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">Rest</span>
              <div className="inline-flex rounded-lg border p-0.5">
                <Button
                  type="button"
                  variant={restPerSet ? "ghost" : "secondary"}
                  size="sm"
                  onClick={() =>
                    updateExercise(exercise.key, { restMode: "exercise" })
                  }
                >
                  Per exercise
                </Button>
                <Button
                  type="button"
                  variant={restPerSet ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() =>
                    updateExercise(exercise.key, { restMode: "set" })
                  }
                >
                  Per set
                </Button>
              </div>
              {!restPerSet && (
                <InputGroup className="w-36">
                  <InputGroupInput
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="Rest"
                    aria-label="Rest between sets in seconds"
                    value={exercise.exerciseRest}
                    onChange={(e) =>
                      updateExercise(exercise.key, {
                        exerciseRest: e.target.value,
                      })
                    }
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>sec</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              )}
            </div>

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
                <div
                  key={set.key}
                  className={`grid ${gridCols} items-center gap-2`}
                >
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {setIndex + 1}
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    value={set.weight}
                    onChange={(e) =>
                      updateSet(exercise.key, set.key, {
                        weight: e.target.value,
                      })
                    }
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={set.reps}
                    onChange={(e) =>
                      updateSet(exercise.key, set.key, { reps: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="10"
                    value={set.rpe}
                    onChange={(e) =>
                      updateSet(exercise.key, set.key, { rpe: e.target.value })
                    }
                  />
                  {restPerSet && (
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      aria-label={`Rest after set ${setIndex + 1} in seconds`}
                      value={set.rest}
                      onChange={(e) =>
                        updateSet(exercise.key, set.key, {
                          rest: e.target.value,
                        })
                      }
                    />
                  )}
                  <div className="flex justify-center">
                    <Checkbox
                      checked={set.isWarmup}
                      onCheckedChange={(checked) =>
                        updateSet(exercise.key, set.key, {
                          isWarmup: checked === true,
                        })
                      }
                      aria-label="Warmup set"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove set"
                    disabled={exercise.sets.length === 1}
                    onClick={() =>
                      updateExercise(exercise.key, {
                        sets: exercise.sets.filter((s) => s.key !== set.key),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
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
