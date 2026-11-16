import { useEffect, useRef, useState } from 'react';
import { GAMES, getGame } from '../data/games';
import { cm360, convertSens, eDpi, fmtCm, roundTo } from '../lib/sensitivity';
import { PSA_FACTORS, choose, createPsa, currentCandidates, type PsaState } from '../lib/psa';
import { newId, saveRecord } from '../lib/storage';

type Phase = 'setup' | 'testing' | 'result';

interface Props {
  calibratedDpi: number | null;
}

export function PsaTester({ calibratedDpi }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [gameId, setGameId] = useState('cs2');
  const [sens, setSens] = useState('1.0');
  const [dpi, setDpi] = useState('800');
  const [psa, setPsa] = useState<PsaState | null>(null);
  const [history, setHistory] = useState<PsaState[]>([]);
  const savedRef = useRef(false);

  const game = getGame(gameId);
  const sensNum = parseFloat(sens);
  const dpiNum = parseFloat(dpi);
  const valid = Number.isFinite(sensNum) && sensNum > 0 && Number.isFinite(dpiNum) && dpiNum > 0;
  const startCm = valid ? cm360(dpiNum, sensNum, game.yaw) : NaN;

  useEffect(() => {
    if (phase === 'result' && psa && psa.result !== null && !savedRef.current) {
      savedRef.current = true;
      const r = roundTo(psa.result, game.decimals);
      saveRecord({
        id: newId(),
        createdAt: Date.now(),
        kind: 'psa',
        gameId,
        dpi: dpiNum,
        startSens: sensNum,
        resultCm360: cm360(dpiNum, r, game.yaw),
        resultSens: r,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, psa]);
  const startEdpi = valid ? eDpi(dpiNum, sensNum) : NaN;

  function start() {
    if (!valid) return;
    setPsa(createPsa(sensNum));
    setHistory([]);
    setPhase('testing');
  }

  function pick(choice: 'lower' | 'higher') {
    if (!psa) return;
    const next = choose(psa, choice);
    setHistory((h) => [...h, psa]);
    setPsa(next);
    if (next.result !== null) setPhase('result');
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setPsa(prev);
    setHistory((h) => h.slice(0, -1));
    setPhase('testing');
  }

  function reset() {
    setPsa(null);
    setHistory([]);
    setPhase('setup');
    savedRef.current = false;
  }

  return (
    <div className="panel">
      <h2>跟手灵敏度测试（PSA 七轮二分法）</h2>
      <p className="sub">以你现在的灵敏度为基准，每轮进游戏试两个候选值，选更跟手的那一个，七轮后收敛到属于你的灵敏度。</p>

      {phase === 'setup' && (
        <div className="setup">
          <div className="field">
            <label>在哪个游戏里测试</label>
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
              {calibratedDpi && (
                <button className="link" onClick={() => setDpi(String(Math.round(calibratedDpi)))}>
                  使用校准 DPI（{Math.round(calibratedDpi)}）
                </button>
              )}
            </div>
          </div>

          <div className="result-hero">
            <div className="metric">
              <span className="metric-label">当前 cm/360</span>
              <span className="metric-value">{valid ? fmtCm(startCm) : '—'}</span>
            </div>
            <div className="metric">
              <span className="metric-label">当前 eDPI</span>
              <span className="metric-value">{valid ? startEdpi.toFixed(0) : '—'}</span>
            </div>
          </div>

          <button className="primary" onClick={start} disabled={!valid}>
            开始测试（共 7 轮）
          </button>
          <p className="footnote">测试期间请保持 DPI、鼠标、鼠标垫、握姿不变，并在同一时间、热身充分后进行。</p>
        </div>
      )}

      {phase === 'testing' && psa && (
        <div className="testing">
          <div className="progress">
            <div className="progress-bar" style={{ width: `${(psa.roundIndex / PSA_FACTORS.length) * 100}%` }} />
          </div>
          <p className="round-label">
            第 <strong>{psa.roundIndex + 1}</strong> / {PSA_FACTORS.length} 轮
          </p>

          <p className="hint">
            进游戏把灵敏度改成下面两个值，分别练 30–60 秒（先跟枪再甩枪），选一个更跟手的：
          </p>

          <div className="candidates">
            {(
              [
                { key: 'lower' as const, label: 'A · 更低（更慢）', v: currentCandidates(psa).lower },
                { key: 'higher' as const, label: 'B · 更高（更快）', v: currentCandidates(psa).higher },
              ]
            ).map((c) => {
              const rounded = roundTo(c.v, game.decimals);
              const cm = cm360(dpiNum, rounded, game.yaw);
              return (
                <div className="candidate-card" key={c.key}>
                  <div className="candidate-tag">{c.label}</div>
                  <div className="candidate-sens">{rounded.toFixed(game.decimals)}</div>
                  <div className="candidate-meta">
                    <span>cm/360：{fmtCm(cm)}</span>
                    <span>eDPI：{eDpi(dpiNum, rounded).toFixed(0)}</span>
                  </div>
                  <button className="primary" onClick={() => pick(c.key)}>
                    这个更跟手
                  </button>
                </div>
              );
            })}
          </div>

          <button className="ghost" onClick={undo} disabled={history.length === 0}>
            撤销上一轮
          </button>
          <button className="ghost" onClick={reset}>
            重新开始
          </button>
        </div>
      )}

      {phase === 'result' && psa && psa.result !== null && (
        <div className="result">
          <div className="result-hero">
            <div className="metric">
              <span className="metric-label">你的 {game.name} 灵敏度</span>
              <span className="metric-value big">{roundTo(psa.result, game.decimals).toFixed(game.decimals)}</span>
            </div>
            <div className="metric">
              <span className="metric-label">cm/360</span>
              <span className="metric-value">{fmtCm(cm360(dpiNum, roundTo(psa.result, game.decimals), game.yaw))}</span>
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
                  const conv = convertSens(psa.result!, game.yaw, g.yaw, dpiNum, dpiNum);
                  const r = roundTo(conv, g.decimals);
                  return (
                    <tr key={g.id} className={g.id === gameId ? 'highlight' : ''}>
                      <td>
                        <div className="game-cell">
                          <strong>{g.name}</strong>
                          <span className="muted">{g.nameEn}</span>
                        </div>
                      </td>
                      <td className="mono">{r.toFixed(g.decimals)}</td>
                      <td className="mono">{fmtCm(cm360(dpiNum, r, g.yaw))}</td>
                      <td className="mono">{eDpi(dpiNum, r).toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="hint">把对应灵敏度填进每款游戏，至少坚持一周再评判；如果轻微甩过头就再降 0.05–0.1，甩不到就加 0.05–0.1。</p>

          <button className="ghost" onClick={reset}>
            重新测试
          </button>
        </div>
      )}
    </div>
  );
}
