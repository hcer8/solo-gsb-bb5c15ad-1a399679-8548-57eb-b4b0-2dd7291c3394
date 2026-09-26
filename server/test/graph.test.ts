import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cycleAfterAdding, findCycle, findPath, findRedundantEdges, planPrune, queryOrder, topoLevels, topoOrder } from '../src/graph';

test('合法连线：不成环时返回 null', () => {
  const edges = [{ fromId: 'a', toId: 'b' }];
  assert.equal(cycleAfterAdding(edges, { fromId: 'b', toId: 'c' }), null);
});

test('成环连线：返回完整闭环节点序列', () => {
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' },
  ];
  // 新增 c → a 将构成 a → b → c → a
  assert.deepEqual(cycleAfterAdding(edges, { fromId: 'c', toId: 'a' }), ['c', 'a', 'b', 'c']);
});

test('自环立即被拒绝', () => {
  assert.deepEqual(cycleAfterAdding([], { fromId: 'a', toId: 'a' }), ['a', 'a']);
});

test('findPath：沿边方向找到路径', () => {
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' },
    { fromId: 'a', toId: 'c' },
  ];
  assert.deepEqual(findPath(edges, 'a', 'c'), ['a', 'c']);
  assert.equal(findPath(edges, 'c', 'a'), null);
});

test('topoLevels：按最长路径分层', () => {
  const levels = topoLevels(
    ['a', 'b', 'c', 'd'],
    [
      { fromId: 'a', toId: 'b' },
      { fromId: 'b', toId: 'c' },
      { fromId: 'a', toId: 'c' },
      { fromId: 'c', toId: 'd' },
    ],
  );
  assert.deepEqual(levels, { a: 0, b: 1, c: 2, d: 3 });
});

test('topoLevels：有环时返回 null', () => {
  const levels = topoLevels(
    ['a', 'b'],
    [
      { fromId: 'a', toId: 'b' },
      { fromId: 'b', toId: 'a' },
    ],
  );
  assert.equal(levels, null);
});

test('findCycle：在已有图中定位闭环', () => {
  const cycle = findCycle(
    ['a', 'b', 'c', 'd'],
    [
      { fromId: 'a', toId: 'b' },
      { fromId: 'b', toId: 'c' },
      { fromId: 'c', toId: 'a' },
      { fromId: 'c', toId: 'd' },
    ],
  );
  assert.ok(cycle);
  assert.equal(cycle![0], cycle![cycle!.length - 1]);
  assert.equal(cycle!.length, 4);
});

test('findCycle：无环返回 null', () => {
  const cycle = findCycle(
    ['a', 'b'],
    [{ fromId: 'a', toId: 'b' }],
  );
  assert.equal(cycle, null);
});

/* ---------- 传递约简（约束瘦身） ---------- */

test('findRedundantEdges：三角结构中的直达边冗余，并给出最短替代路径', () => {
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' },
    { fromId: 'a', toId: 'c' },
  ];
  const redundant = findRedundantEdges(edges);
  assert.equal(redundant.length, 1);
  assert.deepEqual(redundant[0].edge, { fromId: 'a', toId: 'c' });
  assert.deepEqual(redundant[0].path, ['a', 'b', 'c']);
});

test('findRedundantEdges：链式结构没有冗余边', () => {
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' },
  ];
  assert.deepEqual(findRedundantEdges(edges), []);
});

test('findRedundantEdges：菱形结构中替代路径取最短（边数最少）', () => {
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' },
    { fromId: 'c', toId: 'd' },
    { fromId: 'a', toId: 'e' },
    { fromId: 'e', toId: 'd' },
    { fromId: 'a', toId: 'd' },
  ];
  const redundant = findRedundantEdges(edges);
  assert.equal(redundant.length, 1);
  assert.deepEqual(redundant[0].edge, { fromId: 'a', toId: 'd' });
  // a→e→d（2 条边）比 a→b→c→d（3 条边）更短
  assert.deepEqual(redundant[0].path, ['a', 'e', 'd']);
});

