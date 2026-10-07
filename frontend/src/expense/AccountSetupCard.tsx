import { Button, Card, Form, InputNumber, message } from 'antd';
import { useState } from 'react';
import { expenseApi } from './expenseApi';
import { CATEGORY_LABELS, CATEGORY_ORDER, formatYuan, type AccountOverview } from './types';

/** 发起人定总预算和四项计划数 */
export function AccountSetupCard({ tripId, overview, onDone }: { tripId: number; overview: AccountOverview; onDone: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const v = await form.validateFields();
    const planned: Record<string, number> = {};
    for (const c of CATEGORY_ORDER) planned[c] = v[c];
    if (CATEGORY_ORDER.reduce((s, c) => s + v[c], 0) !== v.totalBudget) {
      message.error('四项计划数之和必须等于总预算');
      return;
    }
    setSaving(true);
    try {
      await expenseApi.setupAccount(tripId, { totalBudget: v.totalBudget, planned });
      message.success('行程账已设定');
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const initialPlanned = overview.accountInitialized
    ? Object.fromEntries(overview.categories.map(c => [c.category, c.planned]))
    : undefined;

  return (
    <Card size="small" title={overview.accountInitialized ? '调整预算（已结清分项不会被改动）' : '设定行程账：总预算与四项计划数'}>
      <Form
        form={form}
        layout="inline"
        initialValues={overview.accountInitialized ? { totalBudget: overview.totalBudget, ...initialPlanned } : undefined}
      >
        <Form.Item name="totalBudget" label="总预算（元）" rules={[{ required: true }]}
          getValueFromEvent={(v: number | null) => Math.round((v ?? 0) * 100)}
          getValueProps={(v?: number) => ({ value: v === undefined ? undefined : v / 100 })}>
          <InputNumber min={0} precision={2} />
        </Form.Item>
        {CATEGORY_ORDER.map(c => (
          <Form.Item key={c} name={c} label={`${CATEGORY_LABELS[c]}计划`} rules={[{ required: true }]}
            getValueFromEvent={(v: number | null) => Math.round((v ?? 0) * 100)}
            getValueProps={(v?: number) => ({ value: v === undefined ? undefined : v / 100 })}>
            <InputNumber min={0} precision={2} />
          </Form.Item>
        ))}
        <Button type="primary" loading={saving} onClick={save}>保存</Button>
        <span style={{ marginLeft: 12, color: '#999' }}>当前合计 {formatYuan(CATEGORY_ORDER.reduce((s, c) => s + (form.getFieldValue(c) ?? 0), 0))}</span>
      </Form>
    </Card>
  );
}
