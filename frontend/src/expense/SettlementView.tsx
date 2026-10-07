import { Button, Card, Col, Row, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { expenseApi } from './api';
import { CATEGORY_LABELS, SETTLEMENT_MODE_LABELS } from './constants';
import type { SettlementAdjustment, SettlementCategory, SettlementVoucher } from './types';

interface Props {
  tripId: number;
  refreshKey: number;
  onChanged: () => void;
}

export default function SettlementPanel({ tripId, refreshKey, onChanged }: Props) {
  const [view, setView] = useState<{ mode: string; categories: SettlementCategory[] } | null>(null);

  const load = useCallback(async () => {
    try {
      setView(await expenseApi.settlementView(tripId));
    } catch (error) {
      message.error((error as Error).message);
    }
  }, [tripId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const settle = async (category: string) => {
    try {
      await expenseApi.settle(tripId, category);
      message.success('分项已结清，之后改单撤单不会回退该分项');
      onChanged();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const voucherColumns: ColumnsType<SettlementVoucher> = [
    { title: '凭证号', dataIndex: 'orderId', render: value => `#${value}` },
    { title: '垫付人', dataIndex: 'memberName' },
    { title: view?.mode === 'OVERWRITE' ? '当前金额' : '原凭证金额', dataIndex: 'amount', render: value => `¥${value}` },
    {
      title: '版本',
      dataIndex: 'version',
      render: (value, row) => <span>v{value}{row.overwritten ? <Tag color="purple">已覆盖</Tag> : null}</span>
    },
    { title: '状态', dataIndex: 'status', render: value => <Tag color={value === 'SETTLED' ? 'success' : 'default'}>{value}</Tag> }
  ];

  const adjustmentColumns: ColumnsType<SettlementAdjustment> = [
    { title: '调整单号', dataIndex: 'adjustmentId', render: value => `#${value}` },
    { title: '关联原凭证', dataIndex: 'advanceOrderId', render: value => `#${value}` },
    {
      title: '调整差额',
      dataIndex: 'deltaAmount',
      render: value => <Tag color={value >= 0 ? 'green' : 'red'}>{value >= 0 ? '+' : ''}¥{value}</Tag>
    },
    { title: '原因', dataIndex: 'reason' }
  ];

  if (!view) return <Card loading />;

  return (
    <Card title={`结算页 · 当前模式：${SETTLEMENT_MODE_LABELS[view.mode] ?? view.mode}`}>
      <Row gutter={[16, 16]}>
        {view.categories.map(category => (
          <Col span={12} key={category.category}>
            <Card
              type="inner"
              title={CATEGORY_LABELS[category.category] ?? category.category}
              extra={category.status === 'SETTLED'
                ? <Tag color="success">已结清</Tag>
                : <Button size="small" type="primary" onClick={() => settle(category.category)}>结清该分项</Button>}
            >
              <h4>{view.mode === 'ADJUSTMENT' ? '原凭证（结清后保持不变）' : '凭证（覆盖旧单，显示最新值）'}</h4>
              <Table rowKey="orderId" size="small" columns={voucherColumns} dataSource={category.vouchers} pagination={false} locale={{ emptyText: '暂无凭证' }} />
              {view.mode === 'ADJUSTMENT' && (
                <>
                  <h4 style={{ marginTop: 12 }}>调整单（结清后的改单/撤单另开此单）</h4>
                  <Table rowKey="adjustmentId" size="small" columns={adjustmentColumns} dataSource={category.adjustments} pagination={false} locale={{ emptyText: '暂无调整单' }} />
                </>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
}
