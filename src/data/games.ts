export type Confidence = 'confirmed' | 'community';

export interface Game {
  id: string;
  name: string;
  nameEn: string;
  yaw: number;          // degrees per mouse count at sens = 1.0
  decimals: number;     // 游戏内可设置的小数位
  min: number;
  max: number;
  confidence: Confidence;
  note: string;
}

export const GAMES: Game[] = [
  {
    id: 'cs2',
    name: 'CS2 / CS:GO',
    nameEn: 'Counter-Strike 2',
    yaw: 0.022,
    decimals: 4,
    min: 0.001,
    max: 20,
    confidence: 'confirmed',
    note: 'Source 2 引擎，m_yaw 默认 0.022（Valve 官方默认值）',
  },
  {
    id: 'apex',
    name: 'Apex 英雄',
    nameEn: 'Apex Legends',
    yaw: 0.022,
    decimals: 2,
    min: 0.1,
    max: 20,
    confidence: 'confirmed',
    note: 'Source 引擎，与 CS2 同源，灵敏度数值 1:1 互换',
  },
  {
    id: 'deltaforce',
    name: '三角洲行动',
    nameEn: 'Delta Force',
    yaw: 0.022,
    decimals: 2,
    min: 0.1,
    max: 10,
    confidence: 'community',
    note: '社区多来源一致为 0.022°/count，官方未公布；实测 1.0@800DPI≈52cm/360',
  },
  {
    id: 'valorant',
    name: '无畏契约',
    nameEn: 'Valorant',
    yaw: 0.07,
    decimals: 3,
    min: 0.1,
    max: 10,
    confidence: 'confirmed',
    note: 'Riot 自定 0.07°/count；CS2 转 Valorant ≈ ×0.3143',
  },
];

export function getGame(id: string): Game {
  const g = GAMES.find((x) => x.id === id);
  if (!g) throw new Error(`未知游戏: ${id}`);
  return g;
}
