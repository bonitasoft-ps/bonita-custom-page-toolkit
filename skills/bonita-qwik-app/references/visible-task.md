# Qwik — `useVisibleTask$` for bootstrap (NOT `useTask$`)

A Qwik gotcha specific to SPA-only mode.

## The behaviour difference

| Hook | When does it run? |
|------|-------------------|
| `useTask$` | On the SERVER during SSR; in the browser **only when a tracked signal CHANGES** |
| `useVisibleTask$` | In the BROWSER **once when the component becomes visible**, then again whenever tracked signals change |

In SPA-only mode (no SSR), `useTask$` never fires for the initial render because there's no server pass and no signal has "changed" yet — the first signal-state pair is just whatever the component initialised with.

Result: a `useTask$` block intended to bootstrap (probe the session, fetch data) silently never runs. The page hangs forever.

## The wrong code (silent failure)

```tsx
export default component$(() => {
  const auth = useStore({ user: null, booted: false });

  // ❌ NEVER FIRES in SPA mode
  useTask$(async ({ track }) => {
    track(() => auth.booted);
    if (auth.booted) return;

    const s = await getSession();
    auth.user = { /* ... */ };
    auth.booted = true;
  });

  return /* ... */;
});
```

## The fix

```tsx
export default component$(() => {
  const auth = useStore({ user: null, booted: false });

  // ✅ Fires in the browser on first paint
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      const s = await getSession();
      auth.user = { /* ... */ };
    } catch {
      auth.user = null;
    } finally {
      auth.booted = true;
    }
  });

  if (!auth.booted) return <div>Loading…</div>;
  return /* authenticated UI */;
});
```

## Why the `eslint-disable` comment?

Qwik's official lint rule `qwik/no-use-visible-task` actively discourages `useVisibleTask$` because it forces eager browser execution and undermines Qwik's "lazy-by-default" philosophy. For an SSR app served by Qwik City, that warning is correct.

For a Bonita custom page in SPA-only mode, **we don't have SSR**, so there's no "lazy at startup" benefit to lose — and `useTask$` actually fails to fire. The disable comment acknowledges this is a deliberate decision and silences the lint.

## When to use `useTask$` instead

`useTask$` IS the right choice for **reactions to user interaction or state changes**:

```tsx
// ✅ Correct — fires whenever auth.user.userId changes
useTask$(async ({ track }) => {
  const id = track(() => auth.user?.userId);
  if (id) {
    await loadTasksForUser(id);
  }
});
```

So a typical Qwik Bonita component has BOTH:

- ONE `useVisibleTask$` for the bootstrap (session probe)
- Zero or more `useTask$` for reacting to subsequent state changes

## Combining with module-level helpers

If your `useVisibleTask$` calls `loadTasks()`, that helper MUST be at module level:

```tsx
async function loadTasks(out: { tasks: Signal<Task[]> }) { /* ... */ }

export default component$(() => {
  const tasks = useSignal<Task[]>([]);
  
  useVisibleTask$(async () => {
    const s = await getSession();
    if (s) await loadTasks({ tasks });
  });
});
```

See [`module-level-helpers.md`](module-level-helpers.md) for why.

## What about `useOn('qinit')` or `useOnDocument('qinit')`?

These are alternatives that fire on Qwik's "qinit" event, which is similar to "visible task" but tied to the document/window. For our use case (SPA bootstrap), `useVisibleTask$` is more idiomatic and well-typed. Stick with `useVisibleTask$`.

## Refresh-safety

Both `useTask$` and `useVisibleTask$` re-run after a page refresh because Qwik re-builds the component tree from the static HTML. So when a user hits Ctrl+F5:

1. New HTML is loaded (just `index.html` + the entry script — no SSR)
2. Component mounts
3. `useVisibleTask$` runs again → session probe → user lands authenticated
4. The page resumes correctly

If the bug were "task runs once but not on refresh", we'd need a different fix. But Qwik is consistent across loads — the actual problem was that `useTask$` didn't fire AT ALL in SPA mode. `useVisibleTask$` runs every time.
