import { Card, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { expenseApi } from './api';
import { CATEGORY_LABELS, RECONCILE_STATE_TAGS } from './constants';
import type { ReconcileCategory } from './types';

interface Props {
  tripId: number;
  refreshKey: number;
}

export default function ReconcilePanel({ tripId, refreshKey }: Props) {
  const [rows, setRows] = useState<ReconcileCategory[]>([]);

  const load = useCallback(async () => {
    try {
      setRows(await expenseApi.reconcileView(tripId));
    } catch (error) {
      message.error((error as Error).message);
    }
  }, [tripId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const columns: ColumnsType<ReconcileCategory> = [
    { title: '分项', dataIndex: 'category', render: value => CATEGORY_LABELS[value] ?? value },
    { title: '计划数', dataIndex: 'planned', render: value => `¥${value}` },
    { title: '行程账实际花费', dataIndex: 'actual', render: value => `¥${value}` },
    { title: '垫付合计', dataIndex: 'advanceTotal', render: value => `¥${value}` },
    { title: '已入帐（已花）', dataIndex: 'matched', render: value => `¥${value}` },
    { title: '挂起金额', dataIndex: 'suspendedTotal', render: value => `¥${value}` },
    { title: '差额', dataIndex: 'diff', render: value => `¥${value}` },
    {
      title: '对账状态',
      dataIndex: 'state',
      render: value => {
        const tag = RECONCILE_STATE_TAGS[value] ?? { label: value, color: 'default' };
        return <Tag color={tag.color}>{tag.label}</Tag>;
      }
    }
  ];

  return (
    <Card title="按分项对账：垫付合计对不上行程账实际花费的，先挂起且不计入已花金额">
      <Table
        rowKey="category"
        columns={columns}
        dataSource={rows}
        pagination={false}
        expandable={{
          rowExpandable: row => row.suspendedOrders.length > 0,
          expandedRowRender: row => (
            <ul style={{ margin: 0 }}>
              {row.suspendedOrders.map(order => (
                <li key={order.id}>垫付单 #{order.id} · {order.memberName} · ¥{order.amount}（超出该分项实际花费，已挂起）</li>
              ))}
            </ul>
          )
        }}
      />
    </Card>
  );
}
