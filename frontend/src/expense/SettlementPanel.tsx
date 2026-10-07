import { Button, Card, Empty, Form, List, Modal, Radio, Select, Space, Table, Tag, message } from 'antd';
import { useState } from 'react';
import { expenseApi } from './expenseApi';
import {
  CATEGORY_LABELS, formatYuan,
  type AccountOverview, type ExpenseCategory, type SettleMode,
  type SettlementDetail, type TripMember
} from './types';

/** 结算页：挂起分项在这里结清；ADJUST 与 OVERWRITE 两种方式展示不一样 */
export function SettlementPanel({
  tripId, overview, members, onChanged
}: { tripId: number; overview: AccountOverview; members: TripMember[]; onChanged: () => void }) {
  const [form] = Form.useForm();
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [details, setDetails] = useState<Record<number, SettlementDetail>>({});

  const settle = async () => {
    const v = await form.validateFields();
    if (!category) return;
    await expenseApi.settle(tripId, {
      category,
      mode: v.mode,
      payerMemberId: v.payerMemberId,
      sharerMemberIds: v.sharerMemberIds
    });
    message.success('分项已结清并冻结');
    setCategory(null);
    form.resetFields();
    onChanged();
    await refreshDetails();
  };

  const refreshDetails = async () => {
    const records = await expenseApi.listSettlements(tripId);
    const map: Record<number, SettlementDetail> = {};
    await Promise.all(records.map(async r => {
      map[r.id] = await expenseApi.settlementDetail(tripId, r.id);
    }));
    setDetails(map);
  };

  const openSettle = (c: ExpenseCategory) => {
    setCategory(c);
    form.setFieldsValue({ mode: 'ADJUST', payerMemberId: members[0]?.id, sharerMemberIds: members.map(m => m.id) });
  };

  return (
    <Card size="small" title="结算台（结清后冻结，成员改单/撤单都不会回退）">
      <Table
        rowKey="category" size="small" pagination={false}
        dataSource={overview.categories}
        columns={[
          { title: '分项', dataIndex: 'category', render: (c: ExpenseCategory) => CATEGORY_LABELS[c] },
          { title: '实际花费', dataIndex: 'actualAmount', render: formatYuan },
          { title: '垫付合计', dataIndex: 'advanceTotal', render: formatYuan },
          { title: '差额', dataIndex: 'difference', render: (v: number) =>
              <span style={{ color: v === 0 ? '#3f8600' : '#cf1322' }}>{formatYuan(v)}</span> },
          { title: '状态', dataIndex: 'status', render: s =>
              s === 'SETTLED' ? <Tag color="blue">已结清</Tag>
                : s === 'SUSPENDED' ? <Tag color="orange">挂起待结算</Tag>
                : <Tag>{s === 'MATCHED' ? '相符可结清' : '待对账'}</Tag> },
          { title: '操作', render: (_, row) =>
              row.status === 'SETTLED'
                ? <Tag color="blue">冻结</Tag>
                : <Button size="small" type="primary" ghost disabled={row.actualAmount <= 0} onClick={() => openSettle(row.category)}>去结算</Button> }
        ]}
      />

      <div style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 8 }}>
          <h4 style={{ margin: 0 }}>已结算记录（展示方式随结算方式不同）</h4>
          <Button size="small" onClick={refreshDetails}>刷新明细</Button>
        </Space>
        {Object.keys(details).length === 0
          ? <Empty description="还没有结算记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          : <List
              size="small" bordered
              dataSource={Object.values(details)}
              renderItem={d => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <Space wrap>
                      <b>{CATEGORY_LABELS[d.category]}</b>
                      {d.mode === 'ADJUST'
                        ? <Tag color="purple">保留原凭证 + 另开调整单</Tag>
                        : <Tag color="geekblue">覆盖旧单（旧单作废保留）</Tag>}
                      <span>结清 {formatYuan(d.finalAmount)}</span>
                      <span style={{ color: d.difference === 0 ? '#3f8600' : '#d46b08' }}>差额 {formatYuan(d.difference)}</span>
                    </Space>
                    {d.mode === 'ADJUST' ? (
                      <div style={{ marginTop: 8 }}>
                        <div>原始凭证：{(d.display.originalSlips ?? []).map(s =>
                          <Tag key={s.id}>#{s.id} {s.payerName} {formatYuan(s.amount)}</Tag>)}</div>
                        <div>调整单：
                          {d.display.adjustmentSlip
                            ? <Tag color="purple">#{d.display.adjustmentSlip.id} {d.display.adjustmentSlip.payerName} {formatYuan(d.display.adjustmentSlip.amount)}</Tag>
                            : <span style={{ color: '#999' }}>对账相符，无需调整单</span>}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 8 }}>
                        <div>生效单：
                          {d.display.activeSlip && <Tag color="geekblue">#{d.display.activeSlip.id} {d.display.activeSlip.payerName} {formatYuan(d.display.activeSlip.amount)}</Tag>}
                        </div>
                        <div>被覆盖旧单：{(d.display.supersededSlips ?? []).map(s =>
                          <Tag key={s.id} color="default">#{s.id} {s.payerName} {formatYuan(s.amount)}（已作废）</Tag>)}</div>
                      </div>
                    )}
                  </div>
                </List.Item>
              )}
            />}
      </div>

      <Modal title={`结算：${category ? CATEGORY_LABELS[category] : ''}`} open={category !== null}
        onOk={settle} onCancel={() => setCategory(null)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="mode" label="结算方式" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="ADJUST">保留原凭证，另开调整单</Radio.Button>
              <Radio.Button value="OVERWRITE">覆盖旧单，新开合计单</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="payerMemberId" label="差额/新单垫付人" rules={[{ required: true }]}>
            <Select options={members.map(m => ({ value: m.id, label: m.name }))} />
          </Form.Item>
          <Form.Item name="sharerMemberIds" label="新单分摊人（不选则沿用旧单分摊人并集）">
            <Select mode="multiple" options={members.map(m => ({ value: m.id, label: m.name }))} allowClear />
          </Form.Item>
          <p style={{ color: '#999' }}>
            {form.getFieldValue('mode') === 'OVERWRITE'
              ? '覆盖式：旧垫付单全部标记"已被覆盖"不再参与合计，只保留一张合计单。'
              : '调整式：原始垫付单一笔不动，只补一张差额调整单（多退为负数）。'}
          </p>
        </Form>
      </Modal>
    </Card>
  );
}
