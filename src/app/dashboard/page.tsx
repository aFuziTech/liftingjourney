import Link from "next/link";
import { isValid, parse } from "date-fns";
import { CalendarX2, Plus } from "lucide-react";

import { getWorkoutsByDate, type WorkoutWithExercises } from "@/data";
import { WorkoutCard, type WorkoutView } from "@/components/workout-card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/helpers";

import { DateFilter } from "./date-filter";

/** Resolve the `?date=YYYY-MM-DD` param to a Date, falling back to today. */
function resolveDate(raw: string | undefined): Date {
  if (raw) {
    const parsed = parse(raw, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) return parsed;
  }
  return new Date();
}

/** Map a persisted workout (with relations) to the card's view shape. */
function toWorkoutView(workout: WorkoutWithExercises): WorkoutView {
  return {
    id: workout.id,
    name: workout.name,
    startedAt: workout.startedAt,
    completedAt: workout.completedAt,
    notes: workout.notes,
    exercises: workout.workoutExercises.map((we) => ({
      id: we.id,
      name: we.exercise.name,
      sets: we.sets.map((set) => ({
        id: set.id,
        weight: set.weight,
        reps: set.reps,
        isWarmup: set.isWarmup,
      })),
    })),
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const selectedDate = resolveDate(date);
  const workouts = (await getWorkoutsByDate(selectedDate)).map(toWorkoutView);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Workouts on {formatDate(selectedDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateFilter value={selectedDate} />
          <Button asChild size="lg">
            <Link href="/dashboard/workout/new">
              <Plus />
              New workout
            </Link>
          </Button>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        {workouts.length > 0 ? (
          workouts.map((workout) => (
            <Link
              key={workout.id}
              href={`/dashboard/workout/${workout.id}`}
              className="block rounded-xl transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <WorkoutCard workout={workout} />
            </Link>
          ))
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <CalendarX2 className="size-8 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">No workouts logged</p>
              <p className="text-sm text-muted-foreground">
                Nothing recorded for {formatDate(selectedDate)}.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
