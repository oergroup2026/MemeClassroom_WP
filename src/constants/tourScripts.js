/**
 * Tour scripts for each major page in MemeClassroom.
 * Designed with simple, jargon-free English for teachers, students, and educators.
 */

export const TOUR_SCRIPTS = {
  lab: {
    pageTitle: "Meme Lab",
    steps: [
      {
        targetId: "lab-format-tabs",
        title: "1. Choose Your Format",
        content: "Select the type of meme you want to create: Image, Video, GIF, or Audio meme.",
        placement: "bottom",
      },
      {
        targetId: "lab-template-picker",
        title: "2. Pick a Template or Media",
        content: "Start with a pre-approved educational template or upload your own picture, video, or audio file.",
        placement: "bottom",
      },
      {
        targetId: "lab-canvas-area",
        title: "3. Add Captions & Text",
        content: "Click anywhere on the canvas to add text layers. Drag them to position and customize font, size, and colors.",
        placement: "top",
      },
      {
        targetId: "lab-ai-btn",
        title: "4. AI Caption Assistant",
        content: "Need inspiration? Click the AI helper to automatically generate curriculum-relevant caption ideas.",
        placement: "left",
      },
      {
        targetId: "lab-publish-btn",
        title: "5. Publish or Download",
        content: "Download your meme to use offline or publish it to the public library tagged by subject and grade.",
        placement: "left",
      },
    ],
  },

  library: {
    pageTitle: "Meme Library",
    steps: [
      {
        targetId: "library-search-bar",
        title: "1. Smart Search",
        content: "Search memes by subject, lesson topic, or keyword with instant fuzzy matching.",
        placement: "bottom",
      },
      {
        targetId: "library-filter-sidebar",
        title: "2. Subject & Grade Filters",
        content: "Narrow down memes by grade level (Primary, Middle, High School, College) and curriculum subject.",
        placement: "right",
      },
      {
        targetId: "library-meme-grid",
        title: "3. Peer Ratings & Interactions",
        content: "Rate meme educational value, comment with fellow teachers, bookmark for class, or download.",
        placement: "top",
      },
      {
        targetId: "library-ai-explain-info",
        title: "4. AI Meme Explainer",
        content: "Not sure about a cultural or subject reference? Click 'AI Explain' on any meme to deconstruct its meaning.",
        placement: "left",
      },
    ],
  },

  staffroom: {
    pageTitle: "Staffroom Community",
    steps: [
      {
        targetId: "staffroom-composer",
        title: "1. Start a Discussion",
        content: "Post a classroom trial, ask pedagogical advice, share a meme, or launch a quick poll for peers.",
        placement: "bottom",
      },
      {
        targetId: "staffroom-filter-tabs",
        title: "2. Explore Topics",
        content: "Browse conversations by general discussions, meme activities, or quick polls.",
        placement: "bottom",
      },
      {
        targetId: "staffroom-feed",
        title: "3. Expressive Reactions",
        content: "Engage with posts using 6 reaction emojis (Like, Love, Insightful, Celebrate, Fire, Amazed) and replies.",
        placement: "top",
      },
    ],
  },

  resources: {
    pageTitle: "Meme Reads",
    steps: [
      {
        targetId: "resources-type-tabs",
        title: "1. Resource Categories",
        content: "Switch between Research Papers, Lesson Plans, Classroom Activities, and Meme Stories.",
        placement: "bottom",
      },
      {
        targetId: "resources-viewer-area",
        title: "2. Read & Listen Inline",
        content: "View research PDFs right inside the page and click the Speaker button to listen using Text-to-Speech.",
        placement: "top",
      },
      {
        targetId: "resources-contribute-btn",
        title: "3. Contribute Your Work",
        content: "Share your own tested lesson plans, activity worksheets, and classroom guides with other teachers.",
        placement: "left",
      },
    ],
  },

  memeLiteracyTest: {
    pageTitle: "Meme Literacy Test",
    steps: [
      {
        targetId: "literacy-test-cards",
        title: "1. Choose an Assessment",
        content: "Pick a test category to evaluate how well you decode, analyze, and spot disinformation in memes.",
        placement: "bottom",
      },
      {
        targetId: "literacy-progress-header",
        title: "2. Multi-Dimension Questions",
        content: "Answer scenario-based questions with instant score tracking and dimension breakdown.",
        placement: "bottom",
      },
      {
        targetId: "literacy-ai-feedback",
        title: "3. AI Pedagogical Feedback",
        content: "Whenever you make a mistake, ask AI to explain why the correct answer is better for critical media literacy.",
        placement: "top",
      },
    ],
  },

  profile: {
    pageTitle: "My Profile",
    steps: [
      {
        targetId: "profile-avatar-card",
        title: "1. Profile & Avatar",
        content: "Pick an illustrated avatar and view your registered educator or learner status.",
        placement: "bottom",
      },
      {
        targetId: "profile-xp-meter",
        title: "2. XP & Badges",
        content: "Earn experience points and unlock badges by creating memes, sharing lesson plans, and rating resources.",
        placement: "bottom",
      },
      {
        targetId: "profile-collections-tabs",
        title: "3. Your Saved Collections",
        content: "Easily access all your created memes, saved bookmarks, and contributed resources in one spot.",
        placement: "top",
      },
    ],
  },
};
