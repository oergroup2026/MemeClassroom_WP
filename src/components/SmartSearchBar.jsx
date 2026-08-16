import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, Mic, MicOff, X, ArrowRight, Sparkles, Globe, FileText, Image, MessageSquare, BookOpen, Tag } from "lucide-react";
import { getSuggestions, transliterate } from "../utils/searchUtils";
import { useUdl } from "../context/UdlContext";

/**
 * SmartSearchBar — Universal predictive search component.
 * Features:
 * - Live autocomplete & typeahead suggestions dropdown
 * - Multilingual keyword & transliteration indicators
 * - Native Web Speech API voice input (zero cost, zero API)
 * - Keyboard navigation (Arrow Up/Down, Enter, Escape)
 * - Full UDL / High Contrast mode compatibility
 */
export default function SmartSearchBar({
  items = [],
  fieldWeights = [
    { field: "title", weight: 3 },
    { field: "subject", weight: 2 },
    { field: "keywords", weight: 2 },
    { field: "body", weight: 1 }
  ],
  placeholder = "Search...",
  value = "",
  onChange = () => {},
  onSearch = () => {},
  onSuggestionSelect = null,
  voiceEnabled = true,
  autoFocus = false,
  className = "",
  size = "md"
}) {
  const { highContrastMode } = useUdl();
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Sync external value with internal input state
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      setVoiceSupported(true);
    }
  }, []);

  // Update suggestions on input change (debounced 160ms)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!inputValue || inputValue.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      const results = getSuggestions(items, inputValue, fieldWeights, 6);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setSelectedIndex(-1);
    }, 160);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputValue, items, fieldWeights]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle Input text changes
  const handleInputChange = (e) => {
    const nextVal = e.target.value;
    setInputValue(nextVal);
    onChange(nextVal);
  };

  // Submit / Commit search
  const triggerSearch = (finalQuery) => {
    const queryToUse = (typeof finalQuery === "string" ? finalQuery : inputValue).trim();
    setIsOpen(false);
    setSelectedIndex(-1);
    onChange(queryToUse);
    onSearch(queryToUse);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      handleSelectSuggestion(suggestions[selectedIndex]);
    } else {
      triggerSearch(inputValue);
    }
  };

  // Select a suggestion
  const handleSelectSuggestion = (suggestion) => {
    const selectedText = suggestion.label || "";
    setInputValue(selectedText);
    setIsOpen(false);
    setSelectedIndex(-1);

    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion);
    } else {
      onChange(selectedText);
      onSearch(selectedText);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  // Voice Search (Web Speech API)
  const toggleVoiceSearch = () => {
    if (!voiceSupported) return;

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognitionRef.current = recognition;

    // Get preferred voice language from localStorage or default to en-IN
    const storedLang = localStorage.getItem("memeclassroom_voice_lang");
    recognition.lang = storedLang || "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");

      setInputValue(transcript);
      onChange(transcript);

      // If speech is finalized
      if (event.results[0].isFinal) {
        setIsListening(false);
        triggerSearch(transcript);
      }
    };

    recognition.onerror = (err) => {
      console.warn("Speech recognition error:", err);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn("Could not start recognition:", err);
      setIsListening(false);
    }
  };

  // Helper for suggestion badges/icons
  const getSuggestionBadge = (item) => {
    const type = item.type || "";
    if (type === "keyword" || item.isKeyword) {
      return { icon: <Tag className="w-3 h-3 text-amber-500" />, label: "Keyword", bg: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300" };
    }
    if (type === "meme" || type === "image" || type === "gif" || type === "video" || type === "audio") {
      return { icon: <Image className="w-3 h-3 text-purple-500" />, label: "Meme", bg: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300" };
    }
    if (type === "resource" || type === "article" || type === "research_paper" || type === "activity" || type === "stories") {
      return { icon: <BookOpen className="w-3 h-3 text-blue-500" />, label: "Resource", bg: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300" };
    }
    if (type === "thread" || type === "story" || type === "query" || type === "poll") {
      return { icon: <MessageSquare className="w-3 h-3 text-emerald-500" />, label: "Thread", bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300" };
    }
    return { icon: <Sparkles className="w-3 h-3 text-purple-500" />, label: "Result", bg: "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300" };
  };

  // Sizing tokens
  const sizeClasses = {
    sm: "py-1 px-3 text-xs",
    md: "py-1.5 px-3.5 text-xs sm:text-sm",
    lg: "py-2 px-4 text-sm sm:text-base"
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Container */}
      <form
        onSubmit={handleFormSubmit}
        className={`flex items-center w-full rounded-full border transition-all duration-200 shadow-sm ${
          highContrastMode
            ? "bg-zinc-900 border-zinc-700 text-white focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-400/20"
            : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-zinc-100 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:shadow-md"
        } ${sizeClasses[size]}`}
      >
        {/* Search Icon */}
        <Search className="w-4 h-4 text-gray-400 dark:text-zinc-500 mr-2 flex-shrink-0" />

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent border-0 focus:outline-none placeholder-gray-400 dark:placeholder-zinc-500 font-medium"
        />

        {/* Clear Button */}
        {inputValue && (
          <button
            type="button"
            onClick={() => {
              setInputValue("");
              onChange("");
              onSearch("");
              setSuggestions([]);
              setIsOpen(false);
              if (inputRef.current) inputRef.current.focus();
            }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition flex-shrink-0 mr-1"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Voice Search Button */}
        {voiceEnabled && voiceSupported && (
          <button
            type="button"
            onClick={toggleVoiceSearch}
            className={`p-1.5 rounded-full transition flex-shrink-0 mr-1 ${
              isListening
                ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-500/40"
                : "text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            }`}
            title={isListening ? "Listening... click to stop" : "Voice search (Hindi, Malayalam, English, etc.)"}
          >
            {isListening ? <Mic className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Submit Action Button */}
        <button
          type="submit"
          className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold p-1.5 rounded-full transition flex items-center justify-center shrink-0 shadow-sm"
          title="Search"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Voice Listening Active Indicator */}
      {isListening && (
        <div className="absolute top-full left-0 right-0 mt-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-xs font-semibold text-red-600 dark:text-red-300 flex items-center justify-between z-50 animate-fadeIn">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Listening in {localStorage.getItem("memeclassroom_voice_lang") || "en-IN"}... Speak now!
          </span>
          <button
            type="button"
            onClick={toggleVoiceSearch}
            className="text-[10px] font-bold underline hover:opacity-80"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 top-full mt-2 rounded-2xl shadow-2xl border z-50 overflow-hidden backdrop-blur-md transition-all duration-200 ${
            highContrastMode
              ? "bg-zinc-950/95 border-zinc-800 text-white divide-y divide-zinc-850"
              : "bg-white/95 dark:bg-zinc-900/95 border-gray-150 dark:border-zinc-800 text-gray-800 dark:text-zinc-100 divide-y divide-gray-50 dark:divide-zinc-850"
          }`}
        >
          <div className="px-3.5 py-1.5 bg-gray-50/70 dark:bg-zinc-850/50 flex items-center justify-between text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-500" />
              Suggested Results
            </span>
            <span>Use ↑ ↓ & Enter</span>
          </div>

          <div className="py-1 max-h-72 overflow-y-auto">
            {suggestions.map((suggestion, index) => {
              const badge = getSuggestionBadge(suggestion);
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={`${suggestion.label}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className={`px-3.5 py-2.5 flex items-center justify-between gap-2.5 cursor-pointer transition text-xs ${
                    isSelected
                      ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold"
                      : "hover:bg-gray-50/80 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="flex-shrink-0 text-gray-400 dark:text-zinc-500">
                      {badge.icon}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium text-gray-900 dark:text-zinc-100">
                        {suggestion.label}
                      </span>
                      {suggestion.subject && (
                        <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-medium">
                          {suggestion.subject}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {suggestion.isTranslated && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300"
                        title={`Matched translation for: "${suggestion.translatedQuery}"`}
                      >
                        <Globe className="w-2.5 h-2.5" />
                        {suggestion.translatedQuery}
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.bg}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            onClick={() => triggerSearch(inputValue)}
            className="px-3.5 py-2 bg-gray-50/50 dark:bg-zinc-850/30 hover:bg-purple-50 dark:hover:bg-purple-950/20 text-purple-600 dark:text-purple-400 font-bold text-[11px] cursor-pointer flex items-center justify-between transition"
          >
            <span>See all results for "{inputValue}"</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      )}
    </div>
  );
}
