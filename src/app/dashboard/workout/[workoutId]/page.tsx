import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getExercises, getWorkoutById } from "@/data";
import { WorkoutForm, type InitialWorkout } from "@/components/workout-form";

export default async function EditWorkoutPage({
  params,
}: {
  params: Promise<{ workoutId: string }>;
}) {
  const { workoutId } = await params;
  const [exercises, workout] = await Promise.all([
    getExercises(),
    getWorkoutById(workoutId),
  ]);

  if (!workout) notFound();

  const initialWorkout: InitialWorkout = {
    id: workout.id,
    name: workout.name,
    performedAt: workout.performedAt,
    notes: workout.notes,
    exercises: workout.workoutExercises.map((we) => ({
      exerciseId: we.exerciseId,
      name: we.exercise.name,
      sets: we.sets.map((set) => ({
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe,
        restSeconds: set.restSeconds,
        isWarmup: set.isWarmup,
      })),
    })),
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit workout</h1>
        <p className="text-sm text-muted-foreground">
          Update this workout&apos;s exercises and sets.
        </p>
      </div>

      <WorkoutForm
        exercises={exercises.map((e) => ({ id: e.id, name: e.name }))}
        workout={initialWorkout}
      />
    </main>
  );
}
