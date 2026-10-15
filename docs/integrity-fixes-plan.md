# Plan: close the remaining "client decides the number" gaps

## Status: implemented

Phases 1–3 are implemented on this branch, plus the Phase 4 tests and the
Staffroom backfill script. Phase 0 (the stopgaps) was skipped because the full
fixes landed together. Decisions taken (the recommendations below):

- **D1:** only passed slang quizzes count toward Slang Master, at most 3 a day.
- **D2:** a view is one per signed-in person per item. Existing counts are kept.
- **D3:** the answer and explanation are still shown after each question, but only once the answer is locked in.
- **D4:** nothing is deleted. The audit script is still to do.

**Before deploying, in this order:**
1. `firebase deploy --only functions`.
2. Deploy hosting (the new client).
3. Run `cd functions && node scripts/backfill-staffroom-likes.cjs --dry-run`, then run it again without `--dry-run`.
4. `firebase deploy --only firestore:rules`. Rules go last, so open old tabs keep working until then.
5. Optional: add a Firestore TTL policy on `quiz_attempts.expires_at`.

Known limits: one person with several accounts can still add one view and one
upvote per account. A poll's creator can still seed non-zero starting tallies.

Context: PR #98 moved likes, user stats and level badges to Cloud Functions
(`functions/derivedData.js`). Three areas were left out: the quizzes, view
counts, and Staffroom upvotes. This plan covers all three. It follows the same
rule as #98: **the browser records that something happened, and a Cloud
Function works out the number.**

---

## 1. What is wrong today (verified in the code)

### 1a. Literacy test: anyone can award themselves a pass and badge
- Grading runs in `src/pages/MemeLiteracyTest.jsx` (`handleSubmit`, `computeScores`, `saveResult`).
- The correct answers ship to the browser in two ways:
  - The local test bank is bundled JS (`src/data/memeTestQuestions*.js`, `correctIndex`).
  - The Firestore test bank is `literacy_test_questions`, which has `allow read: if true`.
- `literacy_test_results` and `literacy_badges` accept any document that has `user_id == auth.uid`. That means `passed: true` and `score_pct: 100` with no answers behind them.
- `/badges` lets a client create any badge with `category == 'literacy'`. **`badge_name` is not checked**, so a user can create a badge named "Diamond Meme Creator" or anything else. This is wider than "fake a literacy pass".

### 1b. Slang quiz: anyone can raise their quiz count
- `slang_quiz_results` accepts any self-owned document.
- Each document created adds +1 to `slang_quizzes_completed` (`statSlangQuizzes` in `derivedData.js`).
- That counter drives the **Slang Master** badge, and 50 documents earns Diamond. A loop of 50 `addDoc` calls does it.
- Server grading alone does not fix this, because every completed attempt counts, pass or fail. Someone could still click through 50 quizzes at random. See decision D1.

### 1c. View counts can be inflated
- `memes`, `resources` and `newspaper_items` accept `view_count == old + 1` from any signed-in user, any number of times.
- The only dedupe is a `useRef` Set in the page, which resets on reload. A script can call `view_count + 1` in a loop.
- Affected: the "Most Viewed" sorts in `Library.jsx:626`, `Resources.jsx:1077` and `Newspaper.jsx:282`, the "trending" strip in `Resources.jsx:1098`, and the view badges.

### 1d. Staffroom upvotes can be inflated, and the hole is wider than upvotes
`staffroom_posts` update rule (`firestore.rules:105-109`) lets a **non-author** change any field except a short denylist. So any signed-in user can:
- set `likes` to any number (e.g. 9999), or add or remove *other people's* uids in `liked_by`;
- **reset `flag_count` to 0**, which un-reports a reported post;
- rewrite `poll_votes` / `poll_voted_users` (rig polls) and `reactions` / `reaction_by_<uid>`;
- add arbitrary new fields (e.g. `visibility`, `solved_reply_id`).

---

## 2. Decisions needed before building

