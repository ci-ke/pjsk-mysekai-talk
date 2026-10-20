import { describe, expect, it } from "vitest";
import {
  HARUKI_PUBLIC_BASE,
  HarukiFetchError,
  buildHarukiDirectLinks,
  buildMysekaiUrl,
  buildSuiteUrl,
  fetchHarukiJson,
  harukiErrorText,
  normalizeApiBase,
  normalizeGameId,
} from "./haruki";
import { parseUserJson } from "./userData";

/** 虚构 ID，仅用于拼接 URL 断言（真实游戏 ID 不写进代码）。 */
const CN_ID = "1000000000000000001";
/** 虚构 ID，18 位。 */
const JP_ID = "200000000000000002";

function jsonResponse(body: unknown, init: { status?: number; contentType?: string } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": init.contentType ?? "application/json; charset=utf-8" },
  });
}

function htmlResponse(status: number) {
  return new Response("<!doctype html><html></html>", {
    status,
    headers: { "content-type": "text/html" },
  });
}

describe("haruki game id", () => {
  it("accepts 19-digit and 18-digit ids", () => {
    expect(normalizeGameId(CN_ID)).toBe(CN_ID);
    expect(normalizeGameId(JP_ID)).toBe(JP_ID);
  });

  it("trims spaces, full-width digits and newlines", () => {
    const fullWidth = CN_ID.replace(/\d/g, (digit) => String.fromCharCode(digit.charCodeAt(0) + 0xfee0));
    expect(normalizeGameId(` ${CN_ID} `)).toBe(CN_ID);
    expect(normalizeGameId(fullWidth)).toBe(CN_ID);
  });

  it("rejects empty, leading zero, letters and oversized ids", () => {
    expect(normalizeGameId("")).toBeNull();
    expect(normalizeGameId("0123456")).toBeNull();
    expect(normalizeGameId("69926067392760628a")).toBeNull();
    expect(normalizeGameId("1".repeat(21))).toBeNull();
  });
});

describe("haruki urls", () => {
  it("normalizes base address", () => {
    expect(normalizeApiBase(" /api/haruki-public/ ")).toBe("/api/haruki-public");
    expect(normalizeApiBase("https://example.com/public//")).toBe("https://example.com/public");
  });

  it("requests a suite subset with two keys so the response stays an object", () => {
    expect(buildSuiteUrl("/api/haruki-public", "cn", CN_ID)).toBe(
      `/api/haruki-public/cn/suite/${CN_ID}?key=userMysekaiCharacterTalks,upload_time`
    );
  });

  it("requests the full mysekai payload (the endpoint rejects key filtering)", () => {
    expect(buildMysekaiUrl("/api/haruki-public", "jp", JP_ID)).toBe(
      `/api/haruki-public/jp/mysekai/${JP_ID}`
    );
  });

  it("builds direct links against the public API", () => {
    const links = buildHarukiDirectLinks("jp", JP_ID);
    expect(links.map((link) => link.source)).toEqual(["mysekai", "suite"]);
    expect(links[0].url).toBe(`${HARUKI_PUBLIC_BASE}/jp/mysekai/${JP_ID}`);
    expect(links[1].url).toBe(
      `${HARUKI_PUBLIC_BASE}/jp/suite/${JP_ID}?key=userMysekaiCharacterTalks,upload_time`
    );
  });
});

async function expectHarukiError(promise: Promise<unknown>): Promise<HarukiFetchError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(HarukiFetchError);
    return error as HarukiFetchError;
  }
  throw new Error("expected the request to fail");
}

