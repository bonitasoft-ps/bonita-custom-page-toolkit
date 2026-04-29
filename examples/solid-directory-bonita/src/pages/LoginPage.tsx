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
    <div class="login-wrapper">
      <form class="login-card" onSubmit={onSubmit}>
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
    </div>
  );
}
