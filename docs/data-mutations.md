# Data Mutation Standards

This document defines how data is **written** to the database in **liftingjourney** — every insert, update, and delete. It is the write-side counterpart to [`data-fetching.md`](./data-fetching.md), and the goal is the same: a single, predictable, and **secure** path. Every mutation is triggered by a Server Action, validates its input with zod, and performs the actual write through one set of helpers that are always scoped to the authenticated user. These rules are not optional — they are what keep one user from ever creating, editing, or deleting another user's data.

## 1. All mutations go through a Server Action in a colocated `actions.ts`

**Every write MUST be triggered by a Server Action**, and those actions **MUST live in a file named `actions.ts`** colocated in the route segment that uses them (e.g. `src/app/dashboard/actions.ts`). The file opens with the `"use server"` directive so every export becomes a server-only action.

Writes **MUST NOT** be performed via:

- **Route handlers** (`app/**/route.ts`) — do not build a `POST`/`PUT`/`DELETE` endpoint to mutate data;
- **Client Components** — no client-side `fetch` to a mutation endpoint, no writing from `useEffect`;
- **Inline server functions** scattered across components, or any other ad-hoc mechanism.

```ts
// src/app/dashboard/actions.ts
"use server";

import { createWorkout } from "@/data";

export async function createWorkoutAction(input: CreateWorkoutInput) {
  // validate → mutate → revalidate (see §2, §5, §6)
  return createWorkout(input);
}
```

**Why this rule exists**

- A Server Action is the one authorized entry point for a write, so there is no public mutation endpoint to forge requests against.
- Colocating the action with the route keeps the write next to the page and components that call it — easy to find, easy to review.
- Client Components stay presentational: they call the action and pass already-typed data; they never touch the database.

## 2. The actual write lives in a `src/data/` helper

**A Server Action MUST NOT call `db` directly.** The Drizzle write **MUST** be a helper function inside `src/data/`, alongside the existing query helpers. The action's job is to validate input (§5) and orchestrate; the helper's job is to derive identity and perform the write.

Conventions (mirroring the query helpers in `data-fetching.md`):

- Group helpers by domain, one file per table/aggregate (`src/data/workouts.ts`, `src/data/exercises.ts`).
- Functions are `async`, named with a clear verb (`createWorkout`, `updateWorkout`, `deleteWorkout`, `addSetToWorkout`).
- Re-export every helper from the `src/data/index.ts` barrel and import via `@/data`.
- **Derive `userId` from `await auth()` inside the helper** — never accept it as an argument — and throw when there is no session. This is the same rule as `data-fetching.md` §4, so authorization lives in exactly one place for both reads and writes.

```ts
// src/data/workouts.ts
import { auth } from "@clerk/nextjs/server";

import { db } from "@/db";
import * as schema from "@/db/schema";

export async function createWorkout(input: CreateWorkoutInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [workout] = await db
    .insert(schema.workouts)
    .values({ ...input, userId }) // userId comes from the session, never the caller
    .returning();

  return workout;
}
```

```ts
// src/data/index.ts
export * from "./workouts";
export * from "./exercises";
```

**Why this rule exists**

- One place owns every write to a table, so the ownership check cannot be forgotten in one action and remembered in another.
- The action layer stays thin and focused on validation and the request lifecycle; the data layer stays focused on the database.

## 3. Use Drizzle for writes — never raw SQL

**All mutations MUST use the Drizzle write API** — `db.insert()`, `db.update()`, `db.delete()`, with `.returning()` when you need the written row. Do **not** write raw SQL, and do **not** use the `sql` template tag to assemble mutations.

```ts
// ✅ Drizzle update, scoped to the owner
await db
  .update(schema.workouts)
  .set({ name, notes })
  .where(
    and(eq(schema.workouts.id, id), eq(schema.workouts.userId, userId)),
  );

// ❌ Raw SQL — forbidden
await db.execute(
  sql`UPDATE workouts SET name = ${name} WHERE id = ${id}`,
);
```

Rules that keep writes scoped:

- **Set `userId` on insert** from the session — `.values({ ...input, userId })` — so every new row is owned by the current user.
- **Constrain every `update` and `delete` with `and(eq(id), eq(userId))`.** A bare `where: eq(id)` would let any user mutate any row by guessing its id.
- **Reach nested rows only through an owned parent.** `workout_exercises` and `sets` have no `userId` of their own (see `src/db/schema.ts`). Before inserting or modifying them, verify the owning `workout` belongs to the current user — load or guard on the workout (scoped by `userId`) first, then write the children.

## 4. Server Action params MUST be typed — and MUST NOT be `FormData`

**Every Server Action MUST accept an explicit, typed input object.** Actions **MUST NOT** take a `FormData` parameter.

