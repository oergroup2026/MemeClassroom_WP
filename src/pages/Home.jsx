import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  collection, 
  getCountFromServer, 
  query, 
  where, 
  getDocs, 
  limit,
  orderBy
} from "firebase/firestore";
import { db } from "../firebase";
import MemeLiteracyBanner from "../components/MemeLiteracyBanner";
import FeatureCarousel from "../components/FeatureCarousel";
import {
  FlaskConical,
  BookOpen,
  MessageSquare,
  BookOpenCheck,
  BrainCircuit,
  ArrowRight,
  GraduationCap,
  Compass,
  ChevronDown,
  ChevronUp,
  Award,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Layers,
  Zap,
  CheckCircle2
} from "lucide-react";

// SlideFeatureVisual replaced by FeatureCarousel component

const _UNUSED = ({ slideId }) => {
  switch (slideId) {
    case "slide-lab":
      return (
        <div className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 text-white p-4 shadow-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-ruby-500 animate-pulse" />
              <span className="font-extrabold text-ruby-400">Meme Studio Editor</span>
            </div>
            <div className="flex gap-1 text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded bg-ruby-600/30 text-ruby-300 border border-ruby-500/40">Video</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">GIF</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">Audio</span>
            </div>
          </div>
          <div className="relative aspect-video rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden flex flex-col justify-between p-3">
            <div className="text-center font-black tracking-wider text-amber-300 text-xs sm:text-sm drop-shadow-md">
              "WHEN THE RHETORICAL ANALYSIS CHECKS OUT"
            </div>
            <div className="flex items-center justify-center my-auto">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-ruby-600/20 border border-ruby-500/30 flex items-center justify-center text-ruby-400">
                <FlaskConical className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
            </div>
            <div className="flex items-center justify-between bg-zinc-900/90 backdrop-blur px-2.5 py-1.5 rounded-lg border border-zinc-800 text-[11px]">
              <span className="text-zinc-400 font-mono text-[10px]">00:15.0 / 00:30.0</span>
              <span className="text-ruby-400 font-bold text-[10px]">Auto Subtitles On</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs pt-0.5">
            <span className="text-zinc-400 text-[11px]">Export: <strong className="text-white">HD MP4 / WebM</strong></span>
            <span className="px-3 py-1 rounded-lg bg-ruby-600 text-white font-extrabold text-[11px] shadow">Export Canvas</span>
          </div>
        </div>
      );

    case "slide-resources":
      return (
        <div className="w-full rounded-2xl bg-white dark:bg-zinc-900 border border-amber-200/80 dark:border-amber-900/40 p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="font-extrabold text-xs text-gray-900 dark:text-white">Curriculum Module</span>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              OER Certified
            </span>
          </div>
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/40">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white">Multimodal Rhetoric in STEM & Humanities</h4>
              <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">3 Lesson Plans · Discussion Deck · Grading Rubric</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-150 dark:border-zinc-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <span className="font-semibold text-gray-700 dark:text-gray-300 text-[10px]">Peer-Reviewed</span>
              </div>
              <div className="p-2 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-150 dark:border-zinc-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <span className="font-semibold text-gray-700 dark:text-gray-300 text-[10px]">CC-BY Licensed</span>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 pt-1 flex items-center justify-between border-t border-gray-100 dark:border-zinc-800">
            <span>Author: Dr. Aris Educator</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">Download PDF →</span>
          </div>
        </div>
      );

    case "slide-literacy":
      return (
        <div className="w-full rounded-2xl bg-white dark:bg-zinc-900 border border-rose-200/80 dark:border-rose-900/40 p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span className="font-extrabold text-xs text-gray-900 dark:text-white">Literacy Scorecard</span>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
              6 Dimensions
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-[11px] font-bold text-gray-700 dark:text-gray-300">
              <span>Visual Rhetoric</span>
              <span className="text-rose-600 dark:text-rose-400">92%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-150 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-rose-500 to-ruby-600 w-[92%]" />
            </div>

            <div className="flex justify-between text-[11px] font-bold text-gray-700 dark:text-gray-300 pt-1">
              <span>Subtext Analysis</span>
              <span className="text-rose-600 dark:text-rose-400">88%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-150 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-rose-500 to-ruby-600 w-[88%]" />
            </div>

            <div className="p-2.5 mt-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-800/40 flex items-center justify-between">
              <div>
                <span className="block text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300">Certified Skill Badge</span>
                <span className="text-xs font-black text-gray-900 dark:text-white">Meme Critic (Level 4)</span>
              </div>
              <div className="w-7 h-7 rounded-full bg-ruby-600 text-white flex items-center justify-center font-bold text-xs shadow">
                ✓
              </div>
            </div>
          </div>
        </div>
      );

    case "slide-staffroom":
      return (
        <div className="w-full rounded-2xl bg-white dark:bg-zinc-900 border border-emerald-200/80 dark:border-emerald-900/40 p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-extrabold text-xs text-gray-900 dark:text-white">Educator Staffroom</span>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Community Thread
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/40 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                SJ
              </div>
              <div>
                <span className="block text-xs font-bold text-gray-900 dark:text-white">Prof. Sarah Jenkins</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">High School History Educator</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-snug">
              "Using satire memes in Civics boosted student engagement by 40%. Here is our peer-evaluated lesson template!"
            </p>
            <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 pt-1 font-medium">
              <span>👍 24 Upvotes</span>
              <span>💬 12 Teacher Replies</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">#Pedagogy</span>
            </div>
          </div>
        </div>
      );

    case "slide-library":
    default:
      return (
        <div className="w-full rounded-2xl bg-white dark:bg-zinc-900 border border-indigo-200/80 dark:border-indigo-900/40 p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="font-extrabold text-xs text-gray-900 dark:text-white">Curriculum Meme Library</span>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
              Vetted Repository
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-800/40 space-y-1">
              <span className="inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-200/80 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200">
                #Biology
              </span>
              <p className="text-[11px] font-bold text-gray-900 dark:text-white leading-tight">Mitochondria Powerhouse</p>
              <span className="block text-[10px] text-amber-500 font-bold">★ 4.9 (28 Ratings)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-800/40 space-y-1">
              <span className="inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-200/80 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200">
                #Literature
              </span>
              <p className="text-[11px] font-bold text-gray-900 dark:text-white leading-tight">Shakespeare Subtext</p>
              <span className="block text-[10px] text-amber-500 font-bold">★ 4.8 (19 Ratings)</span>
            </div>
          </div>
          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold pt-1 text-center">
            Filter by Subject, Grade & Evaluation Rating →
          </div>
        </div>
      );
  }
};

