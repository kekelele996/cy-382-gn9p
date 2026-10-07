/* eslint-disable */
// 行程分账端到端冒烟：内存 SQLite + TypeORM + 真实服务与事务（不依赖 MySQL）
// 用法：npm run build && npm run verify:expense:integration
const assert = require('node:assert');
const { DataSource } = require('typeorm');
const { TripAccountEntity } = require('../dist/modules/expense/entities/trip-account.entity');
const { AccountCategoryEntity } = require('../dist/modules/expense/entities/account-category.entity');
const { TripMemberEntity } = require('../dist/modules/expense/entities/trip-member.entity');
const { ExpenseSlipEntity } = require('../dist/modules/expense/entities/expense-slip.entity');
const { ExpenseSettlementEntity } = require('../dist/modules/expense/entities/expense-settlement.entity');
const { LegacyExpenseEntity } = require('../dist/modules/expense/entities/legacy-expense.entity');
const { ReconcileService } = require('../dist/modules/expense/reconcile.service');
const { AccountService } = require('../dist/modules/expense/account.service');
const { MemberService } = require('../dist/modules/expense/member.service');
const { SlipService } = require('../dist/modules/expense/slip.service');
const { SettlementService } = require('../dist/modules/expense/settlement.service');
const { LegacyService } = require('../dist/modules/expense/legacy.service');

const expectThrow = async (fn, codePart) => {
  try { await fn(); throw new Error('应当抛错但没有'); }
  catch (e) { if (codePart) assert.ok(String(e.code || e.message).includes(codePart), `期望错误含 ${codePart}，实际：${e.code} ${e.message}`); }
};

