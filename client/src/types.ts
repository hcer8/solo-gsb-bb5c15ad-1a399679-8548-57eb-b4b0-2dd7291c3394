export interface Evidence {
  id: string;
  title: string;
  description: string;
  source: string;
  occurredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Edge {
  id: number;
  fromId: string;
  toId: string;
  createdAt: string;
}

export interface GraphState {
  evidence: Evidence[];
  edges: Edge[];
  levels: Record<string, number>;
  levelCount: number;
}

/** 一条冗余连线及其最短替代路径（传递约简分析结果） */
export interface RedundantEdge {
  edgeId: number;
  fromId: string;
  toId: string;
  /** 忽略该连线后，从 fromId 到 toId 的一条最短替代路径（节点 id 序列，含起终点） */
  path: string[];
}

/** 批量瘦身结果：最新全量状态 + 实际移除 / 被跳过的连线 id */
export interface PruneResult extends GraphState {
  pruned: number[];
  skipped: number[];
}

/** 顺序确定性查询的判定 */
export type OrderVerdict = 'a-before-b' | 'b-before-a' | 'unconstrained';

/** 一条见证：在虚拟约束下的合法拓扑序及其分层（用于画布临时预览） */
export interface OrderWitness {
  /** 合法拓扑序（并列节点按创建时间、再按 id 稳定排序） */
  order: string[];
  levels: Record<string, number>;
  levelCount: number;
}

/** 顺序确定性查询结果 */
export type OrderQueryResult =
  | {
      verdict: 'a-before-b' | 'b-before-a';
      aId: string;
      bId: string;
      /** 从前者到后者的一条最短约束路径（节点 id 序列，含起终点） */
      path: string[];
    }
  | {
      verdict: 'unconstrained';
      aId: string;
      bId: string;
      /** 双向见证：aFirst 为「A 在 B 前」、bFirst 为「B 在 A 前」的合法拓扑序 */
      witnesses: { aFirst: OrderWitness; bFirst: OrderWitness };
    };

export interface EvidenceFormValues {
  title: string;
  description: string;
  source: string;
  occurredAt: string | null;
}
