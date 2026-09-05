/**
 * AudiogramCanvas — Renders a shareable audiogram card for audio memes.
 *
 * This is a self-contained visual card component that:
 *  1. Decodes the audio file with the Web Audio API and renders a static
 *     waveform bar chart on a <canvas>.
 *  2. Overlays the meme title, subject badge, and creator name.
 *  3. Generates a QR code (using the `qrcode` npm package) that links to the
 *     audio file's public URL so viewers can scan and listen.
 *  4. Exposes `generateCardBlob()` via a forwarded ref so the parent (Lab.jsx)
 *     can call it during the publish flow to get a PNG Blob.
 *
 * Props:
 *   audioFile   {File|null}   — raw audio File (preferred for waveform decode)
 *   audioUrl    {string}      — fallback public URL (used for QR code + when no File)
 *   title       {string}      — meme title
 *   subject     {string}      — subject badge
 *   creatorName {string}      — display name of the creator
 *   bgColor     {string}      — background color hex (default "#1e1b4b")
 *   accentColor {string}      — waveform bar color (default "#a78bfa")
 */

import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from "react";
import QRCode from "qrcode";

// --- Constants ---
const CARD_W = 600;
const CARD_H = 340;
const BAR_COUNT = 80;
const BAR_GAP = 2;

/**
 * Decode an audio file/URL with the Web Audio API and return a normalised
 * amplitude array of length `numBars`.
 */
async function extractWaveform(source, numBars) {
  try {
    let arrayBuffer;
    if (source instanceof File) {
      arrayBuffer = await source.arrayBuffer();
    } else if (typeof source === "string") {
      const res = await fetch(source);
      arrayBuffer = await res.arrayBuffer();
    } else {
      return null;
    }

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    await audioCtx.close();

    // Use the first channel's raw PCM data
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / numBars);
    const amplitudes = [];

    for (let i = 0; i < numBars; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[i * blockSize + j]);
      }
      amplitudes.push(sum / blockSize);
    }

    // Normalise to [0, 1]
    const max = Math.max(...amplitudes, 0.001);
    return amplitudes.map((a) => a / max);
  } catch (err) {
    console.warn("Waveform extraction failed, using placeholder:", err);
    return null;
  }
}

/** Generate a placeholder waveform (sine-based) when audio decode fails. */
function placeholderWaveform(numBars) {
  return Array.from({ length: numBars }, (_, i) => {
    const t = i / numBars;
    return (
      0.4 +
      0.3 * Math.sin(t * Math.PI * 6) +
      0.15 * Math.sin(t * Math.PI * 14) +
      0.1 * Math.random()
    );
  });
}

/**
 * Draw the full audiogram card onto a canvas element.
 * Returns the canvas so the caller can call `canvas.toBlob()`.
 */
