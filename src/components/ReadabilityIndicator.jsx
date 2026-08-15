import React from "react";
import { computeReadabilityScore } from "../utils/readabilityUtils";
import { Sparkles, BookOpen } from "lucide-react";

const ReadabilityIndicator = ({ text, className = "" }) => {
  if (!text || text.trim().length < 15) return null;

  const { score, gradeLevel, gradeLabel, badgeColor, wordsCount, readingTimeMinutes } = computeReadabilityScore(text);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50/80 dark:bg-zinc-800/50 border border-gray-200/60 dark:border-zinc-700/50 text-xs ${className}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
        <span className="font-bold text-gray-700 dark:text-zinc-300">Readability:</span>
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${badgeColor}`}>
          {gradeLabel}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
        <span>{wordsCount} words</span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <BookOpen className="w-3 h-3 text-gray-400" /> ~{readingTimeMinutes} min read
        </span>
        <span>·</span>
        <span title="Flesch Reading Ease score (0-100)">Ease: {score}/100</span>
      </div>
    </div>
  );
};

export default ReadabilityIndicator;
