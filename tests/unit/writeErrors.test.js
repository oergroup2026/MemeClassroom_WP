import { describe, it, expect } from "vitest";
import { describeWriteError, RATE_LIMIT_MESSAGE } from "../../src/utils/writeErrors.js";

describe("describeWriteError", () => {
  it("explains a Firestore permission denial as a rate limit", () => {
    expect(describeWriteError({ code: "permission-denied" })).toBe(RATE_LIMIT_MESSAGE);
  });

  it("explains a Storage permission denial as a rate limit", () => {
    expect(describeWriteError({ code: "storage/unauthorized" })).toBe(RATE_LIMIT_MESSAGE);
  });

  it("recognises the denial by message when no code is set", () => {
    expect(describeWriteError({ message: "Missing or insufficient permissions." })).toBe(RATE_LIMIT_MESSAGE);
  });

  it("tells a signed-out user to sign in rather than blaming a limit", () => {
    expect(describeWriteError({ code: "unauthenticated" })).toContain("sign in");
  });

  it("names a dropped connection as a connection problem", () => {
    expect(describeWriteError({ code: "unavailable" })).toContain("internet");
  });

  it("uses the caller's fallback for anything unrecognised", () => {
    expect(describeWriteError({ code: "weird/thing" }, "Upload failed.")).toBe("Upload failed.");
  });

  it("uses the fallback when there is no error object at all", () => {
    expect(describeWriteError(null, "Upload failed.")).toBe("Upload failed.");
  });

  it("never throws on an odd error shape", () => {
    expect(() => describeWriteError("just a string")).not.toThrow();
    expect(() => describeWriteError(undefined)).not.toThrow();
  });
});
