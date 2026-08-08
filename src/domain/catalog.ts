import type {
  BlueprintEntry,
  Catalog,
  EnrichedTalkGroup,
  EntrySummary,
  TalkGroupRecord,
  UserProgress,
} from "../types";

function uniqueNumbers(values: number[]) {
  return [...new Set(values)];
}

function createTalkGroupLookup(catalog: Catalog) {
  const lookup = new Map<number, TalkGroupRecord[]>();
  for (const group of catalog.talkGroups) {
    for (const fixtureId of group.fixtureIds) {
      const groups = lookup.get(fixtureId) || [];
      groups.push(group);
      lookup.set(fixtureId, groups);
    }
  }
  return lookup;
}

function enrichTalkGroup(group: TalkGroupRecord, progress: UserProgress): EnrichedTalkGroup {
  const totalCount = group.talkIds.length;
  const visibleTalkIds = group.talkIds.slice();

  if (!progress.talkDataAvailable) {
    return {
      ...group,
      readCount: 0,
      totalCount,
      readState: "unknown",
      visibleTalkIds,
      readTalkIds: [],
    };
  }

  const readTalkIds = group.talkIds.filter((id) => progress.talkReadById.get(id) === true);
  const readCount = readTalkIds.length;
  let readState: EnrichedTalkGroup["readState"] = "unread";
  if (readCount > 0) readState = "read";

  return {
    ...group,
    readCount,
    totalCount,
    readState,
    visibleTalkIds,
    readTalkIds,
  };
}

export function createBlueprintEntries(
  catalog: Catalog,
  progress: UserProgress
): BlueprintEntry[] {
  const fixtureById = new Map(catalog.fixtures.map((fixture) => [fixture.id, fixture]));
  const mainGenres = new Map(catalog.genres.main.map((genre) => [genre.id, genre.name]));
  const subGenres = new Map(catalog.genres.sub.map((genre) => [genre.id, genre.name]));
  const groupsByFixture = createTalkGroupLookup(catalog);

  return catalog.blueprints.map((blueprint) => {
    const fixture = blueprint.fixtureId === null ? null : fixtureById.get(blueprint.fixtureId) || null;
    const allTalkGroups = fixture
      ? (groupsByFixture.get(fixture.id) || []).map((group) => enrichTalkGroup(group, progress))
      : [];

    return {
      blueprint,
      fixture,
      owned: blueprint.isVirtual ? true : progress.ownedBlueprintIds.has(blueprint.id),
      ownershipKnown: blueprint.isVirtual ? true : progress.blueprintDataAvailable,
      isVirtual: Boolean(blueprint.isVirtual),
      talkGroups: allTalkGroups,
      allTalkGroups,
      mainGenreName: fixture?.mysekaiFixtureMainGenreId
        ? mainGenres.get(fixture.mysekaiFixtureMainGenreId) || "未分类"
        : "未分类",
      subGenreName: fixture?.mysekaiFixtureSubGenreId
        ? subGenres.get(fixture.mysekaiFixtureSubGenreId) || ""
        : "",
    };
  });
}

export function getCharacterName(catalog: Catalog, characterId: number): string {
  return catalog.characters.find((character) => character.id === characterId)?.name || `角色 ${characterId}`;
}

export function getUnitName(catalog: Catalog, unit: string): string {
  return catalog.unitNames[unit] || unit;
}

export function getGroupCharacterNames(catalog: Catalog, group: TalkGroupRecord): string[] {
  return uniqueNumbers(
    group.characterUnitIds
      .map((unitId) => catalog.characterUnits.find((unit) => unit.id === unitId)?.gameCharacterId)
      .filter((id): id is number => id !== undefined)
  ).map((characterId) => getCharacterName(catalog, characterId));
}

export function getEntrySummary(entries: BlueprintEntry[]): EntrySummary {
  let ownedBlueprints = 0;
  let totalRealBlueprints = 0;
  let ownershipKnown = false;
  const seenGroupIds = new Set<number>();
  let readGroups = 0;
  let unknownGroups = 0;

  for (const entry of entries) {
    ownershipKnown ||= entry.ownershipKnown;
    if (entry.owned) ownedBlueprints += 1;
    if (!entry.isVirtual) totalRealBlueprints += 1;
    for (const group of entry.talkGroups) {
      if (seenGroupIds.has(group.id)) continue;
      seenGroupIds.add(group.id);
      if (group.readState === "read") readGroups++;
      else if (group.readState === "unknown") unknownGroups++;
    }
  }

  return {
    totalBlueprints: entries.length,
    totalRealBlueprints,
    ownedBlueprints: ownershipKnown ? ownedBlueprints : 0,
    totalGroups: seenGroupIds.size,
    readGroups,
    unknownGroups,
  };
}

export interface GenreUsage {
  /** 有 fixture 的主分类 ID 集合 */
  activeMainGenreIds: Set<number>;
  /** mainGenreId → 该主分类下的副分类 ID 集合 */
  subGenreIdsByMain: Map<number, Set<number>>;
  /** 需要消歧的副分类名称 → 对应的 id 列表 */
  ambiguousSubGenreNames: Map<string, number[]>;
}

/** 根据 catalog 中的 fixture 数据计算实际使用的分类 */
export function getGenreUsage(catalog: Catalog): GenreUsage {
  const activeMainGenreIds = new Set<number>();
  const subGenreIdsByMain = new Map<number, Set<number>>();
  const nameToIds = new Map<string, number[]>();
  const subNameById = new Map(catalog.genres.sub.map((g) => [g.id, g.name]));

  for (const fixture of catalog.fixtures) {
    const mainId = fixture.mysekaiFixtureMainGenreId;
    if (mainId == null) continue;
    activeMainGenreIds.add(mainId);

    if (!subGenreIdsByMain.has(mainId)) {
      subGenreIdsByMain.set(mainId, new Set());
    }

    const subId = fixture.mysekaiFixtureSubGenreId;
    if (subId != null) {
      subGenreIdsByMain.get(mainId)!.add(subId);
      const name = subNameById.get(subId);
      if (name) {
        if (!nameToIds.has(name)) nameToIds.set(name, []);
        const ids = nameToIds.get(name)!;
        if (!ids.includes(subId)) ids.push(subId);
      }
    }
  }

  const ambiguousSubGenreNames = new Map<string, number[]>();
  for (const [name, ids] of nameToIds) {
    if (ids.length > 1) ambiguousSubGenreNames.set(name, ids);
  }

  return { activeMainGenreIds, subGenreIdsByMain, ambiguousSubGenreNames };
}
