import { DeleteOutlined, EditOutlined, RetweetOutlined } from '@ant-design/icons';
import {
  Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, message
} from 'antd';
import { useMemo, useState } from 'react';
import { expenseApi } from './expenseApi';
import { AmountInput } from './AmountInput';
import {
  CATEGORY_LABELS, CATEGORY_ORDER, SLIP_STATUS_META, formatYuan,
  type ExpenseCategory, type ExpenseSlip, type TripMember
} from './types';

type FormValues = {
  payerMemberId: number;
  category: ExpenseCategory;
  amount: number; // 分
  sharerMemberIds: number[];
  note?: string;
};

/** 垫付单：成员各自开单，写清金额、分项和分摊人；改单/撤单只影响未结清分项 */
export function SlipPanel({
  tripId, members, slips, onChanged
}: { tripId: number; members: TripMember[]; slips: ExpenseSlip[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseSlip | null>(null);
  const [form] = Form.useForm<FormValues>();

  const memberName = useMemo(() => new Map(members.map(m => [m.id, m.name])), [members]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };
  const openEdit = (slip: ExpenseSlip) => {
    setEditing(slip);
    form.setFieldsValue({
      payerMemberId: slip.payerMemberId,
      category: slip.category,
      amount: slip.amount,
      sharerMemberIds: slip.sharerMemberIds,
      note: slip.note
    });
    setOpen(true);
  };

  const submit = async () => {
    const v = await form.validateFields();
    if (editing) {
      await expenseApi.updateSlip(tripId, editing.id, {
        amount: v.amount, category: v.category, sharerMemberIds: v.sharerMemberIds, note: v.note
      });
      message.success('已按新数重算（已结清分项不动）');
    } else {
      await expenseApi.reportSlip(tripId, v);
      message.success('垫付单已上报');
    }
    setOpen(false);
    onChanged();
  };

  const withdraw = async (slip: ExpenseSlip) => {
    await expenseApi.withdrawSlip(tripId, slip.id);
    message.success('已撤单，未结清分项按剩余单重算');
    onChanged();
  };

  /** 模拟"成员上报失败只重跑他那几条"：挑两张单走批量接口，其中一张故意缺分摊人制造失败 */
  const simulateRetry = async () => {
    if (members.length < 1) {
      message.warning('请先添加成员');
      return;
    }
    const items = [
      { payerMemberId: members[0].id, category: 'FOOD', amount: 12000, sharerMemberIds: members.map(m => m.id), clientKey: `retry-${Date.now()}-ok` },
      { payerMemberId: members[0].id, category: 'FOOD', amount: 5000, sharerMemberIds: [], clientKey: `retry-${Date.now()}-bad` }
    ];
    const res = await expenseApi.batchReportSlips(tripId, items);
    message.info(`重跑完成：成功 ${res.accepted.length} 条，失败 ${res.failed.length} 条（只影响该成员这几条，行程账照旧）`);
    onChanged();
  };

  return (
    <Card
      size="small"
      title="成员垫付单"
      extra={<Space>
        <Button icon={<RetweetOutlined />} onClick={simulateRetry}>模拟失败重跑（仅本人那几条）</Button>
        <Button type="primary" onClick={openCreate}>开垫付单</Button>
      </Space>}
    >
      <Table<ExpenseSlip>
        rowKey="id" size="small" pagination={false} dataSource={slips}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '垫付人', dataIndex: 'payerName' },
          { title: '分项', dataIndex: 'category', render: c => CATEGORY_LABELS[c as ExpenseCategory] },
          { title: '金额', dataIndex: 'amount', render: (v: number, row) =>
              <span style={{ color: row.source === 'ADJUST' && v < 0 ? '#cf1322' : undefined }}>{formatYuan(v)}</span> },
          { title: '分摊人', dataIndex: 'sharerMemberIds', render: (ids: number[]) =>
              ids.map(id => memberName.get(id) ?? `#${id}`).join('、') },
          { title: '来源', dataIndex: 'source', render: (s: string) =>
              ({ MEMBER: <Tag>成员上报</Tag>, ADJUST: <Tag color="purple">调整单</Tag>, OVERWRITE: <Tag color="geekblue">覆盖单</Tag> }[s] ?? s) },
          { title: '状态', dataIndex: 'status', render: (s: keyof typeof SLIP_STATUS_META) => {
              const meta = SLIP_STATUS_META[s];
              return <Tag color={meta.color}>{meta.label}</Tag>;
            } },
          { title: '操作', width: 140, render: (_, row) => {
              const frozen = row.status === 'SETTLED' || row.status === 'SUPERSEDED';
              return frozen
                ? <Tag color="blue">已冻结/已覆盖</Tag>
                : (
                  <Space>
                    <Button size="small" icon={<EditOutlined />} disabled={row.status === 'WITHDRAWN'} onClick={() => openEdit(row)}>改</Button>
                    <Popconfirm title="撤单后该分项按剩余单重算，已结清不会回退。确认撤单？" onConfirm={() => withdraw(row)}>
                      <Button size="small" danger icon={<DeleteOutlined />} disabled={row.status === 'WITHDRAWN'}>撤</Button>
                    </Popconfirm>
                  </Space>
                );
            } }
        ]}
      />

      <Modal title={editing ? '修改垫付单' : '开垫付单'} open={open} onOk={submit} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ category: 'TRANSPORT' }}>
          <Form.Item name="payerMemberId" label="垫付人" rules={[{ required: true, message: '请选择垫付人' }]}>
            <Select options={members.map(m => ({ value: m.id, label: m.name }))} placeholder="谁垫的钱" />
          </Form.Item>
          <Form.Item name="category" label="分项" rules={[{ required: true }]}>
            <Select options={CATEGORY_ORDER.map(c => ({ value: c, label: CATEGORY_LABELS[c] }))} />
          </Form.Item>
          <AmountInput name="amount" />
          <Form.Item name="sharerMemberIds" label="分摊人" rules={[{ required: true, message: '请勾选分摊人' }]}>
            <Select mode="multiple" options={members.map(m => ({ value: m.id, label: m.name }))} placeholder="这笔钱摊给谁" />
          </Form.Item>
          <Form.Item name="note" label="备注"><Input /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
