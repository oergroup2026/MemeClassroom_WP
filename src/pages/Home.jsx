import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  collection, 
  getCountFromServer, 
  query, 
  where, 
  getDocs, 
  limit 
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

  // Fetch real counts & top memes from Firestore
  useEffect(() => {
    let isMounted = true;

    const fetchHomeData = async () => {
      try {
        // 1. Fetch counts
        const [memesSnap, usersSnap, resourcesSnap] = await Promise.all([
          getCountFromServer(query(collection(db, "memes"), where("visibility", "==", "public"))),
          getCountFromServer(collection(db, "users")),
          getCountFromServer(collection(db, "resources")),
        ]);

        if (isMounted) {
          setStats({
            memes: memesSnap.data().count,
            users: usersSnap.data().count,
            resources: resourcesSnap.data().count,
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
      } catch (err) {
        console.error("Home stats fetch failed", err);
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

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                to="/resources"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-7 py-3 rounded-xl shadow-md shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] inline-flex items-center gap-2 text-sm"
              >
                <BookOpenCheck className="w-4 h-4" />
                <span>Explore Teaching Resources</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/library"
                className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-700/80 font-bold px-7 py-3 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] inline-flex items-center gap-2 text-sm"
              >
                <BookOpen className="w-4 h-4 text-indigo-500" />
                <span>Browse Meme Library</span>
              </Link>

              <Link
                to="/about"
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-300 font-semibold px-2 py-3 transition-colors"
              >
                Learn our philosophy →
              </Link>
            </div>

            {/* Trust highlights */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Research-Backed Pedagogy
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Open Educational Resource
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Safe for Classrooms
              </span>
            </div>
          </div>

          {/* Right Column: Live Community Meme Card Preview */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-sm rounded-2xl border border-gray-200/70 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md p-4 shadow-xl shadow-black/5 dark:shadow-black/25 relative">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
                  <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Community Showcase
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md">
                  {activeMeme?.subject || "Education"}
                </span>
              </div>

              {/* Meme Display Area */}
              <div className="min-h-[240px] max-h-[290px] rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 flex items-center justify-center relative group">
                {activeMeme && (activeMeme.image_url || activeMeme.media_url || activeMeme.url) ? (
                  <img
                    src={activeMeme.image_url || activeMeme.media_url || activeMeme.url}
                    alt={activeMeme.title || "Community Educational Meme"}
                    className="w-full h-full object-contain max-h-[290px]"
                    loading="lazy"
                  />
                ) : (
                  <div className="p-6 text-center space-y-2">
                    <div className="text-4xl">🎭</div>
                    <p className="text-xs font-bold text-gray-700 dark:text-zinc-200">
                      "When you explain a complex formula using a single meme"
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Visual humor + core concept = instant recall
                    </p>
                  </div>
                )}

                {/* Navigation controls if multiple */}
                {featuredMemes.length > 1 && (
                  <div className="absolute inset-x-0 bottom-2 flex justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentMemeIndex((prev) => (prev - 1 + featuredMemes.length) % featuredMemes.length);
                      }}
                      className="p-1 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm"
                      aria-label="Previous meme"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentMemeIndex((prev) => (prev + 1) % featuredMemes.length);
                      }}
                      className="p-1 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm"
                      aria-label="Next meme"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Meme Card Details */}
              <div className="mt-3 flex items-center justify-between text-xs">
                <div className="truncate pr-2">
                  <p className="font-bold text-gray-900 dark:text-zinc-100 truncate">
                    {activeMeme?.title || "Classroom Discussion Starter"}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Grade: {activeMeme?.grade_group || "All Levels"}
                  </p>
                </div>
                <Link
                  to="/library"
                  className="text-purple-600 dark:text-purple-400 font-bold hover:underline whitespace-nowrap flex-shrink-0 text-xs inline-flex items-center gap-1"
                >
                  Explore <ExternalLink className="w-3 h-3" />
                </Link>
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
              Educators & Learners
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400 tabular-nums">
              {fmt(stats.resources)}
            </div>
            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Lesson Plans & Reads
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400">
              Open OER
            </div>
            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Remix & Share Friendly
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 3: WHY MEMES IN THE CLASSROOM? (The Pedagogical Core)
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/40 px-3 py-1 rounded-full">
            Pedagogy & Digital Culture
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Why Memes Belong in the Classroom
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
            MemeClassroom is built around two arguments that can't be separated.
          </p>
        </div>

        {/* Two-Pillar Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Pillar 1: Memes as Teaching Tools */}
          <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50/50 dark:from-purple-950/30 dark:to-indigo-950/20 border border-purple-200/60 dark:border-purple-800/40 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white text-lg flex-shrink-0">
                🎓
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500 dark:text-purple-400">For Teachers</p>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Memes as Teaching Tools</h3>
              </div>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
              Your students already speak in memes. They are multimodal constructions — image, text, and cultural 
              context working together — not random jokes. They carry pedagogical potential that textbooks can't replicate: 
              instant familiarity, emotional resonance, and the ability to make abstract concepts concrete.
            </p>
            <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2"><span className="text-purple-500 font-bold mt-0.5">•</span><span>Use memes to introduce, reinforce, or review lesson concepts</span></li>
              <li className="flex items-start gap-2"><span className="text-purple-500 font-bold mt-0.5">•</span><span>Have students <em>create</em> memes to demonstrate understanding</span></li>
              <li className="flex items-start gap-2"><span className="text-purple-500 font-bold mt-0.5">•</span><span>Lower cognitive load by connecting new ideas to familiar culture</span></li>
            </ul>
            <Link
              to="/resources"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
            >
              <BookOpenCheck className="w-3.5 h-3.5" /> Browse lesson plans & research <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Pillar 2: Critical Meme Literacy */}
          <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/60 dark:border-amber-800/40 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white text-lg flex-shrink-0">
                🔍
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">For Students & Everyone</p>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Memes as Critical Objects</h3>
              </div>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
              Students encounter memes every day — but many memes carry misinformation, reinforce stereotypes, 
              and deliberately spread divisive agendas. Left unexamined, they shape beliefs without students 
              realising it. The classroom is the only space where students can be taught to <strong>stop, decode, 
              and question</strong> what a meme is really saying.
            </p>
            <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2"><span className="text-amber-500 font-bold mt-0.5">•</span><span>Identify bias, framing, and intent hidden in meme structure</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-500 font-bold mt-0.5">•</span><span>Recognise misinformation before it spreads</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-500 font-bold mt-0.5">•</span><span>Build media literacy as a lifelong skill, not a one-off lesson</span></li>
            </ul>
            <Link
              to="/meme-literacy-test"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
            >
              <BrainCircuit className="w-3.5 h-3.5" /> Test your meme literacy <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 4: WHAT MAKES MEMECLASSROOM DIFFERENT? (Comparison Table/Card)
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
              Why Not Just Search Memes on the Web?
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              MemeClassroom isn't a random image dump. It is an educator-curated learning environment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Random Internet */}
            <div className="p-6 rounded-2xl bg-gray-50/80 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-extrabold text-sm">
                <XCircle className="w-5 h-5 text-red-500" />
                <span>Random Internet Memes</span>
              </div>
              <ul className="space-y-3 text-xs text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span>Untagged, no subject or grade filtering</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span>High risk of age-inappropriate content</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span>No lesson plans or pedagogical context</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span>Zero educator feedback or peer ratings</span>
                </li>
              </ul>
            </div>

            {/* MemeClassroom Community */}
            <div className="p-6 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/50 shadow-md space-y-4">
              <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-extrabold text-sm">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span>MemeClassroom Community</span>
              </div>
              <ul className="space-y-3 text-xs text-purple-950 dark:text-purple-200/90 font-medium">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Strictly organized by subject, topic, and grade level</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Peer-rated for accuracy and classroom suitability</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Backed by discussion threads, lesson activities, and research</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Remix-friendly with built-in multi-format Meme Lab</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 5: HOW IT WORKS (3-Step Visual Journey)
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-full">
            How to Get Started
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Your Journey in MemeClassroom
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            From understanding the research to building critical skills in your students.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-sm relative">
            <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-black text-sm flex items-center justify-center mb-4">
              1
            </div>
            <h3 className="font-extrabold text-base mb-1 text-gray-900 dark:text-white">
              Learn the Why
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Start with <strong className="text-gray-700 dark:text-gray-300">Meme Reads</strong> — research papers, lesson plans, classroom 
              activity frameworks, and pedagogical guides curated for educators.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-sm relative">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-sm flex items-center justify-center mb-4">
              2
            </div>
            <h3 className="font-extrabold text-base mb-1 text-gray-900 dark:text-white">
              Bring It to Class
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Find curriculum-aligned memes in the <strong className="text-gray-700 dark:text-gray-300">Library</strong>, or create 
              your own in the <strong className="text-gray-700 dark:text-gray-300">Meme Lab</strong> with AI caption assistance and 
              multi-format editing tools.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-sm relative">
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-black text-sm flex items-center justify-center mb-4">
              3
            </div>
            <h3 className="font-extrabold text-base mb-1 text-gray-900 dark:text-white">
              Build Critical Skills
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Run the <strong className="text-gray-700 dark:text-gray-300">Meme Literacy Test</strong> with your students to develop 
              media decoding skills. Share outcomes and strategies in the <strong className="text-gray-700 dark:text-gray-300">Staffroom</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 6: PLATFORM FEATURES (Bento Grid)
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto w-full px-4 space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/40 px-3 py-1 rounded-full">
            Core Spaces
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Everything You Need in One Place
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            New to meme pedagogy? <strong className="text-purple-600 dark:text-purple-400">Start with Meme Reads.</strong> Then explore the tools that support your practice.
          </p>
        </div>

        {/* Bento Grid — Resources first, then supporting tools */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Card 1: Meme Reads (Resources) — Dominant 2-col, Start Here */}
          <Link
            to="/resources"
            className="md:col-span-2 group p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/20 border-2 border-amber-300/70 dark:border-amber-700/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-amber-400 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-amber-500 text-white w-fit">
                  <BookOpenCheck className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-white bg-amber-500 px-2.5 py-1 rounded-full">
                  ★ Start Here
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Meme Reads
              </h3>
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed max-w-lg">
                The pedagogical core of MemeClassroom. Research papers, structured lesson plans, 
                classroom activity frameworks, meme analysis guides, and curated teaching resources — 
                all grounded in real meme pedagogy. <strong className="text-amber-700 dark:text-amber-400">Start here to understand how and why memes belong in your classroom.</strong>
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
              <span>Explore Lesson Plans & Research</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Meme Literacy Test */}
          <Link
            to="/meme-literacy-test"
            className="group p-6 rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50/40 dark:from-pink-950/30 dark:to-rose-950/20 border border-pink-200/60 dark:border-pink-800/40 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-pink-400/50 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 w-fit">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-pink-600 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/40 px-2.5 py-1 rounded-full">
                  Skill Assessment
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                Meme Literacy Test
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Can your students spot bias, misinformation, and agenda in a meme? 
                Evaluate critical decoding skills across 6 dimensions with AI feedback.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-bold text-pink-600 dark:text-pink-400">
              <span>Take the Test</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Meme Library */}
          <Link
            to="/library"
            className="group p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/50 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 w-fit">
                  <BookOpen className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-full">
                  Repository
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Meme Library
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Peer-reviewed memes organised by subject, topic, and grade. Find classroom-ready 
                content, rate for accuracy, and remix for your own lessons.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Browse Memes</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 4: Meme Lab (Spans 2 cols on md) */}
          <Link
            to="/lab"
            className="md:col-span-2 group p-6 sm:p-7 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-400/50 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 w-fit">
                  <FlaskConical className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-full">
                  Creation Studio
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                Meme Lab
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed max-w-lg">
                Multi-format editor for building image, video, GIF, and audio memes. 
                Draggable text layers, template remixes, undo/redo history, and AI caption suggestions 
                — designed for educators who want to create original classroom content.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400">
              <span>Open Meme Lab</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 5: Staffroom */}
          <Link
            to="/staffroom"
            className="group p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/50 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 w-fit">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                  Community
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Staffroom
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Share classroom trials, ask pedagogy questions, discuss what worked 
                and what didn't, and connect with educators doing the same work.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>Join Discussion</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

        </div>

        {/* Progressive Disclosure: Hidden Power Features Expander */}
        <div className="pt-2">
          <button
            onClick={() => setShowMoreTools(!showMoreTools)}
            className="mx-auto flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40 px-4 py-2 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-950/70 transition-all duration-200"
          >
            <span>{showMoreTools ? "Hide Extra Platform Tools" : "+ Discover Extra Tools & Accessibility"}</span>
            {showMoreTools ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showMoreTools && (
            <div className="mt-4 p-5 rounded-2xl bg-white/40 dark:bg-zinc-900/40 border border-gray-200/50 dark:border-zinc-800/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-white/70 dark:bg-zinc-800/70 border border-gray-100 dark:border-zinc-700/50 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                  <Sliders className="w-4 h-4" /> Universal Design (UDL)
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Dyslexia font, color-blind modes, high contrast, cursor scaling, and reading guides.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/70 dark:bg-zinc-800/70 border border-gray-100 dark:border-zinc-700/50 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-4 h-4" /> AI Pedagogical Helpers
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Gemini-powered meme explanations and classroom caption generation in the Lab.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/70 dark:bg-zinc-800/70 border border-gray-100 dark:border-zinc-700/50 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Volume2 className="w-4 h-4" /> Text-to-Speech (TTS)
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Audio playback with multilingual accent options across resources and discussions.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/70 dark:bg-zinc-800/70 border border-gray-100 dark:border-zinc-700/50 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <Award className="w-4 h-4" /> Badges & XP Rewards
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Earn achievements and recognition for contributing lesson plans and creating memes.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 7: WHO IS THIS FOR? (Persona Roles)
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto w-full px-4">
        <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/40 px-3 py-1 rounded-full">
            Target Audience
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Built for Everyone in the Learning Space
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            A welcoming platform tailored to support your specific role.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Teachers */}
          <div className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
              Teachers & Educators
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Find curriculum-aligned memes, create customized classroom prompts, 
              engage students in discussion, and share pedagogical outcomes.
            </p>
          </div>

          {/* Students */}
          <div className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
              Students & Learners
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Explore subject concepts with humor, create your own memes for school projects, 
              and build critical media literacy to spot fake narratives online.
            </p>
          </div>

          {/* Researchers / Experts */}
          <div className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
              Researchers & Designers
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Publish scholarly articles, share open pedagogical frameworks, and 
              study how digital multimodal texts influence modern learning outcomes.
            </p>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 8: MEME LITERACY TEST BANNER & COMMUNITY PHILOSOPHY
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto w-full px-4 space-y-6">
        <MemeLiteracyBanner />

        {/* Philosophy Pull-Quote Box */}
        <div className="border-l-4 border-purple-600 dark:border-purple-500 bg-purple-50/40 dark:bg-purple-950/20 p-5 rounded-r-2xl text-xs sm:text-sm text-gray-700 dark:text-zinc-300 italic leading-relaxed">
          "Grounded in open pedagogy, MemeClassroom values learner voice, co-creation, and cultural relevance. 
          By connecting everyday internet culture with classroom practice, it supports inclusive, multimodal 
          learning through collaboration rather than passive consumption."
          <span className="block mt-2 not-italic text-[11px] font-bold text-gray-500 dark:text-zinc-400">
            — MemeClassroom Pedagogical Framework
          </span>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 9: FINAL CALL TO ACTION
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto w-full px-4 pb-8 text-center space-y-5">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent pointer-events-none" />
          
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ready to Make Memes Work in Your Classroom?
            </h2>
            <p className="text-xs sm:text-sm text-purple-100 leading-relaxed">
              Whether you're here to teach <em>with</em> memes or teach students to <em>think critically about</em> them — 
              MemeClassroom has the resources, tools, and community to support you.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link
                to="/resources"
                className="bg-white text-purple-700 hover:bg-gray-100 font-bold px-6 py-3 rounded-xl shadow transition text-xs sm:text-sm inline-flex items-center gap-2"
              >
                <BookOpenCheck className="w-4 h-4" />
                Explore Lesson Plans & Research
              </Link>
              <Link
                to="/meme-literacy-test"
                className="bg-purple-800/80 hover:bg-purple-900 text-white border border-purple-400/40 font-bold px-6 py-3 rounded-xl transition text-xs sm:text-sm inline-flex items-center gap-2"
              >
                <BrainCircuit className="w-4 h-4" />
                Test Your Meme Literacy
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
