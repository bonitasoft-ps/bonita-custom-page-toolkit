import { Show, createSignal, onMount, type ParentProps } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { authStore } from './stores/auth';
import { setSessionExpiredHandler } from './api/client';

export default function App(props: ParentProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [booted, setBooted] = createSignal(false);

  onMount(async () => {
    setSessionExpiredHandler(() => {
      authStore.clearUser();
      navigate('/login', { replace: true });
    });
    await authStore.loadSession();
    setBooted(true);
    if (!authStore.isAuthenticated && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
  });

  const onLogout = async () => {
    await authStore.logoutAndClear();
    navigate('/login', { replace: true });
  };

  return (
    <Show
      when={booted()}
      fallback={<div class="booting">Loading…</div>}
    >
      <Show
        when={authStore.isAuthenticated && location.pathname !== '/login'}
        fallback={<>{props.children}</>}
      >
        <div class="layout">
          <header class="topbar">
            <h1>__DISPLAY_NAME__</h1>
            <div class="actions">
              <span class="user">{authStore.user?.displayName}</span>
              <button class="logout" onClick={onLogout}>Logout</button>
            </div>
          </header>
          <main class="content">{props.children}</main>
        </div>
      </Show>
    </Show>
  );
}
