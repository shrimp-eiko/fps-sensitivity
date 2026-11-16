// 本地历史档案：用 localStorage 持久化测试记录。
// 后续升级后端云同步时，保持此接口不变，替换实现即可。
export type TestKind = 'psa' | 'lab';

export interface TestRecord {
  id: string;
  createdAt: number;
  kind: TestKind;
  gameId: string;
  dpi: number;
  startSens: number;
  resultCm360: number;
  resultSens: number;
  fov?: number;
}

const KEY = 'fps_sens_history_v1';

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadHistory(): TestRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as TestRecord[]) : [];
  } catch {
    return [];
  }
}

function persist(list: TestRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 存储满或不可用时静默忽略
  }
}

export function saveRecord(record: TestRecord): TestRecord[] {
  const list = [record, ...loadHistory()];
  persist(list);
  return list;
}

export function deleteRecord(id: string): TestRecord[] {
  const list = loadHistory().filter((r) => r.id !== id);
  persist(list);
  return list;
}

export function clearHistory(): TestRecord[] {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  return [];
}
