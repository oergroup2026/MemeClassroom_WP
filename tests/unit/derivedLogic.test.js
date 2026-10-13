import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  levelForCount, ownershipDeltas, isPublishedMeme, alwaysCounted, badgesFor, missingBadges, isRealUid,
} = require("../../functions/derivedLogic.js");

const memeOpts = { ownerOf: (d) => d.creator_id, isCounted: isPublishedMeme };

describe("levelForCount", () => {
  it("maps counts to badge levels", () => {
    expect([0, 1, 4, 5, 9, 10, 24, 25, 49, 50, 500].map(levelForCount)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
  it("treats junk as zero", () => {
    expect([undefined, null, -3, "x"].map(levelForCount)).toEqual([0, 0, 0, 0]);
  });
});

describe("ownershipDeltas (meme stat)", () => {
  it("counts a newly published meme", () => {
    expect(ownershipDeltas(null, { creator_id: "a", visibility: "public" }, memeOpts)).toEqual([{ uid: "a", delta: 1 }]);
  });
  it("does not count drafts", () => {
    expect(ownershipDeltas(null, { creator_id: "a", visibility: "draft" }, memeOpts)).toEqual([]);
  });
  it("counts a draft once it is published, and only once", () => {
    const draft = { creator_id: "a", visibility: "draft" };
    const pub = { creator_id: "a", visibility: "public" };
    expect(ownershipDeltas(draft, pub, memeOpts)).toEqual([{ uid: "a", delta: 1 }]);
    expect(ownershipDeltas(pub, { ...pub, title: "edited" }, memeOpts)).toEqual([]);
  });
  it("uncounts on delete", () => {
    expect(ownershipDeltas({ creator_id: "a", visibility: "public" }, null, memeOpts)).toEqual([{ uid: "a", delta: -1 }]);
    expect(ownershipDeltas({ creator_id: "a", visibility: "draft" }, null, memeOpts)).toEqual([]);
  });
  it("moves the point if ownership changes", () => {
    const out = ownershipDeltas({ creator_id: "a", visibility: "public" }, { creator_id: "b", visibility: "public" }, memeOpts);
    expect(out).toEqual([{ uid: "a", delta: -1 }, { uid: "b", delta: 1 }]);
  });
  it("ignores seeded / auto-fetched owners", () => {
    const opts = { ownerOf: (d) => d.author_id, isCounted: alwaysCounted };
    expect(ownershipDeltas(null, { author_id: "admin" }, opts)).toEqual([]);
    expect(ownershipDeltas(null, { author_id: "system" }, opts)).toEqual([]);
    expect(isRealUid("u1")).toBe(true);
  });
});

describe("badges", () => {
  it("always includes Contributor and one badge per earned category at the current level", () => {
    const wanted = badgesFor("u1", { memes_created_count: 5, total_likes_received: 1 });
    expect(wanted.map((b) => b.badge_name)).toEqual(["Contributor", "Silver Meme Creator", "Bronze Community Favorite"]);
    expect(wanted[1].id).toBe("u1__content_creator__2");
  });
  it("does not re-award what the user already holds (including legacy ids)", () => {
    const wanted = badgesFor("u1", { memes_created_count: 5 });
    const existing = [
      { badge_name: "Contributor", category: "account_setup", level: 1 },
      { badge_name: "Silver Meme Creator", category: "content_creator", level: 2 },
    ];
    expect(missingBadges(wanted, existing)).toEqual([]);
  });
  it("awards only the missing ones", () => {
    const wanted = badgesFor("u1", { memes_created_count: 10 });
    const existing = [{ badge_name: "Contributor", category: "account_setup", level: 1 }];
    expect(missingBadges(wanted, existing).map((b) => b.badge_name)).toEqual(["Gold Meme Creator"]);
  });
});
