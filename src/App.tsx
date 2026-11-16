import { useState } from 'react';
import { Converter } from './components/Converter';
import { PsaTester } from './components/PsaTester';
import { DpiCalibrator } from './components/DpiCalibrator';
import { SensitivityLab } from './components/aim/SensitivityLab';
import { HistoryPanel } from './components/HistoryPanel';
import { GAMES } from './data/games';
import { roundTo, sensFromCm360 } from './lib/sensitivity';

const REF_DPI = 800;
const REF_CM = [20, 25, 30, 35, 40, 50, 60];

function loadCalibrated(): number | null {
  try {
    const v = localStorage.getItem('calibratedDpi');
    if (!v) return null;
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function ReferenceTable() {
  return (
    <div className="panel">
      <h2>参考基准表（800 DPI）</h2>
      <p className="sub">不同 cm/360 在四款游戏里对应的灵敏度。职业选手常见约 20–40 cm，多数人从 30–40 cm 起步手感最稳。</p>
      <div className="table-wrap">
        <table className="result-table">
          <thead>
            <tr>
              <th>cm/360</th>
              {GAMES.map((g) => (
                <th key={g.id}>{g.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REF_CM.map((cm) => (
              <tr key={cm}>
                <td className="mono">{cm} cm</td>
                {GAMES.map((g) => {
                  const s = roundTo(sensFromCm360(REF_DPI, cm, g.yaw), g.decimals);
                  return (
                    <td key={g.id} className="mono">
                      {s.toFixed(g.decimals)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="footnote">cm/360 越小 = 灵敏度越高（转一圈所需距离越短）；越大 = 越低（更稳）。</p>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<'lab' | 'test' | 'convert' | 'calibrate' | 'history'>('lab');
  const [calibratedDpi, setCalibratedDpi] = useState<number | null>(loadCalibrated);

  function handleCalibrated(dpi: number) {
    setCalibratedDpi(dpi);
    try {
      localStorage.setItem('calibratedDpi', String(dpi));
    } catch {
      // localStorage 不可用时静默忽略
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>FPS 灵敏度测试与换算器</h1>
          <p className="tagline">Apex · 三角洲行动 · Valorant · CS2 —— 找到属于你的跟手灵敏度</p>
        </div>
      </header>

      <nav className="tabs">
        <button className={`tab ${tab === 'lab' ? 'active' : ''}`} onClick={() => setTab('lab')}>
          深度测试
        </button>
        <button className={`tab ${tab === 'test' ? 'active' : ''}`} onClick={() => setTab('test')}>
          PSA 测试
        </button>
        <button className={`tab ${tab === 'convert' ? 'active' : ''}`} onClick={() => setTab('convert')}>
          换算器
        </button>
        <button className={`tab ${tab === 'calibrate' ? 'active' : ''}`} onClick={() => setTab('calibrate')}>
          DPI 校准
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          历史
        </button>
      </nav>

      <main>
        {tab === 'lab' && <SensitivityLab />}
        {tab === 'test' && <PsaTester calibratedDpi={calibratedDpi} />}
        {tab === 'convert' && <Converter calibratedDpi={calibratedDpi} />}
        {tab === 'calibrate' && <DpiCalibrator onCalibrated={handleCalibrated} />}
        {tab === 'history' && <HistoryPanel />}
        {tab !== 'calibrate' && tab !== 'lab' && <ReferenceTable />}
      </main>

      <footer className="footer">
        <p>
          换算基于 yaw 常量（CS2/Apex/三角洲 = 0.022，Valorant = 0.07），公式 cm/360 = 914.4 ÷ (DPI × 灵敏度 × yaw)。
          三角洲行动官方未公布 yaw，采用社区多来源一致的 0.022，建议实测确认；鼠标标称 DPI 有偏差，建议先用「DPI 校准」测出真实值。
        </p>
      </footer>
    </div>
  );
}
