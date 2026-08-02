import React, { createContext, useContext, useState, useEffect } from "react";

const UdlContext = createContext();

export const UdlProvider = ({ children }) => {
  // ── Phase 1 states ─────────────────────────────────────────────────────────
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [textToSpeechEnabled, setTextToSpeechEnabled] = useState(false);
  const [fontSizeAdjustment, setFontSizeAdjustment] = useState("normal"); // legacy – kept for compat
  const [closedCaptionsEnabled, setClosedCaptionsEnabled] = useState(true);
  const [highlightLinks, setHighlightLinks] = useState(false);
  const [textSpacing, setTextSpacing] = useState(false);
  const [pauseAnimations, setPauseAnimations] = useState(false);
  const [hideImages, setHideImages] = useState(false);
  const [oversizedWidget, setOversizedWidget] = useState(false);

  // ── Phase 2 states ─────────────────────────────────────────────────────────
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const [screenReaderSpeed, setScreenReaderSpeed] = useState(1); // 0.75 | 1 | 1.25 | 1.5
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [colorBlindMode, setColorBlindMode] = useState("none"); // none | protanopia | deuteranopia | tritanopia | grayscale
  const [readingGuide, setReadingGuide] = useState(false);
  const [cursorSize, setCursorSize] = useState("normal"); // normal | large | xl
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [fontSizeScale, setFontSizeScale] = useState(100); // 80–150 percent
  const [rtlMode, setRtlMode] = useState(false);
  const [alwaysShowSkipLinks, setAlwaysShowSkipLinks] = useState(false);

  // ── Rehydrate from localStorage ────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("udl_settings");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        setHighContrastMode(p.highContrastMode ?? false);
        setTextToSpeechEnabled(p.textToSpeechEnabled ?? false);
        setFontSizeAdjustment(p.fontSizeAdjustment ?? "normal");
        setClosedCaptionsEnabled(p.closedCaptionsEnabled ?? true);
        setHighlightLinks(p.highlightLinks ?? false);
        setTextSpacing(p.textSpacing ?? false);
        setPauseAnimations(p.pauseAnimations ?? false);
        setHideImages(p.hideImages ?? false);
        setOversizedWidget(p.oversizedWidget ?? false);
        setScreenReaderEnabled(p.screenReaderEnabled ?? false);
        setScreenReaderSpeed(p.screenReaderSpeed ?? 1);
        setDyslexiaFont(p.dyslexiaFont ?? false);
        setColorBlindMode(p.colorBlindMode ?? "none");
        setReadingGuide(p.readingGuide ?? false);
        setCursorSize(p.cursorSize ?? "normal");
        setKeyboardNav(p.keyboardNav ?? false);
        setFontSizeScale(p.fontSizeScale ?? 100);
        setRtlMode(p.rtlMode ?? false);
        setAlwaysShowSkipLinks(p.alwaysShowSkipLinks ?? false);
      } catch (e) {
        console.error("Failed to parse UDL settings", e);
      }
    }
  }, []);

  // ── Central snapshot helper (reads current closure values) ─────────────────
  const buildSettings = (overrides = {}) => ({
    highContrastMode, textToSpeechEnabled, fontSizeAdjustment, closedCaptionsEnabled,
    highlightLinks, textSpacing, pauseAnimations, hideImages, oversizedWidget,
    screenReaderEnabled, screenReaderSpeed, dyslexiaFont, colorBlindMode,
    readingGuide, cursorSize, keyboardNav, fontSizeScale, rtlMode, alwaysShowSkipLinks,
    ...overrides,
  });

  const saveSettings = (s) => localStorage.setItem("udl_settings", JSON.stringify(s));

  // ── Phase 1 toggles ────────────────────────────────────────────────────────
  const toggleHighContrast = () =>
    setHighContrastMode(prev => { const n = !prev; saveSettings(buildSettings({ highContrastMode: n })); return n; });

  const toggleTextToSpeech = () =>
    setTextToSpeechEnabled(prev => { const n = !prev; saveSettings(buildSettings({ textToSpeechEnabled: n })); return n; });

  const changeFontSize = (level) => {
    setFontSizeAdjustment(level);
    saveSettings(buildSettings({ fontSizeAdjustment: level }));
  };

  const toggleClosedCaptions = () =>
    setClosedCaptionsEnabled(prev => { const n = !prev; saveSettings(buildSettings({ closedCaptionsEnabled: n })); return n; });

  const toggleHighlightLinks = () =>
    setHighlightLinks(prev => { const n = !prev; saveSettings(buildSettings({ highlightLinks: n })); return n; });

  const toggleTextSpacing = () =>
    setTextSpacing(prev => { const n = !prev; saveSettings(buildSettings({ textSpacing: n })); return n; });

  const togglePauseAnimations = () =>
    setPauseAnimations(prev => { const n = !prev; saveSettings(buildSettings({ pauseAnimations: n })); return n; });

  const toggleHideImages = () =>
    setHideImages(prev => { const n = !prev; saveSettings(buildSettings({ hideImages: n })); return n; });

  const toggleOversizedWidget = () =>
    setOversizedWidget(prev => { const n = !prev; saveSettings(buildSettings({ oversizedWidget: n })); return n; });

  // ── Phase 2 toggles ────────────────────────────────────────────────────────
  const toggleScreenReader = () =>
    setScreenReaderEnabled(prev => { const n = !prev; saveSettings(buildSettings({ screenReaderEnabled: n })); return n; });

  const changeScreenReaderSpeed = (s) => {
    setScreenReaderSpeed(s);
    saveSettings(buildSettings({ screenReaderSpeed: s }));
  };

  const toggleDyslexiaFont = () =>
    setDyslexiaFont(prev => { const n = !prev; saveSettings(buildSettings({ dyslexiaFont: n })); return n; });

  const changeColorBlindMode = (mode) => {
    setColorBlindMode(mode);
    saveSettings(buildSettings({ colorBlindMode: mode }));
  };

  const toggleReadingGuide = () =>
    setReadingGuide(prev => { const n = !prev; saveSettings(buildSettings({ readingGuide: n })); return n; });

  const changeCursorSize = (size) => {
    setCursorSize(size);
    saveSettings(buildSettings({ cursorSize: size }));
  };

  const toggleKeyboardNav = () =>
    setKeyboardNav(prev => { const n = !prev; saveSettings(buildSettings({ keyboardNav: n })); return n; });

  const changeFontSizeScale = (scale) => {
    setFontSizeScale(scale);
    saveSettings(buildSettings({ fontSizeScale: scale }));
  };

  const toggleRtlMode = () =>
    setRtlMode(prev => { const n = !prev; saveSettings(buildSettings({ rtlMode: n })); return n; });

  const toggleAlwaysShowSkipLinks = () =>
    setAlwaysShowSkipLinks(prev => { const n = !prev; saveSettings(buildSettings({ alwaysShowSkipLinks: n })); return n; });

  // ── Reset all accessibility settings ──────────────────────────────────────
  const resetAccessibilitySettings = () => {
    const defaults = {
      highContrastMode: false, fontSizeAdjustment: "normal",
      highlightLinks: false, textSpacing: false, pauseAnimations: false, hideImages: false,
      screenReaderEnabled: false, dyslexiaFont: false, colorBlindMode: "none",
      readingGuide: false, cursorSize: "normal", keyboardNav: false,
      fontSizeScale: 100, rtlMode: false, alwaysShowSkipLinks: false,
    };
    setHighContrastMode(false); setFontSizeAdjustment("normal");
    setHighlightLinks(false); setTextSpacing(false); setPauseAnimations(false); setHideImages(false);
    setScreenReaderEnabled(false); setDyslexiaFont(false); setColorBlindMode("none");
    setReadingGuide(false); setCursorSize("normal"); setKeyboardNav(false);
    setFontSizeScale(100); setRtlMode(false); setAlwaysShowSkipLinks(false);
    saveSettings(buildSettings(defaults));
  };

  return (
    <UdlContext.Provider value={{
      // Phase 1
      highContrastMode, textToSpeechEnabled, fontSizeAdjustment, closedCaptionsEnabled,
      highlightLinks, textSpacing, pauseAnimations, hideImages, oversizedWidget,
      toggleHighContrast, toggleTextToSpeech, changeFontSize, toggleClosedCaptions,
      toggleHighlightLinks, toggleTextSpacing, togglePauseAnimations, toggleHideImages,
      toggleOversizedWidget, resetAccessibilitySettings,
      // Phase 2
      screenReaderEnabled, screenReaderSpeed, dyslexiaFont, colorBlindMode,
      readingGuide, cursorSize, keyboardNav, fontSizeScale, rtlMode, alwaysShowSkipLinks,
      toggleScreenReader, changeScreenReaderSpeed, toggleDyslexiaFont, changeColorBlindMode,
      toggleReadingGuide, changeCursorSize, toggleKeyboardNav, changeFontSizeScale,
      toggleRtlMode, toggleAlwaysShowSkipLinks,
    }}>
      {children}
    </UdlContext.Provider>
  );
};

export const useUdl = () => {
  const context = useContext(UdlContext);
  if (!context) throw new Error("useUdl must be used within a UdlProvider");
  return context;
};
