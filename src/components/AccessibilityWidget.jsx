import React, { useState, useEffect, useRef } from 'react';
import { useUdl } from '../context/UdlContext';

// ── Reusable UI primitives ────────────────────────────────────────────────────

/** A two-state pill toggle switch */
const PillToggle = ({ id, active, onClick }) => (
  <button
    id={id}
    aria-pressed={active}
    onClick={onClick}
    style={{
      width: '40px', height: '22px', borderRadius: '999px', border: 'none', padding: 0,
      background: active ? 'linear-gradient(135deg, #6366f1, #7c3aed)' : 'rgba(0,0,0,0.15)',
      cursor: 'pointer', position: 'relative', flexShrink: 0,
      transition: 'background 0.2s',
    }}
  >
    <span style={{
      position: 'absolute', top: '3px', left: active ? '21px' : '3px',
      width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
      boxShadow: '0 1px 4px rgba(0,0,0,0.2)', display: 'block',
      transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)',
    }} />
  </button>
);

/** A labelled row with a toggle switch */
const SwitchRow = ({ id, label, description, active, onClick, last = false }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: last ? 'none' : '1px solid rgba(0,0,0,0.06)',
  }}>
    <div style={{ flex: 1, paddingRight: '12px' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#1e1b4b' }}>{label}</div>
      {description && <div style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '1px' }}>{description}</div>}
    </div>
    <PillToggle id={id} active={active} onClick={onClick} />
  </div>
);