| # | Question | Recommendation |
|---|----------|----------------|
| D1 | What counts toward Slang Master? | Count **passed** attempts only, at most **3 per day**. Otherwise grading on the server still lets people farm the badge. |
| D2 | What does "views" mean? | **Unique signed-in viewers** per item: one count per person, ever. Today it is "opens", and that cannot be protected. Keep existing numbers as a baseline. |
| D3 | Keep showing the correct answer and explanation after each question? | Yes, it is good for learning. The server returns them only **after** that question's answer is locked in. Answers can still be learned by retaking, which is the same as a student remembering, and is acceptable. |
| D4 | What to do with existing suspect data? | Do not delete anything automatically. Run an audit script that lists literacy badges or results with no server attempt behind them, and let an admin decide. |

---

## 3. Fix plan

### Phase 0: Stopgaps (rules plus one function, about half a day, ship first)
1. **Staffroom rule → allowlist.** A non-author may only touch `['likes','liked_by','reactions','flag_count','poll_votes','poll_voted_users']` plus their own `reaction_by_<uid>` key. Add these checks:
   - `flag_count == old + 1` (same rule as `/memes`);
   - `liked_by` may change only by adding or removing **the caller's own uid** (`diff` on the list: size ±1 and contains or excludes `request.auth.uid`);
   - `likes == old ± 1`, in the same direction as `liked_by`;
   - `poll_voted_users` gains exactly the caller, and only once.

   This blocks setting 9999 and un-reporting straight away, before Phase 3.
2. **Lock literacy badge names.** Until Phase 1 ships, `/badges` client creates must have `badge_name` in the set of configured literacy badge labels. A rules `get()` on `literacy_tests/{test_id}` can check `badge_label`.
3. **Cap slang counting.** In `statSlangQuizzes`, count at most 3 results per user per day (keep a `slang_count_window` on `user_stats`). This makes the 50-document loop pointless today.

### Phase 1: Server-graded quizzes (the redesign, about 3–4 days)
**Data**
- Move the question banks (`memeTestQuestions.js`, `memeTestQuestionsBasic.js`, `slangQuizQuestions.js`) into `functions/quizBanks/`. Remove `correctIndex` / `correct_index` / `explanation` from anything under `src/`. The client keeps only the test catalogue metadata.
- Firestore questions: change `literacy_test_questions` and `slang_quiz_questions` to `allow read: if isAdmin()`. Players get questions only through the callable function. The Admin editor keeps working as it is.
- New collection `quiz_attempts/{attemptId}`: `{user_id, kind: 'literacy'|'slang', test_id, question_ids[], answers{}, started_at, finished_at}`. Client reads and writes are **denied**. Only Cloud Functions write it.

**Callable functions** (new `functions/quizzes.js`, exported from `index.js` like `derivedData`)
| Function | Does |
|---|---|
| `startQuiz({kind, testId})` | Picks or shuffles the questions on the server. Creates the attempt. Returns `attemptId` and the questions **without answers**. |
| `answerQuestion({attemptId, index, choice})` | Only the attempt's owner may call it. The **first answer is final** (ignore re-answers). Returns `{isCorrect, correctIndex, explanation}` for the explanation screen. |
| `finishQuiz({attemptId})` | Requires every question to be answered. Scores from the stored answers. Writes `literacy_test_results` / `slang_quiz_results` with `attempt_id`. On a pass, writes `literacy_badges` and the `/badges` doc (deterministic id `${uid}__literacy__${testId}`, so it cannot double-award). Returns the score summary. |

Also add a minimum time per attempt (e.g. finished ≥ 2 s × number of questions after start) and reuse the `user_quotas` pattern to cap attempts per day.

**Rules**
- `literacy_test_results`, `slang_quiz_results` and `literacy_badges`: `allow create: if false`. Only Cloud Functions write them. Reads stay as they are.
- `/badges`: remove the `category == 'literacy'` client-create exception. All badges then come from functions.
- Remove the literacy branch in `src/utils/badges.js` `awardBadgeIfMissing`, which then becomes dead code.

