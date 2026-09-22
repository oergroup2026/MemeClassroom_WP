import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// The Lab only offers templates that have a Meme Story (a `resources` doc of
// type "stories" whose `template_id` points at the template), so the Lab and
// the Stories tab stay in step. Everything else in the `templates` and `memes`
// collections (AI-generated art, memes with captions baked in) is left out.

const isStoryType = (r) =>
  r.type === "stories" || r.type === "story" || r.uploadType === "stories";

const isHidden = (r) =>
  r.status === "hidden_moderation" || r.status === "admin_hidden";

// A resource counts as a "meme story" that links its template into the Lab
// when it's a story-type resource, not hidden, and points at a template.
// Exported so other views (e.g. Admin's template catalog) can classify
// templates as story-linked without duplicating this predicate.
export const isStoryResource = (r) => Boolean(r.template_id) && isStoryType(r) && !isHidden(r);

// `!= ""` drops resources with no template_id, and a single-field inequality
// needs no composite index.
const storyQuery = () =>
  query(collection(db, "resources"), where("template_id", "!=", ""));

const toTemplateIds = (snap) => {
  const ids = new Set();
  snap.forEach((d) => {
    const r = d.data();
    if (isStoryResource(r)) ids.add(r.template_id);
  });
  return ids;
};

// Live set of template ids that have a meme story.
export const subscribeStoryTemplateIds = (onIds, onError) =>
  onSnapshot(storyQuery(), (snap) => onIds(toTemplateIds(snap)), onError);

// One-shot version for modals.
export const fetchStoryTemplateIds = async () => toTemplateIds(await getDocs(storyQuery()));

// Maps template id -> its meme story's resource id, so a template card can
// link straight to /resources/story/:id (e.g. an info icon) without a
// separate per-card lookup.
export const fetchTemplateStoryIds = async () => {
  const snap = await getDocs(storyQuery());
  const map = new Map();
  snap.forEach((d) => {
    const r = d.data();
    if (isStoryResource(r) && !map.has(r.template_id)) map.set(r.template_id, d.id);
  });
  return map;
};
