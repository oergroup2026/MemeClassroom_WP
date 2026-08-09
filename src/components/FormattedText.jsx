import React from "react";

/**
 * FormattedText component
 * Formats plain text, markdown-like syntax (**bold**, URLs), and copy-pasted bullet points/lists
 * (Unicode bullets like • ‣ ⁃ -, numbered lists 1. 2., etc.) into clean HTML lists and paragraphs.
 */
export default function FormattedText({ text, className = "", inline = false }) {
  if (!text || typeof text !== "string") return null;

  const renderInline = (str) => {
    if (!str) return null;
    const parts = [];
    let lastIndex = 0;

    // Matches **bold**, *italic*, [label](url) markdown links, and raw http(s) URLs
    const regex = /(\*\*(.*?)\*\*)|(\*(.*?)\*)|(\[(.*?)\]\((https?:\/\/[^\s\)]+)\))|(https?:\/\/[^\s]+)/g;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.slice(lastIndex, match.index));
      }
      if (match[2]) {
        // Bold
        parts.push(
          <strong key={`b-${match.index}`} className="font-bold text-gray-900 dark:text-white">
            {match[2]}
          </strong>
        );
      } else if (match[4]) {
        // Italic
        parts.push(
          <em key={`i-${match.index}`} className="italic">
            {match[4]}
          </em>
        );
      } else if (match[6] && match[7]) {
        // Markdown Link [label](url)
        const label = match[6];
        const url = match[7];
        parts.push(
          <a
            key={`ml-${match.index}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 dark:text-purple-400 font-semibold hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {label} ↗
          </a>
        );
      } else if (match[8]) {
        // Raw URL
        const url = match[8];
        parts.push(
          <a
            key={`u-${match.index}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 dark:text-purple-400 font-semibold hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {url} ↗
          </a>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < str.length) {
      parts.push(str.slice(lastIndex));
    }

    return parts.length > 0 ? parts : str;
  };

  const lines = text.split(/\r?\n/);
  const blocks = [];
  let currentList = null;

  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    // Detect bullet list item (bullets: • ‣ ◦ ▪ ▫ ⁃ - * + —)
    const unorderedMatch = trimmed.match(/^([•‣◦▪▫⁃\-\*\+—])\s+(.*)/) || trimmed.match(/^([•‣◦▪▫⁃])\s*(.*)/);
    // Detect numbered list item (1. 2. 1) 2))
    const orderedMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)/);
    // Detect blockquote
    const quoteMatch = trimmed.match(/^>\s?(.*)/);

    if (unorderedMatch) {
      if (currentList && currentList.type !== "ul") flushList();
      if (!currentList) currentList = { type: "ul", items: [] };
      currentList.items.push(unorderedMatch[2] || unorderedMatch[1]);
    } else if (orderedMatch) {
      if (currentList && currentList.type !== "ol") flushList();
      if (!currentList) currentList = { type: "ol", items: [] };
      currentList.items.push(orderedMatch[2]);
    } else if (quoteMatch) {
      flushList();
      blocks.push({ type: "quote", text: quoteMatch[1] });
    } else {
      flushList();
      blocks.push({ type: "p", text: trimmed });
    }
  });

  flushList();

  if (inline) {
    return <span className={className}>{blocks.map((b, i) => (b.type === "p" ? renderInline(b.text) : null))}</span>;
  }

  return (
    <div className={`space-y-2 leading-relaxed ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === "ul") {
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1 my-2">
              {block.items.map((item, i) => (
                <li key={i} className="leading-relaxed">
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={idx} className="list-decimal pl-5 space-y-1 my-2">
              {block.items.map((item, i) => (
                <li key={i} className="leading-relaxed">
                  {renderInline(item)}
                </li>
              ))}
            </ol>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote key={idx} className="border-l-4 border-purple-400 dark:border-purple-600 pl-3 py-1 my-2 italic text-gray-700 dark:text-gray-300 bg-purple-50/50 dark:bg-purple-950/20 rounded-r-lg">
              {renderInline(block.text)}
            </blockquote>
          );
        }
        return (
          <p key={idx} className="whitespace-pre-wrap">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
