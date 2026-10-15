import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  normalizeQuestion, publicQuestion, mergeSlangPool, scoreAttempt, allAnswered, tooFast, slangCount,
  SLANG_COUNTED_PER_DAY, MIN_MS_PER_QUESTION,
} = require("../../functions/quizLogic.js");

const q = (text, correct, dimension) => normalizeQuestion({ question_text: text, options: ["a", "b", "c"], correct_index: correct, dimension }, text);

describe("normalizeQuestion / publicQuestion", () => {
  it("reads the bundled literacy shape (camelCase)", () => {
    const n = normalizeQuestion({ question: "Q?", options: ["x", "y"], correctIndex: 1, memeUrl: "u", explanation: "e" }, "id1");
    expect(n).toMatchObject({ id: "id1", question_text: "Q?", correct_index: 1, meme_image_url: "u", explanation: "e" });
  });
  it("never exposes the answer or explanation", () => {
    const p = publicQuestion(q("Q?", 2, "Ethics"));
    expect(p).not.toHaveProperty("correct_index");
    expect(p).not.toHaveProperty("explanation");
    expect(p).toMatchObject({ question_text: "Q?", options: ["a", "b", "c"], dimension: "Ethics" });
  });
});

describe("mergeSlangPool", () => {
  it("prefers admin questions and drops duplicates by text", () => {
    const admin = [{ ...q("Bet?", 1), id: "fs" }];
    const pool = mergeSlangPool(admin, [q(" bet? ", 0), q("Mid?", 2)]);
    expect(pool.map((x) => x.id)).toEqual(["fs", "Mid?"]);
  });
  it("drops questions without a usable answer", () => {
    expect(mergeSlangPool([], [normalizeQuestion({ question_text: "x", options: ["a", "b"] }, "x")])).toEqual([]);
  });
});

describe("scoreAttempt", () => {
  const qs = [q("1", 0, "A"), q("2", 1, "A"), q("3", 2, "B")];
  it("scores against the stored key, per dimension too", () => {
    expect(scoreAttempt(qs, [0, 1, 0], 60)).toEqual({ correct: 2, total: 3, pct: 67, passed: true, dimPcts: { A: 100, B: 0 } });
  });
  it("fails below the threshold", () => {
    expect(scoreAttempt(qs, [0, 0, 0], 60).passed).toBe(false);
  });
});

describe("allAnswered / tooFast", () => {
  it("needs an integer answer for every question", () => {
    expect(allAnswered([0, 1], 2)).toBe(true);
    expect(allAnswered([0, null], 2)).toBe(false);
    expect(allAnswered([0], 2)).toBe(false);
  });
  it("flags attempts quicker than a person could read them", () => {
    expect(tooFast(0, 10 * MIN_MS_PER_QUESTION - 1, 10)).toBe(true);
    expect(tooFast(0, 10 * MIN_MS_PER_QUESTION, 10)).toBe(false);
  });
});

describe("slangCount (Slang Master: passed quizzes only, capped per day)", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  it("does not count a fail", () => {
    expect(slangCount({}, false, now).counted).toBe(false);
  });
  it("counts passes up to the daily cap, then stops", () => {
    let stats = {};
    const counted = [];
    for (let i = 0; i < SLANG_COUNTED_PER_DAY + 2; i++) {
      const r = slangCount(stats, true, now);
      counted.push(r.counted);
      stats = { slang_count_day: r.today, slang_count_today: r.usedToday };
    }
    expect(counted).toEqual([...Array(SLANG_COUNTED_PER_DAY).fill(true), false, false]);
  });
  it("resets the next day", () => {
    const yesterday = { slang_count_day: "2026-10-14", slang_count_today: SLANG_COUNTED_PER_DAY };
    expect(slangCount(yesterday, true, now)).toEqual({ counted: true, today: "2026-10-15", usedToday: 1 });
  });
});
