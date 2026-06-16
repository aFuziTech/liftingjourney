import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getExercises } from "@/data";
import { WorkoutForm } from "@/components/workout-form";

export default async function NewWorkoutPage() {
  const exercises = await getExercises();

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
        <h1 className="text-2xl font-semibold tracking-tight">New workout</h1>
        <p className="text-sm text-muted-foreground">
          Log a workout with its exercises and sets.
        </p>
      </div>

      <WorkoutForm
        exercises={exercises.map((e) => ({ id: e.id, name: e.name }))}
      />
    </main>
  );
}
