# Data Fetching Standards

This document defines how data is read from the database in **liftingjourney**. The goal is a single, predictable, and **secure** data layer: every query runs on the server, goes through one set of helpers, and is always scoped to the currently authenticated user. These rules are not optional — they are what keep one user's data from ever leaking to another.

## 1. Server Components only

**All data fetching MUST happen in React Server Components.** There are no exceptions.

Data **MUST NOT** be fetched via:

- **Route handlers** (`app/**/route.ts`) — do not build a `GET` endpoint to read data;
- **Client Components** (`"use client"`) — no `fetch`, `useEffect`, SWR, React Query, or any client-side data loading;
- **API routes, `getServerSideProps`, middleware, or any other mechanism.**

Server Components fetch their own data directly by `await`-ing a data helper:

```tsx
// src/app/dashboard/page.tsx — a Server Component (no "use client")
import { getRecentWorkouts } from "@/data/workouts";

export default async function DashboardPage() {
  const workouts = await getRecentWorkouts();

  return <WorkoutList workouts={workouts} />;
}
```

**Why this rule exists**

- Authorization lives in exactly one place (the server), so it cannot be bypassed from the client.
- No data-reading endpoints means no public surface to probe or forge requests against.
- Client Components stay presentational: they receive already-fetched, already-authorized data as props from a Server Component parent.

> Need data inside a Client Component? Fetch it in a Server Component ancestor and pass it down as props. Do **not** reach for the database from the client.

## 2. All queries live in `src/data/`

**Every database query MUST be a helper function inside `src/data/`.** Server Components never call `db` directly — they import a helper.

Conventions (mirroring `src/helpers/`):

- Group helpers by domain, one file per table/aggregate (`src/data/workouts.ts`, `src/data/exercises.ts`).
- Functions are `async`, named with a clear verb (`getRecentWorkouts`, `getExerciseById`, `getWorkoutWithSets`).
- Re-export every helper from the `src/data/index.ts` barrel and import via `@/data`:

  ```ts
  // src/data/index.ts
  export * from "./workouts";
  export * from "./exercises";
  ```

  ```ts
  import { getRecentWorkouts } from "@/data";
  ```

```
src/
  data/      ← ALL database queries live here (server-only)
  helpers/   ← general pure/utility logic (formatting, etc.)
```

## 3. Use Drizzle ORM — never raw SQL

**All queries MUST use the Drizzle ORM query API** (`db.query.*` relational queries or the `db.select()` builder). Do **not** write raw SQL, and do **not** use the `sql` template tag to assemble queries.

```ts
// ✅ Drizzle relational query
const workouts = await db.query.workouts.findMany({
  where: eq(schema.workouts.userId, userId),
});

// ❌ Raw SQL — forbidden
const workouts = await db.execute(
  sql`SELECT * FROM workouts WHERE user_id = ${userId}`,
);
```

Drizzle gives us type safety, schema-aware results, and composable `where` clauses — which is exactly what makes the ownership check in the next section reliable.

## 4. A user may ONLY ever access their own data

This is the most important rule in this document. **Every query MUST be scoped to the currently authenticated user.** Under no circumstances may a user read another user's exercises, workouts, sets, or anything derived from them.

**Get the user id on the server, inside the helper.** Use Clerk's server-side `auth()` so the identity comes from the verified session — never from a function argument, prop, query param, or request body.

```ts
// src/data/workouts.ts
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";

export async function getRecentWorkouts() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db.query.workouts.findMany({
    where: eq(schema.workouts.userId, userId),
    orderBy: desc(schema.workouts.performedAt),
    limit: 10,
  });
}
```

Rules that make this safe:

- **Always derive `userId` from `await auth()` inside the data helper.** Never accept a `userId` parameter from the caller — a caller could pass someone else's id.
- **Bail out when there is no session.** If `userId` is falsy, throw / treat as unauthorized; never fall through to an unscoped query.
- **Every top-level table is filtered by `userId`.** The user-owned tables — `users`, `exercises`, `workouts` — all carry a `userId` column (see `src/db/schema.ts`). Every query against them must include `eq(schema.<table>.userId, userId)` in its `where`.
- **Reach nested rows only through an owned parent.** `workout_exercises` and `sets` have no `userId` of their own — they are owned transitively. Load them via their owning `workout` (which _is_ scoped by `userId`), so the ownership filter still applies:

  ```ts
  export async function getWorkoutWithSets(workoutId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // userId in the where ensures another user's workoutId returns nothing.
    return db.query.workouts.findFirst({
      where: and(
        eq(schema.workouts.id, workoutId),
        eq(schema.workouts.userId, userId),
      ),
      with: {
        workoutExercises: {
          with: { exercise: true, sets: true },
        },
      },
    });
  }
  ```

- **Fetching by id is not enough.** Always combine the id with the `userId` filter (`and(eq(id), eq(userId))`). A bare `findFirst({ where: eq(id) })` would let any user read any row by guessing its id.
- **Writes follow the same rule.** Mutations (in Server Actions) must equally scope by `userId` — both setting it on insert and constraining it on update/delete.

## Quick reference

```ts
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";

export async function getMyExercises() {
  const { userId } = await auth();          // identity from the verified session
  if (!userId) throw new Error("Unauthorized");

  return db.query.exercises.findMany({       // Drizzle ORM, no raw SQL
    where: eq(schema.exercises.userId, userId), // scoped to the current user
    orderBy: desc(schema.exercises.createdAt),
  });
}
```

| Do                                                   | Don't                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| Fetch in Server Components                           | Fetch in route handlers or Client Components               |
| Put every query in `src/data/` helpers               | Call `db` directly from a page/component                   |
| Use Drizzle's query API                               | Write raw SQL or use the `sql` tag for queries             |
| Derive `userId` from `await auth()` in the helper     | Accept a `userId` argument from the caller                 |
| Filter every query by the current `userId`            | Fetch a row by id alone without the ownership check        |
