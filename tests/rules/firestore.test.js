/**
 * Firestore security-rules tests.
 *
 * Every case here corresponds to a hole that was open in production and is now
 * closed. They are written as "a user must NOT be able to ..." so that if a
 * future rules edit reopens one, this fails rather than the users finding out.
 */
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { makeTestEnv, seedUsers, ALICE, BOB, ADMIN } from "../setup/emulator.js";

let testEnv;
let alice, bob, admin, guest;

beforeAll(async () => {
  testEnv = await makeTestEnv();
  alice = testEnv.authenticatedContext(ALICE).firestore();
  bob = testEnv.authenticatedContext(BOB).firestore();
  admin = testEnv.authenticatedContext(ADMIN).firestore();
  guest = testEnv.unauthenticatedContext().firestore();
});

afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedUsers(testEnv);
});

describe("user profiles hold school and location, so reads are restricted", () => {
  it("lets a user read their own profile", async () => {
    await assertSucceeds(getDoc(doc(alice, `users/${ALICE}`)));
  });

  it("stops another signed-in user reading it", async () => {
    // The original bug: any registered user could enumerate every student's
    // name, school and town.
    await assertFails(getDoc(doc(bob, `users/${ALICE}`)));
  });

  it("stops a logged-out visitor reading it", async () => {
    await assertFails(getDoc(doc(guest, `users/${ALICE}`)));
  });

  it("lets an admin read it", async () => {
    await assertSucceeds(getDoc(doc(admin, `users/${ALICE}`)));
  });
});

describe("public profile cards carry display fields only", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`user_cards/${ALICE}`).set({ name: "Alice", role: "student" });
    });
  });

  it("is readable by a logged-out visitor, so guests see author names", async () => {
    await assertSucceeds(getDoc(doc(guest, `user_cards/${ALICE}`)));
  });

  it("cannot be written by its own user", async () => {
    // Only the mirrorUserCard Cloud Function writes these.
    await assertFails(setDoc(doc(alice, `user_cards/${ALICE}`), { name: "Alice" }));
  });

  it("cannot be forged by another user", async () => {
    await assertFails(setDoc(doc(bob, `user_cards/${ALICE}`), { name: "Not Alice" }));
  });
});

describe("registration roles", () => {
  const newUser = "newuser00000000000000000009";

  it("accepts the five roles the signup screen offers", async () => {
    for (const role of ["student", "teacher", "research", "parent", "other"]) {
      await testEnv.clearFirestore();
      const db = testEnv.authenticatedContext(newUser).firestore();
      await assertSucceeds(setDoc(doc(db, `users/${newUser}`), { id: newUser, name: "New", role, banned: false }));
    }
  });

  it("refuses a self-assigned admin role", async () => {
    const db = testEnv.authenticatedContext(newUser).firestore();
    await assertFails(setDoc(doc(db, `users/${newUser}`), { id: newUser, name: "New", role: "admin", banned: false }));
  });

  it("refuses a self-assigned expert role", async () => {
    const db = testEnv.authenticatedContext(newUser).firestore();
    await assertFails(setDoc(doc(db, `users/${newUser}`), { id: newUser, name: "New", role: "expert", banned: false }));
  });

  it("refuses a user granting themselves verified status later", async () => {
    await assertFails(updateDoc(doc(alice, `users/${ALICE}`), { is_verified: true }));
  });

  it("refuses a banned user un-banning themselves", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`users/${ALICE}`).set({ id: ALICE, name: "Alice", role: "student", banned: true });
    });
    await assertFails(updateDoc(doc(alice, `users/${ALICE}`), { banned: false }));
  });
});

describe("comments belong to the person who wrote them", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("comments/c1").set({ user_id: ALICE, meme_id: "m1", text: "original" });
    });
  });

  it("lets the author edit their own comment", async () => {
    await assertSucceeds(updateDoc(doc(alice, "comments/c1"), { text: "edited by me" }));
  });

  it("stops another user rewriting it", async () => {
    // The original bug: the update rule checked only "signed in and not banned".
    await assertFails(updateDoc(doc(bob, "comments/c1"), { text: "put words in Alice's mouth" }));
  });

  it("stops a comment being posted under someone else's name", async () => {
    await assertFails(setDoc(doc(bob, "comments/c2"), { user_id: ALICE, meme_id: "m1", text: "fake" }));
  });

  it("lets an admin moderate any comment", async () => {
    await assertSucceeds(deleteDoc(doc(admin, "comments/c1")));
  });
});

