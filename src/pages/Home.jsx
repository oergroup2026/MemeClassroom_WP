import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "../firebase";

// Inline SVG icons for feature cards — no broken alt="not" PNGs
const LabIcon = () => (
  <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.591 2.25l.592.296c.873.437 1.417 1.334 1.417 2.306v.003c0 .734-.555 1.357-1.28 1.42L18 21l-3-1.5M9.75 3.104c-.251.023-.501.05-.75.082M15 3.186c.249.032.499.06.75.082M9 21l3-1.5" />
  </svg>
);

const LibraryIcon = () => (
  <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const StaffroomIcon = () => (
  <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
  </svg>
);

const ResourcesIcon = () => (
  <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const FEATURE_CARDS = [
  {
    to: "/lab",
    Icon: LabIcon,
    title: "Meme Lab",
    desc: "Create image, video, audio or GIF memes with draggable text overlays.",
    protected: true,
  },
  {
    to: "/library",
    Icon: LibraryIcon,
    title: "Meme Library",
    desc: "Explore, rate, like and comment on memes from the community.",
    protected: false,
  },
  {
    to: "/staffroom",
    Icon: StaffroomIcon,
    title: "Staffroom",
    desc: "Discuss classroom experiences, outcomes, and teaching strategies.",
    protected: true,
  },
  {
    to: "/resources",
    Icon: ResourcesIcon,
    title: "Meme Reads",
    desc: "Access research articles, lesson plans, and pedagogical resources.",
    protected: false,
  },
];

const Home = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ memes: null, users: null });

  // Fetch real counts from Firestore
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [memesSnap, usersSnap] = await Promise.all([
          getCountFromServer(query(collection(db, "memes"), where("visibility", "==", "public"))),
          getCountFromServer(collection(db, "users")),
        ]);
        setStats({
          memes: memesSnap.data().count,
          users: usersSnap.data().count,
        });
      } catch (err) {
        // silently ignore — stats stay null (show "—")
        console.error("Stats fetch failed", err);
      }
    };
    fetchStats();
  }, []);

  const fmt = (n) => (n === null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  return (
    <div className="relative overflow-visible min-h-[80vh] flex flex-col justify-center py-6">
      {/* Subtle Background Aura Lightings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        {/* Glow Blob 1: Purple Top Left */}
        <div className="absolute -top-[5%] left-[5%] w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full bg-purple-500/25 dark:bg-purple-600/30 blur-[70px] sm:blur-[90px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }}></div>
        {/* Glow Blob 2: Fuchsia Middle Right */}
        <div className="absolute top-[20%] right-[0%] w-[400px] sm:w-[550px] h-[400px] sm:h-[550px] rounded-full bg-fuchsia-500/20 dark:bg-fuchsia-600/25 blur-[80px] sm:blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '6s' }}></div>
        {/* Glow Blob 3: Cyan Bottom Left */}
        <div className="absolute bottom-[0%] left-[10%] w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] rounded-full bg-cyan-400/20 dark:bg-cyan-600/25 blur-[70px] sm:blur-[90px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }}></div>
      </div>

      <div className="max-w-4xl mx-auto text-center w-full relative z-10">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 text-xs font-bold px-3.5 py-1.5 rounded-lg uppercase tracking-wider">
          Learning + Humour
        </span>
        {/* bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 */}
      </div>

      <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-5 text-gray-900 dark:text-white leading-tight">
        Meme<span className="text-purple-600 dark:text-purple-400">Classroom</span>
      </h1>

      <p className="text-base md:text-lg text-gray-500 dark:text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed">
        Where internet culture meets classroom practice. Teachers, students, and
        subject experts build, share, and learn through memes — grounded in real
        pedagogical theory.
      </p>

      <div className="flex flex-wrap justify-center gap-3 mb-14">
        <Link
          to="/library"
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-7 py-3 rounded-xl shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          Browse Library
        </Link>
        {user ? (
          <Link
            to="/lab"
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold px-7 py-3 rounded-xl shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Open Meme Lab
          </Link>
        ) : (
          <Link
            to="/auth?mode=register"
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold px-7 py-3 rounded-xl shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Join Free →
          </Link>
        )}
      </div>

      {/* ── Live Stats Bar ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mb-12">
        <div>
          <div className="text-3xl font-extrabold text-purple-600 tabular-nums">{fmt(stats.memes)}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Public Memes</div>
        </div>
        <div>
          <div className="text-3xl font-extrabold text-purple-600 tabular-nums">{fmt(stats.users)}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Members</div>
        </div>
        <div>
          <div className="text-3xl font-extrabold text-purple-600">4</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Meme Formats</div>
        </div>
        <div>
          <div className="text-3xl font-extrabold text-purple-600">Open</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1 font-bold">CC Licensed</div>
        </div>
      </div>

      {/* ── Feature Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
        {FEATURE_CARDS.map(({ to, Icon, title, desc, protected: isProtected }) => {
          const dest = isProtected && !user ? "/auth" : to;
          return (
            <Link
              key={to}
              to={dest}
              className="group border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-purple-200 dark:hover:border-purple-900 block"
            >
              <div className="mb-3 transition group-hover:scale-105">
                <Icon />
              </div>
              <h3 className="font-extrabold text-sm mb-1 text-gray-900 dark:text-white">{title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              {isProtected && !user && (
                <span className="mt-3 inline-block text-[10px] text-purple-600 dark:text-purple-400 font-bold">Sign in to access →</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
    </div>
  );
};

export default Home;
