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
  if (readCount === totalCount && totalCount > 0) readState = "read";
  else if (readCount > 0) readState = "partial";

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
      owned: progress.ownedBlueprintIds.has(blueprint.id),
      ownershipKnown: progress.blueprintDataAvailable,
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

export function getCharacterUnitIds(
  catalog: Catalog,
  characterId: number | null,
  unit: string | null
): Set<number> | null {
  if (characterId === null) return null;
  const character = catalog.characters.find((item) => item.id === characterId);
  if (!character) return new Set();
  const variants = unit
    ? character.unitVariants.filter((variant) => variant.unit === unit)
    : character.unitVariants;
  return new Set(variants.map((variant) => variant.id));
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
  const talkStates = new Map<number, boolean | undefined>();
  let ownedBlueprints = 0;
  let ownershipKnown = false;

  for (const entry of entries) {
    ownershipKnown ||= entry.ownershipKnown;
    if (entry.owned) ownedBlueprints += 1;
    for (const group of entry.talkGroups) {
      const readIds = new Set(group.readTalkIds);
      for (const talkId of group.talkIds) {
        const current = group.readState === "unknown" ? undefined : readIds.has(talkId);
        const previous = talkStates.get(talkId);
        // 同一条对话可能因多家具条件出现在多个蓝图中，已读状态优先。
        if (previous !== true && (current === true || previous === undefined || !talkStates.has(talkId))) {
          talkStates.set(talkId, current);
        }
      }
    }
  }

  let readTalks = 0;
  let unknownTalks = 0;
  for (const state of talkStates.values()) {
    if (state === true) readTalks += 1;
    if (state === undefined) unknownTalks += 1;
  }

  return {
    totalBlueprints: entries.length,
    ownedBlueprints: ownershipKnown ? ownedBlueprints : 0,
    totalTalks: talkStates.size,
    readTalks,
    unknownTalks,
  };
}
