import { useState } from 'react';
import type { Evidence, OrderQueryResult } from '../types';

export type PreviewWhich = 'aFirst' | 'bFirst';

interface OrderQueryPanelProps {
  evidence: Evidence[];
  result: OrderQueryResult | null;
  busy: boolean;
  /** 依据路径当前是否在画布上高亮 */
  pathOn: boolean;
  /** 正在预览的见证方向（null 表示未预览） */
  previewing: PreviewWhich | null;
  titleOf: (id: string) => string;
  onQuery: (aId: string, bId: string) => void;
  onTogglePath: () => void;
  onPreview: (which: PreviewWhich) => void;
  onClose: () => void;
}

/**
 * 顺序确定性查询面板：选择两张证据卡片，判定「A 必须早于 B」/「B 必须早于 A」/「顺序未被约束」。
 * 已约束时可高亮最短约束路径；未约束时可按任一双向见证临时预览画布布局（不写入数据库）。
 */
export default function OrderQueryPanel(props: OrderQueryPanelProps) {
  const { evidence, result, busy, pathOn, previewing, titleOf } = props;
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');

  if (evidence.length < 2) return null;

  // 卡片被删除后，已选项自动失效，避免用不存在的 id 发起查询
  const validA = evidence.some((e) => e.id === aId) ? aId : '';
  const validB = evidence.some((e) => e.id === bId) ? bId : '';
  const canQuery = validA !== '' && validB !== '' && validA !== validB && !busy;

  const select = (value: string, onChange: (v: string) => void, label: string) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">选择证据…</option>
      {evidence.map((ev) => (
        <option key={ev.id} value={ev.id}>
          {ev.title}
        </option>
      ))}
    </select>
  );

  return (
    <section className="order-panel">
      <div className="order-head">
        <div>
          <h2>顺序确定性查询</h2>
          <p className="muted">
            选择两张证据卡片，判定现有「必须早于」约束是否已经确定它们的先后；未约束时给出两个方向都成立的见证拓扑序。
          </p>
        </div>
        <div className="order-controls">
          {select(validA, setAId, '证据 A')}
          <span className="order-vs">与</span>
          {select(validB, setBId, '证据 B')}
          <button className="btn primary" disabled={!canQuery} onClick={() => props.onQuery(validA, validB)}>
            判定先后
          </button>
          {result && (
            <button className="btn" onClick={props.onClose}>
              清除结果
            </button>
          )}
        </div>
      </div>

      {result && result.verdict !== 'unconstrained' && (
        <div className="order-verdict">
          <p className="order-conclusion">
            <span className="verdict-tag constrained">已约束</span>
            {result.verdict === 'a-before-b' ? (
              <>
                「<b>{titleOf(result.aId)}</b>」必须早于「<b>{titleOf(result.bId)}</b>」
              </>
            ) : (
              <>
                「<b>{titleOf(result.bId)}</b>」必须早于「<b>{titleOf(result.aId)}</b>」
              </>
            )}
          </p>
          <p className="muted">判定依据 · 最短约束路径（{result.path.length - 1} 条连线）：</p>
          <div className="order-chain">{result.path.map(titleOf).join(' → ')}</div>
          <div className="order-actions">
            <button className="btn small" onClick={props.onTogglePath}>
              {pathOn ? '取消路径高亮' : '在画布上高亮依据路径'}
            </button>
          </div>
        </div>
      )}

      {result && result.verdict === 'unconstrained' && (
        <div className="order-verdict">
          <p className="order-conclusion">
            <span className="verdict-tag unconstrained">未被约束</span>「<b>{titleOf(result.aId)}</b>」与「
            <b>{titleOf(result.bId)}</b>」的先后顺序尚未被任何约束链确定，两个方向的拓扑序都合法：
          </p>
          <div className="witness-grid">
            {(['aFirst', 'bFirst'] as const).map((which) => {
              const w = result.witnesses[which];
              const first = which === 'aFirst' ? result.aId : result.bId;
              const second = which === 'aFirst' ? result.bId : result.aId;
              const active = previewing === which;
              return (
                <div className={`witness${active ? ' active' : ''}`} key={which}>
                  <div className="witness-title">
                    见证：「{titleOf(first)}」在「{titleOf(second)}」前
                  </div>
                  <div className="order-chain muted">{w.order.map(titleOf).join(' → ')}</div>
                  <button className={`btn small${active ? ' active-preview' : ''}`} onClick={() => props.onPreview(which)}>
                    {active ? '退出预览' : '按此见证预览画布'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="muted order-note">预览仅临时调整前端画布布局，退出后自动恢复，不会写入数据库。</p>
        </div>
      )}
    </section>
  );
}
