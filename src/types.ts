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
  craftTargetId: number;
  isEnableSketch: boolean;
  isObtainedByConvert: boolean;
  fixtureId: number | null;
  fixtureName: string | null;
  isVirtual?: boolean;
}

export interface FixtureRecord {
  id: number;
  mysekaiFixtureType: string;
  name: string;
  mysekaiFixtureMainGenreId: number | null;
  mysekaiFixtureSubGenreId: number | null;
  mysekaiSettableLayoutType: string | null;
  assetbundleName: string;
}

export interface TalkAssetRecord {
  id: number;
  assetbundleName: string;
  lua: string;
}

export interface TalkGroupRecord {
  id: number;
  fixtureIds: number[];
  talkIds: number[];
  characterUnitIds: number[];
  hasHiddenTalks?: boolean;
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
  name: string;
  unitVariants: CharacterUnitRecord[];
}

export interface GenreRecord {
  id: number;
  name: string;
}

export type Lang = "cn" | "jp" | "tw" | "en" | "kr";

export interface Catalog {
  schemaVersion: number;
  lang: Lang;
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

export type ReadState = "unknown" | "unread" | "read";

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
  isVirtual: boolean;
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
  detectedFormat?: DataSourceFormat;
}

export type OwnershipFilter = "all" | "owned" | "unowned" | "realOnly" | "noBlueprint";
export type TalkFilter = "all" | "hasTalks" | "read" | "unread" | "allRead";
export type DataSourceFormat = "mysekai" | "suite";

export interface FilterState {
  ownership: OwnershipFilter;
  talk: TalkFilter;
  search: string;
  mainGenreId: number | null;
  subGenreId: number | null;
  /** 选中的角色（characterUnit id 列表，可多选） */
  characterUnitIds: number[];
}

export interface EntrySummary {
  totalBlueprints: number;
  totalRealBlueprints: number;
  ownedBlueprints: number;
  totalGroups: number;
  readGroups: number;
  unknownGroups: number;
}