test('findRedundantEdges：多条冗余边各自给出替代路径', () => {
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' },
    { fromId: 'a', toId: 'c' },
    { fromId: 'c', toId: 'd' },
    { fromId: 'a', toId: 'd' },
  ];
  const redundant = findRedundantEdges(edges);
  assert.deepEqual(
    redundant.map((r) => `${r.edge.fromId}->${r.edge.toId}`).sort(),
    ['a->c', 'a->d'],
  );
  const ad = redundant.find((r) => r.edge.toId === 'd')!;
  assert.deepEqual(ad.path, ['a', 'c', 'd']);
});

test('planPrune：逐条复核，跳过当前并不冗余的连线', () => {
  // a→b 冗余（替代路径 a→c→b）；a→c 从不冗余（忽略自身后 a 到不了 c）
  const edges = [
    { id: 1, fromId: 'a', toId: 'b' },
    { id: 2, fromId: 'a', toId: 'c' },
    { id: 3, fromId: 'c', toId: 'b' },
  ];
  const plan = planPrune(edges, [1, 2]);
  assert.deepEqual(plan.remove.map((e) => e.id), [1]);
  assert.deepEqual(plan.skipped, [2]);
});

test('planPrune：DAG 上所有冗余边无论请求顺序都会被移除（传递约简唯一）', () => {
  const edges = [
    { id: 1, fromId: 'a', toId: 'b' },
    { id: 2, fromId: 'b', toId: 'c' },
    { id: 3, fromId: 'a', toId: 'c' },
    { id: 4, fromId: 'c', toId: 'd' },
    { id: 5, fromId: 'a', toId: 'd' },
  ];
  for (const ids of [[3, 5], [5, 3], [1, 2, 3, 4, 5]]) {
    const plan = planPrune(edges, ids);
    assert.deepEqual(plan.remove.map((e) => e.id).sort(), [3, 5]);
  }
});

test('planPrune：独立冗余边可全部移除，未知 id 被跳过', () => {
  const edges = [
    { id: 1, fromId: 'a', toId: 'b' },
    { id: 2, fromId: 'b', toId: 'c' },
    { id: 3, fromId: 'a', toId: 'c' },
    { id: 4, fromId: 'x', toId: 'y' },
    { id: 5, fromId: 'y', toId: 'z' },
    { id: 6, fromId: 'x', toId: 'z' },
  ];
  const plan = planPrune(edges, [3, 6, 999, 3]);
  assert.deepEqual(plan.remove.map((e) => e.id), [3, 6]);
  assert.deepEqual(plan.skipped, [999]);
});

test('planPrune：移除后各节点间可达关系保持不变', () => {
  const edges = [
    { id: 1, fromId: 'a', toId: 'b' },
    { id: 2, fromId: 'b', toId: 'c' },
    { id: 3, fromId: 'a', toId: 'c' },
    { id: 4, fromId: 'c', toId: 'd' },
    { id: 5, fromId: 'a', toId: 'd' },
  ];
  const reachableBefore = (from: string, to: string) => findPath(edges, from, to) !== null;
  const { remove } = planPrune(edges, [1, 2, 3, 4, 5]);
  const remaining = edges.filter((e) => !remove.includes(e));
  for (const from of ['a', 'b', 'c', 'd']) {
    for (const to of ['a', 'b', 'c', 'd']) {
      assert.equal(findPath(remaining, from, to) !== null, reachableBefore(from, to), `${from}⇝${to} 可达性应保持不变`);
    }
  }
});

/* ---------- 顺序确定性查询 ---------- */

const N = (id: string, createdAt: string) => ({ id, createdAt });

test('topoOrder：并列节点按创建时间、再按 id 稳定排序', () => {
  const nodes = [N('b', '2026-01-02T00:00:00Z'), N('a', '2026-01-01T00:00:00Z'), N('c', '2026-01-01T00:00:00Z')];
  // a 与 c 创建时间相同 → 按 id 升序；b 创建更晚 → 排最后
  assert.deepEqual(topoOrder(nodes, []), ['a', 'c', 'b']);
});

