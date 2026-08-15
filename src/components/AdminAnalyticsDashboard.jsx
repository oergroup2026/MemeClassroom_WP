/**
 * src/components/AdminAnalyticsDashboard.jsx
 * 
 * High-aesthetic visual SVG analytics charts for Admin HQ:
 * - Subject Distribution Bar Chart
 * - User Roles Donut Chart
 * - Media Format Breakdown
 * - Literacy Test Pass/Fail & Score Distribution
 */

import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { SUBJECTS } from "../constants/taxonomy";
import { BarChart3, PieChart, Users, CheckCircle, Flame, Layers } from "lucide-react";

export default function AdminAnalyticsDashboard({ users = [], memes = [], resources = [], literacyTests = [] }) {
  const [testResults, setTestResults] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "literacy_test_results"), (snap) => {
      setTestResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, []);

  // 1. Subject distribution
  const subjectCounts = {};
  memes.forEach(m => {
    const s = m.subject || "General";
    subjectCounts[s] = (subjectCounts[s] || 0) + 1;
  });
  const sortedSubjects = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const maxSubjectCount = Math.max(1, ...sortedSubjects.map(s => s[1]));

  // 2. Format distribution
  const formatCounts = { image: 0, video: 0, gif: 0, audio: 0 };
  memes.forEach(m => {
    const f = m.format || "image";
    if (formatCounts[f] !== undefined) formatCounts[f]++;
    else formatCounts.image++;
  });

  // 3. User roles
  const roleCounts = { student: 0, teacher: 0, expert: 0, manager: 0, admin: 0 };
  users.forEach(u => {
    const r = u.role || "student";
    if (roleCounts[r] !== undefined) roleCounts[r]++;
    else roleCounts.student++;
  });
  const totalUsers = Math.max(1, users.length);

  // 4. Test performance stats
  const totalTestsTaken = testResults.length;
  const passedTests = testResults.filter(r => r.passed).length;
  const passRate = totalTestsTaken > 0 ? Math.round((passedTests / totalTestsTaken) * 100) : 0;
  const avgScore = totalTestsTaken > 0
    ? Math.round(testResults.reduce((acc, r) => acc + (r.score_pct || 0), 0) / totalTestsTaken)
    : 0;

  const scoreTiers = {
    mastery: testResults.filter(r => (r.score_pct || 0) >= 80).length,
    proficient: testResults.filter(r => (r.score_pct || 0) >= 60 && (r.score_pct || 0) < 80).length,
    developing: testResults.filter(r => (r.score_pct || 0) < 60).length,
  };

  const SUBJECT_COLORS = [
    "#9333ea", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#6366f1", "#14b8a6"
  ];

  return (
    <div className="space-y-6">
      {/* 4 Hero KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase">
            <span>Total Community</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{users.length}</p>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">● {roleCounts.teacher} Teachers Active</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase">
            <span>Memes Created</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{memes.length}</p>
          <span className="text-[10px] text-purple-600 font-bold mt-1 inline-block">● Across {Object.keys(subjectCounts).length} Subjects</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase">
            <span>Test Completions</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{totalTestsTaken}</p>
          <span className="text-[10px] text-indigo-600 font-bold mt-1 inline-block">● {passRate}% Pass Rate</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase">
            <span>Mean Test Score</span>
            <BarChart3 className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{avgScore}%</p>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">● Benchmark Standard</span>
        </div>
      </div>

      {/* 2-Column Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Subject Distribution */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              Meme Distribution by Academic Subject
            </h4>
            <span className="text-[10px] text-gray-400 font-bold">Top 7</span>
          </div>

          <div className="space-y-3 pt-1">
            {sortedSubjects.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center italic">No meme records found</p>
            ) : (
              sortedSubjects.map(([subject, count], i) => {
                const pct = Math.round((count / maxSubjectCount) * 100);
                const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                return (
                  <div key={subject} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-gray-700 dark:text-zinc-300">
                      <span className="truncate max-w-[200px]">{subject}</span>
                      <span className="text-gray-400 font-mono text-[11px]">{count} memes</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chart 2: Literacy Test Score Tiers & Formats */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              Literacy Test Mastery Tiers
            </h4>
            <span className="text-[10px] text-gray-400 font-bold">{totalTestsTaken} attempts</span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center pt-2">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl">
              <span className="block text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400">Mastery (80–100%)</span>
              <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">{scoreTiers.mastery}</p>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl">
              <span className="block text-[10px] font-extrabold uppercase text-indigo-700 dark:text-indigo-400">Proficient (60–79%)</span>
              <p className="text-2xl font-black text-indigo-800 dark:text-indigo-300 mt-1">{scoreTiers.proficient}</p>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl">
              <span className="block text-[10px] font-extrabold uppercase text-rose-700 dark:text-rose-400">Developing (&lt;60%)</span>
              <p className="text-2xl font-black text-rose-800 dark:text-rose-300 mt-1">{scoreTiers.developing}</p>
            </div>
          </div>

          {/* Media formats bar */}
          <div className="pt-2">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">
              Media Formats Created
            </span>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
                <span className="text-[10px] text-gray-400 block font-bold">Images</span>
                <span className="font-extrabold text-purple-600">{formatCounts.image}</span>
              </div>
              <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
                <span className="text-[10px] text-gray-400 block font-bold">Videos</span>
                <span className="font-extrabold text-blue-600">{formatCounts.video}</span>
              </div>
              <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
                <span className="text-[10px] text-gray-400 block font-bold">GIFs</span>
                <span className="font-extrabold text-amber-600">{formatCounts.gif}</span>
              </div>
              <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
                <span className="text-[10px] text-gray-400 block font-bold">Audio</span>
                <span className="font-extrabold text-emerald-600">{formatCounts.audio}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
