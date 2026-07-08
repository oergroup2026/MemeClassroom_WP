// taxonomy.js — Shared fallback constants for Subjects and Grade Groups
// The app prefers live data from Firestore `configs/taxonomy`.
// These constants are used when that document doesn't exist yet.

export const SUBJECTS = [
  "Biology",
  "Physics",
  "Maths",
  "Chemistry",
  "History",
  "Geography",
  "English",
  "Computer Science",
  "Environmental Science",
  "Economics",
  "Political Science",
  "Philosophy",
  "Art & Design",
  "Physical Education",
  "Music",
  "Other"
];

// Globally-applicable named education levels (not age ranges)
export const GRADE_GROUPS = [
  "Middle School (6–8)",
  "High School (9–10)",
  "Senior Secondary (11–12)",
  "Undergraduate",
  "Postgraduate",
  "Competitive Exams",
  "General"
];

export const RESOURCE_TYPES = [
  { value: "article", label: "Article" },
  { value: "research_paper", label: "Research Paper" },
  { value: "activity", label: "Classroom Activity" },
  { value: "course", label: "Lesson Course" },
  { value: "stories", label: "Meme Story" },
  { value: "other", label: "Other Tool" }
];
