/**
 * Web Speech API Text-to-Speech (TTS) Utility
 * 100% Free, zero external API, runs natively in user's browser.
 */

class SpeechService {
  constructor() {
    this.synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
    this.speakingId = null;
    this.callbacks = new Set();
  }

  isSupported() {
    return !!this.synth;
  }

  subscribe(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  notify() {
    this.callbacks.forEach(cb => cb(this.speakingId));
  }

  speak(text, id = "global", onEndCallback = null) {
    if (!this.synth) return;

    // If currently speaking this exact item, toggle off (stop)
    if (this.speakingId === id) {
      this.stop();
      return;
    }

    // Stop any existing speech
    this.stop();

    if (!text || typeof text !== "string" || !text.trim()) return;

    // Clean markdown/HTML tags from speech text
    const cleanText = text
      .replace(/<[^>]*>?/gm, "")
      .replace(/[#*_`~[\]]/g, "")
      .replace(/https?:\/\/\S+/g, "link")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try selecting an English natural voice if available
    const voices = this.synth.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha")));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      this.speakingId = id;
      this.notify();
    };

    utterance.onend = () => {
      this.speakingId = null;
      this.notify();
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = (e) => {
      console.warn("TTS Error:", e);
      this.speakingId = null;
      this.notify();
      if (onEndCallback) onEndCallback();
    };

    this.synth.speak(utterance);
  }

  stop() {
    if (!this.synth) return;
    this.synth.cancel();
    this.speakingId = null;
    this.notify();
  }

  isSpeaking(id = null) {
    if (id) return this.speakingId === id;
    return !!this.speakingId;
  }
}

export const speechService = new SpeechService();
