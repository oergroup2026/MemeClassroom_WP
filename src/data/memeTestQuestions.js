// ─── Meme Literacy Test Data ───────────────────────────────────────────────
// 18 curated questions across 6 critical literacy dimensions.
// Each question cites a well-known internet meme used in academic ML research.

export const DIMENSIONS = [
  "Symbolic Decoding",
  "Cultural Context",
  "Rhetorical Awareness",
  "Critical Analysis",
  "Ethical Judgment",
  "Emotional Intelligence",
];

// Per-dimension UI styling (Tailwind static classes — no dynamic concatenation)
export const DIMENSION_META = {
  "Symbolic Decoding":      { icon: "", pill: "bg-ruby-100 dark:bg-ruby-950/30 text-ruby-700 dark:text-ruby-300 border border-ruby-200 dark:border-ruby-800", bar: "bg-gradient-to-r from-ruby-500 to-pink-500" },
  "Cultural Context":       { icon: "", pill: "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",       bar: "bg-gradient-to-r from-blue-500 to-cyan-500" },
  "Rhetorical Awareness":   { icon: "", pill: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800", bar: "bg-gradient-to-r from-amber-500 to-yellow-500" },
  "Critical Analysis":      { icon: "", pill: "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800",             bar: "bg-gradient-to-r from-red-500 to-rose-500" },
  "Ethical Judgment":       { icon: "", pill: "bg-teal-100 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800",       bar: "bg-gradient-to-r from-teal-500 to-emerald-500" },
  "Emotional Intelligence": { icon: "", pill: "bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800",       bar: "bg-gradient-to-r from-rose-500 to-pink-500" },
};

// Score-band literacy levels
export const LEVELS = [
  {
    min: 0, max: 30,
    title: "Meme Spectator", icon: "",
    colorClass: "text-green-600 dark:text-green-400",
    bgClass: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900",
    description: "You experience memes primarily as entertainment, taking them at face value. You are just beginning your journey into the deeper layers of meaning that memes carry.",
    reflection: "Most memes feel like harmless jokes — and many genuinely are. But beneath the surface, even the simplest memes carry cultural assumptions, rhetorical moves, and embedded values. This assessment is an invitation to look deeper and question what memes are actually doing to and for us.",
    nextSteps: [
      "Browse the Meme Library and practise asking: 'What is this meme trying to make me feel or believe?'",
      "Read a beginner article on media literacy foundations in Meme Reads",
      "Try creating your own meme in the Meme Lab — authorship builds analytical awareness",
    ],
  },
  {
    min: 31, max: 55,
    title: "Meme Decoder", icon: "",
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900",
    description: "You are beginning to recognise recurring patterns and surface-level rhetoric in memes. You can sense when a meme is trying to persuade you, even if the mechanism is not always clear.",
    reflection: "You have a developing eye for meme rhetoric — you know something is 'off' about a meme even when you cannot yet fully articulate why. Building vocabulary around fallacies, dehumanisation, and false equivalence will sharpen this intuition considerably.",
    nextSteps: [
      "Explore the Library and identify 3 memes that use rhetorical techniques discussed in this test",
      "Look up 'logical fallacies' and try mapping them to meme formats you encounter daily",
      "Discuss a challenging meme with a peer — explaining your reasoning deepens understanding",
    ],
  },
  {
    min: 56, max: 75,
    title: "Meme Analyst", icon: "",
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900",
    description: "You understand meme culture with considerable sophistication — you read context, recognise cultural references, and identify common manipulative techniques.",
    reflection: "Your analytical skills are solid. You understand that memes are never just jokes — they encode and transmit values, biases, and worldviews. Your challenge now is applying this critical lens consistently, especially to memes that align with your own existing beliefs.",
    nextSteps: [
      "Focus on the dimensions you scored lowest in — especially Critical Analysis and Ethical Judgment",
      "Try creating a meme that deliberately subverts a harmful stereotype",
      "Explore the academic resources on meme pedagogy in Meme Reads",
    ],
  },
  {
    min: 76, max: 90,
    title: "Meme Critic", icon: "",
    colorClass: "text-ruby-600 dark:text-ruby-400",
    bgClass: "bg-ruby-50 dark:bg-ruby-950/20 border-ruby-200 dark:border-ruby-800",
    description: "You demonstrate advanced critical literacy across multiple dimensions simultaneously — rhetoric, ethics, emotion, cultural context — with nuance and depth.",
    reflection: "You are operating at a level that many media literacy educators aspire to. You understand memes as complex communicative acts with real social consequences. Consider channelling this skill into creating more intentional, critically aware memes — or helping others develop this literacy.",
    nextSteps: [
      "Share this test with a student or colleague — guiding others deepens your own understanding",
      "Contribute to the Meme Library with critically-annotated content",
      "Explore advanced resources on semiotics and visual rhetoric in Meme Reads",
    ],
  },
  {
    min: 91, max: 100,
    title: "Meme Scholar", icon: "",
    colorClass: "text-indigo-600 dark:text-indigo-400",
    bgClass: "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800",
    description: "Exceptional critical meme literacy. You approach memes the way a media scholar would — with attention to semiotics, rhetoric, ethics, cultural politics, and emotional dynamics.",
    reflection: "Your level of critical engagement with meme culture is rare and genuinely valuable. You understand that memes shape culture, political discourse, and social identity in profound ways. The question now is: how will you use this literacy to contribute positively to the meme ecosystem you participate in?",
    nextSteps: [
      "Consider contributing a Meme Reads article on critical meme literacy for others",
      "Use your skills to help frame content critically in the Staffroom discussions",
      "Challenge yourself: can you find a meme that genuinely defies all the categories this test uses?",
    ],
  },
];

export const getLevel = (pct) =>
  LEVELS.find((l) => pct >= l.min && pct <= l.max) ?? LEVELS[0];

// The questions themselves (with their answers) live server-side in
// functions/quizBanks/ and are served without answers by the startQuiz function.
