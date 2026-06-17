---
name: create-docs
description: Create a new coding-standards doc under docs/ for one layer of the liftingjourney app (e.g. ui, auth, routing, data-fetching, data-mutations). Use when the user wants to document a layer's conventions, write a new standards file, or capture the patterns for part of the codebase. Args — $1 = doc slug (filename, no extension); $2 = the specific standards/topics to highlight.
---

# Create a coding-standards doc

Create a new documentation file at `docs/$1.md` that defines the coding standards
for one layer of the **liftingjourney** app. The standards must specifically
highlight: **$2**.

## How to write it

1. **Read `template.md`** (bundled next to this file) — it captures the house
   structure every doc in `docs/` follows. Use it as the skeleton.
2. **Read 1–2 existing docs** in `docs/` (e.g. `docs/ui.md`, `docs/routing.md`)
   to match tone, depth, and formatting before writing. Every doc opens with the
   same kind of intro and closes with a **Quick reference** code block.
3. **Ground every rule in the actual code.** Inspect the relevant files under
   `src/` and cite real paths, helpers, and table/column names — never invent
   APIs. If a convention isn't yet reflected in the code, say so explicitly.
4. **Cross-link related docs** with a `>` callout near the top when the layer
   pairs tightly with another (the way `routing.md` links `auth.md`).
5. Write the file to `docs/$1.md`.

## House conventions (must follow)

- Title: `# <Layer> Standards` (or `# <Layer> Coding Standards`).
- Intro paragraph stating what the doc defines, the goal, and that **"These
  rules are not optional"**.
- Numbered `## 1.`, `## 2.` … sections, each led by a **bold imperative** rule.
- Use tables for option/location matrices and fenced code blocks for examples.
- End with a `## Quick reference` section containing a short, copy-pasteable
  code example.
- Match this project's stack and idioms (Next.js App Router, RSC, Drizzle,
  Clerk, shadcn/ui, `@/*` path alias).
