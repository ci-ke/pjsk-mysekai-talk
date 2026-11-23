import { describe, expect, it } from "vitest";
import type { FixtureRecord, TalkAssetRecord } from "../types";
import {
  getAssetBaseUrl,
  getFixtureThumbnailUrls,
  getTalkScriptUrl,
  parseTalkScript,
} from "./assets";

function makeFixture(overrides: Partial<FixtureRecord> = {}): FixtureRecord {
  return {
    id: 1,
    mysekaiFixtureType: "normal",
    name: "测试家具",
    mysekaiFixtureMainGenreId: 2,
    mysekaiFixtureSubGenreId: 2,
    mysekaiSettableLayoutType: "floor",
    assetbundleName: "mdl_test_fixture_bed1",
    ...overrides,
  };
}

describe("asset urls", () => {
  it("uses storage.pjsk.moe as the primary line", () => {
    expect(getAssetBaseUrl("cn")).toBe("https://storage.pjsk.moe/sekai-cn-assets");
    expect(getAssetBaseUrl("jp")).toBe("https://storage.pjsk.moe/sekai-jp-assets");
    expect(getAssetBaseUrl("tw")).toBe("https://storage.pjsk.moe/sekai-tw-assets");
  });

  it("tries the flat layout first for CN fixtures", () => {
    const urls = getFixtureThumbnailUrls(makeFixture(), "cn");
    expect(urls[0]).toBe(
      "https://storage.pjsk.moe/sekai-cn-assets/mysekai/thumbnail/fixture/mdl_test_fixture_bed1_1.png"
    );
    expect(urls[1]).toBe(
      "https://storage.pjsk.moe/sekai-cn-assets/mysekai/thumbnail/fixture/mdl_test_fixture_bed1_1/mdl_test_fixture_bed1_1.png"
    );
    expect(urls).toContain(
      "https://storage.exmeaning.com/sekai-cn-assets/mysekai/thumbnail/fixture/mdl_test_fixture_bed1_1.png"
    );
  });

  it("tries the nested layout first for JP fixtures", () => {
    const urls = getFixtureThumbnailUrls(makeFixture(), "jp");
    expect(urls[0]).toBe(
      "https://storage.pjsk.moe/sekai-jp-assets/mysekai/thumbnail/fixture/mdl_test_fixture_bed1_1/mdl_test_fixture_bed1_1.png"
    );
    expect(urls[1]).toBe(
      "https://storage.pjsk.moe/sekai-jp-assets/mysekai/thumbnail/fixture/mdl_test_fixture_bed1_1.png"
    );
  });

  it("derives the surface thumbnail name from the genre", () => {
    const wall = getFixtureThumbnailUrls(
      makeFixture({
        mysekaiFixtureType: "surface_appearance",
        mysekaiFixtureMainGenreId: 7,
        mysekaiSettableLayoutType: "wall_appearance",
        assetbundleName: "mis0001",
      }),
      "cn"
    );
    expect(wall[0]).toBe(
      "https://storage.pjsk.moe/sekai-cn-assets/mysekai/thumbnail/surface_appearance/tex_mis0001_wall_appearance_1.png"
    );
    expect(wall[1]).toBe(
      "https://storage.pjsk.moe/sekai-cn-assets/mysekai/thumbnail/surface_appearance/mis0001/tex_mis0001_wall_appearance_1.png"
    );

    const floor = getFixtureThumbnailUrls(
      makeFixture({
        mysekaiFixtureType: "surface_appearance",
        mysekaiFixtureMainGenreId: 8,
        mysekaiSettableLayoutType: null,
        assetbundleName: "mis0002",
      }),
      "jp"
    );
    expect(floor[0]).toBe(
      "https://storage.pjsk.moe/sekai-jp-assets/mysekai/thumbnail/surface_appearance/mis0002/tex_mis0002_floor_appearance_1.png"
    );
  });

  it("returns no candidates without a fixture assetbundleName", () => {
    expect(getFixtureThumbnailUrls(null, "cn")).toEqual([]);
    expect(getFixtureThumbnailUrls(makeFixture({ assetbundleName: "" }), "cn")).toEqual([]);
  });

  it("builds the lua.txt talk script url", () => {
    const talk: TalkAssetRecord = {
      id: 1,
      assetbundleName: "mysekai/talk/scenario/talk",
      lua: "mysekai_talk_release_001_0001",
    };
    expect(getTalkScriptUrl(talk, "cn")).toBe(
      "https://storage.pjsk.moe/sekai-cn-assets/mysekai/talk/scenario/talk/mysekai_talk_release_001_0001.lua.txt"
    );
  });
});

describe("talk script parsing", () => {
  it("extracts labels and dialogue text", () => {
    const script = [
      'label("一歌")',
      'voice("talk", "voice_001", Characters.Ichika)',
      'text("你好。\\n今天天气不错。")',
      "wait_click()",
    ].join("\n");

    expect(parseTalkScript(script)).toBe("【一歌】\n你好。\n今天天气不错。");
  });
});
