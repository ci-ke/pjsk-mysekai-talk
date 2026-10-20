/**
 * Haruki 工具箱公开数据源。
 *
 * 抓包数据由用户上传到 Haruki 工具箱（Team Haruki），公开后可通过只读接口读取：
 *   GET {base}/{server}/suite/{gameId}?key=userMysekaiCharacterTalks,upload_time
 *   GET {base}/{server}/mysekai/{gameId}
 *
 * 该接口只对白名单来源返回 Access-Control-Allow-Origin，静态站点无法直接跨域
 * fetch，因此这里同时支持：
 *   1. 生成直链，让用户在浏览器里打开/另存为 JSON 后手动上传（无需跨域）；
 *   2. 经由同源代理（vite dev server 或自建反代）直接拉取。
 */

export type HarukiServer = "cn" | "jp" | "tw" | "kr" | "en";

export interface HarukiServerOption {
  value: HarukiServer;
  label: string;
}

export const HARUKI_SERVERS: HarukiServerOption[] = [
  { value: "cn", label: "简中" },
  { value: "jp", label: "日服" },
  { value: "tw", label: "繁中" },
  { value: "kr", label: "韩服" },
  { value: "en", label: "国际服" },
];

/** Haruki 公开接口的原始地址。 */
export const HARUKI_PUBLIC_BASE = "https://suite-api.haruki.seiunx.com/public";

/** 站内代理路径：vite dev/preview server 会把请求转发到 HARUKI_PUBLIC_BASE。 */
export const HARUKI_PROXY_PATH = "/api/haruki-public";

/**
 * Suite 只取对话进度和上传时间。
 * 完整 suite 数据约 5 MB 以上，而这两个 key 组成的子集只有几百 KB；
 * 注意接口在「只请求一个 key」时返回裸值而不是对象，所以这里始终请求两个。
 */
export const HARUKI_SUITE_KEYS = ["userMysekaiCharacterTalks", "upload_time"] as const;

const MAX_GAME_ID_LENGTH = 20;

/** 把用户输入（含全角数字、空格）规范成纯数字游戏 ID，非法时返回 null。 */
export function normalizeGameId(input: string): string | null {
  const ascii = input
    .replace(/[\uff10-\uff19]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[\s\u3000]/g, "");
  if (!/^[1-9]\d{0,19}$/.test(ascii)) return null;
  if (ascii.length > MAX_GAME_ID_LENGTH) return null;
  return ascii;
}

export function isHarukiServer(value: unknown): value is HarukiServer {
  return typeof value === "string" && HARUKI_SERVERS.some((item) => item.value === value);
}

export function harukiServerLabel(server: HarukiServer): string {
  return HARUKI_SERVERS.find((item) => item.value === server)?.label ?? server;
}

/** 规范化接口基地址：去空白、去尾部斜杠；空值回落到默认值。 */
export function normalizeApiBase(input: string | undefined | null): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return defaultApiBase();
  return trimmed.replace(/\/+$/, "");
}

/** 默认接口地址：优先使用构建期注入的代理地址，否则用站内代理路径。 */
export function defaultApiBase(): string {
  const fromEnv = import.meta.env?.VITE_HARUKI_API_BASE;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/+$/, "");
  }
  return HARUKI_PROXY_PATH;
}

export function buildSuiteUrl(base: string, server: HarukiServer, gameId: string): string {
  return `${normalizeApiBase(base)}/${server}/suite/${gameId}?key=${HARUKI_SUITE_KEYS.join(",")}`;
}

export function buildMysekaiUrl(base: string, server: HarukiServer, gameId: string): string {
  return `${normalizeApiBase(base)}/${server}/mysekai/${gameId}`;
}

export type HarukiSource = "mysekai" | "suite";

export interface HarukiLink {
  source: HarukiSource;
  label: string;
  description: string;
  /** 浏览器直接打开/另存为的链接，不受跨域限制。 */
  url: string;
}

/**
 * 两个数据源的直链（走原始公开接口，不经过代理）。
 * 用户可以把它们保存成 JSON 再用页面上的上传入口导入。
 */
export function buildHarukiDirectLinks(server: HarukiServer, gameId: string): HarukiLink[] {
  return [
    {
      source: "mysekai",
      label: "My SEKAI",
      description: "蓝图 + 对话，约 200 KB – 几 MB",
      url: buildMysekaiUrl(HARUKI_PUBLIC_BASE, server, gameId),
    },
    {
      source: "suite",
      label: "Suite",
      description: "仅对话进度，已裁剪到最小子集",
      url: buildSuiteUrl(HARUKI_PUBLIC_BASE, server, gameId),
    },
  ];
}

export type HarukiErrorCode =
  | "invalid-id"
  | "not-found"
  | "forbidden"
  | "rate-limited"
  | "network"
  | "bad-response"
  | "http";

export class HarukiFetchError extends Error {
  readonly code: HarukiErrorCode;
  readonly status?: number;

  constructor(code: HarukiErrorCode, status?: number) {
    super(`Haruki 数据获取失败：${code}${status ? ` (HTTP ${status})` : ""}`);
    this.name = "HarukiFetchError";
    this.code = code;
    this.status = status;
  }
}

/** 面向用户的中文错误说明。 */
export function harukiErrorText(error: unknown): string {
  const code = error instanceof HarukiFetchError ? error.code : "network";
  switch (code) {
    case "invalid-id":
      return "游戏 ID 需为纯数字（不含 @、空格等字符）。";
    case "not-found":
      return "没有找到该 ID 的公开数据。请确认区服和游戏 ID，并确认已在 Haruki 工具箱公开了这项数据。";
    case "forbidden":
      return "该玩家没有把这项数据设为公开。";
    case "rate-limited":
      return "请求过于频繁，请稍后再试。";
    case "bad-response":
      return "接口返回的不是 JSON。当前部署可能没有配置 Haruki 代理，请改用「打开 JSON」下载后上传。";
    case "http":
      return error instanceof HarukiFetchError && error.status
        ? `数据源返回 HTTP ${error.status}，请稍后再试。`
        : "数据源返回了异常状态。";
    case "network":
    default:
      return "浏览器跨域限制导致无法直接读取 Haruki 接口：请用「打开 JSON」保存文件后手动上传，或在本地运行 npm run dev 使用站内代理。";
  }
}

// 按字符数近似限制响应体积，避免代理配置错误时把超大页面读进内存。
const MAX_RESPONSE_LENGTH = 32 * 1024 * 1024;

/**
 * 通过代理地址拉取 Haruki JSON。
 * 跨域失败（fetch reject）统一报告为 network；非 JSON 响应报告为 bad-response。
 */
export async function fetchHarukiJson(
  url: string,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {}
): Promise<unknown> {
  const doFetch = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await doFetch(url, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new HarukiFetchError("network");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new HarukiFetchError("bad-response", response.status);
  }
  if (response.status === 404) throw new HarukiFetchError("not-found", 404);
  if (response.status === 403) throw new HarukiFetchError("forbidden", 403);
  if (response.status === 429) throw new HarukiFetchError("rate-limited", 429);
  if (!response.ok) throw new HarukiFetchError("http", response.status);

  const text = await response.text();
  if (text.length > MAX_RESPONSE_LENGTH) throw new HarukiFetchError("bad-response", response.status);

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HarukiFetchError("bad-response", response.status);
  }
}
