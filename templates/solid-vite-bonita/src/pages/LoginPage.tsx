import { createSignal, Show, createEffect } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { login, getSession } from '../api/auth';
import { authStore } from '../stores/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (authStore.isAuthenticated) {
      const redirect = (searchParams.redirect as string) || '/';
      navigate(redirect, { replace: true });
    }
  });

  const onSubmit = async (e: Event) => {
    e.preventDefault();
    if (!username() || !password()) return;
    setLoading(true);
    setError(null);
    try {
      await login(username(), password());
      const s = await getSession();
      authStore.setUserFromSession(s);
      navigate('/', { replace: true });
    } catch {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="wrapper">
      <form class="card" onSubmit={onSubmit}>
        <h1>Sign in</h1>
        <input
          type="text"
          placeholder="Username"
          autocomplete="username"
          value={username()}
          onInput={(e) => setUsername(e.currentTarget.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          autocomplete="current-password"
          value={password()}
          onInput={(e) => setPassword(e.currentTarget.value)}
          required
        />
        <Show when={error()}>
          <p class="error">{error()}</p>
        </Show>
        <button type="submit" disabled={loading()}>
          {loading() ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <style>{`
        .wrapper { display:flex; justify-content:center; align-items:center; min-height:100dvh; background: var(--color-bg); }
        .card { width:320px; padding:32px; background:white; border-radius:8px; box-shadow:0 4px 24px rgba(0,0,0,0.06); display:flex; flex-direction:column; gap:12px; }
        h1 { margin:0 0 8px; text-align:center; }
        input { padding:10px 12px; border:1px solid var(--color-border); border-radius:4px; font:inherit; }
        input:focus { outline:2px solid var(--color-primary); outline-offset:-1px; }
        button { padding:10px; background: var(--color-primary); color:white; border:none; border-radius:4px; }
        .error { color:#c00; margin:0; font-size:14px; }
      `}</style>
    </div>
  );
}
