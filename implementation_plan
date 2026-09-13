# Resources Page Redesign — Tile-First Navigation

## Background

The current Resources page uses a horizontal tab bar with 7 tabs (All Resources, Articles & Papers, Use Cases & Activities, Courses, Meme Stories, Additional Resources, Literacy Tests). This approach is cognitively overwhelming, especially on mobile, and buries category context. The goal is to replace the tab bar with a **tile-first landing view** that:

- Presents resource categories as visual tiles on the landing screen
- Opens a dedicated category view when a tile is clicked  
- Adds a single, unified **Contribute Resources** tile on the landing page (type-picker form inside)
- Keeps the existing data logic, modals, and Firestore hooks intact
- Strips visual clutter: no paper-pin icon, no date on front cards, no category CTA labels, no "general" tags, no "no login needed" copy

## Design Research & Principles Applied

### Reference Patterns
- **Notion / Linear category hubs** — tile grids as primary navigation with zero cognitive overload
- **Material Design 3 cards** — consistent elevation, clear focus zones, single primary action per card
- **Nielsen Norman Group: Progressive Disclosure** — reveal complexity only when the user opts in
- **App Store / Google Play category pages** — large-touch-target tiles with icon + label, no text-heavy tabs
- **Khan Academy** — clean subject tiles, stripped of marketing language

### Design Decisions
1. **Tile grid over tabs** — 3 columns desktop, 2 tablet, 1 mobile; each tile is a 1:1 aspect ratio card
2. **Icon language** — use **Lucide icons** (already in codebase) instead of emojis for category tiles to match app aesthetic
3. **Ruby accent (`#E0115F`)** — primary CTA colour (already defined as `--accent` in `:root`)
4. **Manrope font** — already the app's primary font; no changes needed
5. **Glassmorphism tile hover** — consistent with `.glass-panel` already in `index.css`
6. **Contribute tile** — a distinct accent-bordered tile in the tile grid; clicking it opens the existing `ContributeResourceModal` with `defaultType=null` (type picker)
7. **Category detail view** — replaces the landing tile grid; includes a back button, the existing search/filter bar, and the existing cards grid — no UI duplication

---

## User Review Required

> [!IMPORTANT]
> **Tile landing vs. deep-linking**: Currently `?tab=all` / `?tab=stories` URL params are used for deep links from other pages. The new design maps `?category=stories` (and similar) to open the tile category directly. All existing deep-links still work — the landing is the "home" state (`/resources` with no params).

> [!IMPORTANT]
> **"All Resources" tile**: There is currently an "All Resources" tab that shows every type combined. The new design keeps this as a tile ("Browse All"). Clicking it opens the full grid with all filters — same as before. Please confirm you want to keep this or remove it.

> [!WARNING]
> **Literacy Tests tile**: The current tab links to an internal `LiteracyTestsTabContent` sub-component. In the tile design, clicking the Literacy Tests tile continues to do the same — it renders the existing component inline. No behaviour change.

---

## Open Questions

> [!NOTE]
> 1. **"Browse All" tile**: Keep it as the first tile, or remove it so users always land on a specific category?  
> 2. **Suggested Reads section**: Currently at the bottom of the All Resources tab. Should it stay (inside the "Browse All" category view) or be promoted to the tile landing screen?  
> 3. **Hero carousel**: The page currently has a featured-resource carousel. Should it be kept on the tile landing screen, removed, or moved into the "Browse All" view?

---

## Proposed Changes

### Overview of structural changes

```
BEFORE                        AFTER
──────────────────────────    ──────────────────────────────────────
[Header + Contribute CTA]     [Header (no subtitle fluff)]
[7 Horizontal Tabs]      →    [Category Tile Grid (7 tiles + Contribute tile)]
[Search bar]                        ↓ (click tile)
[Filter bar]              →   [Back button + category title]
[Resource cards grid]         [Search bar]
                              [Filter bar]
                              [Resource cards grid]
```

---

### [MODIFY] [Resources.jsx](file:///c:/Users/jayan/Documents/GitHub/MemeClassroom_WP/src/pages/Resources.jsx)

The main file. All changes are confined here — no other files need modification.

#### 1. Page header cleanup
- Remove the subtitle text `"Access curriculum activities, lesson cards, research papers, and stories. No login needed to browse."` and all per-tab subtitle variants from `TAB_HEADER_MAP`
- Remove per-tab CTA buttons from the header — the Contribute tile replaces them
- Keep the `h1` title: `"Meme Resources"` on the landing, then the category name in the detail view

#### 2. Remove tab bar
- Delete the `<div id="resources-type-tabs">` tab bar (lines 1817–1832)
- The `activeTab` state variable is **repurposed** to track which category tile is open (`null` = landing, `"all"` | `"activity"` | etc. = category view)

