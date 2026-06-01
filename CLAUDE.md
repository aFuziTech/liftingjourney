# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

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

## Architecture

- App Router: all routes live under `src/app/`
- Path alias: `@/*` resolves to `./src/*`
- Fonts: Geist Sans and Geist Mono loaded via `next/font/google`, exposed as CSS variables
- Dark mode: CSS custom properties with `prefers-color-scheme` media query