**Client**
- `MemeLiteracyTest.jsx` and `SlangQuiz.jsx` call `startQuiz`, then `answerQuestion` on each submit (drives the existing "explanation" phase), then `finishQuiz` for the results screen. `computeScores` stays for display only, fed by the server's per-question results.
- The quiz must be signed-in. Guests currently can play without saving. Either keep a guest **practice mode** that uses a small, answer-bundled practice set with no saving, or require sign-in. Recommendation: practice mode.
- `SlangQuiz.jsx`: the level-up message uses `slang_quizzes_completed` returned by `finishQuiz`, not a client transaction.

### Phase 2: Views (about 1 day)
- New collection `views/{uid}_{kind}_{itemId}` with `{user_id, kind, item_id, created_at}`. The rule enforces the id format, `user_id == auth.uid` and `kind in ['memes','resources','newspaper_items']`. Creating it a second time fails, so the count cannot go up twice.
- `derivedData.js`: add `onDocumentCreated("views/{id}")` → `bumpDoc(kind, item_id, "view_count", 1)`.
- Rules: **remove** the `view_count == old + 1` branches from `memes`, `resources` and `newspaper_items`, so clients can no longer write `view_count`.
- Client: replace the 7 `updateDoc(..., {view_count: increment(1)})` call sites with one `recordView(kind, id)` helper (`src/utils/recordView.js`) that does `setDoc` on the receipt and ignores "already exists".
- Remaining limit: one person with many accounts. Account creation is the bottleneck. This is acceptable.

### Phase 3: Staffroom upvotes (about 1 day)
- New collection `staffroom_likes/{uid}_{postId}`, with the same rule shape as `/likes`.
- `derivedData.js`: add `staffroom_likes: { parent: "staffroom_posts", targetField: "post_id", ownerField: "author_id" }` to `LIKE_KINDS`. Extend `applyLike` so the counter field can be configured (`likes` here, rather than `likes_count`) and so it also maintains `liked_by` with `arrayUnion` / `arrayRemove`. The UI's read path then does not change.
- `Staffroom.jsx` `handleThreadLike`: create or delete the like doc instead of `updateDoc`. You could generalise `useLikeToggle` to take a collection name.
- Rules: remove `likes` and `liked_by` from the Phase 0 non-author allowlist. Optional, same approach: move polls to `staffroom_poll_votes/{uid}_{postId}` and reactions to `staffroom_reactions/{uid}_{postId}`, which closes the last two counters.

### Phase 4: Migration, audit, tests
- **Backfill:** a one-off admin script that sets `likes = liked_by.length` on every staffroom post and creates the matching `staffroom_likes` docs. Leave `view_count` as it is (baseline).
- **Audit script:** list `literacy_badges` and `literacy_test_results` with no `attempt_id`, and users whose `slang_quizzes_completed` is greater than the number of real result docs. Admins review them (D4).
- **Tests** (`tests/rules/firestore.test.js`, `tests/functions/`):
  - client cannot create results, literacy badges, or a `/badges` doc of any category;
  - client cannot read quiz questions or attempts;
  - `answerQuestion` ignores a second answer, and `finishQuiz` rejects incomplete or too-fast attempts and attempts owned by someone else;
  - a duplicate view receipt fails, and a client `view_count` write fails;
  - staffroom: a non-author cannot set `likes`, edit someone else's `liked_by`, lower `flag_count`, or vote twice;
  - existing tests at lines 183–200 and 408–426 (view_count +1 by clients) change to expect failure.
- **Deploy order:** functions → client → rules. Rules last, so old clients are not broken while the new client rolls out. The rules + functions deploy workflow (`.github/workflows/firebase-rules-functions-deploy.yml`) already exists.

---

## 4. Order and effort

| Order | Work | Effort | Closes |
|---|---|---|---|
| 1 | Phase 0 stopgaps | ~0.5 day | 9999 upvotes, un-reporting, poll rigging, arbitrary badge names, slang farming (mostly) |
| 2 | Phase 3 Staffroom likes | ~1 day | Upvote pumping fully |
| 3 | Phase 2 Views | ~1 day | "Most viewed" pumping |
| 4 | Phase 1 Server-graded quizzes | ~3–4 days | Fake passes and badges, slang count |
| 5 | Phase 4 audit and cleanup | ~0.5 day | Existing bad data |
