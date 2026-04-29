# Qwik — module-level helpers (the fix for "X is not defined")

This is the most important Qwik gotcha for Bonita custom pages, learned from a real deploy that failed twice with two different "wrong" fixes before we got it right.

## The problem

```tsx
// ❌ Component-local async function
export default component$(() => {
  const tasks = useSignal<Task[]>([]);

  const loadTasks = async () => {
    tasks.value = await api.getTasks();
  };

  useVisibleTask$(async () => { await loadTasks(); });
  return <button onClick$={loadTasks}>Refresh</button>;
});
```

At runtime, the deployed page fails with:

```
QWIK ERROR loadTasks is not defined
ReferenceError: loadTasks is not defined
  at c.N (.../q-Uwxhw0sp.js:1:471)
  at c.resolved (.../q-C7iDQnhT.js:2:27331)
  ...
```

## Why? Lazy-loaded chunks resolve symbols by module path

Qwik's resumability splits each closure into its own JavaScript chunk that's lazy-loaded only when needed. When the resumed `useVisibleTask$` chunk runs, the runtime needs to look up `loadTasks` — but it's a closure variable inside the `component$()` body, not a module export. The lookup fails.

## What DOESN'T work — wrapping in `$()`

Intuitively you might think: "`$()` makes it a QRL, so Qwik should serialise it":

```tsx
// ❌ STILL FAILS at runtime — same error
const loadTasks = $(async () => {
  tasks.value = await api.getTasks();
});
```

`$()` makes the function a serialisable QRL **for the chunk that defines it**, but the OTHER chunk (the one trying to call `loadTasks`) still sees an undefined symbol. The QRL wrapper doesn't promote it to module scope.

## The fix — define at module level, signals as parameters

```tsx
import { component$, useSignal, useVisibleTask$, type Signal } from '@builder.io/qwik';

// ✅ MODULE-LEVEL helper. Qwik resolves it by import path across all chunks.
async function loadTasks(out: { tasks: Signal<Task[]> }): Promise<void> {
  out.tasks.value = await api.getTasks();
}

export default component$(() => {
  const tasks = useSignal<Task[]>([]);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    await loadTasks({ tasks });
  });

  return (
    <button onClick$={async () => { await loadTasks({ tasks }); }}>
      Refresh
    </button>
  );
});
```

Module-level `async function` is resolved by import path. Every chunk emitted by Qwik can `import { loadTasks } from './root'` (effectively) and the symbol is real.

## Anatomy of the parameter "bag"

Pass a single object containing all the signals the helper needs:

```ts
async function fetchTasks(
  userId: string,
  out: {
    tasks: Signal<BonitaTask[]>;
    total: Signal<number>;
    loading: Signal<boolean>;
    error: Signal<string | null>;
    lastUrl: Signal<string | null>;
    lastStatus: Signal<string | null>;
  }
): Promise<void> {
  out.loading.value = true;
  try {
    const { data, total } = await getMyPendingTasks(userId);
    out.tasks.value = data;
    out.total.value = total;
    out.lastStatus.value = `200 OK — ${data.length} tasks`;
  } catch (e) {
    out.error.value = e instanceof Error ? e.message : String(e);
  } finally {
    out.loading.value = false;
  }
}
```

Why a bag instead of separate args? Easier to extend (add a field, the bag stays one parameter), easier to read at call sites (`fetchTasks(id, { tasks, total, loading, ... })` reads top-down).

## Inline arrow functions in event handlers — fine

You don't need to extract every onClick handler:

```tsx
<button onClick$={async () => {
  if (!auth.user) return;
  await fetchTasks(auth.user.userId, { tasks, total, loading, error, lastUrl, lastStatus });
}}>
  Refresh
</button>
```

Qwik creates a chunk per inline arrow. Inside that chunk, `fetchTasks` is referenced by import path — works. The trade-off: a tiny bit of inline noise vs the runtime safety.

## When a function only has ONE call site

If `loadTasks` is invoked from a single QRL (e.g. only the bootstrap), inline it directly:

```tsx
useVisibleTask$(async () => {
  out.loading.value = true;
  try {
    out.tasks.value = await api.getTasks();
  } finally {
    out.loading.value = false;
  }
});
```

Now there's no naming, no module-level export, no chunk-resolution issue.

## Rule of thumb

| Where the function is called from | Where to define it |
|------------------------------------|--------------------|
| One QRL site only | Inline inside that QRL |
| Multiple QRL sites | MODULE level, with signals as parameters |
| Pure utility (no signals, no DOM) | MODULE level — natural |
| `$()` wrapper inside component$ | **Never** — broken pattern |

## Why other frameworks don't have this issue

React, Vue, Solid, Svelte and Angular all evaluate the entire component body up front; closures over local variables work normally. Qwik's resumability lazy-loads function bodies one at a time, which is precisely what gives Qwik its small initial bundle but introduces this constraint.

It's the price of resumability. If you don't need that level of optimisation, **a different framework will be simpler** — see `../../bonita-svelte-app/SKILL.md` or `../../bonita-solid-app/SKILL.md`.

## Sanity check before deploying

After `npm run build`, search the bundled JS for your function name:

```bash
grep -l "loadTasks\|fetchTasks" dist/build/*.js
```

You should see the function present in MORE than one chunk if it's called from multiple sites — that's correct. If it's defined only inside one chunk and another chunk references it as a free variable, the deployed page will fail with `is not defined`.