(async () => {
  const ds = new DataSource({
    type: 'sqljs',
    synchronize: true,
    entities: [TripAccountEntity, AccountCategoryEntity, TripMemberEntity, ExpenseSlipEntity, ExpenseSettlementEntity, LegacyExpenseEntity]
  });
  await ds.initialize();

  const reconcile = new ReconcileService(ds.getRepository(TripAccountEntity), ds.getRepository(AccountCategoryEntity), ds.getRepository(ExpenseSlipEntity), ds);
  const accounts = new AccountService(ds.getRepository(TripAccountEntity), ds.getRepository(AccountCategoryEntity), reconcile, ds);
  const members = new MemberService(ds.getRepository(TripMemberEntity));
  const slips = new SlipService(ds.getRepository(ExpenseSlipEntity), ds.getRepository(AccountCategoryEntity), members, reconcile, ds);
  const settlements = new SettlementService(ds.getRepository(AccountCategoryEntity), ds.getRepository(ExpenseSlipEntity), ds.getRepository(ExpenseSettlementEntity), members, reconcile, ds);
  const legacy = new LegacyService(ds.getRepository(LegacyExpenseEntity), ds.getRepository(TripAccountEntity), ds.getRepository(AccountCategoryEntity), ds.getRepository(TripMemberEntity), ds.getRepository(ExpenseSlipEntity), reconcile);

  // 1. 发起人定总预算 400 元、四项计划数各 100 元（单位：分）
  const planned = { TRANSPORT: 10000, LODGING: 10000, FOOD: 10000, TICKET: 10000 };
  await accounts.setup({ tripId: 1, ownerId: 1, totalBudget: 40000, planned });
  await expectThrow(() => accounts.setup({ tripId: 9, ownerId: 1, totalBudget: 100, planned: { ...planned, TRANSPORT: 99 } }), 'VALIDATION_FAILED');

  // 2. 三名同行成员
  const m1 = await members.add(1, '我');
  const m2 = await members.add(1, '小王');
  const m3 = await members.add(1, '小李');
  const all = [m1.id, m2.id, m3.id];

  // 3. 餐饮分项：两边对得上 -> MATCHED；改金额 -> 按新数重算挂起；撤单 -> 继续按剩余单重算
  await accounts.setActual(1, 'FOOD', 3000);
  const s1 = await slips.report({ tripId: 1, payerMemberId: m1.id, category: 'FOOD', amount: 1500, sharerMemberIds: all, clientKey: 'food-1' });
  await slips.report({ tripId: 1, payerMemberId: m2.id, category: 'FOOD', amount: 1500, sharerMemberIds: all, clientKey: 'food-2' });
  let ov = await reconcile.getOverview(1);
  assert.strictEqual(ov.categories.find(c => c.category === 'FOOD').status, 'MATCHED');
  assert.strictEqual(ov.spent, 3000);

  await slips.update(s1.id, 1, { amount: 1200 });
  ov = await reconcile.getOverview(1);
  assert.strictEqual(ov.categories.find(c => c.category === 'FOOD').status, 'SUSPENDED', '改金额后对不上要挂起');
  assert.strictEqual(ov.spent, 0, '挂起不计入已花');

  await slips.withdraw(s1.id, 1);
  ov = await reconcile.getOverview(1);
  assert.strictEqual(ov.categories.find(c => c.category === 'FOOD').status, 'SUSPENDED', '撤单后仍不符，继续挂起');
  await slips.report({ tripId: 1, payerMemberId: m3.id, category: 'FOOD', amount: 1500, sharerMemberIds: all, clientKey: 'food-3' });
  ov = await reconcile.getOverview(1);
  assert.strictEqual(ov.categories.find(c => c.category === 'FOOD').status, 'MATCHED', '补单后重新相符');

  // 4. 幂等：同一 clientKey 原样重放不产生第二条（food-2 未变动）
  const replay = await slips.report({ tripId: 1, payerMemberId: m2.id, category: 'FOOD', amount: 1500, sharerMemberIds: all, clientKey: 'food-2' });
  assert.strictEqual(replay.id, s1.id + 1, '同幂等键原样重放只认一条');
  // 幂等键被其他内容占用要拒绝
  await expectThrow(
    () => slips.report({ tripId: 1, payerMemberId: m2.id, category: 'FOOD', amount: 999, sharerMemberIds: all, clientKey: 'food-2' }),
    'DUPLICATE_CLIENT_KEY'
  );

  // 5. 住宿：相符后 ADJUST 结清（差额 0，无调整单），随后冻结不回退
  await accounts.setActual(1, 'LODGING', 3000);
  const lodgeSlip = await slips.report({ tripId: 1, payerMemberId: m2.id, category: 'LODGING', amount: 3000, sharerMemberIds: all, clientKey: 'lodge-1' });
  const lodgeSettle = await settlements.settle({ tripId: 1, category: 'LODGING', mode: 'ADJUST', payerMemberId: m1.id });
  assert.strictEqual(lodgeSettle.difference, 0);
  assert.strictEqual(lodgeSettle.display.adjustmentSlip, null, '相符结清不开调整单');
  await expectThrow(() => slips.update(lodgeSlip.id, 1, { amount: 1 }), 'CATEGORY_LOCKED');
  await expectThrow(() => slips.withdraw(lodgeSlip.id, 1), 'CATEGORY_LOCKED');
  await expectThrow(() => accounts.setActual(1, 'LODGING', 9999), 'CATEGORY_LOCKED');
  ov = await reconcile.getOverview(1);
  assert.strictEqual(ov.categories.find(c => c.category === 'LODGING').status, 'SETTLED');
  assert.strictEqual(ov.spent, 6000, '餐饮 3000 + 已结清住宿 3000');

  // 6. 门票：垫付 1800 vs 实际 2000 挂起 -> ADJUST 差 200（交通场景改用覆盖式，这里先验证覆盖）
  await accounts.setActual(1, 'TICKET', 2000);
  const t1 = await slips.report({ tripId: 1, payerMemberId: m2.id, category: 'TICKET', amount: 900, sharerMemberIds: [m2.id, m3.id], clientKey: 'ticket-1' });
  await slips.report({ tripId: 1, payerMemberId: m3.id, category: 'TICKET', amount: 900, sharerMemberIds: [m2.id, m3.id], clientKey: 'ticket-2' });
  ov = await reconcile.getOverview(1);
  assert.strictEqual(ov.categories.find(c => c.category === 'TICKET').status, 'SUSPENDED');
  const ticketSettle = await settlements.settle({ tripId: 1, category: 'TICKET', mode: 'OVERWRITE', payerMemberId: m1.id });
  assert.strictEqual(ticketSettle.difference, 200);
  assert.strictEqual(ticketSettle.display.activeSlip.amount, 2000, '覆盖单金额=实际花费');
  assert.strictEqual(ticketSettle.display.supersededSlips.length, 2, '两张旧单被覆盖');
  ov = await reconcile.getOverview(1);
  assert.strictEqual(ov.spent, 8000, '门票按实际 2000 计入');
  assert.deepStrictEqual(ov.categories.find(c => c.category === 'TICKET').advanceTotal === 2000, true);
  // 被覆盖的旧单不能改/撤
  await expectThrow(() => slips.update(t1.id, 1, { amount: 1 }), 'CATEGORY_LOCKED');

  // 7. 交通：批量上报，失败只挂他那几条；成功的那条失败重跑走幂等
  await accounts.setActual(1, 'TRANSPORT', 1300);
  const batch = await slips.batchReport([
    { tripId: 1, payerMemberId: m1.id, category: 'TRANSPORT', amount: 1000, sharerMemberIds: all, clientKey: 'tr-ok' },
    { tripId: 1, payerMemberId: m1.id, category: 'TRANSPORT', amount: 500, sharerMemberIds: [], clientKey: 'tr-bad' }
  ]);
  assert.strictEqual(batch.accepted.length, 1, '一条成功');
  assert.strictEqual(batch.failed.length, 1, '一条失败且不影响其他条');
  assert.strictEqual(batch.failed[0].code, 'SHARER_INVALID');
  const rerun = await slips.batchReport([
    { tripId: 1, payerMemberId: m1.id, category: 'TRANSPORT', amount: 1000, sharerMemberIds: all, clientKey: 'tr-ok' },
    { tripId: 1, payerMemberId: m1.id, category: 'TRANSPORT', amount: 500, sharerMemberIds: [], clientKey: 'tr-bad-2' }
  ]);
  assert.strictEqual(rerun.accepted.length, 1);
  assert.strictEqual(rerun.accepted[0].id, batch.accepted[0].id, '重跑同一条走幂等，不重复入账');
  ov = await reconcile.getOverview(1);
  assert.strictEqual(ov.categories.find(c => c.category === 'TRANSPORT').status, 'SUSPENDED', '行程账照旧：1300 vs 垫付 1000 仍挂起');

  // 8. 交通用 ADJUST 结清，验证非零差额调整单（含负数情形另测）
  const trSettle = await settlements.settle({ tripId: 1, category: 'TRANSPORT', mode: 'ADJUST', payerMemberId: m2.id });
  assert.strictEqual(trSettle.difference, 300);
  assert.strictEqual(trSettle.display.adjustmentSlip.amount, 300);
  assert.strictEqual(trSettle.display.originalSlips.length, 1, '原凭证保留');
  ov = await reconcile.getOverview(1);
  assert.strictEqual(ov.spent, 9300);
  assert.strictEqual(ov.remaining, 40000 - 9300);

  // 8b. 行程 4：垫付超出实际 -> ADJUST 差额调整单为负数，原凭证保留
  await accounts.setup({ tripId: 4, ownerId: 1, totalBudget: 40000, planned });
  const m4 = await members.add(4, '阿强');
  await accounts.setActual(4, 'FOOD', 800);
  await slips.report({ tripId: 4, payerMemberId: m4.id, category: 'FOOD', amount: 1000, sharerMemberIds: [m4.id], clientKey: 't4-food' });
  const neg = await settlements.settle({ tripId: 4, category: 'FOOD', mode: 'ADJUST', payerMemberId: m4.id });
  assert.strictEqual(neg.difference, -200, '垫付 1000 超出实际 800，差额 -200');
  assert.strictEqual(neg.display.adjustmentSlip.amount, -200, '调整单为负数（冲回）');
  assert.strictEqual(neg.display.originalSlips.length, 1, '原凭证保留');
  const ov4 = await reconcile.getOverview(4);
  assert.strictEqual(ov4.spent, 800, '已花按实际花费 800 计，不按垫付 1000');

  // 9. 旧数据升级：400 元旧单，按 3 人补齐分摊人、按四项等比例拆分（尾差归最大分项）
  const old1 = await legacy.register(1, 40003, '我');
  const up1 = await legacy.upgrade(1, old1.id);
  assert.strictEqual(up1.record.status, 'FILLED');
  assert.strictEqual(up1.createdSlipIds.length, 4);
  const created = await ds.getRepository(ExpenseSlipEntity).findByIds(up1.createdSlipIds);
  assert.strictEqual(created.reduce((s, x) => s + x.amount, 0), 40003, '拆分总额守恒（含尾差）');
  assert.deepStrictEqual([...new Set(created.map(x => JSON.stringify(x.sharerMemberIds.sort())))].length, 1, '每张单分摊人都是全部成员');

  // 10. 补不出的旧数据：行程 2 有账没人 -> 单列；行程 3 有人没账 -> 单列
  await accounts.setup({ tripId: 2, ownerId: 1, totalBudget: 40000, planned });
  const old2 = await legacy.register(2, 10000);
  const up2 = await legacy.upgrade(2, old2.id);
  assert.strictEqual(up2.record.status, 'UNRESOLVED');
  assert.ok(up2.record.reason.includes('分摊人'));

  const mTrip3 = await members.add(3, '独行侠');
  const old3 = await legacy.register(3, 10000, mTrip3.name);
  const up3 = await legacy.upgrade(3, old3.id);
  assert.strictEqual(up3.record.status, 'UNRESOLVED');
  assert.ok(up3.record.reason.includes('比例'));

  console.log('expense integration smoke: all checks passed');
  await ds.destroy();
})().catch(e => { console.error(e); process.exit(1); });
