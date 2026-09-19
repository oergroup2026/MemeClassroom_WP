/**
 * ffmpegLoader.js — loads ffmpeg.wasm from our own origin, with a timeout.
 *
 * Previously both callers fetched the ~32MB core from unpkg.com at runtime.
 * That had three problems:
 *   1. School and district networks routinely block public CDNs, and there was
 *      no timeout — a blocked request left the Lab sitting on "Initializing
 *      FFmpeg..." forever, with no error and no way out.
 *   2. It ran unpinned third-party code, with no integrity check, in our users'
 *      browsers.
 *   3. It made a core feature depend on a service we do not control.
 *
 * @ffmpeg/core is now a dependency, and Vite's `?url` import emits both files
 * as ordinary hashed assets served from the same origin as the app. They stay
 * out of the JavaScript bundle — nothing downloads them until a user actually
 * opens a video tool.
 *
 * Single-threaded core is deliberate: the multi-threaded build requires
 * cross-origin isolation (COOP/COEP), which breaks Firebase Auth popups.
 */

import { toBlobURL } from "@ffmpeg/util";
// Via the package's declared export subpaths ("." and "./wasm"); deep paths
// into dist/ are blocked by its exports field.
import coreUrl from "@ffmpeg/core?url";
import wasmUrl from "@ffmpeg/core/wasm?url";

/** How long to wait for the core to fetch and initialise before giving up. */
const LOAD_TIMEOUT_MS = 90_000;

export class FFmpegLoadError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "FFmpegLoadError";
    this.cause = cause;
  }
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new FFmpegLoadError(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// The blob URLs are identical for every instance, so fetch and build them once
// per page session and reuse. Concurrent callers share the same in-flight
// promise rather than each pulling 32MB.
let blobUrlsPromise = null;

function getCoreBlobUrls() {
  if (!blobUrlsPromise) {
    blobUrlsPromise = Promise.all([
      toBlobURL(coreUrl, "text/javascript"),
      toBlobURL(wasmUrl, "application/wasm"),
    ]).catch((err) => {
      // Don't cache a failure — let the next attempt retry.
      blobUrlsPromise = null;
      throw err;
    });
  }
  return blobUrlsPromise;
}

/**
 * Create and load an FFmpeg instance.
 *
 * @returns {Promise<import("@ffmpeg/ffmpeg").FFmpeg>}
 * @throws {FFmpegLoadError} if loading times out or fails, with a message
 *         suitable for showing directly to a user.
 */
export async function createLoadedFFmpeg() {
  try {
    return await withTimeout(
      (async () => {
        const { FFmpeg } = await import("@ffmpeg/ffmpeg");
        const [coreURL, wasmURL] = await getCoreBlobUrls();
        const ffmpeg = new FFmpeg();
        await ffmpeg.load({ coreURL, wasmURL });
        return ffmpeg;
      })(),
      LOAD_TIMEOUT_MS,
      "The video engine took too long to start. This can happen on a slow or restricted network — please check your connection and try again."
    );
  } catch (err) {
    if (err instanceof FFmpegLoadError) throw err;
    throw new FFmpegLoadError(
      "The video engine could not be loaded on this device or browser. Please try a different browser, or use a smaller image or GIF instead.",
      err
    );
  }
}
