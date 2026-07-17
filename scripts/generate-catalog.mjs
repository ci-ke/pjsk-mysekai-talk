import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
const defaultSource = path.resolve(__dirname, "../../haruki-sekai-sc-master/master");
const sourceDir = path.resolve(
  sourceArg ? sourceArg.slice("--source=".length) : process.env.MASTER_DATA_DIR || defaultSource
);
const outputPath = path.join(projectRoot, "src", "data", "catalog.json");

const requiredFiles = [
  "mysekaiBlueprints",
  "mysekaiFixtures",
  "mysekaiCharacterTalkConditions",
  "mysekaiCharacterTalkConditionGroups",
  "mysekaiCharacterTalks",
  "mysekaiGameCharacterUnitGroups",
  "gameCharacters",
  "gameCharacterUnits",
  "mysekaiGateCharacterLotteries",
  "characterArchiveMysekaiCharacterTalkGroups",
  "mysekaiFixtureMainGenres",
  "mysekaiFixtureSubGenres",
];

async function readJson(name, { required = true } = {}) {
  const filePath = path.join(sourceDir, `${name}.json`);
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (!required) return [];
    throw new Error(`无法读取 MasterData ${filePath}: ${error.message}`);
  }
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function extractUnitIds(characterGroup) {
  return Object.entries(characterGroup || {})
    .filter(([key, value]) => key.startsWith("gameCharacterUnitId") && asNumber(value) > 0)
    .map(([, value]) => asNumber(value))
    .filter(Boolean);
}

