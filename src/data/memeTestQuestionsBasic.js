// ─── Basic Meme Literacy Test — Beginner Questions ───────────────────────────
// 15 questions across 5 dimensions, written in simple plain language.
// All memes are classroom-appropriate. No Distracted Boyfriend.
// Reading level: approx. 5th–8th grade.

export const BASIC_DIMENSIONS = [
  "Symbolic Decoding",
  "Cultural Context",
  "Rhetorical Awareness",
  "Emotional Intelligence",
  "Ethical Judgment",
];

export const basicQuestions = [
  // ── DIMENSION 1: SYMBOLIC DECODING — "What does this meme actually mean?" ──
  {
    id: "b1",
    dimension: "Symbolic Decoding",
    memeUrl: "https://imgflip.com/s/meme/This-Is-Fine.jpg",
    memeAlt: "A cartoon dog sitting calmly at a table drinking coffee while the room around it is on fire",
    question: "Look at the dog in this meme. Everything around it is on fire, but the dog just keeps drinking coffee. What idea is this meme trying to show?",
    options: [
      "Dogs love coffee more than anything else",
      "Pretending everything is okay when it is clearly not",
      "House fires happen all the time and are no big deal",
      "The dog is waiting for help to arrive",
    ],
    correctIndex: 1,
    explanation: "The dog ignoring the fire is a symbol for pretending a problem does not exist. We use this meme when someone acts calm even though things are clearly going wrong.",
  },
  {
    id: "b2",
    dimension: "Symbolic Decoding",
    memeUrl: "https://imgflip.com/s/meme/Drake-Hotline-Bling.jpg",
    memeAlt: "Two-panel meme: top panel shows Drake looking away in disapproval; bottom panel shows Drake pointing with approval",
    question: "In this Drake meme, the top panel shows Drake saying 'no' and the bottom shows him saying 'yes'. What is this meme used for?",
    options: [
      "To explain complicated science topics",
      "To show that you prefer one thing over another",
      "To prove that Drake is better than other musicians",
      "To advertise a new product",
    ],
    correctIndex: 1,
    explanation: "The Drake meme is a simple way to say 'I don't like this thing, but I do like that thing.' People fill in the panels with whatever they are comparing.",
  },
  {
    id: "b3",
    dimension: "Symbolic Decoding",
    memeUrl: "https://imgflip.com/s/meme/Gru-s-Plan.jpg",
    memeAlt: "Four-panel meme showing the cartoon villain Gru explaining a plan where the last step contradicts the goal",
    question: "In the Gru's Plan meme, Gru makes a plan, but step 3 and step 4 say the exact same thing — which ruins the whole plan. What is this meme making fun of?",
    options: [
      "Plans that accidentally make the problem worse",
      "Cartoon villains who are always evil",
      "People who make very long lists",
      "The movie Despicable Me",
    ],
    correctIndex: 0,
    explanation: "This meme is funny because the plan backfires — the last step brings back the very problem you were trying to fix. It is used to show when an idea does not really work.",
  },

  // ── DIMENSION 2: CULTURAL CONTEXT — "Where did this come from?" ───────────
  {
    id: "b4",
    dimension: "Cultural Context",
    memeUrl: "https://imgflip.com/s/meme/Doge.jpg",
    memeAlt: "A Shiba Inu dog looking at the camera with captions that say things like 'much wow' and 'very amaze' in Comic Sans",
    question: "The Doge meme uses funny broken English like 'much wow' and 'very amaze'. Why do people think this is funny rather than just wrong?",
    options: [
      "People think the dog is speaking a foreign language",
      "The broken grammar is done on purpose as a joke that fans share together",
      "The person who made it did not know how to spell",
      "It is a mistake that accidentally became popular",
    ],
    correctIndex: 1,
    explanation: "The broken grammar is an intentional joke. When a community shares a specific style of humour — even if it is 'wrong' — it becomes a way to show you are part of the group.",
  },
  {
    id: "b5",
    dimension: "Cultural Context",
    memeUrl: "https://imgflip.com/s/meme/Bernie-I-Am-Once-Again-Asking-For-Your-Support.jpg",
    memeAlt: "Bernie Sanders sitting bundled up in a coat and mittens at a public event",
    question: "This photo of Bernie Sanders in his big mittens was taken at a real public event. Within hours, thousands of people photoshopped him into funny scenes. What does this show about how memes spread?",
    options: [
      "People dislike Bernie Sanders and wanted to make fun of him",
      "Social media users love joining in to remix and build on a funny image together",
      "Photoshop is very easy so everyone uses it daily",
      "News companies paid people to create these images",
    ],
    correctIndex: 1,
    explanation: "This meme spread because the image was funny and easy to remix. People joined in to add their own creative twist — it became a group activity, not just a joke about one person.",
  },
  {
    id: "b6",
    dimension: "Cultural Context",
    memeUrl: "https://imgflip.com/s/meme/They-re-the-same-picture.jpg",
    memeAlt: "Pam from The Office holds up two photos and says they are the same picture",
    question: "This meme is from a TV show called The Office. Does it matter that many people haven't seen the show?",
    options: [
      "Yes, you must watch The Office to understand any meme from it",
      "No, the image is funny on its own — you understand it from the picture and caption",
      "Yes, because all memes require deep knowledge of where they come from",
      "No, because memes are always about completely different things from their source",
    ],
    correctIndex: 1,
    explanation: "A good meme makes sense even if you have not seen the original show or movie. The image and text together carry the message. This is part of why memes spread so easily across cultures.",
  },

  // ── DIMENSION 3: RHETORICAL AWARENESS — "Is this trying to persuade me?" ──
  {
    id: "b7",
    dimension: "Rhetorical Awareness",
    memeUrl: "https://imgflip.com/s/meme/Expanding-Brain.jpg",
    memeAlt: "Four panels with progressively larger glowing brains next to increasingly extreme ideas",
    question: "In the Expanding Brain meme, having a bigger brain is supposed to mean a smarter idea. But sometimes really silly or wrong ideas are shown with the biggest brain. What is the meme actually doing?",
    options: [
      "Teaching you which ideas are truly the smartest",
      "Showing that bigger brains always mean better thinking",
      "Making fun of extreme ideas by pretending they are 'advanced genius' thinking",
      "Encouraging you to study harder in school",
    ],
    correctIndex: 2,
    explanation: "This meme often mocks extreme or silly ideas by pretending they are 'big brain' genius thoughts. The joke is that the most ridiculous option looks the most impressive — which is the opposite of true.",
  },
  {
    id: "b8",
    dimension: "Rhetorical Awareness",
    memeUrl: "https://imgflip.com/s/meme/Two-Buttons.jpg",
    memeAlt: "A sweating stressed man struggling to choose between pressing two buttons",
    question: "This 'Two Buttons' meme always shows exactly two choices. What is missing from this kind of thinking?",
    options: [
      "A picture of the buttons",
      "The fact that most real situations have more than two options",
      "An explanation of why decisions are stressful",
      "Nothing — every situation really does have only two choices",
    ],
    correctIndex: 1,
    explanation: "When a meme — or a person — tells you there are only two choices, watch out. Real life usually has many more options. Presenting only two choices is a way to make people feel stuck when they don't have to be.",
  },
  {
    id: "b9",
    dimension: "Rhetorical Awareness",
    memeUrl: "https://imgflip.com/s/meme/Change-My-Mind.jpg",
    memeAlt: "A person sits at a table with a sign making a bold claim and daring people to argue against it",
    question: "The 'Change My Mind' meme says it is open to debate, but the person usually looks very confident. What is it really saying?",
    options: [
      "The person is genuinely curious about other views",
      "The person is challenging others while already being sure they are right",
      "The person wants to start a friendly classroom discussion",
      "The person is advertising a product",
    ],
    correctIndex: 1,
    explanation: "Even though the sign says 'change my mind,' the pose and tone usually show the person is very sure of themselves. It looks open to debate but is often more about showing off than actually listening.",
  },

  // ── DIMENSION 4: EMOTIONAL INTELLIGENCE — "How does this make people feel?" ─
  {
    id: "b10",
    dimension: "Emotional Intelligence",
    memeUrl: "https://imgflip.com/s/meme/Surprised-Pikachu.jpg",
    memeAlt: "Pokémon character Pikachu with a very shocked, wide-eyed expression",
    question: "The Surprised Pikachu meme is used when someone is shocked by something that was completely predictable. What feeling does using this meme express?",
    options: [
      "Genuine surprise and shock at an unexpected event",
      "Gentle teasing — pointing out that someone should have seen it coming",
      "Sympathy for someone going through a hard time",
      "Excitement about Pokémon",
    ],
    correctIndex: 1,
    explanation: "This meme is a playful way of saying 'did you really not see that coming?' It teases someone for being surprised by something obvious. It can be funny, but it can also feel unkind depending on the situation.",
  },
  {
    id: "b11",
    dimension: "Emotional Intelligence",
    memeUrl: "https://imgflip.com/s/meme/Sad-Keanu.jpg",
    memeAlt: "A candid photograph of actor Keanu Reeves sitting alone on a park bench looking thoughtful",
    question: "This photo of Keanu Reeves sitting quietly on a bench made millions of people online feel sad for him and want to cheer him up. What does this show about memes and our emotions?",
    options: [
      "Keanu Reeves is always sad and needs help",
      "One photo can make us feel strong emotions about someone we have never met",
      "Celebrities should not sit alone in public",
      "Only photos from movies can make people feel emotional",
    ],
    correctIndex: 1,
    explanation: "We can feel real emotions — like sadness or sympathy — for people we have never met, based on just one photo. This is natural, but it is also good to remember we do not actually know how someone feels from a single image.",
  },
  {
    id: "b12",
    dimension: "Emotional Intelligence",
    memeUrl: "https://imgflip.com/s/meme/Mocking-Spongebob.jpg",
    memeAlt: "SpongeBob SquarePants in a mocking pose, used with alternating capital and lowercase letters to mock someone",
    question: "The Mocking SpongeBob meme is used to make fun of what someone said by repeating it in a silly way. How might the person being mocked feel?",
    options: [
      "Happy, because they know it is just a joke",
      "Curious about SpongeBob cartoons",
      "Hurt or embarrassed, because their words are being ridiculed",
      "Proud that their words became a meme",
    ],
    correctIndex: 2,
    explanation: "Even if it is meant as a joke, mocking someone's words can make them feel humiliated. Before sharing or using this kind of meme, it is worth thinking about how it would feel if it was directed at you.",
  },

  // ── DIMENSION 5: ETHICAL JUDGMENT — "Is it right to share this?" ──────────
  {
    id: "b13",
    dimension: "Ethical Judgment",
    memeUrl: "https://imgflip.com/s/meme/Disaster-Girl.jpg",
    memeAlt: "A young girl smiling in front of a burning building while firefighters work in the background",
    question: "This photo became a famous meme, but the girl in it was a child when it was taken. She never agreed to have her photo used this way online. What is the main problem with this?",
    options: [
      "The photo is not very funny",
      "Children should not be photographed outdoors",
      "A real person's photo was shared millions of times without their permission",
      "The fire in the background makes it too scary",
    ],
    correctIndex: 2,
    explanation: "When a real person — especially a child — has their photo turned into a meme without permission, it can affect their life in ways they cannot control. Before sharing images of real people, it is important to think about their right to say yes or no.",
  },
  {
    id: "b14",
    dimension: "Ethical Judgment",
    memeUrl: "https://imgflip.com/s/meme/Always-Has-Been.jpg",
    memeAlt: "Two astronauts in space, one pointing a gun at the other after revealing an unsettling truth",
    question: "A meme says something like 'Vaccines cause autism — always has been.' This is a false claim. Should you share a meme just because it looks cool or gets a reaction?",
    options: [
      "Yes, if it is funny it does not matter if it is true",
      "Yes, if lots of other people have already shared it",
      "No — sharing false information can cause real harm, even in a meme format",
      "Only share it if you add a joke to it first",
    ],
    correctIndex: 2,
    explanation: "Memes that spread false information can cause real harm — people might believe them. Before you share any meme about a serious topic, it is worth checking if the claim is actually true.",
  },
  {
    id: "b15",
    dimension: "Ethical Judgment",
    memeUrl: "https://imgflip.com/s/meme/Expanding-Brain.jpg",
    memeAlt: "Four-panel expanding brain meme",
    question: "You see a meme that makes fun of a group of people — for example, their religion, race, or where they are from. Even if your friends are laughing at it, what should you think about before sharing it?",
    options: [
      "Whether you have enough followers for it to go viral",
      "Whether it was made by a famous meme page",
      "Whether it could hurt or offend the people it is about",
      "Whether the image quality is good enough",
    ],
    correctIndex: 2,
    explanation: "Some memes seem harmless when you are sharing them with friends, but they can hurt real people. If a meme puts down a group of people, ask yourself: would I be comfortable if someone from that group saw me sharing this?",
  },
];
