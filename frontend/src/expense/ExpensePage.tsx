import { Alert, Button, Card, Form, InputNumber, Radio, Select, Space, Tabs, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { expenseApi } from './api';
import AdvanceOrdersPanel from './AdvanceOrders';
import LedgerOverviewPanel from './LedgerOverview';
import MigrationPanel from './MigrationView';
import ReconcilePanel from './ReconcileView';
import SettlementPanel from './SettlementView';
import { CATEGORY_OPTIONS, SETTLEMENT_MODE_LABELS } from './constants';
import type { LedgerOverview } from './types';

export default function ExpensePage() {
  const [tripId, setTripId] = useState(1);
  const [overview, setOverview] = useState<LedgerOverview | null>(null);
  const [missing, setMissing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form] = Form.useForm();

  const reload = useCallback(async () => {
    try {
      setOverview(await expenseApi.overview(tripId));
      setMissing(false);
    } catch {
      setOverview(null);
      setMissing(true);
    }
  }, [tripId]);

  useEffect(() => { void reload(); }, [reload, refreshKey]);

  const changed = () => setRefreshKey(key => key + 1);

  const createLedger = async () => {
    const values = await form.validateFields();
    try {
      await expenseApi.createLedger({
        tripId,
        totalBudget: values.totalBudget,
        memberCount: values.memberCount,
        settlementMode: values.settlementMode,
        plans: CATEGORY_OPTIONS.map(option => ({ category: option.value, planned: values[`plan_${option.value}`] ?? 0 }))
      });
      message.success('行程账已创建：总预算与四项计划数已入账');
      changed();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  if (missing) {
    return (
      <Card title={`行程 ${tripId} 还没有行程账，请先创建`}>
        <Space style={{ marginBottom: 16 }}>
          <span>行程号：</span>
          <Select value={tripId} style={{ width: 120 }} options={[1, 2, 3].map(id => ({ value: id, label: `行程 ${id}` }))} onChange={setTripId} />
        </Space>
        <Alert style={{ marginBottom: 16 }} type="info" message="行程发起人在此定总预算和交通/住宿/餐饮/门票四项计划数，并选择结算方式。" />
        <Form
          form={form}
          layout="vertical"
          className="form"
          initialValues={{ totalBudget: 8000, memberCount: 4, settlementMode: 'ADJUSTMENT', plan_TRANSPORT: 2000, plan_LODGING: 2400, plan_FOOD: 2400, plan_TICKET: 1200 }}
        >
          <Form.Item name="totalBudget" label="总预算" rules={[{ required: true }]}><InputNumber min={1} style={{ width: 200 }} /></Form.Item>
          <Form.Item name="memberCount" label="行程人数" rules={[{ required: true }]}><InputNumber min={1} style={{ width: 200 }} /></Form.Item>
          {CATEGORY_OPTIONS.map(option => (
            <Form.Item key={option.value} name={`plan_${option.value}`} label={`${option.label}计划数`} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 200 }} />
            </Form.Item>
          ))}
          <Form.Item name="settlementMode" label="结算方式" rules={[{ required: true }]}>
            <Radio.Group options={Object.entries(SETTLEMENT_MODE_LABELS).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Button type="primary" onClick={createLedger}>创建行程账</Button>
        </Form>
      </Card>
    );
  }

  if (!overview) return <Card loading />;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Space>
        <span>行程号：</span>
        <Select
          value={tripId}
          style={{ width: 120 }}
          options={[1, 2, 3].map(id => ({ value: id, label: `行程 ${id}` }))}
          onChange={setTripId}
        />
      </Space>
      <Tabs
        items={[
          { key: 'ledger', label: '行程账', children: <LedgerOverviewPanel overview={overview} onChanged={changed} /> },
          { key: 'advances', label: '垫付单', children: <AdvanceOrdersPanel tripId={tripId} memberCount={overview.memberCount} refreshKey={refreshKey} onChanged={changed} /> },
          { key: 'reconcile', label: '对账', children: <ReconcilePanel tripId={tripId} refreshKey={refreshKey} /> },
          { key: 'settlement', label: '结算', children: <SettlementPanel tripId={tripId} refreshKey={refreshKey} onChanged={changed} /> },
          { key: 'migration', label: '数据升级', children: <MigrationPanel tripId={tripId} refreshKey={refreshKey} onChanged={changed} /> }
        ]}
      />
    </Space>
  );
}
