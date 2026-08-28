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
import {
  Sparkles,
  FlaskConical,
  BookOpen,
  MessageSquare,
  BookOpenCheck,
  BrainCircuit,
  ArrowRight,
  CheckCircle2,
  XCircle,
  GraduationCap,
  Users,
  Compass,
  ChevronDown,
  ChevronUp,
  Sliders,
  Volume2,
  Award,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const Home = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ memes: null, users: null, resources: null });
  const [featuredMemes, setFeaturedMemes] = useState([]);
  const [currentMemeIndex, setCurrentMemeIndex] = useState(0);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [researchIndex, setResearchIndex] = useState(0);
  const [heroCards, setHeroCards] = useState([]);

  // Fallback cards shown when Firestore has no hero cards yet
  const FALLBACK_HERO_CARDS = [
    {
      id: "fallback-1",
      pillar: "pedagogy",
      label: "🎓 Memes as Pedagogy",
      type: "Research",
      title: "Memes as Multimodal Texts in the Classroom",
      snippet: "Students who created subject-specific memes demonstrated significantly deeper recall of key concepts than those who took traditional notes.",
      source: "Journal of Digital Pedagogy, 2021",
      href: "/resources",
      mediaType: "none",
    },
    {
      id: "fallback-2",
      pillar: "literacy",
      label: "🔍 Critical Literacy",
      type: "Finding",
      title: "Memes Spread Faster Than Fact-Checks",
      snippet: "A single misleading meme can reach 10× more people than the correction. Teaching students to interrogate visual rhetoric is now a core literacy skill.",
      source: "MIT Media Lab, 2022",
      href: "/meme-literacy-test",
      mediaType: "none",
    },
  ];

  // Derived: use Firestore cards or fallbacks
  const researchCards = heroCards.length > 0 ? heroCards : FALLBACK_HERO_CARDS;

  // Fetch real counts & top memes from Firestore
  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async () => {
      // 1. Fetch live counts independently
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

      // 2. Fetch top public memes for showcase preview
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

      // 3. Fetch admin-curated hero cards
      try {
        const cardsSnap = await getDocs(
          query(collection(db, "heroCards"), where("active", "==", true), orderBy("order", "asc"))
        );
        if (isMounted && !cardsSnap.empty) {
          setHeroCards(cardsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (cardErr) {
        // Silently fall back to hardcoded defaults
        console.warn("Hero cards fetch note:", cardErr);
      }
    };

    fetchHomeData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-rotate featured meme every 5 seconds if available
  useEffect(() => {
    if (featuredMemes.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentMemeIndex((prev) => (prev + 1) % featuredMemes.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [featuredMemes.length]);

  // Auto-rotate research/hero cards every 4.5 seconds
  useEffect(() => {
    if (researchCards.length === 0) return;
    const interval = setInterval(() => {
      setResearchIndex((prev) => (prev + 1) % researchCards.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [researchCards.length]);

  const fmt = (n) => (n === null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  const activeMeme = featuredMemes[currentMemeIndex] || null;

  return (
    <div className="relative overflow-visible min-h-screen flex flex-col justify-start py-4 space-y-16 sm:space-y-24">
      {/* Background Aura Lighting Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div 
          className="absolute -top-[5%] left-[5%] w-[320px] sm:w-[500px] h-[320px] sm:h-[500px] rounded-full bg-purple-500/20 dark:bg-purple-600/25 blur-[80px] mix-blend-multiply dark:mix-blend-screen animate-pulse" 
          style={{ animationDuration: "8s" }} 
        />
        <div 
          className="absolute top-[25%] right-[2%] w-[350px] sm:w-[550px] h-[350px] sm:h-[550px] rounded-full bg-indigo-500/20 dark:bg-indigo-600/25 blur-[90px] mix-blend-multiply dark:mix-blend-screen animate-pulse" 
          style={{ animationDuration: "7s" }} 
        />
        <div 
          className="absolute top-[60%] left-[8%] w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] rounded-full bg-cyan-400/15 dark:bg-cyan-600/20 blur-[80px] mix-blend-multiply dark:mix-blend-screen animate-pulse" 
          style={{ animationDuration: "10s" }} 
        />
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 1: HERO (Clear Purpose + Live Meme Showcase)
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto w-full px-2 sm:px-4 pt-4 sm:pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Core Value Proposition */}
          <div className="lg:col-span-7 text-center lg:text-left space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-[1.15]">
              Meme<span className="text-purple-600 dark:text-purple-400">Classroom</span>
            </h1>

            <p className="text-lg sm:text-xl font-medium text-purple-700 dark:text-purple-300 leading-snug">
              Memes aren't just internet noise — they're how your students think, communicate, and form opinions.
            </p>

            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
              MemeClassroom helps teachers bring memes into the classroom with confidence — as creative tools, 
              critical discussion starters, and a lens for media literacy. Because if memes shape your students' 
              world, they belong in your curriculum.
            </p>

            {/* CTAs: scroll to homepage sections or navigate to Meme Literacy Test */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-2">
              <a
                href="#get-started"
                onClick={e => { e.preventDefault(); document.getElementById('get-started')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-6 py-3 rounded-xl shadow-md shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] inline-flex items-center gap-2 text-sm cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Where to Start?</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href="#why-memes"
                onClick={e => { e.preventDefault(); document.getElementById('why-memes')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-700/80 font-bold px-6 py-3 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] inline-flex items-center gap-2 text-sm cursor-pointer"
              >
                <BrainCircuit className="w-4 h-4 text-amber-500" />
                <span>Why Memes?</span>
              </a>

              <Link
                to="/meme-literacy-test"
                className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-bold px-6 py-3 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] inline-flex items-center gap-2 text-sm"
              >
                <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Meme Literacy Test</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Research & Insight Panel */}
          <div className="lg:col-span-5 flex justify-center items-start">
            <div className="w-full max-w-sm">
              {/* Panel header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  From the Research
                </span>
                {/* Dot indicators */}
                <div className="flex gap-1.5">
                  {researchCards.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setResearchIndex(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        i === researchIndex
                          ? researchCards[researchIndex].pillar === "pedagogy"
                            ? "bg-purple-500 w-4"
                            : "bg-amber-500 w-4"
                          : "bg-gray-300 dark:bg-zinc-600"
                      }`}
                      aria-label={`Card ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Animated card */}
              <div
                key={researchIndex}
                className={`rounded-2xl border p-5 shadow-lg transition-all duration-500 ${
                  researchCards[researchIndex].pillar === "pedagogy"
                    ? "bg-gradient-to-br from-purple-50 to-indigo-50/60 dark:from-purple-950/40 dark:to-indigo-950/30 border-purple-200/70 dark:border-purple-800/50"
                    : "bg-gradient-to-br from-amber-50 to-orange-50/60 dark:from-amber-950/40 dark:to-orange-950/30 border-amber-200/70 dark:border-amber-800/50"
                } animate-fadeIn`}
                style={{ animation: "fadeSlideIn 0.4s ease" }}
              >
                {/* Pillar tag + type */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    researchCards[researchIndex].pillar === "pedagogy"
                      ? "bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300"
                      : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                  }`}>
                    {researchCards[researchIndex].label}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {researchCards[researchIndex].type}
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white leading-snug mb-2">
                  {researchCards[researchIndex].title}
                </h3>

                {/* Media: image or YouTube embed */}
                {researchCards[researchIndex].mediaType === "image" && researchCards[researchIndex].mediaUrl && (
                  <div className="rounded-xl overflow-hidden mb-3 max-h-40">
                    <img
                      src={researchCards[researchIndex].mediaUrl}
                      alt={researchCards[researchIndex].title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                {researchCards[researchIndex].mediaType === "video" && researchCards[researchIndex].mediaUrl && (() => {
                  const ytMatch = researchCards[researchIndex].mediaUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/);
                  const videoId = ytMatch?.[1];
                  return videoId ? (
                    <div className="rounded-xl overflow-hidden mb-3 aspect-video">
                      <iframe
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title={researchCards[researchIndex].title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    </div>
                  ) : null;
                })()}

                {/* Snippet */}
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
                  &ldquo;{researchCards[researchIndex].snippet}&rdquo;
                </p>

                {/* Source + link */}
                <div className="flex items-center justify-between pt-3 border-t border-black/5 dark:border-white/5">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                    — {researchCards[researchIndex].source}
                  </span>
                  <Link
                    to={researchCards[researchIndex].href}
                    className={`text-[10px] font-bold inline-flex items-center gap-1 hover:underline ${
                      researchCards[researchIndex].pillar === "pedagogy"
                        ? "text-purple-600 dark:text-purple-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    Explore <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Nav arrows */}
              <div className="flex items-center justify-between mt-3 px-1">
                <button
                  onClick={() => setResearchIndex((prev) => (prev - 1 + researchCards.length) % researchCards.length)}
                  className="p-1.5 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shadow-sm transition"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                  {researchIndex + 1} / {researchCards.length}
                </span>
                <button
                  onClick={() => setResearchIndex((prev) => (prev + 1) % researchCards.length)}
                  className="p-1.5 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shadow-sm transition"
                  aria-label="Next"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 2: LIVE STATS BAR
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md p-6 rounded-2xl border border-gray-200/50 dark:border-zinc-800/40 shadow-xl shadow-black/5 dark:shadow-black/20 text-center">
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400 tabular-nums">
              {fmt(stats.memes)}
            </div>
            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Peer-Rated Memes
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400 tabular-nums">
              {fmt(stats.users)}
            </div>
            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Members
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400 tabular-nums">
              {fmt(stats.resources)}
            </div>
            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Resources
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400">
              OER
            </div>
            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Use, Remix, Share Freely
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 3: WHY MEMES IN THE CLASSROOM? (The Pedagogical Core)
          ────────────────────────────────────────────────────────────────────────── */}
      <section id="why-memes" className="max-w-5xl mx-auto w-full px-4 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/40 px-3 py-1 rounded-full">
            Core Dimensions
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Why Memes Belong in the Classroom
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
            Memes are not random jokes — they are multimodal cultural languages with immense pedagogical and critical value.
          </p>
        </div>

        {/* Two-Pillar Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Pillar 1: Memes as Teaching Tools */}
          <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50/50 dark:from-purple-950/30 dark:to-indigo-950/20 border border-purple-200/60 dark:border-purple-800/40 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white text-lg flex-shrink-0">
                  🎓
                </div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Memes as Teaching Tools</h3>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                Memes are multimodal constructions combining image, text, and cultural context. Being familiar and relatable, they lower cognitive load, spark instant engagement, and make abstract concepts concrete.
              </p>
              <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2"><span className="text-purple-500 font-bold">•</span><span>Connect academic concepts to familiar cultural language</span></li>
                <li className="flex items-start gap-2"><span className="text-purple-500 font-bold">•</span><span>Reinforce recall and assess through student meme creation</span></li>
                <li className="flex items-start gap-2"><span className="text-purple-500 font-bold">•</span><span>Lower cognitive barriers for reluctant learners</span></li>
              </ul>
            </div>
            <div className="pt-3 border-t border-purple-200/50 dark:border-purple-800/30">
              <Link
                to="/resources"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
              >
                <BookOpenCheck className="w-3.5 h-3.5" /> Explore classroom use cases <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Pillar 2: Critical Meme Literacy */}
          <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/60 dark:border-amber-800/40 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white text-lg flex-shrink-0">
                  🔍
                </div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Memes as Critical Objects</h3>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                Memes are powerful cultural artifacts that shape social narratives and spread rapidly. The classroom is the space to examine their subtext, decode framing, and question hidden agendas.
              </p>
              <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2"><span className="text-amber-500 font-bold">•</span><span>Identify bias, rhetoric, and intent embedded in meme structures</span></li>
                <li className="flex items-start gap-2"><span className="text-amber-500 font-bold">•</span><span>Distinguish satire from genuine misinformation</span></li>
                <li className="flex items-start gap-2"><span className="text-amber-500 font-bold">•</span><span>Develop lifelong critical media analysis habits</span></li>
              </ul>
            </div>
            <div className="pt-3 border-t border-amber-200/50 dark:border-amber-800/30">
              <Link
                to="/resources"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
              >
                <BrainCircuit className="w-3.5 h-3.5" /> Read articles on meme literacy <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 4: THE ROLE OF MEMECLASSROOM (An Enabler, Not a Walled Garden)
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-full">
              Our Role & Philosophy
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
              An Enabler to Learn, Integrate & Reflect
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
              MemeClassroom is not a one-stop app that limits where you find content. You are free to discover memes and articles anywhere across the internet. This space exists to help you <strong className="text-gray-800 dark:text-zinc-100">learn with, on, and about memes</strong>, bring them into classrooms with pedagogical intent, and openly share experiences and reflections with fellow educators.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Learn With, On & About */}
            <div className="p-6 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-gray-200/70 dark:border-zinc-800/70 shadow-sm space-y-3 hover:border-purple-300 dark:hover:border-purple-700/60 transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200/60 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
                <BookOpenCheck className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
                Learn With, On & About Memes
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Understand memes as multimodal cultural artifacts. Learn how they communicate, why they carry cognitive value, and how to deconstruct their rhetorical framing and hidden agendas.
              </p>
            </div>

            {/* Card 2: Pedagogical Scaffolding */}
            <div className="p-6 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-gray-200/70 dark:border-zinc-800/70 shadow-sm space-y-3 hover:border-indigo-300 dark:hover:border-indigo-700/60 transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
                Pedagogical Integration
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Ground your meme usage in real classroom pedagogy. Access beginner courses, real-world use cases, activity guides, and research articles that make abstract concepts accessible and engaging.
              </p>
            </div>

            {/* Card 3: Sharing & Reflecting */}
            <div className="p-6 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-gray-200/70 dark:border-zinc-800/70 shadow-sm space-y-3 hover:border-amber-300 dark:hover:border-amber-700/60 transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
                Share Experiences & Reflect
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Connect with educators to exchange what worked in class, reflect on student discussions, remix templates in the Lab, and contribute insights back to a collaborative community.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 5: HOW IT WORKS (3-Step Visual Journey)
          ────────────────────────────────────────────────────────────────────────── */}
      <section id="get-started" className="max-w-5xl mx-auto w-full px-4 scroll-mt-20">
        <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-full">
            How to Get Started
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Your Journey in MemeClassroom
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            From understanding the pedagogical theory to bringing practice into class and reflecting together.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-sm relative flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-black text-sm flex items-center justify-center">
                1
              </div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                Learn the Foundations
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Start with <Link to="/resources" className="font-bold text-purple-600 dark:text-purple-400 hover:underline">Resources</Link> — take the beginner course, explore real classroom use cases, and read research papers and articles to build your pedagogical grounding.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80">
              <Link to="/resources" className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1">
                Explore Resources <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-sm relative flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-sm flex items-center justify-center">
                2
              </div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                Explore Activities & Create
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Explore classroom activities to incorporate memes, find curriculum examples in the <Link to="/library" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Library</Link>, or create and edit original memes in the <Link to="/lab" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Meme Lab</Link>.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center gap-3">
              <Link to="/library" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1">
                Library <ArrowRight className="w-3 h-3" />
              </Link>
              <Link to="/lab" className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1">
                Lab <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-sm relative flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-black text-sm flex items-center justify-center">
                3
              </div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                Share, Reflect & Contribute
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Discuss classroom reflections and share memes in the <Link to="/staffroom" className="font-bold text-teal-600 dark:text-teal-400 hover:underline">Staffroom</Link>, and contribute your own writeups and reflections back to the <Link to="/resources" className="font-bold text-teal-600 dark:text-teal-400 hover:underline">Resources</Link> page.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center gap-3">
              <Link to="/staffroom" className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1">
                Staffroom <ArrowRight className="w-3 h-3" />
              </Link>
              <Link to="/resources" className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1">
                Contribute <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 6: CORE SPACES
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto w-full px-4 space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/40 px-3 py-1 rounded-full">
            Core Spaces
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Spaces to Learn, Create & Connect
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Dedicated spaces designed to support each stage of your pedagogical journey.
          </p>
        </div>

        {/* 1. Primary Feature: Resources (Full Width Spotlight) */}
        <Link
          to="/resources"
          className="group block p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-amber-100/30 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-zinc-900/40 border-2 border-amber-300/80 dark:border-amber-700/60 shadow-xs hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500 text-white w-fit shadow-md shadow-amber-500/20">
                  <BookOpenCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      Resources
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-200 bg-amber-200/80 dark:bg-amber-900/60 px-2.5 py-0.5 rounded-full">
                      ★ Core Foundation
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    Beginner course, classroom use cases, and curated articles
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-w-3xl">
                The pedagogical starting point of MemeClassroom. Take the introductory course, explore real-world use cases of memes across subjects, and read peer-reviewed research on multimodal literacy.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300 bg-white/80 dark:bg-zinc-800/80 border border-amber-300/60 dark:border-amber-700/60 px-4 py-2.5 rounded-xl shadow-xs self-start md:self-center flex-shrink-0 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-all duration-200">
              <span>Explore Resources & Use Cases</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>

        {/* 2. Balanced 4-Card Grid for Supporting Spaces */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Card 1: Meme Lab */}
          <Link
            to="/lab"
            className="group p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-gray-200/70 dark:border-zinc-800/70 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-400/60 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 w-fit">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full">
                  Creation Studio
                </span>
              </div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                Meme Lab
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Multi-format editor for images, GIFs, video, and audio. Remix templates and generate pedagogical captions.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400">
              <span>Open Studio</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Meme Library */}
          <Link
            to="/library"
            className="group p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-gray-200/70 dark:border-zinc-800/70 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-400/60 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 w-fit">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
                  Repository
                </span>
              </div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Meme Library
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Explore peer-rated memes organized by subject and grade level to find classroom-ready examples.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Browse Memes</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Meme Literacy Test */}
          <Link
            to="/meme-literacy-test"
            className="group p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-gray-200/70 dark:border-zinc-800/70 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-400/60 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 w-fit">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-pink-600 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/40 px-2 py-0.5 rounded-full">
                  Skill Assessment
                </span>
              </div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                Literacy Test
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Evaluate media decoding and critical analysis skills across 6 key dimensions with instant feedback.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-bold text-pink-600 dark:text-pink-400">
              <span>Take Test</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 4: Staffroom */}
          <Link
            to="/staffroom"
            className="group p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-gray-200/70 dark:border-zinc-800/70 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400/60 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 w-fit">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-teal-600 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded-full">
                  Community
                </span>
              </div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                Staffroom
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Exchange classroom experiences, reflect on pedagogical discussions, and collaborate with educators.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-bold text-teal-600 dark:text-teal-400">
              <span>Join Discussion</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

        </div>
      </section>


      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 8: MEME LITERACY TEST BANNER
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto w-full px-4 pb-8">
        <MemeLiteracyBanner />
      </section>

    </div>
  );
};

export default Home;
