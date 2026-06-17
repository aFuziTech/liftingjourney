# Database Schema Standards

This document defines how the database is modelled and evolved in **liftingjourney**. The goal is a single, predictable data model: five normalized tables, every row ultimately owned by one user, and one schema file that is the sole source of truth. These rules are not optional — they are what keep ownership unambiguous, queries safe to write, and migrations reproducible.

> The schema is the *shape* of the data; it does not by itself enforce access. Reads pair with **[`docs/data-fetching.md`](./data-fetching.md)** and writes with **[`docs/data-mutations.md`](./data-mutations.md)** — those docs own *how every query/write is scoped to the authenticated user*, and identity itself comes from **[`docs/auth.md`](./auth.md)**. This document owns *the tables, their relations, and how to change them*.

## 1. The schema is one file — `src/db/schema.ts`

**All tables, indexes, and relations live in `src/db/schema.ts`.** Do not:

- define tables anywhere else, or split the schema across multiple files;
- write raw `CREATE TABLE` SQL or hand-edit anything under `drizzle/`.

The reason: `drizzle.config.ts` points at exactly this file (`schema: "./src/db/schema.ts"`), and `src/db/index.ts` passes the whole module to `drizzle(...)` so relational queries (`db.query.*`) work. One file means the generated migrations and the runtime client never disagree.

**Where things live**

```
src/db/
  schema.ts   ← tables, indexes, and relations (source of truth)
  index.ts    ← exports `db` (neon-http driver) wired with the schema
drizzle/      ← generated migration artifacts — never hand-edit
drizzle.config.ts  ← out dir, schema path, postgres dialect
```

## 2. Five normalized tables, owned top-down

**The model is exactly five tables, and ownership always flows back to `users`.** Every workout-related row traces to a user through its foreign keys — directly (`exercises.userId`, `workouts.userId`) or transitively (a `set` → `workout_exercise` → `workout` → `user`).

| Table                | Key facts                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `users`              | Lightweight Clerk mirror. PK is `varchar(255)` = the Clerk `userId` (not a generated uuid).               |
| `exercises`          | Per-user exercise catalog. `userId` → `users` (`onDelete: cascade`). Unique on `(userId, name)`.          |
| `workouts`           | A session: `performedAt`, optional `startedAt`/`completedAt`, `name`, `notes`. `userId` → `users` (cascade). |
| `workout_exercises`  | Join row with `order`. `workoutId` → `workouts` (cascade); `exerciseId` → `exercises` (**`restrict`**).   |
| `sets`               | `weight`, `reps`, `rpe`, `durationSeconds`, `restSeconds`, `isWarmup`, `order`. → `workout_exercises` (cascade). |

The cascade chain (`users` → `exercises`/`workouts` → `workout_exercises` → `sets`) means deleting a user or workout cleans up everything beneath it. The one deliberate exception is `workout_exercises.exerciseId`, which uses **`restrict`**: a catalog exercise referenced by any logged workout cannot be deleted out from under that history.

## 3. Column conventions are fixed — follow them when adding fields

**New columns must match the existing primitives and timestamp conventions.** Reach for the same building blocks already in `schema.ts` rather than introducing new ones.

| Need                  | Use                                                                 |
| --------------------- | ------------------------------------------------------------------- |
| Primary key (rows)    | `uuid().primaryKey().defaultRandom()`                               |
| Foreign key to `users`| `varchar({ length: 255 }).notNull().references(() => users.id, …)`  |
| Small integers        | `smallint()` (reps, rpe, order, durations)                          |
| Decimal weight        | `numeric({ precision: 7, scale: 2, mode: "number" })`               |
| Booleans              | `boolean().notNull().default(false)`                                |
| Free text             | `text()` (notes) / `varchar({ length: 255 })` (names)               |
| Timestamps            | `timestamp({ withTimezone: true })` — always timezone-aware         |

