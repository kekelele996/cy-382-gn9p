import { Button, Card, InputNumber, Radio, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { expenseApi } from './api';
import { CATEGORY_LABELS, SETTLEMENT_MODE_LABELS } from './constants';
import type { LedgerItem, LedgerOverview } from './types';

interface Props {
  overview: LedgerOverview;
  onChanged: () => void;
}

export default function LedgerOverviewPanel({ overview, onChanged }: Props) {
  const [actuals, setActuals] = useState<Record<string, number>>({});

  const saveActual = async (category: string) => {
    try {
      await expenseApi.recordActual(overview.tripId, category, actuals[category] ?? 0);
      message.success('实际花费已录入并按分项对账');
      onChanged();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const switchMode = async (mode: string) => {
    try {
      await expenseApi.updateMode(overview.tripId, mode);
      message.success('结算模式已切换');
      onChanged();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const columns: ColumnsType<LedgerItem> = [
    { title: '分项', dataIndex: 'category', render: value => CATEGORY_LABELS[value] ?? value },
    { title: '计划数', dataIndex: 'planned', render: value => `¥${value}` },
    { title: '实际花费（对账目标）', dataIndex: 'actual', render: value => `¥${value}` },
    { title: '已花金额（入帐垫付）', dataIndex: 'matched', render: value => `¥${value}` },
    { title: '剩余预算', dataIndex: 'remaining', render: value => `¥${value}` },
    {
      title: '状态',
      dataIndex: 'status',
      render: value => (value === 'SETTLED' ? <Tag color="success">已结清</Tag> : <Tag>未结清</Tag>)
    },
    {
      title: '录入实际花费',
      key: 'action',
      render: (_, item) => (
        <span>
          <InputNumber
            min={0}
            disabled={item.status === 'SETTLED'}
            placeholder={String(item.actual)}
            value={actuals[item.category]}
            onChange={value => setActuals(prev => ({ ...prev, [item.category]: value ?? 0 }))}
          />
          <Button style={{ marginLeft: 8 }} disabled={item.status === 'SETTLED'} onClick={() => saveActual(item.category)}>
            保存并对账
          </Button>
        </span>
      )
    }
  ];

  return (
    <Card
      title={`行程账 #${overview.id} · 总预算 ¥${overview.totalBudget} · ${overview.memberCount} 人`}
      extra={
        <Radio.Group
          value={overview.settlementMode}
          onChange={event => switchMode(event.target.value)}
          options={Object.entries(SETTLEMENT_MODE_LABELS).map(([value, label]) => ({ value, label }))}
          optionType="button"
        />
      }
    >
      <Table rowKey="category" columns={columns} dataSource={overview.items} pagination={false} />
    </Card>
  );
}
