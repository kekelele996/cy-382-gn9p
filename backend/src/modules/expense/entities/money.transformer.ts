import { ValueTransformer } from 'typeorm';

export const moneyTransformer: ValueTransformer = {
  to: (value?: number | null) => value ?? null,
  from: (value?: string | null) => (value === null || value === undefined ? null : Number(value))
};

export const toCents = (amount: number): number => Math.round(amount * 100);
