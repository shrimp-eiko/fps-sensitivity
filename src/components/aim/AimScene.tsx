import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type AimMode = 'flick' | 'track';

export interface RoundStats {
  mode: AimMode;
  durationMs: number;
  hits: number;
  misses: number;
  avgKillMs: number;
  avgErrorDeg: number;
  onTargetRatio: number; // 0-1
  score: number; // 综合得分（越高越好，用于收敛比较）
}

interface Props {
  yaw: number;
  sens: number;
  mode: AimMode;
  hFovDeg: number;
  durationMs: number;
  onDone: (stats: RoundStats) => void;
}

const DEG = Math.PI / 180;
const TARGET_RADIUS = 18;
const TARGET_LIFE_MS = 1600;
const ON_TARGET_DEG = 1.6;

function hFovToVFov(hFovDeg: number, aspect: number): number {
  const v = 2 * Math.atan(Math.tan((hFovDeg / 2) * DEG) / aspect) / DEG;
  return Math.min(179, Math.max(10, v));
}

export function AimScene({ yaw, sens, mode, hFovDeg, durationMs, onDone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhaseState] = useState<'idle' | 'running' | 'finished'>('idle');
  const phaseRef = useRef<'idle' | 'running' | 'finished'>('idle');
  function setPhase(p: 'idle' | 'running' | 'finished') {
    phaseRef.current = p;
    setPhaseState(p);
  }
  const [hud, setHud] = useState({ hits: 0, misses: 0, seconds: 0 });
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ---------- 场景初始化 ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e13);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(120, 60, 0x2a3240, 0x1a2028);
    scene.add(grid);

    // 远处参考墙（帮助玩家感知转动）
    const wallGeo = new THREE.PlaneGeometry(400, 400);
    const wallMat = new THREE.MeshBasicMaterial({ color: 0x131820, side: THREE.BackSide });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 0, -200);
    scene.add(wall);

    // 目标球
    const target = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0x441100, roughness: 0.4 }),
    );
    scene.add(target);
    const targetGlow = new THREE.PointLight(0xff5a3c, 2, 12);
    target.add(targetGlow);

    let aspect = 1;
    function resize() {
      const w = container?.clientWidth || 1;
      const h = container?.clientHeight || 1;
      aspect = w / h;
      renderer.setSize(w, h);
      camera.aspect = aspect;
      camera.fov = hFovToVFov(hFovDeg, aspect);
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);
    container.appendChild(renderer.domElement);

    // ---------- 可变状态 ----------
    const mouseDelta = { x: 0, y: 0 };
    let startedAt = 0;
    let done = false;
    let rafId = 0;

    // flick 统计
    let hits = 0;
    let misses = 0;
    let killMsSum = 0;
    let targetSpawnedAt = 0;
    let shots = 0;

    // track 统计
    let errSum = 0;
    let errFrames = 0;
    let onTargetFrames = 0;

    // track 运动参数
    const trackYawAmp = Math.max(5, hFovDeg * 0.32);
    const trackPitchAmp = 14 + Math.random() * 6;
    const trackSpeed = 0.5 + Math.random() * 0.5;

    let lastHudAt = 0;

    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);

    function dirFromOffsets(yawOffDeg: number, pitchOffDeg: number): THREE.Vector3 {
      const e = new THREE.Euler(pitchOffDeg * DEG, yawOffDeg * DEG, 0, 'YXZ');
      return new THREE.Vector3(0, 0, -1).applyEuler(e).applyEuler(camera.rotation);
    }

    function placeFlickTarget() {
      const yawOff = (Math.random() * 2 - 1) * (hFovDeg * 0.38);
      const pitchOff = (Math.random() * 2 - 1) * 18;
      const d = dirFromOffsets(yawOff, pitchOff);
      target.position.copy(camera.position).addScaledVector(d, TARGET_RADIUS);
      targetSpawnedAt = performance.now();
    }

    function updateTrackTarget(t: number) {
      const yawOff = trackYawAmp * Math.sin(t * trackSpeed);
      const pitchOff = trackPitchAmp * Math.sin(t * trackSpeed * 0.73 + 1.3);
      const d = dirFromOffsets(yawOff, pitchOff);
      target.position.copy(camera.position).addScaledVector(d, TARGET_RADIUS);
    }

    function shoot() {
      if (mode !== 'flick') return;
      shots += 1;
      raycaster.setFromCamera(center, camera);
      const hit = raycaster.intersectObject(target).length > 0;
      if (hit) {
        hits += 1;
        killMsSum += performance.now() - targetSpawnedAt;
        placeFlickTarget();
      }
    }

    function onMouseMove(e: MouseEvent) {
      mouseDelta.x += e.movementX;
      mouseDelta.y += e.movementY;
    }

    function onMouseDown() {
      shoot();
    }

    // ---------- 主循环 ----------
    function loop() {
      rafId = requestAnimationFrame(loop);
      const now = performance.now();

      // 应用鼠标旋转（与游戏一致的物理：sens × yaw 度/count）
      const yawRad = (mouseDelta.x * sens * yaw) * DEG;
      const pitchRad = (mouseDelta.y * sens * yaw) * DEG;
      camera.rotation.y -= yawRad;
      camera.rotation.x -= pitchRad;
      camera.rotation.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, camera.rotation.x));
      mouseDelta.x = 0;
      mouseDelta.y = 0;

      if (phaseRef.current === 'running') {
        const elapsed = now - startedAt;

        if (mode === 'flick') {
          if (now - targetSpawnedAt > TARGET_LIFE_MS) {
            misses += 1;
            placeFlickTarget();
          }
        } else {
          updateTrackTarget((now - startedAt) / 1000);
          const camDir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
          const toTarget = target.position.clone().sub(camera.position).normalize();
          const angDeg = (Math.acos(Math.max(-1, Math.min(1, camDir.dot(toTarget)))) / DEG);
          errSum += angDeg;
          errFrames += 1;
          if (angDeg <= ON_TARGET_DEG) onTargetFrames += 1;
        }

        // HUD 节流刷新
        if (now - lastHudAt > 120) {
          lastHudAt = now;
          setHud({ hits, misses, seconds: Math.max(0, (durationMs - elapsed) / 1000) });
        }

        if (elapsed >= durationMs && !done) {
          done = true;
          finish();
        }
      }

      renderer.render(scene, camera);
    }

    function buildStats(): RoundStats {
      const duration = durationMs;
      const avgKillMs = hits > 0 ? killMsSum / hits : TARGET_LIFE_MS;
      const avgErrorDeg = errFrames > 0 ? errSum / errFrames : 90;
      const onTargetRatio = errFrames > 0 ? onTargetFrames / errFrames : 0;
      let score: number;
      if (mode === 'flick') {
        // 命中 10 分、miss 扣 2，击杀速度小幅加成
        score = Math.max(0, hits * 10 - misses * 2 - shots * 0.1 + Math.max(0, 6 - avgKillMs / 250));
      } else {
        // 在目标上时间占比 ×100 + 误差惩罚
        score = Math.max(0, onTargetRatio * 100 - avgErrorDeg * 1.5);
      }
      return { mode, durationMs: duration, hits, misses, avgKillMs, avgErrorDeg, onTargetRatio, score };
    }

    function finish() {
      const stats = buildStats();
      if (document.pointerLockElement) document.exitPointerLock();
      setPhase('finished');
      onDoneRef.current(stats);
    }

    function startTask() {
      // 重置统计
      hits = 0;
      misses = 0;
      killMsSum = 0;
      shots = 0;
      errSum = 0;
      errFrames = 0;
      onTargetFrames = 0;
      mouseDelta.x = 0;
      mouseDelta.y = 0;
      camera.rotation.set(0, 0, 0);
      startedAt = performance.now();
      done = false;
      if (mode === 'flick') placeFlickTarget();
      else updateTrackTarget(0);
      setHud({ hits: 0, misses: 0, seconds: durationMs / 1000 });
      setPhase('running');
    }

    function onClickOverlay() {
      const el = renderer.domElement;
      const p = el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.then === 'function') {
        p.then(() => startTask()).catch(() => setPhase('idle'));
      } else {
        startTask();
      }
    }

    function onLockChange() {
      if (document.pointerLockElement !== renderer.domElement && phaseRef.current === 'running' && !done) {
        // 玩家按 ESC 中途退出：按当前进度结算
        done = true;
        finish();
      }
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('pointerlockchange', onLockChange);
    loop();

    // 把 overlay 点击处理函数挂到容器，供 JSX 使用
    (container as unknown as { _onClickOverlay?: () => void })._onClickOverlay = onClickOverlay;

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('pointerlockchange', onLockChange);
      window.removeEventListener('resize', resize);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleOverlayClick() {
    const fn = (containerRef.current as unknown as { _onClickOverlay?: () => void })?._onClickOverlay;
    fn?.();
  }

  return (
    <div className="aim-wrap">
      <div className="aim-container" ref={containerRef} />
      <div className="crosshair" />
      {phase === 'idle' && (
        <div className="aim-overlay" onClick={handleOverlayClick}>
          <p className="aim-overlay-title">
            {mode === 'flick' ? 'Flick 甩枪测试' : 'Tracking 跟枪测试'}
          </p>
          <p className="aim-overlay-sub">点击进入，鼠标指针会锁定到画面</p>
          {mode === 'flick' && <p className="aim-overlay-hint">目标出现后，快速甩枪点击打掉它</p>}
          {mode === 'track' && <p className="aim-overlay-hint">目标移动时，把准星持续压在它上面</p>}
        </div>
      )}
      {phase === 'running' && (
        <div className="aim-hud">
          <span>剩余 {hud.seconds.toFixed(0)}s</span>
          {mode === 'flick' && <span>命中 {hud.hits} · 漏掉 {hud.misses}</span>}
          {mode === 'track' && <span>保持准星压住目标</span>}
        </div>
      )}
      {phase === 'finished' && (
        <div className="aim-overlay done">
          <p className="aim-overlay-title">本轮完成</p>
          {mode === 'flick' && <p className="aim-overlay-hint">命中 {hud.hits} · 漏掉 {hud.misses}</p>}
        </div>
      )}
    </div>
  );
}
