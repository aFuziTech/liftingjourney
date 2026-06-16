"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createWorkoutWithExercises } from "@/data";

const setSchema = z.object({
  weight: z.number().min(0).max(99999).nullish(),
  reps: z.number().int().min(0).max(10000).nullish(),
  rpe: z.number().int().min(1).max(10).nullish(),
  restSeconds: z.number().int().min(0).max(32767).nullish(),
  isWarmup: z.boolean().default(false),
});

const exerciseSchema = z
  .object({
    exerciseId: z.string().uuid().optional(),
    newName: z.string().trim().min(1).max(255).optional(),
    notes: z.string().max(2000).nullish(),
    sets: z.array(setSchema),
  })
  .refine((e) => Boolean(e.exerciseId) || Boolean(e.newName), {
    message: "Each exercise needs a catalog selection or a new name",
  });

const createWorkoutSchema = z.object({
  name: z.string().trim().max(255).optional(),
  performedAt: z.coerce.date(),
  notes: z.string().max(2000).optional(),
  exercises: z.array(exerciseSchema).min(1, "Add at least one exercise"),
});

// The action's param type IS the schema — they cannot drift.
export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;

export async function createWorkoutAction(input: CreateWorkoutInput) {
  const data = createWorkoutSchema.parse(input); // validate first — throws on bad input

  await createWorkoutWithExercises(data);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
