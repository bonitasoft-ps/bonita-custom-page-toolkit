# Solid + Bonita: keep ALL styles in `app.css`

A learned-the-hard-way rule from real Bonita deployments.

## The bug we hit

Initial implementation had layout styles inside JSX `<style>` blocks per component:

```tsx
function LoginPage() {
  return (
    <div class="wrapper">
      <form class="card">...</form>
      <style>{`
        .wrapper { display: flex; ... }
        .card { width: 320px; ... }
      `}</style>
    </div>
  );
}
```

The Layout/header (defined in `App.tsx`) used classes `.layout`, `.topbar`, `.user`, `.logout` — but **those rules existed nowhere**. App.css only had token variables. Nobody noticed because the LoginPage looked OK (its `<style>` block injected its rules globally).

Result on deploy: the authenticated layout rendered as **stacked unstyled divs** — the user appeared below the title with no colors.

## The fix

Put **everything** in `src/app.css`, imported once from `src/index.tsx`:

```ts
// src/index.tsx
import './app.css';
```

```css
/* src/app.css */

:root {
  --color-primary: #2C4F7C;
  --color-bg: #f3f3f1;
  /* ... */
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { background: var(--color-bg); }

/* Layout */
.layout { min-height: 100dvh; display: flex; flex-direction: column; }
.topbar {
  background: linear-gradient(90deg, var(--color-primary), #1F3960);
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  height: 64px;
}
.topbar h1 { margin: 0; font-size: 20px; font-weight: 600; }
.actions { display: flex; align-items: center; gap: 16px; }
.user { color: rgba(255, 255, 255, 0.9); /* ... */ }
.logout { /* ... */ }

/* Login page */
.login-wrapper { /* ... */ }
.login-card { /* ... */ }

/* Tasks card */
.card { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
.card-header { display: flex; align-items: center; justify-content: space-between; }

/* Tables, badges, errors, diagnostic — all here */
```

## Why this matters specifically for Bonita custom pages

1. **Predictable load order**. `app.css` is bundled into a single hashed CSS file by Vite. Bonita serves it. Always present.
2. **Resilient to component lifecycle**. If `<Show>`/`<Switch>` decides not to mount a component, its `<style>` blob never injects. Layout breaks silently.
3. **Smaller total size**. CSS deduplicates trivially in one file. Spread across components, you might re-emit the same rules into different chunks.
4. **Easier to maintain**. `Cmd+F` for `.topbar` finds every rule in one place.

## Class naming

Use BEM-ish or component-prefixed names to avoid collisions:

```css
.login-wrapper { ... }
.login-card { ... }
.card { ... }            /* generic, used by Tasks */
.card-header { ... }     /* generic */
.task-row { ... }        /* prefix when ambiguous */
```

The `.wrapper` class is dangerously generic — use `.login-wrapper` or `.modal-wrapper` to scope it.

## Inline `style` is still fine for dynamic values

For one-off dynamic styles (a color from a record), use the `style` prop:

```tsx
<span class="badge" style={{ background: priorityColor(task.priority) }}>
  {task.priority}
</span>
```

That's perfectly idiomatic. Just don't put the `.badge` rule itself inline.

## Don't use a CSS-in-JS library here

Solid has integrations with Emotion, Stitches, Pigment-CSS, etc. For a Bonita custom page (single self-contained SPA), they add weight and complexity for no real benefit. Plain CSS in one file is the right call.
