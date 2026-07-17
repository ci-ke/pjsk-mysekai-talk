/**
 * 从 haruki-sekai-sc-master 最新数据生成 public/data/catalog.json。
 *
 * 用法:
 *   node scripts/generate-catalog.mjs                        # 从 GitHub 远程拉取（需网络）
 *   node scripts/generate-catalog.mjs --source=../haruki-sekai-sc-master/master     # 指定本地 master 目录
 *   MASTER_DATA_DIR=../master node scripts/generate-catalog.mjs  # 通过环境变量指定
 *
 * 远程拉取时自动检测系统代理（环境变量 → WinHTTP → IE 注册表）。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

/** 从远程 URL 或本地路径中提取数据源名称 */
function getSourceName(raw) {
  if (/^https?:\/\//.test(raw)) {
    // raw.githubusercontent.com/Team-Haruki/REPO/refs/heads/main/master → REPO
    const segments = new URL(raw).pathname.split("/").filter(Boolean);
    return segments[1] || "unknown";
  }
  return path.basename(path.resolve(raw, ".."));
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const REMOTE_BASE =
  "https://raw.githubusercontent.com/Team-Haruki/haruki-sekai-sc-master/refs/heads/main/master";

const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
const rawSource =
  sourceArg?.slice("--source=".length) ||
  process.env.MASTER_DATA_DIR ||
  REMOTE_BASE;

const isRemote = /^https?:\/\//.test(rawSource);

/** 检测 Windows 系统代理（环境变量 → WinHTTP → IE 设置） */
function detectSystemProxy() {
  // 环境变量优先
  const envProxy =
    process.env.https_proxy || process.env.HTTPS_PROXY ||
    process.env.http_proxy || process.env.HTTP_PROXY ||
    process.env.all_proxy || process.env.ALL_PROXY;
  if (envProxy) return envProxy;

  if (process.platform !== "win32") return null;

  // Wi-Fi 等场景使用 WinHTTP 代理
  try {
    const output = execSync("netsh winhttp show proxy", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = output.match(/代理服务器\s*:\s*(.+)/) || output.match(/Proxy Server\s*:\s*(.+)/i);
    if (match && match[1].trim() !== "" && !match[1].includes("direct")) {
      const server = match[1].trim();
      return server.startsWith("http") ? server : `http://${server}`;
    }
  } catch { /* 可能没有权限 */ }

  // 回退：读 IE 代理设置（注册表）
  try {
    const output = execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer 2>nul',
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    const match = output.match(/ProxyServer\s+REG_SZ\s+(.+)/i);
    if (match && match[1].trim()) {
      const server = match[1].trim();
      return server.startsWith("http") ? server : `http://${server}`;
    }
  } catch { /* 未配置 */ }

  return null;
}

const proxyUrl = detectSystemProxy();
if (proxyUrl && isRemote) {
  console.log(`使用代理: ${proxyUrl}`);
}

/** 通过 HTTP CONNECT 代理发起 HTTPS 请求，返回 fetch 兼容的 Response */
async function proxyFetch(targetUrl, options = {}) {
  const target = new URL(targetUrl);
  const proxy = new URL(proxyUrl);

  return new Promise((resolve, reject) => {
    const req = http.request({
      host: proxy.hostname,
      port: proxy.port || 8080,
      method: "CONNECT",
      path: `${target.hostname}:${target.port || 443}`,
      headers: proxy.username
        ? { "Proxy-Authorization": `Basic ${Buffer.from(`${proxy.username}:${proxy.password || ""}`).toString("base64")}` }
        : {},
    });

    req.on("connect", (_res, socket) => {
      const opts = {
        socket,
        host: target.hostname,
        port: target.port || 443,
        path: target.pathname + target.search,
        method: options.method || "GET",
        headers: { ...options.headers },
      };
      const hreq = https.request(opts, (hres) => {
        resolve(
          new Response(hres, {
            status: hres.statusCode,
            statusText: hres.statusMessage,
          })
        );
      });
      hreq.on("error", reject);
      hreq.end();
    });

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("代理连接超时"));
    });
    req.end();
  });
}

const outputPath = path.join(projectRoot, "public", "data", "catalog.json");

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
  "unitProfiles",
];

async function readJson(name, { required = true } = {}) {
  if (isRemote) {
    const url = `${rawSource.replace(/\/$/, "")}/${name}.json`;
    const fetcher = proxyUrl ? proxyFetch : fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetcher(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) {
        if (!required) return [];
        throw new Error(`无法获取 ${url}: ${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      clearTimeout(timer);
      if (!required) return [];
      throw new Error(
        `无法从远程获取 ${url}: ${error.message}\n` +
        `提示: 使用 --source=<本地master目录> 或设置 MASTER_DATA_DIR 环境变量指定本地路径`
      );
    }
  }
  const filePath = path.join(rawSource, `${name}.json`);
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
    if (isRemote) {
      const versionUrl = rawSource.replace(/\/master\/?$/, "/versions/current_version.json");
      const response = await (proxyUrl ? proxyFetch : fetch)(versionUrl, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) return null;
      const version = await response.json();
      return version.dataVersion ?? version.cdnVersion ?? version.data_version ?? null;
    }
    const versionPath = path.resolve(rawSource, "../versions/current_version.json");
    const version = JSON.parse(await fs.readFile(versionPath, "utf8"));
    return version.dataVersion ?? version.cdnVersion ?? version.data_version ?? null;
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
    source: getSourceName(rawSource),
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
    unitNames: Object.fromEntries(
      data.unitProfiles.map((item) => [item.unit, item.unitName || item.unit])
    ),
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`已生成 ${outputPath}`);

  const compactPath = outputPath.replace(/\.json$/, ".min.json");
  await fs.writeFile(compactPath, JSON.stringify(catalog), "utf8");
  console.log(`已生成 ${compactPath}`);
  console.log(`蓝图: ${catalog.blueprints.length}，家具: ${catalog.fixtures.length}，对话组: ${catalog.talkGroups.length}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
