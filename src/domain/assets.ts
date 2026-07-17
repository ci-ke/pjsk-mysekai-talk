import type { FixtureRecord } from "../types";

const DEFAULT_ASSET_BASE = "https://storage.exmeaning.com/sekai-cn-assets";

export function getAssetBaseUrl() {
  return (import.meta.env.VITE_ASSET_BASE_URL || DEFAULT_ASSET_BASE).replace(/\/$/, "");
}

export function getFixtureThumbnailUrl(fixture: FixtureRecord | null) {
  if (!fixture?.assetbundleName) return "/placeholder.svg";
  const base = getAssetBaseUrl();
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
