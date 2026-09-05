import React, { useState, useEffect } from "react";

const GiphySearch = ({ onSelect }) => {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Production key must be set via VITE_GIPHY_API_KEY in .env.local
  // Get a free key at: https://developers.giphy.com
  const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || "";

  useEffect(() => {
    // If no API key is configured, skip the fetch and show setup notice
    if (!GIPHY_API_KEY) return;

    // Load trending GIFs initially
    const fetchTrending = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=12&rating=g`
        );
        if (!res.ok) throw new Error("Giphy API request failed");
        const json = await res.json();
        setGifs(json.data || []);
      } catch (err) {
        console.error(err);
        setError("Could not load Giphy trends. Check your VITE_GIPHY_API_KEY.");
      } finally {
        setLoading(false);
      }
    };
    fetchTrending();
  }, [GIPHY_API_KEY]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || !GIPHY_API_KEY) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
          query
        )}&limit=12&rating=g`
      );
      if (!res.ok) throw new Error("Giphy API search failed");
      const json = await res.json();
      setGifs(json.data || []);
    } catch (err) {
      console.error(err);
      setError("Giphy search failed. Check network or your API key.");
    } finally {
      setLoading(false);
    }
  };

  // No API key configured — show a clear message instead of failing silently
  if (!GIPHY_API_KEY) {
    return (
      <div className="space-y-2 py-4 text-center">
        <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
          ⚙️ Giphy GIF search is not configured
        </p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mx-auto">
          To enable GIF search, add <code className="bg-gray-100 dark:bg-zinc-800 px-1 rounded">VITE_GIPHY_API_KEY</code> to your{" "}
          <code className="bg-gray-100 dark:bg-zinc-800 px-1 rounded">.env.local</code> file.{" "}
          Get a free key at{" "}
          <a
            href="https://developers.giphy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 dark:text-purple-400 underline"
          >
            developers.giphy.com
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder="Search classroom GIFs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-grow px-3 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="submit"
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition active:scale-95 shadow-sm"
        >
          Search
        </button>
      </form>

      <span className="block text-[9px] text-gray-400 font-semibold italic">
        🔒 Classroom Filter Enabled (Rating: G). GIFs are third-party content — verify licensing before publishing.
      </span>

      {error && (
        <div className="text-[10px] text-red-500 dark:text-red-400 italic">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-xs text-gray-400 font-semibold">
          Loading GIFs...
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
          {gifs.map((gif) => (
            <button
              key={gif.id}
              type="button"
              onClick={() => onSelect(gif.images.fixed_height.url)}
              className="w-full aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-800 hover:border-purple-500 active:scale-95 transition bg-black flex items-center justify-center"
            >
              <img
                src={gif.images.fixed_height_small?.url || gif.images.fixed_height.url}
                alt={gif.title}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GiphySearch;
