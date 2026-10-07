import { Button, Card, Form, Input, Space, Table } from 'antd';
import { expenseApi } from './expenseApi';
import type { TripMember } from './types';

export function MemberPanel({
  tripId, members, onChanged
}: { tripId: number; members: TripMember[]; onChanged: () => void }) {
  const [form] = Form.useForm();
  const add = async () => {
    const v = await form.validateFields();
    await expenseApi.addMember(tripId, { name: v.name });
    form.resetFields();
    onChanged();
  };
  return (
    <Card size="small" title={`同行成员（${members.length} 人，分摊人候选）`} style={{ marginBottom: 12 }}>
      <Table<TripMember>
        rowKey="id" size="small" pagination={false} dataSource={members}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: '姓名', dataIndex: 'name' },
          { title: '角色', dataIndex: 'role', width: 120 }
        ]}
      />
      <Form form={form} layout="inline" style={{ marginTop: 12 }}>
        <Form.Item name="name" rules={[{ required: true, message: '请输入成员姓名' }]}>
          <Input placeholder="新成员姓名" />
        </Form.Item>
        <Space>
          <Button type="primary" onClick={add}>加入行程</Button>
        </Space>
      </Form>
    </Card>
  );
}
