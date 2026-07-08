import React, { useState, useEffect } from "react";

const GiphySearch = ({ onSelect }) => {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || "dc6zaTOxFJmzC";

  useEffect(() => {
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
        setError("Could not load Giphy trends. Verify API key.");
      } finally {
        setLoading(false);
      }
    };
    fetchTrending();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
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
      setError("Giphy search failed. Check network or key.");
    } finally {
      setLoading(false);
    }
  };

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
        🔒 Classroom Filter Enabled (Rating: G). Verify licensing before publishing.
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
