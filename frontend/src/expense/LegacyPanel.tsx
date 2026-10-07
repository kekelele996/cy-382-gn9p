import { Button, Card, Form, Input, Popconfirm, Space, Table, Tag, message } from 'antd';
import { useState } from 'react';
import { expenseApi } from './expenseApi';
import { AmountInput } from './AmountInput';
import { formatYuan, type LegacyExpense, type TripMember } from './types';

const STATUS_META = {
  PENDING: { label: '待升级', color: 'default' },
  FILLED: { label: '已补齐', color: 'green' },
  UNRESOLVED: { label: '补不出·单列', color: 'red' }
} as const;

/** 旧数据没记分摊人和分项：按人数和总预算补齐，补不出的单列 */
export function LegacyPanel({
  tripId, members, items, onChanged
}: { tripId: number; members: TripMember[]; items: LegacyExpense[]; onChanged: () => void }) {
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const register = async () => {
    const v = await form.validateFields();
    await expenseApi.addLegacy(tripId, { amount: v.amount, payerName: v.payerName });
    message.success('旧数据已登记，等待升级补齐');
    form.resetFields();
    onChanged();
  };

  const upgrade = async (id: number) => {
    setBusy(true);
    try {
      const res = await expenseApi.upgradeLegacy(tripId, id, {});
      if (res.record.status === 'UNRESOLVED') {
        message.warning(`补不出：${res.record.reason}，已单列处理`);
      } else {
        message.success(`已按 ${members.length} 人补齐分摊人、按计划数比例拆出 ${res.createdSlipIds.length} 张垫付单`);
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card size="small" title={`旧数据升级（${items.filter(i => i.status === 'PENDING').length} 条待处理）`}>
      <Table<LegacyExpense>
        rowKey="id" size="small" pagination={false} dataSource={items}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '旧金额', dataIndex: 'amount', render: formatYuan },
          { title: '旧垫付人', dataIndex: 'payerName', render: v => v ?? '未知' },
          { title: '状态', dataIndex: 'status', render: (s: keyof typeof STATUS_META) => {
              const m = STATUS_META[s];
              return <Tag color={m.color}>{m.label}</Tag>;
            } },
          { title: '说明', render: (_, row) =>
              row.status === 'FILLED'
                ? <span>已生成垫付单 #{row.filledSlipId}，分摊人 {row.filledSharerMemberIds?.length ?? 0} 人</span>
                : row.status === 'UNRESOLVED'
                  ? <span style={{ color: '#cf1322' }}>{row.reason}</span>
                  : <span style={{ color: '#999' }}>缺分摊人和分项，升级时按同行人数与四项计划数补齐</span> },
          { title: '操作', width: 120, render: (_, row) =>
              row.status === 'PENDING'
                ? <Popconfirm title="按人数补齐分摊人、按计划数比例拆分分项；补不出会单列。继续？" onConfirm={() => upgrade(row.id)}>
                    <Button size="small" type="primary" ghost loading={busy}>升级补齐</Button>
                  </Popconfirm>
                : <Tag>已处理</Tag> }
        ]}
      />
      <Form form={form} layout="inline" style={{ marginTop: 12 }}>
        <Form.Item name="payerName" label="旧垫付人姓名（可选）">
          <Input style={{ width: 160 }} placeholder="例如：老王" />
        </Form.Item>
        <AmountInput name="amount" label="旧数据金额（元）" />
        <Space>
          <Button type="primary" onClick={register}>登记旧数据</Button>
        </Space>
      </Form>
    </Card>
  );
}
