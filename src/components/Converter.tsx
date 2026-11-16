import { useState } from 'react';
import { GAMES, getGame } from '../data/games';
import { cm360, convertSens, eDpi, fmtCm, roundTo } from '../lib/sensitivity';

interface Props {
  calibratedDpi: number | null;
}

export function Converter({ calibratedDpi }: Props) {
  const [sourceId, setSourceId] = useState('cs2');
  const [sens, setSens] = useState('1.0');
  const [dpi, setDpi] = useState('800');
  const [targetDpi, setTargetDpi] = useState('800');

  const source = getGame(sourceId);
  const sensNum = parseFloat(sens);
  const dpiNum = parseFloat(dpi);
  const targetDpiNum = parseFloat(targetDpi) || dpiNum;

  const valid = Number.isFinite(sensNum) && sensNum > 0 && Number.isFinite(dpiNum) && dpiNum > 0;
  const cm = valid ? cm360(dpiNum, sensNum, source.yaw) : NaN;
  const edpi = valid ? eDpi(dpiNum, sensNum) : NaN;

  return (
    <div className="panel">
      <h2>灵敏度换算器</h2>
      <p className="sub">输入你在某一款游戏里的灵敏度，自动换算到另外三款，保持 cm/360（肌肉记忆）完全一致。</p>

      <div className="field">
        <label>我的游戏</label>
        <div className="seg">
          {GAMES.map((g) => (
            <button
              key={g.id}
              className={`seg-btn ${g.id === sourceId ? 'active' : ''}`}
              onClick={() => setSourceId(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label>游戏内灵敏度</label>
          <input type="number" step="any" value={sens} onChange={(e) => setSens(e.target.value)} />
        </div>
        <div className="field">
          <label>鼠标 DPI</label>
          <input type="number" step="any" value={dpi} onChange={(e) => setDpi(e.target.value)} />
          {calibratedDpi && (
            <button
              className="link"
              onClick={() => {
                setDpi(String(Math.round(calibratedDpi)));
                setTargetDpi(String(Math.round(calibratedDpi)));
              }}
            >
              使用校准 DPI（{Math.round(calibratedDpi)}）
            </button>
          )}
        </div>
        <div className="field">
          <label>目标 DPI（默认相同）</label>
          <input type="number" step="any" value={targetDpi} onChange={(e) => setTargetDpi(e.target.value)} />
        </div>
      </div>

      <div className="result-hero">
        <div className="metric">
          <span className="metric-label">cm/360</span>
          <span className="metric-value">{valid ? fmtCm(cm) : '—'}</span>
        </div>
        <div className="metric">
          <span className="metric-label">eDPI（{source.name}）</span>
          <span className="metric-value">{valid ? edpi.toFixed(0) : '—'}</span>
        </div>
        <div className="metric">
          <span className="metric-label">来源 yaw</span>
          <span className="metric-value">{source.yaw}</span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="result-table">
          <thead>
            <tr>
              <th>目标游戏</th>
              <th>换算后灵敏度</th>
              <th>eDPI</th>
              <th>cm/360</th>
              <th>数据置信度</th>
            </tr>
          </thead>
          <tbody>
            {GAMES.filter((g) => g.id !== sourceId).map((g) => {
              const conv = valid ? convertSens(sensNum, source.yaw, g.yaw, dpiNum, targetDpiNum) : NaN;
              const convRounded = Number.isFinite(conv) ? roundTo(conv, g.decimals) : NaN;
              const convCm = valid ? cm360(targetDpiNum, convRounded, g.yaw) : NaN;
              return (
                <tr key={g.id} className={g.id === sourceId ? 'dim' : ''}>
                  <td>
                    <div className="game-cell">
                      <strong>{g.name}</strong>
                      <span className="muted">{g.nameEn}</span>
                    </div>
                  </td>
                  <td className="mono">{Number.isFinite(convRounded) ? convRounded.toFixed(g.decimals) : '—'}</td>
                  <td className="mono">{valid ? eDpi(targetDpiNum, convRounded).toFixed(0) : '—'}</td>
                  <td className="mono">{Number.isFinite(convCm) ? fmtCm(convCm) : '—'}</td>
                  <td>
                    <span className={`badge ${g.confidence}`}>
                      {g.confidence === 'confirmed' ? '已确认' : '社区数据'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="footnote">换算结果均为腰射（hipfire）灵敏度；开镜/ADS 倍率需在游戏内单独设置。</p>
    </div>
  );
}
