import { auth } from "@clerk/nextjs/server";
import { endOfDay, startOfDay } from "date-fns";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";

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

/**
 * A single workout owned by the current user, with its exercises and sets in
 * display order. Returns `undefined` when the id does not belong to the
 * authenticated user. Always scoped to the user — see `docs/data-fetching.md`.
 */
export async function getWorkoutById(workoutId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db.query.workouts.findFirst({
    // userId in the where ensures another user's workoutId returns nothing.
    where: and(
      eq(schema.workouts.id, workoutId),
      eq(schema.workouts.userId, userId),
    ),
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

/** A single set within a new workout exercise. */
export interface CreateSetInput {
  weight?: number | null;
  reps?: number | null;
  rpe?: number | null;
  restSeconds?: number | null;
  isWarmup: boolean;
}

/**
 * One exercise in a new workout. Either {@link exerciseId} (a catalog pick) or
 * {@link newName} (created on the fly) must be provided.
 */
export interface CreateWorkoutExerciseInput {
  exerciseId?: string;
  newName?: string;
  notes?: string | null;
  sets: CreateSetInput[];
}

/** Payload for {@link createWorkoutWithExercises}. */
export interface CreateWorkoutWithExercisesInput {
  name?: string | null;
  performedAt: Date;
  notes?: string | null;
  exercises: CreateWorkoutExerciseInput[];
}

/** Payload for {@link updateWorkoutWithExercises}. */
export type UpdateWorkoutWithExercisesInput = CreateWorkoutWithExercisesInput;

/** True when a set carries no logged data and should not be persisted. */
function isEmptySet(set: CreateSetInput): boolean {
  return (
    set.weight == null && set.reps == null && set.rpe == null && !set.isWarmup
  );
}

/**
 * Resolve every exercise on a workout payload to a catalog id for `userId`.
 * Verifies ownership of supplied ids and upserts any newly typed names into
 * the user's catalog, returning a function that maps an exercise to its id.
 * Shared by {@link createWorkoutWithExercises} and
 * {@link updateWorkoutWithExercises}.
 */
async function buildExerciseResolver(
  userId: string,
  exercises: CreateWorkoutExerciseInput[],
): Promise<(e: CreateWorkoutExerciseInput) => string> {
  // Verify every catalog pick actually belongs to this user.
  const suppliedIds = [
    ...new Set(
      exercises
        .map((e) => e.exerciseId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (suppliedIds.length > 0) {
    const owned = await db.query.exercises.findMany({
      where: and(
        eq(schema.exercises.userId, userId),
        inArray(schema.exercises.id, suppliedIds),
      ),
      columns: { id: true },
    });
    const ownedIds = new Set(owned.map((e) => e.id));
    for (const id of suppliedIds) {
      if (!ownedIds.has(id)) throw new Error("Exercise not found");
    }
  }

  // Upsert any newly typed exercise names and map them back to their ids.
  const newNames = [
    ...new Set(
      exercises
        .filter((e) => !e.exerciseId && e.newName)
        .map((e) => e.newName!.trim())
        .filter(Boolean),
    ),
  ];
  const nameToId = new Map<string, string>();
  if (newNames.length > 0) {
    const rows = await db
      .insert(schema.exercises)
      .values(newNames.map((name) => ({ userId, name })))
      .onConflictDoUpdate({
        target: [schema.exercises.userId, schema.exercises.name],
        set: { name: sql`excluded.name` },
      })
      .returning({ id: schema.exercises.id, name: schema.exercises.name });
    for (const row of rows) nameToId.set(row.name, row.id);
  }

  return (e) => {
    if (e.exerciseId) return e.exerciseId;
    const id = nameToId.get(e.newName!.trim());
    if (!id) throw new Error("Could not resolve exercise");
    return id;
  };
}

/**
 * Create a workout together with its exercises and sets for the current user.
 * Catalog exercises are referenced by id (ownership verified); newly typed
 * names are upserted into the user's catalog. All writes are scoped to the
 * authenticated user — see `docs/data-mutations.md`.
 *
 * Note: the `neon-http` driver does not support interactive transactions, so
 * these dependent writes run sequentially rather than atomically.
 */
export async function createWorkoutWithExercises(
  input: CreateWorkoutWithExercisesInput,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Make sure a mirror row exists before we reference it as a foreign key.
  await db.insert(schema.users).values({ id: userId }).onConflictDoNothing();

  const resolveExerciseId = await buildExerciseResolver(userId, input.exercises);

  // Insert the workout, then its exercises, then its sets. Ids are generated
  // up front so children can reference parents without extra round-trips.
  const workoutId = crypto.randomUUID();
  await db.insert(schema.workouts).values({
    id: workoutId,
    userId,
    name: input.name ?? null,
    performedAt: input.performedAt,
    notes: input.notes ?? null,
  });

  const workoutExerciseRows = input.exercises.map((e, index) => ({
    id: crypto.randomUUID(),
    workoutId,
    exerciseId: resolveExerciseId(e),
    order: index,
    notes: e.notes ?? null,
  }));
  if (workoutExerciseRows.length > 0) {
    await db.insert(schema.workoutExercises).values(workoutExerciseRows);
  }

  const setRows = workoutExerciseRows.flatMap((we, index) => {
    let order = 0;
    return input.exercises[index].sets
      .filter((set) => !isEmptySet(set))
      .map((set) => ({
        workoutExerciseId: we.id,
        order: order++,
        weight: set.weight ?? null,
        reps: set.reps ?? null,
        rpe: set.rpe ?? null,
        restSeconds: set.restSeconds ?? null,
        isWarmup: set.isWarmup,
      }));
  });
  if (setRows.length > 0) {
    await db.insert(schema.sets).values(setRows);
  }

  return { id: workoutId };
}

/**
 * Update an existing workout (owned by the current user) along with its
 * exercises and sets. The workout's exercises and sets are fully replaced with
 * the supplied payload — existing `workout_exercises` are deleted (cascading to
 * their `sets`) and re-inserted. All writes are scoped to the authenticated
 * user — see `docs/data-mutations.md`.
 *
 * Note: the `neon-http` driver does not support interactive transactions, so
 * these dependent writes run sequentially rather than atomically.
 */
export async function updateWorkoutWithExercises(
  workoutId: string,
  input: UpdateWorkoutWithExercisesInput,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Confirm the workout belongs to the user before touching anything below it.
  const existing = await db.query.workouts.findFirst({
    where: and(
      eq(schema.workouts.id, workoutId),
      eq(schema.workouts.userId, userId),
    ),
    columns: { id: true },
  });
  if (!existing) throw new Error("Workout not found");

  const resolveExerciseId = await buildExerciseResolver(userId, input.exercises);

  await db
    .update(schema.workouts)
    .set({
      name: input.name ?? null,
      performedAt: input.performedAt,
      notes: input.notes ?? null,
    })
    .where(
      and(
        eq(schema.workouts.id, workoutId),
        eq(schema.workouts.userId, userId),
      ),
    );

  // Replace the children. Deleting the join rows cascades to their sets; the
  // workout is already verified as owned, so scoping by workoutId is safe.
  await db
    .delete(schema.workoutExercises)
    .where(eq(schema.workoutExercises.workoutId, workoutId));

  const workoutExerciseRows = input.exercises.map((e, index) => ({
    id: crypto.randomUUID(),
    workoutId,
    exerciseId: resolveExerciseId(e),
    order: index,
    notes: e.notes ?? null,
  }));
  if (workoutExerciseRows.length > 0) {
    await db.insert(schema.workoutExercises).values(workoutExerciseRows);
  }

  const setRows = workoutExerciseRows.flatMap((we, index) => {
    let order = 0;
    return input.exercises[index].sets
      .filter((set) => !isEmptySet(set))
      .map((set) => ({
        workoutExerciseId: we.id,
        order: order++,
        weight: set.weight ?? null,
        reps: set.reps ?? null,
        rpe: set.rpe ?? null,
        restSeconds: set.restSeconds ?? null,
        isWarmup: set.isWarmup,
      }));
  });
  if (setRows.length > 0) {
    await db.insert(schema.sets).values(setRows);
  }

  return { id: workoutId };
}
