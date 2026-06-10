import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { clearSensitiveCaches } from "@/lib/clearCaches";
import { queryClient } from "@/lib/queryClient";

/**
 * P0 privacy: sign-out must wipe the in-memory query cache AND the on-disk
 * `api-data` SW cache so portfolio data doesn't survive logout on a shared
 * device.
 */
describe("clearSensitiveCaches", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    // @ts-expect-error — undo the global we may have stubbed.
    delete globalThis.caches;
  });

  it("clears the TanStack query cache", async () => {
    const clear = vi.spyOn(queryClient, "clear");
    await clearSensitiveCaches();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("deletes the api-data Cache Storage bucket (and nothing else)", async () => {
    const del = vi.fn(async () => true);
    // @ts-expect-error — minimal CacheStorage stub for the test environment.
    globalThis.caches = { delete: del };

    await clearSensitiveCaches();

    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith("api-data");
  });

  it("does not throw when the Cache API is unavailable (non-PWA env)", async () => {
    // No globalThis.caches defined.
    await expect(clearSensitiveCaches()).resolves.toBeUndefined();
  });

  it("swallows a Cache Storage delete failure", async () => {
    // @ts-expect-error — stub a rejecting delete.
    globalThis.caches = { delete: vi.fn(async () => { throw new Error("nope"); }) };
    await expect(clearSensitiveCaches()).resolves.toBeUndefined();
  });
});
