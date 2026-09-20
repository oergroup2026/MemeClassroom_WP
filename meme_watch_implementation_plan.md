# Meme Watch — implementation plan for Antigravity

A phase-by-phase build plan for the new "current meme events" page, using only
free-tier data sources and your existing Firebase stack. Each phase ends in a
working, testable slice — do each on its own branch/commit, test locally, then
merge, the same way you already work with your team.

---

## Before you start

### The free-tier feeder stack

| Source | Cost | Good for |
|---|---|---|
| RSS feeds (Google News by topic, major outlets, Reddit's own RSS/JSON endpoints) | $0, no key, no signup | General current-events pull for all five categories |
| Google Fact Check Tools API (Claim Search) | Free, just needs an API key | The misinformation-watch feeder specifically |
| YouTube Data API v3 | Free daily quota | Meme-video trend tracking |
| Reddit API | Free for non-commercial use, ~100 queries/min | Gauging what's trending in meme subreddits |
| GDELT Project | Fully free, no key needed | Global political/social-movement event tracking |
| Teacher submissions | Free (your existing contribution modal) | The trust backbone — always available even if every API above hits a snag |

Skip Google's Custom Search JSON API — it's closed to new customers and being
fully retired on January 1, 2027, so it's not worth building on now.

### One infrastructure catch

A function that runs on a schedule and calls outside APIs needs Firebase's
**Blaze (pay-as-you-go)** plan — the free Spark plan can't run scheduled
functions or reach non-Google domains. At the volume this feature needs (a
couple of scheduled runs a day, modest call counts), the realistic cost is $0
or close to it — Google's free tier covers a few Cloud Scheduler jobs and
millions of function invocations a month. Two things worth doing before you
flip the switch:
1. Enable Blaze, then immediately set a **Cloud Billing budget alert** (e.g.
   $1) so you get an email if anything unexpected happens.
2. Start the fetch schedule conservatively — twice a day is plenty to start —
   and widen it only once you've watched a few days of actual cost.

### The architecture in one line

A scheduled Cloud Function fetches from the sources above → normalizes and
writes to Firestore with `status: "pending"` → your existing Admin moderation
queue approves or rejects → the Meme Watch page only ever reads
`status: "approved"` items from Firestore. The browser never calls the
external APIs directly, so your API keys stay server-side and nothing runs
per-visitor (which is what would actually blow through free-tier limits).

---

## Phase 1 — Data model & taxonomy

**Goal:** Define the shape of a feed item and the five categories, without
touching any UI yet.

**Prompt for Antigravity:**
```
In this MemeClassroom repo, open src/data/taxonomy.js (or wherever
RESOURCE_TYPES / CATEGORIES are currently defined) and show me how existing
resource types are structured.

Then add:
1. A new constant FEED_CATEGORIES with five entries: politics_social_movements,
   elections_civic_life, misinformation_watch, marketing_advertising,
   education_spotlight. Each entry needs an id, a display label, and a short
   description (one sentence).
2. A comment block documenting the Firestore schema for a new "feedItems"
   collection, with these fields: id, title, summary, sourceUrl, sourceName,
   publishedAt, category (one of FEED_CATEGORIES), contentType
   (article/video/image), sensitivityFlag (boolean), isEditorPick (boolean),
   status (pending/approved/rejected), fetchedFrom (string, e.g.
   "fact_check_api", "youtube_api", "rss", "manual"), createdAt.

Don't build any Cloud Function or UI yet — just the taxonomy constant and the
schema documentation, following the existing code style in that file.
```

---

## Phase 2 — Backend fetcher (Cloud Function)

**Goal:** A scheduled function that pulls from the free sources, normalizes
results into the feedItems schema, and writes them as pending.

**Prompt for Antigravity:**
```
Create a new Firebase Cloud Function called fetchMemeWatchFeed in the
functions directory, using the v2 onSchedule trigger to run every 12 hours.

Inside it:
1. Fetch from three free sources: Google News RSS for a list of keywords I'll
   provide, the Google Fact Check Tools API (Claim Search endpoint) for
   claims matching meme/viral-content keywords, and the YouTube Data API v3
   search endpoint for recent meme-related videos.
2. Normalize every result into the feedItems schema from taxonomy.js (title,
   summary, sourceUrl, sourceName, publishedAt, contentType).
3. Assign a category by keyword-matching against the FEED_CATEGORIES list —
   I'll give you a keyword map for each category.
4. Before writing, check Firestore for an existing document with the same
   sourceUrl and skip it if found, so we don't create duplicates.
5. Write new items to the feedItems collection with status: "pending" and
   fetchedFrom set to the source name.

Read API keys from Firebase Functions environment config
(functions.config() or process.env, whichever this project already uses
elsewhere) — never hardcode them. Add try/catch around each source so one
failing feed doesn't stop the others, and log a summary of how many items
were fetched/skipped/written per run.
```

---

## Phase 3 — Admin moderation integration

**Goal:** Route pending feed items into the existing moderation queue instead
of building a second review system.

**Prompt for Antigravity:**
```
Open src/pages/Admin.jsx and show me how the current moderation queue for
submitted resources/activities is built (data source, list UI, approve/reject
actions).

Add a new "Feed items" view inside the same moderation section that:
1. Queries the feedItems collection where status == "pending", ordered by
   publishedAt descending.
2. Renders each item with its title, summary, sourceName, category, and a
   thumbnail if one exists.
3. Gives the admin Approve and Reject buttons that update status to
   "approved" or "rejected" respectively.

Reuse the existing moderation list/row components and styling rather than
building new ones — this should look and behave like the existing queue, just
pointed at a different collection.
```

---

## Phase 4 — Meme Watch page (frontend)

**Goal:** The public-facing page: an editor's-picks strip plus five
collapsible topic feeders.

**Prompt for Antigravity:**
```
Create src/pages/MemeWatch.jsx and register a route for /meme-watch alongside
the other top-level routes (next to Staffroom, not nested under Resources).

The page should:
1. Query feedItems where status == "approved", ordered by publishedAt
   descending.
2. Show an "Editor's picks" section at the top: up to 5 items where
   isEditorPick == true, displayed as cards, always visible (not collapsed).
3. Below that, one collapsed accordion section per entry in FEED_CATEGORIES.
   Each collapsed section shows the category label, an item count, and the
   single latest headline as a preview. Clicking expands it into a list of
   that category's item cards.
4. Each item card shows: a thumbnail (or a placeholder icon if none), title,
   one-line summary, sourceName + publishedAt, and a small category tag.

Match the existing visual style used in Resources.jsx (spacing, card style,
typography) so this feels like part of the same app, not a bolted-on page.
```

---

## Phase 5 — Cross-linking actions

**Goal:** Make each card actionable instead of a dead end — connect it to
Staffroom and Resources/Lab.

**Prompt for Antigravity:**
```
On each feed item card in MemeWatch.jsx, add two buttons: "Discuss in
Staffroom" and "Use as case study".

- "Discuss in Staffroom" should open (or create, if none exists yet) a
  Staffroom thread pre-filled with the item's title and sourceUrl as the
  starting post. Reuse the existing thread-creation function from
  Staffroom.jsx rather than writing a new one.
- "Use as case study" should open the existing activity-submission modal
  (the one used from Resources.jsx / ActivityDetail.jsx) with the title and
  sourceUrl pre-filled, so a teacher can flesh it out into a full classroom
  activity without re-typing the source.

Don't duplicate the thread-creation or activity-submission logic — call into
what already exists.
```

---

## Phase 6 — Sensitivity handling, filters, and rollout

**Goal:** Add the content-note badge, basic filtering, and confirm nothing
else broke before merging to main.

**Prompt for Antigravity:**
```
Add a small content-note component that renders on any feed item where
sensitivityFlag is true — text like "Sensitive topic — best explored with
guidance", styled as a subtle badge (not a blocking overlay, since we don't
gate content by role on this platform). Show it on both the Editor's picks
cards and the feeder cards.

Add a simple category filter and a "most recent / most discussed" sort
control at the top of the Meme Watch page.

Finally, run the existing test and build steps, and confirm the changes work
with our GitHub Actions CI/CD pipeline without breaking the Resources or
Admin pages. Show me a summary of every file you changed across all phases
before I merge this branch.
```

---

## Working with the agent

- Do one phase per branch/commit, test locally, then merge — same workflow
  you already use with your team.
- Since you started this project with no prior web development background,
  ask the agent to explain each diff in plain language before you accept it —
  especially anything touching API keys, Firestore security rules, or
  billing config. It's worth understanding *why* a change is safe, not just
  that it runs.
- If a phase's agent output looks bigger or touches more files than the
  prompt implies, ask it to narrow the change before accepting — that's
  usually a sign it's reaching into code it didn't need to touch.
