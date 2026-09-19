/**
 * Shared harness for the security-rules tests.
 *
 * These run against the Firebase emulator, not the real project, so they can
 * assert what the rules deny without touching production data. Start them with
 * `npm run test:rules`, which wraps vitest in `firebase emulators:exec`.
 */
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";

export const ALICE = "alice000000000000000000001";
export const BOB = "bob00000000000000000000002";
export const ADMIN = "admin0000000000000000000003";

export async function makeTestEnv() {
  return initializeTestEnvironment({
    projectId: "memeclassroom-rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });
}

/**
 * Seed the profile documents the rules' isAdmin() / isBanned() helpers read.
 * Written with rules disabled so seeding is never what fails a test.
 */
export async function seedUsers(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`users/${ALICE}`).set({ id: ALICE, name: "Alice", role: "student", institution: "Springfield High", banned: false });
    await db.doc(`users/${BOB}`).set({ id: BOB, name: "Bob", role: "teacher", institution: "Shelbyville High", banned: false });
    await db.doc(`users/${ADMIN}`).set({ id: ADMIN, name: "Admin", role: "admin", banned: false });
  });
}
