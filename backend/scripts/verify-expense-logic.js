/* eslint-disable */
// 分账核心逻辑冒烟校验：npm run build && npm run verify:expense
const assert = require('node:assert');
const { reconcile, calcSpent } = require('../dist/modules/expense/domain/reconcile.logic');
const { AccountStatus } = require('../dist/constants/expense');
const { backfillLegacy } = require('../dist/modules/expense/domain/backfill.logic');
const { LegacyStatus } = require('../dist/constants/expense');

const cats = [
  { category: 'TRANSPORT', planned: 10000, actualAmount: 5000, status: 'PENDING' },
  { category: 'LODGING', planned: 10000, actualAmount: 3000, status: 'PENDING' },
  { category: 'FOOD', planned: 10000, actualAmount: 0, status: 'PENDING' },
  { category: 'TICKET', planned: 10000, actualAmount: 2000, status: 'SETTLED' }
];
let slips = [
  { category: 'TRANSPORT', amount: 5000, status: 'REPORTED' },
  { category: 'LODGING', amount: 2500, status: 'REPORTED' },
  { category: 'TICKET', amount: 1, status: 'SETTLED' }
];

let s = reconcile(cats, slips);
assert.strictEqual(s[0].status, AccountStatus.Matched, '垫付合计=实际花费应对账相符');
assert.strictEqual(s[1].status, AccountStatus.Suspended, '对不上应挂起');
assert.strictEqual(s[2].status, AccountStatus.Pending, '两边都没数应待对账');
assert.strictEqual(calcSpent(s), 7000, '挂起不计入已花，结清按实际花费计入');

// 成员改金额：未结清按新数重算
slips[0].amount = 4200;
s = reconcile(cats, slips);
assert.strictEqual(s[0].status, AccountStatus.Suspended);
assert.strictEqual(calcSpent(s), 2000);

// 撤单后按剩余单重算
slips[0].status = 'WITHDRAWN';
assert.strictEqual(reconcile(cats, slips)[0].status, AccountStatus.Suspended);

// 已结清分项不回退
assert.strictEqual(reconcile(cats, slips)[3].status, AccountStatus.Settled);

// 旧数据升级补齐
assert.strictEqual(backfillLegacy({ amount: 10000, totalBudget: 40000, categories: cats, memberIds: [] }).status, LegacyStatus.Unresolved);
const filled = backfillLegacy({ amount: 10003, totalBudget: 40000, categories: cats, memberIds: [1, 2] });
assert.strictEqual(filled.status, LegacyStatus.Filled);
assert.strictEqual(filled.allocations.reduce((a, b) => a + b.amount, 0), 10003, '拆分后总额不变（尾差已处理）');
assert.deepStrictEqual(filled.sharerMemberIds, [1, 2], '分摊人按同行人数补齐');
assert.strictEqual(
  backfillLegacy({ amount: 10000, totalBudget: 0, categories: cats.map(c => ({ category: c.category, planned: 0 })), memberIds: [1] }).status,
  LegacyStatus.Unresolved,
  '计划数全缺补不出应单列'
);

console.log('expense domain logic: all checks passed');
