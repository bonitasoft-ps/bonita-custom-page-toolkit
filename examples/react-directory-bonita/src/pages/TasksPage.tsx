import { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Tag, Button, Empty, App, Input, Select, Modal, Tooltip, Statistic,
  Row, Col, Progress, Typography, Space, Tabs, Alert,
} from 'antd';
import {
  ReloadOutlined, SearchOutlined, ClockCircleOutlined, FireOutlined,
  CalendarOutlined, AlertOutlined, ExclamationCircleOutlined, InfoCircleOutlined,
  ApartmentOutlined, FolderOpenOutlined, CheckCircleOutlined, RocketOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '../stores/authStore';
import {
  loadSnapshot, type BpmSnapshot, type BonitaTask, type BonitaProcess, type BonitaCase,
} from '../api/bpm';

const { Text } = Typography;

const PRIORITIES = ['highest', 'above_normal', 'normal', 'under_normal', 'lowest'] as const;
type Priority = (typeof PRIORITIES)[number];

const PRIORITY_META: Record<Priority, { label: string; color: string; antColor: string }> = {
  highest:      { label: 'Highest',     color: '#c0392b', antColor: 'magenta' },
  above_normal: { label: 'High',        color: '#e67e22', antColor: 'red' },
  normal:       { label: 'Normal',      color: '#3498db', antColor: 'blue' },
  under_normal: { label: 'Low',         color: '#16a085', antColor: 'cyan' },
  lowest:       { label: 'Lowest',      color: '#7f8c8d', antColor: 'default' },
};

function isOverdue(t: BonitaTask): boolean {
  if (!t.dueDate) return false;
  return new Date(t.dueDate).getTime() < Date.now();
}
function isDueToday(t: BonitaTask): boolean {
  if (!t.dueDate) return false;
  const d = new Date(t.dueDate);
  const today = new Date();
  return d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth()
    && d.getDate() === today.getDate();
}

export const TasksPage = () => {
  const user = useAuthStore((s) => s.user);
  const [snapshot, setSnapshot] = useState<BpmSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'name'>('priority');
  const [detailTask, setDetailTask] = useState<BonitaTask | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await loadSnapshot(user.userId);
      setSnapshot(snap);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  const tasks = snapshot?.tasks.data ?? [];
  const tasksTotal = snapshot?.tasks.total ?? 0;
  const processes = snapshot?.processes.data ?? [];
  const processesTotal = snapshot?.processes.total ?? 0;
  const openCases = snapshot?.openCases.data ?? [];
  const openCasesTotal = snapshot?.openCases.total ?? 0;
  const closedToday = snapshot?.closedToday.data ?? [];
  const closedTodayTotal = snapshot?.closedToday.total ?? 0;

  const enabledProcesses = useMemo(
    () => processes.filter((p) => p.activationState === 'ENABLED').length,
    [processes]
  );

  const stats = useMemo(() => {
    const overdue = tasks.filter(isOverdue).length;
    const dueToday = tasks.filter(isDueToday).length;
    const highPriority = tasks.filter(
      (t) => t.priority === 'highest' || t.priority === 'above_normal'
    ).length;
    const distribution: Record<Priority, number> = {
      highest: 0, above_normal: 0, normal: 0, under_normal: 0, lowest: 0,
    };
    for (const t of tasks) {
      const p = (PRIORITIES.includes(t.priority as Priority) ? t.priority : 'normal') as Priority;
      distribution[p]++;
    }
    const maxCount = Math.max(1, ...Object.values(distribution));
    return { overdue, dueToday, highPriority, distribution, maxCount };
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const lower = search.trim().toLowerCase();
    const priorityRank: Record<string, number> = {
      highest: 0, above_normal: 1, normal: 2, under_normal: 3, lowest: 4,
    };
    return tasks
      .filter((t) => {
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
        if (!lower) return true;
        const haystack = `${t.displayName ?? ''} ${t.name} ${t.caseId}`.toLowerCase();
        return haystack.includes(lower);
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
        }
        if (sortBy === 'dueDate') {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          return da - db;
        }
        return (a.displayName || a.name).localeCompare(b.displayName || b.name);
      });
  }, [tasks, search, priorityFilter, sortBy]);

  const taskColumns: ColumnsType<BonitaTask> = [
    {
      title: 'Task',
      dataIndex: 'displayName',
      render: (v: string | undefined, r) => {
        const overdueFlag = isOverdue(r);
        return (
          <div className="task-cell">
            <span
              className="priority-dot"
              style={{ background: PRIORITY_META[r.priority as Priority]?.color ?? '#909399' }}
            />
            <div>
              <div className="task-name">
                {v || r.name}
                {overdueFlag && <Tag color="red" className="overdue-tag" icon={<AlertOutlined />}>Overdue</Tag>}
                {!overdueFlag && isDueToday(r) && <Tag color="orange" className="overdue-tag">Today</Tag>}
              </div>
              {r.description && <Text type="secondary" className="task-desc">{r.description}</Text>}
            </div>
          </div>
        );
      },
    },
    { title: 'Priority', dataIndex: 'priority', width: 120,
      render: (p: string) => {
        const meta = PRIORITY_META[p as Priority] ?? PRIORITY_META.normal;
        return <Tag color={meta.antColor}>{meta.label}</Tag>;
      } },
    { title: 'Case', dataIndex: 'caseId', width: 100, render: (v: string) => <Text code>#{v}</Text> },
    { title: 'Due', dataIndex: 'dueDate', width: 180,
      render: (d?: string) => d ? new Date(d).toLocaleString() : <Text type="secondary">—</Text> },
    { title: '', width: 100,
      render: (_, r) => <Button size="small" onClick={() => setDetailTask(r)}>Details</Button> },
  ];

  const processColumns: ColumnsType<BonitaProcess> = [
    {
      title: 'Process',
      dataIndex: 'displayName',
      render: (v: string | undefined, r) => (
        <div>
          <div><strong>{v || r.name}</strong> <Text code>v{r.version}</Text></div>
          {r.description && <Text type="secondary" style={{ fontSize: 12 }}>{r.description}</Text>}
        </div>
      ),
    },
    { title: 'Status', dataIndex: 'activationState', width: 110,
      render: (s: string) => <Tag color={s === 'ENABLED' ? 'green' : 'default'}>{s}</Tag> },
    { title: 'Deployed', dataIndex: 'deploymentDate', width: 170,
      render: (d: string) => new Date(d).toLocaleDateString() },
  ];

  const caseColumns: ColumnsType<BonitaCase> = [
    { title: 'Case', dataIndex: 'id', width: 80, render: (v: string) => <Text code>#{v}</Text> },
    { title: 'Started', dataIndex: 'start', width: 180,
      render: (d: string) => new Date(d).toLocaleString() },
    { title: 'Started by', dataIndex: 'started_by', width: 120,
      render: (v: string | undefined) => v || <Text type="secondary">—</Text> },
    { title: 'Process', dataIndex: 'processDefinitionId', width: 120,
      render: (v: string) => <Text code>{v}</Text> },
  ];

  const distributionEntries = PRIORITIES.map((p) => ({
    priority: p,
    count: stats.distribution[p],
    pct: Math.round((stats.distribution[p] / Math.max(1, tasks.length)) * 100),
    color: PRIORITY_META[p].color,
    label: PRIORITY_META[p].label,
  }));

  return (
    <div className="dashboard">
      {/* TOP KPI ROW — Bonita-wide */}
      <Row gutter={[16, 16]} className="kpi-row">
        <Col xs={12} md={6}>
          <Card className="kpi-card">
            <Statistic
              title="Active processes"
              value={enabledProcesses}
              suffix={processesTotal > 0 ? <Text type="secondary"> / {processesTotal}</Text> : null}
              prefix={<ApartmentOutlined style={{ color: '#722ED1' }} />}
            />
            <Text type="secondary" className="kpi-sub">Deployed and enabled</Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="kpi-card">
            <Statistic
              title="Open cases"
              value={openCasesTotal >= 0 ? openCasesTotal : openCases.length}
              prefix={<FolderOpenOutlined style={{ color: '#3498db' }} />}
            />
            <Text type="secondary" className="kpi-sub">In-flight process instances</Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="kpi-card">
            <Statistic
              title="Closed today"
              value={closedTodayTotal >= 0 ? closedTodayTotal : closedToday.length}
              prefix={<CheckCircleOutlined style={{ color: '#16a085' }} />}
            />
            <Text type="secondary" className="kpi-sub">Cases archived since 00:00</Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="kpi-card">
            <Statistic
              title="My tasks"
              value={tasksTotal}
              prefix={<RocketOutlined style={{ color: '#e67e22' }} />}
            />
            <Text type="secondary" className="kpi-sub">Pending in my inbox</Text>
          </Card>
        </Col>
      </Row>

      {/* SECONDARY KPI ROW — Tasks-focused */}
      <Row gutter={[16, 16]} className="kpi-row kpi-row-secondary">
        <Col xs={8}>
          <Card className={`kpi-card kpi-mini ${stats.overdue > 0 ? 'kpi-warn' : ''}`}>
            <Statistic
              title="Overdue"
              value={stats.overdue}
              valueStyle={{ color: stats.overdue > 0 ? '#c0392b' : undefined }}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card className="kpi-card kpi-mini">
            <Statistic
              title="Due today"
              value={stats.dueToday}
              prefix={<CalendarOutlined style={{ color: '#e67e22' }} />}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card className="kpi-card kpi-mini">
            <Statistic
              title="High priority"
              value={stats.highPriority}
              prefix={<FireOutlined style={{ color: '#e67e22' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* DISTRIBUTION CHART */}
      <Card
        className="distribution-card"
        title={<Space><ExclamationCircleOutlined /><span>Task priority distribution</span></Space>}
      >
        {tasks.length === 0 ? (
          <Empty description="No tasks to chart" />
        ) : (
          <div className="distribution-bars">
            {distributionEntries.map((e) => (
              <Tooltip key={e.priority} title={`${e.count} task${e.count === 1 ? '' : 's'} (${e.pct}%)`}>
                <div className="dist-row">
                  <div className="dist-label">
                    <span className="priority-dot" style={{ background: e.color }} />
                    <span>{e.label}</span>
                  </div>
                  <div className="dist-bar-track">
                    <div
                      className="dist-bar-fill"
                      style={{ width: `${(e.count / stats.maxCount) * 100}%`, background: e.color }}
                    />
                  </div>
                  <div className="dist-count">{e.count}</div>
                </div>
              </Tooltip>
            ))}
          </div>
        )}
      </Card>

      {/* TABS: Tasks / Cases / Processes */}
      <Card className="data-tabs-card">
        <Tabs
          defaultActiveKey="tasks"
          items={[
            {
              key: 'tasks',
              label: <span><ClockCircleOutlined /> My tasks ({visibleTasks.length})</span>,
              children: (
                <>
                  {snapshot?.tasks.error && (
                    <Alert
                      type="error"
                      showIcon
                      message="Failed to load tasks"
                      description={snapshot.tasks.error}
                      style={{ marginBottom: 16 }}
                    />
                  )}
                  <Space wrap style={{ marginBottom: 16 }}>
                    <Input
                      prefix={<SearchOutlined />}
                      placeholder="Search by name or case…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      allowClear
                      style={{ width: 240 }}
                    />
                    <Select<Priority | 'all'>
                      value={priorityFilter}
                      onChange={(v) => setPriorityFilter(v)}
                      style={{ width: 150 }}
                      options={[
                        { value: 'all', label: 'All priorities' },
                        ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label })),
                      ]}
                    />
                    <Select
                      value={sortBy}
                      onChange={setSortBy}
                      style={{ width: 140 }}
                      options={[
                        { value: 'priority', label: 'By priority' },
                        { value: 'dueDate', label: 'By due date' },
                        { value: 'name', label: 'By name' },
                      ]}
                    />
                    <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                      Refresh all
                    </Button>
                  </Space>
                  <Table<BonitaTask>
                    rowKey="id"
                    columns={taskColumns}
                    dataSource={visibleTasks}
                    loading={loading}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    rowClassName={(r) => (isOverdue(r) ? 'row-overdue' : '')}
                    locale={{
                      emptyText: tasks.length === 0
                        ? 'No pending tasks. Enjoy the silence.'
                        : 'No tasks match the current filters.',
                    }}
                  />
                </>
              ),
            },
            {
              key: 'cases',
              label: <span><FolderOpenOutlined /> Open cases ({openCases.length})</span>,
              children: (
                <>
                  {snapshot?.openCases.error && (
                    <Alert
                      type="warning"
                      showIcon
                      message="Limited access"
                      description={`Could not load cases: ${snapshot.openCases.error}. You may not have permission to list them.`}
                      style={{ marginBottom: 16 }}
                    />
                  )}
                  <Table<BonitaCase>
                    rowKey="id"
                    columns={caseColumns}
                    dataSource={openCases}
                    loading={loading}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    locale={{ emptyText: 'No open cases' }}
                  />
                </>
              ),
            },
            {
              key: 'processes',
              label: <span><ApartmentOutlined /> Processes ({processes.length})</span>,
              children: (
                <>
                  {snapshot?.processes.error && (
                    <Alert
                      type="warning"
                      showIcon
                      message="Limited access"
                      description={`Could not list processes: ${snapshot.processes.error}.`}
                      style={{ marginBottom: 16 }}
                    />
                  )}
                  <Table<BonitaProcess>
                    rowKey="id"
                    columns={processColumns}
                    dataSource={processes}
                    loading={loading}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    locale={{ emptyText: 'No processes deployed' }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* TASK DETAIL MODAL */}
      <Modal
        title={detailTask?.displayName || detailTask?.name}
        open={detailTask !== null}
        onCancel={() => setDetailTask(null)}
        footer={null}
        width={520}
      >
        {detailTask && (
          <div className="task-detail">
            <Row gutter={[16, 12]}>
              <Col span={12}>
                <Text type="secondary">Priority</Text>
                <div>
                  <Tag color={PRIORITY_META[detailTask.priority as Priority]?.antColor}>
                    {PRIORITY_META[detailTask.priority as Priority]?.label || detailTask.priority}
                  </Tag>
                </div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Status</Text>
                <div><Text>{detailTask.state}</Text></div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Case ID</Text>
                <div><Text code>#{detailTask.caseId}</Text></div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Due date</Text>
                <div>
                  {detailTask.dueDate ? (
                    <>
                      {new Date(detailTask.dueDate).toLocaleString()}
                      {isOverdue(detailTask) && <Tag color="red" style={{ marginLeft: 8 }}>Overdue</Tag>}
                    </>
                  ) : (
                    <Text type="secondary">No due date</Text>
                  )}
                </div>
              </Col>
              {detailTask.description && (
                <Col span={24}>
                  <Text type="secondary">Description</Text>
                  <div><Text>{detailTask.description}</Text></div>
                </Col>
              )}
              <Col span={24}>
                <Text type="secondary">Task ID</Text>
                <div><Text code>{detailTask.id}</Text></div>
              </Col>
            </Row>
            <div className="detail-progress">
              <Text type="secondary">Time pressure</Text>
              <Progress
                percent={
                  isOverdue(detailTask) ? 100
                  : isDueToday(detailTask) ? 80
                  : detailTask.dueDate ? 40
                  : 10
                }
                strokeColor={
                  isOverdue(detailTask) ? '#c0392b'
                  : isDueToday(detailTask) ? '#e67e22'
                  : '#3498db'
                }
                showInfo={false}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