describe("contributions cannot be self-approved", () => {
  it("refuses a template created as already approved", async () => {
    await assertFails(setDoc(doc(alice, "templates/t1"), { creator_id: ALICE, status: "approved", name: "x" }));
  });

  it("accepts a template submitted for review", async () => {
    await assertSucceeds(setDoc(doc(alice, "templates/t2"), { creator_id: ALICE, status: "pending", name: "x" }));
  });

  it("refuses an external link created as already approved", async () => {
    await assertFails(setDoc(doc(alice, "external_links/l1"), { contributor_id: ALICE, admin_approved: true, title: "x" }));
  });

  it("accepts an external link submitted for review", async () => {
    await assertSucceeds(setDoc(doc(alice, "external_links/l2"), { contributor_id: ALICE, admin_approved: false, title: "x" }));
  });
});

describe("content reporting cannot be tampered with", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("memes/m1").set({
        creator_id: ALICE, visibility: "public", title: "m", flag_count: 3, likes_count: 0,
      });
    });
  });

  it("lets any signed-in user report content", async () => {
    await assertSucceeds(updateDoc(doc(bob, "memes/m1"), { flag_count: 4 }));
  });

  it("stops anyone decrementing the report count", async () => {
    // The original bug: +1 or -1 was allowed, so reports could be erased.
    await assertFails(updateDoc(doc(bob, "memes/m1"), { flag_count: 2 }));
  });

  it("stops the creator clearing reports on their own content", async () => {
    await assertFails(updateDoc(doc(alice, "memes/m1"), { flag_count: 0 }));
  });

  it("still lets the creator edit their own meme", async () => {
    await assertSucceeds(updateDoc(doc(alice, "memes/m1"), { title: "new title" }));
  });

  it("lets an admin clear reports after review", async () => {
    await assertSucceeds(updateDoc(doc(admin, "memes/m1"), { flag_count: 0 }));
  });
});

describe("views are one receipt per person per item; view_count is Cloud Functions only", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("memes/m1").set({
        creator_id: ALICE, visibility: "public", title: "m", view_count: 3, likes_count: 0,
      });
    });
  });

  it("lets a signed-in viewer record their own view receipt", async () => {
    await assertSucceeds(setDoc(doc(bob, `views/${BOB}_memes_m1`), { user_id: BOB, kind: "memes", item_id: "m1" }));
  });

  it("stops a second receipt for the same person and item (which would count twice)", async () => {
    await assertSucceeds(setDoc(doc(bob, `views/${BOB}_memes_m1`), { user_id: BOB, kind: "memes", item_id: "m1" }));
    await assertFails(setDoc(doc(bob, `views/${BOB}_memes_m1`), { user_id: BOB, kind: "memes", item_id: "m1" }));
  });

  it("stops receipts under another id, for someone else, or for other collections", async () => {
    await assertFails(setDoc(doc(bob, `views/${BOB}_memes_m1_again`), { user_id: BOB, kind: "memes", item_id: "m1" }));
    await assertFails(setDoc(doc(bob, `views/${ALICE}_memes_m1`), { user_id: ALICE, kind: "memes", item_id: "m1" }));
    await assertFails(setDoc(doc(bob, `views/${BOB}_users_m1`), { user_id: BOB, kind: "users", item_id: "m1" }));
    await assertFails(setDoc(doc(guest, "views/anon_memes_m1"), { user_id: "anon", kind: "memes", item_id: "m1" }));
  });

  it("stops anyone, viewer or creator, writing view_count directly", async () => {
    await assertFails(updateDoc(doc(bob, "memes/m1"), { view_count: 4 }));
    await assertFails(updateDoc(doc(alice, "memes/m1"), { view_count: 4 }));
  });

  it("still lets the creator edit their own meme without touching view_count", async () => {
    await assertSucceeds(updateDoc(doc(alice, "memes/m1"), { title: "new title" }));
  });
});

