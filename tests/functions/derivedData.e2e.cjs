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
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const unsignedIdToken = (uid) => `${b64url({ alg: "none", typ: "JWT" })}.${b64url({
  iss: "https://securetoken.google.com/demo-e2e", aud: "demo-e2e", sub: uid, user_id: uid,
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, auth_time: Math.floor(Date.now() / 1000),
})}.`;
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
  await until("bob stats", async () => (await stat("bob","ratings_provided_count")) === 1 && (await stat("bob","staffroom_posts_count")) === 1);
  check("ratings / staffroom counted", true);

  // Staffroom upvotes: like docs drive likes + liked_by; backfilled docs are not recounted
  await db.doc("staffroom_likes/alice_p1").set({ user_id: "alice", post_id: "p1" });
  await until("upvote", async () => { const p = (await db.doc("staffroom_posts/p1").get()).data(); return p.likes === 1 && (p.liked_by || []).includes("alice"); });
  check("staffroom like raises likes and adds to liked_by", true);
  await db.doc("staffroom_likes/carol_p1").set({ user_id: "carol", post_id: "p1", backfilled: true });
  await sleep(2000);
  check("backfilled like doc not counted again", (await db.doc("staffroom_posts/p1").get()).data().likes === 1);
  await db.doc("staffroom_likes/alice_p1").delete();
  await until("un-upvote", async () => { const p = (await db.doc("staffroom_posts/p1").get()).data(); return p.likes === 0 && !(p.liked_by || []).includes("alice"); });
  check("removing the like reverses both", true);

  // Views: a receipt adds 1 to view_count
  await db.doc("resources/r1").update({ view_count: 0 });
  await db.doc("views/bob_resources_r1").set({ user_id: "bob", kind: "resources", item_id: "r1" });
  await until("view counted", async () => (await db.doc("resources/r1").get()).data().view_count === 1);
  check("view receipt adds one view", true);
  await db.doc("views/bob_users_alice").set({ user_id: "bob", kind: "users", item_id: "alice" });
  await sleep(1500);
  check("receipt for another collection is ignored", (await db.doc("users/alice").get()).data().view_count === undefined);

  // Quizzes, graded on the server
  const callable = async (name, data, uid) => {
    const headers = { "Content-Type": "application/json" };
    // The Functions emulator decodes (without verifying) the ID token when the Auth emulator is not running.
    if (uid) headers.Authorization = "Bearer " + unsignedIdToken(uid);
    const r = await fetch(`http://127.0.0.1:5001/demo-e2e/us-central1/${name}`, { method: "POST", headers, body: JSON.stringify({ data }) });
    const body = await r.json();
    if (body.error) throw Object.assign(new Error(body.error.message), { status: body.error.status });
    return body.result;
  };
  const key = require("../../functions/quizBanks/literacyBasic.js").basicQuestions.map((q) => q.correctIndex);

  const started = await callable("startQuiz", { kind: "literacy", testId: "local-basic" }, "dave");
  check("startQuiz hides the answers", started.questions.length === key.length
    && started.questions.every((q) => q.correct_index === undefined && q.correctIndex === undefined && q.explanation === undefined));
  let early = null;
  try { await callable("finishQuiz", { attemptId: started.attemptId }, "dave"); } catch (e) { early = e.status; }
  check("finishing before answering is refused", early === "FAILED_PRECONDITION", early);
  let stolen = null;
  try { await callable("answerQuestion", { attemptId: started.attemptId, index: 0, choice: 0 }, "eve"); } catch (e) { stolen = e.status; }
  check("someone else cannot answer your attempt", stolen === "PERMISSION_DENIED", stolen);
  const wrong = (key[0] + 1) % started.questions[0].options.length;
  const v0 = await callable("answerQuestion", { attemptId: started.attemptId, index: 0, choice: wrong }, "dave");
  const v0b = await callable("answerQuestion", { attemptId: started.attemptId, index: 0, choice: key[0] }, "dave");
  check("an answer reveals the verdict, and the first answer is final", v0.isCorrect === false && v0.correct_index === key[0] && v0b.isCorrect === false && v0b.selected === wrong);
  for (let i = 1; i < key.length; i++) await callable("answerQuestion", { attemptId: started.attemptId, index: i, choice: key[i] }, "dave");
  const rushed = await callable("finishQuiz", { attemptId: started.attemptId }, "dave");
  check("a rushed attempt is scored but not saved", rushed.saved === false && rushed.passed === true);

  const s2 = await callable("startQuiz", { kind: "literacy", testId: "local-basic" }, "dave");
  for (let i = 0; i < key.length; i++) await callable("answerQuestion", { attemptId: s2.attemptId, index: i, choice: key[i] }, "dave");
  await sleep(key.length * 1500);
  const passed = await callable("finishQuiz", { attemptId: s2.attemptId }, "dave");
  check("a real pass is saved with a badge", passed.saved && passed.passed && passed.score_pct === 100 && passed.badge_awarded === "Meme Starter", JSON.stringify(passed));
  check("result, literacy badge and badge docs written",
    (await db.doc(`literacy_test_results/${s2.attemptId}`).get()).exists
    && (await db.doc("literacy_badges/dave__local-basic").get()).exists
    && (await db.doc("badges/dave__literacy__local-basic").get()).data()?.badge_name === "Meme Starter");
  let again = null;
  try { await callable("finishQuiz", { attemptId: s2.attemptId }, "dave"); } catch (e) { again = e.status; }
  check("an attempt can only be finished once", again === "FAILED_PRECONDITION", again);

  const guest = await callable("startQuiz", { kind: "slang" });
  check("guests get 10 slang questions without answers", guest.questions.length === 10 && guest.questions.every((q) => q.correct_index === undefined));
  for (let i = 0; i < 10; i++) await callable("answerQuestion", { attemptId: guest.attemptId, index: i, choice: 0 });
  const guestResult = await callable("finishQuiz", { attemptId: guest.attemptId });
  check("a guest attempt is scored but nothing is saved", guestResult.saved === false
    && !(await db.doc(`slang_quiz_results/${guest.attemptId}`).get()).exists);

  // Signed-in slang: a pass counts toward Slang Master, a fail does not
  const slangKey = new Map(require("../../functions/quizBanks/slang.js").SLANG_QUIZ_QUESTIONS.map((q) => [q.id, q.correct_index]));
  const playSlang = async (uid, right) => {
    const q = await callable("startQuiz", { kind: "slang" }, uid);
    for (let i = 0; i < q.questions.length; i++) {
      const k = slangKey.get(q.questions[i].id);
      await callable("answerQuestion", { attemptId: q.attemptId, index: i, choice: right ? k : (k + 1) % q.questions[i].options.length }, uid);
    }
    await sleep(q.questions.length * 1500);
    return callable("finishQuiz", { attemptId: q.attemptId }, uid);
  };
  const failSlang = await playSlang("frank", false);
  check("a failed slang quiz is saved but does not count", failSlang.saved && !failSlang.passed && !failSlang.slang_counted);
  const passSlang = await playSlang("frank", true);
  check("a passed slang quiz counts and reports the new level", passSlang.slang_counted && passSlang.slang_quizzes_completed === 1 && passSlang.slang_new_level === "Bronze", JSON.stringify(passSlang));
  await until("Slang Master badge", async () => (await db.collection("badges").where("user_id", "==", "frank").get()).docs.some((d) => d.data().badge_name === "Bronze Slang Master"));
  check("Bronze Slang Master awarded from the server-kept count", true);
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
