import { useEffect } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useAuthStore } from './stores/authStore';
import { getSession } from './api/auth';
import { setSessionExpiredHandler } from './api/client';

export default function App() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      useAuthStore.getState().logout();
      window.location.hash = '#/login';
    });

    const probe = async () => {
      try {
        const s = await getSession();
        setUser({
          userId: s.user_id,
          userName: s.user_name,
          displayName: s.user_name,
          isTechnicalUser: s.is_technical_user,
        });
      } catch {
        // No active session — login page will show
      } finally {
        setLoading(false);
      }
    };
    probe();
  }, [setUser, setLoading]);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#722ED1' } }}>
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </ConfigProvider>
  );
}
