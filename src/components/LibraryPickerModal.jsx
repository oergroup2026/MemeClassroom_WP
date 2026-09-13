import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { SUBJECTS } from "../constants/taxonomy";
import { fuzzySearch } from "../utils/searchUtils";

const FALLBACK_PRESETS = [
  { id: "fb-leo", title: "Leonardo DiCaprio Gatsby Toast", media_url: "/templates/leonardo-toast.jpg", subject: "Literature", format: "image" },
  { id: "fb-distracted", title: "Distracted Boyfriend", media_url: "/templates/distracted-boyfriend.jpg", subject: "Psychology", format: "image" },
  { id: "fb-drake", title: "Drake Hotline Bling", media_url: "/templates/drake.jpg", subject: "English", format: "image" },
  { id: "fb-wolverine", title: "Batman Slapping Robin", media_url: "/templates/wolverine.jpg", subject: "History", format: "image" },
  { id: "fb-cat", title: "Woman Yelling at Cat", media_url: "/templates/woman-cat.jpg", subject: "Science", format: "image" },
  { id: "fb-sponge", title: "Imagination Spongebob", media_url: "/templates/spongebob.jpg", subject: "Philosophy", format: "image" }
];

const LibraryPickerModal = ({ isOpen, onClose, onSelect, format = "image" }) => {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchLibraryMemes = async () => {
      setLoading(true);
      try {
        const fetched = [];
        
        // 1. Fetch public memes from memes collection (filter client-side to avoid composite index requirement)
        try {
          const qMemes = query(
            collection(db, "memes"),
            where("visibility", "==", "public")
          );
          const snapMemes = await getDocs(qMemes);
          snapMemes.forEach((doc) => {
            const data = doc.data();
            if (!format || data.format === format || (!data.format && format === "image")) {
              fetched.push({ id: doc.id, ...data });
            }
          });
        } catch (e) {
          console.warn("Could not fetch public memes:", e);
        }

        // 2. Fetch approved templates from templates collection
        try {
          const qTemplates = query(
            collection(db, "templates"),
            where("status", "==", "approved")
          );
          const snapTemplates = await getDocs(qTemplates);
          snapTemplates.forEach((doc) => {
            const data = doc.data();
            if (!format || data.format === format || (!data.format && format === "image")) {
              fetched.push({ id: doc.id, ...data, isTemplate: true });
            }
          });
        } catch (e) {
          console.warn("Could not fetch templates:", e);
        }

        // If no results, provide fallback presets so the modal is never broken/empty
        if (fetched.length === 0) {
          fetched.push(...FALLBACK_PRESETS.filter(p => !format || p.format === format));
        }

        // Sort by created_at desc if available
        fetched.sort((a, b) => {
          const timeA = a.created_at?.toMillis?.() || a.created_at?.seconds * 1000 || 0;
          const timeB = b.created_at?.toMillis?.() || b.created_at?.seconds * 1000 || 0;
          return timeB - timeA;
        });

        if (isMounted) setMemes(fetched);
      } catch (err) {
        console.error("Error fetching library memes:", err);
        if (isMounted) setMemes(FALLBACK_PRESETS.filter(p => !format || p.format === format));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLibraryMemes();
    return () => { isMounted = false; };
  }, [isOpen, format]);

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN!
  const filteredMemes = useMemo(() => {
    let result = memes;
    if (subjectFilter) {
      result = result.filter((meme) => meme.subject === subjectFilter);
    }
    if (searchQuery.trim()) {
      result = fuzzySearch(result, searchQuery, [
        { field: "title", weight: 3 },
        { field: "subject", weight: 2 },
        { field: "keywords", weight: 2 }
      ]);
    }
    return result;
  }, [memes, subjectFilter, searchQuery]);

  // Early return is now SAFELY placed AFTER all hooks have executed
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xl overflow-y-auto max-h-[85vh] animate-scaleIn">
        <div className="flex justify-between items-center border-b pb-3 mb-4 border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">📖</span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Browse Community Templates & Memes
            </h2>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Search Keywords / Title</label>
            <input
              type="text"
              placeholder="e.g. gatsby, math, history, mitosis"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500 text-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Subject Area</label>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500 text-gray-800 dark:text-white cursor-pointer"
            >
              <option value="">All Subjects</option>
              {SUBJECTS.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-14 text-rose-500">
            <div className="w-8 h-8 border-3 border-rose-200 border-t-rose-600 rounded-full animate-spin mb-2" />
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Loading library templates...</span>
          </div>
        ) : filteredMemes.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredMemes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.media_url, item);
                  onClose();
                }}
                className="flex flex-col items-start p-2 border border-gray-200 dark:border-zinc-800 rounded-xl hover:border-rose-500 hover:bg-rose-50/10 transition text-left w-full bg-white dark:bg-zinc-900 shadow-xs overflow-hidden group active:scale-95"
              >
                <div className="w-full aspect-video bg-black/10 dark:bg-black/50 rounded-lg overflow-hidden flex items-center justify-center mb-1.5 relative">
                  <img 
                    src={item.media_url} 
                    alt={item.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300" 
                  />
                  {item.isTemplate && (
                    <span className="absolute top-1 right-1 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">
                      Template
                    </span>
                  )}
                </div>
                <div className="w-full px-0.5">
                  <span className="text-[9px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wide block truncate">
                    {item.subject || "General"}
                  </span>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition">
                    {item.title}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400 dark:text-zinc-500 italic text-xs">
            No templates match the selected criteria.
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryPickerModal;
