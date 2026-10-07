import { Button, Card, Checkbox, Form, Input, InputNumber, Modal, Popconfirm, Select, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { expenseApi } from './api';
import { ADVANCE_STATUS_TAGS, CATEGORY_LABELS, CATEGORY_OPTIONS } from './constants';
import type { AdvanceOrder } from './types';

interface Props {
  tripId: number;
  memberCount: number;
  refreshKey: number;
  onChanged: () => void;
}

export default function AdvanceOrdersPanel({ tripId, memberCount, refreshKey, onChanged }: Props) {
  const [orders, setOrders] = useState<AdvanceOrder[]>([]);
  const [editing, setEditing] = useState<AdvanceOrder | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editSplit, setEditSplit] = useState<number[]>([]);
  const [form] = Form.useForm();

  const memberOptions = Array.from({ length: memberCount }, (_, i) => ({ value: i + 1, label: `成员${i + 1}` }));

  const load = useCallback(async () => {
    try {
      setOrders(await expenseApi.listAdvances(tripId));
    } catch (error) {
      message.error((error as Error).message);
    }
  }, [tripId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const run = async (action: () => Promise<unknown>, ok: string) => {
    try {
      await action();
      message.success(ok);
      await load();
      onChanged();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const create = async () => {
    const values = await form.validateFields();
    await run(
      () => expenseApi.createAdvance(tripId, { ...values, failReport: values.failReport ?? false }),
      values.failReport ? '垫付单已登记（模拟上报失败，待重跑）' : '垫付单已上报并参与对账'
    );
    form.resetFields();
  };

  const openEdit = (order: AdvanceOrder) => {
    setEditing(order);
    setEditAmount(order.amount);
    setEditSplit(order.splitMembers);
  };

  const saveEdit = () => run(
    () => expenseApi.updateAdvance(editing!.id, { amount: editAmount, splitMembers: editSplit }).then(() => setEditing(null)),
    '垫付单已更新：未结清分项按新数重算，已结清分项按结算模式处理'
  );

  const columns: ColumnsType<AdvanceOrder> = [
    { title: '单号', dataIndex: 'id', width: 70 },
    { title: '垫付人', dataIndex: 'memberName' },
    { title: '分项', dataIndex: 'category', render: value => CATEGORY_LABELS[value] ?? value },
    { title: '金额', dataIndex: 'amount', render: value => `¥${value}` },
    { title: '分摊人', dataIndex: 'splitMembers', render: (value: number[]) => value.map(id => `成员${id}`).join('、') },
    {
      title: '状态',
      dataIndex: 'status',
      render: value => {
        const tag = ADVANCE_STATUS_TAGS[value] ?? { label: value, color: 'default' };
        return <Tag color={tag.color}>{tag.label}</Tag>;
      }
    },
    {
      title: '上报',
      dataIndex: 'reportStatus',
      render: value => (value === 'FAILED' ? <Tag color="error">上报失败</Tag> : <Tag color="success">已上报</Tag>)
    },
    {
      title: '版本',
      dataIndex: 'version',
      render: (value, order) => <span>v{value}{order.overwritten ? <Tag color="purple">已覆盖</Tag> : null}</span>
    },
    {
      title: '操作',
      key: 'action',
      render: (_, order) => (
        <span>
          {order.reportStatus === 'FAILED' && (
            <Button size="small" type="link" onClick={() => run(() => expenseApi.retryFailed(tripId, order.memberId), `已重跑成员${order.memberId} 的失败上报，行程账其余数据照旧`)}>
              重跑
            </Button>
          )}
          {order.status !== 'CANCELLED' && (
            <>
              <Button size="small" type="link" onClick={() => openEdit(order)}>改金额</Button>
              <Popconfirm title="确认撤销这张垫付单？" onConfirm={() => run(() => expenseApi.cancelAdvance(order.id), '垫付单已撤销')}>
                <Button size="small" type="link" danger>撤单</Button>
              </Popconfirm>
            </>
          )}
        </span>
      )
    }
  ];

  return (
    <Card title="垫付单">
      <Form form={form} layout="inline" initialValues={{ memberId: 1, category: 'TRANSPORT', amount: 100, splitMembers: [1, 2] }} style={{ marginBottom: 16 }}>
        <Form.Item name="memberId" label="垫付人" rules={[{ required: true }]}>
          <Select style={{ width: 110 }} options={memberOptions} onChange={value => form.setFieldValue('memberName', `成员${value}`)} />
        </Form.Item>
        <Form.Item name="memberName" label="昵称" rules={[{ required: true }]} initialValue="成员1">
          <Input style={{ width: 100 }} />
        </Form.Item>
        <Form.Item name="category" label="分项" rules={[{ required: true }]}>
          <Select style={{ width: 100 }} options={CATEGORY_OPTIONS} />
        </Form.Item>
        <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
          <InputNumber min={0.01} style={{ width: 120 }} />
        </Form.Item>
        <Form.Item name="splitMembers" label="分摊人" rules={[{ required: true }]}>
          <Select mode="multiple" style={{ minWidth: 180 }} options={memberOptions} />
        </Form.Item>
        <Form.Item name="failReport" valuePropName="checked">
          <Checkbox>模拟上报失败</Checkbox>
        </Form.Item>
        <Button type="primary" onClick={create}>开垫付单</Button>
      </Form>
      <Table rowKey="id" columns={columns} dataSource={orders} pagination={false} />
      <Modal title={`修改垫付单 #${editing?.id}`} open={editing !== null} onOk={saveEdit} onCancel={() => setEditing(null)}>
        <p>金额：<InputNumber min={0.01} value={editAmount} onChange={value => setEditAmount(value ?? 0)} /></p>
        <p>分摊人：<Select mode="multiple" style={{ width: '100%' }} value={editSplit} onChange={setEditSplit} options={memberOptions} /></p>
      </Modal>
    </Card>
  );
}
