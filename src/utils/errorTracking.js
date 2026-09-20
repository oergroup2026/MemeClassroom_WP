// @sentry/react is an optional dependency — stub it out when not installed.
// To enable real error tracking: run `npm install @sentry/react` and restore
// the original import above, then set VITE_SENTRY_DSN in your .env file.
import React from "react";

// No-op until VITE_SENTRY_DSN is set and @sentry/react is installed.
export function initErrorTracking() {
  // No-op stub — Sentry SDK not installed.
}

// Passthrough error boundary that just renders children normally.
export function AppErrorBoundary({ children }) {
  return children;
}