/** A section label above a group of controls */
const SectionLabel = ({ children }) => (
  <div style={{
    fontSize: '10px', fontWeight: 700, color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: '6px', marginTop: '10px',
  }}>
    {children}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
export default function AccessibilityWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('vision');
  const [guideY, setGuideY] = useState(200);
  const speechHandlers = useRef({ over: null, out: null, focus: null });

  const {
    // Phase 1
    highContrastMode, toggleHighContrast,
    highlightLinks, toggleHighlightLinks,
    textSpacing, toggleTextSpacing,
    pauseAnimations, togglePauseAnimations,
    hideImages, toggleHideImages,
    oversizedWidget, toggleOversizedWidget,
    resetAccessibilitySettings,
    // Phase 2
    screenReaderEnabled, screenReaderSpeed,
    toggleScreenReader, changeScreenReaderSpeed,
    dyslexiaFont, toggleDyslexiaFont,
    colorBlindMode, changeColorBlindMode,
    readingGuide, toggleReadingGuide,
    cursorSize, changeCursorSize,
    keyboardNav, toggleKeyboardNav,
    fontSizeScale, changeFontSizeScale,
    rtlMode, toggleRtlMode,
    alwaysShowSkipLinks, toggleAlwaysShowSkipLinks,
  } = useUdl();

  // ── Inject SVG color-blindness filter definitions once ────────────────────
  useEffect(() => {
    const SID = 'a11y-cb-filters';
    if (!document.getElementById(SID)) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = SID;
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
      svg.innerHTML = `<defs>
        <filter id="a11y-protanopia">
          <feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/>
        </filter>
        <filter id="a11y-deuteranopia">
          <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"/>
        </filter>
        <filter id="a11y-tritanopia">
          <feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/>
        </filter>
      </defs>`;
      document.body.appendChild(svg);
    }
    return () => document.getElementById('a11y-cb-filters')?.remove();
  }, []);

  // ── Inject skip navigation links once ────────────────────────────────────
  useEffect(() => {
    const SID = 'a11y-skip-links';
    if (!document.getElementById(SID)) {
      const div = document.createElement('div');
      div.id = SID;
      div.innerHTML = `
        <a href="#main-content" class="a11y-skip-link">Skip to main content</a>
        <a href="#app-navbar" class="a11y-skip-link">Skip to navigation</a>
        <a href="#app-footer" class="a11y-skip-link">Skip to footer</a>
      `;
      document.body.insertBefore(div, document.body.firstChild);
    }
    return () => document.getElementById('a11y-skip-links')?.remove();
  }, []);

  // ── Apply all global DOM classes / styles ─────────────────────────────────
  useEffect(() => {
    const html = document.documentElement;

    // Phase 1 classes
    html.classList.toggle('a11y-highlight-links', highlightLinks);
    html.classList.toggle('a11y-text-spacing', textSpacing);
    html.classList.toggle('a11y-pause-animations', pauseAnimations);
    html.classList.toggle('a11y-hide-images', hideImages);

    // Phase 2 classes
    html.classList.toggle('a11y-dyslexia-font', dyslexiaFont);
    html.classList.toggle('a11y-keyboard-nav', keyboardNav);
    html.classList.toggle('a11y-rtl', rtlMode);
    html.classList.toggle('a11y-skip-links-always', alwaysShowSkipLinks);

    // Color blindness (exclusive)
    ['protanopia', 'deuteranopia', 'tritanopia', 'grayscale'].forEach(m =>
      html.classList.toggle(`a11y-cb-${m}`, colorBlindMode === m)
    );

    // Cursor size (exclusive)
    html.classList.toggle('a11y-cursor-large', cursorSize === 'large');
    html.classList.toggle('a11y-cursor-xl', cursorSize === 'xl');

    // Font scale → direct style on html element
    html.style.fontSize = fontSizeScale === 100
      ? ''
      : `${(18 * fontSizeScale / 100).toFixed(1)}px`;

    // RTL attribute
    html.setAttribute('dir', rtlMode ? 'rtl' : 'ltr');
  }, [
    highlightLinks, textSpacing, pauseAnimations, hideImages,
    dyslexiaFont, keyboardNav, rtlMode, alwaysShowSkipLinks,
    colorBlindMode, cursorSize, fontSizeScale,
  ]);

  // ── Screen reader (Web Speech API) ────────────────────────────────────────
  useEffect(() => {
    const h = speechHandlers.current;

    const cleanup = () => {
      if (h.over)   document.removeEventListener('mouseover', h.over);
      if (h.out)    document.removeEventListener('mouseout',  h.out);
      if (h.focus)  document.removeEventListener('focus',     h.focus, true);
      h.over = h.out = h.focus = null;
    };

    if (screenReaderEnabled) {
      const speak = (text) => {
        if (!text || text.length < 2) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.slice(0, 300));
        u.rate = screenReaderSpeed;
        u.lang = document.documentElement.lang || 'en-US';
        window.speechSynthesis.speak(u);
      };

      const getText = (el) =>
        el.getAttribute('aria-label') ||
        el.getAttribute('alt') ||
        el.textContent?.trim() ||
        '';

      h.over = (e) => {
        if (e.target.closest('#a11y-widget-trigger') || e.target.closest('#a11y-panel')) return;
        speak(getText(e.target));
      };
      h.out   = () => window.speechSynthesis.cancel();
      h.focus = (e) => {
        if (e.target.closest('#a11y-widget-trigger') || e.target.closest('#a11y-panel')) return;
        speak(getText(e.target));
      };

      document.addEventListener('mouseover', h.over);
      document.addEventListener('mouseout',  h.out);
      document.addEventListener('focus',     h.focus, true);
    } else {
      window.speechSynthesis?.cancel();
      cleanup();
    }

    return cleanup;
  }, [screenReaderEnabled, screenReaderSpeed]);

  // ── Reading guide mouse tracker ───────────────────────────────────────────
  useEffect(() => {
    if (!readingGuide) return;
    const move = (e) => setGuideY(e.clientY);
    document.addEventListener('mousemove', move);
    return () => document.removeEventListener('mousemove', move);
  }, [readingGuide]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.key === 'u') { e.preventDefault(); setIsOpen(p => !p); }
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // ── Constants ─────────────────────────────────────────────────────────────
  const triggerSize = oversizedWidget ? 64 : 52;

  const CB_MODES = [
    { id: 'protanopia',   label: 'Protan.',  title: 'Protanopia — red-blind' },
    { id: 'deuteranopia', label: 'Deutan.',  title: 'Deuteranopia — green-blind' },
    { id: 'tritanopia',   label: 'Tritan.',  title: 'Tritanopia — blue-blind' },
    { id: 'grayscale',    label: 'Gray',     title: 'Grayscale / Achromatopsia' },
  ];

  const SPEEDS = [0.75, 1, 1.25, 1.5];
  const CURSOR_SIZES = [
    { id: 'normal', label: 'Normal' },
    { id: 'large',  label: 'Large' },
    { id: 'xl',     label: 'X-Large' },
  ];

  // ── Tab styles ────────────────────────────────────────────────────────────
  const tabBtn = (id) => ({
    flex: 1, padding: '9px 4px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '10.5px', fontWeight: activeTab === id ? 700 : 500,
    color: activeTab === id ? '#4f46e5' : '#6b7280',
    background: 'transparent',
    borderBottom: `2.5px solid ${activeTab === id ? '#6366f1' : 'transparent'}`,
    transition: 'all 0.15s',
  });

  // ── Chip button (for CB modes, cursor sizes, speed) ──────────────────────
  const chipBtn = (active) => ({
    padding: '5px 6px', borderRadius: '8px', border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '10px', fontWeight: 600, transition: 'all 0.15s',
    background: active ? 'rgba(99,102,241,0.14)' : 'rgba(0,0,0,0.06)',
    color: active ? '#4f46e5' : '#374151',
    outline: active ? '2px solid #6366f1' : '2px solid transparent',
    outlineOffset: '1px',
  });

  return (
    <>
      {/* ── Reading Guide Overlay ──────────────────────────────────────── */}
      {readingGuide && (
        <>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0,
            height: `${Math.max(0, guideY - 36)}px`,
            background: 'rgba(0,0,0,0.32)', pointerEvents: 'none', zIndex: 9990,
          }} />
          <div style={{
            position: 'fixed', left: 0, right: 0,
            top: `${Math.max(0, guideY - 36)}px`, height: '72px',
            background: 'rgba(255,253,180,0.07)',
            borderTop: '2px solid rgba(99,102,241,0.55)',
            borderBottom: '2px solid rgba(99,102,241,0.55)',
            pointerEvents: 'none', zIndex: 9990,
          }} />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0,
            top: `${guideY + 36}px`,
            background: 'rgba(0,0,0,0.32)', pointerEvents: 'none', zIndex: 9990,
          }} />
        </>
      )}

      {/* ── Floating Trigger Button ───────────────────────────────────── */}
      <button
        id="a11y-widget-trigger"
        aria-label="Open accessibility menu (Ctrl+U)"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(p => !p)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px',
          width: `${triggerSize}px`, height: `${triggerSize}px`,
          borderRadius: '50%',
          background: isOpen
            ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
            : 'linear-gradient(135deg, #16a34a, #15803d)',
          color: '#fff', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.28)',
          zIndex: 9999, transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
          transform: isOpen ? 'scale(1.06) rotate(10deg)' : 'scale(1)',
        }}
      >
        {/* Person with arms raised — inclusive universal access icon */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="5" r="2.5" fill="currentColor" stroke="none"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="5"  y1="9" x2="12" y2="12"/>
          <line x1="19" y1="9" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="9"  y2="21"/>
          <line x1="12" y1="16" x2="15" y2="21"/>
        </svg>
      </button>

      {/* ── Widget Panel ─────────────────────────────────────────────── */}
      {isOpen && (
        <div
          id="a11y-panel"
          role="dialog"
          aria-label="Accessibility options"
          aria-modal="false"
          className="a11y-panel-enter"
          style={{
            position: 'fixed', bottom: `${triggerSize + 30}px`, right: '24px',
            width: '324px', zIndex: 9998, borderRadius: '18px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
            border: '1px solid rgba(99,102,241,0.16)',
            boxShadow: '0 22px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(99,102,241,0.08)',
            overflow: 'hidden', fontFamily: 'inherit',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 16px 11px',
            borderBottom: '1px solid rgba(0,0,0,0.07)',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.07), rgba(124,58,237,0.03))',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#1e1b4b', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="6" r="2.5" fill="#6366f1" stroke="none"/>
                  <line x1="12" y1="9" x2="12" y2="16"/>
                  <line x1="6" y1="10.5" x2="12" y2="13"/>
                  <line x1="18" y1="10.5" x2="12" y2="13"/>
                  <line x1="12" y1="16" x2="10" y2="21"/>
                  <line x1="12" y1="16" x2="14" y2="21"/>
                </svg>
                Accessibility Options
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '1px' }}>
                Ctrl+U to toggle · Esc to close
              </div>
            </div>
            <button
              id="a11y-widget-close"
              aria-label="Close accessibility menu"
              onClick={() => setIsOpen(false)}
              style={{
                width: '28px', height: '28px', borderRadius: '8px', border: 'none',
                background: 'rgba(0,0,0,0.06)', color: '#6b7280', cursor: 'pointer',
                fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>

          {/* Tab Bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            {[
              { id: 'vision',    label: '👁 Vision' },
              { id: 'cognitive', label: '🧠 Cognitive' },
              { id: 'navigation',label: '⌨️ Navigate' },
            ].map(t => (
              <button key={t.id} id={`a11y-tab-${t.id}`} onClick={() => setActiveTab(t.id)} style={tabBtn(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Scrollable Tab Content */}
          <div style={{ maxHeight: '360px', overflowY: 'auto', overflowX: 'hidden' }}>

            {/* ── Vision Tab ──────────────────────────────────────────── */}
            {activeTab === 'vision' && (
              <div style={{ padding: '12px 14px 14px' }}>
                {/* Top row toggles */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  {[
                    { id: 'a11y-btn-contrast', label: 'Contrast +', icon: '◑', active: highContrastMode, onClick: toggleHighContrast },
                    { id: 'a11y-btn-images',   label: 'Hide Images', icon: '🖼️', active: hideImages,       onClick: toggleHideImages },
                  ].map(b => (
                    <button
                      key={b.id} id={b.id} onClick={b.onClick} aria-pressed={b.active}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: '5px', padding: '11px 8px', borderRadius: '12px',
                        border: `2px solid ${b.active ? '#6366f1' : 'rgba(0,0,0,0.09)'}`,
                        background: b.active
                          ? 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(124,58,237,0.06))'
                          : 'rgba(255,255,255,0.7)',
                        color: b.active ? '#4f46e5' : '#374151',
                        cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                        fontFamily: 'inherit', minHeight: '68px',
                        boxShadow: b.active ? '0 0 0 3px rgba(99,102,241,0.15)' : '0 1px 3px rgba(0,0,0,0.07)',
                        transition: 'all 0.18s',
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{b.icon}</span>
                      <span>{b.label}</span>
                    </button>
                  ))}
                </div>

                {/* Color Blindness */}
                <SectionLabel>Color Blindness Mode</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', marginBottom: '12px' }}>
                  {CB_MODES.map(({ id, label, title }) => (
                    <button
                      key={id} id={`a11y-btn-cb-${id}`} title={title}
                      onClick={() => changeColorBlindMode(colorBlindMode === id ? 'none' : id)}
                      aria-pressed={colorBlindMode === id}
                      style={chipBtn(colorBlindMode === id)}
                    >{label}</button>
                  ))}
                </div>

                {/* Font Size Slider */}
                <SectionLabel>Text Size — {fontSizeScale}%</SectionLabel>
                <input
                  id="a11y-slider-fontsize" type="range" min={80} max={150} step={5}
                  value={fontSizeScale}
                  onChange={e => changeFontSizeScale(Number(e.target.value))}
                  aria-label={`Text size ${fontSizeScale}%`}
                  style={{ width: '100%', accentColor: '#6366f1', marginBottom: '3px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#9ca3af', marginBottom: '12px' }}>
                  <span>80% (smaller)</span><span>100%</span><span>150% (larger)</span>
                </div>

                {/* Cursor Size */}
                <SectionLabel>Cursor Size</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                  {CURSOR_SIZES.map(({ id, label }) => (
                    <button
                      key={id} id={`a11y-btn-cursor-${id}`}
                      onClick={() => changeCursorSize(id)}
                      aria-pressed={cursorSize === id}
                      style={{ ...chipBtn(cursorSize === id), padding: '7px 4px', fontSize: '11px' }}
                    >{label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Cognitive Tab ────────────────────────────────────────── */}
            {activeTab === 'cognitive' && (
              <div style={{ padding: '6px 14px 14px' }}>
                <SwitchRow id="a11y-sw-dyslexia"   label="Dyslexia Font"      description="Switches to OpenDyslexic font globally"          active={dyslexiaFont}    onClick={toggleDyslexiaFont} />
                <SwitchRow id="a11y-sw-guide"       label="Reading Guide"      description="Dims the page, highlights the current line"       active={readingGuide}    onClick={toggleReadingGuide} />
                <SwitchRow id="a11y-sw-spacing"     label="Text Spacing"       description="Wider letters, words, and line height"             active={textSpacing}     onClick={toggleTextSpacing} />
                <SwitchRow id="a11y-sw-pause"       label="Pause Animations"   description="Stops all CSS animations and transitions"         active={pauseAnimations} onClick={togglePauseAnimations} />

                {/* Screen Reader row + speed control */}
                <div style={{ paddingTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: screenReaderEnabled ? '10px' : '0' }}>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#1e1b4b' }}>Screen Reader</div>
                      <div style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '1px' }}>Reads hovered / focused text aloud</div>
                    </div>
                    <PillToggle id="a11y-sw-reader" active={screenReaderEnabled} onClick={toggleScreenReader} />
                  </div>
                  {screenReaderEnabled && (
                    <div style={{
                      background: 'rgba(99,102,241,0.07)', borderRadius: '10px', padding: '8px 10px',
                      display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
                    }}>
                      <span style={{ fontSize: '10.5px', color: '#6b7280', fontWeight: 600, marginRight: '2px' }}>Speed:</span>
                      {SPEEDS.map(s => (
                        <button key={s} onClick={() => changeScreenReaderSpeed(s)} aria-pressed={screenReaderSpeed === s}
                          style={{
                            padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            fontFamily: 'inherit', fontSize: '11px', fontWeight: 600, transition: 'all 0.15s',
                            background: screenReaderSpeed === s ? '#6366f1' : 'rgba(0,0,0,0.08)',
                            color: screenReaderSpeed === s ? '#fff' : '#374151',
                          }}
                        >{s}×</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Navigation Tab ───────────────────────────────────────── */}
            {activeTab === 'navigation' && (
              <div style={{ padding: '6px 14px 14px' }}>
                <SwitchRow id="a11y-sw-keyboard"  label="Keyboard Navigator"    description="Bold focus ring for keyboard-only navigation"     active={keyboardNav}          onClick={toggleKeyboardNav} />
                <SwitchRow id="a11y-sw-links"     label="Highlight Links"        description="Amber outline around all hyperlinks"             active={highlightLinks}       onClick={toggleHighlightLinks} />
                <SwitchRow id="a11y-sw-skip"      label="Always Show Skip Links" description="Keep 'Skip to content' links always visible"     active={alwaysShowSkipLinks}  onClick={toggleAlwaysShowSkipLinks} />
                <SwitchRow id="a11y-sw-rtl"       label="Right-to-Left Mode"     description="For Arabic, Hebrew, and Urdu speakers"           active={rtlMode}              onClick={toggleRtlMode} last />
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 14px 13px', borderTop: '1px solid rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(249,250,251,0.6)',
          }}>
            {/* Oversized Widget toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>Oversized Widget</span>
              <PillToggle id="a11y-btn-oversized" active={oversizedWidget} onClick={toggleOversizedWidget} />
            </div>

            {/* Reset All */}
            <button
              id="a11y-btn-reset"
              onClick={resetAccessibilitySettings}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 13px', borderRadius: '8px',
                border: '1.5px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.06)', color: '#dc2626',
                cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >↺ Reset All</button>
          </div>
        </div>
      )}
    </>
  );
}
