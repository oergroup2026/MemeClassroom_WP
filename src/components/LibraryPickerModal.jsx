import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { SUBJECTS } from "../constants/taxonomy";

const LibraryPickerModal = ({ isOpen, onClose, onSelect }) => {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const fetchLibraryMemes = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "memes"),
          where("visibility", "==", "public"),
          where("format", "==", "image"),
          orderBy("created_at", "desc")
        );
        const querySnapshot = await getDocs(q);
        const fetched = [];
        querySnapshot.forEach((doc) => {
          fetched.push({ id: doc.id, ...doc.data() });
        });
        setMemes(fetched);
      } catch (err) {
        console.error("Error fetching library memes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLibraryMemes();
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredMemes = memes.filter((meme) => {
    const matchesSearch = meme.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (meme.keywords && meme.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesSubject = !subjectFilter || meme.subject === subjectFilter;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-150 dark:border-zinc-800 shadow-xl overflow-y-auto max-h-[85vh]">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
            📖 Remix from Public Library
          </h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg font-bold"
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
              placeholder="e.g. mitosis, cell, gravity"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Subject Area</label>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
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
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 font-semibold text-xs">
            Loading library memes...
          </div>
        ) : filteredMemes.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filteredMemes.map((meme) => (
              <button
                key={meme.id}
                type="button"
                onClick={() => {
                  onSelect(meme.media_url);
                  onClose();
                }}
                className="flex flex-col items-center p-2 border border-gray-200 dark:border-zinc-800 rounded-xl hover:border-purple-500 hover:bg-purple-50/10 transition text-left w-full bg-white dark:bg-zinc-900 shadow-sm overflow-hidden"
              >
                <div className="w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center mb-1">
                  <img src={meme.media_url} alt={meme.title} className="w-full h-full object-cover" />
                </div>
                <div className="w-full mt-1 px-1">
                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide block truncate">
                    {meme.subject}
                  </span>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block truncate">
                    {meme.title}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400 dark:text-zinc-500 italic text-xs">
            No public image memes match the criteria.
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryPickerModal;
