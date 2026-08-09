import type { FilterState, Lang, UserProgress } from "../types";

const LANG_KEY = "mysekai-lang";
const CHECKED_OFF_KEY = "mysekai-checked-off";
const FILTERS_KEY = "mysekai-filters";
const MYSEKAI_STORAGE_KEY = "mysekai-mysekai-data";
const SUITE_STORAGE_KEY = "mysekai-suite-data";

interface CachedProgress {
  v: 1;
  ownedBlueprintIds: number[];
  talkReadById: [number, boolean][];
  blueprintDataAvailable: boolean;
  talkDataAvailable: boolean;
  sourceFileName?: string;
  updatedAt?: number;
  detectedFormat?: string;
}

function progressToCache(progress: UserProgress): CachedProgress {
  return {
    v: 1,
    ownedBlueprintIds: [...progress.ownedBlueprintIds],
    talkReadById: [...progress.talkReadById],
    blueprintDataAvailable: progress.blueprintDataAvailable,
    talkDataAvailable: progress.talkDataAvailable,
    sourceFileName: progress.sourceFileName,
    updatedAt: progress.updatedAt,
    detectedFormat: progress.detectedFormat,
  };
}

function cacheToProgress(cached: CachedProgress): UserProgress {
  return {
    ownedBlueprintIds: new Set(cached.ownedBlueprintIds),
    talkReadById: new Map(cached.talkReadById),
    blueprintDataAvailable: cached.blueprintDataAvailable,
    talkDataAvailable: cached.talkDataAvailable,
    sourceFileName: cached.sourceFileName,
    updatedAt: cached.updatedAt,
    detectedFormat: cached.detectedFormat as UserProgress["detectedFormat"],
  };
}

/** 保存语言选择 */
export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // 静默忽略
  }
}

/** 读取语言选择，默认 cn */
export function loadLang(): Lang {
  try {
    const value = localStorage.getItem(LANG_KEY);
    if (value === "cn" || value === "jp" || value === "tw" || value === "en" || value === "kr") {
      return value;
    }
  } catch {
    // 静默忽略
  }
  return "cn";
}

/** 从 localStorage 恢复手动划掉的对话组 ID 集合 */
export function loadCheckedOff(): Set<number> {
  try {
    const raw = localStorage.getItem(CHECKED_OFF_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

/** 将手动划掉的对话组 ID 集合存入 localStorage */
export function saveCheckedOff(ids: Set<number>) {
  try {
    localStorage.setItem(CHECKED_OFF_KEY, JSON.stringify([...ids]));
  } catch {
    // 静默忽略
  }
}

/** 清除手动划掉记录 */
export function clearCheckedOff() {
  try {
    localStorage.removeItem(CHECKED_OFF_KEY);
  } catch {
    // 静默忽略
  }
}

/* ---- My SEKAI 抓包 ---- */
export function saveMysekaiData(progress: UserProgress) {
  try {
    localStorage.setItem(MYSEKAI_STORAGE_KEY, JSON.stringify(progressToCache(progress)));
  } catch (e) {
    console.warn("缓存 My SEKAI 数据失败", e);
  }
}

export function loadMysekaiProgress(): UserProgress | null {
  try {
    const raw = localStorage.getItem(MYSEKAI_STORAGE_KEY);
    if (!raw) return null;
    const data: CachedProgress = JSON.parse(raw);
    // 兼容旧格式 { rawText } — 迁移到新格式
    if ("rawText" in data) return null;
    return cacheToProgress(data);
  } catch (e) {
    console.warn("读取 My SEKAI 缓存失败", e);
    return null;
  }
}

export function clearMysekaiData() {
  try {
    localStorage.removeItem(MYSEKAI_STORAGE_KEY);
  } catch {
    // 静默忽略
  }
}

/* ---- Suite 响应 ---- */
export function saveSuiteData(progress: UserProgress) {
  try {
    localStorage.setItem(SUITE_STORAGE_KEY, JSON.stringify(progressToCache(progress)));
  } catch (e) {
    console.warn("缓存 Suite 数据失败", e);
  }
}

export function loadSuiteProgress(): UserProgress | null {
  try {
    const raw = localStorage.getItem(SUITE_STORAGE_KEY);
    if (!raw) return null;
    const data: CachedProgress = JSON.parse(raw);
    // 兼容旧格式 { rawText } — 迁移到新格式
    if ("rawText" in data) return null;
    return cacheToProgress(data);
  } catch (e) {
    console.warn("读取 Suite 缓存失败", e);
    return null;
  }
}

export function clearSuiteData() {
  try {
    localStorage.removeItem(SUITE_STORAGE_KEY);
  } catch {
    // 静默忽略
  }
}

/* ---- 筛选条件 ---- */
export function saveFilters(filters: FilterState) {
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  } catch {
    // 静默忽略
  }
}

export function loadFilters(): FilterState | null {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FilterState;
  } catch {
    return null;
  }
}
