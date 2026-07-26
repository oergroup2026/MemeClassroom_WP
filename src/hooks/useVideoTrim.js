/**
 * useVideoTrim — Lazy-loads ffmpeg.wasm and exposes a trimVideo() function.
 *
 * NOTE: Switched to single-threaded build of @ffmpeg/core to avoid the need
 * for Cross-Origin Isolation headers (COOP/COEP), which block Firebase Auth
 * redirect and popup flows.
 *
 * Compatible with @ffmpeg/ffmpeg ^0.12.x and @ffmpeg/util ^0.12.x
 */

import { useRef, useCallback } from "react";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export function useVideoTrim() {
  const ffmpegRef = useRef(null);
  const loadedRef = useRef(false);

  /** Lazily load ffmpeg.wasm (only once per page session). */
  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return;

    // Dynamic import keeps the 25 MB WASM bundle out of the initial JS bundle.
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const ffmpeg = new FFmpeg();

    ffmpegRef.current = ffmpeg;

    // Load single-threaded core from CDN to bypass COOP/COEP requirement
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    loadedRef.current = true;
  }, []);

  /**
   * Trim a video file from `start` to `end` seconds.
   *
   * @param {File}     file       — the original video File object
   * @param {number}   start      — trim start in seconds
   * @param {number}   end        — trim end in seconds
   * @param {Function} onProgress — optional callback(ratio: 0–1)
   * @returns {Promise<Blob>}      — the trimmed video blob (video/mp4)
   */
  const trimVideo = useCallback(async (file, start, end, onProgress) => {
    await ensureLoaded();

    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg) throw new Error("ffmpeg not loaded");

    // Wire progress
    const progressHandler = ({ progress }) => {
      if (onProgress) onProgress(progress);
    };
    ffmpeg.on("progress", progressHandler);

    try {
      const inputName = "input.mp4";
      const outputName = "output.mp4";
      const duration = end - start;

      // Write the input file into ffmpeg's virtual FS
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      // Trim: -ss before -i = fast seek; -c copy = no re-encode (instant)
      await ffmpeg.exec([
        "-ss", String(start),
        "-i", inputName,
        "-t", String(duration),
        "-c", "copy",
        "-avoid_negative_ts", "make_zero",
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data.buffer], { type: "video/mp4" });

      // Cleanup virtual FS
      try { await ffmpeg.deleteFile(inputName); } catch (_) {}
      try { await ffmpeg.deleteFile(outputName); } catch (_) {}

      return blob;
    } finally {
      ffmpeg.off("progress", progressHandler);
    }
  }, [ensureLoaded]);

  return { trimVideo };
}