describe("all content is readable without an account", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc("memes/pub").set({ creator_id: ALICE, visibility: "public", title: "m" });
      await db.doc("staffroom_posts/p1").set({ author_id: BOB, title: "t", body: "b" });
      await db.doc("staffroom_replies/r1").set({ author_id: BOB, post_id: "p1", body: "b" });
      await db.doc("resources/res1").set({ author_id: BOB, admin_approved: true, title: "r" });
    });
  });

  it("lets a guest read a public meme", async () => {
    await assertSucceeds(getDoc(doc(guest, "memes/pub")));
  });

  it("lets a guest read a Staffroom post", async () => {
    await assertSucceeds(getDoc(doc(guest, "staffroom_posts/p1")));
  });

  it("lets a guest read a Staffroom reply", async () => {
    await assertSucceeds(getDoc(doc(guest, "staffroom_replies/r1")));
  });

  it("lets a guest read a resource", async () => {
    await assertSucceeds(getDoc(doc(guest, "resources/res1")));
  });
});

describe("contributing requires an account", () => {
  it("stops a guest posting in the Staffroom", async () => {
    await assertFails(setDoc(doc(guest, "staffroom_posts/p2"), { author_id: "anon", title: "t", body: "b" }));
  });

  it("stops a guest creating a meme", async () => {
    await assertFails(setDoc(doc(guest, "memes/m2"), { creator_id: "anon", visibility: "public" }));
  });

  it("stops a guest commenting", async () => {
    await assertFails(setDoc(doc(guest, "comments/c9"), { user_id: "anon", text: "x" }));
  });
});

describe("badges record real achievements", () => {
  it("stops a user awarding themselves a level badge (Cloud Functions do that)", async () => {
    await assertFails(setDoc(doc(alice, "badges/b1"), { user_id: ALICE, badge_name: "Diamond Meme Creator", category: "content_creator", level: 5 }));
  });

  it("stops a user awarding themselves a literacy badge (finishQuiz does that on a graded pass)", async () => {
    await assertFails(setDoc(doc(alice, "badges/b1"), { user_id: ALICE, badge_name: "Meme Literate", category: "literacy", level: 1 }));
    // The old literacy exception did not check the name at all.
    await assertFails(setDoc(doc(alice, "badges/b4"), { user_id: ALICE, badge_name: "Diamond Meme Creator", category: "literacy", level: 1 }));
  });

  it("stops a user awarding a badge to someone else", async () => {
    await assertFails(setDoc(doc(bob, "badges/b2"), { user_id: ALICE, badge_name: "Fake" }));
  });

  it("stops a user rewriting a badge after the fact", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("badges/b3").set({ user_id: ALICE, badge_name: "Contributor" });
    });
    await assertFails(updateDoc(doc(alice, "badges/b3"), { badge_name: "Grandmaster" }));
  });
});

describe("private data stays private", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`private_contacts/${ALICE}`).set({ email: "alice@example.com" });
    });
  });

  it("stops another user reading an email address", async () => {
    await assertFails(getDoc(doc(bob, `private_contacts/${ALICE}`)));
  });

  it("lets the owner read their own", async () => {
    await assertSucceeds(getDoc(doc(alice, `private_contacts/${ALICE}`)));
  });
});

