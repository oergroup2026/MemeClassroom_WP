import React, { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// ── Worker setup (Vite-compatible CDN approach) ──────────────────────────────
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─── Loading skeleton ────────────────────────────────────────────────────────
const PageSkeleton = ({ width }) => (
  <div
    className="animate-pulse bg-gray-200 dark:bg-zinc-800 rounded"
    style={{ width: width || "100%", height: Math.floor((width || 600) * 1.294) }}
  />
);

// ─── PdfSlideViewer ──────────────────────────────────────────────────────────
/**
 * Props:
 *  pdfUrl        {string}  Firebase Storage / public URL to the PDF
 *  slidesEmbedUrl {string} Google Slides embed URL (fallback when no PDF)
 *  title         {string}  Activity title (used in full-screen header)
 */
export default function PdfSlideViewer({ pdfUrl, slidesEmbedUrl, title }) {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [thumbError, setThumbError] = useState({});
  const containerRef = useRef(null);
  const pageWrapRef = useRef(null);
  const thumbsRef = useRef(null);

  // ── Compute render width from container ──────────────────────────────────
  const [pageWidth, setPageWidth] = useState(600);
  useEffect(() => {
    const el = pageWrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setPageWidth(Math.min(w, 900));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [isFullscreen]);

  // ── Thumbnail auto-scroll when page changes ──────────────────────────────
  useEffect(() => {
    if (!thumbsRef.current) return;
    const active = thumbsRef.current.querySelector(`[data-page="${currentPage}"]`);
    if (active) active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [currentPage]);

  // ── Keyboard nav ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, numPages, isFullscreen]);

  const goNext = useCallback(() => setCurrentPage((p) => Math.min(numPages || 1, p + 1)), [numPages]);
  const goPrev = useCallback(() => setCurrentPage((p) => Math.max(1, p - 1)), []);

  const onDocumentLoadSuccess = ({ numPages: n }) => {
    setNumPages(n);
    setCurrentPage(1);
    setLoadError(false);
  };

  const onDocumentLoadError = () => setLoadError(true);

  // ── Fullscreen wrapper classes ────────────────────────────────────────────
  const fsClasses = isFullscreen
    ? "fixed inset-0 z-[300] bg-gray-950 flex flex-col overflow-hidden"
    : "relative w-full";

  // ── If no PDF and only a Slides embed ────────────────────────────────────
  if (!pdfUrl && slidesEmbedUrl) {
    return (
      <div className="w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-700 bg-black">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-zinc-800 text-xs text-gray-300 font-semibold">
          <span>📊 Presentation (Google Slides)</span>
          <a href={slidesEmbedUrl.replace("/embed", "/pub")} target="_blank" rel="noreferrer"
            className="text-purple-400 hover:underline">Open ↗</a>
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

  if (!pdfUrl) {
    return (
      <div className="w-full rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-2">
        <span className="text-4xl">📄</span>
        <span>No presentation uploaded yet.</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={fsClasses}>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between gap-3 px-4 py-2 ${isFullscreen ? "bg-gray-900 border-b border-zinc-800" : "bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-t-2xl"}`}>
        {/* Left: title in fullscreen */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">📄</span>
          {isFullscreen && (
            <span className="text-xs font-semibold text-gray-300 truncate max-w-[200px]">{title}</span>
          )}
          {/* Page counter */}
          {numPages && (
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Slide {currentPage} / {numPages}
            </span>
          )}
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Zoom out */}
          <button
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
            className="w-7 h-7 rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center text-sm font-bold transition"
            title="Zoom out"
          >−</button>
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          {/* Zoom in */}
          <button
            onClick={() => setScale((s) => Math.min(2.5, +(s + 0.25).toFixed(2)))}
            className="w-7 h-7 rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center text-sm font-bold transition"
            title="Zoom in"
          >+</button>

          {/* Download */}
          <a
            href={pdfUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="w-7 h-7 rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center transition"
            title="Download PDF"
          >⬇</a>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className="w-7 h-7 rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center transition text-xs"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >{isFullscreen ? "✕" : "⛶"}</button>
        </div>
      </div>

      {/* ── Main viewer area ─────────────────────────────────────────────── */}
      <div className={`flex ${isFullscreen ? "flex-1 overflow-hidden" : ""}`}>
        {/* Slide canvas */}
        <div
          ref={pageWrapRef}
          className={`flex-1 flex items-center justify-center overflow-auto ${isFullscreen ? "bg-gray-950 p-4" : "bg-gray-100 dark:bg-zinc-900/60 p-4 border-x border-gray-200 dark:border-zinc-700"}`}
        >
          {loadError ? (
            <div className="text-center text-sm text-gray-500 py-12 space-y-2">
              <p className="text-3xl">⚠️</p>
              <p>Could not load the PDF.</p>
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-purple-500 underline text-xs">
                Open directly ↗
              </a>
            </div>
          ) : (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<PageSkeleton width={pageWidth * scale} />}
            >
              <Page
                pageNumber={currentPage}
                width={pageWidth * scale}
                renderAnnotationLayer
                renderTextLayer
                loading={<PageSkeleton width={pageWidth * scale} />}
                className="shadow-xl rounded-lg overflow-hidden"
              />
            </Document>
          )}
        </div>
      </div>

      {/* ── Navigation bar (prev, dots, next) + thumbnail strip ─────────── */}
      <div className={`${isFullscreen ? "bg-gray-900 border-t border-zinc-800" : "bg-gray-50 dark:bg-zinc-900 border border-t-0 border-gray-200 dark:border-zinc-700 rounded-b-2xl"}`}>
        {/* Prev / Page indicator / Next */}
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={goPrev}
            disabled={currentPage <= 1}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl border border-gray-300 dark:border-zinc-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ◀ Prev
          </button>

          {/* Progress dots (max 10 shown) */}
          {numPages && numPages <= 20 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`rounded-full transition-all duration-200 ${
                    p === currentPage
                      ? "w-2.5 h-2.5 bg-purple-600"
                      : "w-1.5 h-1.5 bg-gray-300 dark:bg-zinc-600 hover:bg-purple-400"
                  }`}
                  title={`Slide ${p}`}
                />
              ))}
            </div>
          )}
          {numPages && numPages > 20 && (
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={numPages}
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                className="w-32 accent-purple-600"
              />
            </div>
          )}

          <button
            onClick={goNext}
            disabled={currentPage >= (numPages || 1)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl border border-gray-300 dark:border-zinc-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            Next ▶
          </button>
        </div>

        {/* Thumbnail strip */}
        {numPages && numPages > 1 && (
          <div
            ref={thumbsRef}
            className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-zinc-700"
          >
            {Array.from({ length: Math.min(numPages, 30) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                data-page={p}
                onClick={() => setCurrentPage(p)}
                className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                  p === currentPage
                    ? "border-purple-600 shadow-md shadow-purple-500/20"
                    : "border-gray-200 dark:border-zinc-700 opacity-60 hover:opacity-100 hover:border-purple-300"
                }`}
                title={`Slide ${p}`}
              >
                {!thumbError[p] ? (
                  <Document file={pdfUrl} loading={null} noData={null}>
                    <Page
                      pageNumber={p}
                      width={64}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      loading={
                        <div className="w-16 h-20 bg-gray-200 dark:bg-zinc-800 animate-pulse rounded" />
                      }
                      onRenderError={() => setThumbError((prev) => ({ ...prev, [p]: true }))}
                    />
                  </Document>
                ) : (
                  <div className="w-16 h-20 bg-gray-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] text-gray-400 font-bold">
                    {p}
                  </div>
                )}
              </button>
            ))}
            {numPages > 30 && (
              <div className="flex-shrink-0 w-16 h-20 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] text-gray-400 font-bold">
                +{numPages - 30}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
