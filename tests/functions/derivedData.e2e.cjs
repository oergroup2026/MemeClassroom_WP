// End-to-end check of functions/derivedData.js against the Functions + Firestore emulators.
// Run: npm run test:functions  (needs `npm ci` inside functions/ first)
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const admin = require("../../functions/node_modules/firebase-admin");
admin.initializeApp({ projectId: "demo-e2e" });
const db = admin.firestore();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(label, fn, ms = 20000) {
  const t = Date.now();
  while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(400); }
  throw new Error("timeout: " + label);
}
const stat = async (u, f) => (await db.doc(`user_stats/${u}`).get()).data()?.[f];
const results = [];
const check = (name, ok, extra="") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, extra); };

(async () => {
  // new user -> zeroed stats
  await db.doc("users/alice").set({ name: "Alice", role: "student" });
  await until("stats created", async () => (await db.doc("user_stats/alice").get()).exists);
  check("new user gets a stats doc", (await stat("alice", "memes_created_count")) === 0);
  await until("contributor badge", async () => (await db.collection("badges").where("user_id","==","alice").get()).size >= 1);
  check("Contributor badge awarded", (await db.collection("badges").where("user_id","==","alice").get()).docs.some(d=>d.data().badge_name==="Contributor"));

  // draft does not count, publish does, delete uncounts
  await db.doc("memes/m1").set({ creator_id: "alice", visibility: "draft", likes_count: 0 });
  await sleep(2500);
  check("draft not counted", (await stat("alice","memes_created_count")) === 0);
  await db.doc("memes/m1").update({ visibility: "public" });
  await until("meme counted", async () => (await stat("alice","memes_created_count")) === 1);
  check("publishing counts once", true);
  await db.doc("memes/m1").update({ title: "edit" });
  await sleep(2500);
  check("editing does not recount", (await stat("alice","memes_created_count")) === 1);
  await until("Bronze badge", async () => (await db.collection("badges").where("badge_name","==","Bronze Meme Creator").get()).size === 1);
  check("Bronze Meme Creator awarded", true);

  // likes: bob likes alice's meme
  await db.doc("likes/bob_m1").set({ user_id: "bob", meme_id: "m1" });
  await until("likes_count 1", async () => (await db.doc("memes/m1").get()).data().likes_count === 1);
  await until("stat 1", async () => (await stat("alice","total_likes_received")) === 1);
  check("like raises meme likes_count and author total_likes_received", true);
  // self-like: counts on the meme, not toward Community Favorite
  await db.doc("likes/alice_m1").set({ user_id: "alice", meme_id: "m1" });
  await until("likes_count 2", async () => (await db.doc("memes/m1").get()).data().likes_count === 2);
  await sleep(1500);
  check("self-like not counted for author stat", (await stat("alice","total_likes_received")) === 1);
  // unlike
  await db.doc("likes/bob_m1").delete();
  await until("likes_count back", async () => (await db.doc("memes/m1").get()).data().likes_count === 1);
  await until("stat back", async () => (await stat("alice","total_likes_received")) === 0);
  check("unlike reverses both", true);

  // resource + like + newspaper like + rating + staffroom + slang
  await db.doc("resources/r1").set({ author_id: "alice", likes_count: 0 });
  await db.doc("resource_likes/bob_r1").set({ user_id: "bob", resource_id: "r1" });
  await until("res likes", async () => (await db.doc("resources/r1").get()).data().likes_count === 1);
  await until("res stat", async () => (await stat("alice","resources_contributed_count")) === 1 && (await stat("alice","total_likes_received")) === 1);
  check("resource count + resource like", true);
  await db.doc("newspaper_items/n1").set({ author_id: "system", likes_count: 0 });
  await db.doc("newspaper_likes/bob_n1").set({ user_id: "bob", item_id: "n1" });
  await until("news likes", async () => (await db.doc("newspaper_items/n1").get()).data().likes_count === 1);
  await sleep(1000);
  check("auto-fetched news item creates no stats doc for 'system'", !(await db.doc("user_stats/system").get()).exists);
  await db.doc("ratings/bob_m1").set({ user_id: "bob", meme_id: "m1" });
  await db.doc("staffroom_posts/p1").set({ author_id: "bob" });
  await db.doc("slang_quiz_results/s1").set({ user_id: "bob" });
  await until("bob stats", async () => (await stat("bob","ratings_provided_count")) === 1 && (await stat("bob","staffroom_posts_count")) === 1 && (await stat("bob","slang_quizzes_completed")) === 1);
  check("ratings / staffroom / slang counted", true);
  await db.doc("staffroom_posts/p1").delete();
  await until("bob post uncounted", async () => (await stat("bob","staffroom_posts_count")) === 0);
  check("deleting a post uncounts it", true);

  // no duplicate badges
  const names = (await db.collection("badges").where("user_id","==","alice").get()).docs.map(d=>d.data().badge_name);
  check("no duplicate badges", new Set(names).size === names.length, JSON.stringify(names));
  // deleting a like after the meme is gone must not crash/recreate
  await db.doc("memes/m1").delete();
  await until("meme uncounted", async () => (await stat("alice","memes_created_count")) === 0);
  await db.doc("likes/alice_m1").delete();
  await sleep(2000);
  check("deleted meme not resurrected by like cleanup", !(await db.doc("memes/m1").get()).exists);
  console.log(results.every(Boolean) ? "ALL PASS" : "SOME FAILED");
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error("ERR", e.message); process.exit(2); });
