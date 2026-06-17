# Routing Standards

This document defines how routes are structured and protected in **liftingjourney**. The goal is a single, predictable routing model: the entire authenticated app lives under one prefix, and access to it is enforced in exactly one place. These rules are not optional — they are what keep route protection from scattering into per-page checks and what guarantee a signed-out visitor can never reach an authenticated screen.

> Routing pairs tightly with **[`docs/auth.md`](./auth.md)** (how identity is established) and **[`docs/data-fetching.md`](./data-fetching.md)** (how each query is scoped to that identity). This document owns *where routes live* and *how they are gated at the edge*; those docs own *who the user is* and *what data they may read*. Route-level gating is the first line of defense, not the only one — data-level scoping still applies on every query.

## 1. The app lives under `/dashboard`

**Every authenticated route MUST live under `/dashboard`.** The application itself — the workout log and everything reachable from it — is mounted at `/dashboard` and nested below it. New screens are added as sub-segments of `src/app/dashboard/`, never as new top-level segments.

```
src/app/
  page.tsx                              ← "/"            public landing page
  dashboard/
    page.tsx                            ← "/dashboard"   the app home (protected)
    workout/
      new/page.tsx                      ← "/dashboard/workout/new"        (protected)
      [workoutId]/page.tsx              ← "/dashboard/workout/[workoutId]" (protected)
```

Rules:

- **New app routes are sub-segments of `dashboard/`.** A new feature page is `src/app/dashboard/<feature>/page.tsx` → `/dashboard/<feature>`. Do not create a sibling top-level segment (e.g. `src/app/workout/`) for app functionality.
- **Only the marketing/landing surface lives at the root.** `src/app/page.tsx` (`/`) is the public entry point. Keep it free of authenticated data and app UI.
- **There are no `/sign-in` or `/sign-up` route pages.** Auth is modal (see [`docs/auth.md`](./auth.md) §2). Don't add dedicated auth route segments.
- **Link with `next/link` and absolute `/dashboard/...` paths.** Use `<Link href="/dashboard/workout/new">`, not relative hrefs or manual `<a>` tags, for in-app navigation.

## 2. Everything under `/dashboard` is a protected route

**`/dashboard` and every page beneath it are accessible only to signed-in users.** A request from an unauthenticated visitor to any `/dashboard*` path MUST never render app content — it is redirected to sign-in.

The public surface is the complement of this rule: `/` and Clerk's own routes are open; **everything else that is app functionality belongs under `/dashboard` and is therefore protected.** When you add a screen that should require auth, the only thing you do to protect it is put it under `/dashboard` — protection is inherited from the prefix, not re-declared per page.

- **Do not add per-page auth redirects.** No `redirect("/")` guards at the top of a `page.tsx`, no `<Show>`-based gating standing in for route protection. Protection happens once, at the edge (§3).
- **Do not rely on hiding links.** Not rendering a nav link to a protected page is not protection — the route must be unreachable by direct URL for signed-out users.
- **Data scoping is still mandatory.** Edge protection blocks signed-out users; it does **not** scope data between signed-in users. Every query and mutation still derives `userId` from `await auth()` and filters by it (see [`docs/auth.md`](./auth.md) and [`docs/data-fetching.md`](./data-fetching.md)).

## 3. Protection is enforced in the Proxy (`src/proxy.ts`)

**Route protection MUST be done in Next.js middleware, in exactly one file: `src/proxy.ts`.**

> **This is Next.js 16: Middleware is now called Proxy.** The `proxy.ts` file *is* the middleware — same request-pipeline functionality, renamed convention. There is **one** Proxy file per project, located beside `app/` (here, `src/proxy.ts`). All edge-level route logic lives here; do not reintroduce a `middleware.ts`.

Protection is wired with Clerk's `createRouteMatcher` + `auth.protect()`, so a single matcher describes the protected surface and Clerk handles the redirect for signed-out users:

```ts
// src/proxy.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// One matcher describes the entire protected surface.
const isProtected = createRouteMatcher(['/dashboard(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect()
})

export const config = {
  matcher: [
    // run on everything except static assets…
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/__clerk/(.*)', // …Clerk's own routes…
    '/(api|trpc)(.*)', // …and API routes.
  ],
}
```

Rules:

- **`createRouteMatcher(['/dashboard(.*)'])` is the source of truth for what's protected.** Because the whole app lives under `/dashboard` (§1), this one pattern covers every current and future app route. Adjust *this matcher* — never add ad-hoc checks elsewhere — if the protected surface ever needs to change.
- **`auth.protect()` does the gating.** It redirects signed-out users to sign-in. Do not hand-roll the `userId` check + `redirect()` in the Proxy; use `auth.protect()`.
- **`clerkMiddleware()` must wrap the whole pipeline** so `await auth()` is available downstream in Server Components, data helpers, and Server Actions. The `config.matcher` controls *where the Proxy runs at all*; `createRouteMatcher` controls *what it protects* — they are different layers, keep both.
- **Keep the Proxy thin.** It does optimistic edge gating only — no data fetching, no session management, no business logic (per the Next.js Proxy guidance). Authorization beyond "is this user signed in" belongs in the data layer.

## Quick reference

```ts
// src/proxy.ts — the one place route protection lives.
const isProtected = createRouteMatcher(['/dashboard(.*)'])
export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect()
})
```

| Do | Don't |
| -- | ----- |
| Mount every app route under `/dashboard` | Create top-level segments for app functionality |
| Keep `/` (and Clerk routes) as the only public surface | Put authenticated data or app UI on `/` |
| Protect routes once in `src/proxy.ts` with `createRouteMatcher` + `auth.protect()` | Add `redirect()` / `<Show>` auth guards per page |
| Widen/narrow protection by editing the `/dashboard(.*)` matcher | Sprinkle ad-hoc auth checks to patch a coverage gap |
| Treat edge protection as the first line, then scope every query by `userId` | Assume route gating scopes data between signed-in users |
| Navigate with `next/link` and absolute `/dashboard/...` paths | Hide nav links and call the route "protected" |
