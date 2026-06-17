"use client";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

/** How rest between sets is entered for an exercise. */
export type RestMode = "exercise" | "set";

export interface ExerciseRestProps {
  /** Current rest mode for the exercise. */
  restMode: RestMode;
  /** Shared rest in seconds; shown only in "exercise" mode. */
  exerciseRest: string;
  /** Patch the rest-related fields on the parent exercise. */
  onUpdate: (patch: { restMode?: RestMode; exerciseRest?: string }) => void;
}

/**
 * Rest controls for a single exercise: a toggle between one shared rest value
 * ("Per exercise") and per-set rest ("Per set"), plus the shared rest input
 * shown in "Per exercise" mode. Used by `WorkoutForm`.
 */
export function ExerciseRest({
  restMode,
  exerciseRest,
  onUpdate,
}: ExerciseRestProps) {
  const restPerSet = restMode === "set";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-muted-foreground">Rest</span>
      <div className="inline-flex rounded-lg border p-0.5">
        <Button
          type="button"
          variant={restPerSet ? "ghost" : "secondary"}
          size="sm"
          onClick={() => onUpdate({ restMode: "exercise" })}
        >
          Per exercise
        </Button>
        <Button
          type="button"
          variant={restPerSet ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onUpdate({ restMode: "set" })}
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
            value={exerciseRest}
            onChange={(e) => onUpdate({ exerciseRest: e.target.value })}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>sec</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      )}
    </div>
  );
}
