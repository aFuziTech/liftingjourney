import { auth } from "@clerk/nextjs/server";
import { endOfDay, startOfDay } from "date-fns";
import { and, asc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";

/**
 * Workouts performed by the current user on the given calendar day, with their
 * exercises and sets loaded in display order. Always scoped to the
 * authenticated user — see `docs/data-fetching.md`.
 */
export async function getWorkoutsByDate(date: Date) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db.query.workouts.findMany({
    where: and(
      eq(schema.workouts.userId, userId),
      gte(schema.workouts.performedAt, startOfDay(date)),
      lte(schema.workouts.performedAt, endOfDay(date)),
    ),
    orderBy: asc(schema.workouts.performedAt),
    with: {
      workoutExercises: {
        orderBy: asc(schema.workoutExercises.order),
        with: {
          exercise: true,
          sets: { orderBy: asc(schema.sets.order) },
        },
      },
    },
  });
}

/** A single workout with its nested exercises and sets, as returned above. */
export type WorkoutWithExercises = Awaited<
  ReturnType<typeof getWorkoutsByDate>
>[number];
