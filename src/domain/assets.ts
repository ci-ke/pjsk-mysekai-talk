import type { FixtureRecord, Lang, TalkAssetRecord } from "../types";

/**
 * 资源站（Moesekai / pjsk.moe）的 CDN。
 * 主线路 storage.pjsk.moe（Cloudflare），备用线路 storage.exmeaning.com（EdgeOne），
 * 两者内容一致且都开放 CORS。使用这些资源时请保留对 Moesekai (pjsk.moe) 的致谢。
 */
const ASSET_DOMAINS = [
  "https://storage.pjsk.moe",
  "https://storage.exmeaning.com",
] as const;

const ASSET_LANGS: Record<Lang, string> = {
  cn: "cn",
  jp: "jp",
  tw: "tw",
  en: "en",
  kr: "kr",
};

/**
 * 家具缩略图在 CDN 上有两种目录布局：
 *   JP / EN — mysekai/thumbnail/fixture/{bundle}_1/{bundle}_1.png
 *   CN / TW / KR — mysekai/thumbnail/fixture/{bundle}_1.png
 * 优先使用本区服的布局，另一种作为兜底。
 */
const NESTED_FIXTURE_THUMBNAIL_LANGS = new Set<Lang>(["jp", "en"]);

export function getAssetBaseUrls(lang: Lang): string[] {
  const assetLang = ASSET_LANGS[lang] || ASSET_LANGS.cn;
  return ASSET_DOMAINS.map((domain) => `${domain}/sekai-${assetLang}-assets`);
}

export function getAssetBaseUrl(lang: Lang) {
  return getAssetBaseUrls(lang)[0];
}

/** 墙面 / 地板类家具的缩略图按主分类区分文件名。 */
const SURFACE_GENRES: Record<number, string> = { 7: "wall", 8: "floor" };

function getSurfaceLayout(fixture: FixtureRecord): string {
  const byGenre = fixture.mysekaiFixtureMainGenreId
    ? SURFACE_GENRES[fixture.mysekaiFixtureMainGenreId]
    : undefined;
  if (byGenre) return byGenre;
  const layout = fixture.mysekaiSettableLayoutType || "wall_appearance";
  return layout.replace(/_appearance$/, "");
}

function fixtureThumbnailCandidates(
  lang: Lang,
  directory: string,
  bundle: string,
  file: string
): string[] {
  const nested = `${directory}/${bundle}/${file}.png`;
  const flat = `${directory}/${file}.png`;
  const layouts = NESTED_FIXTURE_THUMBNAIL_LANGS.has(lang) ? [nested, flat] : [flat, nested];

  // 主线路的两个布局都试过之后，再走备用线路。
  return getAssetBaseUrls(lang).flatMap((base) =>
    layouts.map((layout) => `${base}/mysekai/thumbnail/${layout}`)
  );
}

/**
 * 家具缩略图的候选 URL，按尝试顺序排列。
 * 无家具或缺少 assetbundleName 时返回空数组，由调用方展示占位图。
 */
export function getFixtureThumbnailUrls(fixture: FixtureRecord | null, lang: Lang): string[] {
  if (!fixture?.assetbundleName) return [];
  if (fixture.mysekaiFixtureType === "surface_appearance") {
    const surface = getSurfaceLayout(fixture);
    const file = `tex_${fixture.assetbundleName}_${surface}_appearance_1`;
    return fixtureThumbnailCandidates(lang, "surface_appearance", fixture.assetbundleName, file);
  }
  const name = `${fixture.assetbundleName}_1`;
  return fixtureThumbnailCandidates(lang, "fixture", name, name);
}

export function getCharacterColor(colorCode: string | null | undefined) {
  return colorCode || "#7890c8";
}

export function getInitials(text: string) {
  return text.trim().slice(0, 2) || "?";
}

export function getTalkScriptUrls(talk: TalkAssetRecord, lang: Lang): string[] {
  return getAssetBaseUrls(lang).map(
    (base) => `${base}/${talk.assetbundleName}/${talk.lua}.lua.txt`
  );
}

export function getTalkScriptUrl(talk: TalkAssetRecord, lang: Lang) {
  return getTalkScriptUrls(talk, lang)[0];
}

/**
 * 从 Lua 脚本中提取角色名和对话文本，去除舞台指令。
 * 输出格式：
 *   【角色名】
 *   对话内容
 */
export function parseTalkScript(raw: string): string {
  const lines: string[] = [];
  let currentLabel = "";

  for (const line of raw.split("\n")) {
    const labelMatch = line.match(/label\("(.+?)"\)/);
    if (labelMatch) {
      currentLabel = labelMatch[1];
      continue;
    }

    const textMatch = line.match(/text\("([^"]*)"\)/);
    if (textMatch && currentLabel) {
      const text = textMatch[1].replace(/\\n/g, "\n");
      lines.push(`【${currentLabel}】`);
      lines.push(text);
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}
