import React, { createContext, useContext, useState, useCallback, useRef } from "react";

// ── Toast Context ─────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

let _idCounter = 0;
const nextId = () => ++_idCounter;

const ICONS = {
  success: "✅",
  error: "⚠️",
  info: "ℹ️",
  warning: "🟡",
};

const BG = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300",
  error:   "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300",
  info:    "bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950/30 dark:border-sky-800 dark:text-sky-300",
  warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300",
};

// ── Provider ──────────────────────────────────────────────────────────────────
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
  }, []);

  const toast = useCallback((message, type = "success", duration = 4000) => {
    const id = nextId();
    setToasts((prev) => {
      // Keep max 3 toasts
      const trimmed = prev.length >= 3 ? prev.slice(1) : prev;
      return [...trimmed, { id, message, type }];
    });
    timersRef.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Fixed stacked container */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            style={{ animation: "slideInRight 0.25s ease-out" }}
            className={`
              pointer-events-auto flex items-start gap-2.5 px-4 py-3
              rounded-xl border shadow-lg text-xs font-semibold
              max-w-xs sm:max-w-sm
              ${BG[t.type] || BG.info}
            `}
          >
            <span className="text-sm flex-shrink-0 mt-px">{ICONS[t.type]}</span>
            <span className="flex-grow leading-relaxed">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Close notification"
              className="flex-shrink-0 ml-1 opacity-60 hover:opacity-100 transition font-bold text-sm leading-none mt-px"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
};

export default ToastProvider;
