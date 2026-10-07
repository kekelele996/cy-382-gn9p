import { Alert, Empty, InputNumber, Space, Tabs, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { expenseApi } from './expenseApi';
import { AccountSetupCard } from './AccountSetupCard';
import { LegacyPanel } from './LegacyPanel';
import { MemberPanel } from './MemberPanel';
import { OverviewPanel } from './OverviewPanel';
import { SettlementPanel } from './SettlementPanel';
import { SlipPanel } from './SlipPanel';
import type { AccountOverview, ExpenseSlip, LegacyExpense, TripMember } from './types';

const { Text } = Typography;

/** 行程分账页：行程账（发起人）+ 垫付单（成员）+ 结算 + 旧数据升级 */
export function ExpensePage() {
  const [tripId, setTripId] = useState(1);
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [slips, setSlips] = useState<ExpenseSlip[]>([]);
  const [legacy, setLegacy] = useState<LegacyExpense[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (id: number) => {
    setError(null);
    try {
      const [o, m, s, l] = await Promise.all([
        expenseApi.overview(id),
        expenseApi.listMembers(id),
        expenseApi.listSlips(id),
        expenseApi.listLegacy(id)
      ]);
      setOverview(o);
      setMembers(m);
      setSlips(s);
      setLegacy(l);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => { void refresh(tripId); }, [tripId, refresh]);

  if (!overview) {
    return (
      <Space direction="vertical" style={{ padding: 24 }}>
        <Space>
          <Text>行程 ID：</Text>
          <InputNumber min={1} value={tripId} onChange={v => v && setTripId(v)} />
        </Space>
        {error ? <Alert type="error" message={`加载失败：${error}（确认后端已启动且该行程已建账）`} /> : <Empty description="加载中…" />}
      </Space>
    );
  }

  const suspendedCount = overview.suspendedCategories.length;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%', padding: 16 }}>
      <Space>
        <Text strong>行程 ID：</Text>
        <InputNumber min={1} value={tripId} onChange={v => v && setTripId(v)} />
        <Text type="secondary">分账金额一律整数分存储，界面按元显示</Text>
      </Space>

      {suspendedCount > 0 && (
        <Alert type="warning" showIcon
          message={`有 ${suspendedCount} 个分项对账不符已挂起，垫付金额暂不计入已花，请在「结算台」处理`} />
      )}

      <AccountSetupCard tripId={tripId} overview={overview} onDone={() => refresh(tripId)} />

      <Tabs
        items={[
          {
            key: 'overview',
            label: '分项对账',
            children: <OverviewPanel tripId={tripId} overview={overview} onChanged={() => refresh(tripId)} />
          },
          {
            key: 'slips',
            label: `垫付单（${slips.length}）`,
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <MemberPanel tripId={tripId} members={members} onChanged={() => refresh(tripId)} />
                <SlipPanel tripId={tripId} members={members} slips={slips} onChanged={() => refresh(tripId)} />
              </Space>
            )
          },
          {
            key: 'settle',
            label: '结算台',
            children: <SettlementPanel tripId={tripId} overview={overview} members={members} onChanged={() => refresh(tripId)} />
          },
          {
            key: 'legacy',
            label: `旧数据升级（${legacy.filter(i => i.status === 'PENDING').length}）`,
            children: <LegacyPanel tripId={tripId} members={members} items={legacy} onChanged={() => refresh(tripId)} />
          }
        ]}
      />
    </Space>
  );
}
