# <Layer> Standards

This document defines how <layer> is built in **liftingjourney**. The goal is a
single, consistent way to <do the thing> so any contributor can read, extend,
and trust the <layer> layer. These rules are not optional — they <the payoff:
what consistency buys us>.

> <Optional cross-link callout.> <Layer> pairs tightly with
> **[`docs/<other>.md`](./<other>.md)** (<what that doc owns>). This document
> owns *<what this doc owns>*; that doc owns *<what the other owns>*.

## 1. <First rule, as a bold imperative>

**<The rule in one bold sentence.>** Then explain it. Do not:

- <thing to avoid>;
- <thing to avoid>.

The reason: <why this rule exists — the concrete payoff>.

**Where things live**

```
src/<path>/
  <subdir>/   ← <what lives here>
  <subdir>/   ← <what lives here>
```

## 2. <Second rule>

**<Bold imperative.>** Explanation.

| Location          | Holds                          |
| ----------------- | ------------------------------ |
| `src/<path>`      | <what>                         |
| `src/<path>`      | <what>                         |

```ts
// Real, grounded example — cite actual files/helpers from src/
import { thing } from "@/helpers";

thing(value); // → expected result
```

## 3. <Third rule>

**<Bold imperative.>** Explanation, with a grounded code example.

## Quick reference

```tsx
// A short, copy-pasteable example that exercises the rules above,
// using real imports and paths from this project.
import { Example } from "@/components/_base/example";

export function Demo() {
  return <Example />;
}
```
