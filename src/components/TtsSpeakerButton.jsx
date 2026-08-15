import React, { useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { speechService } from "../utils/speechUtils";

const TtsSpeakerButton = ({ text, id = "tts-item", label = "Listen Aloud", size = "sm", className = "" }) => {
  const [isSpeaking, setIsSpeaking] = useState(speechService.isSpeaking(id));
  const isSupported = speechService.isSupported();

  useEffect(() => {
    const unsub = speechService.subscribe((currentId) => {
      setIsSpeaking(currentId === id);
    });
    return () => unsub();
  }, [id]);

  if (!isSupported || !text) return null;

  const handleToggle = (e) => {
    e.stopPropagation();
    speechService.speak(text, id);
  };

  const isSmall = size === "sm";

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={isSpeaking ? "Stop Reading" : label}
      className={`inline-flex items-center gap-1.5 font-bold rounded-xl transition-all duration-200 ${
        isSpeaking
          ? "bg-purple-600 text-white shadow-md shadow-purple-500/25 animate-pulse"
          : "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60"
      } ${isSmall ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs"} ${className}`}
    >
      {isSpeaking ? (
        <>
          <VolumeX className={isSmall ? "w-3.5 h-3.5" : "w-4 h-4"} />
          <span>Stop</span>
        </>
      ) : (
        <>
          <Volume2 className={isSmall ? "w-3.5 h-3.5" : "w-4 h-4"} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};

export default TtsSpeakerButton;