const Home = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ memes: null, users: null, resources: null });
  const [featuredMemes, setFeaturedMemes] = useState([]);
  const [currentMemeIndex, setCurrentMemeIndex] = useState(0);
  const [heroCards, setHeroCards] = useState([]);
  
  // Slide Carousel State — now managed by FeatureCarousel component
  
  // Card Expansion State for Uncrowded UI (active hovered/expanded card IDs)
  const [expandedCards, setExpandedCards] = useState({});

  const toggleCard = (cardId) => {
    setExpandedCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  // LANDING_SLIDES moved to FeatureCarousel component
  const LANDING_SLIDES_UNUSED = [
    {
      id: "slide-lab",
      tag: "Multi-Format Studio",
      badgeColor: "bg-ruby-100 text-ruby-700 dark:bg-ruby-950/60 dark:text-ruby-300 border-ruby-200 dark:border-ruby-800",
      accentBg: "from-ruby-500/20 via-pink-500/10 to-transparent",
      title: "Meme Lab Creation Studio",
      subtitle: "Multi-Format Editor for Images, GIFs, Video & Audio",
      description: "Empower students and teachers to craft, edit, and remix educational memes. Features automated pedagogical caption generation, custom text overlays, and watermark downloads.",
      btnText: "Open Meme Lab Studio",
      btnLink: "/lab",
      btnIcon: FlaskConical,
      btnColor: "bg-ruby-600 hover:bg-ruby-700 text-white shadow-ruby-500/25",
      statsBadge: "Instant Multi-Media Export"
    },
    {
      id: "slide-resources",
      tag: "Open Educational Resources",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      accentBg: "from-amber-500/20 via-orange-500/10 to-transparent",
      title: "Pedagogical Use Cases & OER",
      subtitle: "Curriculum Modules, Lesson Plans & Academic Research",
      description: "Discover how memes serve as multimodal texts in STEM, Humanities, and Language Learning. Access introductory courses, real classroom case studies, and research-backed guides.",
      btnText: "Explore Educational Resources",
      btnLink: "/resources",
      btnIcon: BookOpenCheck,
      btnColor: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/25",
      statsBadge: "100% Free & Peer-Reviewed"
    },
    {
      id: "slide-literacy",
      tag: "Media Literacy",
      badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
      accentBg: "from-rose-500/20 via-ruby-500/10 to-transparent",
      title: "Meme Critical Literacy Assessment",
      subtitle: "Interactive Test Across 6 Key Media Literacy Dimensions",
      description: "Evaluate visual rhetoric, subtext decoding, satire identification, and bias interrogation skills. Receive immediate analytical feedback and shareable digital literacy certificates.",
      btnText: "Take Literacy Assessment",
      btnLink: "/meme-literacy-test",
      btnIcon: Award,
      btnColor: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/25",
      statsBadge: "Instant Digital Badges"
    },
    {
      id: "slide-staffroom",
      tag: "Educator Community",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      accentBg: "from-emerald-500/20 via-teal-500/10 to-transparent",
      title: "Educator Staffroom Forum",
      subtitle: "Connect, Reflect & Share Classroom Experiences",
      description: "A dedicated collaborative space for educators to exchange lesson reflections, troubleshoot classroom dynamics, and co-create innovative visual teaching strategies.",
      btnText: "Join Staffroom Community",
      btnLink: "/staffroom",
      btnIcon: MessageSquare,
      btnColor: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25",
      statsBadge: "Global Educator Exchange"
    },
    {
      id: "slide-library",
      tag: "Curriculum Repository",
      badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
      accentBg: "from-indigo-500/20 via-purple-500/10 to-transparent",
      title: "Peer-Rated Meme Library",
      subtitle: "Classroom-Ready Memes Categorized by Subject & Grade",
      description: "Browse thousands of teacher-vetted memes across Mathematics, Biology, Physics, History, and Literature. Filter by age appropriateness and pedagogical evaluation scores.",
      btnText: "Browse Meme Library",
      btnLink: "/library",
      btnIcon: BookOpen,
      btnColor: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25",
      statsBadge: "Teacher Evaluated & Tagged"
    }
  ];

  // Auto-rotate now handled inside FeatureCarousel component

  // Fetch real counts & top memes from Firestore
  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async () => {
      let memesCount = 0;
      let usersCount = 0;
      let resourcesCount = 0;

      try {
        const memesSnap = await getCountFromServer(query(collection(db, "memes"), where("visibility", "==", "public")));
        memesCount = memesSnap.data().count;
      } catch (e) {
        console.warn("Memes count note:", e.message);
      }

      try {
        const usersSnap = await getCountFromServer(collection(db, "users"));
        usersCount = usersSnap.data().count;
      } catch (e) {
        console.warn("Users count note:", e.message);
      }

      try {
        const resourcesSnap = await getCountFromServer(collection(db, "resources"));
        resourcesCount = resourcesSnap.data().count;
      } catch (e) {
        console.warn("Resources count note:", e.message);
      }

      if (isMounted) {
        setStats({
          memes: memesCount,
          users: usersCount,
          resources: resourcesCount,
        });
      }

      try {
        const memesQuery = query(
          collection(db, "memes"),
          where("visibility", "==", "public"),
          limit(6)
        );
        const memesDocs = await getDocs(memesQuery);
        if (isMounted && !memesDocs.empty) {
          const list = memesDocs.docs.map(d => ({ id: d.id, ...d.data() }));
          setFeaturedMemes(list);
        }
      } catch (memeErr) {
        console.warn("Featured memes fetch note:", memeErr);
      }

      try {
        const cardsSnap = await getDocs(
          query(collection(db, "heroCards"), where("active", "==", true), orderBy("order", "asc"))
        );
        if (isMounted && !cardsSnap.empty) {
          setHeroCards(cardsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (cardErr) {
        console.warn("Hero cards fetch note:", cardErr);
      }
    };

    fetchHomeData();
    return () => {
      isMounted = false;
    };
  }, []);

  const fmt = (n) => (n === null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  return (
    <div className="relative overflow-visible min-h-screen flex flex-col justify-start space-y-12 sm:space-y-20">

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 1: FULL-BLEED CINEMATIC FEATURE DISCOVERY CAROUSEL
          Hero branding (badge, title, tagline) + slide content live inside FeatureCarousel.
          Rendered as the FIRST child (before the decorative glow blobs below) so it
          doesn't pick up a top margin from this container's `space-y-*` utility —
          the hero needs to sit flush at y=0 for the floating Navbar header to merge
          into it with no gap.
          ────────────────────────────────────────────────────────────────────────── */}
      <FeatureCarousel />

      {/* Background Ruby Glow Lighting Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div
          className="absolute -top-[5%] left-[10%] w-[320px] sm:w-[550px] h-[320px] sm:h-[550px] rounded-full bg-ruby-500/20 dark:bg-ruby-600/25 blur-[90px] mix-blend-multiply dark:mix-blend-screen animate-pulse"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute top-[30%] right-[5%] w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full bg-amber-500/15 dark:bg-amber-600/20 blur-[90px] mix-blend-multiply dark:mix-blend-screen animate-pulse"
          style={{ animationDuration: "7s" }}
        />
        <div
          className="absolute top-[65%] left-[5%] w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] rounded-full bg-indigo-500/15 dark:bg-indigo-600/20 blur-[80px] mix-blend-multiply dark:mix-blend-screen animate-pulse"
          style={{ animationDuration: "10s" }}
        />
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 2: LIVE STATS BAR (Clean & Compact)
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md p-6 rounded-2xl border border-gray-200/60 dark:border-zinc-800/60 shadow-lg text-center">
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-black text-ruby-600 dark:text-ruby-400 tabular-nums">
              {fmt(stats.memes)}
            </div>
            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Peer-Rated Memes
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-black text-ruby-600 dark:text-ruby-400 tabular-nums">
              {fmt(stats.users)}
            </div>
            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Active Members
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-black text-ruby-600 dark:text-ruby-400 tabular-nums">
              {fmt(stats.resources)}
            </div>
            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              OER Resources
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-black text-ruby-600 dark:text-ruby-400">
              OER
            </div>
            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Remix & Share Freely
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 3: YOUR JOURNEY IN MEMECLASSROOM (simple linear step panel)
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto w-full px-4 pt-6 pb-10 space-y-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/60 dark:bg-purple-950/70 border border-purple-500/40 text-purple-300 text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(168,85,247,0.25)]">
            <span>How to Get Started</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-gray-900 dark:text-white">
            Your Journey in <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-ruby-400 bg-clip-text text-transparent">MemeClassroom</span>
          </h2>

          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 font-medium max-w-xl mx-auto leading-relaxed">
            From understanding the pedagogical theory to bringing practice into class and reflecting together.
          </p>
        </div>

        {/* Attached step columns (was stacked rows) */}
        <div className="max-w-5xl mx-auto rounded-3xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-gray-200 dark:border-zinc-800 shadow-lg overflow-hidden divide-y divide-gray-200 dark:divide-zinc-800 md:divide-y-0 md:divide-x md:grid md:grid-cols-3">
          {[
            {
              number: "Step 1",
              title: "Start with Resources",
              description: "Explore real classroom use cases, and read research papers and articles to build your pedagogical grounding.",
              color: "text-purple-500 dark:text-purple-400",
              links: [{ label: "Explore Resources", to: "/resources" }],
            },
            {
              number: "Step 2",
              title: "Explore Activities & Create",
              description: "Incorporate memes in your classroom, find examples in the Library & create memes in Lab.",
              color: "text-blue-500 dark:text-blue-400",
              links: [
                { label: "Library", to: "/library" },
                { label: "Lab", to: "/lab" },
              ],
            },
            {
              number: "Step 3",
              title: "Share, Reflect & Contribute",
              description: "Share your experiences in the staffroom and contribute resources.",
              color: "text-teal-500 dark:text-teal-400",
              links: [
                { label: "Staffroom", to: "/staffroom" },
                { label: "Contribute", to: "/resources" },
              ],
            },
          ].map((step) => (
            <div
              key={step.number}
              className="group flex flex-col gap-4 p-5 sm:p-6 hover:bg-purple-50/60 dark:hover:bg-purple-950/20 transition-colors"
            >
              <div className="flex items-center gap-4 sm:gap-5">
                <span className={`shrink-0 text-xl sm:text-2xl font-black tracking-tight ${step.color}`}>
                  {step.number}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-black text-gray-900 dark:text-white leading-snug mb-1">
                  {step.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                  {step.description}
                </p>
              </div>
              <div className="flex items-center gap-4 mt-auto pt-1">
                {step.links.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="group/link inline-flex items-center gap-1 text-xs sm:text-sm font-black text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {l.label}
                    <ArrowRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover/link:translate-x-1 group-hover/link:text-gray-700 dark:group-hover/link:text-gray-200 transition-all" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 4: CORE SPACES (Spaces to Learn, Create & Connect)
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto w-full px-4 py-6 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/60 dark:bg-purple-950/70 border border-purple-500/40 text-purple-300 text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(168,85,247,0.2)]">
            <span>Core Spaces</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
            Spaces to Learn, Create & Connect
          </h2>

          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium max-w-xl mx-auto">
            Dedicated spaces designed to support each stage of your pedagogical journey.
          </p>
        </div>

        {/* Attached Core Spaces columns (matches Journey section styling) */}
        <div className="max-w-6xl mx-auto rounded-3xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-gray-200 dark:border-zinc-800 shadow-lg overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 divide-y divide-x divide-gray-200 dark:divide-zinc-800">
          {[
            {
              badge: "Getting Started",
              title: "Resources",
              description: "Beginner course, classroom use cases, and curated articles. The pedagogical starting point of MemeClassroom. Explore use cases, articles, papers, meme stories, other tools and many more.",
              color: "text-amber-500 dark:text-amber-400",
              action: "Explore Resources",
              to: "/resources",
            },
            {
              badge: "Repository",
              title: "Meme Library",
              description: "Explore peer-rated memes organized by subject and grade level to find classroom-ready examples.",
              color: "text-indigo-500 dark:text-indigo-400",
              action: "Browse Memes",
              to: "/library",
            },
            {
              badge: "Creation Studio",
              title: "Meme Lab",
              description: "Multi-format editor for images, GIFs, video, and audio. Remix templates and generate educational memes.",
              color: "text-ruby-500 dark:text-ruby-400",
              action: "Open Studio",
              to: "/lab",
            },
            {
              badge: "Community",
              title: "Staffroom",
              description: "Exchange classroom experiences, reflect on pedagogical discussions, and collaborate with educators.",
              color: "text-emerald-500 dark:text-emerald-400",
              action: "Join Discussion",
              to: "/staffroom",
            },
            {
              badge: "Media Feed",
              title: "Newspaper",
              description: "Browse a curated feed of real meme and media examples — track viral moments and see satire and misinformation side by side.",
              color: "text-sky-500 dark:text-sky-400",
              action: "Browse Newspaper",
              to: "/newspaper",
            },
            {
              badge: "Skill Assessment",
              title: "Literacy Test",
              description: "Evaluate meme decoding and critical analysis skills with instant feedback.",
              color: "text-rose-500 dark:text-rose-400",
              action: "Take Test",
              to: "/meme-literacy-test",
            },
          ].map((space) => (
            <Link
              key={space.to}
              to={space.to}
              className="group flex flex-col gap-3 p-5 sm:p-6 hover:bg-purple-50/60 dark:hover:bg-purple-950/20 transition-colors"
            >
              <span className={`inline-flex w-fit text-[11px] font-black uppercase tracking-widest ${space.color}`}>
                {space.badge}
              </span>
              <h3 className="text-base font-black text-gray-900 dark:text-white leading-snug">
                {space.title}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed flex-1">
                {space.description}
              </p>
              <span className={`inline-flex items-center gap-1 text-xs sm:text-sm font-black ${space.color} mt-1`}>
                {space.action}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 4: MEME LITERACY ASSESSMENT BANNER
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <MemeLiteracyBanner />
      </section>

    </div>
  );
};

export default Home;