describe("daily rate limits", () => {
  const past = new Date(Date.now() - 60 * 60 * 1000);     // an hour ago
  const future = new Date(Date.now() + 60 * 60 * 1000);   // an hour from now

  async function setQuota(uid, blockedUntil) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`user_quotas/${uid}`).set({
        window_start: past,
        memes: 1,
        blocked_until: blockedUntil,
        block_reason: blockedUntil > new Date() ? "daily meme limit" : "",
      });
    });
  }

  it("lets a user with no quota document create content", async () => {
    await assertSucceeds(setDoc(doc(alice, "memes/rl0"), { creator_id: ALICE, visibility: "public" }));
  });

  it("lets a user under their limit create content", async () => {
    await setQuota(ALICE, new Date(0));
    await assertSucceeds(setDoc(doc(alice, "memes/rl1"), { creator_id: ALICE, visibility: "public" }));
  });

  it("stops a rate-limited user creating a meme", async () => {
    await setQuota(ALICE, future);
    await assertFails(setDoc(doc(alice, "memes/rl2"), { creator_id: ALICE, visibility: "public" }));
  });

  it("stops a rate-limited user posting in the Staffroom", async () => {
    await setQuota(ALICE, future);
    await assertFails(setDoc(doc(alice, "staffroom_posts/rl3"), { author_id: ALICE, title: "t", body: "b" }));
  });

  it("stops a rate-limited user commenting", async () => {
    await setQuota(ALICE, future);
    await assertFails(setDoc(doc(alice, "comments/rl4"), { user_id: ALICE, meme_id: "m", text: "x" }));
  });

  it("stops a rate-limited user contributing a resource", async () => {
    await setQuota(ALICE, future);
    await assertFails(setDoc(doc(alice, "resources/rl5"), { author_id: ALICE, admin_approved: false, title: "r" }));
  });

  it("lets the user create again once the block has expired", async () => {
    await setQuota(ALICE, past);
    await assertSucceeds(setDoc(doc(alice, "memes/rl6"), { creator_id: ALICE, visibility: "public" }));
  });

  it("does not limit one user because another is blocked", async () => {
    await setQuota(ALICE, future);
    await assertSucceeds(setDoc(doc(bob, "memes/rl7"), { creator_id: BOB, visibility: "public" }));
  });

  it("still lets a blocked user read and edit what they already posted", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("memes/owned").set({ creator_id: ALICE, visibility: "public", title: "t", flag_count: 0 });
    });
    await setQuota(ALICE, future);
    await assertSucceeds(updateDoc(doc(alice, "memes/owned"), { title: "renamed" }));
  });
});

describe("quota documents cannot be tampered with", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`user_quotas/${ALICE}`).set({
        window_start: new Date(), memes: 99, blocked_until: new Date(Date.now() + 3600000), block_reason: "daily meme limit",
      });
    });
  });

  it("lets a user read their own quota, so the app can explain the block", async () => {
    await assertSucceeds(getDoc(doc(alice, `user_quotas/${ALICE}`)));
  });

  it("stops a user lifting their own block", async () => {
    await assertFails(updateDoc(doc(alice, `user_quotas/${ALICE}`), { blocked_until: new Date(0) }));
  });

  it("stops a user resetting their own counters", async () => {
    await assertFails(setDoc(doc(alice, `user_quotas/${ALICE}`), { memes: 0, blocked_until: new Date(0) }));
  });

  it("stops another user reading it", async () => {
    await assertFails(getDoc(doc(bob, `user_quotas/${ALICE}`)));
  });

  it("stops even an admin writing it, since only Cloud Functions may", async () => {
    await assertFails(updateDoc(doc(admin, `user_quotas/${ALICE}`), { blocked_until: new Date(0) }));
  });
});