test('topoOrder：尊重约束且结果确定', () => {
  const nodes = [N('x', '2026-01-01'), N('y', '2026-01-02'), N('z', '2026-01-03')];
  const edges = [{ fromId: 'z', toId: 'x' }];
  // z 创建最晚，但约束要求 z 先于 x；y 无约束按创建时间最先就绪
  assert.deepEqual(topoOrder(nodes, edges), ['y', 'z', 'x']);
  assert.deepEqual(topoOrder(nodes, edges), topoOrder(nodes, edges));
});

test('topoOrder：虚拟边注入生效；成环返回 null', () => {
  const nodes = [N('a', '2026-01-01'), N('b', '2026-01-02')];
  assert.deepEqual(topoOrder(nodes, [], [{ fromId: 'b', toId: 'a' }]), ['b', 'a']);
  assert.equal(
    topoOrder(nodes, [{ fromId: 'a', toId: 'b' }], [{ fromId: 'b', toId: 'a' }]),
    null,
  );
});

test('queryOrder：A 必须早于 B，返回最短约束路径', () => {
  const nodes = [N('a', '1'), N('b', '2'), N('c', '3'), N('d', '4')];
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'd' },
    { fromId: 'a', toId: 'c' },
    { fromId: 'c', toId: 'd' },
    { fromId: 'a', toId: 'd' },
  ];
  const r = queryOrder(nodes, edges, 'a', 'd');
  assert.equal(r.verdict, 'a-before-b');
  // 存在多条约束链时取最短：直达边 a→d
  if (r.verdict === 'unconstrained') assert.fail('应为已约束');
  assert.deepEqual(r.path, ['a', 'd']);
});

test('queryOrder：B 必须早于 A（反向约束链）', () => {
  const nodes = [N('a', '1'), N('b', '2'), N('c', '3')];
  const edges = [
    { fromId: 'a', toId: 'c' },
    { fromId: 'c', toId: 'b' },
  ];
  const r = queryOrder(nodes, edges, 'b', 'a');
  assert.equal(r.verdict, 'b-before-a');
  if (r.verdict === 'unconstrained') assert.fail('应为已约束');
  assert.deepEqual(r.path, ['a', 'c', 'b']);
});

test('queryOrder：未约束时给出双向见证拓扑序', () => {
  const nodes = [N('a', '2026-01-01'), N('b', '2026-01-02'), N('c', '2026-01-03'), N('d', '2026-01-04')];
  const edges = [{ fromId: 'a', toId: 'b' }]; // c 与 d 之间无约束
  const r = queryOrder(nodes, edges, 'c', 'd');
  assert.equal(r.verdict, 'unconstrained');
  if (r.verdict !== 'unconstrained') assert.fail('应为未约束');
  const { aFirst, bFirst } = r.witnesses;
  // 两个见证都是覆盖全部节点的合法拓扑序
  for (const w of [aFirst, bFirst]) {
    assert.deepEqual([...w.order].sort(), ['a', 'b', 'c', 'd']);
    const pos = new Map(w.order.map((id, i) => [id, i]));
    for (const e of edges) assert.ok(pos.get(e.fromId)! < pos.get(e.toId)!);
  }
  // aFirst：c 在 d 前；bFirst：d 在 c 前
  assert.ok(aFirst.order.indexOf('c') < aFirst.order.indexOf('d'));
  assert.ok(bFirst.order.indexOf('d') < bFirst.order.indexOf('c'));
  // 见证分层与虚拟约束一致
  assert.ok(aFirst.levels['c'] < aFirst.levels['d']);
  assert.ok(bFirst.levels['d'] < bFirst.levels['c']);
  // 并列节点按创建时间稳定排序：aFirst 中 a、b 保持创建时间先后
  assert.ok(aFirst.order.indexOf('a') < aFirst.order.indexOf('b'));
});

test('queryOrder：未约束的见证是确定性的（重复查询结果一致）', () => {
  const nodes = [N('m', '2026-01-02'), N('n', '2026-01-01'), N('p', '2026-01-03')];
  const r1 = queryOrder(nodes, [], 'm', 'p');
  const r2 = queryOrder(nodes, [], 'm', 'p');
  assert.deepEqual(r1, r2);
});
