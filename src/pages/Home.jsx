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
            <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3.5 py-1.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/50 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Learning + Humour</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-[1.15]">
              Meme<span className="text-purple-600 dark:text-purple-400">Classroom</span>
            </h1>

            <p className="text-lg sm:text-xl font-medium text-purple-700 dark:text-purple-300 leading-snug">
              Where internet culture meets classroom practice.
            </p>

            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
              A shared community space for teachers, students, and educators to create, 
              curate, and critically examine educational memes — grounded in real classroom pedagogy.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                to="/library"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-7 py-3 rounded-xl shadow-md shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] inline-flex items-center gap-2 text-sm"
              >
                <span>Browse Library</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              {user ? (
                <Link
                  to="/lab"
                  className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-700/80 font-bold px-7 py-3 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] inline-flex items-center gap-2 text-sm"
                >
                  <FlaskConical className="w-4 h-4 text-purple-500" />
                  <span>Open Meme Lab</span>
                </Link>
              ) : (
                <Link
                  to="/auth?mode=register"
                  className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-700/80 font-bold px-7 py-3 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] text-sm"
                >
                  Join the Community
                </Link>
              )}

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
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Peer-Rated & Tagged
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
        <div className="bg-gradient-to-br from-purple-50/60 via-indigo-50/30 to-white/50 dark:from-zinc-900/60 dark:via-purple-950/20 dark:to-zinc-900/50 backdrop-blur-md rounded-2xl border border-purple-200/50 dark:border-purple-900/30 p-6 sm:p-10 space-y-8">
          
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/40 px-3 py-1 rounded-full">
              Pedagogy & Digital Culture
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
              Why Memes in Education?
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
              Memes are not just quick entertainment. When used with educational intent, 
              they turn everyday digital habits into powerful classroom learning tools.
            </p>
          </div>

          {/* 4 Core Insights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="p-4 sm:p-5 rounded-xl bg-white/70 dark:bg-zinc-800/60 border border-gray-200/60 dark:border-zinc-700/60 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-sm">
                💬
              </div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Multimodal Meaning
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                A meme combines an image or video with concise text. Both work together 
                to explain concepts faster than paragraphs of text.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-white/70 dark:bg-zinc-800/60 border border-gray-200/60 dark:border-zinc-700/60 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                ⚡
              </div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Instant Attention & Engagement
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Connect difficult lessons with familiar cultural expressions to change 
                classroom mood, lower stress, and start discussions naturally.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-white/70 dark:bg-zinc-800/60 border border-gray-200/60 dark:border-zinc-700/60 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-sm">
                🔍
              </div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Critical Media Literacy
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Memes can spread misinformation online. Teaching students to deconstruct 
                memes builds vital 21st-century critical thinking skills.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-white/70 dark:bg-zinc-800/60 border border-gray-200/60 dark:border-zinc-700/60 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                🤝
              </div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Co-Creation & Learner Voice
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Instead of only consuming knowledge, students create memes to demonstrate 
                their grasp of subject matter in their own authentic voice.
              </p>
            </div>
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
            Simple Workflow
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            How It Works
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            A continuous loop of exploring, creating, and learning together.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-sm relative">
            <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-black text-sm flex items-center justify-center mb-4">
              1
            </div>
            <h3 className="font-extrabold text-base mb-1 text-gray-900 dark:text-white">
              Explore & Discover
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Browse peer-rated memes filtered by your subject and grade group. 
              Read research articles and test your media literacy skills.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-sm relative">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-sm flex items-center justify-center mb-4">
              2
            </div>
            <h3 className="font-extrabold text-base mb-1 text-gray-900 dark:text-white">
              Create in the Lab
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Build image, video, GIF, or audio memes. Use starter templates or let 
              the AI assistant suggest captions if you need inspiration.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-sm relative">
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-black text-sm flex items-center justify-center mb-4">
              3
            </div>
            <h3 className="font-extrabold text-base mb-1 text-gray-900 dark:text-white">
              Reflect & Share
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Publish memes to the public library, discuss teaching strategies in the 
              Staffroom, and share lesson outcomes with other educators.
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
            Dedicated spaces designed for every stage of educational meme work.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Card 1: Meme Lab (Spans 2 cols on md) */}
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
                Multi-format editor for creating image, video, GIF, and audio memes. 
                Features draggable text layers, template remixes, undo/redo history, 
                and AI caption suggestions.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400">
              <span>Open Studio</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Meme Library */}
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
                Discover peer-reviewed memes categorized by subject, topic, and grade level. 
                Rate, like, comment, and remix anytime.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Browse Memes</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Staffroom */}
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
                Professional dialogue space. Share classroom trials, ask pedagogy questions, 
                run quick polls, and react with emoji expressions.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>Join Discussion</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 4: Meme Reads (Resources) */}
          <Link
            to="/resources"
            className="group p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/50 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 w-fit">
                  <BookOpenCheck className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full">
                  Pedagogy Hub
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Meme Reads
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Access lesson plans, research papers with inline PDF viewing, classroom 
                activity matrices, and contribute your own teaching resources.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
              <span>Explore Reads</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 5: Meme Literacy Test */}
          <Link
            to="/meme-literacy-test"
            className="group p-6 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-pink-400/50 flex flex-col justify-between"
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
                Evaluate your critical decoding skills across 6 dimensions. Receive 
                immediate AI feedback on wrong answers and earn literacy badges.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-bold text-pink-600 dark:text-pink-400">
              <span>Take Test</span>
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
          
          <div className="relative z-10 max-w-xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ready to Bring Memes into Your Classroom?
            </h2>
            <p className="text-xs sm:text-sm text-purple-100 leading-relaxed">
              Explore hundreds of peer-reviewed educational memes or start creating your own in the Lab today.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link
                to="/library"
                className="bg-white text-purple-700 hover:bg-gray-100 font-bold px-6 py-3 rounded-xl shadow transition text-xs sm:text-sm"
              >
                Explore the Library →
              </Link>
              {user ? (
                <Link
                  to="/lab"
                  className="bg-purple-800/80 hover:bg-purple-900 text-white border border-purple-400/40 font-bold px-6 py-3 rounded-xl transition text-xs sm:text-sm"
                >
                  Open Meme Lab
                </Link>
              ) : (
                <Link
                  to="/auth?mode=register"
                  className="bg-purple-800/80 hover:bg-purple-900 text-white border border-purple-400/40 font-bold px-6 py-3 rounded-xl transition text-xs sm:text-sm"
                >
                  Join the Community
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