describe("derived numbers (likes, stats) are written only by Cloud Functions", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await d.doc("memes/m1").set({ creator_id: ALICE, visibility: "public", title: "m", likes_count: 2, view_count: 0 });
      await d.doc("resources/r1").set({ author_id: ALICE, admin_approved: true, likes_count: 1, view_count: 0 });
      await d.doc("newspaper_items/n1").set({ author_id: ALICE, admin_approved: true, likes_count: 0, view_count: 0, flag_count: 0 });
      await d.doc(`user_stats/${ALICE}`).set({ memes_created_count: 1, total_likes_received: 0 });
    });
  });

  it("stops a user writing their own stats", async () => {
    await assertFails(updateDoc(doc(alice, `user_stats/${ALICE}`), { memes_created_count: 50 }));
    await assertFails(setDoc(doc(bob, `user_stats/${BOB}`), { total_likes_received: 999 }));
  });

  it("stops anyone bumping another user's likes received", async () => {
    await assertFails(updateDoc(doc(bob, `user_stats/${ALICE}`), { total_likes_received: 1 }));
  });

  it("still lets signed-in users read stats, and admins write them", async () => {
    await assertSucceeds(getDoc(doc(bob, `user_stats/${ALICE}`)));
    await assertSucceeds(updateDoc(doc(admin, `user_stats/${ALICE}`), { memes_created_count: 2 }));
  });

  it("stops anyone changing a meme's likes_count directly", async () => {
    await assertFails(updateDoc(doc(bob, "memes/m1"), { likes_count: 3 }));
    await assertFails(updateDoc(doc(alice, "memes/m1"), { likes_count: 9999 }));
  });

  it("stops the creator inflating their own views", async () => {
    await assertFails(updateDoc(doc(alice, "memes/m1"), { view_count: 5000 }));
  });

  it("stops publishing content that already claims likes or views", async () => {
    await assertFails(setDoc(doc(alice, "memes/new1"), { creator_id: ALICE, visibility: "public", likes_count: 500 }));
    await assertSucceeds(setDoc(doc(alice, "memes/new2"), { creator_id: ALICE, visibility: "public", likes_count: 0, view_count: 0 }));
  });

  it("stops anyone changing a resource's or news item's likes_count", async () => {
    await assertFails(updateDoc(doc(bob, "resources/r1"), { likes_count: 2 }));
    await assertFails(updateDoc(doc(alice, "resources/r1"), { likes_count: 500 }));
    await assertFails(updateDoc(doc(bob, "newspaper_items/n1"), { likes_count: 1 }));
  });

  it("stops anyone writing a resource's or news item's view_count (receipts drive it)", async () => {
    await assertFails(updateDoc(doc(bob, "resources/r1"), { view_count: 1 }));
    await assertFails(updateDoc(doc(bob, "newspaper_items/n1"), { view_count: 1 }));
    await assertSucceeds(setDoc(doc(bob, `views/${BOB}_resources_r1`), { user_id: BOB, kind: "resources", item_id: "r1" }));
    await assertSucceeds(setDoc(doc(bob, `views/${BOB}_newspaper_items_n1`), { user_id: BOB, kind: "newspaper_items", item_id: "n1" }));
  });
});

describe("one like per person per item, and a like cannot be retargeted", () => {
  it("accepts a like whose id is {uid}_{target}", async () => {
    await assertSucceeds(setDoc(doc(alice, `likes/${ALICE}_m1`), { user_id: ALICE, meme_id: "m1" }));
    await assertSucceeds(setDoc(doc(alice, `resource_likes/${ALICE}_r1`), { user_id: ALICE, resource_id: "r1" }));
    await assertSucceeds(setDoc(doc(alice, `newspaper_likes/${ALICE}_n1`), { user_id: ALICE, item_id: "n1" }));
  });

  it("stops a second like on the same item under a different id", async () => {
    await assertFails(setDoc(doc(alice, "likes/dup-1"), { user_id: ALICE, meme_id: "m1" }));
    await assertFails(setDoc(doc(alice, "resource_likes/dup-1"), { user_id: ALICE, resource_id: "r1" }));
    await assertFails(setDoc(doc(alice, "newspaper_likes/dup-1"), { user_id: ALICE, item_id: "n1" }));
  });

  it("stops a like being moved to another item (which would skew the counters on delete)", async () => {
    await assertSucceeds(setDoc(doc(alice, `resource_likes/${ALICE}_r1`), { user_id: ALICE, resource_id: "r1" }));
    await assertFails(updateDoc(doc(alice, `resource_likes/${ALICE}_r1`), { resource_id: "r2" }));
  });

  it("stops liking in someone else's name", async () => {
    await assertFails(setDoc(doc(bob, `likes/${ALICE}_m1`), { user_id: ALICE, meme_id: "m1" }));
  });

  it("lets a user remove their own like", async () => {
    await assertSucceeds(setDoc(doc(alice, `likes/${ALICE}_m1`), { user_id: ALICE, meme_id: "m1" }));
    await assertSucceeds(deleteDoc(doc(alice, `likes/${ALICE}_m1`)));
  });

  it("limits ratings to one document per person per meme", async () => {
    await assertSucceeds(setDoc(doc(alice, `ratings/${ALICE}_m1`), { user_id: ALICE, meme_id: "m1", clarity: 4 }));
    await assertFails(setDoc(doc(alice, "ratings/spam-1"), { user_id: ALICE, meme_id: "m1", clarity: 4 }));
  });
});

