// PSA（Perfect Sensitivity Approximation）7 轮二分测试引擎。
// 参考 psamethod.com 的标准因子表：candidate = base × factor；next_base = (base + chosen) / 2。
export interface PsaFactor {
  low: number;
  high: number;
}

export const PSA_FACTORS: PsaFactor[] = [
  { low: 0.5, high: 1.5 },
  { low: 0.5, high: 1.5 },
  { low: 0.6, high: 1.4 },
  { low: 0.7, high: 1.3 },
  { low: 0.8, high: 1.2 },
  { low: 0.9, high: 1.1 },
  { low: 0.95, high: 1.05 },
];

export type PsaChoice = 'lower' | 'higher';

export interface PsaRound {
  round: number; // 1-based
  base: number;
  lower: number;
  higher: number;
  choice: PsaChoice | null;
}

export interface PsaState {
  base: number;
  roundIndex: number; // 0-based，指向当前轮
  rounds: PsaRound[];
  result: number | null;
}

export function createPsa(base: number): PsaState {
  return { base, roundIndex: 0, rounds: [], result: null };
}

export function currentCandidates(state: PsaState): { lower: number; higher: number } {
  const f = PSA_FACTORS[state.roundIndex];
  return { lower: state.base * f.low, higher: state.base * f.high };
}

export function choose(state: PsaState, choice: PsaChoice): PsaState {
  const { lower, higher } = currentCandidates(state);
  const chosen = choice === 'lower' ? lower : higher;
  const nextBase = (state.base + chosen) / 2;
  const round: PsaRound = {
    round: state.roundIndex + 1,
    base: state.base,
    lower,
    higher,
    choice,
  };
  const rounds = [...state.rounds, round];
  const roundIndex = state.roundIndex + 1;
  const done = roundIndex >= PSA_FACTORS.length;
  return { base: nextBase, roundIndex, rounds, result: done ? nextBase : null };
}
