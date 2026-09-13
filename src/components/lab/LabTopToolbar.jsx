import React from "react";

export default function LabTopToolbar({
  activeTab,
  setActiveTab,
  tabIcons = {},
  historyIndex = 0,
  historyLength = 0,
  handleUndo,
  handleRedo,
  onOpenAiModal,
  onOpenExport,
  activeTextLayer,
  updateTextLayer,
  highContrastMode = false,
}) {
  const tabs = [
    { id: "image", label: "Image", icon: tabIcons["image"] || "🖼️" },
    { id: "video", label: "Video", icon: tabIcons["video"] || "🎬" },
    { id: "gif", label: "GIF", icon: tabIcons["gif"] || "⚡" },
    { id: "audio", label: "Audio", icon: tabIcons["audio"] || "🎵" },
  ];

  return (
    <header
      className={`shrink-0 w-full mb-2 px-3 py-2 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow-md backdrop-blur-md select-none transition-colors duration-200 ${
        highContrastMode
          ? "bg-zinc-950 border-zinc-800 text-white"
          : "bg-slate-900/95 border-slate-800 text-white"
      }`}
    >
      {/* Left: Studio Branding & Format Switcher */}
      <div className="flex items-center gap-2.5">
        {/* Studio Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#E0115F]/15 border border-[#E0115F]/40 rounded-lg text-xs font-black tracking-wider text-[#E0115F] dark:text-pink-400 shadow-[0_0_12px_rgba(224,17,95,0.25)]">
          <span className="text-sm">🎨</span>
          <span className="hidden sm:inline">MEME STUDIO</span>
          <span className="sm:hidden">STUDIO</span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden sm:block" />

        {/* Format Switcher Tabs with required tour ID: lab-format-tabs */}
        <nav
          id="lab-format-tabs"
          aria-label="Editor Media Formats"
          className="flex bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 gap-0.5 shadow-inner"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all duration-150 flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[#E0115F] text-white shadow-[0_0_12px_rgba(224,17,95,0.5)] scale-[1.02]"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
                aria-pressed={isActive}
              >
                <span className="text-xs">{tab.icon}</span>
                <span className="hidden md:inline font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Center: Contextual Active Layer or Quick Info + Undo/Redo */}
      <div className="flex items-center gap-2">
        {activeTextLayer ? (
          <div className="hidden lg:flex items-center gap-2 bg-slate-950/70 border border-slate-800/80 px-2.5 py-1 rounded-lg text-xs">
            <span className="text-[10px] text-[#E0115F] font-bold uppercase tracking-wider">
              Editing Text
            </span>
            <select
              value={activeTextLayer.fontFamily || "Impact"}
              onChange={(e) => updateTextLayer("fontFamily", e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-[11px] rounded px-1.5 py-0.5 focus:outline-none focus:border-[#E0115F]"
            >
              <option value="Impact">Impact</option>
              <option value="Arial">Arial Black</option>
              <option value="Comic Sans MS">Comic Sans</option>
              <option value="Courier New">Courier</option>
              <option value="Georgia">Georgia</option>
              <option value="Trebuchet MS">Trebuchet</option>
              <option value="Pacifico">Pacifico</option>
            </select>
            <input
              type="color"
              value={activeTextLayer.color || "#ffffff"}
              onChange={(e) => updateTextLayer("color", e.target.value)}
              title="Text Color"
              className="w-4 h-4 rounded cursor-pointer border border-slate-700 p-0 bg-transparent"
            />
          </div>
        ) : (
          <div className="hidden xl:flex items-center gap-1 text-[11px] text-slate-400">
            <span>✨ Drag layers on canvas to position</span>
          </div>
        )}

        {/* Undo & Redo Controls */}
        <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg p-0.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
            aria-label="Undo action"
            className="px-2 py-1 rounded text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300 hover:text-white"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIndex >= historyLength - 1}
            title="Redo (Ctrl+Y)"
            aria-label="Redo action"
            className="px-2 py-1 rounded text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300 hover:text-white"
          >
            ↷
          </button>
        </div>
      </div>

      {/* Right: AI Punchlines & Export Actions */}
      <div className="flex items-center gap-2">
        {/* AI Punchlines with tour ID: lab-ai-btn */}
        <button
          id="lab-ai-btn"
          type="button"
          onClick={onOpenAiModal}
          className="bg-gradient-to-r from-purple-900/40 via-[#E0115F]/30 to-pink-900/40 hover:from-purple-800/60 hover:to-[#E0115F]/60 text-pink-200 hover:text-white border border-[#E0115F]/40 font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
        >
          <span className="text-xs">⚡</span>
          <span className="hidden sm:inline">AI Punchlines</span>
          <span className="sm:hidden">AI</span>
        </button>

        {/* Export / Publish with tour ID: lab-publish-btn */}
        <button
          id="lab-publish-btn"
          type="button"
          onClick={onOpenExport}
          className="bg-gradient-to-r from-[#E0115F] to-rose-600 hover:from-[#c70d52] hover:to-rose-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-lg shadow-[0_0_15px_rgba(224,17,95,0.4)] transition-all flex items-center gap-1.5 active:scale-95"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          <span>Export</span>
        </button>
      </div>
    </header>
  );
}