describe("quizzes are graded on the server, so the browser cannot claim a score", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await d.doc("literacy_test_questions/q1").set({ test_id: "t1", question_text: "?", options: ["a", "b"], correct_index: 1 });
      await d.doc("slang_quiz_questions/s1").set({ question_text: "?", options: ["a", "b"], correct_index: 0, is_active: true });
      await d.doc("quiz_attempts/a1").set({ user_id: ALICE, kind: "slang", answers: [null] });
      await d.doc("literacy_test_results/r1").set({ user_id: ALICE, test_id: "t1", passed: true });
    });
  });

  it("hides the question banks (they hold the answers) from players, but not from admins", async () => {
    await assertFails(getDoc(doc(alice, "literacy_test_questions/q1")));
    await assertFails(getDoc(doc(guest, "literacy_test_questions/q1")));
    await assertFails(getDoc(doc(alice, "slang_quiz_questions/s1")));
    await assertSucceeds(getDoc(doc(admin, "literacy_test_questions/q1")));
    await assertSucceeds(getDoc(doc(admin, "slang_quiz_questions/s1")));
  });

  it("stops a user writing their own literacy pass or literacy badge", async () => {
    await assertFails(setDoc(doc(alice, "literacy_test_results/fake"), { user_id: ALICE, test_id: "t1", score_pct: 100, passed: true }));
    await assertFails(setDoc(doc(alice, "literacy_badges/fake"), { user_id: ALICE, test_id: "t1", badge_label: "Meme Starter" }));
  });

  it("stops a user writing slang results (each one used to add to Slang Master)", async () => {
    await assertFails(setDoc(doc(alice, "slang_quiz_results/fake"), { user_id: ALICE, score_pct: 100, passed: true }));
  });

  it("keeps quiz attempts (and their answer keys) out of reach entirely", async () => {
    await assertFails(getDoc(doc(alice, "quiz_attempts/a1")));
    await assertFails(updateDoc(doc(alice, "quiz_attempts/a1"), { answers: [0] }));
    await assertFails(setDoc(doc(alice, "quiz_attempts/a2"), { user_id: ALICE }));
  });

  it("still lets a user read their own results", async () => {
    await assertSucceeds(getDoc(doc(alice, "literacy_test_results/r1")));
    await assertFails(getDoc(doc(bob, "literacy_test_results/r1")));
  });
});

