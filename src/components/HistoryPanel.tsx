import { useState } from 'react';
import { GAMES } from '../data/games';
import { fmtCm, roundTo, sensFromCm360 } from '../lib/sensitivity';
import { clearHistory, deleteRecord, loadHistory, type TestRecord } from '../lib/storage';

export function HistoryPanel() {
  const [records, setRecords] = useState<TestRecord[]>(() => loadHistory());

  function handleDelete(id: string) {
    setRecords(deleteRecord(id));
  }

  function handleClear() {
    setRecords(clearHistory());
  }

  if (records.length === 0) {
    return (
      <div className="panel">
        <h2>历史记录</h2>
        <p className="sub">
          还没有测试记录。完成一次「深度测试」或「PSA 测试」后，结果会自动保存在这里，方便你追踪手感变化和换设备找回配置。
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="history-head">
        <h2>历史记录</h2>
        <button className="ghost" onClick={handleClear}>
          清空全部
        </button>
      </div>
      <p className="sub">共 {records.length} 条记录，最新在前。</p>

      <div className="history-list">
        {records.map((r) => {
          const game = GAMES.find((g) => g.id === r.gameId);
          const date = new Date(r.createdAt);
          return (
            <div className="history-item" key={r.id}>
              <div className="history-main">
                <div className="history-title">
                  <span className={`badge ${r.kind === 'lab' ? 'lab' : 'psa'}`}>
                    {r.kind === 'lab' ? '深度测试' : 'PSA 测试'}
                  </span>
                  <strong>{game ? game.name : r.gameId}</strong>
                  <span className="muted">{date.toLocaleString('zh-CN')}</span>
                </div>
                <div className="history-metrics">
                  <span className="mono">cm/360：{fmtCm(r.resultCm360)}</span>
                  <span className="mono">
                    {game ? game.name : r.gameId} 灵敏度：
                    {game ? roundTo(r.resultSens, game.decimals).toFixed(game.decimals) : r.resultSens.toFixed(3)}
                  </span>
                  <span className="mono">DPI：{r.dpi}</span>
                  {r.fov && <span className="mono">FOV：{r.fov}</span>}
                </div>
                <button className="ghost" onClick={() => handleDelete(r.id)}>
                  删除
                </button>
              </div>
              <div className="history-conv">
                {GAMES.map((g) => {
                  const s = roundTo(sensFromCm360(r.dpi, r.resultCm360, g.yaw), g.decimals);
                  return (
                    <span key={g.id} className="mono">
                      {g.name}：{s.toFixed(g.decimals)}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
