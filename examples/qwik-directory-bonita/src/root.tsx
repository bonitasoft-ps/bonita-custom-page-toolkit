import {
  component$,
  useSignal,
  useStore,
  useVisibleTask$,
  useStyles$,
  type Signal,
} from '@builder.io/qwik';
import { setSessionExpiredHandler } from './api/client';
import { login, getSession, logout as apiLogout } from './api/auth';
import { getMyPendingTasks, type BonitaTask } from './api/tasks';

interface AuthUser {
  userId: string;
  userName: string;
  displayName: string;
}

interface AuthState {
  user: AuthUser | null;
  booted: boolean;
}

const PRIORITY_COLOR: Record<string, string> = {
  highest: '#c0392b',
  above_normal: '#e67e22',
  normal: '#3498db',
  under_normal: '#16a085',
  lowest: '#7f8c8d',
};

// ── Top-level helper functions ─────────────────────────────────────────
// These are imported by name into every QRL chunk, so calling them from
// useVisibleTask$ or onClick$ handlers works without $() wrappers. Keep
// them outside of component$() — Qwik can't serialise component-local
// closures by name across lazy chunks.

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
  const dbg = new URLSearchParams();
  dbg.set('p', '0');
  dbg.set('c', '50');
  dbg.append('f', 'state=ready');
  dbg.append('f', `user_id=${userId}`);
  dbg.append('o', 'priority DESC');
  dbg.append('o', 'dueDate ASC');
  out.lastUrl.value = `/bonita/API/bpm/humanTask?${dbg}`;

  out.loading.value = true;
  out.error.value = null;
  try {
    const { data, total: t } = await getMyPendingTasks(userId, 0, 50);
    out.tasks.value = data;
    const ft = t >= 0 ? t : data.length;
    out.total.value = ft;
    out.lastStatus.value = `200 OK — ${data.length} tasks (total ${ft})`;
  } catch (e) {
    out.error.value = e instanceof Error ? e.message : String(e);
    out.lastStatus.value = 'error';
  } finally {
    out.loading.value = false;
  }
}

// ── Component ──────────────────────────────────────────────────────────

