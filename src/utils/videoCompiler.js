/**
 * videoCompiler.js
 * Compiles a video meme by overlaying draggable text boxes and timed captions/subtitles.
 * Attempts Option 2 (FFmpeg.wasm WebAssembly re-encoding) for professional-grade offline baking,
 * with a automatic fallback to Option 1 (HTML5 Canvas + MediaRecorder stream capture).
 */

import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Helper to convert Canvas content to a Uint8Array PNG for FFmpeg virtual file system
const canvasToUint8Array = async (canvasElement) => {
  const blob = await new Promise(resolve => canvasElement.toBlob(resolve, "image/png"));
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
};

// Canvas + MediaRecorder fallback compilation engine
async function compileVideoMemeCanvas({
  videoUrl,
  textLayers,
  captionsList,
  videoTrimStart,
  videoTrimEnd,
  width,
  height,
  scale,
  canvasBg,
  onProgress
}) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    let mediaRecorder;
    let audioCtx;
    let frameId;
    const chunks = [];

    const cleanup = () => {
      cancelAnimationFrame(frameId);
      if (video) {
        video.pause();
        video.src = "";
        video.load();
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    };

    video.oncanplay = () => {
      video.oncanplay = null;
      const finalTrimEnd = Math.min(videoTrimEnd, video.duration || videoTrimEnd);
      const durationToRecord = finalTrimEnd - videoTrimStart;

      if (durationToRecord <= 0) {
        reject(new Error("Invalid trim bounds."));
        return;
      }

      video.currentTime = videoTrimStart;
      video.onseeked = () => {
        video.onseeked = null;

        try {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const sourceNode = audioCtx.createMediaElementSource(video);
          const destNode = audioCtx.createMediaStreamDestination();
          sourceNode.connect(destNode);

          const canvasStream = canvas.captureStream(30);
          const audioStream = destNode.stream;
          const tracks = [...canvasStream.getVideoTracks()];
          if (audioStream.getAudioTracks().length > 0) {
            tracks.push(...audioStream.getAudioTracks());
          }
          const outputStream = new MediaStream(tracks);

          let options = { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 2500000 };
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: 2500000 };
          }
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: "video/webm", videoBitsPerSecond: 2500000 };
          }
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = {};
          }

          mediaRecorder = new MediaRecorder(outputStream, options);
          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };

          mediaRecorder.onstop = () => {
            cleanup();
            const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "video/webm" });
            resolve(blob);
          };

          mediaRecorder.start();
          video.play().catch(reject);

          const drawFrame = () => {
            if (video.currentTime >= finalTrimEnd || video.ended) {
              mediaRecorder.stop();
              return;
            }

            if (onProgress) {
              const elapsed = video.currentTime - videoTrimStart;
              onProgress(Math.min(99, Math.round((elapsed / durationToRecord) * 100)));
            }

            ctx.fillStyle = canvasBg;
            ctx.fillRect(0, 0, width, height);

            if (video.videoWidth > 0) {
              const videoAspect = video.videoWidth / video.videoHeight;
              const canvasAspect = width / height;
              let vw, vh, vx, vy;
              if (videoAspect > canvasAspect) {
                vw = width;
                vh = width / videoAspect;
                vx = 0;
                vy = (height - vh) / 2;
              } else {
                vh = height;
                vw = height * videoAspect;
                vx = (width - vw) / 2;
                vy = 0;
              }
              ctx.drawImage(video, vx, vy, vw, vh);
            }

            // Text layers
            textLayers.forEach((layer) => {
              ctx.save();
              ctx.translate(layer.x * scale, layer.y * scale);
              if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
              ctx.globalAlpha = layer.opacity ?? 1;
              ctx.font = `${layer.fontSize * scale}px "${layer.fontFamily || "Arial"}"`;
              ctx.fillStyle = layer.color || "#ffffff";
              ctx.textAlign = layer.textAlign || "left";
              ctx.textBaseline = "top";
              if (layer.strokeWidth) {
                ctx.strokeStyle = layer.strokeColor || "#000000";
                ctx.lineWidth = layer.strokeWidth * scale * 2;
                ctx.strokeText(layer.text, 0, 0);
              }
              ctx.fillText(layer.text, 0, 0);
              ctx.restore();
            });

            // Subtitle
            const active = captionsList.slice().reverse().find(c => c.time <= video.currentTime);
            if (active) {
              ctx.save();
              const size = Math.max(16, 20 * scale);
              ctx.font = `bold ${size}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "bottom";
              const text = active.text;
              const maxWidth = width - 80 * scale;
              const words = text.split(" ");
              let line = "";
              const lines = [];
              for (let n = 0; n < words.length; n++) {
                const test = line + words[n] + " ";
                if (ctx.measureText(test).width > maxWidth && n > 0) {
                  lines.push(line.trim());
                  line = words[n] + " ";
                } else {
                  line = test;
                }
              }
              lines.push(line.trim());
              const blockH = lines.length * (size + 6 * scale);
              const by = height - 60 * scale - blockH;
              lines.forEach((l, i) => {
                const ly = by + (i + 1) * (size + 4 * scale);
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 6 * scale;
                ctx.strokeText(l, width / 2, ly);
                ctx.fillStyle = "#ffffff";
                ctx.fillText(l, width / 2, ly);
              });
              ctx.restore();
            }

            frameId = requestAnimationFrame(drawFrame);
          };
          frameId = requestAnimationFrame(drawFrame);
        } catch (e) {
          cleanup();
          reject(e);
        }
      };
    };
    video.onerror = reject;
  });
}

// Main Video Compilation Utility
export async function compileVideoMeme({
  videoUrl,
  textLayers = [],
  videoCaptions = "",
  videoTrimStart = 0,
  videoTrimEnd = 15,
  aspectRatio = "1:1",
  canvasBg = "#1e293b",
  onProgress
}) {
  // 1. Setup layout dimensions
  let width = 720;
  let height = 720;
  if (aspectRatio === "16:9") {
    width = 1280;
    height = 720;
  } else if (aspectRatio === "9:16") {
    width = 720;
    height = 1280;
  } else if (aspectRatio === "4:3") {
    width = 960;
    height = 720;
  }
  const scale = width / 480;

  // 2. Parse captions
  const parseCaptionLines = (raw = "") => {
    return raw
      .split("\n")
      .map(line => {
        const match = line.match(/^(\d+):(\d+)\s*[–\-]\s*(.+)$/);
        if (!match) return null;
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        return { time: minutes * 60 + seconds, text: match[3].trim() };
      })
      .filter(Boolean);
  };
  const captionsList = parseCaptionLines(videoCaptions);

  // Attempt FFmpeg.wasm compilation (Option 2)
  try {
    if (onProgress) onProgress(5); // Started Loading WASM

    // Dynamic import of FFmpeg core packages
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const ffmpeg = new FFmpeg();
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    if (onProgress) onProgress(20); // Loaded WASM, preparing layers

    // Calculate caption end boundaries
    const captionsListWithDurations = captionsList.map((caption, index) => {
      const nextCaption = captionsList[index + 1];
      const endTime = nextCaption ? nextCaption.time : videoTrimEnd;
      const actualEndTime = Math.min(endTime, caption.time + 4.5);
      return {
        ...caption,
        startTime: caption.time,
        endTime: actualEndTime
      };
    });

    // A. Generate Combined Static Text Overlay PNG
    const hasTextLayers = textLayers.length > 0;
    if (hasTextLayers) {
      const textCanvas = document.createElement("canvas");
      textCanvas.width = width;
      textCanvas.height = height;
      const textCtx = textCanvas.getContext("2d");

      textLayers.forEach((layer) => {
        textCtx.save();
        textCtx.translate(layer.x * scale, layer.y * scale);
        if (layer.rotation) textCtx.rotate((layer.rotation * Math.PI) / 180);
        textCtx.globalAlpha = layer.opacity ?? 1;
        textCtx.font = `${layer.fontSize * scale}px "${layer.fontFamily || "Arial"}"`;
        textCtx.fillStyle = layer.color || "#ffffff";
        textCtx.textAlign = layer.textAlign || "left";
        textCtx.textBaseline = "top";
        if (layer.strokeWidth) {
          textCtx.strokeStyle = layer.strokeColor || "#000000";
          textCtx.lineWidth = layer.strokeWidth * scale * 2;
          textCtx.strokeText(layer.text, 0, 0);
        }
        textCtx.fillText(layer.text, 0, 0);
        textCtx.restore();
      });

      const textData = await canvasToUint8Array(textCanvas);
      await ffmpeg.writeFile("text_overlay.png", textData);
    }

    // B. Generate Caption Transparent PNG overlays
    for (let idx = 0; idx < captionsListWithDurations.length; idx++) {
      const caption = captionsListWithDurations[idx];
      const capCanvas = document.createElement("canvas");
      capCanvas.width = width;
      capCanvas.height = height;
      const capCtx = capCanvas.getContext("2d");

      capCtx.save();
      const subtitleFontSize = Math.max(16, 20 * scale);
      capCtx.font = `bold ${subtitleFontSize}px sans-serif`;
      capCtx.textAlign = "center";
      capCtx.textBaseline = "bottom";

      const text = caption.text;
      const maxWidth = width - 80 * scale;
      const words = text.split(" ");
      let line = "";
      const lines = [];

      for (let n = 0; n < words.length; n++) {
        const test = line + words[n] + " ";
        if (capCtx.measureText(test).width > maxWidth && n > 0) {
          lines.push(line.trim());
          line = words[n] + " ";
        } else {
          line = test;
        }
      }
      lines.push(line.trim());

      const blockH = lines.length * (subtitleFontSize + 6 * scale);
      const by = height - 60 * scale - blockH;

      lines.forEach((l, lineIdx) => {
        const ly = by + (lineIdx + 1) * (subtitleFontSize + 4 * scale);
        capCtx.strokeStyle = "#000000";
        capCtx.lineWidth = 6 * scale;
        capCtx.strokeText(l, width / 2, ly);
        capCtx.fillStyle = "#ffffff";
        capCtx.fillText(l, width / 2, ly);
      });

      capCtx.restore();
      const capData = await canvasToUint8Array(capCanvas);
      await ffmpeg.writeFile(`caption_${idx}.png`, capData);
    }

    if (onProgress) onProgress(35); // Fetching video file

    // C. Fetch video content and write to virtual filesystem
    const response = await fetch(videoUrl);
    const videoData = new Uint8Array(await response.arrayBuffer());
    await ffmpeg.writeFile("input.mp4", videoData);

    if (onProgress) onProgress(50); // Starting encode execution

    // D. Build filter complex string
    let filterComplex = "";
    let currentOutput = "[0:v]";
    let nextInputIndex = 1;

    if (hasTextLayers) {
      const outputLabel = "[v_txt]";
      filterComplex += `${currentOutput}[${nextInputIndex}:v]overlay=0:0${outputLabel};`;
      currentOutput = outputLabel;
      nextInputIndex++;
    }

    captionsListWithDurations.forEach((caption, index) => {
      const outputLabel = `[v_cap_${index}]`;
      const relStart = Math.max(0, caption.startTime - videoTrimStart);
      const relEnd = Math.max(0, caption.endTime - videoTrimStart);
      filterComplex += `${currentOutput}[${nextInputIndex}:v]overlay=0:0:enable='between(t,${relStart},${relEnd})'${outputLabel};`;
      currentOutput = outputLabel;
      nextInputIndex++;
    });

    if (filterComplex) {
      filterComplex = filterComplex.slice(0, -1); // remove trailing semicolon
    }

    // E. Assemble CLI Arguments
    const duration = videoTrimEnd - videoTrimStart;
    const args = [
      "-ss", String(videoTrimStart),
      "-i", "input.mp4",
      "-t", String(duration)
    ];

    if (hasTextLayers) {
      args.push("-i", "text_overlay.png");
    }

    captionsListWithDurations.forEach((_, idx) => {
      args.push("-i", `caption_${idx}.png`);
    });

    // Wire progress feedback
    ffmpeg.on("progress", ({ progress }) => {
      if (onProgress) {
        // Map remaining progress to 50% - 99% range
        onProgress(Math.min(99, Math.round(50 + progress * 49)));
      }
    });

    if (filterComplex) {
      const lastLabel = captionsListWithDurations.length > 0 
        ? `[v_cap_${captionsListWithDurations.length - 1}]` 
        : "[v_txt]";
      args.push(
        "-filter_complex", filterComplex,
        "-map", lastLabel,
        "-map", "0:a?",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "28",
        "-c:a", "aac",
        "-b:a", "128k",
        "output.mp4"
      );
    } else {
      args.push(
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "28",
        "-c:a", "aac",
        "-b:a", "128k",
        "output.mp4"
      );
    }

    await ffmpeg.exec(args);

    if (onProgress) onProgress(98); // Finalizing output

    const outputData = await ffmpeg.readFile("output.mp4");
    const outputBlob = new Blob([outputData.buffer], { type: "video/mp4" });

    // Cleanup FFmpeg virtual files
    try { await ffmpeg.deleteFile("input.mp4"); } catch (_) {}
    try { await ffmpeg.deleteFile("output.mp4"); } catch (_) {}
    if (hasTextLayers) {
      try { await ffmpeg.deleteFile("text_overlay.png"); } catch (_) {}
    }
    captionsListWithDurations.forEach((_, idx) => {
      try { ffmpeg.deleteFile(`caption_${idx}.png`); } catch (_) {}
    });

    if (onProgress) onProgress(100);
    return outputBlob;

  } catch (err) {
    console.warn("FFmpeg.wasm compilation failed or unsupported, falling back to Canvas engine:", err);
    // Option 1 fallback
    return compileVideoMemeCanvas({
      videoUrl,
      textLayers,
      captionsList,
      videoTrimStart,
      videoTrimEnd,
      width,
      height,
      scale,
      canvasBg,
      onProgress
    });
  }
}
