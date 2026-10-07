import { Form, InputNumber } from 'antd';
import { yuanToCents } from './types';

/** 金额输入：界面填元，表单值存分 */
export function AmountInput({ name, label = '金额（元）' }: { name: (string | number)[] | string; label?: string }) {
  return (
    <Form.Item
      name={name}
      label={label}
      rules={[{ required: true, message: '请输入金额' }]}
      getValueFromEvent={(v: number | null) => yuanToCents(v)}
      getValueProps={(v?: number) => ({ value: v === undefined || v === null ? undefined : v / 100 })}
    >
      <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0.00" />
    </Form.Item>
  );
}
