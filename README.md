# FPS 灵敏度测试与换算器

帮助 FPS 玩家测出属于自己的"跟手"灵敏度，并在 **Apex 英雄、三角洲行动、无畏契约（Valorant）、CS2 / CS:GO** 四款游戏之间保持一致手感。

## 功能

- **深度测试（3D 客观版）**：Three.js 场景里跑 Flick 甩枪 + Tracking 跟枪任务，按游戏真实 yaw 物理还原鼠标旋转，由客观得分用黄金分割法自动收敛出最优 cm/360，再换算到四款游戏。
- **PSA 测试（七轮二分）**：以当前灵敏度为基准，每轮进游戏试"更低/更高"两个候选，七轮收敛。
- **换算器**：任意一款游戏输入灵敏度，自动换算到其余三款，保持 cm/360 一致。
- **DPI 实测校准**：用 Pointer Lock 统计 raw counts，反推鼠标真实 DPI（标称值常有 ±3% 甚至更大偏差）。
- **历史记录**：测试结果自动保存本地，可追踪手感变化。

## 核心公式

```
degrees_per_count = 灵敏度 × yaw
cm/360 = 914.4 ÷ (DPI × 灵敏度 × yaw)
换算：目标灵敏度 = 源灵敏度 × (源 yaw ÷ 目标 yaw) × (源 DPI ÷ 目标 DPI)
```

## 四款游戏 yaw 常量

| 游戏 | yaw | 置信度 |
|---|---|---|
| CS2 / CS:GO | 0.022 | ✅ Valve 官方 `m_yaw` 默认值 |
| Apex 英雄 | 0.022 | ✅ 与 CS2 同源 |
| 三角洲行动 | 0.022 | ⚠️ 社区多来源一致，官方未公布 |
| 无畏契约 | 0.07 | ✅ Riot 自定 |

## 技术栈

Vite 5 · React 18 · TypeScript · Three.js（纯前端，核心计算全部离线）

## 本地运行

```bash
pnpm install
pnpm dev       # 开发服务器 http://localhost:5173
pnpm build     # 产物在 dist/
pnpm preview   # 预览生产构建
```

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库，把本项目推送到 `main` 分支；
2. 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**；
3. 每次推送到 `main` 会自动构建并部署（见 `.github/workflows/deploy.yml`）。

## 目录结构

```
src/
├── data/games.ts            # 游戏 yaw 数据库
├── lib/sensitivity.ts       # 换算引擎
├── lib/psa.ts               # PSA 七轮二分
├── lib/aim/converge.ts      # 黄金分割收敛算法
├── lib/storage.ts           # 历史记录持久化
├── components/
│   ├── Converter.tsx        # 换算器
│   ├── PsaTester.tsx        # PSA 测试
│   ├── DpiCalibrator.tsx    # DPI 实测校准
│   ├── HistoryPanel.tsx     # 历史记录
│   └── aim/                 # 3D 深度测试
└── App.tsx
```
