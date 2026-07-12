import React from "react";
import { useUdl } from "../context/UdlContext";

const About = () => {
  const { highContrastMode } = useUdl();

  // UDL Styling classes
  const glassPanelClass = highContrastMode
    ? "bg-zinc-900 border border-zinc-800 text-white p-6 rounded-xl shadow-sm"
    : "glass-panel bg-white/70 border border-gray-200/60 p-6 rounded-xl shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md";

  const darkPaneClass = highContrastMode
    ? "bg-zinc-900 border border-zinc-800 text-white p-8 rounded-xl mt-12"
    : "bg-purple-50/50 text-gray-800 border border-purple-100 p-8 rounded-xl shadow-sm mt-12 transition-all";

  const bannerClass = highContrastMode
    ? "bg-zinc-900 border border-zinc-800 text-white p-6 rounded-xl col-span-1 md:col-span-2"
    : "bg-gradient-to-r from-purple-800/90 to-indigo-850/90 border border-purple-500/20 text-white p-6 rounded-xl shadow-md col-span-1 md:col-span-2 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg";

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-10">
      {/* 1. Intro Header block */}
      <div className="text-center space-y-4">
        <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-750 dark:text-purple-300 text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-lg">
          Pedagogy & Design
        </span>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-2 text-gray-900 dark:text-white">
          About{" "}
          <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
            Meme Classroom
          </span>
        </h1>
        <p className="text-lg md:text-xl text-gray-650 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
          Open Ped-Tech for the modern classroom. Because learning should be as dynamic as the culture it lives in.
        </p>

        {/* Quote Box */}
        <div className={`max-w-3xl mx-auto mt-6 text-left border-l-4 ${highContrastMode ? 'border-yellow-400 bg-black text-yellow-400' : 'border-purple-600 bg-purple-50/20 dark:bg-purple-950/10'} p-5 italic rounded-r-xl text-sm leading-relaxed`}>
          "Grounded in open pedagogy, Meme Classroom values learner voice, co-creation, and cultural relevance. By connecting everyday internet culture with classroom practice, it supports inclusive, multimodal learning through collaboration rather than content consumption."
          <span className="block mt-2 not-italic text-xs text-gray-400 dark:text-gray-500">— MemeClassroom Pedagogical Framework, 2024</span>
        </div>
      </div>

      {/* 2. Framework Image container card (Center) */}
      <div className="flex justify-center my-8">
        <div className={`w-full max-w-2xl text-center overflow-hidden ${glassPanelClass}`}>
          <h2 className="text-xs uppercase tracking-widest font-black text-gray-400 mb-4">
            Educational Framework & Theory
          </h2>
          <div className="bg-white/20 dark:bg-black/20 p-2 rounded-lg border border-gray-200/30">
            <img
              src="/Meme Pedagogy.png"
              alt="Meme Pedagogy Framework Graphic"
              className="mx-auto rounded-md shadow-sm max-h-[350px] object-contain"
            />
          </div>
        </div>
      </div>

      {/* 3. Core Design Pillars grid */}
      <div className="space-y-6">
        <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
          <h2 className="text-2xl font-extrabold tracking-tight">Core Design Pillars</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={glassPanelClass}>
            <div className="text-2xl mb-2"><img src="research.png" alt="Meme Lab icon" className="w-10 h-10" /></div>
            <h3 className="font-extrabold text-base mb-1 text-purple-600">Meme Lab (Creation)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              A multi-format editor featuring ready-to-use templates and tagging capabilities (by subject, topic, and language) to help teachers produce context-specific content.
            </p>
          </div>
          <div className={glassPanelClass}>
            <div className="text-2xl mb-2"><img src="stack-of-books.png" alt="Library icon" className="w-10 h-10" /></div>
            <h3 className="font-extrabold text-base mb-1 text-purple-600">Meme Library (Curation)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              A searchable repository where memes are filtered by grade and subject, featuring peer ratings to ensure content validity and age-appropriateness.
            </p>
          </div>
          <div className={glassPanelClass}>
            <div className="text-2xl mb-2"><img src="school.png" alt="Staffroom icon" className="w-10 h-10" /></div>
            <h3 className="font-extrabold text-base mb-1 text-purple-600">Staffroom (Collaboration)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              A social space modeled after digital communities where teachers share experiences, post memes, and engage in professional dialogue.
            </p>
          </div>
          <div className={glassPanelClass}>
            <div className="text-2xl mb-2"><img src="process.png" alt="Resources icon" className="w-10 h-10" /></div>
            <h3 className="font-extrabold text-base mb-1 text-purple-600">Meme Reads (Scaffolding)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              A resource hub providing pedagogical guidance, including lesson ideas, ethical guidelines, and scholarly articles on meme-based instruction.
            </p>
          </div>
          {/* Gamification Banner (Full-Width) */}
          <div className={bannerClass}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xl mr-2"><img src="star-medal.png" alt="Badge icon" className="w-10 h-10" /></span>
                <span className="font-black text-sm uppercase tracking-wider text-purple-200">Badges & Gamification</span>
                <p className="text-xs mt-2 opacity-95 leading-relaxed max-w-xl">
                  A reward system designed to recognize and motivate sustained teacher engagement and community contribution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Pedagogical Foundation Section (Dark Pane Layout) */}
      <div className={darkPaneClass}>
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className={`text-xl md:text-2xl font-black text-center ${highContrastMode ? 'text-white' : 'text-gray-900'}`}>
            Pedagogical Foundation
          </h2>
          <p className={`text-xs md:text-sm text-center leading-relaxed max-w-2xl mx-auto ${highContrastMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Meme Classroom moves beyond viewing memes as mere "gimmicks," positioning them as legitimate tools for inclusive, multimodal learning.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div className={`p-5 rounded-xl border transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md space-y-2 ${highContrastMode ? 'border-zinc-800 bg-zinc-950 text-white' : 'border-purple-100 bg-white text-gray-800'}`}>
              <span className="text-lg"><img src="collaborate.png" alt="Collaboration icon" className="w-10 h-10" /></span>
              <h4 className={`font-extrabold text-xs ${highContrastMode ? 'text-white' : 'text-gray-900'}`}>Sociocultural Theory</h4>
              <p className={`text-[11px] leading-relaxed ${highContrastMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Utilizing memes as "cultural tools" for collaborative knowledge construction.
              </p>
            </div>
            <div className={`p-5 rounded-xl border transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md space-y-2 ${highContrastMode ? 'border-zinc-800 bg-zinc-950 text-white' : 'border-purple-100 bg-white text-gray-800'}`}>
              <span className="text-lg"><img src="complexity.png" alt="Multiliteracies icon" className="w-10 h-10" /></span>
              <h4 className={`font-extrabold text-xs ${highContrastMode ? 'text-white' : 'text-gray-900'}`}>Multiliteracies Framework</h4>
              <p className={`text-[11px] leading-relaxed ${highContrastMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Recognizing memes as hybrid texts that require specific design and interpretive skills.
              </p>
            </div>
            <div className={`p-5 rounded-xl border transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md space-y-2 ${highContrastMode ? 'border-zinc-800 bg-zinc-950 text-white' : 'border-purple-100 bg-white text-gray-800'}`}>
              <span className="text-lg"><img src="blub.png" alt="Open pedagogy icon" className="w-10 h-10" /></span>
              <h4 className={`font-extrabold text-xs ${highContrastMode ? 'text-white' : 'text-gray-900'}`}>Open Pedagogy</h4>
              <p className={`text-[11px] leading-relaxed ${highContrastMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Fostering transparent, collaborative practices that position learners as co-creators.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <div className="mt-14 text-center">
        <h2 className="text-xl font-black mb-3 text-gray-900 dark:text-white">Ready to bring memes into your classroom?</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="/library" className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition">
            Explore the Library →
          </a>
          <a href="/auth?mode=register" className="border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold px-6 py-2.5 rounded-xl text-sm transition">
            Join the Community
          </a>
        </div>
      </div>
    </div>
  );
};

export default About;
