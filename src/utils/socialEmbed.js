/**
 * socialEmbed.js — detect Instagram/X posts and lazy-load their official,
 * free embed widgets (no API keys, no scraping — same approach any blog
 * uses to embed a tweet or Instagram post).
 */

export function getSocialPlatform(url) {
  if (!url) return null;
  let host;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host === "instagram.com") return "instagram";
  if (host === "twitter.com" || host === "x.com") return "twitter";
  return null;
}

let instagramScriptPromise = null;
export function loadInstagramEmbedScript() {
  if (window.instgrm) return Promise.resolve();
  if (instagramScriptPromise) return instagramScriptPromise;
  instagramScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return instagramScriptPromise;
}

let twitterScriptPromise = null;
export function loadTwitterEmbedScript() {
  if (window.twttr?.widgets) return Promise.resolve();
  if (twitterScriptPromise) return twitterScriptPromise;
  twitterScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return twitterScriptPromise;
}
