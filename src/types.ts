export type UnitKey =
  | "light_sound"
  | "idol"
  | "street"
  | "theme_park"
  | "school_refusal"
  | "piapro"
  | string;

export interface BlueprintRecord {
  id: number;
  mysekaiCraftType: string;
  craftTargetId: number;
  isEnableSketch: boolean;
  isObtainedByConvert: boolean;
  craftCountLimit: number | null;
  isAvailableWithoutPossession: boolean;
  fixtureId: number | null;
  fixtureName: string | null;
}

export interface FixtureRecord {
  id: number;
  mysekaiFixtureType: string;
  name: string;
  flavorText: string;
  mysekaiFixtureMainGenreId: number | null;
  mysekaiFixtureSubGenreId: number | null;
  mysekaiSettableLayoutType: string | null;
  assetbundleName: string;
  isAssembled: boolean;
  isDisassembled: boolean;
  mysekaiFixtureTagGroup: Record<string, number>;
}

export interface TalkAssetRecord {
  id: number;
  assetbundleName: string;
  lua: string;
  conditionGroupId: number;
}

export interface TalkGroupRecord {
  id: string;
  archiveId: number;
  characterUnitGroupId: number;
  fixtureIds: number[];
  talkIds: number[];
  characterUnitIds: number[];
  characterIds: number[];
  talks: TalkAssetRecord[];
}

export interface CharacterUnitRecord {
  id: number;
  gameCharacterId: number;
  unit: UnitKey;
  colorCode: string | null;
}

export interface CharacterRecord {
  id: number;
  firstName: string;
  givenName: string;
  name: string;
  unit: UnitKey;
  unitVariants: CharacterUnitRecord[];
}

export interface GenreRecord {
  id: number;
  name: string;
}

export interface Catalog {
  schemaVersion: number;
  source: string;
  masterVersion: string | number | null;
  blueprints: BlueprintRecord[];
  fixtures: FixtureRecord[];
  talkGroups: TalkGroupRecord[];
  characters: CharacterRecord[];
  characterUnits: CharacterUnitRecord[];
  genres: {
    main: GenreRecord[];
    sub: GenreRecord[];
  };
  unitNames: Record<string, string>;
}

export type ReadState = "unknown" | "unread" | "partial" | "read";

export interface EnrichedTalkGroup extends TalkGroupRecord {
  readCount: number;
  totalCount: number;
  readState: ReadState;
  visibleTalkIds: number[];
  readTalkIds: number[];
}

export interface BlueprintEntry {
  blueprint: BlueprintRecord;
  fixture: FixtureRecord | null;
  owned: boolean;
  ownershipKnown: boolean;
  talkGroups: EnrichedTalkGroup[];
  allTalkGroups: EnrichedTalkGroup[];
  mainGenreName: string;
  subGenreName: string;
}

export interface UserProgress {
  ownedBlueprintIds: Set<number>;
  talkReadById: Map<number, boolean>;
  blueprintDataAvailable: boolean;
  talkDataAvailable: boolean;
  sourceFileName?: string;
  updatedAt?: number;
}

export type OwnershipFilter = "all" | "owned" | "unowned";
export type TalkFilter = "all" | "read" | "unread";

export interface CharacterSelection {
  characterId: number | null;
  unit: UnitKey | null;
}

export interface FilterState {
  ownership: OwnershipFilter;
  talk: TalkFilter;
  search: string;
  mainGenreId: number | null;
  subGenreId: number | null;
  character: CharacterSelection;
}

export interface EntrySummary {
  totalBlueprints: number;
  ownedBlueprints: number;
  totalTalks: number;
  readTalks: number;
  unknownTalks: number;
}
