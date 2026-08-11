import React, { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// ── Worker setup (Multi-tier CDN approach for Vite compatibility) ────────────
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

// ─── Loading Skeleton ────────────────────────────────────────────────────────
const PageSkeleton = ({ width }) => (
  <div
    className="animate-pulse bg-gray-200 dark:bg-zinc-800 rounded-xl"
    style={{ width: width || "100%", height: Math.floor((width || 600) * 1.294) }}
  />
);

// ─── PdfSlideViewer Component ────────────────────────────────────────────────
/**
 * Props:
 *  pdfUrl         {string} Firebase Storage or public URL to the PDF
 *  slidesEmbedUrl {string} Google Slides embed URL
 *  title          {string} Activity title
 */
export default function PdfSlideViewer({ pdfUrl, slidesEmbedUrl, title }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [viewMode, setViewMode] = useState("canvas"); // "canvas" | "native" | "gview"

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState([]); // array of page numbers
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [searching, setSearching] = useState(false);

  const containerRef = useRef(null);
  const pageWrapRef = useRef(null);
  const thumbsRef = useRef(null);
  const [pageWidth, setPageWidth] = useState(650);

  // Sync pageInput when currentPage changes
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Compute render width dynamically
  useEffect(() => {
    const el = pageWrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setPageWidth(Math.min(w - 32, 900));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [isFullscreen]);

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    if (!thumbsRef.current) return;
    const active = thumbsRef.current.querySelector(`[data-page="${currentPage}"]`);
    if (active) active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [currentPage]);

  const goNext = useCallback(() => setCurrentPage((p) => Math.min(numPages || 1, p + 1)), [numPages]);
  const goPrev = useCallback(() => setCurrentPage((p) => Math.max(1, p - 1)), []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, isFullscreen]);

  const onDocumentLoadSuccess = (pdf) => {
    setPdfDoc(pdf);
    setNumPages(pdf.numPages);
    setCurrentPage(1);
    setLoadError(false);
  };

  const onDocumentLoadError = (err) => {
    console.error("PDF load error:", err);
    setLoadError(true);
    setViewMode("native"); // Auto fallback to browser native embed if canvas worker fails
  };

  const handlePageInputChange = (e) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e) => {
    if (e.key === "Enter" || e.type === "blur") {
      const p = parseInt(pageInput, 10);
      if (!isNaN(p) && p >= 1 && p <= (numPages || 1)) {
        setCurrentPage(p);
      } else {
        setPageInput(String(currentPage));
      }
    }
  };

  // Perform text search across pages
  const handleSearch = async (q) => {
    if (!q || !q.trim() || !pdfDoc) {
      setSearchMatches([]);
      setCurrentMatchIdx(0);
      return;
    }
    setSearching(true);
    const cleanQ = q.trim().toLowerCase();
    const matches = [];

    try {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item) => item.str).join(" ").toLowerCase();
        if (text.includes(cleanQ)) {
          matches.push(i);
        }
      }
      setSearchMatches(matches);
      setCurrentMatchIdx(0);
      if (matches.length > 0) {
        setCurrentPage(matches[0]);
      }
    } catch (e) {
      console.error("PDF text search error", e);
    } finally {
      setSearching(false);
    }
  };

  const nextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIdx + 1) % searchMatches.length;
    setCurrentMatchIdx(nextIdx);
    setCurrentPage(searchMatches[nextIdx]);
  };

  const prevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIdx(prevIdx);
    setCurrentPage(searchMatches[prevIdx]);
  };

  const fsClasses = isFullscreen
    ? "fixed inset-0 z-[300] bg-zinc-950 flex flex-col overflow-hidden"
    : "relative w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-md bg-white dark:bg-zinc-900";

  // ── Mode: Only Google Slides provided ─────────────────────────────────────
  if (!pdfUrl && slidesEmbedUrl) {
    return (
      <div className="w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-700 bg-black shadow-md">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-zinc-800 text-xs text-gray-300 font-bold">
          <span className="flex items-center gap-2">📊 Presentation (Google Slides)</span>
          <a
            href={slidesEmbedUrl.replace("/embed", "/pub")}
            target="_blank"
            rel="noreferrer"
            className="text-purple-400 hover:underline flex items-center gap-1"
          >
            Open in new tab ↗
          </a>
        </div>
        <div className="w-full aspect-[16/9]">
          <iframe
            src={slidesEmbedUrl}
            title={title || "Presentation"}
            className="w-full h-full border-0"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // ── Mode: No PDF or Slides ────────────────────────────────────────────────
  if (!pdfUrl) {
    return (
      <div className="w-full rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-2">
        <span className="text-4xl">📄</span>
        <span className="font-semibold">No presentation uploaded yet.</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={fsClasses}>
      {/* ── Main Toolbar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 text-xs select-none">
        {/* Left: Title & Page Jump Input */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">📄</span>
          {isFullscreen && (
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-[180px]">
              {title}
            </span>
          )}
          {numPages && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 px-2 py-1 rounded-xl shadow-xs">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Page</span>
              <input
                type="number"
                min={1}
                max={numPages}
                value={pageInput}
                onChange={handlePageInputChange}
                onKeyDown={handlePageInputSubmit}
                onBlur={handlePageInputSubmit}
                className="w-10 text-center bg-gray-100 dark:bg-zinc-700 font-bold text-gray-900 dark:text-white rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-purple-500"
              />
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">/ {numPages}</span>
            </div>
          )}
        </div>

        {/* Center: Prev/Next Arrow Navigation */}
        {numPages && viewMode === "canvas" && (
          <div className="flex items-center gap-1">
            <button
              onClick={goPrev}
              disabled={currentPage <= 1}
              className="w-8 h-8 rounded-xl border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold transition"
              title="Previous page (ArrowLeft)"
            >
              ◀
            </button>
            <button
              onClick={goNext}
              disabled={currentPage >= (numPages || 1)}
              className="w-8 h-8 rounded-xl border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold transition"
              title="Next page (ArrowRight)"
            >
              ▶
            </button>
          </div>
        )}

        {/* Right: Controls (Search, Zoom, View Modes, Download, Fullscreen) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Text Search Button */}
          {viewMode === "canvas" && (
            <button
              onClick={() => setShowSearch((s) => !s)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1 ${
                showSearch
                  ? "bg-purple-100 dark:bg-purple-950/50 border-purple-400 text-purple-700 dark:text-purple-300"
                  : "border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-800"
              }`}
              title="Search text in document"
            >
              🔍 <span className="hidden sm:inline">Search</span>
            </button>
          )}

          {/* Zoom Controls */}
          {viewMode === "canvas" && (
            <div className="flex items-center bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl p-0.5">
              <button
                onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
                className="w-7 h-7 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 font-bold transition text-sm flex items-center justify-center"
                title="Zoom Out"
              >
                −
              </button>
              <button
                onClick={() => setScale(1.0)}
                className="px-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:text-purple-600"
                title="Reset Zoom"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                onClick={() => setScale((s) => Math.min(2.5, +(s + 0.25).toFixed(2)))}
                className="w-7 h-7 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 font-bold transition text-sm flex items-center justify-center"
                title="Zoom In"
              >
                +
              </button>
            </div>
          )}

          {/* View Mode Switcher */}
          <div className="flex items-center bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode("canvas")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                viewMode === "canvas"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-purple-600"
              }`}
              title="Interactive Slide View"
            >
              Slide
            </button>
            <button
              onClick={() => setViewMode("native")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                viewMode === "native"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-purple-600"
              }`}
              title="Native Browser PDF Viewer"
            >
              Native
            </button>
            {slidesEmbedUrl && (
              <button
                onClick={() => setViewMode("gslides")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  viewMode === "gslides"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-purple-600"
                }`}
                title="Google Slides View"
              >
                Slides
              </button>
            )}
          </div>

          {/* Download */}
          <a
            href={pdfUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="w-8 h-8 rounded-xl border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-800 flex items-center justify-center transition"
            title="Download PDF"
          >
            ⬇
          </a>

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className="w-8 h-8 rounded-xl border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-800 flex items-center justify-center transition text-xs font-bold"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? "✕" : "⛶"}
          </button>
        </div>
      </div>

      {/* ── Search Bar Overlay ──────────────────────────────────────────────── */}
      {showSearch && viewMode === "canvas" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-950/40 border-b border-purple-200 dark:border-purple-900/50 text-xs">
          <input
            type="text"
            placeholder="Search keyword in PDF..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearch(e.target.value);
            }}
            autoFocus
            className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 dark:text-gray-200"
          />
          {searching && <span className="text-gray-400 text-[11px]">Searching...</span>}
          {!searching && searchQuery && searchMatches.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-purple-700 dark:text-purple-300 font-bold text-[11px]">
                {currentMatchIdx + 1} of {searchMatches.length} matches (Page {searchMatches[currentMatchIdx]})
              </span>
              <button
                onClick={prevMatch}
                className="w-6 h-6 rounded border border-purple-300 dark:border-purple-700 font-bold hover:bg-purple-200 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300"
                title="Previous match"
              >
                ▲
              </button>
              <button
                onClick={nextMatch}
                className="w-6 h-6 rounded border border-purple-300 dark:border-purple-700 font-bold hover:bg-purple-200 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300"
                title="Next match"
              >
                ▼
              </button>
            </div>
          )}
          {!searching && searchQuery && searchMatches.length === 0 && (
            <span className="text-red-500 text-[11px] font-semibold">No matches found</span>
          )}
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery("");
              setSearchMatches([]);
            }}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white font-bold ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Main Display Body ───────────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 overflow-hidden ${isFullscreen ? "h-full" : ""}`}>
        {/* Single Document Context Wrapper */}
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<PageSkeleton width={pageWidth * scale} />}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          {/* Canvas View */}
          {viewMode === "canvas" && !loadError && (
            <div
              ref={pageWrapRef}
              className={`flex-1 flex flex-col items-center justify-start overflow-auto p-4 select-text ${
                isFullscreen ? "bg-zinc-950" : "bg-gray-100 dark:bg-zinc-950/80 min-h-[460px]"
              }`}
            >
              <Page
                pageNumber={currentPage}
                width={pageWidth * scale}
                renderAnnotationLayer
                renderTextLayer
                loading={<PageSkeleton width={pageWidth * scale} />}
                className="shadow-2xl rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white"
              />
            </div>
          )}

          {/* Native Browser PDF Embed */}
          {viewMode === "native" && (
            <div className="flex-1 w-full h-[580px] bg-black">
              <iframe
                src={`${pdfUrl}#page=${currentPage}`}
                title={title || "PDF Document"}
                className="w-full h-full border-0"
              />
            </div>
          )}

          {/* Google Slides View (when toggled or fallback) */}
          {viewMode === "gslides" && slidesEmbedUrl && (
            <div className="flex-1 w-full aspect-[16/9] bg-black">
              <iframe
                src={slidesEmbedUrl}
                title={title || "Google Slides"}
                className="w-full h-full border-0"
                allowFullScreen
              />
            </div>
          )}

          {/* Google Docs GView Fallback */}
          {viewMode === "gview" && (
            <div className="flex-1 w-full h-[580px] bg-white">
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(pdfUrl)}&embedded=true`}
                title={title || "PDF Document"}
                className="w-full h-full border-0"
              />
            </div>
          )}

          {/* Thumbnail Strip (Rendered INSIDE Document for zero re-fetches!) */}
          {viewMode === "canvas" && numPages && numPages > 1 && (
            <div
              ref={thumbsRef}
              className="px-4 py-3 bg-gray-50 dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 flex gap-2.5 overflow-x-auto scrollbar-thin flex-shrink-0"
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  data-page={p}
                  onClick={() => setCurrentPage(p)}
                  className={`relative flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-150 ${
                    p === currentPage
                      ? "border-purple-600 shadow-lg shadow-purple-500/20 scale-105"
                      : "border-gray-200 dark:border-zinc-700 opacity-60 hover:opacity-100 hover:border-purple-400"
                  }`}
                  title={`Page ${p}`}
                >
                  <Page
                    pageNumber={p}
                    width={72}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    loading={
                      <div className="w-18 h-24 bg-gray-200 dark:bg-zinc-800 animate-pulse rounded" />
                    }
                  />
                  <span className="absolute bottom-1 right-1 bg-black/70 text-white font-extrabold text-[9px] px-1 rounded">
                    {p}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Document>
      </div>
    </div>
  );
}
