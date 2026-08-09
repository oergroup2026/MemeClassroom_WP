import React, { useState, useRef } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Quote,
  Eye,
  EyeOff,
  HelpCircle
} from "lucide-react";
import FormattedText from "./FormattedText";

/**
 * RichTextArea Component
 * 
 * Drop-in replacement for multi-line text description textareas.
 * Provides basic rich text editing tools:
 * - Bullet list (adds/toggles • bullet points)
 * - Numbered list (adds/toggles 1. 2. numbered lists)
 * - Bold (**text**)
 * - Italic (*text*)
 * - Links ([label](url))
 * - Blockquote (> text)
 * - Auto-list continuation on Enter key
 * - Toggle live preview mode
 */
export default function RichTextArea({
  value = "",
  onChange,
  placeholder = "Write a description...",
  rows = 4,
  className = "",
  id,
  name,
  required = false,
  disabled = false,
  maxLength,
  label,
  error,
  showPreviewToggle = true,
  toolbarExtra
}) {
  const textareaRef = useRef(null);
  const [isPreview, setIsPreview] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Helper to update textarea value and dispatch synthetic onChange event
  const updateValue = (newValue, newSelectionStart, newSelectionEnd) => {
    if (onChange) {
      // Create synthetic event
      const event = {
        target: {
          name: name || id || "",
          value: newValue
        }
      };
      onChange(event);
    }

    // Defer restoring selection & focus until DOM updates
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        if (typeof newSelectionStart === "number") {
          textareaRef.current.setSelectionRange(
            newSelectionStart,
            newSelectionEnd ?? newSelectionStart
          );
        }
      }
    }, 0);
  };

  // Extract current selection details from textarea
  const getSelection = () => {
    const el = textareaRef.current;
    if (!el) return { start: 0, end: 0, text: "", fullText: value || "" };
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const fullText = value || "";
    const selectedText = fullText.substring(start, end);
    return { start, end, text: selectedText, fullText };
  };

  // Toggle or apply bullet list (• )
  const handleBulletList = () => {
    const { start, end, text, fullText } = getSelection();
    const before = fullText.substring(0, start);
    const after = fullText.substring(end);

    // Find line boundaries for the selection
    const lineStart = before.lastIndexOf("\n") + 1;
    let lineEnd = after.indexOf("\n");
    if (lineEnd === -1) lineEnd = fullText.length;
    else lineEnd = end + lineEnd;

    const targetChunk = fullText.substring(lineStart, lineEnd);
    const lines = targetChunk.split("\n");

    // Check if all selected lines already have bullets
    const allBulleted = lines.every((line) => /^([•‣◦▪▫⁃\-\*\+])\s*/.test(line.trim()));

    let newChunk;
    if (allBulleted) {
      // Remove bullets
      newChunk = lines
        .map((line) => line.replace(/^([•‣◦▪▫⁃\-\*\+])\s*/, ""))
        .join("\n");
    } else {
      // Add bullets
      newChunk = lines
        .map((line) => {
          const trimmed = line.trimStart();
          const leadingSpaces = line.substring(0, line.length - trimmed.length);
          const cleanLine = trimmed.replace(/^([•‣◦▪▫⁃\-\*\+]\s*|\d+[\.\)]\s*)/, "");
          return `${leadingSpaces}• ${cleanLine}`;
        })
        .join("\n");
    }

    const newFullText = fullText.substring(0, lineStart) + newChunk + fullText.substring(lineEnd);
    const newEnd = lineStart + newChunk.length;
    updateValue(newFullText, lineStart, newEnd);
  };

  // Toggle or apply numbered list (1. 2. 3.)
  const handleNumberedList = () => {
    const { start, end, fullText } = getSelection();
    const before = fullText.substring(0, start);
    const after = fullText.substring(end);

    const lineStart = before.lastIndexOf("\n") + 1;
    let lineEnd = after.indexOf("\n");
    if (lineEnd === -1) lineEnd = fullText.length;
    else lineEnd = end + lineEnd;

    const targetChunk = fullText.substring(lineStart, lineEnd);
    const lines = targetChunk.split("\n");

    const allNumbered = lines.every((line) => /^\d+[\.\)]\s*/.test(line.trim()));

    let newChunk;
    if (allNumbered) {
      newChunk = lines.map((line) => line.replace(/^\d+[\.\)]\s*/, "")).join("\n");
    } else {
      newChunk = lines
        .map((line, idx) => {
          const trimmed = line.trimStart();
          const leadingSpaces = line.substring(0, line.length - trimmed.length);
          const cleanLine = trimmed.replace(/^([•‣◦▪▫⁃\-\*\+]\s*|\d+[\.\)]\s*)/, "");
          return `${leadingSpaces}${idx + 1}. ${cleanLine}`;
        })
        .join("\n");
    }

    const newFullText = fullText.substring(0, lineStart) + newChunk + fullText.substring(lineEnd);
    const newEnd = lineStart + newChunk.length;
    updateValue(newFullText, lineStart, newEnd);
  };

  // Apply bold (**text**)
  const handleBold = () => {
    const { start, end, text, fullText } = getSelection();
    const before = fullText.substring(0, start);
    const after = fullText.substring(end);

    if (text) {
      // Toggle bold if already wrapped
      if (text.startsWith("**") && text.endsWith("**") && text.length >= 4) {
        const unwrapped = text.slice(2, -2);
        updateValue(before + unwrapped + after, start, start + unwrapped.length);
      } else {
        const wrapped = `**${text}**`;
        updateValue(before + wrapped + after, start, start + wrapped.length);
      }
    } else {
      const placeholderText = "bold text";
      const wrapped = `**${placeholderText}**`;
      updateValue(before + wrapped + after, start + 2, start + 2 + placeholderText.length);
    }
  };

  // Apply italic (*text*)
  const handleItalic = () => {
    const { start, end, text, fullText } = getSelection();
    const before = fullText.substring(0, start);
    const after = fullText.substring(end);

    if (text) {
      if (text.startsWith("*") && text.endsWith("*") && !text.startsWith("**") && text.length >= 2) {
        const unwrapped = text.slice(1, -1);
        updateValue(before + unwrapped + after, start, start + unwrapped.length);
      } else {
        const wrapped = `*${text}*`;
        updateValue(before + wrapped + after, start, start + wrapped.length);
      }
    } else {
      const placeholderText = "italic text";
      const wrapped = `*${placeholderText}*`;
      updateValue(before + wrapped + after, start + 1, start + 1 + placeholderText.length);
    }
  };

  // Insert link ([label](url))
  const handleLink = () => {
    const { start, end, text, fullText } = getSelection();
    const before = fullText.substring(0, start);
    const after = fullText.substring(end);

    const userUrl = window.prompt("Enter link URL (e.g., https://example.com):", "https://");
    if (!userUrl || userUrl.trim() === "" || userUrl === "https://") return;

    const cleanUrl = userUrl.trim();
    const linkLabel = text || "link title";
    const formatted = `[${linkLabel}](${cleanUrl})`;

    updateValue(before + formatted + after, start + 1, start + 1 + linkLabel.length);
  };

  // Apply quote (> text)
  const handleQuote = () => {
    const { start, end, fullText } = getSelection();
    const before = fullText.substring(0, start);
    const after = fullText.substring(end);

    const lineStart = before.lastIndexOf("\n") + 1;
    let lineEnd = after.indexOf("\n");
    if (lineEnd === -1) lineEnd = fullText.length;
    else lineEnd = end + lineEnd;

    const targetChunk = fullText.substring(lineStart, lineEnd);
    const lines = targetChunk.split("\n");

    const allQuoted = lines.every((line) => line.trim().startsWith(">"));

    let newChunk;
    if (allQuoted) {
      newChunk = lines.map((line) => line.replace(/^>\s?/, "")).join("\n");
    } else {
      newChunk = lines.map((line) => `> ${line.replace(/^>\s?/, "")}`).join("\n");
    }

    const newFullText = fullText.substring(0, lineStart) + newChunk + fullText.substring(lineEnd);
    updateValue(newFullText, lineStart, lineStart + newChunk.length);
  };

  // Handle keypresses like Enter (auto bullet continuation) and Ctrl+B / Ctrl+I
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;

      // Only handle if no range is selected
      if (start === end) {
        const fullText = value || "";
        const beforeCursor = fullText.substring(0, start);
        const lastNewline = beforeCursor.lastIndexOf("\n");
        const currentLine = beforeCursor.substring(lastNewline + 1);

        // Check bullet line
        const bulletMatch = currentLine.match(/^([•‣◦▪▫⁃\-\*\+])\s*(.*)/);
        if (bulletMatch) {
          e.preventDefault();
          const bulletSymbol = bulletMatch[1];
          const content = bulletMatch[2];

          if (content.trim() === "") {
            // Empty bullet line -> clear bullet and end list
            const lineStart = lastNewline + 1;
            const newFullText = fullText.substring(0, lineStart) + fullText.substring(start);
            updateValue(newFullText, lineStart, lineStart);
          } else {
            // Non-empty bullet line -> add new bullet on next line
            const afterCursor = fullText.substring(start);
            const insertStr = `\n${bulletSymbol} `;
            const newFullText = beforeCursor + insertStr + afterCursor;
            const newPos = start + insertStr.length;
            updateValue(newFullText, newPos, newPos);
          }
          return;
        }

        // Check numbered list line
        const numberMatch = currentLine.match(/^(\d+)[\.\)]\s*(.*)/);
        if (numberMatch) {
          e.preventDefault();
          const num = parseInt(numberMatch[1], 10);
          const content = numberMatch[2];

          if (content.trim() === "") {
            // Empty numbered line -> clear line and end list
            const lineStart = lastNewline + 1;
            const newFullText = fullText.substring(0, lineStart) + fullText.substring(start);
            updateValue(newFullText, lineStart, lineStart);
          } else {
            const afterCursor = fullText.substring(start);
            const insertStr = `\n${num + 1}. `;
            const newFullText = beforeCursor + insertStr + afterCursor;
            const newPos = start + insertStr.length;
            updateValue(newFullText, newPos, newPos);
          }
          return;
        }
      }
    }

    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        handleBold();
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        handleItalic();
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        handleLink();
      }
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
          {label}
        </label>
      )}

      <div
        className={`rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent transition-all overflow-hidden ${
          disabled ? "opacity-60 cursor-not-allowed bg-gray-50 dark:bg-zinc-900" : ""
        } ${error ? "border-red-500 ring-1 ring-red-500" : ""}`}
      >
        {/* Toolbar Header */}
        <div className="flex flex-wrap items-center justify-between gap-1 px-2.5 py-1.5 bg-gray-50 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-700/80 select-none">
          <div className="flex items-center gap-1 flex-wrap">
            {/* Bullet List */}
            <button
              type="button"
              onClick={handleBulletList}
              disabled={disabled || isPreview}
              title="Bullet Points (• List)"
              aria-label="Bullet Points"
              className="p-1.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:text-purple-600 dark:hover:text-purple-400 transition-colors disabled:opacity-40"
            >
              <List size={16} />
            </button>

            {/* Numbered List */}
            <button
              type="button"
              onClick={handleNumberedList}
              disabled={disabled || isPreview}
              title="Numbered List (1. 2. 3.)"
              aria-label="Numbered List"
              className="p-1.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:text-purple-600 dark:hover:text-purple-400 transition-colors disabled:opacity-40"
            >
              <ListOrdered size={16} />
            </button>

            <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700 mx-0.5" />

            {/* Bold */}
            <button
              type="button"
              onClick={handleBold}
              disabled={disabled || isPreview}
              title="Bold (**text**) [Ctrl+B]"
              aria-label="Bold"
              className="p-1.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:text-purple-600 dark:hover:text-purple-400 transition-colors disabled:opacity-40"
            >
              <Bold size={16} />
            </button>

            {/* Italic */}
            <button
              type="button"
              onClick={handleItalic}
              disabled={disabled || isPreview}
              title="Italic (*text*) [Ctrl+I]"
              aria-label="Italic"
              className="p-1.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:text-purple-600 dark:hover:text-purple-400 transition-colors disabled:opacity-40"
            >
              <Italic size={16} />
            </button>

            {/* Link */}
            <button
              type="button"
              onClick={handleLink}
              disabled={disabled || isPreview}
              title="Insert Link ([text](url)) [Ctrl+K]"
              aria-label="Insert Link"
              className="p-1.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:text-purple-600 dark:hover:text-purple-400 transition-colors disabled:opacity-40"
            >
              <LinkIcon size={16} />
            </button>

            {/* Quote */}
            <button
              type="button"
              onClick={handleQuote}
              disabled={disabled || isPreview}
              title="Blockquote (> text)"
              aria-label="Blockquote"
              className="p-1.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:text-purple-600 dark:hover:text-purple-400 transition-colors disabled:opacity-40"
            >
              <Quote size={16} />
            </button>

            {toolbarExtra}
          </div>

          <div className="flex items-center gap-1">
            {/* Formatting Help button */}
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              title="Formatting Shortcuts & Info"
              className={`p-1.5 rounded-lg transition-colors ${
                showHelp
                  ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              <HelpCircle size={15} />
            </button>

            {/* Preview Toggle button */}
            {showPreviewToggle && (
              <button
                type="button"
                onClick={() => setIsPreview(!isPreview)}
                title={isPreview ? "Switch to Edit Mode" : "Switch to Preview Mode"}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isPreview
                    ? "bg-purple-600 text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                }`}
              >
                {isPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{isPreview ? "Edit" : "Preview"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Formatting Help Dropdown / Banner */}
        {showHelp && (
          <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 border-b border-purple-100 dark:border-purple-900/40 text-xs text-purple-900 dark:text-purple-200 space-y-1.5">
            <div className="font-semibold flex items-center justify-between">
              <span>Text Formatting Shortcuts & Guide</span>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">Press Enter for auto-bullets</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div><code className="bg-white/80 dark:bg-zinc-900 px-1 py-0.5 rounded border border-purple-200 dark:border-purple-800">• item</code> Bullet List</div>
              <div><code className="bg-white/80 dark:bg-zinc-900 px-1 py-0.5 rounded border border-purple-200 dark:border-purple-800">1. item</code> Numbered List</div>
              <div><code className="bg-white/80 dark:bg-zinc-900 px-1 py-0.5 rounded border border-purple-200 dark:border-purple-800">**bold**</code> Bold Text</div>
              <div><code className="bg-white/80 dark:bg-zinc-900 px-1 py-0.5 rounded border border-purple-200 dark:border-purple-800">*italic*</code> Italic Text</div>
            </div>
          </div>
        )}

        {/* Textarea or Live Preview */}
        {isPreview ? (
          <div
            style={{ minHeight: `${rows * 1.5}rem` }}
            className="p-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-zinc-800 overflow-y-auto"
          >
            {value && value.trim() ? (
              <FormattedText text={value} />
            ) : (
              <span className="text-gray-400 dark:text-gray-500 italic">Nothing to preview...</span>
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            required={required}
            maxLength={maxLength}
            className="w-full p-3 bg-transparent border-0 focus:ring-0 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm leading-relaxed resize-y"
          />
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}
