import type { Lang, UserProgress } from "../types";
import { parseUserJsonText } from "./userData";

const STORAGE_KEY = "mysekai-user-data";
const LANG_KEY = "mysekai-lang";

interface CachedPayload {
  rawText: string;
  sourceFileName?: string;
}

/** 从 localStorage 恢复用户进度，无缓存时返回 null */
export function loadProgress(): UserProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const payload: CachedPayload = JSON.parse(raw);
    return parseUserJsonText(payload.rawText, payload.sourceFileName);
  } catch {
    return null;
  }
}

/** 将用户 JSON 原文存入 localStorage */
export function saveProgress(rawText: string, sourceFileName?: string) {
  try {
    const payload: CachedPayload = { rawText, sourceFileName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage 满或不可用时静默忽略
  }
}

/** 清除 localStorage 中的用户缓存 */
export function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 静默忽略
  }
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
