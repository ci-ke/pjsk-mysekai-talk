import { describe, expect, it } from "vitest";
import catalogJson from "../../public/data/catalog-cn.json";
import { createBlueprintEntries, getCharacterUnitIds, getEntrySummary } from "./catalog";
import { filterBlueprintEntries } from "./filters";
import { parseUserJson, normalizeTalkStatuses, UserDataError } from "./userData";
import type { Catalog, FilterState } from "../types";

const catalog = catalogJson as Catalog;

const minimalCatalog: Catalog = {
  schemaVersion: 1,
  source: "test",
  masterVersion: 1,
  lang: "cn",
  blueprints: [
    {
      id: 10,
      craftTargetId: 100,
      isEnableSketch: true,
      isObtainedByConvert: false,
      fixtureId: 100,
      fixtureName: "测试床",
    },
  ],
  fixtures: [
    {
      id: 100,
      mysekaiFixtureType: "fixture",
      name: "测试床",
      mysekaiFixtureMainGenreId: 2,
      mysekaiFixtureSubGenreId: 2,
      mysekaiSettableLayoutType: "floor",
      assetbundleName: "test_bed",
    },
  ],
  talkGroups: [
    {
      id: 7,
      fixtureIds: [100],
      talkIds: [200, 201],
      characterUnitIds: [1],
      talks: [],
    },
  ],
  characters: [
    {
      id: 1,
      name: "测试角色",
      unitVariants: [{ id: 1, gameCharacterId: 1, unit: "light_sound", colorCode: "#fff" }],
    },
  ],
  characterUnits: [{ id: 1, gameCharacterId: 1, unit: "light_sound", colorCode: "#fff" }],
  genres: { main: [{ id: 2, name: "家具" }], sub: [{ id: 2, name: "床" }] },
  unitNames: { light_sound: "Leo/need" },
};

const baseFilters: FilterState = {
  ownership: "all",
  talk: "all",
  search: "",
  mainGenreId: null,
  subGenreId: null,
  character: { characterId: null, unit: null },
};

describe("user data normalization", () => {
  it("parses compact blueprint and talk records", () => {
    const progress = parseUserJson({
      updatedResources: {
        now: 1784251024484,
        userMysekaiBlueprints: [
          { mysekaiBlueprintId: 10, obtainedAt: 1 },
          { mysekaiBlueprintId: 20, obtainedAt: 2 },
        ],
        userMysekaiCharacterTalks: [
          [200, false],
          [201, true],
          [200, true],
        ],
      },
    }, "compact.json");

    expect(progress.sourceFileName).toBe("compact.json");
    expect(progress.ownedBlueprintIds).toEqual(new Set([10, 20]));
    expect(progress.talkReadById.get(200)).toBe(true);
    expect(progress.talkReadById.get(201)).toBe(true);
    expect(progress.talkDataAvailable).toBe(true);
  });

  it("parses object talk records and nested read histories", () => {
    const progress = parseUserJson({
      updatedResources: {
        userMysekaiBlueprints: [{ mysekaiBlueprintId: 1 }],
        userMysekaiGateCharacterVisit: {
          mysekaiCharacterTalkWithReadHistories: [
            { mysekaiCharacterTalkId: 300, isRead: 1 },
            { mysekaiCharacterTalkId: 301, isRead: false },
          ],
        },
      },
    });

    expect(progress.talkReadById).toEqual(new Map([[300, true], [301, false]]));
    expect(progress.talkDataAvailable).toBe(true);
  });

  it("rejects JSON without blueprint data", () => {
    expect(() => parseUserJson({ updatedResources: {} })).toThrow(UserDataError);
    expect(normalizeTalkStatuses({ "12": true, "13": false })).toEqual(
      new Map([[12, true], [13, false]])
    );
  });
});

describe("catalog and filters", () => {
  it("maps blueprint target IDs to fixtures and calculates read state", () => {
    const progress = parseUserJson({
      updatedResources: {
        userMysekaiBlueprints: [{ mysekaiBlueprintId: 10 }],
        userMysekaiCharacterTalks: [[200, true], [201, false]],
      },
    });
    const entries = createBlueprintEntries(minimalCatalog, progress);
    expect(entries[0].fixture?.id).toBe(100);
    expect(entries[0].owned).toBe(true);
    expect(entries[0].talkGroups[0].readState).toBe("read");
    expect(entries[0].talkGroups[0].readCount).toBe(1);
  });

  it("filters by owned status, character, and talk status", () => {
    const progress = parseUserJson({
      updatedResources: {
        userMysekaiBlueprints: [],
        userMysekaiCharacterTalks: [[200, false], [201, false]],
      },
    });
    const entries = createBlueprintEntries(minimalCatalog, progress);
    const result = filterBlueprintEntries(entries, minimalCatalog, {
      ...baseFilters,
      ownership: "unowned",
      talk: "unread",
      character: { characterId: 1, unit: null },
    });
    expect(result).toHaveLength(1);
    expect(result[0].talkGroups[0].talkIds).toEqual([200, 201]);
  });

  it("returns unit IDs for a selected character", () => {
    expect(getCharacterUnitIds(minimalCatalog, 1, "light_sound")).toEqual(new Set([1]));
    expect(getCharacterUnitIds(minimalCatalog, null, null)).toBeNull();
  });

  it("summarizes unique talk IDs", () => {
    const progress = parseUserJson({
      updatedResources: {
        userMysekaiBlueprints: [{ mysekaiBlueprintId: 10 }],
        userMysekaiCharacterTalks: [[200, true], [201, true]],
      },
    });
    const summary = getEntrySummary(createBlueprintEntries(minimalCatalog, progress));
    expect(summary).toMatchObject({
      totalBlueprints: 1,
      totalRealBlueprints: 1,
      ownedBlueprints: 1,
      totalGroups: 1,
      readGroups: 1,
      unknownGroups: 0,
    });
  });

  it("contains the generated simplified-Chinese catalog", () => {
    expect(catalog.blueprints.length).toBeGreaterThan(800);
    expect(catalog.fixtures.length).toBe(catalog.blueprints.length);
    expect(catalog.talkGroups.length).toBeGreaterThan(1000);
    expect(catalog.characters.some((character) => character.name.includes("初音"))).toBe(true);
  });
});