```ts
// ✅ Typed input object
export async function createWorkoutAction(input: CreateWorkoutInput) { /* ... */ }

// ❌ FormData — forbidden
export async function createWorkoutAction(formData: FormData) { /* ... */ }
```

The calling component is responsible for building the typed object and passing it to the action — read the form fields, assemble a plain typed object, then call the action with it.

**Why this rule exists**

- Typed params give the action, the helper, and the caller a single shared contract checked by the compiler.
- `FormData` is stringly-typed and opaque (`formData.get("reps")` is `FormDataEntryValue | null`); a typed object makes the action's exact inputs explicit and refactor-safe.

## 5. Every Server Action MUST validate its arguments with zod

**Before doing anything else, a Server Action MUST validate its arguments with a zod schema.** Validation is the **first** step — before `auth()`, before any call into `src/data/`. Define a schema per action (in `actions.ts`, or a colocated `schemas.ts`), and **derive the param type from the schema with `z.infer`** so the type and the validation can never drift apart.

```ts
// src/app/dashboard/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createWorkout } from "@/data";

const createWorkoutSchema = z.object({
  name: z.string().min(1, "Name is required"),
  performedAt: z.coerce.date(),
  notes: z.string().max(2000).optional(),
});

// The action's param type IS the schema — they cannot drift.
export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;

export async function createWorkoutAction(input: CreateWorkoutInput) {
  const data = createWorkoutSchema.parse(input); // validate first — throws on bad input

  const workout = await createWorkout(data);

  revalidatePath("/dashboard");
  return workout;
}
```

Use `parse` to throw on invalid input (let it bubble to an error boundary), or `safeParse` when you want to return field errors to the UI.

**Why this rule exists**

- A Server Action is a network boundary: its input arrives from the client and **cannot be trusted**, even with a typed signature. zod enforces the constraints the types can't (non-empty `name`, positive `reps`, a real `performedAt` date).
- Validation is **not** a substitute for the ownership check. zod guards the _shape and constraints_ of the input; the `userId` scoping in the data helper (§2, §3) is what guards _ownership_. You need both.

## 6. Refresh the cache after a successful write

After the helper returns, the Server Action **MUST refresh any data the write affects** so Server Components re-render with fresh data. Call `revalidatePath(...)` (or `revalidateTag(...)`) for the affected routes, and `redirect(...)` from `next/navigation` when the flow should navigate afterward.

```ts
// src/app/dashboard/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deleteWorkoutAction(input: DeleteWorkoutInput) {
  const { id } = deleteWorkoutSchema.parse(input);

  await deleteWorkout(id);

  revalidatePath("/dashboard"); // dashboard now re-reads without the deleted workout
  redirect("/dashboard");
}
```

The order is always: **validate → mutate → revalidate → (optionally) redirect.** These are server-only APIs and belong in the action, not the data helper — the helper stays a pure database operation.

## Quick reference

```ts
// src/app/dashboard/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createWorkout } from "@/data";

const createWorkoutSchema = z.object({       // a zod schema per action
  name: z.string().min(1),
  performedAt: z.coerce.date(),
  notes: z.string().max(2000).optional(),
});

export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>; // typed param, no FormData

export async function createWorkoutAction(input: CreateWorkoutInput) {
  const data = createWorkoutSchema.parse(input); // validate first
  const workout = await createWorkout(data);      // write via the src/data helper
  revalidatePath("/dashboard");                   // refresh affected Server Components
  return workout;
}
```

```ts
// src/data/workouts.ts
import { auth } from "@clerk/nextjs/server";

import { db } from "@/db";
import * as schema from "@/db/schema";

export async function createWorkout(input: CreateWorkoutInput) {
  const { userId } = await auth();              // identity from the verified session
  if (!userId) throw new Error("Unauthorized");

  const [workout] = await db
    .insert(schema.workouts)                    // Drizzle write, no raw SQL
    .values({ ...input, userId })               // owned by the current user
    .returning();

  return workout;
}
```

| Do                                                          | Don't                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| Trigger writes from a Server Action in a colocated `actions.ts` | Mutate from a route handler, client fetch, or inline        |
| Put the DB write in a `src/data/` helper                    | Call `db.insert/update/delete` from the component or action |
| Type action params explicitly (a typed input object)        | Type the param as `FormData`                                |
| `zod`-validate arguments as the first step in the action    | Trust caller input or validate ad-hoc with `if` checks      |
| Derive `userId` from `await auth()` in the helper           | Accept `userId` as an argument                              |
| Scope `update`/`delete` with `and(eq(id), eq(userId))`      | Mutate a row by id alone                                    |
| `revalidatePath`/`redirect` after a successful write        | Leave Server Components showing stale data                  |
