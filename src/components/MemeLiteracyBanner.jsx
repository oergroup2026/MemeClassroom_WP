import React from "react";
import { Link } from "react-router-dom";

const LEVEL_LADDER = [
  { icon: "🌱", label: "Spectator" },
  { icon: "🔍", label: "Decoder" },
  { icon: "🧐", label: "Analyst" },
  { icon: "🎓", label: "Critic" },
  { icon: "🏛️", label: "Scholar" },
];

const MemeLiteracyBanner = () => (
  <div className="relative overflow-hidden rounded-2xl border border-purple-200/60 dark:border-purple-800/40 bg-gradient-to-br from-purple-50 via-indigo-50 to-white dark:from-purple-950/30 dark:via-indigo-950/20 dark:to-zinc-900/50 shadow-lg shadow-purple-500/5 dark:shadow-black/20 mb-10">
    {/* Decorative blobs */}
    <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-purple-300/20 dark:bg-purple-700/15 blur-2xl pointer-events-none" />
    <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-indigo-300/20 dark:bg-indigo-700/15 blur-2xl pointer-events-none" />

    <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 p-6 md:p-7">
      {/* Left — brain icon */}
      <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/25">
        🧠
      </div>

      {/* Middle — copy */}
      <div className="flex-1 text-center md:text-left">
        <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider bg-purple-100 dark:bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
            Free Assessment
          </span>
        </div>
        <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white mb-1 leading-tight">
          How Meme Literate Are You?
        </h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3 leading-relaxed max-w-lg">
          18 questions · 6 dimensions · Immediate reflection on your critical reading of memes.
        </p>

        {/* Level Ladder */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-1">
          {LEVEL_LADDER.map((l, i) => (
            <React.Fragment key={l.label}>
              <span className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-zinc-300 bg-white/70 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 px-2.5 py-1 rounded-lg">
                {l.icon} {l.label}
              </span>
              {i < LEVEL_LADDER.length - 1 && (
                <span className="text-gray-300 dark:text-zinc-600 text-xs">→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right — CTA */}
      <div className="flex-shrink-0">
        <Link
          to="/meme-literacy-test"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-6 py-3 rounded-xl shadow-md shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] text-sm whitespace-nowrap"
        >
          Take the Test →
        </Link>
        <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1.5 text-center">
          No account required
        </p>
      </div>
    </div>
  </div>
);

export default MemeLiteracyBanner;