describe("Staffroom posts: other users may only make the exact changes the page makes", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("staffroom_posts/p1").set({
        author_id: ALICE, title: "t", body: "b", likes: 2, liked_by: ["x", "y"], flag_count: 1,
        poll_options: ["a", "b"], poll_votes: { 0: 3, 1: 1 }, poll_voted_users: ["x"],
        reactions: { "👍": 2 }, is_solved: false,
      });
    });
  });

  it("stops anyone setting the upvote count or editing who upvoted", async () => {
    await assertFails(updateDoc(doc(bob, "staffroom_posts/p1"), { likes: 9999 }));
    await assertFails(updateDoc(doc(bob, "staffroom_posts/p1"), { likes: 3, liked_by: ["x", "y", BOB] }));
    await assertFails(updateDoc(doc(bob, "staffroom_posts/p1"), { liked_by: [] }));
    await assertFails(updateDoc(doc(alice, "staffroom_posts/p1"), { likes: 50 }));
  });

  it("accepts an upvote as a {uid}_{postId} like doc, once, and lets the user remove it", async () => {
    await assertSucceeds(setDoc(doc(bob, `staffroom_likes/${BOB}_p1`), { user_id: BOB, post_id: "p1" }));
    await assertFails(setDoc(doc(bob, `staffroom_likes/${BOB}_p1`), { user_id: BOB, post_id: "p1" }));
    await assertFails(setDoc(doc(bob, `staffroom_likes/${BOB}_p1_2`), { user_id: BOB, post_id: "p1" }));
    await assertFails(setDoc(doc(bob, `staffroom_likes/${ALICE}_p1`), { user_id: ALICE, post_id: "p1" }));
    await assertSucceeds(deleteDoc(doc(bob, `staffroom_likes/${BOB}_p1`)));
  });

  it("stops a client marking a like as backfilled (which the counter skips)", async () => {
    await assertFails(setDoc(doc(bob, `staffroom_likes/${BOB}_p1`), { user_id: BOB, post_id: "p1", backfilled: true }));
  });

  it("allows reporting +1 only, so a report cannot be cleared", async () => {
    await assertSucceeds(updateDoc(doc(bob, "staffroom_posts/p1"), { flag_count: 2 }));
    await assertFails(updateDoc(doc(bob, "staffroom_posts/p1"), { flag_count: 0 }));
    await assertFails(updateDoc(doc(alice, "staffroom_posts/p1"), { flag_count: 0 }));
  });

  it("allows one poll vote per person, adding exactly 1 to one option", async () => {
    await assertSucceeds(updateDoc(doc(bob, "staffroom_posts/p1"), { poll_votes: { 0: 3, 1: 2 }, poll_voted_users: ["x", BOB] }));
  });

  it("stops rigging a poll", async () => {
    await assertFails(updateDoc(doc(bob, "staffroom_posts/p1"), { poll_votes: { 0: 3, 1: 50 }, poll_voted_users: ["x", BOB] }));
    await assertFails(updateDoc(doc(bob, "staffroom_posts/p1"), { poll_votes: { 0: 4, 1: 2 }, poll_voted_users: ["x", BOB] }));
    await assertFails(updateDoc(doc(bob, "staffroom_posts/p1"), { poll_votes: { 0: 3, 1: 2 }, poll_voted_users: [BOB] }));
    await assertFails(updateDoc(doc(bob, "staffroom_posts/p1"), { poll_votes: { 0: 4, 1: 1 }, poll_voted_users: ["x"] }));
  });

  it("stops voting twice", async () => {
    await assertFails(updateDoc(doc(testEnv.authenticatedContext("x").firestore(), "staffroom_posts/p1"), { poll_votes: { 0: 4, 1: 1 }, poll_voted_users: ["x"] }));
  });

  it("allows a reaction, and switching it, under the user's own key only", async () => {
    await assertSucceeds(updateDoc(doc(bob, "staffroom_posts/p1"), { reactions: { "👍": 3 }, [`reaction_by_${BOB}`]: "👍" }));
    await assertSucceeds(updateDoc(doc(bob, "staffroom_posts/p1"), { reactions: { "👍": 2, "🔥": 1 }, [`reaction_by_${BOB}`]: "🔥" }));
  });

  it("stops inflating reactions or reacting as someone else", async () => {
    await assertFails(updateDoc(doc(bob, "staffroom_posts/p1"), { reactions: { "👍": 500 }, [`reaction_by_${BOB}`]: "👍" }));
    await assertFails(updateDoc(doc(bob, "staffroom_posts/p1"), { reactions: { "👍": 3 }, [`reaction_by_${ALICE}`]: "👍" }));
    await assertFails(updateDoc(doc(bob, "staffroom_posts/p1"), { reactions: { "👍": 2, "🎉": 900 }, [`reaction_by_${BOB}`]: "🎉" }));
  });

  it("stops other users editing anything else", async () => {
    await assertFails(updateDoc(doc(bob, "staffroom_posts/p1"), { visibility: "hidden" }));
    await assertFails(updateDoc(doc(bob, "staffroom_posts/p1"), { is_solved: true }));
  });

  it("still lets the author edit and mark their post solved", async () => {
    await assertSucceeds(updateDoc(doc(alice, "staffroom_posts/p1"), { title: "new", body: "new" }));
    await assertSucceeds(updateDoc(doc(alice, "staffroom_posts/p1"), { is_solved: true, solved_reply_id: "r1" }));
  });

  it("stops publishing a post that already claims upvotes", async () => {
    await assertFails(setDoc(doc(bob, "staffroom_posts/p2"), { author_id: BOB, title: "t", body: "b", likes: 40, liked_by: [] }));
    await assertSucceeds(setDoc(doc(bob, "staffroom_posts/p3"), { author_id: BOB, title: "t", body: "b", likes: 0, liked_by: [], reactions: {}, poll_voted_users: [] }));
  });
});
