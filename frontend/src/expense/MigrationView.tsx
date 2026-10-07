import { Button, Card, Col, List, Row, Tag, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { expenseApi } from './api';
import { CATEGORY_LABELS } from './constants';
import type { MigrationView } from './types';

interface Props {
  tripId: number;
  refreshKey: number;
  onChanged: () => void;
}

export default function MigrationPanel({ tripId, refreshKey, onChanged }: Props) {
  const [view, setView] = useState<MigrationView | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      setView(await expenseApi.migrationView(tripId));
    } catch (error) {
      message.error((error as Error).message);
    }
  }, [tripId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const migrate = async () => {
    setRunning(true);
    try {
      const result = await expenseApi.migrate(tripId);
      message.success(`升级完成：补齐 ${result.migrated} 条，补不出单列 ${result.unfillable} 条`);
      await load();
      onChanged();
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setRunning(false);
    }
  };

  if (!view) return <Card loading />;

  return (
    <Card
      title="旧数据升级：按行程人数补齐分摊人，按总预算各分项剩余额度补齐分项"
      extra={<Button type="primary" loading={running} disabled={view.pending.length === 0} onClick={migrate}>运行升级</Button>}
    >
      <Row gutter={16}>
        <Col span={8}>
          <h4>待升级（{view.pending.length}）</h4>
          <List
            size="small"
            dataSource={view.pending}
            renderItem={item => <List.Item>¥{item.amount} · {item.note ?? '无备注'}</List.Item>}
          />
        </Col>
        <Col span={8}>
          <h4>已补齐（{view.migrated.length}）</h4>
          <List
            size="small"
            dataSource={view.migrated}
            renderItem={item => (
              <List.Item>
                ¥{item.amount} · {item.note ?? '无备注'} <Tag color="success">{CATEGORY_LABELS[item.migratedCategory ?? ''] ?? item.migratedCategory}</Tag>
              </List.Item>
            )}
          />
        </Col>
        <Col span={8}>
          <h4>补不出单列（{view.unfillable.length}）</h4>
          <List
            size="small"
            dataSource={view.unfillable}
            renderItem={item => (
              <List.Item>
                ¥{item.amount} · {item.note ?? '无备注'} <Tag color="error">{item.failReason}</Tag>
              </List.Item>
            )}
          />
        </Col>
      </Row>
    </Card>
  );
}
