import { useEffect, useState } from 'react';
import { Table, Tag, Card, Typography, Empty, App, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '../stores/authStore';
import { getMyPendingTasks, type BonitaTask } from '../api/tasks';

const { Title, Text } = Typography;

const PRIORITY_COLOR: Record<string, string> = {
  highest: 'magenta',
  above_normal: 'red',
  normal: 'blue',
  under_normal: 'cyan',
  lowest: 'default',
};

export const TasksPage = () => {
  const user = useAuthStore((s) => s.user);
  const [tasks, setTasks] = useState<BonitaTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, total } = await getMyPendingTasks(user.userId, 0, 50);
      setTasks(data);
      setTotal(total >= 0 ? total : data.length);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  const columns: ColumnsType<BonitaTask> = [
    {
      title: 'Task',
      dataIndex: 'displayName',
      render: (v: string | undefined, r) => v || r.name,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      width: 140,
      render: (p: string) => <Tag color={PRIORITY_COLOR[p] || 'default'}>{p}</Tag>,
    },
    {
      title: 'Case',
      dataIndex: 'caseId',
      width: 120,
    },
    {
      title: 'Due',
      dataIndex: 'dueDate',
      width: 180,
      render: (d?: string) => (d ? new Date(d).toLocaleString() : <Text type="secondary">—</Text>),
    },
  ];

  return (
    <Card
      title={
        <span>
          <Title level={4} style={{ display: 'inline', margin: 0 }}>
            My pending tasks
          </Title>
          <Text type="secondary" style={{ marginLeft: 12 }}>
            {total} total
          </Text>
        </span>
      }
      extra={
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          Refresh
        </Button>
      }
    >
      <Table<BonitaTask>
        rowKey="id"
        columns={columns}
        dataSource={tasks}
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="No pending tasks" /> }}
      />
    </Card>
  );
};
