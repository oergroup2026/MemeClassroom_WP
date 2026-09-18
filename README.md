# MemeClassroom

MemeClassroom is an educational platform that treats memes as a legitimate teaching tool. Teachers and students create, remix, and share memes tied to curriculum topics; a companion Meme Lab, literacy quizzes, a staffroom discussion board, a resource library, and a "Newspaper" of curated education-meme news round out the platform under a shared Universal Design for Learning (UDL) accessibility layer (high-contrast mode, adjustable text size, text-to-speech).

---

## Architecture

```
┌─────────────┐        ┌──────────────────────────────┐
│   Browser    │◀──────▶│   React 19 SPA (Vite build)   │
└─────────────┘        └──────────────┬────────────────┘
                                       │ Firebase client SDK
                        ┌──────────────┼──────────────────────┐
                        ▼              ▼                      ▼
                 ┌────────────┐ ┌────────────┐        ┌──────────────┐
                 │  Firebase   │ │  Firestore  │        │   Firebase    │
                 │    Auth     │ │  (database) │        │    Storage    │
                 └────────────┘ └──────┬─────┘        └──────────────┘
                                       │ triggers
                                       ▼
                              ┌──────────────────┐
                              │  Cloud Functions   │──▶ external RSS feeds
                              │  (functions/)      │    (Newspaper auto-fetch)
                              └──────────────────┘
```

There is **no custom backend server** — the React app talks to Firebase directly from the browser using the client SDK. This means **Firestore Security Rules (`firestore.rules`) are the only real access-control layer**; anything the rules allow, any signed-in user can do via the SDK regardless of what the UI shows or hides. Cloud Functions (`functions/index.js`) only handle things the client can't safely do itself: server-side notification creation and the scheduled Newspaper RSS fetch.

Hosting is static: `npm run build` produces `dist/`, which Firebase Hosting serves, with a rewrite so every route falls through to `index.html` (client-side routing via `react-router-dom`).

---

## Data flow, feature by feature

