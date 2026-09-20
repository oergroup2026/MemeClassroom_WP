import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { BrainCircuit, Award, ShieldCheck, ArrowRight } from "lucide-react";

const MemeLiteracyBanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTests, setActiveTests] = useState([]);
  const [bestScore, setBestScore] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "literacy_tests"), where("is_active", "==", true));
    const unsub = onSnapshot(q, (snap) => {
      setActiveTests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) { setBestScore(null); return; }
    const q = query(collection(db, "literacy_test_results"), where("user_id", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const results = snap.docs.map(d => d.data());
      if (results.length === 0) { setBestScore(null); return; }
      const best = results.reduce((max, r) => (r.score_pct || 0) > (max?.score_pct || 0) ? r : max, null);
      setBestScore(best);
    }, () => {});
    return () => unsub();
  }, [user]);

  const singleTest = activeTests.length === 1 ? activeTests[0] : null;
  const ctaLink = singleTest ? `/meme-literacy-test/${singleTest.id}` : "/meme-literacy-test";
  const ctaLabel = singleTest ? "Take Assessment" : `Explore ${activeTests.length || ""} Assessments`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ruby-200/60 dark:border-ruby-800/40 bg-gradient-to-br from-ruby-50/50 via-pink-50/30 to-white dark:from-ruby-950/30 dark:via-zinc-900 dark:to-zinc-900 shadow-lg mb-10">
      {/* Decorative blobs */}
      <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-ruby-300/20 dark:bg-ruby-700/15 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-amber-300/20 dark:bg-amber-700/15 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 p-6 md:p-7">
        {/* Left icon */}
        <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-ruby-600 text-white flex items-center justify-center shadow-lg shadow-ruby-500/25">
          <BrainCircuit className="w-7 h-7" />
        </div>

        {/* Middle content */}
        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
            <span className="text-[11px] font-extrabold text-ruby-700 dark:text-ruby-300 uppercase tracking-wider bg-ruby-100 dark:bg-ruby-950/40 px-2.5 py-0.5 rounded-full border border-ruby-200 dark:border-ruby-800">
              {activeTests.length > 1 ? `${activeTests.length} Assessments Available` : "Free Assessment"}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white mb-1 leading-tight">
            How Meme Literate Are You?
          </h2>
          {bestScore ? (
            <p className="text-xs text-ruby-600 dark:text-ruby-400 font-bold flex items-center justify-center md:justify-start gap-1">
              <Award className="w-4 h-4" />
              <span>Best Score: {bestScore.badge_earned || `${bestScore.score_pct}%`}</span>
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
              {activeTests.length > 0
                ? `${activeTests.length} tests · 6 core dimensions · Earn certified digital badges.`
                : "18 questions · 6 dimensions · Immediate reflection on critical visual reading."}
            </p>
          )}
        </div>

        {/* Right CTA */}
        <div className="flex-shrink-0 text-center">
          <Link
            to={ctaLink}
            className="inline-flex items-center gap-2 bg-ruby-600 hover:bg-ruby-700 text-white font-extrabold px-6 py-3 rounded-xl shadow-md shadow-ruby-500/20 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] text-xs uppercase tracking-wider"
          >
            <span>{ctaLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500 mt-1.5">
            No registration required
          </p>
        </div>
      </div>
    </div>
  );
};

export default MemeLiteracyBanner;
