import { Layout as AntLayout, Button, Typography, Space } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { logout } from '../api/auth';

const { Header, Content } = AntLayout;
const { Title, Text } = Typography;

interface Props {
  children: React.ReactNode;
}

export const Layout = ({ children }: Props) => {
  const user = useAuthStore((s) => s.user);
  const setLogout = useAuthStore((s) => s.logout);

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      setLogout();
      window.location.hash = '#/login';
    }
  };

  return (
    <AntLayout style={{ minHeight: '100dvh' }}>
      <Header
        style={{
          background: '#722ED1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <Title level={4} style={{ color: 'white', margin: 0 }}>
          __DISPLAY_NAME__
        </Title>
        <Space>
          <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
            {user?.displayName ?? ''}
          </Text>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={onLogout}
            style={{ color: 'white' }}
          >
            Logout
          </Button>
        </Space>
      </Header>
      <Content style={{ padding: 24, background: '#F3F3F1' }}>{children}</Content>
    </AntLayout>
  );
};