#### 3. New: Tile landing screen (`activeTab === null`)
Rendered when no category is selected. A responsive grid of tiles:

| Tile | Icon (Lucide) | Colour accent | Opens |
|------|--------------|---------------|-------|
| Browse All | `LayoutGrid` | Ruby | `activeTab = "all"` |
| Articles & Papers | `FileText` | Indigo | `activeTab = "article_paper"` |
| Use Cases & Activities | `Layers` | Purple | `activeTab = "activity"` |
| Courses & Lessons | `GraduationCap` | Emerald | `activeTab = "course"` |
| Meme Stories | `BookOpen` | Amber | `activeTab = "stories"` |
| Additional Resources | `ExternalLink` | Sky | `activeTab = "additional"` |
| Literacy Tests | `ClipboardCheck` | Violet | `activeTab = "literacy_tests"` |
| Contribute a Resource | `Plus` | Ruby bordered | Opens `ContributeResourceModal` with `defaultType=null` |

Each tile:
- 160–180px tall, fills column width  
- Icon (28px) + label (14px bold) + short one-liner description (11px, 2 lines max)
- Subtle count badge (e.g., "12 resources") in the bottom-right corner derived from `resources` state
- Hover: slight lift (`-translate-y-1`), ruby border glow  
- Clicking anywhere on tile triggers navigation

#### 4. New: Category detail header
When a tile is clicked (`activeTab !== null`):
- Show a `←  Back to Resources` breadcrumb button above the page title
- Show category title as `h1`
- Remove per-tab CTA from the header (contribute access is via the landing tile)
- Keep the existing search bar + filter bar below

#### 5. Resource cards cleanup
For **all card types** (generic, story, activity):
- **Remove** the date displayed in the card header (lines ~2465–2468 in generic card)
- **Remove** the paper-pin / attachment icon on cards (the `📎` references at line 1641)  
- **Remove** CTA buttons that repeat the category label (e.g., `"🎯 Open Activity →"`, `"📖 Read Story →"` — replace with a clean `"More details →"` or `"Open →"`)
- **Remove** type badge labels that include "Activity", "Story" etc. when inside the specific category view (the user already chose that tile)
- **Remove** `"general"` and `"general."` tags from keyword display (filter these out in the render)
- Keep the Bookmark icon; remove the paperclip/pin icon
- Make the **entire card** clickable (wrap in `onClick`) not just the title button — this covers the detail-window requirement

#### 6. Contribute Resource tile  
- The tile on the landing opens `ContributeResourceModal` with `defaultType=null` (type-picker, already implemented in modal)
- Remove per-tab contribute buttons from inside the category detail views (keeping it only on the landing is cleaner)
- Exception: keep the "Be the first to contribute →" empty-state button inside category views

#### 7. "Suggested Reads" section  
- Stays inside the "Browse All" (`activeTab = "all"`) view, not on the landing screen

#### 8. URL deep-linking update
- Change URL param from `?tab=X` to `?category=X` for clarity
- `null` category (landing) = `/resources` with no params
- Back button sets `activeTab = null` and clears the URL param

#### 9. Minor copy/text cleanup
- Remove `"No login needed to browse"` and similar upsell language  
- Remove emoji from section headers and CTA buttons that are purely decorative (keep functional emojis like ❤️ for like button)
- In the detail modal (`ResourceDetailModal`), the date (`📅`) stays — it's in the detail view which is appropriate  
- Remove emoji prefix from `"📅 View Full Description →"` link in the Additional Resources cards; use `"More details →"` text

---

## Verification Plan

### Automated Tests
- No automated tests exist for this page; verification is manual.

### Manual Verification
1. **Landing screen** — `/resources` shows the tile grid with correct tile labels, icons, and resource counts
2. **Tile navigation** — clicking each tile loads the correct category view and updates URL (`?category=X`)
3. **Back button** — returns to tile landing, clears URL param
4. **Deep-link** — `/resources?category=stories` opens the Stories category directly, bypassing the tile screen
5. **Contribute tile** — opens `ContributeResourceModal` with type-picker (no `defaultType`) for logged-in users; redirects to `/auth` for guests
6. **Card clicks** — clicking anywhere on a resource card (not just title/CTA) opens the detail modal
7. **Removed elements** — verify no date on front cards, no paper-pin icon, no "general" tags, no "No login needed" copy, no redundant category CTA buttons
8. **Existing functionality** — likes, bookmarks, flags, share, edit/delete still work correctly
9. **Dark mode** — tiles and detail views render correctly in dark mode
10. **Mobile** — tiles stack to 1-column on small screens; back button visible and accessible
