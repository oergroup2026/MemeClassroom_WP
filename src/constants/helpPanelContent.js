/**
 * Static help panel content for every major page in MemeClassroom.
 * Uses simple, friendly language to describe what users can do on the page.
 */

export const HELP_PANEL_CONTENT = {
  home: {
    title: "MemeClassroom Home",
    summary: "Welcome to MemeClassroom! This is the central hub where teachers, students, and educators collaborate to bring cultural humor and pedagogical rigor together.",
    keyActions: [
      "Browse peer-reviewed educational memes in the Library.",
      "Create custom image, video, GIF, or audio memes in the Meme Lab.",
      "Discuss lesson trials and teaching ideas in the Staffroom.",
      "Read research papers and download lesson plans in Meme Reads.",
      "Evaluate your critical media decoding skills in the Meme Literacy Test.",
    ],
    quickTip: "You can click the accessibility button at the bottom-right anytime to adjust fonts, contrast, and text spacing.",
  },

  lab: {
    title: "Meme Lab Guide",
    summary: "The Meme Lab is a creative workshop where you can build multimodal memes for your classroom using images, videos, GIFs, or audio clips.",
    keyActions: [
      "Select your desired format (Image, Video, GIF, or Audio) from the top tabs.",
      "Choose a community template or upload your own background media.",
      "Click anywhere on the preview canvas to add draggable caption layers.",
      "Use the AI Caption Generator for quick curriculum-relevant wording.",
      "Save your work or publish directly to the public Meme Library.",
    ],
    quickTip: "Use the Undo and Redo buttons in the toolbar if you want to experiment with different text layouts safely.",
  },

  library: {
    title: "Meme Library Guide",
    summary: "The Meme Library is a curated repository of educational memes contributed and peer-reviewed by the community.",
    keyActions: [
      "Use the Smart Search bar to find memes by subject or keyword.",
      "Filter by grade level (Primary to Higher Ed), language, and format.",
      "Give a 5-star rating to indicate accuracy and classroom readiness.",
      "Click 'Remix' on any meme to load it into the Lab and adjust it for your class.",
      "Click 'AI Explain' if you want a breakdown of the meme's cultural or educational meaning.",
    ],
    quickTip: "Bookmark memes by clicking the bookmark icon so you can quickly find them later from your Profile.",
  },

  staffroom: {
    title: "Staffroom Guide",
    summary: "The Staffroom is our professional social lounge. Share classroom stories, ask teaching questions, or get feedback on a lesson idea.",
    keyActions: [
      "Post a new topic: Choose between a Discussion, a Meme post, or a Poll.",
      "React to posts with 6 expressive emojis: Like, Love, Insightful, Celebrate, Fire, or Amazed.",
      "Filter the feed by general threads, memes, or active polls.",
      "Click the Text-to-Speech button on any post to hear it read aloud.",
    ],
    quickTip: "Running a poll before introducing a difficult topic is a great way to gauge student interest or peer consensus.",
  },

  resources: {
    title: "Meme Reads Guide",
    summary: "Meme Reads offers pedagogical scaffolding, including scholarly articles, lesson activity plans, and classroom case studies.",
    keyActions: [
      "Filter resources by Research Papers, Lesson Plans, Activities, or Stories.",
      "Open research papers inline using the built-in PDF viewer.",
      "Listen to articles and activity plans with Text-to-Speech audio.",
      "Click 'Contribute Resource' to submit your own lesson plan for peer review.",
    ],
    quickTip: "All contributed resources can be downloaded or remixed under Creative Commons guidelines.",
  },

  memeLiteracyTest: {
    title: "Meme Literacy Guide",
    summary: "Memes are powerful, but they can also carry propaganda and misinformation. This test evaluates how critically you deconstruct digital media.",
    keyActions: [
      "Choose an active assessment from the test list.",
      "Answer questions testing 6 core dimensions of visual and cultural decoding.",
      "Read instant explanations for why an answer is correct or misleading.",
      "Earn verifiable literacy badges ranging from 'Spectator' to 'Scholar'.",
    ],
    quickTip: "You do not need to be logged in to take the literacy test. Share it with your students for a classroom activity!",
  },

  profile: {
    title: "Profile & Achievements",
    summary: "Your personal space to manage your account, track gamification rewards, and organize your saved educational assets.",
    keyActions: [
      "Choose from 5 custom avatars to personalize your profile.",
      "Track your Level and XP earned from creating memes and rating content.",
      "View your earned badges and literacy test certificates.",
      "Access all your saved memes, bookmarked threads, and contributions.",
    ],
    quickTip: "Creating helpful memes and contributing lesson plans awards bonus XP to level up your educator profile!",
  },
};
