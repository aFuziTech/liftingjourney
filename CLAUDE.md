# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Coding Standards

**IMPORTANT:** Always consult the `docs/` directory for this project's code standards and patterns before writing or modifying code, and follow them.

- **UI generation** — refer to [`docs/ui.md`](docs/ui.md) (shadcn/ui-only components, `src/components/_base/` for reusable compositions, `date-fns` formatting, `src/helpers/` conventions).

## Commands

- `npm run dev` — start development server (Next.js with Turbopack)
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — run ESLint (flat config, `eslint.config.mjs`)

No test framework is installed yet.

## Tech Stack

- **Next.js 16** (App Router) with React 19
- **TypeScript 5** — strict mode enabled
- **Tailwind CSS v4** — via `@tailwindcss/postcss`; styles in `src/app/globals.css`
- **ESLint 9** — flat config with `core-web-vitals` + TypeScript rules
- **Drizzle ORM** — schema in `src/db/schema.ts`, config in `drizzle.config.ts`
- **Neon PostgreSQL** — serverless Postgres via `@neondatabase/serverless` (neon-http driver)
- **Clerk** — authentication via `@clerk/nextjs`; middleware in `src/proxy.ts`

## Architecture

- App Router: all routes live under `src/app/`
- Path alias: `@/*` resolves to `./src/*`
- Fonts: Geist Sans and Geist Mono loaded via `next/font/google`, exposed as CSS variables
- Dark mode: CSS custom properties with `prefers-color-scheme` media query

## Database

- Connection: `src/db/index.ts` exports `db` with schema for relational queries
- Schema: `src/db/schema.ts` — 5 normalized tables:
  - `users` — lightweight Clerk mirror (varchar PK = Clerk userId)
  - `exercises` — per-user exercise catalog (unique on userId + name)
  - `workouts` — workout sessions (performedAt, startedAt, completedAt, name, notes)
  - `workout_exercises` — join table with ordering (exerciseId uses `restrict` on delete)
  - `sets` — weight, reps, rpe, durationSeconds, restSeconds, isWarmup, order
- Push schema: `npx drizzle-kit push`
- Generate migrations: `npx drizzle-kit generate`
- Studio: `npx drizzle-kit studio`
