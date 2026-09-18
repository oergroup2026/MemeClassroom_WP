import * as Sentry from "@sentry/react";

// No-op until VITE_SENTRY_DSN is set (see .env.example) — safe to ship without
// a Sentry account yet. Once a DSN is configured, uncaught exceptions and
// unhandled promise rejections across the app are reported automatically.
export function initErrorTracking() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
  });
}

export const AppErrorBoundary = Sentry.ErrorBoundary;
