# UI Coding Standards

This document defines how UI is built in **liftingjourney**. The goal is a single, consistent way to compose interfaces so any contributor can read, extend, and trust the UI layer. These rules are not optional — they keep the component surface small, themeable, and predictable.

## 1. Components: shadcn/ui only

**All UI must be built from [shadcn/ui](https://ui.shadcn.com) components.** Do not:

- hand-roll raw HTML + Tailwind for things shadcn already provides (buttons, inputs, dialogs, dropdowns, etc.);
- introduce any other component library (MUI, Chakra, Mantine, Radix-on-its-own, Headless UI, …).

The reasons: shadcn components are already wired into our theme tokens (light/dark), accessibility primitives, and the `radix-nova` style, so consistency comes for free.

**Where things live**

- shadcn primitives are generated into `src/components/ui/` and managed via the shadcn CLI. Add new ones with the CLI rather than copying files by hand:

  ```bash
  npx shadcn@latest add <component>
  ```

- The shadcn config lives in `components.json` — style `radix-nova`, base color `zinc`, CSS variables enabled, `rsc: true`.
- **Icons** come exclusively from [`lucide-react`](https://lucide.dev) (the configured `iconLibrary`).

**Compose, don't fork.** Build on existing primitives instead of duplicating them. For example, the existing `Button` (`src/components/ui/button.tsx`) uses [`class-variance-authority`](https://cva.style) (CVA) for variants and Radix `Slot` for polymorphism — extend that, don't reimplement it.

## 2. Reusable base components: `src/components/_base/`

When a shadcn-based composition is reused across more than one screen, extract it into `src/components/_base/`.

Rules:

- **Composed from shadcn/ui primitives** — `_base/` components wrap, combine, and extend shadcn components. They never replace them or drop down to ad-hoc markup.
- Use the **`cn()`** helper from `@/lib/utils` for all conditional/merged class names.
- Follow the **CVA + `Slot`** pattern established in `button.tsx` when a component needs variants or polymorphism.
- Naming and export conventions stay consistent with the existing `src/components/` files (PascalCase component names, named exports).

```
src/components/
  ui/        ← shadcn primitives (CLI-managed) — do not edit by hand
  _base/     ← our reusable compositions, built ON TOP of ui/
```

## 3. Date formatting: `date-fns`

**All date display must go through [`date-fns`](https://date-fns.org).** Never build date strings by hand and never use `Date.prototype.toLocaleDateString` for displayed dates.

**House format** — every user-facing date uses the token string `do MMM yyyy`:

| Example        | Notes                                      |
| -------------- | ------------------------------------------ |
| `1st Sep 2021` | day-of-month with ordinal suffix (`do`)    |
| `2nd Aug 2025` | abbreviated month (`MMM`)                  |
| `3rd Jan 2026` | 4-digit year (`yyyy`)                      |
| `4th Apr 2023` |                                            |

Always format via the shared **`formatDate`** helper so the format string lives in exactly one place:

```ts
import { formatDate } from "@/helpers";

formatDate(workout.performedAt); // → "1st Sep 2021"
```

The helper is defined in `src/helpers/format-date.ts`:

```ts
import { format } from "date-fns";

/** Formats a date in the project's house style, e.g. "1st Sep 2021". */
export function formatDate(date: Date | number): string {
  return format(date, "do MMM yyyy");
}
```

If you ever need a different shape (e.g. with time), add a sibling helper in `src/helpers/` rather than inlining a new format string at the call site.

## 4. Helpers: `src/helpers/`

All **general, reusable, non-component** helper functions live in `src/helpers/` and are imported through the `@/helpers` barrel.

Conventions:

- **One helper per file**, kebab-case filename (`format-date.ts`).
- Re-export every helper from `src/helpers/index.ts`:

  ```ts
  export * from "./format-date";
  ```

- Import via the barrel: `import { formatDate } from "@/helpers";`

**Scope boundary** — keep these three homes distinct:

| Location               | Holds                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `src/helpers/`         | general pure/utility logic reused across the app            |
| `src/lib/utils.ts`     | `cn()` and other shadcn-owned utilities (leave as-is)       |
| `src/components/_base/` | reusable **UI** compositions built on shadcn primitives     |

## Quick reference

```tsx
import { Button } from "@/components/ui/button"; // shadcn primitive
import { formatDate } from "@/helpers";          // shared helper
import { cn } from "@/lib/utils";                // class merging

export function WorkoutDate({ date, className }: { date: Date; className?: string }) {
  return (
    <Button variant="ghost" className={cn("font-normal", className)}>
      {formatDate(date)}
    </Button>
  );
}
```
