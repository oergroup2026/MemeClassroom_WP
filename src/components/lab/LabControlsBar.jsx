import React from "react";

export default function LabControlsBar({
  activeTab,
  bottomControlTab = "text",
  setBottomControlTab,
  textLayers = [],
  setTextLayers,
  selectedTextId,
  setSelectedTextId,
  activeTextLayer,
  updateTextLayer,
  deleteSelectedText,
  duplicateSelectedText,
  addTextLayer,
  images = [],
  collageLayout = "single",
  setCollageLayout,
  activeFilter = "none",
  setActiveFilter,
  activeEffect = "none",
  setActiveEffect,
  filterBrightness = 100,
  setFilterBrightness,
  filterContrast = 100,
  setFilterContrast,
  filterSaturation = 100,
  setFilterSaturation,
  highContrastMode = false,
}) {
  const COLOR_SWATCHES = ["#ffffff", "#000000", "#E0115F", "#facc15", "#06b6d4", "#22c55e", "#a855f7", "#ef4444"];
  const EMOJI_STICKERS = ["😂", "💀", "🔥", "🤓", "📚", "🧠", "💯", "🎓", "🤔", "🎯", "✨", "👀"];

  const handleAddEmoji = (emoji) => {
    if (typeof addTextLayer === "function") {
      addTextLayer(emoji, 50, 50, 48);
    }
  };

  const resetAllFilters = () => {
    setActiveFilter("none");
    setActiveEffect("none");
    setFilterBrightness(100);
    setFilterContrast(100);
    setFilterSaturation(100);
  };

  return (
    <div
      className={`shrink-0 w-full mt-2 rounded-xl border shadow-sm flex flex-col select-none transition-colors duration-200 overflow-hidden ${
        highContrastMode
          ? "bg-zinc-950 border-zinc-800 text-white"
          : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-gray-800 dark:text-zinc-200"
      }`}
    >
      {/* Mini Control Tabs Bar: Text | Image | Filters | Effects */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/90">
        <div className="flex items-center gap-1">
          {[
            { id: "text", label: "Text", icon: "✍️", count: textLayers.length },
            { id: "image", label: "Image", icon: "🖼️", count: images.length },
            { id: "filters", label: "Filters", icon: "🎨", active: activeFilter !== "none" },
            { id: "effects", label: "Effects", icon: "⚡", active: activeEffect !== "none" },
          ].map((tab) => {
            const isSelected = bottomControlTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setBottomControlTab(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#E0115F] text-white shadow-sm scale-[1.02]"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="text-xs">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`text-[10px] px-1 rounded-full ${
                      isSelected
                        ? "bg-white/30 text-white"
                        : "bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Add Text Action */}
        {bottomControlTab === "text" && (
          <button
            type="button"
            onClick={() => addTextLayer("NEW TEXT", 50, 50, 32)}
            className="px-2.5 py-0.5 bg-[#E0115F]/15 hover:bg-[#E0115F]/25 text-[#E0115F] dark:text-pink-400 border border-[#E0115F]/30 rounded-lg text-xs font-bold transition flex items-center gap-1"
          >
            <span>+</span>
            <span>Add Layer</span>
          </button>
        )}

        {(bottomControlTab === "filters" || bottomControlTab === "effects") && (
          <button
            type="button"
            onClick={resetAllFilters}
            className="text-[10px] text-slate-400 hover:text-rose-500 font-semibold transition"
          >
            ↺ Reset
          </button>
        )}
      </div>

      {/* Control Content Panels */}
      <div className="p-2.5 overflow-x-auto">
        {/* TAB 1: TEXT CONTROLS */}
        {bottomControlTab === "text" && (
          <div className="flex flex-col gap-2">
            {/* Layer switcher chips if multiple layers */}
            {textLayers.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                  Layers:
                </span>
                {textLayers.map((layer, idx) => {
                  const isCur = layer.id === selectedTextId;
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => setSelectedTextId(layer.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium shrink-0 transition flex items-center gap-1 border ${
                        isCur
                          ? "bg-[#E0115F]/15 text-[#E0115F] dark:text-pink-400 border-[#E0115F]/40 font-bold"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-transparent hover:border-slate-300"
                      }`}
                    >
                      <span>#{idx + 1}</span>
                      <span className="max-w-[70px] truncate">{layer.text || "Empty"}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* If a text layer is selected, show its full controls in a compact responsive row */}
            {activeTextLayer ? (
              <div className="flex flex-wrap items-center gap-2">
                {/* Text String Input */}
                <div className="flex-1 min-w-[160px]">
                  <input
                    type="text"
                    value={activeTextLayer.text}
                    onChange={(e) => updateTextLayer("text", e.target.value)}
                    placeholder="Type meme text..."
                    className="w-full px-2.5 py-1 text-xs bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-[#E0115F] text-gray-900 dark:text-white"
                  />
                </div>

                {/* Font Family Picker */}
                <select
                  value={activeTextLayer.fontFamily || "Impact"}
                  onChange={(e) => updateTextLayer("fontFamily", e.target.value)}
                  className="px-2 py-1 text-xs bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-gray-800 dark:text-zinc-200 focus:outline-none"
                >
                  <option value="Impact">Impact</option>
                  <option value="Arial">Arial Black</option>
                  <option value="Comic Sans MS">Comic Sans</option>
                  <option value="Courier New">Courier</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Trebuchet MS">Trebuchet</option>
                  <option value="Pacifico">Pacifico</option>
                  <option value="Montserrat">Montserrat</option>
                </select>

                {/* Font Size Slider */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-lg border border-slate-300 dark:border-zinc-700">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Size</span>
                  <input
                    type="range"
                    min="14"
                    max="90"
                    value={activeTextLayer.fontSize || 32}
                    onChange={(e) => updateTextLayer("fontSize", parseInt(e.target.value))}
                    className="w-16 accent-[#E0115F] h-1 bg-slate-300 dark:bg-zinc-700 rounded cursor-pointer"
                  />
                  <span className="text-[10px] font-mono font-bold w-5 text-right text-slate-700 dark:text-zinc-300">
                    {activeTextLayer.fontSize || 32}
                  </span>
                </div>

                {/* Color Swatches */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg border border-slate-300 dark:border-zinc-700">
                  {COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => updateTextLayer("color", swatch)}
                      style={{ backgroundColor: swatch }}
                      className={`w-3.5 h-3.5 rounded-full border transition hover:scale-125 ${
                        activeTextLayer.color === swatch
                          ? "ring-2 ring-[#E0115F] scale-110 border-white"
                          : "border-slate-400/50"
                      }`}
                      title={swatch}
                    />
                  ))}
                  <input
                    type="color"
                    value={activeTextLayer.color || "#ffffff"}
                    onChange={(e) => updateTextLayer("color", e.target.value)}
                    className="w-4 h-4 rounded cursor-pointer border border-slate-400 p-0 bg-transparent ml-0.5"
                    title="Custom color"
                  />
                </div>

                {/* Style Toggles */}
                <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-slate-300 dark:border-zinc-700 gap-0.5">
                  <button
                    type="button"
                    onClick={() => updateTextLayer("bold", !activeTextLayer.bold)}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition ${
                      activeTextLayer.bold ? "bg-[#E0115F] text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="Bold"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTextLayer("italic", !activeTextLayer.italic)}
                    className={`px-2 py-0.5 rounded text-xs italic font-bold transition ${
                      activeTextLayer.italic ? "bg-[#E0115F] text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="Italic"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTextLayer("uppercase", !activeTextLayer.uppercase)}
                    className={`px-1.5 py-0.5 rounded text-xs font-bold transition ${
                      activeTextLayer.uppercase ? "bg-[#E0115F] text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="UPPERCASE"
                  >
                    TT
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTextLayer("shadow", !activeTextLayer.shadow)}
                    className={`px-1.5 py-0.5 rounded text-xs font-bold transition ${
                      activeTextLayer.shadow ? "bg-[#E0115F] text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="Text Drop Shadow"
                  >
                    S
                  </button>
                </div>

                {/* Text Alignment */}
                <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-slate-300 dark:border-zinc-700 gap-0.5">
                  {["left", "center", "right"].map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => updateTextLayer("align", align)}
                      className={`px-1.5 py-0.5 rounded text-xs transition ${
                        (activeTextLayer.align || "center") === align
                          ? "bg-[#E0115F] text-white"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                      title={`Align ${align}`}
                    >
                      {align === "left" ? "⇤" : align === "center" ? "↔" : "⇥"}
                    </button>
                  ))}
                </div>

                {/* Stroke Controls */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-lg border border-slate-300 dark:border-zinc-700">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Stroke</span>
                  <input
                    type="color"
                    value={activeTextLayer.strokeColor || "#000000"}
                    onChange={(e) => updateTextLayer("strokeColor", e.target.value)}
                    className="w-3.5 h-3.5 rounded cursor-pointer p-0 bg-transparent"
                    title="Stroke Color"
                  />
                  <input
                    type="range"
                    min="0"
                    max="6"
                    value={activeTextLayer.strokeWidth ?? 2}
                    onChange={(e) => updateTextLayer("strokeWidth", parseInt(e.target.value))}
                    className="w-12 accent-[#E0115F] h-1 bg-slate-300 dark:bg-zinc-700 rounded cursor-pointer"
                    title={`Stroke: ${activeTextLayer.strokeWidth ?? 2}px`}
                  />
                </div>

                {/* Actions: Duplicate, Delete, Deselect */}
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    onClick={duplicateSelectedText}
                    title="Duplicate Layer"
                    className="p-1 rounded-md text-slate-500 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                  >
                    📋
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedText}
                    title="Delete Layer"
                    className="p-1 rounded-md text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                  >
                    🗑️
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTextId(null)}
                    title="Deselect"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between py-1 text-xs text-slate-500">
                <span>Select any text on canvas, or click <strong>+ Add Layer</strong> above to create captions.</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => addTextLayer("TOP TEXT", 50, 15, 34)}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg text-xs font-bold text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700 transition"
                  >
                    + Top Text
                  </button>
                  <button
                    type="button"
                    onClick={() => addTextLayer("BOTTOM TEXT", 50, 85, 34)}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg text-xs font-bold text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700 transition"
                  >
                    + Bottom Text
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: IMAGE & COLLAGE CONTROLS */}
        {bottomControlTab === "image" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Collage Layout Picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Collage:
              </span>
              {[
                { id: "single", label: "1 Image", icon: "▢" },
                { id: "columns", label: "2 Cols", icon: "▥" },
                { id: "rows", label: "2 Rows", icon: "▤" },
                { id: "grid", label: "4 Grid", icon: "⊞" },
              ].map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => setCollageLayout(layout.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                    collageLayout === layout.id
                      ? "bg-[#E0115F] text-white border-[#E0115F]"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-slate-400"
                  }`}
                >
                  <span className="mr-1">{layout.icon}</span>
                  <span>{layout.label}</span>
                </button>
              ))}
            </div>

            {/* Quick Emoji Stickers */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Stickers:</span>
              {EMOJI_STICKERS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleAddEmoji(emoji)}
                  className="hover:scale-125 transition text-sm active:scale-95"
                  title={`Add ${emoji} sticker`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: VISUAL FILTERS */}
        {bottomControlTab === "filters" && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Preset Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {[
                { id: "none", label: "Normal" },
                { id: "grayscale", label: "B&W" },
                { id: "sepia", label: "Sepia" },
                { id: "contrast", label: "Punch" },
                { id: "vintage", label: "Vintage" },
                { id: "cool", label: "Cool" },
                { id: "warm", label: "Warm" },
                { id: "invert", label: "Invert" },
                { id: "dramatic", label: "Dramatic" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition border ${
                    activeFilter === filter.id
                      ? "bg-[#E0115F] text-white border-[#E0115F]"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-slate-400"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-slate-300 dark:bg-zinc-700 hidden sm:block" />

            {/* Sliders: Brightness, Contrast, Saturation */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Bright</span>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={filterBrightness}
                  onChange={(e) => setFilterBrightness(parseInt(e.target.value))}
                  className="w-14 accent-[#E0115F] h-1 bg-slate-300 dark:bg-zinc-700 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Contrast</span>
                <input
                  type="range"
                  min="50"
                  max="180"
                  value={filterContrast}
                  onChange={(e) => setFilterContrast(parseInt(e.target.value))}
                  className="w-14 accent-[#E0115F] h-1 bg-slate-300 dark:bg-zinc-700 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Sat</span>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={filterSaturation}
                  onChange={(e) => setFilterSaturation(parseInt(e.target.value))}
                  className="w-14 accent-[#E0115F] h-1 bg-slate-300 dark:bg-zinc-700 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MEME EFFECTS */}
        {bottomControlTab === "effects" && (
          <div className="flex items-center gap-2">
            {[
              { id: "none", label: "None" },
              { id: "deepfry", label: "Deep Fry 🔥" },
              { id: "blur", label: "Motion Blur 💨" },
            ].map((effect) => (
              <button
                key={effect.id}
                type="button"
                onClick={() => setActiveEffect(effect.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
                  activeEffect === effect.id
                    ? "bg-[#E0115F] text-white border-[#E0115F]"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-slate-400"
                }`}
              >
                {effect.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
