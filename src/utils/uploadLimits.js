/**
 * uploadLimits.js — shared client-side upload guards.
 *
 * These mirror the caps enforced in storage.rules. The rules are the real
 * boundary (a client check can always be bypassed); this exists so a user gets
 * a clear, immediate message instead of an upload that runs for a long time and
 * then fails with a raw Firebase permission error.
 *
 * Sizes are deliberately modest: the Meme Lab feeds uploaded video through
 * single-threaded ffmpeg.wasm in the browser, and a large file will exhaust
 * memory and kill the tab on a mid-range phone long before Firebase objects.
 */

export const UPLOAD_LIMITS = {
  image: 10,
  video: 50,
  audio: 20,
  document: 20,
  avatar: 5,
  idCard: 5,
};

const MB = 1024 * 1024;

/** Coarse category for a File, matching the content-type families in storage.rules. */
export function fileKind(file) {
  const type = file?.type || "";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "document";
}

/**
 * Returns a human-readable error string if the file is not acceptable,
 * or null if it is fine.
 *
 * @param {File}   file
 * @param {object} [opts]
 * @param {string} [opts.as]      — force a category (e.g. "avatar", "idCard")
 * @param {string[]} [opts.allow] — permitted categories, e.g. ["image", "video"]
 */
export function checkUpload(file, opts = {}) {
  if (!file) return "Please choose a file.";

  const kind = opts.as || fileKind(file);

  if (opts.allow && !opts.allow.includes(kind)) {
    const pretty = opts.allow.join(", ");
    return `That file type isn't supported here. Please upload: ${pretty}.`;
  }

  const limitMb = UPLOAD_LIMITS[kind] ?? UPLOAD_LIMITS.document;
  if (file.size > limitMb * MB) {
    const actual = (file.size / MB).toFixed(1);
    return `That file is ${actual}MB, which is over the ${limitMb}MB limit. Please choose a smaller file.`;
  }

  return null;
}
