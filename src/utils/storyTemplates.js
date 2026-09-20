import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// The Lab only offers templates that have a Meme Story (a `resources` doc of
// type "stories" whose `template_id` points at the template), so the Lab and
// the Stories tab stay in step. Everything else in the `templates` and `memes`
// collections (AI-generated art, memes with captions baked in) is left out.

const isStory = (r) =>
  r.type === "stories" || r.type === "story" || r.uploadType === "stories";

const isHidden = (r) =>
  r.status === "hidden_moderation" || r.status === "admin_hidden";

// `!= ""` drops resources with no template_id, and a single-field inequality
// needs no composite index.
const storyQuery = () =>
  query(collection(db, "resources"), where("template_id", "!=", ""));

const toTemplateIds = (snap) => {
  const ids = new Set();
  snap.forEach((d) => {
    const r = d.data();
    if (r.template_id && isStory(r) && !isHidden(r)) ids.add(r.template_id);
  });
  return ids;
};

// Live set of template ids that have a meme story.
export const subscribeStoryTemplateIds = (onIds, onError) =>
  onSnapshot(storyQuery(), (snap) => onIds(toTemplateIds(snap)), onError);

// One-shot version for modals.
export const fetchStoryTemplateIds = async () => toTemplateIds(await getDocs(storyQuery()));
