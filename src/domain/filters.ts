import { getCharacterUnitIds } from "./catalog";
import type { BlueprintEntry, Catalog, FilterState, EnrichedTalkGroup } from "../types";

function groupMatchesTalkFilter(group: EnrichedTalkGroup, filter: FilterState["talk"]) {
  if (filter === "all" || filter === "hasTalks" || group.readState === "unknown") return true;
  if (filter === "read") return group.readState === "read";
  return group.readState !== "read";
}

export function filterBlueprintEntries(
  entries: BlueprintEntry[],
  catalog: Catalog,
  state: FilterState
): BlueprintEntry[] {
  const search = state.search.trim().toLocaleLowerCase();
  const selectedUnitIds = getCharacterUnitIds(
    catalog,
    state.character.characterId,
    state.character.unit
  );
  const characterFilterActive = state.character.characterId !== null;
  const talkFilterActive = state.talk !== "all";

  return entries
    .map((entry) => {
      let talkGroups = entry.allTalkGroups;
      if (selectedUnitIds !== null) {
        talkGroups = talkGroups.filter((group) =>
          group.characterUnitIds.some((unitId) => selectedUnitIds.has(unitId))
        );
      }
      talkGroups = talkGroups.filter((group) => groupMatchesTalkFilter(group, state.talk));
      return { ...entry, talkGroups };
    })
    .filter((entry) => {
      if (state.ownership === "noBlueprint" && !entry.isVirtual) return false;
      if ((state.ownership === "owned" || state.ownership === "unowned" || state.ownership === "realOnly") && entry.isVirtual) return false;
      if (state.ownership === "owned" && (!entry.ownershipKnown || !entry.owned)) return false;
      if (state.ownership === "unowned" && entry.ownershipKnown && entry.owned) return false;

      if (search) {
        const haystack = [
          entry.fixture?.name || entry.blueprint.fixtureName || "",
          entry.blueprint.id,
          entry.fixture?.id || entry.blueprint.fixtureId || "",
        ]
          .join(" ")
          .toLocaleLowerCase();
        if (!haystack.includes(search)) return false;
      }

      if (
        state.mainGenreId !== null &&
        entry.fixture?.mysekaiFixtureMainGenreId !== state.mainGenreId
      ) {
        return false;
      }
      if (
        state.subGenreId !== null &&
        entry.fixture?.mysekaiFixtureSubGenreId !== state.subGenreId
      ) {
        return false;
      }

      if ((characterFilterActive || talkFilterActive) && entry.talkGroups.length === 0) {
        return false;
      }
      return true;
    });
}

export function sortBlueprintEntries(
  entries: BlueprintEntry[],
  sortBy: "id" | "name" | "progress" = "id",
  direction: "asc" | "desc" = "asc"
) {
  const directionValue = direction === "asc" ? 1 : -1;
  return [...entries].sort((a, b) => {
    let result = 0;
    if (sortBy === "name") {
      result = (a.fixture?.name || a.blueprint.fixtureName || "").localeCompare(
        b.fixture?.name || b.blueprint.fixtureName || "",
        "zh-CN"
      );
    } else if (sortBy === "progress") {
      const aRead = a.talkGroups.reduce((sum, group) => sum + group.readCount, 0);
      const bRead = b.talkGroups.reduce((sum, group) => sum + group.readCount, 0);
      result = aRead - bRead;
    } else {
      result = a.blueprint.craftTargetId - b.blueprint.craftTargetId;
    }
    return result * directionValue;
  });
}
