import type { FixtureRecord, Lang, TalkAssetRecord } from "../types";

const ASSET_BASES: Record<Lang, string> = {
  cn: "https://storage.exmeaning.com/sekai-cn-assets",
  jp: "https://storage.exmeaning.com/sekai-jp-assets",
  tw: "https://storage.exmeaning.com/sekai-tw-assets",
  en: "https://storage.exmeaning.com/sekai-en-assets",
  kr: "https://storage.exmeaning.com/sekai-kr-assets",
};

export function getAssetBaseUrl(lang: Lang) {
  return ASSET_BASES[lang] || ASSET_BASES.cn;
}

export function getFixtureThumbnailUrl(fixture: FixtureRecord | null, lang: Lang) {
  if (!fixture?.assetbundleName) return "/placeholder.svg";
  const base = getAssetBaseUrl(lang);
  if (fixture.mysekaiFixtureType === "surface_appearance") {
    const layout = fixture.mysekaiSettableLayoutType || "wall_appearance";
    return `${base}/mysekai/thumbnail/surface_appearance/${fixture.assetbundleName}/tex_${fixture.assetbundleName}_${layout}_1.png`;
  }
  return `${base}/mysekai/thumbnail/fixture/${fixture.assetbundleName}_1.webp`;
}

export function getCharacterColor(colorCode: string | null | undefined) {
  return colorCode || "#7890c8";
}

export function getInitials(text: string) {
  return text.trim().slice(0, 2) || "?";
}

export function getTalkScriptUrl(talk: TalkAssetRecord, lang: Lang) {
  return `${getAssetBaseUrl(lang)}/${talk.assetbundleName}/${talk.lua}.lua`;
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
