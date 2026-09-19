import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Repeat,
  MessageSquarePlus,
  Upload,
  Film,
  Trash2,
  Edit3,
  Check,
  Plus,
  Scissors
} from "lucide-react";
import { MEDIA_SAMPLES } from "../constants/mediaSamples";

export default function ClassicVideoEditor({
  videoUrl,
  videoDuration,
  videoCurrentTime,
  setVideoCurrentTime,
  videoTrimStart,
  setVideoTrimStart,
  videoTrimEnd,
  setVideoTrimEnd,
  videoCaptions,
  setVideoCaptions,
  activeVideoCaptionText,
  aspectRatio,
  setAspectRatio,
  videoMuted,
  setVideoMuted,
  videoLoop,
  setVideoLoop,
  subtitlePosition,
  setSubtitlePosition,
  videoPlayerRef,
  timelineTrackRef,
  handleVideoUpload,
  handleAddCaptionAtCurrentTime,
  handleDeleteCaptionIndex,
  handleEditCaptionText,
  handleSplitVideoAtCurrentTime,
  selectMediaPreset,
  parseCaptionLines,
  formatTime,
  rebuildCaptionsString,
  handleDropzoneDrop,
  isDragOverDropzone,
  setIsDragOverDropzone
}) {
  const [newSubText, setNewSubText] = useState("");
  const [editingSubIndex, setEditingSubIndex] = useState(null);
  const [editingSubText, setEditingSubText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const trimDragRef = useRef(null);

  // Drag-to-trim: pointer handler for the two range handles on the timeline
  const beginTrimDrag = (e, which) => {
    e.preventDefault();
    e.stopPropagation();
    trimDragRef.current = { which };
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (!trimDragRef.current || !timelineTrackRef.current) return;
      const rect = timelineTrackRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const time = pct * videoDuration;
      if (trimDragRef.current.which === "start") {
        setVideoTrimStart(Math.max(0, Math.min(time, videoTrimEnd - 0.5)));
      } else {
        setVideoTrimEnd(Math.min(videoDuration, Math.max(time, videoTrimStart + 0.5)));
      }
    };
    const handleUp = () => { trimDragRef.current = null; };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [videoDuration, videoTrimStart, videoTrimEnd, setVideoTrimStart, setVideoTrimEnd, timelineTrackRef]);

  const parsedCaptions = parseCaptionLines(videoCaptions || "");

  const handleManualAddSubtitle = () => {
    if (!newSubText.trim()) return;
    const time = videoPlayerRef?.current ? Math.floor(videoPlayerRef.current.currentTime) : Math.floor(videoCurrentTime);
    const updated = [...parsedCaptions, { time, text: newSubText.trim() }];
    updated.sort((a, b) => a.time - b.time);
    setVideoCaptions(rebuildCaptionsString(updated));
    setNewSubText("");
  };

  const handleSaveSubEdit = (idx) => {
    if (editingSubText.trim()) {
      const updated = [...parsedCaptions];
      updated[idx].text = editingSubText.trim();
      setVideoCaptions(rebuildCaptionsString(updated));
    }
    setEditingSubIndex(null);
    setEditingSubText("");
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#0e131f] text-slate-800 dark:text-zinc-100 select-none overflow-hidden rounded-2xl border border-slate-200 dark:border-[#1e273a]/80 shadow-lg">
      {/* ── Studio Top Toolbar ─────────────────────────────────────────────── */}
      <div className="py-2.5 px-4 bg-slate-50 dark:bg-[#111624]/90 border-b border-slate-200 dark:border-[#1e273a]/80 flex flex-wrap items-center justify-between gap-3 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
            <span className="font-extrabold text-xs tracking-wider uppercase text-purple-600 dark:text-purple-400 font-mono">
              Video Studio
            </span>
          </div>
          <span className="text-slate-300 dark:text-zinc-700">|</span>

          {/* Aspect Ratio Buttons */}
          <div className="flex items-center gap-1 bg-white dark:bg-[#0e131f]/80 p-1 rounded-xl border border-slate-200 dark:border-[#1e273a]">
            {[
              { label: "16:9", val: "16:9" },
              { label: "9:16", val: "9:16" },
              { label: "1:1", val: "1:1" },
              { label: "4:3", val: "4:3" }
            ].map(opt => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setAspectRatio(opt.val)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition font-mono ${
                  aspectRatio === opt.val
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-[#1b2336]/60"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Media Select & Subtitle Overlay Position */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#0e131f]/80 p-1 rounded-xl border border-slate-200 dark:border-[#1e273a]">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 px-2">Sub Position:</span>
            {["top", "middle", "bottom"].map(pos => (
              <button
                key={pos}
                type="button"
                onClick={() => setSubtitlePosition(pos)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold capitalize transition ${
                  subtitlePosition === pos
                    ? "bg-purple-600 text-white"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Studio Body (Preview Canvas + Inspector Panel) ───────────── */}
      <div className="flex-1 min-h-[360px] flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Side: Video Cinema Player Canvas */}
        <div className="flex-1 bg-[#0e131f] p-6 flex items-center justify-center relative overflow-hidden">
          {videoUrl ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <div
                className="relative bg-black border-2 border-[#1e273a] shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden flex items-center justify-center transition-all duration-300 rounded-2xl"
                style={{
                  aspectRatio: aspectRatio === "16:9" ? "16/9" : aspectRatio === "9:16" ? "9/16" : aspectRatio === "1:1" ? "1/1" : "4/3",
                  maxHeight: "100%",
                  maxWidth: "100%",
                  width: aspectRatio === "9:16" ? "auto" : "100%",
                  height: aspectRatio === "9:16" ? "100%" : "auto"
                }}
              >
                {/* Live Aspect Badge */}
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/80 backdrop-blur-md rounded-lg border border-[#1e273a]/60 text-[10px] font-mono text-zinc-300 font-bold z-20 flex items-center gap-1.5 pointer-events-none shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>{aspectRatio} PLAYBACK</span>
                </div>

                <video
                  ref={videoPlayerRef}
                  src={videoUrl}
                  controls={false}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full h-full object-contain pointer-events-none"
                />

                {/* Subtitle Overlay Box */}
                {activeVideoCaptionText && (
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 px-5 py-2.5 bg-black/90 text-white text-base md:text-lg font-extrabold rounded-xl shadow-2xl border border-[#1e273a]/90 text-center max-w-[85%] select-none pointer-events-none z-30 transition-all ${
                      subtitlePosition === "top"
                        ? "top-6"
                        : subtitlePosition === "middle"
                        ? "top-1/2 -translate-y-1/2"
                        : "bottom-6"
                    }`}
                  >
                    {activeVideoCaptionText}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500 w-full h-full">
              <Film className="w-16 h-16 mb-3 text-purple-500/70 animate-bounce" />
              <p className="font-extrabold text-base mb-1 text-zinc-200">No Video Loaded</p>
              <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                Upload your video clip from the right panel to get started.
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Media & Subtitle Inspector Panel */}
        <div className="w-full lg:w-80 bg-slate-50 dark:bg-[#111624] border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-[#1e273a] flex flex-col shrink-0 p-4 space-y-5 overflow-y-auto">
          {/* Media Source Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <Film className="w-4 h-4" />
              <span>Media Source</span>
            </h4>

            {/* Dropzone Upload */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOverDropzone(true); }}
              onDragLeave={() => setIsDragOverDropzone(false)}
              onDrop={handleDropzoneDrop}
              className={`border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition flex flex-col items-center justify-center relative ${
                isDragOverDropzone
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-950/40"
                  : "border-slate-300 dark:border-[#1e273a] bg-white dark:bg-[#0e131f]/60 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
              }`}
            >
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <Upload className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-1" />
              <span className="text-xs text-slate-800 dark:text-zinc-200 font-bold">Upload Custom Video</span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">MP4, WebM, MOV</span>
            </div>

            {/* Stock Presets */}
            <div className="grid grid-cols-2 gap-2">
              {MEDIA_SAMPLES?.video?.map((sample, idx) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => selectMediaPreset?.(sample.url, "video", 15)}
                  className="py-2 px-3 rounded-lg bg-white dark:bg-[#0e131f] hover:bg-purple-50 dark:hover:bg-purple-900/40 border border-slate-200 dark:border-[#1e273a] hover:border-purple-500 text-slate-800 dark:text-zinc-200 text-xs font-bold transition text-left flex items-center justify-between shadow-xs"
                >
                  <span className="truncate pr-1">{sample.title || `Sample ${idx + 1}`}</span>
                  <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 shrink-0">{sample.duration || "15s"}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle Manager Section */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-[#1e273a]">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MessageSquarePlus className="w-4 h-4" />
                <span>Subtitle Manager</span>
              </span>
              <span className="text-[10px] font-mono text-slate-600 dark:text-zinc-400 bg-white dark:bg-[#0e131f] px-2 py-0.5 rounded border border-slate-200 dark:border-[#1e273a]">
                {parsedCaptions.length} {parsedCaptions.length === 1 ? "Clip" : "Clips"}
              </span>
            </h4>

            {/* Add Subtitle Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type caption line..."
                value={newSubText}
                onChange={(e) => setNewSubText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualAddSubtitle()}
                className="flex-1 bg-white dark:bg-[#0e131f] border border-slate-200 dark:border-[#1e273a] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={handleManualAddSubtitle}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            {/* Subtitle List */}
            {parsedCaptions.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-slate-200 dark:border-[#1e273a] rounded-xl text-slate-400 dark:text-zinc-500 text-xs">
                No subtitles added yet. Use the input above to create timed subtitles.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {parsedCaptions.map((cap, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-[#0e131f] p-2.5 rounded-xl border border-slate-200 dark:border-[#1e273a] flex items-center justify-between gap-2 group hover:border-purple-500/50 transition shadow-xs"
                  >
                    <span className="font-mono text-[11px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800/40 shrink-0 font-bold">
                      {formatTime(cap.time)}
                    </span>

                    {editingSubIndex === idx ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="text"
                          value={editingSubText}
                          onChange={(e) => setEditingSubText(e.target.value)}
                          className="flex-1 bg-[#111624] border border-purple-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveSubEdit(idx)}
                          className="text-emerald-400 hover:text-emerald-300 p-1"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="flex-1 text-xs text-zinc-200 truncate">
                        {cap.text}
                      </span>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                      {editingSubIndex !== idx && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSubIndex(idx);
                            setEditingSubText(cap.text);
                          }}
                          className="text-zinc-400 hover:text-zinc-100 p-1"
                          title="Edit Subtitle"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteCaptionIndex(idx)}
                        className="text-zinc-400 hover:text-red-400 p-1"
                        title="Delete Subtitle"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Studio Bottom Timeline & Transport Controls ───────────────────── */}
      {videoUrl && (
        <div className="bg-slate-50 dark:bg-[#111624] border-t border-slate-200 dark:border-[#1e273a] p-3 sm:p-4 space-y-3 shrink-0 z-30">
          {/* Transport Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button
                type="button"
                onClick={() => {
                  const video = videoPlayerRef.current;
                  if (!video) return;
                  if (video.paused) video.play().catch(() => {});
                  else video.pause();
                }}
                className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition active:scale-95 shadow-md"
                title="Play / Pause (Space)"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-white" />
                ) : (
                  <Play className="w-5 h-5 fill-white translate-x-0.5" />
                )}
              </button>

              {/* Stop */}
              <button
                type="button"
                onClick={() => {
                  const video = videoPlayerRef.current;
                  if (!video) return;
                  video.pause();
                  video.currentTime = 0;
                }}
                className="w-10 h-10 rounded-full bg-white dark:bg-[#1b2336] hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 flex items-center justify-center transition active:scale-95 border border-slate-200 dark:border-[#1e273a] shadow-xs"
                title="Stop & Reset"
              >
                <Square className="w-4 h-4" />
              </button>

              {/* Mute */}
              <button
                type="button"
                onClick={() => setVideoMuted(!videoMuted)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition active:scale-95 border shadow-xs ${
                  videoMuted
                    ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                    : "bg-white dark:bg-[#1b2336] hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-[#1e273a]"
                }`}
                title={videoMuted ? "Unmute Audio (M)" : "Mute Audio (M)"}
              >
                {videoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Loop */}
              <button
                type="button"
                onClick={() => setVideoLoop(!videoLoop)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition active:scale-95 border shadow-xs ${
                  videoLoop
                    ? "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 border-purple-300 dark:border-purple-700 font-bold"
                    : "bg-white dark:bg-[#1b2336] hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-[#1e273a]"
                }`}
                title="Toggle Looping"
              >
                <Repeat className="w-4 h-4" />
              </button>

              {/* Playback Timestamp */}
              <span className="text-xs font-mono text-slate-800 dark:text-zinc-200 bg-white dark:bg-[#0e131f] px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1e273a] font-bold shadow-xs">
                {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
              </span>

              {/* Trim Range Readout */}
              <span className="text-[11px] font-mono text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-800/50 font-bold shadow-xs flex items-center gap-1.5" title="Only this range is included in the exported video">
                <Scissors className="w-3 h-3" />
                {formatTime(videoTrimStart)} – {formatTime(videoTrimEnd)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Split Video at Playhead */}
              <button
                type="button"
                onClick={handleSplitVideoAtCurrentTime}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#1b2336] hover:bg-slate-100 dark:hover:bg-[#1e273a] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-[#1e273a] font-bold text-xs transition flex items-center gap-2 shadow-xs active:scale-95"
                title="Split video into two parts at the current playhead position"
              >
                <Scissors className="w-4 h-4" />
                <span>Split at Playhead</span>
              </button>

              {/* Quick Add Caption at Playhead */}
              <button
                type="button"
                onClick={handleAddCaptionAtCurrentTime}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-md active:scale-95"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>Add Subtitle at Playhead</span>
              </button>
            </div>
          </div>

          {/* Timeline Track Scrubber */}
          <div
            ref={timelineTrackRef}
            className="relative h-16 bg-[#0e131f] rounded-xl border border-[#1e273a] overflow-hidden cursor-crosshair select-none shadow-inner touch-action-none"
            onClick={(e) => {
              if (e.target.closest(".no-snap")) return;
              const rect = timelineTrackRef.current.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const targetTime = pct * videoDuration;
              if (videoPlayerRef.current) {
                videoPlayerRef.current.currentTime = targetTime;
                setVideoCurrentTime(targetTime);
              }
            }}
          >
            {/* Timecode Ruler */}
            <div className="absolute inset-x-0 top-0 h-4 border-b border-[#0e131f] flex items-center justify-between px-3 text-[9px] font-mono text-zinc-500 pointer-events-none">
              <span>0:00</span>
              <span>{formatTime(videoDuration * 0.25)}</span>
              <span>{formatTime(videoDuration * 0.5)}</span>
              <span>{formatTime(videoDuration * 0.75)}</span>
              <span>{formatTime(videoDuration)}</span>
            </div>

            {/* Waveform Visualization */}
            <div className="absolute inset-x-0 top-5 bottom-6 flex items-center justify-around opacity-25 pointer-events-none px-2">
              {Array.from({ length: 90 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[2px] bg-purple-400 rounded-full"
                  style={{ height: `${20 + Math.sin(i * 0.35) * 80}%` }}
                />
              ))}
            </div>

            {/* Trim Range: dimmed excluded regions */}
            <div
              className="absolute inset-y-0 left-0 bg-black/70 pointer-events-none z-10"
              style={{ width: `${(videoTrimStart / Math.max(0.1, videoDuration)) * 100}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-black/70 pointer-events-none z-10"
              style={{ width: `${100 - (videoTrimEnd / Math.max(0.1, videoDuration)) * 100}%` }}
            />

            {/* Trim Start Handle */}
            <div
              className="no-snap absolute inset-y-0 w-2 bg-purple-500 hover:bg-purple-400 cursor-ew-resize z-25 shadow-md flex items-center justify-center"
              style={{ left: `calc(${(videoTrimStart / Math.max(0.1, videoDuration)) * 100}% - 4px)` }}
              onMouseDown={(e) => beginTrimDrag(e, "start")}
              onTouchStart={(e) => beginTrimDrag(e, "start")}
              title={`Trim start: ${formatTime(videoTrimStart)}`}
            >
              <div className="w-0.5 h-6 bg-white/80 rounded-full" />
            </div>

            {/* Trim End Handle */}
            <div
              className="no-snap absolute inset-y-0 w-2 bg-purple-500 hover:bg-purple-400 cursor-ew-resize z-25 shadow-md flex items-center justify-center"
              style={{ left: `calc(${(videoTrimEnd / Math.max(0.1, videoDuration)) * 100}% - 4px)` }}
              onMouseDown={(e) => beginTrimDrag(e, "end")}
              onTouchStart={(e) => beginTrimDrag(e, "end")}
              title={`Trim end: ${formatTime(videoTrimEnd)}`}
            >
              <div className="w-0.5 h-6 bg-white/80 rounded-full" />
            </div>

            {/* Subtitle Track Capsules */}
            <div className="absolute inset-x-0 bottom-1 h-6 border-t border-[#0e131f]/80 flex items-center">
              {parsedCaptions.map((cap, idx) => {
                const startTime = cap.time;
                const nextCap = parsedCaptions[idx + 1];
                const endTime = nextCap ? nextCap.time : videoDuration;
                const capEnd = Math.min(endTime, startTime + 4);

                const leftPct = (startTime / videoDuration) * 100;
                const widthPct = Math.max(4, ((capEnd - startTime) / videoDuration) * 100);

                return (
                  <div
                    key={idx}
                    className="no-snap absolute h-5 bg-purple-600/70 hover:bg-purple-600/90 border border-purple-400/80 rounded px-2 flex items-center justify-between text-[9px] text-white font-bold select-none cursor-pointer truncate max-w-full z-15 shadow-sm"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`
                    }}
                    title={`Subtitle: "${cap.text}" (Click to edit)`}
                    onClick={() => handleEditCaptionText(idx)}
                  >
                    <span className="truncate mr-1">{cap.text}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCaptionIndex(idx);
                      }}
                        className="hover:text-red-400 font-bold text-[9px] p-0.5"
                        title="Delete Subtitle"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Red Scrub Playhead Line */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)]"
              style={{ left: `${(videoCurrentTime / Math.max(0.1, videoDuration)) * 100}%` }}
            >
              <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-red-500 rotate-45 rounded-sm shadow-md" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
