import { Button, InputNumber, Popconfirm, Space, Statistic, Table, Tag, message } from 'antd';
import { useState } from 'react';
import { expenseApi } from './expenseApi';
import {
  ACCOUNT_STATUS_META,
  CATEGORY_LABELS,
  formatYuan,
  type AccountOverview,
  type CategorySummary
} from './types';

/** 分项对账表：垫付合计与行程账实际花费按分项对账，挂起的不计入已花 */
export function OverviewPanel({ tripId, overview, onChanged }: { tripId: number; overview: AccountOverview; onChanged: () => void }) {
  const [draft, setDraft] = useState<Record<string, number | null>>({});

  const saveActual = async (row: CategorySummary) => {
    const value = draft[row.category];
    if (value === null || value === undefined) return;
    await expenseApi.setActual(tripId, row.category, Math.round(value * 100));
    message.success(`${CATEGORY_LABELS[row.category]}实际花费已登记`);
    setDraft(d => ({ ...d, [row.category]: null }));
    onChanged();
  };

  return (
    <div>
      <Space size="large" style={{ marginBottom: 16 }}>
        <Statistic title="总预算" value={formatYuan(overview.totalBudget)} />
        <Statistic title="已花（相符+已结清）" value={formatYuan(overview.spent)} valueStyle={{ color: '#3f8600' }} />
        <Statistic title="挂起金额（不计入已花）"
          value={formatYuan(overview.categories.filter(c => c.status === 'SUSPENDED').reduce((s, c) => s + c.actualAmount, 0))}
          valueStyle={{ color: '#d46b08' }} />
        <Statistic title="剩余预算" value={formatYuan(overview.remaining)}
          valueStyle={{ color: overview.remaining < 0 ? '#cf1322' : undefined }} />
      </Space>

      <Table<CategorySummary>
        rowKey="category"
        pagination={false}
        dataSource={overview.categories}
        columns={[
          { title: '分项', dataIndex: 'category', render: c => CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] },
          { title: '计划数', dataIndex: 'planned', render: formatYuan },
          { title: '行程账实际花费', dataIndex: 'actualAmount', render: formatYuan },
          { title: '垫付合计', dataIndex: 'advanceTotal', render: (v, row) =>
              <span style={{ color: row.difference === 0 ? undefined : '#cf1322' }}>{formatYuan(v)}</span> },
          { title: '差额（实际-垫付）', dataIndex: 'difference', render: (v: number) =>
              <span style={{ color: v === 0 ? '#3f8600' : '#cf1322' }}>{formatYuan(v)}</span> },
          { title: '对账状态', dataIndex: 'status', render: (s: keyof typeof ACCOUNT_STATUS_META) => {
              const meta = ACCOUNT_STATUS_META[s];
              return <Tag color={meta.color}>{meta.label}</Tag>;
            } },
          { title: '登记实际花费（元）', render: (_, row) =>
              row.status === 'SETTLED'
                ? <Tag color="blue">已冻结</Tag>
                : (
                  <Space>
                    <InputNumber
                      size="small" min={0} precision={2}
                      value={draft[row.category] ?? null}
                      placeholder={(row.actualAmount / 100).toFixed(2)}
                      onChange={v => setDraft(d => ({ ...d, [row.category]: v }))}
                    />
                    <Popconfirm title="按新数重算该分项对账？" onConfirm={() => saveActual(row)}>
                      <Button size="small" type="link">保存</Button>
                    </Popconfirm>
                  </Space>
                )
          }
        ]}
      />
    </div>
  );
}
