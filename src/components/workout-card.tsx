import { Dumbbell, Clock, StickyNote } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/helpers";
import { cn } from "@/lib/utils";

/** A single set within a workout exercise (UI view shape). */
export interface WorkoutSetView {
  id: string;
  weight?: number | null;
  reps?: number | null;
  isWarmup?: boolean;
}

/** An exercise performed within a workout (UI view shape). */
export interface WorkoutExerciseView {
  id: string;
  name: string;
  sets: WorkoutSetView[];
}

/** A workout session as displayed on the dashboard (UI view shape). */
export interface WorkoutView {
  id: string;
  name?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  notes?: string | null;
  exercises: WorkoutExerciseView[];
}

function setSummary(set: WorkoutSetView): string {
  if (set.weight != null && set.reps != null) {
    return `${set.weight} kg × ${set.reps}`;
  }
  if (set.reps != null) return `${set.reps} reps`;
  if (set.weight != null) return `${set.weight} kg`;
  return "—";
}

export interface WorkoutCardProps {
  workout: WorkoutView;
  className?: string;
}

/**
 * Summarises a single workout session — its name, time window, and the
 * exercises and sets performed. Composed from shadcn `Card` + `Badge`.
 */
export function WorkoutCard({ workout, className }: WorkoutCardProps) {
  const { name, startedAt, completedAt, notes, exercises } = workout;
  const setCount = exercises.reduce((acc, e) => acc + e.sets.length, 0);

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{name ?? "Workout"}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {startedAt && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {formatTime(startedAt)}
              {completedAt && ` – ${formatTime(completedAt)}`}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Dumbbell className="size-3.5" />
            {exercises.length} exercise{exercises.length === 1 ? "" : "s"} ·{" "}
            {setCount} set{setCount === 1 ? "" : "s"}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {exercises.map((exercise) => (
          <div key={exercise.id} className="flex flex-col gap-2">
            <p className="text-sm font-medium">{exercise.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {exercise.sets.map((set) => (
                <Badge
                  key={set.id}
                  variant={set.isWarmup ? "outline" : "secondary"}
                  className="font-normal tabular-nums"
                >
                  {setSummary(set)}
                </Badge>
              ))}
            </div>
          </div>
        ))}

        {notes && (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <StickyNote className="mt-0.5 size-3.5 shrink-0" />
            {notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
