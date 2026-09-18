import React from "react";

// App-wide fallback rendered by the Sentry error boundary in main.jsx when a
// render crash escapes every page-level boundary. Without this, an uncaught
// error anywhere outside the Meme Lab page used to be a blank white screen.
const AppCrashFallback = ({ error, resetError }) => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAFAF9] dark:bg-zinc-950">
    <div className="max-w-md w-full p-8 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center font-bold text-xl">⚠️</div>
      <h2 className="text-xl font-bold text-red-800 dark:text-red-300">Something went wrong</h2>
      <p className="text-sm text-red-600 dark:text-red-400 font-mono bg-red-100/50 dark:bg-red-900/40 p-3 rounded-lg text-left overflow-x-auto">
        {error?.toString() || "Unknown error"}
      </p>
      <div className="flex justify-center gap-3">
        <button
          onClick={resetError}
          className="px-4 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-900/40 transition"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.assign("/")}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition"
        >
          Back to Home
        </button>
      </div>
    </div>
  </div>
);

export default AppCrashFallback;
