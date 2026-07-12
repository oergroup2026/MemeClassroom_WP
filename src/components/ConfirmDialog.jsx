import React, { useEffect, useRef } from "react";

/**
 * ConfirmDialog — accessible replacement for window.confirm()
 *
 * Props:
 *   isOpen      {boolean}   — controls visibility
 *   title       {string}    — dialog heading
 *   message     {string}    — body text
 *   confirmLabel {string}   — confirm button label (default: "Confirm")
 *   cancelLabel  {string}   — cancel button label (default: "Cancel")
 *   variant      {string}   — "danger" | "warning" | "default"
 *   onConfirm   {function}  — called when user confirms
 *   onCancel    {function}  — called when user cancels or presses Escape
 */
const ConfirmDialog = ({
  isOpen,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}) => {
  const cancelBtnRef = useRef(null);
  const confirmBtnRef = useRef(null);

  // Focus the cancel button when the dialog opens (safer default)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => cancelBtnRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape key closes
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const variantIcon = {
    danger:  "🗑️",
    warning: "⚠️",
    default: "❓",
  }[variant] || "❓";

  const confirmButtonClass = {
    danger:  "bg-red-600 hover:bg-red-700 text-white",
    warning: "bg-amber-500 hover:bg-amber-600 text-white",
    default: "bg-purple-600 hover:bg-purple-700 text-white",
  }[variant] || "bg-purple-600 hover:bg-purple-700 text-white";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-body"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4"
        style={{ animation: "scaleIn 0.2s ease-out" }}
      >
        {/* Icon + Title */}
        <div className="flex items-center gap-3">
          <span className="text-2xl" role="img" aria-hidden="true">{variantIcon}</span>
          <h2
            id="confirm-dialog-title"
            className="text-base font-extrabold text-gray-900 dark:text-white leading-tight"
          >
            {title}
          </h2>
        </div>

        {/* Message */}
        <p
          id="confirm-dialog-body"
          className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed"
        >
          {message}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            ref={cancelBtnRef}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition shadow-sm ${confirmButtonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ConfirmDialog;