describe("auto import errors", () => {
  it("maps 404 to not-found", async () => {
    const error = await expectHarukiError(
      fetchHarukiJson("/x", { fetchImpl: async () => jsonResponse({ status: 404 }, { status: 404 }) })
    );
    expect(error.code).toBe("not-found");
    expect(harukiErrorText(error)).toContain("没有找到该 ID 的公开数据");
  });

  it("maps 403 and 429", async () => {
    const forbidden = await expectHarukiError(
      fetchHarukiJson("/x", { fetchImpl: async () => jsonResponse({}, { status: 403 }) })
    );
    const limited = await expectHarukiError(
      fetchHarukiJson("/x", { fetchImpl: async () => jsonResponse({}, { status: 429 }) })
    );
    expect(forbidden.code).toBe("forbidden");
    expect(limited.code).toBe("rate-limited");
  });

  it("reports a non-json page (missing proxy on a static host) as bad-response", async () => {
    const html200 = await expectHarukiError(
      fetchHarukiJson("/x", { fetchImpl: async () => htmlResponse(200) })
    );
    const html404 = await expectHarukiError(
      fetchHarukiJson("/x", { fetchImpl: async () => htmlResponse(404) })
    );
    expect(html200.code).toBe("bad-response");
    expect(html404.code).toBe("bad-response");
    expect(harukiErrorText(html404)).toContain("打开 JSON");
  });

  it("reports fetch rejection (CORS) as network", async () => {
    const error = await expectHarukiError(
      fetchHarukiJson("/x", {
        fetchImpl: async () => {
          throw new TypeError("Failed to fetch");
        },
      })
    );
    expect(error.code).toBe("network");
    expect(harukiErrorText(error)).toContain("跨域");
  });

  it("reports malformed json as bad-response", async () => {
    const error = await expectHarukiError(
      fetchHarukiJson("/x", {
        fetchImpl: async () =>
          new Response("{oops", { headers: { "content-type": "application/json" } }),
      })
    );
    expect(error.code).toBe("bad-response");
  });

  it("returns the parsed payload", async () => {
    const payload = { userMysekaiCharacterTalks: [], upload_time: 1790929212 };
    await expect(
      fetchHarukiJson("/x", { fetchImpl: async () => jsonResponse(payload) })
    ).resolves.toEqual(payload);
  });
});

describe("haruki payload parsing", () => {
  it("reads the suite subset and uses upload_time as data time", () => {
    const progress = parseUserJson(
      {
        userMysekaiCharacterTalks: [
          { mysekaiCharacterTalkId: 35, isRead: false },
          { mysekaiCharacterTalkId: 39, isRead: true },
        ],
        upload_time: 1790929212,
      },
      "Haruki · 简中 · 1000000000000000001"
    );

    expect(progress.detectedFormat).toBe("suite");
    expect(progress.blueprintDataAvailable).toBe(false);
    expect(progress.talkReadById.get(35)).toBe(false);
    expect(progress.talkReadById.get(39)).toBe(true);
    expect(progress.updatedAt).toBe(1790929212);
  });

  it("reads blueprints and talks from the mysekai payload", () => {
    const progress = parseUserJson(
      {
        upload_time: 1785122856,
        updatedResources: {
          now: 1785122856,
          userMysekaiBlueprints: [
            { mysekaiBlueprintId: 10 },
            { mysekaiBlueprintId: 11 },
          ],
          userMysekaiCharacterTalks: [{ mysekaiCharacterTalkId: 197, isRead: true }],
        },
      },
      "Haruki · 日服 · 200000000000000002"
    );

    expect(progress.detectedFormat).toBe("mysekai");
    expect(progress.blueprintDataAvailable).toBe(true);
    expect([...progress.ownedBlueprintIds].sort((a, b) => a - b)).toEqual([10, 11]);
    expect(progress.talkReadById.get(197)).toBe(true);
    expect(progress.updatedAt).toBe(1785122856);
  });

  it("falls back to the top-level upload_time when updatedResources has no now", () => {
    const progress = parseUserJson({
      upload_time: 1700000000,
      updatedResources: { userMysekaiBlueprints: [{ mysekaiBlueprintId: 1 }] },
    });
    expect(progress.updatedAt).toBe(1700000000);
  });
});