async function drawAudiogramCard({
  audioSource,   // File | string URL
  audioUrl,      // public URL for QR code
  title,
  subject,
  creatorName,
  bgColor,
  accentColor,
}) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");

  // --- Background ---
  ctx.fillStyle = bgColor || "#1e1b4b";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Subtle gradient overlay
  const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // --- Music note icon (top-left) ---
  ctx.font = "bold 28px Arial";
  ctx.fillStyle = accentColor || "#a78bfa";
  ctx.fillText("🎵", 24, 44);

  // --- Subject badge ---
  if (subject) {
    const badgeText = subject.toUpperCase();
    ctx.font = "bold 10px Arial";
    const badgeW = ctx.measureText(badgeText).width + 20;
    const badgeX = 60;
    const badgeY = 20;
    ctx.fillStyle = accentColor || "#a78bfa";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(badgeX, badgeY, badgeW, 20, 10);
    } else {
      ctx.rect(badgeX, badgeY, badgeW, 20);
    }
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, badgeX + 10, badgeY + 10);
  }

  // --- Waveform bars ---
  let amplitudes = await extractWaveform(audioSource, BAR_COUNT);
  if (!amplitudes) amplitudes = placeholderWaveform(BAR_COUNT);

  const waveAreaX = 24;
  const waveAreaY = 70;
  const waveAreaW = CARD_W - 180; // leave room for QR code
  const waveAreaH = 120;

  const totalBarsW = waveAreaW - (BAR_COUNT - 1) * BAR_GAP;
  const barW = Math.max(2, Math.floor(totalBarsW / BAR_COUNT));

  amplitudes.forEach((amp, i) => {
    const barH = Math.max(4, Math.round(amp * waveAreaH));
    const x = waveAreaX + i * (barW + BAR_GAP);
    const y = waveAreaY + waveAreaH - barH;

    // Gradient per bar
    const barGrad = ctx.createLinearGradient(x, y, x, y + barH);
    barGrad.addColorStop(0, accentColor || "#a78bfa");
    barGrad.addColorStop(1, "rgba(167,139,250,0.3)");
    ctx.fillStyle = barGrad;

    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, barW, barH, 2);
    } else {
      ctx.rect(x, y, barW, barH);
    }
    ctx.fill();
  });

  // --- Title ---
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px Arial";
  ctx.textBaseline = "alphabetic";
  const maxTitleW = CARD_W - 180;
  let displayTitle = title || "Untitled Audio Meme";
  while (ctx.measureText(displayTitle).width > maxTitleW && displayTitle.length > 10) {
    displayTitle = displayTitle.slice(0, -4) + "...";
  }
  ctx.fillText(displayTitle, 24, 220);

  // --- Creator name ---
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "12px Arial";
  ctx.fillText(`Created by: ${creatorName || "MemeClassroom"}`, 24, 244);

  // --- Horizontal rule ---
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 260);
  ctx.lineTo(CARD_W - 24, 260);
  ctx.stroke();

  // --- Footer label ---
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "10px Arial";
  ctx.fillText("MemeClassroom · Scan QR to listen", 24, 280);

  // --- QR Code (right side) ---
  const qrSize = 110;
  const qrX = CARD_W - qrSize - 24;
  const qrY = 60;

  const qrUrl = audioUrl || "https://memeclassroom.app";
  try {
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: qrSize * 2,
      margin: 1,
      color: {
        dark: "#ffffff",
        light: bgColor || "#1e1b4b",
      },
    });

    await new Promise((resolve) => {
      const qrImg = new Image();
      qrImg.src = qrDataUrl;
      qrImg.onload = () => {
        // White rounded background for QR
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        ctx.roundRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 32, 12);
        ctx.fill();

        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        // "Scan to listen" label
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 9px Arial";
        ctx.textAlign = "center";
        ctx.fillText("SCAN TO LISTEN", qrX + qrSize / 2, qrY + qrSize + 14);
        ctx.textAlign = "left";
        resolve();
      };
      qrImg.onerror = resolve; // fail silently
    });
  } catch (err) {
    console.warn("QR code generation failed:", err);
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

const AudiogramCanvas = forwardRef(function AudiogramCanvas(
  { audioFile, audioUrl, title, subject, creatorName, bgColor, accentColor },
  ref
) {
  const previewCanvasRef = useRef(null);
  const [isRendering, setIsRendering] = useState(false);

  // Expose generateCardBlob() to parent via ref
  useImperativeHandle(ref, () => ({
    generateCardBlob: async () => {
      const audioSource = audioFile || audioUrl;
      const canvas = await drawAudiogramCard({
        audioSource,
        audioUrl,
        title,
        subject,
        creatorName,
        bgColor,
        accentColor,
      });
      return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    },
  }));

  // Re-render preview when any prop changes
  const renderPreview = useCallback(async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    setIsRendering(true);
    try {
      const audioSource = audioFile || audioUrl;
      const offscreen = await drawAudiogramCard({
        audioSource,
        audioUrl,
        title,
        subject,
        creatorName,
        bgColor,
        accentColor,
      });

      // Copy offscreen → preview canvas
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(offscreen, 0, 0);
    } catch (err) {
      console.error("Audiogram preview render failed:", err);
    } finally {
      setIsRendering(false);
    }
  }, [audioFile, audioUrl, title, subject, creatorName, bgColor, accentColor]);

  useEffect(() => {
    // Debounce by 300ms to avoid hammering on every keystroke
    const timer = setTimeout(renderPreview, 300);
    return () => clearTimeout(timer);
  }, [renderPreview]);

  return (
    <div className="relative w-full flex flex-col items-center">
      <canvas
        ref={previewCanvasRef}
        style={{
          width: "100%",
          maxWidth: "600px",
          height: "auto",
          borderRadius: "12px",
          display: "block",
        }}
      />
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
          <div className="text-white text-xs font-bold animate-pulse">
            🎨 Rendering card…
          </div>
        </div>
      )}
    </div>
  );
});

export default AudiogramCanvas;
