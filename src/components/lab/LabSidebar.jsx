import React from "react";

export default function LabSidebar({
  activeTab,
  availableTemplates = [],
  handleSelectTemplate,
  templateSearchQuery = "",
  setTemplateSearchQuery,
  templateCategory = "popular",
  setTemplateCategory,
  images = [],
  setImages,
  handleImageUpload,
  handleDropzoneDrop,
  isDragOverDropzone,
  setIsDragOverDropzone,
  videoUrl,
  handleVideoUpload,
  gifUrl,
  setGifUrl,
  audioUrl,
  handleAudioUpload,
  title = "",
  setTitle,
  keywords = "",
  setKeywords,
  subject = "Biology",
  setSubject,
  ageGroup = "High School (9–10)",
  setAgeGroup,
  subjects = [],
  highContrastMode = false,
}) {
  const DEFAULT_IMAGE_TEMPLATES = [
    {
      id: "preset-sanders",
      title: "Bernie Asking",
      media_url:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Bernie_Sanders_in_January_2020.jpg/440px-Bernie_Sanders_in_January_2020.jpg",
      format: "image",
      category: "reactions",
    },
    {
      id: "preset-smart",
      title: "Smart Logic",
      media_url:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Thinker_close_up.jpg/440px-Thinker_close_up.jpg",
      format: "image",
      category: "academic",
    },
    {
      id: "preset-success",
      title: "Classroom Board",
      media_url:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Chalkboard.jpg/440px-Chalkboard.jpg",
      format: "image",
      category: "students",
    },
  ];

  // Filter templates based on activeTab, search query, and category
  const dbFormatTemplates = availableTemplates.filter((temp) => {
    if (activeTab === "image") return !temp.format || temp.format === "image";
    return temp.format === activeTab;
  });

  let templatesToDisplay = [
    ...dbFormatTemplates,
    ...(activeTab === "image" ? DEFAULT_IMAGE_TEMPLATES : []),
  ];

  if (templateCategory && templateCategory !== "all") {
    if (templateCategory === "popular") {
      templatesToDisplay = templatesToDisplay.filter((t) => t.is_featured || t.category === "popular" || true);
    } else {
      templatesToDisplay = templatesToDisplay.filter((t) => (t.category || "").toLowerCase() === templateCategory);
    }
  }

  if (templateSearchQuery.trim()) {
    const q = templateSearchQuery.toLowerCase();
    templatesToDisplay = templatesToDisplay.filter((temp) =>
      temp.title.toLowerCase().includes(q)
    );
  }

  const QUICK_TAGS = ["#Biology", "#Chemistry", "#Physics", "#History", "#Math", "#Literature", "#Coding", "#Exams"];

  const handleToggleTag = (tag) => {
    if (!keywords) {
      setKeywords(tag);
      return;
    }
    const tagsArr = keywords.split(",").map((t) => t.trim());
    if (tagsArr.includes(tag)) {
      setKeywords(tagsArr.filter((t) => t !== tag).join(", "));
    } else {
      setKeywords([...tagsArr, tag].join(", "));
    }
  };

  const removeImageIndex = (indexToRemove) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <aside
      className={`w-full lg:w-[340px] xl:w-[380px] shrink-0 flex flex-col min-h-0 rounded-xl border shadow-sm overflow-hidden select-none transition-colors duration-200 ${
        highContrastMode
          ? "bg-zinc-950 border-zinc-800 text-white"
          : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-gray-800 dark:text-zinc-200"
      }`}
    >
      {/* Sidebar Header */}
      <div className="shrink-0 px-3.5 py-2.5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-900/90">
        <div className="flex items-center gap-1.5 font-bold text-xs">
          <span className="text-sm">🗂️</span>
          <span>STUDIO SIDEBAR</span>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 bg-slate-200/70 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
          Templates &amp; Assets
        </span>
      </div>

      {/* Scrollable Sidebar Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* SECTION 1: TEMPLATES PICKER with required tour ID: lab-template-picker */}
        <section id="lab-template-picker" className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Templates ({templatesToDisplay.length})
            </span>
            {templateSearchQuery && (
              <button
                type="button"
                onClick={() => setTemplateSearchQuery("")}
                className="text-[10px] text-[#E0115F] font-bold hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Template Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search meme templates..."
              value={templateSearchQuery}
              onChange={(e) => setTemplateSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-gray-800 dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:border-[#E0115F]"
            />
            <svg
              className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {[
              { id: "popular", label: "Popular" },
              { id: "academic", label: "Academic" },
              { id: "reactions", label: "Reactions" },
              { id: "students", label: "Students" },
              { id: "all", label: "All" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setTemplateCategory(cat.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 transition ${
                  templateCategory === cat.id
                    ? "bg-[#E0115F] text-white"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Template Thumbnails Grid */}
          {templatesToDisplay.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[160px] overflow-y-auto pr-0.5">
              {templatesToDisplay.map((temp) => (
                <button
                  key={temp.id}
                  type="button"
                  onClick={() => handleSelectTemplate(temp)}
                  title={temp.title}
                  className="group relative w-full aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 hover:border-[#E0115F] transition active:scale-95 bg-slate-950/20"
                >
                  <img
                    src={temp.media_url}
                    alt={temp.title}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                    <span className="text-[9px] font-bold text-white truncate w-full">
                      {temp.title}
                    </span>
                  </div>
                  {temp.is_featured && (
                    <span className="absolute top-1 right-1 bg-amber-400 text-black text-[8px] font-black px-1 rounded shadow">
                      ★
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-zinc-800 rounded-lg">
              No matching templates found.
            </div>
          )}
        </section>

        {/* SECTION 2: UPLOAD MEDIA & DROPZONE */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Upload Media
            </span>
            <span className="text-[10px] text-slate-400">
              {activeTab.toUpperCase()}
            </span>
          </div>

          {/* Interactive Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOverDropzone(true);
            }}
            onDragLeave={() => setIsDragOverDropzone(false)}
            onDrop={handleDropzoneDrop}
            className={`border-2 border-dashed rounded-xl p-3 text-center transition-all duration-150 cursor-pointer ${
              isDragOverDropzone
                ? "border-[#E0115F] bg-[#E0115F]/5"
                : "border-slate-300 dark:border-zinc-700 hover:border-[#E0115F]/60 bg-slate-50/50 dark:bg-zinc-800/30"
            }`}
          >
            <label className="cursor-pointer block">
              <input
                type="file"
                accept={
                  activeTab === "video"
                    ? "video/*"
                    : activeTab === "gif"
                    ? "image/gif"
                    : activeTab === "audio"
                    ? "audio/*"
                    : "image/*"
                }
                onChange={
                  activeTab === "video"
                    ? handleVideoUpload
                    : activeTab === "audio"
                    ? handleAudioUpload
                    : handleImageUpload
                }
                className="hidden"
              />
              <div className="flex flex-col items-center gap-1">
                <span className="text-xl">📁</span>
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                  Drop file here, or <span className="text-[#E0115F]">Browse</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Supports PNG, JPG, WebP, GIF, MP4, MP3
                </span>
              </div>
            </label>
          </div>

          {/* Uploaded Image Thumbnails Strip */}
          {activeTab === "image" && images.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto p-1 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700">
              {images.map((imgSrc, idx) => (
                <div key={idx} className="relative group shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-slate-300 dark:border-zinc-600">
                  <img src={imgSrc} alt={`Panel ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImageIndex(idx)}
                    className="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center opacity-80 group-hover:opacity-100 transition shadow"
                    title="Remove image"
                  >
                    ✕
                  </button>
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center font-bold">
                    P{idx + 1}
                  </span>
                </div>
              ))}

              <label className="shrink-0 w-12 h-12 rounded-lg border-2 border-dashed border-slate-300 dark:border-zinc-600 hover:border-[#E0115F] flex flex-col items-center justify-center cursor-pointer transition text-slate-400 hover:text-[#E0115F]">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <span className="text-lg leading-none">+</span>
                <span className="text-[8px] font-bold">Panel</span>
              </label>
            </div>
          )}
        </section>

        {/* SECTION 3: MEME TAGS & EDUCATIONAL METADATA */}
        <section className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Meme Tags &amp; Learning Meta
          </span>

          {/* Meme Concept Title */}
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
              Title / Lesson Concept
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Photosynthesis Dilemma"
              className="w-full px-2.5 py-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-gray-800 dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:border-[#E0115F]"
            />
          </div>

          {/* Subject Dropdown & Quick Subject Tags */}
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-1">
              Subject Topic
            </label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition ${
                    keywords.includes(tag)
                      ? "bg-[#E0115F] text-white"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-2 py-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-gray-800 dark:text-zinc-200 focus:outline-none"
            >
              {subjects && subjects.length > 0 ? (
                subjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))
              ) : (
                <>
                  <option value="Biology">Biology</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Physics">Physics</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="History">History</option>
                </>
              )}
            </select>
          </div>

          {/* Target Grade Group */}
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
              Target Grade Level
            </label>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="w-full px-2 py-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-gray-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="Middle School (6–8)">Middle School (6–8)</option>
              <option value="High School (9–10)">High School (9–10)</option>
              <option value="Senior Secondary (11–12)">Senior Secondary (11–12)</option>
              <option value="College / University">College / University</option>
            </select>
          </div>
        </section>
      </div>
    </aside>
  );
}
