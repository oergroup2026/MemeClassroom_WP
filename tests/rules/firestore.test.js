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

describe("meme views are counted for any viewer, increment-only", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("memes/m1").set({
        creator_id: ALICE, visibility: "public", title: "m", view_count: 3, likes_count: 0,
      });
    });
  });

  it("lets a signed-in viewer who isn't the creator add a view", async () => {
    await assertSucceeds(updateDoc(doc(bob, "memes/m1"), { view_count: 4 }));
  });

  it("stops skipping ahead by more than one view at a time", async () => {
    await assertFails(updateDoc(doc(bob, "memes/m1"), { view_count: 6 }));
  });

  it("stops decrementing the view count", async () => {
    await assertFails(updateDoc(doc(bob, "memes/m1"), { view_count: 2 }));
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
  it("lets a user earn their own badge", async () => {
    await assertSucceeds(setDoc(doc(alice, "badges/b1"), { user_id: ALICE, badge_name: "Contributor" }));
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
