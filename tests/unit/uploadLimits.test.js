/**
 * Unit tests for the shared client-side upload guard.
 *
 * The storage rules are the real boundary; this helper exists so a user gets a
 * clear message instead of a long upload that ends in a raw permission error.
 * Its limits must stay in step with storage.rules.
 */
import { describe, it, expect } from "vitest";
import { checkUpload, fileKind, UPLOAD_LIMITS } from "../../src/utils/uploadLimits.js";

const MB = 1024 * 1024;
const fakeFile = (type, sizeMb) => ({ type, size: Math.round(sizeMb * MB), name: "f" });

describe("fileKind", () => {
  it("classifies images, video and audio", () => {
    expect(fileKind(fakeFile("image/png", 1))).toBe("image");
    expect(fileKind(fakeFile("video/mp4", 1))).toBe("video");
    expect(fileKind(fakeFile("audio/mpeg", 1))).toBe("audio");
  });

  it("treats anything else as a document", () => {
    expect(fileKind(fakeFile("application/pdf", 1))).toBe("document");
    expect(fileKind(fakeFile("", 1))).toBe("document");
  });
});

describe("checkUpload size limits", () => {
  it("accepts a file at the limit", () => {
    expect(checkUpload(fakeFile("image/png", UPLOAD_LIMITS.image))).toBeNull();
  });

  it("rejects a file over the limit", () => {
    const problem = checkUpload(fakeFile("image/png", UPLOAD_LIMITS.image + 1));
    expect(problem).toContain("over the");
    expect(problem).toContain(`${UPLOAD_LIMITS.image}MB`);
  });

  it("reports the actual size so the user knows how far over they are", () => {
    expect(checkUpload(fakeFile("image/png", 25))).toContain("25.0MB");
  });

  it("applies the video limit to video, not the image limit", () => {
    expect(checkUpload(fakeFile("video/mp4", 30))).toBeNull();
    expect(checkUpload(fakeFile("video/mp4", UPLOAD_LIMITS.video + 1))).toContain("over the");
  });

  it("applies the smaller ID card limit when asked to", () => {
    expect(checkUpload(fakeFile("image/png", 8), { as: "idCard" })).toContain("over the");
    expect(checkUpload(fakeFile("image/png", 8))).toBeNull();
  });
});

describe("checkUpload type restrictions", () => {
  it("rejects a type the caller did not allow", () => {
    expect(checkUpload(fakeFile("video/mp4", 1), { allow: ["image"] })).toContain("isn't supported");
  });

  it("accepts a type the caller allowed", () => {
    expect(checkUpload(fakeFile("video/mp4", 1), { allow: ["image", "video"] })).toBeNull();
  });
});

describe("checkUpload edge cases", () => {
  it("asks for a file when none was given", () => {
    expect(checkUpload(null)).toBe("Please choose a file.");
  });

  it("never throws on an odd file object", () => {
    expect(() => checkUpload({ size: 10, type: undefined, name: undefined })).not.toThrow();
  });
});

describe("limits stay in step with storage.rules", () => {
  it("keeps the caps the rules enforce", () => {
    // If you change these, change storage.rules to match.
    expect(UPLOAD_LIMITS.image).toBe(10);
    expect(UPLOAD_LIMITS.video).toBe(50);
    expect(UPLOAD_LIMITS.audio).toBe(20);
    expect(UPLOAD_LIMITS.idCard).toBe(5);
  });
});
