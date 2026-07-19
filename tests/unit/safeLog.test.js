import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Test the safeLog helper in isolation. The helper runs a fire-and-forget
// logging promise and converts rejections into observable console.warn
// output (with context) instead of silently swallowing them.

describe("safeLog", () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves the promise and returns nothing when the log call succeeds", async () => {
    const mod = await import("../../open-sse/utils/safeLog.js");
    const fn = async () => "ok";
    const result = await mod.safeLog(fn, "appendRequestLog");
    expect(result).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("swallows rejections without throwing but warns with label + message", async () => {
    const mod = await import("../../open-sse/utils/safeLog.js");
    const fn = async () => { throw new Error("db locked"); };
    await expect(mod.safeLog(fn, "appendRequestLog")).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0][0];
    expect(String(msg)).toContain("appendRequestLog");
    expect(String(msg)).toContain("db locked");
  });

  it("preserves the fire-and-forget semantics: returns a promise that never rejects", async () => {
    const mod = await import("../../open-sse/utils/safeLog.js");
    const fn = async () => { throw new Error("boom"); };
    const p = mod.safeLog(fn, "saveRequestDetail");
    // The returned promise must always settle (never reject), even on failure.
    await expect(p).resolves.toBeUndefined();
  });

  it("handles non-Error throw values (e.g. strings) without crashing", async () => {
    const mod = await import("../../open-sse/utils/safeLog.js");
    const fn = async () => { throw "string error"; };
    await expect(mod.safeLog(fn, "appendRequestLog")).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("appendRequestLog");
  });
});
