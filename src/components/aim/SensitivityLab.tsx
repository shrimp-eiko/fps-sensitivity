import { useEffect, useRef, useState } from 'react';
import { GAMES, getGame } from '../../data/games';
import { cm360, eDpi, fmtCm, roundTo, sensFromCm360 } from '../../lib/sensitivity';
import {
  createSearch,
  currentPlan,
  submitRound,
  type SearchState,
} from '../../lib/aim/converge';
import { AimScene, type AimMode, type RoundStats } from './AimScene';
import { newId, saveRecord } from '../../lib/storage';

type Candidate = 'A' | 'B';

type Step =
  | { kind: 'setup' }
  | { kind: 'ready'; round: number; total: number; candidate: Candidate; mode: AimMode }
  | { kind: 'task'; round: number; candidate: Candidate; mode: AimMode }
  | { kind: 'result' };

const FLICK_MS = 15000;
const TRACK_MS = 15000;

export function SensitivityLab() {
  const [step, setStep] = useState<Step>({ kind: 'setup' });
  const [gameId, setGameId] = useState('cs2');
  const [sens, setSens] = useState('1.0');
  const [dpi, setDpi] = useState('800');
  const [hFov, setHFov] = useState('90');

  const searchRef = useRef<SearchState | null>(null);
  const scoresRef = useRef<{ a: number; b: number }>({ a: 0, b: 0 });
  const lastRoundRef = useRef<{ a: number; b: number; scoreA: number; scoreB: number } | null>(null);
  const savedRef = useRef(false);

  const game = getGame(gameId);
  const sensNum = parseFloat(sens);
  const dpiNum = parseFloat(dpi);
  const fovNum = parseFloat(hFov);
  const valid =
    Number.isFinite(sensNum) && sensNum > 0 && Number.isFinite(dpiNum) && dpiNum > 0 &&
    Number.isFinite(fovNum) && fovNum >= 60 && fovNum <= 120;
  const startCm = valid ? cm360(dpiNum, sensNum, game.yaw) : NaN;

  useEffect(() => {
    if (step.kind === 'result' && searchRef.current && searchRef.current.result !== null && !savedRef.current) {
      savedRef.current = true;
      const resultCm = searchRef.current.result;
      saveRecord({
        id: newId(),
        createdAt: Date.now(),
        kind: 'lab',
        gameId,
        dpi: dpiNum,
        startSens: sensNum,
        resultCm360: resultCm,
        resultSens: sensFromCm360(dpiNum, resultCm, game.yaw),
        fov: fovNum,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function begin() {
    if (!valid) return;
    savedRef.current = false;
    const s = createSearch(startCm, 0.55, 7);
    searchRef.current = s;
    scoresRef.current = { a: 0, b: 0 };
    lastRoundRef.current = null;
    const plan = currentPlan(s);
    setStep({ kind: 'ready', round: plan.round, total: s.maxRounds, candidate: 'A', mode: 'flick' });
  }

  function handleDone(stats: RoundStats) {
    const cur = step as { kind: 'task'; round: number; candidate: Candidate; mode: AimMode };
    const search = searchRef.current;
    if (!search) return;
    const key = cur.candidate === 'A' ? 'a' : 'b';
    scoresRef.current[key] += stats.score;

    // 编排：A flick -> A track -> B flick -> B track -> 提交
    if (cur.candidate === 'A' && cur.mode === 'flick') {
      setStep({ kind: 'ready', round: cur.round, total: search.maxRounds, candidate: 'A', mode: 'track' });
    } else if (cur.candidate === 'A' && cur.mode === 'track') {
      setStep({ kind: 'ready', round: cur.round, total: search.maxRounds, candidate: 'B', mode: 'flick' });
    } else if (cur.candidate === 'B' && cur.mode === 'flick') {
      setStep({ kind: 'ready', round: cur.round, total: search.maxRounds, candidate: 'B', mode: 'track' });
    } else {
      // B track 完成，提交本轮
      const plan = currentPlan(search);
      const next = submitRound(search, scoresRef.current.a, scoresRef.current.b);
      lastRoundRef.current = {
        a: plan.a,
        b: plan.b,
        scoreA: scoresRef.current.a,
        scoreB: scoresRef.current.b,
      };
      scoresRef.current = { a: 0, b: 0 };
      if (next.result !== null) {
        setStep({ kind: 'result' });
      } else {
        const p2 = currentPlan(next);
        setStep({ kind: 'ready', round: p2.round, total: next.maxRounds, candidate: 'A', mode: 'flick' });
      }
    }
  }

  // ---------- 当前要渲染的任务 ----------
  const isTask = step.kind === 'task';
  const taskSens = isTask
    ? sensFromCm360(dpiNum, (step as { candidate: Candidate }).candidate === 'A'
        ? currentPlan(searchRef.current!).a
        : currentPlan(searchRef.current!).b, game.yaw)
    : 0;

  function reset() {
    setStep({ kind: 'setup' });
    searchRef.current = null;
    scoresRef.current = { a: 0, b: 0 };
    savedRef.current = false;
  }

  return (
    <div className="panel">
      <h2>深度测试（3D 客观版）</h2>
      <p className="sub">
        在网页里用与游戏一致的物理灵敏度跑甩枪 / 跟枪任务，由得分自动收敛出你的最优 cm/360，再换算到四款游戏。
      </p>

      {step.kind === 'setup' && (
        <div className="setup">
          <div className="field">
            <label>测试游戏</label>
            <div className="seg">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  className={`seg-btn ${g.id === gameId ? 'active' : ''}`}
                  onClick={() => setGameId(g.id)}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>当前 {game.name} 灵敏度</label>
              <input type="number" step="any" value={sens} onChange={(e) => setSens(e.target.value)} />
            </div>
            <div className="field">
              <label>鼠标 DPI</label>
              <input type="number" step="any" value={dpi} onChange={(e) => setDpi(e.target.value)} />
            </div>
            <div className="field">
              <label>游戏水平 FOV（默认 90）</label>
              <input type="number" step="any" value={hFov} onChange={(e) => setHFov(e.target.value)} />
            </div>
          </div>

          <div className="result-hero">
            <div className="metric">
              <span className="metric-label">当前 cm/360</span>
              <span className="metric-value">{valid ? fmtCm(startCm) : '—'}</span>
            </div>
            <div className="metric">
              <span className="metric-label">预计耗时</span>
              <span className="metric-value">约 7 分钟</span>
            </div>
            <div className="metric">
              <span className="metric-label">轮数</span>
              <span className="metric-value">7 轮</span>
            </div>
          </div>

          <p className="footnote">
            测试中灵敏度会在当前值附近自动变化，你只管瞄准：甩枪模式点掉目标、跟枪模式把准星压在目标上。
          </p>
          <button className="primary" onClick={begin} disabled={!valid}>
            开始深度测试
          </button>
        </div>
      )}

      {step.kind === 'ready' && (
        <div className="aim-panel">
          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${((step.round - 1) / step.total) * 100}%` }}
            />
          </div>
          <p className="round-label">
            第 {step.round}/{step.total} 轮 · 候选 {step.candidate} · {step.mode === 'flick' ? 'Flick 甩枪' : 'Tracking 跟枪'}
          </p>
          {lastRoundRef.current && (
            <p className="muted">
              上轮得分：候选 A {lastRoundRef.current.scoreA.toFixed(1)} · 候选 B {lastRoundRef.current.scoreB.toFixed(1)}
              （{lastRoundRef.current.scoreA >= lastRoundRef.current.scoreB ? 'A 胜' : 'B 胜'}）
            </p>
          )}
          <button
            className="primary"
            onClick={() => setStep({ ...step, kind: 'task' })}
          >
            点击进入本段测试
          </button>
          <button className="ghost" onClick={reset}>放弃并重新开始</button>
        </div>
      )}

      {isTask && (
        <div className="aim-panel">
          <AimScene
            key={`${step.kind === 'task' ? step.round : 0}-${step.kind === 'task' ? step.candidate : ''}-${step.kind === 'task' ? step.mode : ''}`}
            yaw={game.yaw}
            sens={taskSens}
            mode={(step as { mode: AimMode }).mode}
            hFovDeg={fovNum}
            durationMs={(step as { mode: AimMode }).mode === 'flick' ? FLICK_MS : TRACK_MS}
            onDone={handleDone}
          />
        </div>
      )}

      {step.kind === 'result' && searchRef.current && (
        <div className="result">
          <div className="result-hero">
            <div className="metric">
              <span className="metric-label">最优 cm/360</span>
              <span className="metric-value big">{fmtCm(searchRef.current.result!)}</span>
            </div>
            <div className="metric">
              <span className="metric-label">{game.name} 对应灵敏度</span>
              <span className="metric-value big">
                {roundTo(sensFromCm360(dpiNum, searchRef.current.result!, game.yaw), game.decimals).toFixed(game.decimals)}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">当前值</span>
              <span className="metric-value">{sensNum.toFixed(game.decimals)}</span>
            </div>
          </div>

          <div className="table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>游戏</th>
                  <th>对应灵敏度</th>
                  <th>cm/360</th>
                  <th>eDPI</th>
                </tr>
              </thead>
              <tbody>
                {GAMES.map((g) => {
                  const s = roundTo(sensFromCm360(dpiNum, searchRef.current!.result!, g.yaw), g.decimals);
                  return (
                    <tr key={g.id} className={g.id === gameId ? 'highlight' : ''}>
                      <td>
                        <div className="game-cell">
                          <strong>{g.name}</strong>
                          <span className="muted">{g.nameEn}</span>
                        </div>
                      </td>
                      <td className="mono">{s.toFixed(g.decimals)}</td>
                      <td className="mono">{fmtCm(cm360(dpiNum, s, g.yaw))}</td>
                      <td className="mono">{eDpi(dpiNum, s).toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="hint">
            把对应灵敏度填进每款游戏，至少坚持一周再评判；网页手感与游戏略有差异，最终在游戏里做 ±0.05 的微调确认。
          </p>
          <button className="ghost" onClick={reset}>重新测试</button>
        </div>
      )}
    </div>
  );
}