**Auth & profile** — `src/context/AuthContext.jsx` wraps Firebase Auth (email/password, Google, and passwordless magic links). On sign-up, it writes a `/users/{uid}` profile document and a `/user_stats/{uid}` counters document in one transaction; email address is written separately to `/private_contacts/{uid}` (see [Access control](#access-control-model) below for why).

**Memes (Meme Lab & Library)** — The Lab (`src/pages/Lab.jsx` + `src/components/lab/`) is a canvas-based editor (image/video/audio) that exports to Firebase Storage and writes a `/memes/{id}` document. The Library (`src/pages/Library.jsx`) reads public memes, with likes/comments/flags as their own collections referencing the meme by ID.

**Resources & Newspaper** — Teacher-contributed lesson resources (`/resources`) and curated news items (`/newspaper_items`) both follow a submit-then-approve flow: a contributor creates a doc with `admin_approved: false`, and only an admin can flip it to `true` (enforced in `firestore.rules`, not just the UI). The Newspaper also has a scheduled Cloud Function (`fetchNewspaperItems`, runs weekly) that pulls from RSS sources and auto-publishes items from a pre-approved trusted-domain list, queuing everything else for admin review.

**Staffroom** — A discussion board (`/staffroom_posts` + `/staffroom_replies`) for teachers, with an "expert-verified" comment flag gated to `expert`/`admin` roles.

**Slang Decoder & Literacy Test** — Two standalone quiz features (`/slang_terms`, `/slang_quiz_questions`, `/literacy_tests`, `/literacy_test_questions`) with results and earned badges written per-user.

**Notifications** — Written *only* by Cloud Functions (never directly by the client — enforced in rules), triggered by Firestore document creation: a new comment, a comment like, a reply, a staffroom reply, a badge earned, a resource bookmark. Each writes a `/notifications/{id}` doc that the recipient's client subscribes to directly.

**Badges** — Awarded client-side (check-if-earned, then write to `/badges`) at several points: registration, profile completion, literacy test pass, slang quiz milestones. (These award sites duplicate the same "check existing → write" logic in a few places — a known cleanup opportunity, not a data-flow concern.)

---

## Roles & access control model

Roles live on the user profile (`profile.role`) and are checked **both** in the UI (for what's shown) and in `firestore.rules` (for what's actually allowed — the UI check alone is not security). Roles: `student`, `teacher`, `expert`, `admin`, `manager` (a restricted admin variant with access to moderation/analytics tabs but not system-level settings).

Key rules-level guarantees:
- A user can update their own profile but **cannot** self-grant `role`, `is_verified`, or clear their own `banned` flag — only an admin can.
- Email addresses live in a separate `/private_contacts/{uid}` collection, readable only by the owner or an admin — the main `/users/{uid}` doc (readable by any signed-in user, so pages can show author names) never carries email.
- A banned user (`profile.banned === true`) is blocked server-side from creating new content (memes, comments, posts, resources, etc.) — not just redirected client-side.
- Content requiring approval (`resources`, `newspaper_items`, `slang_terms`) can never be self-approved by its author, even by directly calling the Firestore SDK.

If you're auditing or extending this app, read `firestore.rules` end-to-end before assuming a UI-level check is sufficient — it usually isn't, by design.

---

## Error tracking

[Sentry](https://sentry.io) is wired up for both the frontend (`src/utils/errorTracking.js`, initialized in `src/main.jsx`) and Cloud Functions (`functions/index.js`), but is a **no-op until you set a DSN** — see [Environment variables](#environment-variables). An app-wide error boundary (`src/components/AppCrashFallback.jsx`) shows a recovery screen instead of a blank page on an uncaught render crash.

---

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS, React Router
- **Backend:** Firebase (Firestore, Auth, Storage, Cloud Functions v2, Hosting)
- **Media:** ffmpeg.wasm (in-browser video processing), html2canvas (image export)
- **Error tracking:** Sentry (optional, see above)

---

## Getting started

### Prerequisites
- Node.js 18+
- A Firebase project (or access to the existing `memeclassroom-98d2b` project)

### Setup
```bash
git clone https://github.com/oergroup2026/MemeClassroom_WP.git
cd MemeClassroom_WP
npm install
cp .env.example .env.local   # then fill in the keys you need — see below
npm run dev
```

### Environment variables
Copy `.env.example` to `.env.local` (git-ignored) and fill in what you need. Nothing here is required to run the app locally — each integration degrades gracefully when unset:

| Variable | Purpose | Required? |
|---|---|---|
| `VITE_EMAILJS_SERVICE_ID` / `_TEMPLATE_ID` / `_PUBLIC_KEY` | Sends real OTP verification emails | Only for that flow |
| `VITE_GIPHY_API_KEY` | GIF search tab in the Meme Lab | Only for GIF search |
| `VITE_GEMINI_API_KEY` | AI features (users can also supply their own key in-app) | No — not recommended to set globally, see comment in `.env.example` |
| `VITE_SENTRY_DSN` | Frontend error tracking | No — no-op until set |

Cloud Functions have their own template at `functions/.env.example` (copy to `functions/.env`) — currently just `SENTRY_DSN` for backend error tracking.

The Firebase project config in `src/firebase.js` is **not a secret** — Firebase web API keys identify the project only; access is controlled entirely by `firestore.rules` and `storage.rules`, not by keeping that config private.

### Firebase CLI (for rules/functions changes)
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,functions   # after changing firestore.rules or functions/
```
In practice this is automated: merging a PR that touches `firestore.rules`, `firestore.indexes.json`, or `functions/**` triggers `.github/workflows/firebase-rules-functions-deploy.yml` automatically. Hosting deploys separately on every merge to `main` via `.github/workflows/firebase-hosting-merge.yml`.

---

## Project structure

```
src/
  pages/        Route-level components (one per page in App.jsx)
  components/   Shared UI, modals, and the Meme Lab's sub-components (components/lab/)
  context/      React context providers (auth, UDL accessibility, user-profile modal)
  hooks/        Reusable hooks (undo/redo, video trim, tour)
  services/     External API clients (Gemini)
  utils/        Pure helpers (search, readability scoring, error tracking, etc.)
  constants/    Static config (taxonomy, quiz content, help text)
  data/         Bundled question banks / starter content
  firebase.js   Firebase SDK initialization

functions/
  index.js             Cloud Functions: notification triggers, Newspaper auto-fetch, thumbnail scrape
  newspaperConfig.js    Trusted RSS domains + default sources

firestore.rules   Security rules — the real access-control layer (see above)
storage.rules     Firebase Storage security rules
```