Every table carries `createdAt` (`.notNull().defaultNow()`) and `updatedAt` (`.notNull().defaultNow().$onUpdate(() => new Date())`). New tables must include both, in that style.

```ts
// Adding a column to an existing table — match the surrounding style:
export const sets = pgTable("sets", {
  // …existing columns…
  tempoSeconds: smallint(), // nullable small int, like reps/rpe
});
```

## 4. Indexes encode the access pattern — add them for `userId` and ordering

**Index the columns you filter and order by, and enforce real-world uniqueness with `uniqueIndex`.** Each table's index list documents how it is meant to be queried.

- **User-scoped lookups** get a `userId` index: `exercises_user_id_idx`, `workouts_user_id_idx`, plus the composite `workouts_user_id_performed_at_idx` for the by-date query.
- **Ordered children** get a unique composite on `(parentId, order)` — `workout_exercises_workout_id_order_idx`, `sets_workout_exercise_id_order_idx` — so position within a parent is unambiguous.
- **Business uniqueness** is a `uniqueIndex`, not application logic: `exercises_user_id_name_idx` makes "one exercise name per user" a database guarantee, which is what lets the create flow safely `onConflictDoUpdate` on `(userId, name)`.

When you add a table or a new filtered/ordered column, add the matching index in the same `(t) => [ … ]` block.

## 5. Define relations alongside tables

**Every foreign key must have a matching `relations(...)` entry** so the data layer can use nested `with: { … }` reads instead of manual joins. Relations are declared in the `// Relations` section at the bottom of `schema.ts`.

This is what powers the grounded read in `src/data/workouts.ts`:

```ts
db.query.workouts.findMany({
  where: and(eq(schema.workouts.userId, userId), /* …date bounds… */),
  with: {
    workoutExercises: {
      orderBy: asc(schema.workoutExercises.order),
      with: { exercise: true, sets: { orderBy: asc(schema.sets.order) } },
    },
  },
});
```

A foreign key without a corresponding relation entry is a bug: the nested-read ergonomics silently disappear for that edge.

## 6. The user mirror row must exist before it is referenced

**Because `users.id` is the Clerk `userId` and other tables FK to it, ensure the mirror row exists before the first insert that references it.** The schema cannot create it for you. The write path does this explicitly (`src/data/workouts.ts`):

```ts
// Make sure a mirror row exists before we reference it as a foreign key.
await db.insert(schema.users).values({ id: userId }).onConflictDoNothing();
```

Any new write path that creates a user-owned row must do the same before inserting.

## 7. Migration workflow — push for dev, generate for history

**Change `schema.ts`, then sync the database with `drizzle-kit`. Never edit the database or `drizzle/` artifacts by hand.**

| Command                      | When to use it                                                        |
| ---------------------------- | --------------------------------------------------------------------- |
| `npx drizzle-kit push`       | Fast local iteration — apply the current schema straight to the DB.   |
| `npx drizzle-kit generate`   | Produce a versioned SQL migration in `drizzle/` to commit.            |
| `npx drizzle-kit studio`     | Inspect/edit data in a browser UI.                                    |

Both `push` and `generate` read `DATABASE_URL` from `.env.local` (loaded by `drizzle.config.ts`). Add a column → `push` to try it locally → `generate` to capture the migration when the change is ready to share.

## Quick reference

```ts
// A new user-owned table, following every convention above.
import { index, pgTable, smallint, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./schema"; // (in practice, defined in the same file)

export const bodyweightEntries = pgTable(
  "bodyweight_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weight: smallint().notNull(),
    recordedAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("bodyweight_entries_user_id_idx").on(t.userId)],
);

export const bodyweightEntriesRelations = relations(bodyweightEntries, ({ one }) => ({
  user: one(users, { fields: [bodyweightEntries.userId], references: [users.id] }),
}));

// Then: npx drizzle-kit push   (local)   →   npx drizzle-kit generate (commit migration)
```
