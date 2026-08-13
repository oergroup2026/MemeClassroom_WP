import React, { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// ── Worker setup (Using workerPort for clean Vite module worker instantiation) ─
if (typeof window !== "undefined" && "Worker" in window) {
  try {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" }
    );
  } catch (_) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  }
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────
const PageSkeleton = ({ width }) => (
  <div
    className="animate-pulse bg-gray-200 dark:bg-zinc-800 rounded-xl"
    style={{ width: width || "100%", height: Math.floor((width || 600) * 1.294) }}
  />
);

// ─── PdfSlideViewer Component ────────────────────────────────────────────────
/**
 * Unified presentation viewer for both PDFs and Google Slides.
 * - Readers see a clean, single-purpose viewer (no confusing mode buttons).
 * - PDFs load page-by-page with zoom, page jump, text selection, and thumbnails.
 * - If PDF canvas fails, seamlessly loads native browser PDF preview directly in page.
 * - Google Slides embeds load directly in iframe mode.
 */
export default function PdfSlideViewer({ pdfUrl, slidesEmbedUrl, title }) {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Pre-fetched Blob URL for same-origin memory access
  const [blobUrl, setBlobUrl] = useState(null);
  const [fetchingBlob, setFetchingBlob] = useState(false);

  const containerRef = useRef(null);
  const pageWrapRef = useRef(null);
  const thumbsRef = useRef(null);
  const [pageWidth, setPageWidth] = useState(650);

  // Pre-fetch remote PDF into Blob URL to prevent CORS Range request blocks
  useEffect(() => {
    if (!pdfUrl) {
      setBlobUrl(null);
      return;
    }
    let isMounted = true;
    let createdUrl = null;

    const loadPdfBlob = async () => {
      setFetchingBlob(true);
      try {
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        createdUrl = URL.createObjectURL(blob);
        if (isMounted) {
          setBlobUrl(createdUrl);
        }
      } catch (err) {
        console.warn("Direct blob pre-fetch failed, using raw URL:", err);
        if (isMounted) {
          setBlobUrl(pdfUrl);
        }
      } finally {
        if (isMounted) setFetchingBlob(false);
      }
    };

    loadPdfBlob();

    return () => {
      isMounted = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [pdfUrl]);

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
    setNumPages(pdf.numPages);
    setCurrentPage(1);
    setLoadError(false);
  };

  const onDocumentLoadError = (err) => {
    console.error("PDF canvas load error:", err);
    setLoadError(true);
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

  const fsClasses = isFullscreen
    ? "fixed inset-0 z-[300] bg-zinc-950 flex flex-col overflow-hidden"
    : "relative w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-md bg-white dark:bg-zinc-900";

  // ── CASE 1: Google Slides / Canva Embed (When no PDF is uploaded) ────────────────
  if (!pdfUrl && slidesEmbedUrl) {
    const isCanva = slidesEmbedUrl.includes("canva.com");
    const isGoogle = slidesEmbedUrl.includes("docs.google.com");
    const openUrl = isGoogle
      ? slidesEmbedUrl.replace("/embed", "/pub")
      : isCanva
      ? slidesEmbedUrl.replace("?embed", "").replace("&embed", "")
      : slidesEmbedUrl;
    const providerLabel = isCanva ? "Canva" : isGoogle ? "Google Slides" : "";

    return (
      <div className="w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-700 bg-black shadow-md">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-zinc-800 text-xs text-gray-300 font-bold">
          <span className="flex items-center gap-2">
            📊 Presentation {providerLabel && <span className="text-[10px] font-normal text-purple-400">({providerLabel})</span>}
          </span>
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="text-purple-400 hover:underline flex items-center gap-1"
          >
            Open ↗
          </a>
        </div>
        <div className="w-full aspect-[16/9]">
          <iframe
            src={slidesEmbedUrl}
            title={title || "Presentation"}
            className="w-full h-full border-0"
            allowFullScreen
            allow="fullscreen"
          />
        </div>
      </div>
    );
  }

  // ── CASE 2: No presentation uploaded at all ──────────────────────────────
  if (!pdfUrl) {
    return (
      <div className="w-full rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-2">
        <span className="text-4xl">📄</span>
        <span className="font-semibold">No presentation uploaded yet.</span>
      </div>
    );
  }

  // ── CASE 3: Direct Native PDF Viewer Fallback (Loads PDF directly in page)
  if (loadError) {
    return (
      <div className="w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-md bg-white dark:bg-zinc-900">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 text-xs select-none">
          <span className="font-bold text-gray-800 dark:text-gray-200">📄 Presentation</span>
          <a
            href={pdfUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition"
          >
            Download PDF ⬇
          </a>
        </div>
        <div className="w-full h-[640px] bg-zinc-900">
          <iframe
            src={`${pdfUrl}#toolbar=1`}
            title={title || "PDF Presentation"}
            className="w-full h-full border-0"
          />
        </div>
      </div>
    );
  }

  // ── CASE 4: PDF Canvas View ──────────────────────────────────────────────
  return (
    <div ref={containerRef} className={fsClasses}>
      {/* Main Header Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 text-xs select-none">
        {/* Left: Title & Page Jump Input */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">📄</span>
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
            {title || "Presentation"}
          </span>
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
        {numPages && (
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

        {/* Right: Controls (Zoom, Download, Fullscreen) */}
        <div className="flex items-center gap-1.5">
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

          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className="w-8 h-8 rounded-xl border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-800 flex items-center justify-center transition text-xs font-bold"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? "✕" : "⛶"}
          </button>
        </div>
      </div>

      {/* Main Page Canvas & Thumbnail Bar */}
      <div className={`flex flex-col flex-1 overflow-hidden ${isFullscreen ? "h-full" : ""}`}>
        {fetchingBlob ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 min-h-[460px]">
            <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-500 font-semibold">Loading presentation...</span>
          </div>
        ) : (
          <Document
            file={blobUrl || pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<PageSkeleton width={pageWidth * scale} />}
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
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

            {numPages && numPages > 1 && (
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
        )}
      </div>
    </div>
  );
}
