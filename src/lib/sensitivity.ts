// 核心换算引擎：所有公式只依赖 yaw 常量，纯函数、可离线、可单测。
export const CM360_CONST = 914.4; // 360 × 2.54，把 inch 转为 cm

export function cm360(dpi: number, sens: number, yaw: number): number {
  return CM360_CONST / (dpi * sens * yaw);
}

export function sensFromCm360(dpi: number, cm: number, yaw: number): number {
  return CM360_CONST / (dpi * cm * yaw);
}

export function eDpi(dpi: number, sens: number): number {
  return dpi * sens;
}

// 保持相同 cm/360 的前提下，把源游戏灵敏度换算到目标游戏
export function convertSens(
  sourceSens: number,
  sourceYaw: number,
  targetYaw: number,
  sourceDpi: number,
  targetDpi: number = sourceDpi,
): number {
  return sourceSens * (sourceYaw / targetYaw) * (sourceDpi / targetDpi);
}

export function roundTo(sens: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(sens * factor) / factor;
}

// 便于阅读的 cm/360 显示（保留 1 位小数）
export function fmtCm(cm: number): string {
  if (!Number.isFinite(cm) || cm <= 0) return '—';
  return `${cm.toFixed(1)} cm`;
}