export default component$(() => {
  useStyles$(STYLES);

  const auth = useStore<AuthState>({ user: null, booted: false });
  const route = useSignal<'login' | 'home'>('login');

  // Login form
  const username = useSignal('');
  const password = useSignal('');
  const loginLoading = useSignal(false);
  const loginError = useSignal<string | null>(null);

  // Tasks state — passed as a bag to fetchTasks
  const tasks = useSignal<BonitaTask[]>([]);
  const total = useSignal(0);
  const tasksLoading = useSignal(false);
  const tasksError = useSignal<string | null>(null);
  const lastUrl = useSignal<string | null>(null);
  const lastStatus = useSignal<string | null>(null);

  // Bootstrap: session probe + initial tasks fetch.
  // useVisibleTask$ runs in the browser on first paint — required in SPA mode.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    setSessionExpiredHandler(() => {
      auth.user = null;
      route.value = 'login';
    });

    try {
      const s = await getSession();
      auth.user = {
        userId: s.user_id,
        userName: s.user_name,
        displayName: s.user_name,
      };
      route.value = 'home';
      await fetchTasks(s.user_id, {
        tasks, total, loading: tasksLoading, error: tasksError, lastUrl, lastStatus,
      });
    } catch {
      auth.user = null;
      route.value = 'login';
    } finally {
      auth.booted = true;
    }
  });

  if (!auth.booted) {
    return <div class="booting">Loading…</div>;
  }

  if (route.value === 'login' || !auth.user) {
    return (
      <div class="wrapper">
        <form
          class="card"
          preventdefault:submit
          onSubmit$={async () => {
            if (!username.value || !password.value) return;
            loginLoading.value = true;
            loginError.value = null;
            try {
              await login(username.value, password.value);
              const s = await getSession();
              auth.user = {
                userId: s.user_id,
                userName: s.user_name,
                displayName: s.user_name,
              };
              route.value = 'home';
              await fetchTasks(s.user_id, {
                tasks, total, loading: tasksLoading, error: tasksError, lastUrl, lastStatus,
              });
            } catch {
              loginError.value = 'Invalid credentials';
            } finally {
              loginLoading.value = false;
            }
          }}
        >
          <h1>Sign in</h1>
          <input
            type="text"
            placeholder="Username"
            autoComplete="username"
            value={username.value}
            onInput$={(_, el) => (username.value = el.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password.value}
            onInput$={(_, el) => (password.value = el.value)}
            required
          />
          {loginError.value && <p class="error">{loginError.value}</p>}
          <button type="submit" disabled={loginLoading.value}>
            {loginLoading.value ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div class="layout">
      <header class="topbar">
        <h1>Directory Bonita Qwik</h1>
        <div class="actions">
          <span class="user">{auth.user.displayName}</span>
          <button
            class="logout"
            onClick$={async () => {
              try {
                await apiLogout();
              } finally {
                auth.user = null;
                route.value = 'login';
              }
            }}
          >
            Logout
          </button>
        </div>
      </header>
      <main class="content">
        <div class="card">
          <header class="card-header">
            <h2>
              My pending tasks <span class="count">({total.value} total)</span>
            </h2>
            <button
              class="refresh"
              disabled={tasksLoading.value}
              onClick$={async () => {
                const id = auth.user?.userId;
                if (!id) return;
                await fetchTasks(id, {
                  tasks, total, loading: tasksLoading, error: tasksError, lastUrl, lastStatus,
                });
              }}
            >
              {tasksLoading.value ? 'Loading…' : 'Refresh'}
            </button>
          </header>

          {tasksError.value && (
            <div class="error-box">
              <strong>Error</strong>
              <pre>{tasksError.value}</pre>
            </div>
          )}

          {tasksLoading.value ? (
            <p class="empty">Loading…</p>
          ) : tasks.value.length === 0 ? (
            <p class="empty">No pending tasks for {auth.user.userName}.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th class="priority-col">Priority</th>
                  <th class="case-col">Case</th>
                  <th class="due-col">Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.value.map((task) => (
                  <tr key={task.id}>
                    <td>{task.displayName || task.name}</td>
                    <td>
                      <span
                        class="badge"
                        style={{ background: PRIORITY_COLOR[task.priority] ?? '#909399' }}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td>{task.caseId}</td>
                    <td>{task.dueDate ? new Date(task.dueDate).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <details class="diag">
            <summary>Diagnostic info</summary>
            <pre>{`userId: ${auth.user.userId}
userName: ${auth.user.userName}
last URL: ${lastUrl.value ?? '—'}
last status: ${lastStatus.value ?? '—'}
result count: ${tasks.value.length} (total: ${total.value})`}</pre>
          </details>
        </div>
      </main>
    </div>
  );
});

const STYLES = `
.booting { display:flex; justify-content:center; align-items:center; min-height:100dvh; color:#909399; }
.wrapper { display:flex; justify-content:center; align-items:center; min-height:100dvh; background: var(--color-bg); }
.card { width: auto; }
.wrapper .card { width:320px; padding:32px; background:white; border-radius:8px; box-shadow:0 4px 24px rgba(0,0,0,0.06); display:flex; flex-direction:column; gap:12px; }
.wrapper h1 { margin:0 0 8px; text-align:center; font-size: 22px; }
.wrapper input { padding:10px 12px; border:1px solid var(--color-border); border-radius:4px; font:inherit; }
.wrapper input:focus { outline:2px solid var(--color-primary); outline-offset:-1px; }
.wrapper button { padding:10px; background: var(--color-primary); color:white; border:none; border-radius:4px; }
.wrapper .error { color:#c00; margin:0; font-size:14px; }
.layout { min-height:100dvh; display:flex; flex-direction:column; }
.topbar { background: var(--color-primary); color:white; display:flex; align-items:center; justify-content:space-between; padding:0 24px; height:64px; }
.layout h1 { margin:0; font-size:20px; font-weight:600; }
.actions { display:flex; align-items:center; gap:16px; }
.user { color: rgba(255, 255, 255, 0.85); }
.logout { background:transparent; color:white; border:1px solid rgba(255,255,255,0.5); padding:6px 16px; border-radius:4px; }
.logout:hover { background: rgba(255,255,255,0.1); }
.content { flex:1; padding:24px; }
.content .card { background:white; border-radius:8px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
.card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
h2 { margin:0; font-size:18px; font-weight:600; }
.count { color:#909399; font-weight:400; margin-left:8px; font-size:14px; }
.refresh { padding:8px 16px; background: var(--color-primary); color:white; border:none; border-radius:4px; }
.error-box { background:#fff1f0; border-left:4px solid #c00; padding:12px 16px; margin-bottom:16px; border-radius:0 4px 4px 0; }
.error-box pre { margin:8px 0 0; white-space:pre-wrap; word-break:break-word; font-size:13px; color:#c00; }
.empty { color:#909399; padding:24px; text-align:center; }
table { width:100%; border-collapse:collapse; }
th, td { padding:10px 12px; text-align:left; border-bottom:1px solid var(--color-border); }
th { font-weight:600; font-size:13px; color:#606266; background:#fafafa; }
.priority-col { width:140px; }
.case-col { width:120px; }
.due-col { width:200px; }
.badge { display:inline-block; padding:2px 10px; border-radius:10px; color:white; font-size:12px; font-weight:500; }
.diag { margin-top:24px; font-size:12px; color:#606266; border-top:1px dashed var(--color-border); padding-top:12px; }
.diag summary { cursor:pointer; user-select:none; }
.diag pre { margin:8px 0 0; background:#fafafa; padding:8px 12px; border-radius:4px; white-space:pre-wrap; word-break:break-word; }
`;
