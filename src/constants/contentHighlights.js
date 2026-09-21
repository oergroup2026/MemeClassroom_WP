// contentHighlights.js — Shared metadata for the admin-curated "Highlights"
// feature (Newspaper hero + homepage highlights carousel). Single source of
// truth for each content type's small-header label, link builder, and the
// branded fallback image used when the source item itself has no image —
// reused by the Admin quick-highlight action and by the rendering carousels.

export const HIGHLIGHT_CONTENT_TYPES = {
  newspaper_item: {
    label: "Newspaper",
    sourceCollection: "newspaper_items",
    // No dedicated Newspaper photo exists yet in /public — slide-literacy.jpg
    // is the closest thematic pairing already used elsewhere in the app's own
    // copy (Newspaper + critical/media literacy are paired in FeatureCarousel).
    fallbackImage: "/slide-literacy.jpg",
    buildLink: (id) => `/newspaper?highlight=${id}`,
  },
  resource: {
    label: "Resources",
    sourceCollection: "resources",
    fallbackImage: "/slide-oer.jpg",
    buildLink: (id) => `/resources?highlight=${id}`,
  },
  activity: {
    label: "Activities",
    sourceCollection: "resources",
    fallbackImage: "/slide-activities.jpg",
    buildLink: (id) => `/resources/activity/${id}`,
  },
  meme_story: {
    label: "Meme Stories",
    sourceCollection: "resources",
    fallbackImage: "/slide-oer.jpg",
    buildLink: (id) => `/resources/story/${id}`,
  },
  meme: {
    label: "Meme Library",
    sourceCollection: "memes",
    // No fallback needed in practice — a meme's own media_url is the image.
    fallbackImage: "",
    buildLink: (id) => `/library?highlight=${id}`,
  },
  staffroom_post: {
    label: "Staffroom",
    sourceCollection: "staffroom_posts",
    fallbackImage: "/slide-staffroom.jpg",
    buildLink: (id) => `/staffroom?highlight=${id}`,
  },
};

export function highlightContentTypeMeta(contentType) {
  return HIGHLIGHT_CONTENT_TYPES[contentType] || null;
}

export const HIGHLIGHT_PLACEMENTS = ["home", "newspaper"];
