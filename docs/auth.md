# Auth Standards

This document defines how authentication works in **liftingjourney**. The goal is a single, predictable auth model: identity is established by **Clerk** in exactly one place, the authenticated user is always read from the verified session on the server, and every user-owned row is anchored to that identity. These rules are not optional — they are what keep auth logic from scattering across the app and what keep one user's session from ever standing in for another's.

## 1. Clerk is the only auth provider

**All authentication MUST go through [Clerk](https://clerk.com) via [`@clerk/nextjs`](https://clerk.com/docs/references/nextjs/overview).** Do not:

- hand-roll authentication — no custom login forms, password handling, session cookies, or JWT signing/verification;
- introduce a second auth provider (NextAuth/Auth.js, Lucia, Supabase Auth, Firebase Auth, …);
- read or trust identity from anywhere other than Clerk's server APIs.

Clerk owns sign-in, sign-up, sessions, and the user record. We mirror only the user **id** into our database (see §5); everything else about the user lives in Clerk.

**Environment** — two keys, loaded from `.env.local`:

| Variable | Scope | Notes |
| -------- | ----- | ----- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | client + server | safe to expose; used by the provider/components |
| `CLERK_SECRET_KEY` | **server only** | never import into a Client Component or log it |

> Never put `CLERK_SECRET_KEY` behind a `NEXT_PUBLIC_` prefix and never reference it from `"use client"` code.

## 2. Provider & auth UI live in the root layout

**The app is wrapped in `ClerkProvider` in `src/app/layout.tsx`**, and the sign-in / sign-up / account UI is composed there from Clerk's own components. Build auth UI from these primitives — do **not** hand-build login forms, sign-out buttons, or "am I signed in?" checks.

```tsx
// src/app/layout.tsx
import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";

<ClerkProvider>
  {/* gate UI on auth state with Clerk's <Show when="signed-in" | "signed-out"> */}
  <Show when="signed-out">
    <SignInButton mode="modal">{/* trigger */}</SignInButton>
    <SignUpButton mode="modal">{/* trigger */}</SignUpButton>
  </Show>
  <Show when="signed-in">
    <UserButton />
  </Show>
</ClerkProvider>
```

Conventions:

- **Sign-in / sign-up are modal** (`mode="modal"`). There are no dedicated `/sign-in` or `/sign-up` route pages — keep it that way unless the flow genuinely needs a full page.
- **Gate auth-dependent UI with `Show`** (`when="signed-in"` / `when="signed-out"`), not with manual session reads in components.
- **Sign-out and account management go through `<UserButton />`.** Do not build a custom sign-out control.

## 3. Middleware: `src/proxy.ts`

**`clerkMiddleware()` runs on every request** and is what makes `auth()` available downstream. In this project the middleware file is **`src/proxy.ts`** — not the conventional `middleware.ts`. When wiring anything auth-related into the request pipeline, this is the file.

```ts
// src/proxy.ts
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // run on everything except static assets…
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/__clerk/(.*)", // …Clerk's own routes…
    "/(api|trpc)(.*)", // …and API routes.
  ],
};
```

- **The `matcher` is the single place to adjust coverage.** Don't add ad-hoc auth checks elsewhere to compensate for a matcher gap — fix the matcher.
- Today the middleware only attaches the session; it does **not** redirect unauthenticated users (see §6).

## 4. Get identity on the server with `auth()`

**The authenticated user MUST come from `auth()` (from `@clerk/nextjs/server`)** — the verified, server-side session. Never derive identity from a function argument, prop, query param, request body, header, or any client-supplied value: those can be forged.

```ts
import { auth } from "@clerk/nextjs/server";

const { userId } = await auth();
if (!userId) throw new Error("Unauthorized");
```

- **Always `await auth()` on the server** (Server Component, data helper, or Server Action). It is not available in Client Components.
- **Bail when there is no session.** If `userId` is falsy, throw / treat as unauthorized — never fall through to unscoped work.

> **Reads are governed by [`docs/data-fetching.md`](./data-fetching.md).** That doc owns the rules for scoping queries to the current user (derive `userId` in the data helper, filter every query by it, reach nested rows only through an owned parent). This document does not restate them — read it before writing any query.

## 5. The `users` table mirrors the Clerk user

`users.id` in `src/db/schema.ts` is a `varchar(255)` primary key that holds **the Clerk `userId` verbatim**. It is a lightweight mirror — no name, email, or profile data is duplicated (that stays in Clerk). Every user-owned table (`exercises`, `workouts`) carries a `userId` foreign key to it with `onDelete: "cascade"`.

**Ensure the `users` row exists before inserting user-owned rows.** Use an idempotent upsert so a first-time user doesn't trip a foreign-key error — the pattern established in `scripts/seed-workouts.ts`:

```ts
await db.insert(schema.users).values({ id: userId }).onConflictDoNothing();
```

> **Long-term sync is a Clerk webhook.** There is no webhook yet; the upsert-on-write pattern above is the current standard. When user lifecycle (create/delete) needs to sync automatically, add a Clerk webhook rather than scattering more manual upserts.

## 6. Protecting routes & scoping writes (forward-looking)

Some of this isn't built yet — these are the standards for when it is.

**Today protection is data-level.** Routes render for everyone; security comes from `auth()` throwing `Unauthorized` in the data layer. Keep relying on that as the baseline.

**Writes follow the read rules.** Mutations belong in **Server Actions**, and they MUST scope by `userId` from `await auth()` exactly as reads do — set `userId` on insert, and constrain `userId` in the `where` of every update/delete. Never trust a `userId` sent from the client.

```ts
"use server";
import { auth } from "@clerk/nextjs/server";

export async function deleteWorkout(workoutId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // userId in the where prevents deleting another user's row by guessing its id.
  await db.delete(schema.workouts).where(
    and(eq(schema.workouts.id, workoutId), eq(schema.workouts.userId, userId)),
  );
}
```

**If route-level gating is added**, do it in `src/proxy.ts` with Clerk's `createRouteMatcher` + `auth.protect()`, so enforcement stays in the one middleware file rather than spreading per-page redirects.

```ts
// src/proxy.ts — pattern for when route protection is needed
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});
```

## Quick reference

```ts
import { auth } from "@clerk/nextjs/server";

// The only sanctioned way to learn who the caller is — server-side, verified session.
const { userId } = await auth();
if (!userId) throw new Error("Unauthorized");
```

| Do | Don't |
| -- | ----- |
| Authenticate exclusively through Clerk (`@clerk/nextjs`) | Roll custom auth or add a second provider |
| Build auth UI from `SignInButton` / `UserButton` / `Show` | Hand-build login forms or sign-out buttons |
| Read identity via `await auth()` on the server | Trust a `userId` from props, params, or the client |
| Adjust request coverage in `src/proxy.ts`'s `matcher` | Sprinkle ad-hoc auth checks to patch a matcher gap |
| Upsert the `users` row (`onConflictDoNothing`) before user-owned inserts | Assume the `users` row already exists |
| Scope every write in a Server Action by `auth()`'s `userId` | Set or filter `userId` from a client-supplied value |
