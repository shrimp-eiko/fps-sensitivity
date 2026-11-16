// 客观测试的收敛算法：黄金分割搜索，在 cm/360 区间内找综合得分最高的点。
// 得分越高越好（Flick 命中 + Tracking 稳定性综合）。

export const GOLDEN = (Math.sqrt(5) - 1) / 2; // ≈ 0.618

export interface SearchState {
  lo: number; // cm/360 下界（数值小 = 灵敏度高）
  hi: number; // cm/360 上界（数值大 = 灵敏度低）
  round: number; // 已完成轮数
  maxRounds: number;
  best: { cm360: number; score: number } | null;
  result: number | null;
}

export interface RoundPlan {
  round: number; // 1-based
  a: number; // 低 cm/360 候选（更快）
  b: number; // 高 cm/360 候选（更慢）
}

export function createSearch(startCm: number, spread = 0.55, maxRounds = 7): SearchState {
  return {
    lo: startCm * (1 - spread),
    hi: startCm * (1 + spread),
    round: 0,
    maxRounds,
    best: null,
    result: null,
  };
}

export function currentPlan(state: SearchState): RoundPlan {
  const d = (state.hi - state.lo) * GOLDEN;
  return {
    round: state.round + 1,
    a: state.hi - d,
    b: state.lo + d,
  };
}

export function submitRound(state: SearchState, scoreA: number, scoreB: number): SearchState {
  const { a, b } = currentPlan(state);
  const keepA = scoreA >= scoreB;
  const lo = keepA ? state.lo : a;
  const hi = keepA ? b : state.hi;
  const better = keepA ? { cm360: a, score: scoreA } : { cm360: b, score: scoreB };
  const best = !state.best || better.score > state.best.score ? better : state.best;
  const round = state.round + 1;
  const done = round >= state.maxRounds;
  return {
    lo,
    hi,
    round,
    maxRounds: state.maxRounds,
    best,
    result: done ? (lo + hi) / 2 : null,
  };
}
