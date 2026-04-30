import { Layout as AntLayout, Button, Typography, Avatar, Dropdown, Space, Badge } from 'antd';
import { LogoutOutlined, UserOutlined, ThunderboltFilled, BellOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { logout } from '../api/auth';

const { Header, Content } = AntLayout;
const { Text } = Typography;

interface Props {
  children: React.ReactNode;
}

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.replace(/[._-]/g, ' ').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
    <AntLayout style={{ minHeight: '100dvh' }} className="rbd-layout">
      <Header className="rbd-header">
        <div className="rbd-brand">
          <ThunderboltFilled className="rbd-brand-icon" />
          <div>
            <div className="rbd-brand-title">__DISPLAY_NAME__</div>
            <div className="rbd-brand-sub">Process &amp; tasks dashboard</div>
          </div>
        </div>
        <Space size="large">
          <Badge count={0} showZero={false}>
            <Button
              type="text"
              shape="circle"
              icon={<BellOutlined />}
              className="rbd-icon-btn"
            />
          </Badge>
          <Dropdown
            placement="bottomRight"
            menu={{
              items: [
                {
                  key: 'user-info',
                  label: (
                    <div style={{ padding: '4px 8px' }}>
                      <div><strong>{user?.displayName ?? '—'}</strong></div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {user?.userName} · ID {user?.userId}
                      </Text>
                    </div>
                  ),
                  disabled: true,
                },
                { type: 'divider' },
                {
                  key: 'logout',
                  label: 'Logout',
                  icon: <LogoutOutlined />,
                  onClick: onLogout,
                },
              ],
            }}
          >
            <div className="rbd-user-chip">
              <Avatar style={{ backgroundColor: '#fff', color: '#722ED1', fontWeight: 600 }}>
                {initials(user?.displayName || user?.userName)}
              </Avatar>
              <div className="rbd-user-text">
                <div className="rbd-user-name">{user?.displayName ?? '—'}</div>
                <div className="rbd-user-role">
                  <UserOutlined /> User
                </div>
              </div>
            </div>
          </Dropdown>
        </Space>
      </Header>
      <Content className="rbd-content">{children}</Content>
    </AntLayout>
  );
};
