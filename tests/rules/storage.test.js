/**
 * Storage security-rules tests.
 *
 * Upload object names embed the uploader's uid, which is what stops one user
 * overwriting another's file. These assert that, plus the per-type size caps
 * and the admin-only paths.
 */
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { makeTestEnv, seedUsers, ALICE, BOB, ADMIN } from "../setup/emulator.js";

let testEnv;
let alice, bob, admin, guest;

const png = (sizeBytes = 32) => new Uint8Array(sizeBytes);
const IMAGE = { contentType: "image/png" };
const VIDEO = { contentType: "video/mp4" };

beforeAll(async () => {
  testEnv = await makeTestEnv();
  alice = testEnv.authenticatedContext(ALICE).storage();
  bob = testEnv.authenticatedContext(BOB).storage();
  admin = testEnv.authenticatedContext(ADMIN).storage();
  guest = testEnv.unauthenticatedContext().storage();
});

afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearStorage();
  await testEnv.clearFirestore();
  await seedUsers(testEnv);
});

describe("uploads are owned by the person who made them", () => {
  it("lets a user upload a meme named with their own uid", async () => {
    await assertSucceeds(uploadBytes(ref(alice, `memes/${ALICE}_meme_123.png`), png(), IMAGE));
  });

  it("stops another user overwriting that file", async () => {
    // The original bug: names are predictable, so anyone could replace someone
    // else's image while the title and author stayed the same.
    await assertFails(uploadBytes(ref(bob, `memes/${ALICE}_meme_123.png`), png(), IMAGE));
  });

  it("stops a logged-out visitor uploading", async () => {
    await assertFails(uploadBytes(ref(guest, `memes/${ALICE}_meme_9.png`), png(), IMAGE));
  });

  it("lets a user delete their own file", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), `memes/${ALICE}_del.png`), png(), IMAGE);
    });
    await assertSucceeds(deleteObject(ref(alice, `memes/${ALICE}_del.png`)));
  });

  it("stops another user deleting it", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), `memes/${ALICE}_del2.png`), png(), IMAGE);
    });
    await assertFails(deleteObject(ref(bob, `memes/${ALICE}_del2.png`)));
  });

  it("lets anyone read an uploaded meme, including guests", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), `memes/${ALICE}_meme_5.png`), png(), IMAGE);
    });
    await assertSucceeds(getDownloadURL(ref(guest, `memes/${ALICE}_meme_5.png`)));
  });
});

describe("file size caps", () => {
  it("accepts an image under the 10MB cap", async () => {
    await assertSucceeds(uploadBytes(ref(alice, `memes/${ALICE}_small.png`), png(1024), IMAGE));
  });

  it("refuses an image over the 10MB cap", async () => {
    const tooBig = new Uint8Array(11 * 1024 * 1024);
    await assertFails(uploadBytes(ref(alice, `memes/${ALICE}_big.png`), tooBig, IMAGE));
  });

  it("refuses a video over the 50MB cap", async () => {
    const tooBig = new Uint8Array(51 * 1024 * 1024);
    await assertFails(uploadBytes(ref(alice, `memes/${ALICE}_big.mp4`), tooBig, VIDEO));
  });

  it("refuses a disallowed file type", async () => {
    await assertFails(
      uploadBytes(ref(alice, `memes/${ALICE}_x.exe`), png(), { contentType: "application/x-msdownload" })
    );
  });
});

describe("admin-only upload paths", () => {
  it("stops an ordinary user uploading a homepage hero card", async () => {
    await assertFails(uploadBytes(ref(alice, "heroCards/card1.png"), png(), IMAGE));
  });

  it("stops an ordinary user writing to the admin folder", async () => {
    // The original bug: admin/ allowed any signed-in user up to 100MB.
    await assertFails(uploadBytes(ref(alice, "admin/banner.png"), png(), IMAGE));
  });

  // The admin-only Storage paths gate on isAdmin(), which reads the user's role
  // out of Firestore via firestore.get(). That cross-service call works in
  // production but is NOT implemented by the Storage emulator — a probe showed
  // both firestore.get() and firestore.exists() always denying there, while an
  // identical rule using only request.auth passed. So this positive case cannot
  // be asserted locally and is skipped rather than weakened.
  //
  // The negative cases above still hold: a non-admin is denied either way.
  // Verify an admin upload (Admin panel -> hero card) by hand after deploying a
  // change to these rules.
  it.skip("lets an admin upload a hero card (needs cross-service rules; emulator gap)", async () => {
    await assertSucceeds(uploadBytes(ref(admin, "heroCards/card1.png"), png(), IMAGE));
  });
});

describe("ID cards are private to their owner and admins", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), `id_cards/${ALICE}/123_id.png`), png(), IMAGE);
    });
  });

  it("lets the owner upload to their own folder", async () => {
    await assertSucceeds(uploadBytes(ref(alice, `id_cards/${ALICE}/456_id.png`), png(), IMAGE));
  });

  it("stops a user uploading into someone else's folder", async () => {
    await assertFails(uploadBytes(ref(bob, `id_cards/${ALICE}/789_id.png`), png(), IMAGE));
  });

  it("stops another user reading an ID card", async () => {
    await assertFails(getDownloadURL(ref(bob, `id_cards/${ALICE}/123_id.png`)));
  });

  it("stops a logged-out visitor reading an ID card", async () => {
    await assertFails(getDownloadURL(ref(guest, `id_cards/${ALICE}/123_id.png`)));
  });

  it("lets the owner read their own", async () => {
    await assertSucceeds(getDownloadURL(ref(alice, `id_cards/${ALICE}/123_id.png`)));
  });
});

describe("paths the app actually uses are permitted", () => {
  it("accepts a Staffroom attachment", async () => {
    await assertSucceeds(
      uploadBytes(ref(alice, `staffroom_attachments/${ALICE}_123_notes.pdf`), png(), { contentType: "application/pdf" })
    );
  });

  it("accepts an activity submission", async () => {
    await assertSucceeds(
      uploadBytes(ref(alice, `activities/pdf_${ALICE}_123`), png(), { contentType: "application/pdf" })
    );
  });

  it("accepts a slang example meme", async () => {
    await assertSucceeds(uploadBytes(ref(alice, `slang_memes/${ALICE}_123_0`), png(), IMAGE));
  });

  it("accepts an external link thumbnail", async () => {
    await assertSucceeds(uploadBytes(ref(alice, `external_thumbnails/123_thumb.png`), png(), IMAGE));
  });

  it("accepts a user avatar in their own folder", async () => {
    await assertSucceeds(uploadBytes(ref(alice, `users/${ALICE}/avatar/me.png`), png(), IMAGE));
  });

  it("stops a user writing an avatar into someone else's folder", async () => {
    await assertFails(uploadBytes(ref(bob, `users/${ALICE}/avatar/me.png`), png(), IMAGE));
  });
});
