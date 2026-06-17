"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export interface SetState {
  key: string;
  weight: string;
  reps: string;
  rpe: string;
  /** Per-set rest in seconds; used when the exercise's restMode is "set". */
  rest: string;
  isWarmup: boolean;
}

export interface ExerciseSetProps {
  /** The set being edited. */
  set: SetState;
  /** Zero-based position of the set within its exercise. */
  index: number;
  /** Whether the per-set rest column is shown (exercise rest mode is "set"). */
  restPerSet: boolean;
  /** Grid template classes, shared with the sets header row. */
  gridCols: string;
  /** False when this is the only set, disabling removal. */
  canRemove: boolean;
  /** Patch this set's state. */
  onUpdate: (patch: Partial<SetState>) => void;
  /** Remove this set. */
  onRemove: () => void;
}

/**
 * A single editable set row — weight, reps, RPE, optional per-set rest, warmup,
 * and a remove button. Rendered once per set by `WorkoutForm`.
 */
export function ExerciseSet({
  set,
  index,
  restPerSet,
  gridCols,
  canRemove,
  onUpdate,
  onRemove,
}: ExerciseSetProps) {
  return (
    <div className={`grid ${gridCols} items-center gap-2`}>
      <span className="text-sm tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <Input
        type="number"
        inputMode="decimal"
        step="0.5"
        min="0"
        value={set.weight}
        onChange={(e) => onUpdate({ weight: e.target.value })}
      />
      <Input
        type="number"
        inputMode="numeric"
        min="0"
        value={set.reps}
        onChange={(e) => onUpdate({ reps: e.target.value })}
      />
      <Input
        type="number"
        inputMode="numeric"
        min="1"
        max="10"
        value={set.rpe}
        onChange={(e) => onUpdate({ rpe: e.target.value })}
      />
      {restPerSet && (
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          aria-label={`Rest after set ${index + 1} in seconds`}
          value={set.rest}
          onChange={(e) => onUpdate({ rest: e.target.value })}
        />
      )}
      <div className="flex justify-center">
        <Checkbox
          checked={set.isWarmup}
          onCheckedChange={(checked) => onUpdate({ isWarmup: checked === true })}
          aria-label="Warmup set"
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Remove set"
        disabled={!canRemove}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
