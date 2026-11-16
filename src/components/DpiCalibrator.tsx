import { useCallback, useEffect, useRef, useState } from 'react';

type Step = 'setup' | 'measure' | 'result';

interface Props {
  onCalibrated: (dpi: number) => void;
}

const PRESETS = [10, 20, 30];

export function DpiCalibrator({ onCalibrated }: Props) {
  const [step, setStep] = useState<Step>('setup');
  const [nominalDpi, setNominalDpi] = useState('800');
  const [distanceCm, setDistanceCm] = useState('30');
  const [counts, setCounts] = useState(0);
  const [result, setResult] = useState<{ real: number; deviation: number } | null>(null);
  const [error, setError] = useState('');

  const targetRef = useRef<HTMLDivElement | null>(null);
  const distRef = useRef(0);
  const wasLockedRef = useRef(false);

  const nominal = parseFloat(nominalDpi);
  const dist = parseFloat(distanceCm);

  const finalize = useCallback(() => {
    const total = distRef.current;
    if (total < 50 || !Number.isFinite(dist) || dist <= 0 || !Number.isFinite(nominal) || nominal <= 0) {
      setError('记录到的移动太少，请重新测量：把鼠标从起点平稳滑到终点。');
      setStep('setup');
      return;
    }
    const inches = dist / 2.54;
    const real = total / inches;
    const deviation = ((real - nominal) / nominal) * 100;
    setResult({ real, deviation });
    setError('');
    setStep('result');
  }, [dist, nominal]);

  useEffect(() => {
    const onChange = () => {
      const isLocked = document.pointerLockElement === targetRef.current;
      if (wasLockedRef.current && !isLocked) {
        finalize();
      }
      wasLockedRef.current = isLocked;
      if (isLocked) setStep('measure');
    };
    const onError = () => {
      setError('无法锁定鼠标指针，请换用 Chrome / Edge 并重试。');
      setStep('setup');
    };
    document.addEventListener('pointerlockchange', onChange);
    document.addEventListener('pointerlockerror', onError);
    return () => {
      document.removeEventListener('pointerlockchange', onChange);
      document.removeEventListener('pointerlockerror', onError);
    };
  }, [finalize]);

  useEffect(() => {
    if (step !== 'measure') return;
    const onMove = (e: MouseEvent) => {
      distRef.current += Math.hypot(e.movementX, e.movementY);
      setCounts(Math.round(distRef.current));
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [step]);

  function start() {
    if (!Number.isFinite(nominal) || nominal <= 0 || !Number.isFinite(dist) || dist <= 0) {
      setError('请先填写有效的标称 DPI 和移动距离。');
      return;
    }
    distRef.current = 0;
    setCounts(0);
    setResult(null);
    setError('');
    wasLockedRef.current = false;
    targetRef.current?.requestPointerLock();
  }

  return (
    <div className="panel">
      <h2>DPI 实测校准</h2>
      <p className="sub">
        鼠标标称 DPI 与真实值常有 ±3% 甚至更大偏差（因品牌、型号、批次而异），会直接导致手感与换算偏差。
        实测一次，换算和测试都改用你的真实 DPI。
      </p>

      {step === 'setup' && (
        <div className="setup">
          <div className="row">
            <div className="field">
              <label>标称 DPI（鼠标驱动里设置的）</label>
              <input type="number" step="any" value={nominalDpi} onChange={(e) => setNominalDpi(e.target.value)} />
            </div>
            <div className="field">
              <label>要滑动的距离（cm）</label>
              <input type="number" step="any" value={distanceCm} onChange={(e) => setDistanceCm(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>快捷距离</label>
            <div className="seg seg-3">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  className={`seg-btn ${String(p) === distanceCm ? 'active' : ''}`}
                  onClick={() => setDistanceCm(String(p))}
                >
                  {p} cm
                </button>
              ))}
            </div>
          </div>

          <ol className="steps">
            <li>用尺子量好一个精确距离（建议 ≥20cm，比如鼠标垫整宽）。</li>
            <li>确认系统鼠标加速已关闭（Windows「增强指针精度」关；macOS 用默认速度）。</li>
            <li>点「开始」，鼠标指针会消失；把鼠标从起点**平稳单向**滑到终点。</li>
            <li>滑完按 <kbd>ESC</kbd> 结束，程序会自动算出真实 DPI。</li>
          </ol>

          {error && <p className="error">{error}</p>}
          <button className="primary" onClick={start}>
            开始校准
          </button>
        </div>
      )}

      {step === 'measure' && (
        <div className="measure-box" ref={targetRef}>
          <p className="measure-big">正在测量…</p>
          <p className="measure-counts">{counts.toLocaleString()} counts</p>
          <p className="muted">从起点平稳滑到终点后，按 <kbd>ESC</kbd> 结束</p>
        </div>
      )}

      {step === 'result' && result && (
        <div className="result">
          <div className="result-hero">
            <div className="metric">
              <span className="metric-label">真实 DPI</span>
              <span className="metric-value big">{result.real.toFixed(1)}</span>
            </div>
            <div className="metric">
              <span className="metric-label">标称 DPI</span>
              <span className="metric-value">{nominal.toFixed(0)}</span>
            </div>
            <div className="metric">
              <span className="metric-label">偏差</span>
              <span
                className="metric-value"
                style={{ color: Math.abs(result.deviation) > 5 ? 'var(--accent-2)' : 'var(--good)' }}
              >
                {result.deviation >= 0 ? '+' : ''}
                {result.deviation.toFixed(1)}%
              </span>
            </div>
          </div>

          <p className="hint">
            你的鼠标标称 {nominal.toFixed(0)} DPI，实测为 {result.real.toFixed(1)} DPI。
            {Math.abs(result.deviation) > 1
              ? `这意味着按标称值计算 cm/360 会偏 ${(result.deviation / (1 + result.deviation / 100)).toFixed(1)}%，
                 换算时必须用真实 DPI 才能跨游戏保持一致手感。`
              : '偏差很小，标称值基本可信。'}
          </p>

          <button
            className="primary"
            onClick={() => {
              onCalibrated(result.real);
              setError('');
            }}
          >
            应用真实 DPI 到换算 / 测试
          </button>
          <button className="ghost" onClick={() => setStep('setup')}>
            重新校准
          </button>
        </div>
      )}

      {step === 'result' && (
        <p className="footnote">
          本次共记录 {counts.toLocaleString()} counts、滑动 {dist} cm（{dist / 2.54} 英寸）。
          建议重复 2–3 次取平均，误差更小。
        </p>
      )}
    </div>
  );
}
