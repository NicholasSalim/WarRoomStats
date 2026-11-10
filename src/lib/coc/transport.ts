// Low-level request helper for the CoC API: fetch, status mapping and zod
// validation. Pure (no Next.js APIs) so it can be unit-tested with fixtures.
// Only `client.ts` (server-only) should call this in the app.

import type { ZodType } from "zod";
import { apiError, classifyHttpError, type ApiResult } from "./errors";

export interface TransportConfig {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function cocRequest<T>(
  config: TransportConfig,
  path: string,
  schema: ZodType<T>,
): Promise<ApiResult<T>> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const url = `${config.baseUrl.replace(/\/+$/, "")}${path}`;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${config.token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(config.timeoutMs ?? 10_000),
    });
  } catch (err) {
    console.error(`[coc] network error for ${path}:`, err);
    return { ok: false, error: apiError("unavailable", 0, "network") };
  }

  if (!res.ok) {
    let reason: string | undefined;
    try {
      const body = (await res.json()) as { reason?: unknown };
      if (typeof body?.reason === "string") reason = body.reason;
    } catch {
      // Body isn't JSON; the status alone decides.
    }
    if (res.status === 403 && reason !== "accessDenied") {
      // A 403 that isn't a private war log means our key/IP is rejected.
      console.error(`[coc] 403 ${reason ?? ""} for ${path}: check COC_API_TOKEN and the proxy IP whitelist`);
    }
    return { ok: false, error: classifyHttpError(res.status, reason) };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: apiError("unavailable", res.status, "invalidJson") };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    console.error(`[coc] unexpected response shape for ${path}:`, parsed.error.issues.slice(0, 5));
    return { ok: false, error: apiError("unavailable", res.status, "schemaMismatch") };
  }
  return { ok: true, data: parsed.data };
}

/** Encodes a normalised tag ("#2PP") for use in an API path segment. */
export function encodeTag(tag: string): string {
  return encodeURIComponent(tag);
}
