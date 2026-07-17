import type { UserProgress } from "../types";

export class UserDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserDataError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && (value === 0 || value === 1)) return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return null;
}

function findFirstProperty(
  root: unknown,
  keys: string[],
  maxDepth = 4
): { found: boolean; value: unknown } {
  const queue: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  const visited = new Set<object>();

  while (queue.length) {
    const current = queue.shift()!;
    if (isRecord(current.value)) {
      if (visited.has(current.value)) continue;
      visited.add(current.value);
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(current.value, key)) {
          return { found: true, value: current.value[key] };
        }
      }
      if (current.depth < maxDepth) {
        for (const value of Object.values(current.value)) {
          if (isRecord(value) || Array.isArray(value)) {
            queue.push({ value, depth: current.depth + 1 });
          }
        }
      }
    }
  }

  return { found: false, value: undefined };
}

export function extractUpdatedResources(input: unknown): Record<string, unknown> {
  const direct = findFirstProperty(input, ["updatedResources"], 3);
  if (isRecord(direct.value)) return direct.value;

  const candidate = findFirstProperty(
    input,
    ["userMysekaiBlueprints", "userMysekaiCharacterTalks"],
    4
  );
  if (isRecord(candidate.value)) return candidate.value;
  if (isRecord(input)) return input;

  throw new UserDataError("JSON 顶层不是对象，无法读取 My SEKAI 数据。");
}

function normalizeBlueprintIds(value: unknown): Set<number> {
  const ids = new Set<number>();
  if (!Array.isArray(value)) return ids;

  for (const item of value) {
    const rawId = isRecord(item) ? item.mysekaiBlueprintId ?? item.id : item;
    const id = asFiniteNumber(rawId);
    if (id !== null) ids.add(id);
  }
  return ids;
}

function addTalkStatus(map: Map<number, boolean>, id: number, status: boolean) {
  // 多份合并数据中只要有一次已读，就按已读处理。
  map.set(id, Boolean(map.get(id) || status));
}

function normalizeTalkValue(value: unknown, map: Map<number, boolean>) {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (Array.isArray(item)) {
        const id = asFiniteNumber(item[0]);
        const status = asBoolean(item[1]);
        if (id !== null && status !== null) addTalkStatus(map, id, status);
      } else if (isRecord(item)) {
        normalizeTalkValue(item, map);
      }
    }
    return;
  }

  if (isRecord(value)) {
    const id = asFiniteNumber(
      value.mysekaiCharacterTalkId ?? value.characterTalkId ?? value.talkId ?? value.id
    );
    const status = asBoolean(value.isRead ?? value.read ?? value.isUnlocked ?? value.unlocked);
    if (id !== null && status !== null) {
      addTalkStatus(map, id, status);
      return;
    }

    // 兼容 {"123": true} 形式的简化数据。
    for (const [key, itemStatus] of Object.entries(value)) {
      const mapId = asFiniteNumber(key);
      const mapStatus = asBoolean(itemStatus);
      if (mapId !== null && mapStatus !== null) addTalkStatus(map, mapId, mapStatus);
    }
  }
}

export function normalizeTalkStatuses(value: unknown): Map<number, boolean> {
  const result = new Map<number, boolean>();
  normalizeTalkValue(value, result);
  return result;
}

export function parseUserJson(input: unknown, sourceFileName?: string): UserProgress {
  const resources = extractUpdatedResources(input);
  const blueprintSource = findFirstProperty(resources, ["userMysekaiBlueprints"], 2);
  const talkSource = findFirstProperty(resources, ["userMysekaiCharacterTalks"], 2);
  const historySource = findFirstProperty(
    resources,
    ["mysekaiCharacterTalkWithReadHistories"],
    4
  );

  if (!blueprintSource.found) {
    throw new UserDataError(
      "找不到 userMysekaiBlueprints。请上传 My SEKAI 抓包 JSON，而不是普通 Suite 或其他接口数据。"
    );
  }

  const talkValue = talkSource.found ? talkSource.value : historySource.value;
  const talkDataAvailable = talkSource.found || historySource.found;
  const updatedAt = asFiniteNumber(resources.now ?? resources.updatedAt);

  return {
    ownedBlueprintIds: normalizeBlueprintIds(blueprintSource.value),
    talkReadById: normalizeTalkStatuses(talkValue),
    blueprintDataAvailable: true,
    talkDataAvailable,
    sourceFileName,
    updatedAt: updatedAt ?? undefined,
  };
}

export function parseUserJsonText(text: string, sourceFileName?: string): UserProgress {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new UserDataError("文件不是有效的 JSON，无法解析。");
  }
  return parseUserJson(parsed, sourceFileName);
}