function addToMap(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

async function readVersion() {
  try {
    const versionPath = path.resolve(sourceDir, "../versions/current_version.json");
    const version = JSON.parse(await fs.readFile(versionPath, "utf8"));
    return version.cdnVersion ?? version.data_version ?? version.dataVersion ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const data = Object.fromEntries(
    await Promise.all(requiredFiles.map(async (name) => [name, await readJson(name)]))
  );

  const blueprints = data.mysekaiBlueprints
    .filter((item) => item.mysekaiCraftType === "mysekai_fixture")
    .map((item) => ({
      id: asNumber(item.id),
      mysekaiCraftType: item.mysekaiCraftType,
      craftTargetId: asNumber(item.craftTargetId),
      isEnableSketch: Boolean(item.isEnableSketch),
      isObtainedByConvert: Boolean(item.isObtainedByConvert),
      craftCountLimit: item.craftCountLimit ?? null,
      isAvailableWithoutPossession: Boolean(item.isAvailableWithoutPossession),
    }))
    .filter((item) => item.id !== null && item.craftTargetId !== null)
    .sort((a, b) => a.id - b.id);

  const blueprintTargetIds = new Set(blueprints.map((item) => item.craftTargetId));
  const fixtureById = new Map(data.mysekaiFixtures.map((item) => [asNumber(item.id), item]));

  const fixtures = [...blueprintTargetIds]
    .map((id) => fixtureById.get(id))
    .filter(Boolean)
    .filter((item) => item.mysekaiFixtureType !== "gate")
    .map((item) => ({
      id: asNumber(item.id),
      mysekaiFixtureType: item.mysekaiFixtureType,
      name: item.name || `家具 ${item.id}`,
      flavorText: item.flavorText || "",
      mysekaiFixtureMainGenreId: asNumber(item.mysekaiFixtureMainGenreId),
      mysekaiFixtureSubGenreId: asNumber(item.mysekaiFixtureSubGenreId),
      mysekaiSettableLayoutType: item.mysekaiSettableLayoutType || null,
      assetbundleName: item.assetbundleName || "",
      isAssembled: Boolean(item.isAssembled),
      isDisassembled: Boolean(item.isDisassembled),
      mysekaiFixtureTagGroup: item.mysekaiFixtureTagGroup || {},
    }))
    .sort((a, b) => a.id - b.id);

  const fixtureIds = new Set(fixtures.map((item) => item.id));
  const fixtureMap = new Map(fixtures.map((item) => [item.id, item]));
  const blueprintByTarget = new Map(blueprints.map((item) => [item.craftTargetId, item]));

  const characterUnits = data.gameCharacterUnits
    .map((item) => ({
      id: asNumber(item.id),
      gameCharacterId: asNumber(item.gameCharacterId),
      unit: item.unit || "",
      colorCode: item.colorCode || null,
    }))
    .filter((item) => item.id !== null && item.gameCharacterId !== null);
  const unitById = new Map(characterUnits.map((item) => [item.id, item]));
  const visitableUnitIds = new Set(
    data.mysekaiGateCharacterLotteries.map((item) => asNumber(item.gameCharacterUnitId)).filter(Boolean)
  );

  const characters = data.gameCharacters
    .map((item) => ({
      id: asNumber(item.id),
      firstName: item.firstName || "",
      givenName: item.givenName || "",
      name: `${item.firstName || ""}${item.givenName || ""}`,
      unit: item.unit || "",
      unitVariants: characterUnits
        .filter((unit) => unit.gameCharacterId === asNumber(item.id) && visitableUnitIds.has(unit.id))
        .sort((a, b) => a.id - b.id),
    }))
    .filter((item) => item.id !== null)
    .sort((a, b) => a.id - b.id);

  const characterGroups = data.mysekaiGameCharacterUnitGroups
    .map((item) => ({
      id: asNumber(item.id),
      unitIds: extractUnitIds(item),
    }))
    .filter((item) => item.id !== null);
  const characterGroupById = new Map(characterGroups.map((item) => [item.id, item.unitIds]));

  const conditionIdsByFixture = new Map();
  for (const condition of data.mysekaiCharacterTalkConditions) {
    if (condition.mysekaiCharacterTalkConditionType !== "mysekai_fixture_id") continue;
    const fixtureId = asNumber(condition.mysekaiCharacterTalkConditionTypeValue);
    if (fixtureId === null || !fixtureIds.has(fixtureId)) continue;
    addToMap(conditionIdsByFixture, fixtureId, asNumber(condition.id));
  }

  const groupIdsByCondition = new Map();
  for (const relation of data.mysekaiCharacterTalkConditionGroups) {
    const conditionId = asNumber(relation.mysekaiCharacterTalkConditionId);
    const groupId = asNumber(relation.groupId);
    if (conditionId === null || groupId === null) continue;
    addToMap(groupIdsByCondition, conditionId, groupId);
  }

  const talksByConditionGroup = new Map();
  for (const talk of data.mysekaiCharacterTalks) {
    const conditionGroupId = asNumber(talk.mysekaiCharacterTalkConditionGroupId);
    if (conditionGroupId === null) continue;
    addToMap(talksByConditionGroup, conditionGroupId, talk);
  }

  const archiveById = new Map(
    data.characterArchiveMysekaiCharacterTalkGroups.map((item) => [asNumber(item.id), item])
  );
  const talkGroupMap = new Map();

  for (const [fixtureId, conditionIds] of conditionIdsByFixture) {
    for (const conditionId of new Set(conditionIds)) {
      for (const conditionGroupId of new Set(groupIdsByCondition.get(conditionId) || [])) {
        for (const talk of talksByConditionGroup.get(conditionGroupId) || []) {
          const talkId = asNumber(talk.id);
          const archiveId = asNumber(talk.characterArchiveMysekaiCharacterTalkGroupId);
          const characterUnitGroupId = asNumber(talk.mysekaiGameCharacterUnitGroupId);
          if (talkId === null || archiveId === null || characterUnitGroupId === null) continue;
          const archive = archiveById.get(archiveId);
          if (!archive || archive.archiveDisplayType !== "normal") continue;

          const key = `${archiveId}:${characterUnitGroupId}`;
          if (!talkGroupMap.has(key)) {
            talkGroupMap.set(key, {
              id: key,
              archiveId,
              characterUnitGroupId,
              fixtureIds: new Set(),
              talkIds: new Set(),
              characterUnitIds: new Set(characterGroupById.get(characterUnitGroupId) || []),
              talks: new Map(),
            });
          }
          const group = talkGroupMap.get(key);
          group.fixtureIds.add(fixtureId);
          group.talkIds.add(talkId);
          for (const unitId of characterGroupById.get(characterUnitGroupId) || []) {
            group.characterUnitIds.add(unitId);
          }
          group.talks.set(talkId, {
            id: talkId,
            assetbundleName: talk.assetbundleName || "",
            lua: talk.lua || "",
            conditionGroupId,
          });
        }
      }
    }
  }

  const talkGroups = [...talkGroupMap.values()]
    .map((group) => ({
      id: group.id,
      archiveId: group.archiveId,
      characterUnitGroupId: group.characterUnitGroupId,
      fixtureIds: [...group.fixtureIds].sort((a, b) => a - b),
      talkIds: [...group.talkIds].sort((a, b) => a - b),
      characterUnitIds: [...group.characterUnitIds].sort((a, b) => a - b),
      characterIds: [...group.characterUnitIds]
        .map((unitId) => unitById.get(unitId)?.gameCharacterId)
        .filter(Boolean)
        .filter((id, index, list) => list.indexOf(id) === index)
        .sort((a, b) => a - b),
      talks: [...group.talks.values()].sort((a, b) => a.id - b.id),
    }))
    .filter((group) => group.fixtureIds.some((id) => fixtureMap.has(id)))
    .sort((a, b) => a.archiveId - b.archiveId || a.characterUnitGroupId - b.characterUnitGroupId);

  const genres = [data.mysekaiFixtureMainGenres, data.mysekaiFixtureSubGenres].map((items) =>
    items
      .map((item) => ({ id: asNumber(item.id), name: item.name || "" }))
      .filter((item) => item.id !== null)
      .sort((a, b) => a.id - b.id)
  );

  const catalog = {
    schemaVersion: 1,
    source: path.basename(path.resolve(sourceDir, "..")),
    masterVersion: await readVersion(),
    blueprints: blueprints.map((blueprint) => ({
      ...blueprint,
      fixtureId: blueprintTargetIds.has(blueprint.craftTargetId) ? blueprint.craftTargetId : null,
      fixtureName: fixtureMap.get(blueprint.craftTargetId)?.name || null,
    })),
    fixtures,
    talkGroups,
    characters,
    characterUnits,
    genres: {
      main: genres[0],
      sub: genres[1],
    },
    unitNames: {
      light_sound: "Leo/need",
      idol: "MORE MORE JUMP！",
      street: "Vivid BAD SQUAD",
      theme_park: "Wonderlands×Showtime",
      school_refusal: "25时，在夜之中。",
      piapro: "VIRTUAL SINGER",
    },
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`已生成 ${outputPath}`);
  console.log(`蓝图: ${catalog.blueprints.length}，家具: ${catalog.fixtures.length}，对话组: ${catalog.talkGroups.length}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
