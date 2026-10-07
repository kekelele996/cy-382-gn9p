import { ValueTransformer } from 'typeorm';

/**
 * 数据库 DECIMAL 列按「元」存储，应用层统一用「分」整数对账，避免浮点误差：
 * - 写入（分 -> 元字符串）；
 * - 读取（元 -> 分整数）。
 */
export const decimalTransformer: ValueTransformer = {
  to: (cents?: number | null) => {
    if (cents === null || cents === undefined) return cents;
    return (Math.round(cents) / 100).toFixed(2);
  },
  from: (yuan?: string | number | null): number => {
    if (yuan === null || yuan === undefined) return 0;
    return Math.round(Number(yuan) * 100);
  }
};

/** 元转分（四舍五入） */
export const toCents = (yuan: number): number => Math.round(yuan * 100);
/** 分转元显示 */
export const toYuan = (cents: number): number => Math.round(cents) / 100;
