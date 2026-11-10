import { describe, expect, it, vi } from "vitest";
import type { ZodType } from "zod";
import { classifyHttpError } from "./errors";
import { fixtureFetch } from "./fixtures";
import {
  BattleLogSchema,
  LeagueHistorySchema,
  LeagueTiersSchema,
  RankedGroupSchema,
  CapitalRaidSeasonsSchema,
  ClanRankingsSchema,
  ClanSchema,
  ClanSearchSchema,
  LeagueGroupSchema,
  LocationsSchema,
  PlayerRankingsSchema,
  PlayerSchema,
  WarLogSchema,
  WarSchema,
} from "./schemas";
import { cocRequest, encodeTag, type TransportConfig } from "./transport";

const mock: TransportConfig = { baseUrl: "mock://coc", token: "t", fetchImpl: fixtureFetch };
const CLAN = encodeTag("#2PRGP0L22");

describe("fixtures match the schemas", () => {
  it.each([
    ["/clans/" + CLAN, ClanSchema],
    ["/clans?name=night", ClanSearchSchema],
    ["/clans/" + CLAN + "/warlog", WarLogSchema],
    ["/clans/" + CLAN + "/currentwar", WarSchema],
    ["/clans/" + CLAN + "/currentwar/leaguegroup", LeagueGroupSchema],
    ["/clans/" + CLAN + "/capitalraidseasons", CapitalRaidSeasonsSchema],
    ["/players/" + encodeTag("#9YCQ2L0P"), PlayerSchema],
    ["/locations", LocationsSchema],
    ["/locations/global/rankings/players", PlayerRankingsSchema],
    ["/locations/32000006/rankings/clans", ClanRankingsSchema],
    ["/players/" + encodeTag("#9YCQ2L0P") + "/battlelog", BattleLogSchema],
    ["/players/" + encodeTag("#9YCQ2L0P") + "/leaguehistory", LeagueHistorySchema],
    ["/leaguegroup/" + encodeTag("#2QYLPR9") + "/1793595600?playerTag=" + encodeTag("#9YCQ2L0P"), RankedGroupSchema],
    ["/leaguetiers", LeagueTiersSchema],
  ] as [string, ZodType<unknown>][])("%s", async (path, schema) => {
    const result = await cocRequest(mock, path, schema);
    expect(result.ok).toBe(true);
  });
});

describe("cocRequest", () => {
  it("sends the bearer token and encodes the tag", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ state: "notInWar" })));
    await cocRequest({ baseUrl: "https://x.test/v1/", token: "secret", fetchImpl }, `/clans/${encodeTag("#2PP")}/currentwar`, WarSchema);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://x.test/v1/clans/%232PP/currentwar");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
  });

  it.each([
    ["#88822", "notFound"],
    ["#99922", "maintenance"],
  ])("maps %s to %s", async (tag, kind) => {
    const result = await cocRequest(mock, `/clans/${encodeTag(tag)}`, ClanSchema);
    expect(result).toMatchObject({ ok: false, error: { kind } });
  });

  it("maps a 403 accessDenied war log to privateWarLog", async () => {
    const result = await cocRequest(mock, `/clans/${encodeTag("#22PP")}/warlog`, WarLogSchema);
    expect(result).toMatchObject({ ok: false, error: { kind: "privateWarLog", status: 403 } });
  });

  it("reports a schema mismatch as unavailable instead of throwing", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ name: 42 }));
    const result = await cocRequest({ baseUrl: "https://x.test", token: "t", fetchImpl }, "/clans/x", ClanSchema);
    expect(result).toMatchObject({ ok: false, error: { kind: "unavailable", reason: "schemaMismatch" } });
  });

  it("reports network failures as unavailable", async () => {
    const fetchImpl = async () => {
      throw new TypeError("fetch failed");
    };
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await cocRequest({ baseUrl: "https://x.test", token: "t", fetchImpl }, "/clans/x", ClanSchema);
    expect(result).toMatchObject({ ok: false, error: { kind: "unavailable", status: 0 } });
    errorLog.mockRestore();
  });
});

describe("classifyHttpError", () => {
  it.each([
    [404, undefined, "notFound"],
    [403, "accessDenied", "privateWarLog"],
    [403, "accessDenied.invalidIp", "unavailable"],
    [429, "requestThrottled", "rateLimited"],
    [503, "inMaintenance", "maintenance"],
    [500, "unknownException", "unavailable"],
  ])("%i %s -> %s", (status, reason, kind) => {
    expect(classifyHttpError(status, reason).kind).toBe(kind);
  });
});
