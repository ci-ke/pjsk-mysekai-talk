import type { BlueprintEntry, FilterState, EnrichedTalkGroup } from "../types";

function groupMatchesTalkFilter(group: EnrichedTalkGroup, filter: FilterState["talk"]) {
  if (filter === "all" || filter === "hasTalks" || group.readState === "unknown") return true;
  if (filter === "read") return group.readState === "read";
  return group.readState !== "read";
}

export function filterBlueprintEntries(
  entries: BlueprintEntry[],
  state: FilterState
): BlueprintEntry[] {
  const search = state.search.trim().toLocaleLowerCase();
  const selectedUnitIds = new Set(state.characterUnitIds);
  const characterFilterActive = state.characterUnitIds.length > 0;
  const talkFilterActive = state.talk !== "all";

  return entries
    .map((entry) => {
      let talkGroups = entry.allTalkGroups;
      if (selectedUnitIds.size > 0) {
        talkGroups = talkGroups.filter((group) =>
          group.characterUnitIds.some((unitId) => selectedUnitIds.has(unitId))
        );
      }
      // allRead 不做组级过滤，改为条目级判断"所有组都完整读完"
      if (state.talk !== "allRead") {
        talkGroups = talkGroups.filter((group) => groupMatchesTalkFilter(group, state.talk));
      }
      return { ...entry, talkGroups };
    })
    .filter((entry) => {
      if (state.ownership === "noBlueprint" && !entry.isVirtual) return false;
      if ((state.ownership === "owned" || state.ownership === "unowned" || state.ownership === "realOnly") && entry.isVirtual) return false;
      if (state.ownership === "owned" && (!entry.ownershipKnown || !entry.owned)) return false;
      if (state.ownership === "unowned" && (!entry.ownershipKnown || entry.owned)) return false;

      if (search) {
        const haystack = [
          entry.fixture?.name || entry.blueprint.fixtureName || "",
          entry.blueprint.id,
          entry.fixture?.id || entry.blueprint.fixtureId || "",
        ]
          .join(" ")
          .toLocaleLowerCase();
        const terms = search.split(/\s+/).filter(Boolean);
        if (!terms.every((term) => haystack.includes(term))) return false;
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

      if (talkFilterActive) {
        if (state.talk === "allRead") {
          // 全部已读：与卡片 "xx / xx" 计数一致，所有对话组都处于已读状态
          if (entry.talkGroups.length === 0) return false;
          if (!entry.talkGroups.every((group) => group.readState === "read")) return false;
        } else if (entry.talkGroups.length === 0) {
          return false;
        }
      } else if (characterFilterActive && entry.talkGroups.length === 0) {
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
      // 组级语义：读了一条即该对话组已读，进度按已读对话组数计
      const aRead = a.talkGroups.filter((group) => group.readState === "read").length;
      const bRead = b.talkGroups.filter((group) => group.readState === "read").length;
      result = aRead - bRead;
    } else {
      result = a.blueprint.craftTargetId - b.blueprint.craftTargetId;
    }
    return result * directionValue;
  });
}
