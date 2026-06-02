/**
 * One-off seed: workouts for a single user on 1 & 2 June 2026.
 * Run with: npx tsx scripts/seed-workouts.ts
 *
 * Re-runnable: it clears any existing workouts for the user within those two
 * days before inserting, so running it twice won't create duplicates.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { endOfDay, startOfDay } from "date-fns";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../src/db/schema";

const db = drizzle(process.env.DATABASE_URL!, { schema });

const USER_ID = "user_3EZAI1pLqyYlsabWssxXXQtmyIO";

type SetDef = {
  weight?: number;
  reps?: number;
  rpe?: number;
  restSeconds?: number;
  isWarmup?: boolean;
};
type ExerciseDef = { name: string; sets: SetDef[] };
type WorkoutDef = {
  name: string;
  performedAt: Date;
  startedAt: Date;
  completedAt: Date;
  notes?: string;
  exercises: ExerciseDef[];
};

// Dates are constructed in local time so they line up with how the dashboard
// resolves the `?date=` param (startOfDay..endOfDay in server-local time).
const WORKOUTS: WorkoutDef[] = [
  {
    name: "Pull Day",
    performedAt: new Date(2026, 5, 1, 17, 0),
    startedAt: new Date(2026, 5, 1, 17, 0),
    completedAt: new Date(2026, 5, 1, 18, 20),
    notes: "Deadlifts felt heavy, grip gave out before the legs did.",
    exercises: [
      {
        name: "Deadlift",
        sets: [
          { weight: 60, reps: 8, isWarmup: true, restSeconds: 90 },
          { weight: 100, reps: 5, rpe: 7, restSeconds: 150 },
          { weight: 120, reps: 3, rpe: 8, restSeconds: 180 },
          { weight: 140, reps: 2, rpe: 9, restSeconds: 180 },
        ],
      },
      {
        name: "Barbell Row",
        sets: [
          { weight: 70, reps: 10, rpe: 7, restSeconds: 90 },
          { weight: 70, reps: 10, rpe: 8, restSeconds: 90 },
          { weight: 75, reps: 8, rpe: 8, restSeconds: 90 },
        ],
      },
      {
        name: "Lat Pulldown",
        sets: [
          { weight: 55, reps: 12, rpe: 7, restSeconds: 60 },
          { weight: 55, reps: 11, rpe: 8, restSeconds: 60 },
          { weight: 50, reps: 12, rpe: 8, restSeconds: 60 },
        ],
      },
    ],
  },
  {
    name: "Push Day",
    performedAt: new Date(2026, 5, 2, 18, 30),
    startedAt: new Date(2026, 5, 2, 18, 30),
    completedAt: new Date(2026, 5, 2, 19, 45),
    notes: "Felt strong on bench, slight shoulder tightness on the last set.",
    exercises: [
      {
        name: "Bench Press",
        sets: [
          { weight: 60, reps: 10, isWarmup: true, restSeconds: 90 },
          { weight: 80, reps: 8, rpe: 7, restSeconds: 120 },
          { weight: 80, reps: 8, rpe: 8, restSeconds: 120 },
          { weight: 85, reps: 6, rpe: 9, restSeconds: 150 },
        ],
      },
      {
        name: "Overhead Press",
        sets: [
          { weight: 40, reps: 10, rpe: 7, restSeconds: 90 },
          { weight: 40, reps: 9, rpe: 8, restSeconds: 90 },
        ],
      },
      {
        name: "Tricep Pushdown",
        sets: [
          { weight: 30, reps: 15, rpe: 7, restSeconds: 60 },
          { weight: 30, reps: 13, rpe: 8, restSeconds: 60 },
          { weight: 27.5, reps: 14, rpe: 8, restSeconds: 60 },
        ],
      },
    ],
  },
  {
    name: "Core Finisher",
    performedAt: new Date(2026, 5, 2, 19, 50),
    startedAt: new Date(2026, 5, 2, 19, 50),
    completedAt: new Date(2026, 5, 2, 20, 5),
    exercises: [
      {
        name: "Hanging Leg Raise",
        sets: [
          { reps: 15, rpe: 7, restSeconds: 60 },
          { reps: 12, rpe: 8, restSeconds: 60 },
        ],
      },
      {
        name: "Cable Crunch",
        sets: [
          { weight: 45, reps: 15, rpe: 7, restSeconds: 45 },
          { weight: 45, reps: 13, rpe: 8, restSeconds: 45 },
        ],
      },
    ],
  },
];

async function main() {
  // 1. Ensure the user row exists (lightweight Clerk mirror).
  await db
    .insert(schema.users)
    .values({ id: USER_ID })
    .onConflictDoNothing();

  // 2. Ensure every referenced exercise exists for this user, then map name -> id.
  const exerciseNames = [
    ...new Set(WORKOUTS.flatMap((w) => w.exercises.map((e) => e.name))),
  ];
  await db
    .insert(schema.exercises)
    .values(exerciseNames.map((name) => ({ userId: USER_ID, name })))
    .onConflictDoNothing();

  const exerciseRows = await db.query.exercises.findMany({
    where: and(
      eq(schema.exercises.userId, USER_ID),
      inArray(schema.exercises.name, exerciseNames),
    ),
  });
  const exerciseIdByName = new Map(exerciseRows.map((e) => [e.name, e.id]));

  // 3. Clear any existing workouts for the user across the two seeded days so
  //    this script is idempotent (sets/workout_exercises cascade on delete).
  const rangeStart = startOfDay(new Date(2026, 5, 1));
  const rangeEnd = endOfDay(new Date(2026, 5, 2));
  const deleted = await db
    .delete(schema.workouts)
    .where(
      and(
        eq(schema.workouts.userId, USER_ID),
        gte(schema.workouts.performedAt, rangeStart),
        lte(schema.workouts.performedAt, rangeEnd),
      ),
    )
    .returning({ id: schema.workouts.id });
  if (deleted.length > 0) {
    console.log(`Cleared ${deleted.length} existing workout(s) in range.`);
  }

  // 4. Insert workouts -> workout_exercises -> sets.
  for (const w of WORKOUTS) {
    const [workout] = await db
      .insert(schema.workouts)
      .values({
        userId: USER_ID,
        name: w.name,
        performedAt: w.performedAt,
        startedAt: w.startedAt,
        completedAt: w.completedAt,
        notes: w.notes ?? null,
      })
      .returning({ id: schema.workouts.id });

    for (const [exIndex, ex] of w.exercises.entries()) {
      const exerciseId = exerciseIdByName.get(ex.name);
      if (!exerciseId) throw new Error(`Missing exercise id for "${ex.name}"`);

      const [workoutExercise] = await db
        .insert(schema.workoutExercises)
        .values({
          workoutId: workout.id,
          exerciseId,
          order: exIndex,
        })
        .returning({ id: schema.workoutExercises.id });

      await db.insert(schema.sets).values(
        ex.sets.map((set, setIndex) => ({
          workoutExerciseId: workoutExercise.id,
          order: setIndex,
          weight: set.weight ?? null,
          reps: set.reps ?? null,
          rpe: set.rpe ?? null,
          restSeconds: set.restSeconds ?? null,
          isWarmup: set.isWarmup ?? false,
        })),
      );
    }

    console.log(
      `Seeded "${w.name}" (${w.exercises.length} exercises) on ${w.performedAt.toDateString()}.`,
    );
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
