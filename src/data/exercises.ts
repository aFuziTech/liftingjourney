import { auth } from "@clerk/nextjs/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";

/**
 * The current user's exercise catalog, in alphabetical order. Always scoped to
 * the authenticated user — see `docs/data-fetching.md`.
 */
export async function getExercises() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db.query.exercises.findMany({
    where: eq(schema.exercises.userId, userId),
    orderBy: asc(schema.exercises.name),
  });
}

/** A single exercise from the catalog, as returned above. */
export type Exercise = Awaited<ReturnType<typeof getExercises>>[number];
