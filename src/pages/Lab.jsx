import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc,
  setDoc, 
  serverTimestamp, 
  updateDoc,
  increment,
  query,
  where,
  onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import { MEDIA_SAMPLES } from "../constants/mediaSamples";
import { SUBJECTS, GRADE_GROUPS } from "../constants/taxonomy";
import { trackCustomSubmission } from "../utils/taxonomyUtils";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useVideoTrim } from "../hooks/useVideoTrim";
import LibraryPickerModal from "../components/LibraryPickerModal";
import GiphySearch from "../components/GiphySearch";
import AudiogramCanvas from "../components/AudiogramCanvas";
import { useToast } from "../components/ToastNotification";
import html2canvas from "html2canvas";

// ── Format tab icon map ───────────────────────────────────────────────────────
const TAB_ICONS = {
  image: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  video: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  gif: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  audio: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  ),
};

const Lab = () => {
  const { user, profile } = useAuth();
  const { highContrastMode, fontSizeAdjustment } = useUdl();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Tab State: "image" | "video" | "gif" | "audio"
  const [activeTab, setActiveTab] = useState("image");

  // Template Remix state preloaded from route parameters
  const [templateId, setTemplateId] = useState(null);

  // Preload Template parameters
  useEffect(() => {
    const tId = searchParams.get("templateId");
    const tUrl = searchParams.get("templateUrl");
    const format = searchParams.get("format");
    const clearText = searchParams.get("clearText");

    if (tUrl) {
      setTemplateId(tId || "");
      if (format === "image" || !format) {
        setImages([tUrl]);
        setActiveTab("image");
      } else if (format === "video") {
        setVideoUrl(tUrl);
        setActiveTab("video");
      } else if (format === "gif") {
        setGifUrl(tUrl);
        setActiveTab("gif");
      } else if (format === "audio") {
        setAudioUrl(tUrl);
        setActiveTab("audio");
      }

      if (clearText === "true") {
        setTextLayers([]);
      }
    }
  }, [searchParams]);

  // Fetch approved templates from Firestore
  useEffect(() => {
    const q = query(
      collection(db, "templates"),
      where("status", "==", "approved")
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailableTemplates(list);
    });
    return () => unsub();
  }, []);

  const handleSelectTemplate = (temp) => {
    setTemplateId(temp.id);
    if (temp.format === "image" || !temp.format) {
      if (images.length >= 4) {
        setAlertMessage("You can only add up to 4 images to the collage.");
        return;
      }
      setImages(prev => [...prev, temp.media_url]);
      setActiveTab("image");
    } else if (temp.format === "video") {
      setVideoUrl(temp.media_url);
      setActiveTab("video");
    } else if (temp.format === "gif") {
      setGifUrl(temp.media_url);
      setActiveTab("gif");
    } else if (temp.format === "audio") {
      setAudioUrl(temp.media_url);
      setActiveTab("audio");
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "configs", "taxonomy"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.subjects?.length) {
          const loadedSubs = data.subjects.includes("Other") ? data.subjects : [...data.subjects, "Other"];
          setSubjects(loadedSubs);
        }
        if (data.grades?.length) {
          const hasOldGrades = data.grades.some(g => ["10-12", "13-15", "16-18", "University"].includes(g));
          setGradeGroups(hasOldGrades ? GRADE_GROUPS : data.grades);
        }
        if (data.languages?.length) {
          const loadedLangs = data.languages.includes("Other") ? data.languages : [...data.languages, "Other"];
          setLanguages(loadedLangs);
        }
      }
    });
    return () => unsub();
  }, []);

  // Preload draft parameters to resume editing
  useEffect(() => {
    const draftId = searchParams.get("draftId");
    if (!draftId) return;

    const loadDraft = async () => {
      try {
        const draftDoc = await getDoc(doc(db, "memes", draftId));
        if (draftDoc.exists()) {
          const data = draftDoc.data();
          setTitle(data.title || "");
          const loadedSubject = data.subject || "Biology";
          if (SUBJECTS.includes(loadedSubject)) {
            setSubject(loadedSubject);
            setCustomSubject("");
          } else {
            setSubject("Other");
            setCustomSubject(loadedSubject);
          }
          setAgeGroup(data.age_group || "High School (9–10)");
          const loadedLanguage = data.language || "English";
          const langOptions = ["English", "Hindi", "Malayalam", "Tamil"];
          if (langOptions.includes(loadedLanguage)) {
            setLanguage(loadedLanguage);
            setCustomLanguage("");
          } else {
            setLanguage("Other");
            setCustomLanguage(loadedLanguage);
          }
          setKeywords(Array.isArray(data.keywords) ? data.keywords.join(", ") : (data.keywords || ""));
          setActiveTab(data.format || "image");

          if (data.format === "image") {
            // Restore all collage images from media_urls_json (new field),
            // falling back to the legacy single media_url for older drafts.
            if (data.media_urls_json) {
              try {
                const parsedUrls = JSON.parse(data.media_urls_json);
                setImages(Array.isArray(parsedUrls) && parsedUrls.length > 0 ? parsedUrls : (data.media_url ? [data.media_url] : []));
              } catch {
                setImages(data.media_url ? [data.media_url] : []);
              }
            } else {
              setImages(data.media_url ? [data.media_url] : []);
            }
          } else if (data.format === "video") {
            setVideoUrl(data.media_url || "");
            // Restore captions if saved
            if (data.captions_json) {
              try {
                const parsedCaptions = JSON.parse(data.captions_json);
                if (Array.isArray(parsedCaptions)) {
                  setVideoCaptions(parsedCaptions.map(c => `${c.time} – ${c.text}`).join("\n"));
                }
              } catch { /* ignore malformed captions */ }
            }
          } else if (data.format === "gif") {
            setGifUrl(data.media_url || "");
          } else if (data.format === "audio") {
            setAudioUrl(data.media_url || "");
          }

          if (data.text_layers_json) {
            setTextLayers(JSON.parse(data.text_layers_json));
          }

          if (data.template_id) {
            setTemplateId(data.template_id);
          }

          draftIdRef.current = draftId;
        }
      } catch (err) {
        console.error("Failed to load draft", err);
        setAlertMessage("Failed to load the draft creation.");
      }
    };

    loadDraft();
  }, [searchParams]);

  // --- Image Tab State ---
  const [images, setImages] = useState([]); // Array of base64/object URLs
  const [imageFiles, setImageFiles] = useState([]); // Array of raw File objects

  // Collage layout format: "columns" | "rows" | "grid"
  const [collageLayout, setCollageLayout] = useState("columns");

  // Proportional values for Columns/Rows splits
  const [panelSizes, setPanelSizes] = useState([1, 1, 1, 1]);

  // Proportions for Grid split: top-to-bottom height ratio (y), top width ratio (topX), bottom width ratio (bottomX)
  const [gridSplit, setGridSplit] = useState({ y: 0.5, topX: 0.5, bottomX: 0.5 });

  // Drag-resize state for collage dividers
  const collageDragRef = useRef({ 
    active: false, 
    type: "", 
    dividerIdx: 0, 
    startX: 0, 
    startY: 0, 
    startSizes: [], 
    startSplit: {} 
  });

  // Reset panelSizes & gridSplit to equal distribution whenever image count changes
  useEffect(() => {
    setPanelSizes([1, 1, 1, 1]);
    setGridSplit({ y: 0.5, topX: 0.5, bottomX: 0.5 });
    // Reset layout to columns if less than 4 images
    if (images.length < 4 && collageLayout === "grid") {
      setCollageLayout("columns");
    }
  }, [images.length]);

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // --- Video Tab State ---
  const [videoUrl, setVideoUrl] = useState(MEDIA_SAMPLES?.video?.[0]?.url || "");
  const [videoFile, setVideoFile] = useState(null); // Raw File object
  const [videoDuration, setVideoDuration] = useState(15);
  const [videoTrimStart, setVideoTrimStart] = useState(0);
  const [videoTrimEnd, setVideoTrimEnd] = useState(15);
  // Phase 2E: timed captions — one per line, format: "0:02 – Caption text"
  const [videoCaptions, setVideoCaptions] = useState("");

  // --- GIF Tab State ---
  const [gifUrl, setGifUrl] = useState(MEDIA_SAMPLES?.gif?.[0]?.url || "");
  const [gifFile, setGifFile] = useState(null);
  const [showLibraryPickerModal, setShowLibraryPickerModal] = useState(false);

  // --- Audio Tab State ---
  const [audioUrl, setAudioUrl] = useState(MEDIA_SAMPLES?.audio?.[0]?.url || "");
  const [audioFile, setAudioFile] = useState(null); // Raw File object
  const [audioTrimStart, setAudioTrimStart] = useState(0);
  const [audioTrimEnd, setAudioTrimEnd] = useState(15);

  // --- Text Overlay State (with undo/redo history) ---
  const DEFAULT_LAYER = {
    id: "txt-1",
    text: "Double click to edit",
    x: 150,
    y: 100,
    fontSize: 28,
    color: "#FFFFFF",
    fontFamily: "Impact",
    strokeColor: "#000000",
    strokeWidth: 2,
    textAlign: "left",
    opacity: 1,
    rotation: 0,
    maxWidth: null,
  };

  const {
    state: textLayers,
    set: setTextLayersWithHistory,
    undo: undoTextLayers,
    redo: redoTextLayers,
    canUndo,
    canRedo,
  } = useUndoRedo([DEFAULT_LAYER]);

  // Convenience wrapper that also accepts functional updaters
  const setTextLayers = useCallback((updater) => {
    setTextLayersWithHistory(prev =>
      typeof updater === "function" ? updater(prev) : updater
    );
  }, [setTextLayersWithHistory]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);

  // --- General Modals & Alert States ---
  const [activeControlTab, setActiveControlTab] = useState("media");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [publishToLibrary, setPublishToLibrary] = useState(true);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Biology");
  const [customSubject, setCustomSubject] = useState("");
  const [ageGroup, setAgeGroup] = useState("High School (9–10)");
  const [language, setLanguage] = useState("English");
  const [customLanguage, setCustomLanguage] = useState("");
  const [keywords, setKeywords] = useState("");

  const [subjects, setSubjects] = useState(SUBJECTS);
  const [gradeGroups, setGradeGroups] = useState(GRADE_GROUPS);
  const [languages, setLanguages] = useState(["English", "Hindi", "Malayalam", "Tamil", "Other"]);
  const [formSubjectSearch, setFormSubjectSearch] = useState("");
  const [formLanguageSearch, setFormLanguageSearch] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [autoSaveToast, setAutoSaveToast] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Week 6: ffmpeg.wasm trim state ---
  const [isTrimming, setIsTrimming] = useState(false);
  const [ffmpegProgress, setFfmpegProgress] = useState(0); // 0–1
  const { trimVideo } = useVideoTrim();

  // --- Week 7: Audiogram card customisation state ---
  const [audiogramBgColor, setAudiogramBgColor] = useState("#1e1b4b");
  const [audiogramAccentColor, setAudiogramAccentColor] = useState("#a78bfa");
  const audiogramRef = useRef(null); // ref to AudiogramCanvas instance

  // --- Template Upload Pipeline State ---
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateFile, setTemplateFile] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateSuccess, setTemplateSuccess] = useState("");
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [showContributeModal, setShowContributeModal] = useState(false);

  // Refs
  const canvasContainerRef = useRef(null);
  const videoPlayerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const dragInfoRef = useRef({ isDragging: false, textId: null, startX: 0, startY: 0, startLeft: 0, startTop: 0 });

  // Drag and Drop files upload state
  const [isDragOverDropzone, setIsDragOverDropzone] = useState(false);

  const handleDropzoneDrop = (e) => {
    e.preventDefault();
    setIsDragOverDropzone(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if (activeTab === "image") {
        const fileArray = Array.from(files).filter(f => f.type.startsWith("image/"));
        if (images.length + fileArray.length > 4) {
          setAlertMessage("You can select up to 4 images for the collage.");
          return;
        }
        const newUrls = fileArray.map(file => createObjectURLSafe(file));
        setImages(prev => [...prev, ...newUrls]);
        setImageFiles(prev => [...prev, ...fileArray]);
      } else if (activeTab === "video") {
        const videoFile = files[0];
        if (videoFile && videoFile.type.startsWith("video/")) {
          handleVideoUpload({ target: { files: [videoFile] } });
        }
      } else if (activeTab === "audio") {
        const audioFile = files[0];
        if (audioFile && audioFile.type.startsWith("audio/")) {
          setAudioUrl(createObjectURLSafe(audioFile));
          setAudioFile(audioFile);
        }
      } else if (activeTab === "gif") {
        const gFile = files[0];
        if (gFile && gFile.type === "image/gif") {
          setGifUrl(createObjectURLSafe(gFile));
          setGifFile(gFile);
        }
      }
    }
  };

  // Auto-Save Drafts reference ID in Firestore
  const draftIdRef = useRef(null);

  // Track dynamically created Object URLs to prevent memory leaks
  const createdObjectUrlsRef = useRef([]);
  const createObjectURLSafe = (file) => {
    const url = URL.createObjectURL(file);
    createdObjectUrlsRef.current.push(url);
    return url;
  };

  // Revoke all tracked Object URLs on component unmount
  useEffect(() => {
    return () => {
      createdObjectUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error("Failed to revoke URL", url, e);
        }
      });
    };
  }, []);

  // Check Video duration & restrict files >= 15 seconds
  const handleVideoUpload = (e) => {
    setAlertMessage("");
    const file = e.target.files?.[0];
    if (!file) return;

    // Create virtual video element to inspect duration metadata
    const videoElement = document.createElement("video");
    videoElement.preload = "metadata";
    videoElement.src = URL.createObjectURL(file);
    videoElement.onloadedmetadata = () => {
      window.URL.revokeObjectURL(videoElement.src);
      if (videoElement.duration >= 15) {
        setAlertMessage("Video memes must be under 15 seconds");
        setVideoUrl("");
        setVideoFile(null);
      } else {
        setVideoUrl(createObjectURLSafe(file));
        setVideoFile(file);
        setVideoDuration(videoElement.duration);
        setVideoTrimStart(0);
        setVideoTrimEnd(videoElement.duration);
      }
    };
  };

  // Image Upload support (max 4 collage images)
  const handleImageUpload = (e) => {
    setAlertMessage("");
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 4) {
      setAlertMessage("You can select up to 4 images for the collage.");
      return;
    }

    const newUrls = files.map(file => createObjectURLSafe(file));
    setImages(prev => [...prev, ...newUrls]);
    setImageFiles(prev => [...prev, ...files]);
  };

  // Handle media templates selections from constants mapping
  const selectMediaPreset = (url, type, duration = 15) => {
    if (type === "video") {
      setVideoUrl(url);
      setVideoFile(null);
      setVideoDuration(duration);
      setVideoTrimStart(0);
      setVideoTrimEnd(duration);
    } else if (type === "audio") {
      setAudioUrl(url);
      setAudioFile(null);
      setAudioTrimStart(0);
      setAudioTrimEnd(duration);
    } else if (type === "gif") {
      setGifUrl(url);
    }
  };

  // --- Drag and Drop Text Layer Engine ---
  const handleTextPointerDown = (e, textId) => {
    e.preventDefault();
    setSelectedTextId(textId);
    
    const layer = textLayers.find(l => l.id === textId);
    if (!layer) return;

    dragInfoRef.current = {
      isDragging: true,
      textId: textId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: layer.x,
      startTop: layer.y
    };
  };

  const handlePointerMove = (e) => {
    if (!dragInfoRef.current.isDragging) return;
    const info = dragInfoRef.current;
    
    const deltaX = e.clientX - info.startX;
    const deltaY = e.clientY - info.startY;

    setTextLayers(prev => 
      prev.map(layer => {
        if (layer.id === info.textId) {
          return {
            ...layer,
            x: info.startLeft + deltaX,
            y: info.startTop + deltaY
          };
        }
        return layer;
      })
    );
  };

  const handlePointerUp = () => {
    dragInfoRef.current.isDragging = false;
  };

  const addTextLayer = () => {
    const newId = `txt-${Date.now()}`;
    setTextLayers(prev => [
      ...prev,
      {
        id: newId,
        text: "New Text Layer",
        x: 100 + Math.random() * 50,
        y: 100 + Math.random() * 50,
        fontSize: 24,
        color: "#FFFFFF",
        fontFamily: "Impact",
        strokeColor: "#000000",
        strokeWidth: 2,
        textAlign: "left",
        opacity: 1,
        rotation: 0,
        maxWidth: null,
      }
    ]);
    setSelectedTextId(newId);
  };

  const updateTextLayer = (field, value) => {
    if (!selectedTextId) return;
    setTextLayers(prev =>
      prev.map(layer => {
        if (layer.id === selectedTextId) {
          return { ...layer, [field]: value };
        }
        return layer;
      })
    );
  };

  const deleteSelectedText = () => {
    if (!selectedTextId) return;
    setTextLayers(prev => prev.filter(layer => layer.id !== selectedTextId));
    setSelectedTextId(null);
  };

  const duplicateSelectedText = () => {
    if (!selectedTextId) return;
    const layer = textLayers.find(l => l.id === selectedTextId);
    if (!layer) return;
    const newId = `txt-${Date.now()}`;
    setTextLayers(prev => [...prev, { ...layer, id: newId, x: layer.x + 20, y: layer.y + 20 }]);
    setSelectedTextId(newId);
  };

  // Keyboard Undo/Redo handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoTextLayers();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redoTextLayers();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoTextLayers, redoTextLayers]);

  // Video trim preview loop
  useEffect(() => {
    const video = videoPlayerRef.current;
    if (!video || activeTab !== "video" || !videoUrl) return;

    const checkTime = () => {
      if (video.currentTime > videoTrimEnd) {
        video.currentTime = videoTrimStart;
      }
      if (video.currentTime < videoTrimStart) {
        video.currentTime = videoTrimStart;
      }
    };

    video.addEventListener("timeupdate", checkTime);
    return () => {
      video.removeEventListener("timeupdate", checkTime);
    };
  }, [videoTrimStart, videoTrimEnd, videoUrl, activeTab]);

  // Audio trim preview loop
  useEffect(() => {
    const audio = audioPlayerRef.current;
    if (!audio || activeTab !== "audio" || !audioUrl) return;

    const checkTime = () => {
      if (audio.currentTime > audioTrimEnd) {
        audio.currentTime = audioTrimStart;
      }
      if (audio.currentTime < audioTrimStart) {
        audio.currentTime = audioTrimStart;
      }
    };

    audio.addEventListener("timeupdate", checkTime);
    return () => {
      audio.removeEventListener("timeupdate", checkTime);
    };
  }, [audioTrimStart, audioTrimEnd, audioUrl, activeTab]);

  // --- Phase 2E: Caption line parser ---
  // Converts the human-readable textarea format into a structured array.
  // Input:  "0:02 – Caption text\n0:06 – Another caption"
  // Output: [{ time: 2, text: "Caption text" }, { time: 6, text: "Another caption" }]
  const parseCaptionLines = (raw = "") => {
    return raw
      .split("\n")
      .map(line => {
        // Allow both dash variants: – (em-dash) and - (hyphen)
        const match = line.match(/^(\d+):(\d+)\s*[–\-]\s*(.+)$/);
        if (!match) return null;
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        return { time: minutes * 60 + seconds, text: match[3].trim() };
      })
      .filter(Boolean);
  };

  // --- Background Auto-Save Worker (30 Seconds) ---

  useEffect(() => {
    if (!user) return;

    const autoSaveInterval = setInterval(async () => {
      try {
        const finalSubject = subject === "Other" ? (customSubject.trim() || "Other") : subject;
        const finalLanguage = language === "Other" ? (customLanguage.trim() || "Other") : language;
        const parsedKeywords = keywords ? keywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean) : [];
        const docData = {
          creator_id: user.uid,
          title: title || "Auto-Saved Draft",
          subject: finalSubject,
          age_group: ageGroup,
          format: activeTab,
          language: finalLanguage,
          keywords: parsedKeywords,
          visibility: "draft",
          media_url: activeTab === "image" ? (images[0] || "") : activeTab === "video" ? videoUrl : activeTab === "gif" ? gifUrl : audioUrl,
          // media_urls_json persists all collage images (up to 4) so drafts fully restore
          media_urls_json: activeTab === "image" ? JSON.stringify(images) : "[]",
          text_layers_json: JSON.stringify(textLayers),
          // Phase 2E: persist video captions
          captions_json: activeTab === "video" ? JSON.stringify(parseCaptionLines(videoCaptions)) : "[]",
          template_id: templateId || "",
          updated_at: serverTimestamp()
        };

        if (draftIdRef.current) {
          const draftDocRef = doc(db, "memes", draftIdRef.current);
          await updateDoc(draftDocRef, docData);
        } else {
          const memesColRef = collection(db, "memes");
          const res = await addDoc(memesColRef, {
            ...docData,
            created_at: serverTimestamp()
          });
          draftIdRef.current = res.id;
        }

        const now = new Date();
        setAutoSaveToast(`Draft auto-saved at ${now.toLocaleTimeString()}`);
        setTimeout(() => setAutoSaveToast(""), 3000);
      } catch (e) {
        console.error("Auto-save failed", e);
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [user, title, subject, customSubject, ageGroup, activeTab, language, customLanguage, keywords, images, videoUrl, gifUrl, audioUrl, textLayers]);

  const loadImage = (src) => {
    return new Promise(async (resolve, reject) => {
      let blobUrl = null;
      try {
        let finalSrc = src;

        // Fetch external templates via CORS proxy as Blobs to bypass canvas taint errors
        if (src.startsWith("http") && !src.startsWith(window.location.origin)) {
          const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(src)}`;
          const response = await fetch(proxiedUrl);
          if (response.ok) {
            const blob = await response.blob();
            blobUrl = URL.createObjectURL(blob);
            finalSrc = blobUrl;
          }
        }

        const img = new Image();
        img.src = finalSrc;
        img.onload = () => {
          resolve(img);
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
          }
        };
        img.onerror = (e) => {
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
          }
          reject(e);
        };
      } catch (err) {
        // Fallback to loading original source with crossOrigin anonymous if fetch fails
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
      }
    });
  };

  // --- Canvas Settings State ---
  const [canvasAspect, setCanvasAspect] = useState("1:1"); // "1:1" | "16:9" | "9:16" | "4:3"
  const [canvasBg, setCanvasBg] = useState("#1e293b"); // background fill color

  const ASPECT_RATIOS = {
    "1:1":  { css: "aspect-square",  w: 1, h: 1 },
    "16:9": { css: "aspect-video",   w: 16, h: 9 },
    "9:16": { css: "aspect-[9/16]",  w: 9, h: 16 },
    "4:3":  { css: "aspect-[4/3]",   w: 4, h: 3 },
  };

  const generateMemeBlob = async () => {
    const container = canvasContainerRef.current;
    if (!container) return null;
    const scale = 1;
    const displayW = container.offsetWidth || 500;
    const displayH = container.offsetHeight || 500;
    const width  = displayW * scale;
    const height = displayH * scale;

    const canvas = document.createElement("canvas");
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Draw background
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, width, height);

    // Draw images collage if activeTab is "image"
    if (activeTab === "image" && images.length > 0) {
      const numImages = images.length;
      const loadedImages = [];
      for (let i = 0; i < numImages; i++) {
        try {
          const img = await loadImage(images[i]);
          loadedImages.push(img);
        } catch (err) {
          console.error("Failed to load image", images[i], err);
          loadedImages.push(null);
        }
      }

      const drawImageContain = (img, dx, dy, dw, dh) => {
        if (!img) return;
        const imageAspect = img.width / img.height;
        const containerAspect = dw / dh;
        let targetW = dw;
        let targetH = dh;
        let targetX = dx;
        let targetY = dy;
        if (imageAspect > containerAspect) {
          targetH = dw / imageAspect;
          targetY = dy + (dh - targetH) / 2;
        } else {
          targetW = dh * imageAspect;
          targetX = dx + (dw - targetW) / 2;
        }
        ctx.drawImage(img, targetX, targetY, targetW, targetH);
      };

      if (numImages === 1) {
        if (loadedImages[0]) drawImageContain(loadedImages[0], 0, 0, width, height);
      } else if (collageLayout === "columns") {
        const activeSizes = panelSizes.slice(0, numImages);
        const totalWeight = activeSizes.reduce((a, b) => a + b, 0);
        let currentX = 0;
        for (let i = 0; i < numImages; i++) {
          const w = Math.round(width * (activeSizes[i] / totalWeight));
          const wActual = (i === numImages - 1) ? (width - currentX) : w;
          if (loadedImages[i]) {
            drawImageContain(loadedImages[i], currentX, 0, wActual, height);
          }
          currentX += wActual;
        }
      } else if (collageLayout === "rows") {
        const activeSizes = panelSizes.slice(0, numImages);
        const totalWeight = activeSizes.reduce((a, b) => a + b, 0);
        let currentY = 0;
        for (let i = 0; i < numImages; i++) {
          const h = Math.round(height * (activeSizes[i] / totalWeight));
          const hActual = (i === numImages - 1) ? (height - currentY) : h;
          if (loadedImages[i]) {
            drawImageContain(loadedImages[i], 0, currentY, width, hActual);
          }
          currentY += hActual;
        }
      } else if (collageLayout === "grid" && numImages === 4) {
        const topH = Math.round(height * gridSplit.y);
        const botH = height - topH;
        
        const topW1 = Math.round(width * gridSplit.topX);
        const topW2 = width - topW1;
        
        const botW1 = Math.round(width * gridSplit.bottomX);
        const botW2 = width - botW1;

        if (loadedImages[0]) drawImageContain(loadedImages[0], 0, 0, topW1, topH);
        if (loadedImages[1]) drawImageContain(loadedImages[1], topW1, 0, topW2, topH);
        if (loadedImages[2]) drawImageContain(loadedImages[2], 0, topH, botW1, botH);
        if (loadedImages[3]) drawImageContain(loadedImages[3], botW1, topH, botW2, botH);
      } else {
        if (loadedImages[0]) drawImageContain(loadedImages[0], 0, 0, width, height);
      }
    }

    // Draw text overlays — supports align, opacity, rotation, maxWidth
    textLayers.forEach(layer => {
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;

      const scaledX = layer.x * scale;
      const scaledY = layer.y * scale;
      const scaledFontSize = layer.fontSize * scale;

      // Rotate around the text origin point
      if (layer.rotation) {
        ctx.translate(scaledX, scaledY);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.translate(-scaledX, -scaledY);
      }

      ctx.font = `${scaledFontSize}px ${layer.fontFamily || 'Impact'}`;
      ctx.fillStyle = layer.color || '#FFFFFF';
      ctx.strokeStyle = layer.strokeColor || '#000000';
      ctx.lineWidth = (layer.strokeWidth || 0) * 2 * scale;
      ctx.textBaseline = 'top';
      ctx.textAlign = layer.textAlign || 'left';

      const maxW = layer.maxWidth ? layer.maxWidth * scale : undefined;

      if (layer.strokeWidth > 0) {
        ctx.strokeText(layer.text, scaledX, scaledY, maxW);
      }
      ctx.fillText(layer.text, scaledX, scaledY, maxW);
      ctx.restore();
    });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/png");
    });
  };

  // --- Final Publish & Save Workflow ---
  const handlePublishSubmit = async (overridePublish) => {
    const isPublic = typeof overridePublish === "boolean" ? overridePublish : publishToLibrary;

    // --- CASE A: DOWNLOAD ONLY FLOW (Bypass cloud database & validations) ---
    if (!isPublic) {
      setLoading(true);
      setAlertMessage("");
      try {
        if (activeTab === "image") {
          const blob = await generateMemeBlob();
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.download = `${title.trim() || "meme"}.png`;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        } else if (activeTab === "gif") {
          const workspaceElement = canvasContainerRef.current;
          if (workspaceElement) {
            const canvasResult = await html2canvas(workspaceElement, {
              useCORS: true,
              backgroundColor: canvasBg || "#FFFFFF"
            });
            const blob = await new Promise(resolve => canvasResult.toBlob(resolve, "image/png"));
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.download = `${title.trim() || "gif_meme"}.png`;
              a.href = url;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }
          }
        } else if (activeTab === "video") {
          // Week 6: real ffmpeg.wasm trim for download-only flow
          if (videoFile && window.crossOriginIsolated) {
            try {
              setIsTrimming(true);
              setFfmpegProgress(0);
              const trimmedBlob = await trimVideo(videoFile, videoTrimStart, videoTrimEnd, (p) => setFfmpegProgress(p));
              const url = URL.createObjectURL(trimmedBlob);
              const a = document.createElement("a");
              a.download = `${title.trim() || "video_meme"}.mp4`;
              a.href = url;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } finally {
              setIsTrimming(false);
            }
          } else {
            // Fallback: download raw video (no trim) — handles sample URLs and non-isolated browsers
            const a = document.createElement("a");
            a.download = `${title.trim() || "video_meme"}.mp4`;
            a.href = videoUrl;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        } else if (activeTab === "audio") {
          // Week 7: download the audiogram card PNG for audio memes
          if (audiogramRef.current) {
            try {
              const cardBlob = await audiogramRef.current.generateCardBlob();
              if (cardBlob) {
                const url = URL.createObjectURL(cardBlob);
                const a = document.createElement("a");
                a.download = `${title.trim() || "audio_meme"}_card.png`;
                a.href = url;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }
            } catch (_) {
              // Fallback to raw audio download
              const a = document.createElement("a");
              a.download = `${title.trim() || "audio_meme"}.mp3`;
              a.href = audioUrl;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
          } else {
            const a = document.createElement("a");
            a.download = `${title.trim() || "audio_meme"}.mp3`;
            a.href = audioUrl;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        }
        setShowSaveModal(false);
      } catch (err) {
        console.error(err);
        setAlertMessage("Failed to download local file.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- CASE B: PUBLISH TO COMMUNITY LIBRARY FLOW (Require authentication & fields metadata validation) ---
    if (!user) {
      setAlertMessage("You must be logged in to publish creations to the library.");
      return;
    }
    if (!title.trim()) {
      setAlertMessage("Creations published to the library require a Meme Title.");
      return;
    }

    setLoading(true);
    setAlertMessage("");

    try {
      let fileUrl = activeTab === "image" 
        ? (images[0] || "/samples/confused_student_sample.gif") 
        : activeTab === "video" 
          ? videoUrl 
          : activeTab === "gif" 
            ? gifUrl 
            : audioUrl;

      // 1. Compile image and upload if activeTab is image
      if (activeTab === "image") {
        const blob = await generateMemeBlob();
        if (blob) {
          // Upload compiled PNG image to Firebase Storage
          const storageRef = ref(storage, `memes/${user.uid}_meme_${Date.now()}.png`);
          const snapshot = await uploadBytes(storageRef, blob);
          fileUrl = await getDownloadURL(snapshot.ref);

          // Local file download trigger
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `${title.trim() || 'meme'}.png`;
          link.href = downloadUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
        }
      } 
      // 2. Week 6: Real ffmpeg.wasm trim → upload trimmed video to Storage
      else if (activeTab === "video" && videoFile) {
        let videoBlob = videoFile; // default: upload as-is

        if (window.crossOriginIsolated) {
          try {
            setIsTrimming(true);
            setFfmpegProgress(0);
            videoBlob = await trimVideo(
              videoFile,
              videoTrimStart,
              videoTrimEnd,
              (p) => setFfmpegProgress(p)
            );
          } catch (trimErr) {
            console.warn("ffmpeg trim failed, falling back to original file:", trimErr);
          } finally {
            setIsTrimming(false);
          }
        } else {
          // Not cross-origin-isolated — inform user but continue upload
          console.warn("crossOriginIsolated is false — uploading original video without trim.");
        }

        const storageRef = ref(storage, `memes/${user.uid}_meme_${Date.now()}.mp4`);
        const snapshot = await uploadBytes(storageRef, videoBlob);
        fileUrl = await getDownloadURL(snapshot.ref);

        // Local download of trimmed video
        const trimmedUrl = URL.createObjectURL(videoBlob);
        const link = document.createElement("a");
        link.download = `${title.trim() || 'meme'}.mp4`;
        link.href = trimmedUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(trimmedUrl);
      } 
      // 3. Week 7: Generate audiogram PNG card → upload as the meme's media_url
      else if (activeTab === "audio") {
        // Step A: upload the raw audio file so QR code can point to it
        let audioFileUrl = audioUrl;
        if (audioFile) {
          const audioStorageRef = ref(storage, `memes/${user.uid}_audio_${Date.now()}`);
          const audioSnapshot = await uploadBytes(audioStorageRef, audioFile);
          audioFileUrl = await getDownloadURL(audioSnapshot.ref);
        }

        // Step B: generate audiogram PNG card
        if (audiogramRef.current) {
          try {
            // Pass the now-public audioFileUrl so the QR code is embeddable
            const cardBlob = await audiogramRef.current.generateCardBlob();
            if (cardBlob) {
              const cardStorageRef = ref(storage, `memes/${user.uid}_audiogram_${Date.now()}.png`);
              const cardSnapshot = await uploadBytes(cardStorageRef, cardBlob);
              fileUrl = await getDownloadURL(cardSnapshot.ref); // audiogram PNG becomes media_url

              // Local download of the card PNG
              const downloadUrl = URL.createObjectURL(cardBlob);
              const link = document.createElement("a");
              link.download = `${title.trim() || 'audio_meme'}_card.png`;
              link.href = downloadUrl;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(downloadUrl);
            }
          } catch (cardErr) {
            console.warn("Audiogram card generation failed, using raw audio URL:", cardErr);
            fileUrl = audioFileUrl;
          }
        } else {
          fileUrl = audioFileUrl;
        }
      }
      // 4. Download local GIF file if it is loaded, using html2canvas to merge text overlays
      else if (activeTab === "gif") {
        if (gifFile) {
          const storageRef = ref(storage, `memes/${user.uid}_gif_${Date.now()}.gif`);
          const snapshot = await uploadBytes(storageRef, gifFile);
          fileUrl = await getDownloadURL(snapshot.ref);
        }

        // Generate flat preview screenshot with overlays for library display
        const workspaceElement = canvasContainerRef.current;
        if (workspaceElement) {
          try {
            const canvasResult = await html2canvas(workspaceElement, {
              useCORS: true,
              backgroundColor: canvasBg || "#FFFFFF"
            });
            const overlayBlob = await new Promise(resolve => canvasResult.toBlob(resolve, "image/png"));
            if (overlayBlob) {
              // Upload flat preview PNG to Firebase Storage so the library can show it
              const storageRef = ref(storage, `memes/${user.uid}_gif_preview_${Date.now()}.png`);
              const snapshot = await uploadBytes(storageRef, overlayBlob);
              fileUrl = await getDownloadURL(snapshot.ref);

              // Local download of the flat PNG meme (GIF frames frozen, text overlays burned in)
              const downloadUrl = URL.createObjectURL(overlayBlob);
              const link = document.createElement("a");
              link.download = `${title.trim() || 'meme'}.png`;
              link.href = downloadUrl;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(downloadUrl);
            }
          } catch (err) {
            console.error("html2canvas screenshot failed", err);
          }
        }
      }

      const finalSubject = subject === "Other" ? (customSubject.trim() || "Other") : subject;
      const finalLanguage = language === "Other" ? (customLanguage.trim() || "Other") : language;
      const parsedKeywords = keywords ? keywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean) : [];
      const memeData = {
        creator_id: user.uid,
        title: title.trim() || "My Meme Classroom Creation",
        subject: finalSubject,
        age_group: ageGroup,
        format: activeTab,
        language: finalLanguage,
        keywords: parsedKeywords,
        visibility: "public",
        media_url: fileUrl,
        // media_urls_json preserves all collage image URLs for display in Library
        media_urls_json: activeTab === "image" ? JSON.stringify(images) : "[]",
        text_layers_json: JSON.stringify(textLayers),
        // Phase 2E: persist parsed captions so the Library player can render them
        captions_json: activeTab === "video" ? JSON.stringify(parseCaptionLines(videoCaptions)) : "[]",
        template_id: templateId || "",
        created_at: serverTimestamp()
      };

      if (draftIdRef.current) {
        const draftDocRef = doc(db, "memes", draftIdRef.current);
        await setDoc(draftDocRef, memeData, { merge: true });
      } else {
        await addDoc(collection(db, "memes"), memeData);
      }

      // Update user stats for contributor points
      const statsRef = doc(db, "user_stats", user.uid);
      await setDoc(statsRef, {
        memes_created_count: increment(1)
      }, { merge: true });

      if (subject === "Other" && customSubject.trim()) {
        trackCustomSubmission("subject", customSubject.trim());
      }
      if (language === "Other" && customLanguage.trim()) {
        trackCustomSubmission("language", customLanguage.trim());
      }

      setShowSaveModal(false);
      navigate("/library");
    } catch (err) {
      console.error(err);
      setAlertMessage("Failed to save and publish the creation.");
    } finally {
      setLoading(false);
    }
  };

  // --- Separate Template Contribution Pipeline ---
  const handleTemplateUploadSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!templateFile) {
      setTemplateSuccess("Please select a background file to upload.");
      return;
    }

    setTemplateLoading(true);
    setTemplateSuccess("");

    try {
      const storageRef = ref(storage, `templates/${user.uid}_temp_${Date.now()}`);
      const snapshot = await uploadBytes(storageRef, templateFile);
      const fileUrl = await getDownloadURL(snapshot.ref);

      let detectedFormat = "image";
      if (templateFile.type.startsWith("video/")) {
        detectedFormat = "video";
      } else if (templateFile.type.startsWith("audio/")) {
        detectedFormat = "audio";
      } else if (templateFile.type === "image/gif") {
        detectedFormat = "gif";
      }

      await addDoc(collection(db, "templates"), {
        title: templateTitle || "Blank Background Template",
        creator_id: user.uid,
        media_url: fileUrl,
        format: detectedFormat,
        is_admin_preset: false,
        status: "pending", // Baseline schema requirement to lock visibility from editor
        created_at: serverTimestamp()
      });

      setTemplateSuccess("Template contributed successfully! Awaiting Admin approval.");
      setTemplateTitle("");
      setTemplateFile(null);
      setTimeout(() => {
        setShowContributeModal(false);
        setTemplateSuccess("");
      }, 2000);
    } catch (err) {
      console.error(err);
      setTemplateSuccess("Upload failed. Ensure permissions match.");
    } finally {
      setTemplateLoading(false);
    }
  };

  // Styles dynamically adjusted for UDL settings
  const containerClass = highContrastMode 
    ? "bg-zinc-900 border border-zinc-800 text-white shadow-sm rounded-xl" 
    : "bg-white border border-gray-200 shadow-sm rounded-xl";

  const btnClass = "bg-purple-600 hover:bg-purple-750 text-white font-medium px-4 py-2 rounded-lg transition";

  const cancelBtnClass = highContrastMode
    ? "bg-zinc-800 text-gray-300 font-bold px-4 py-2 rounded-lg hover:bg-zinc-700"
    : "bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium px-4 py-2 rounded-lg transition";

  const activeTextLayer = textLayers.find(l => l.id === selectedTextId);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      
      {/* Page Title & Guidelines Toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 dark:border-gray-800 pb-5 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Meme Lab Studio</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create high-pedagogy multi-media memes with overlays and custom templates.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2 items-center">
          <button
            onClick={() => setShowTutorialModal(true)}
            className="flex items-center space-x-1.5 border border-purple-300 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 text-purple-600 dark:text-purple-400 text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            <span>ℹ️ Tutorial & Guidelines</span>
          </button>
          
          <button
            onClick={() => setShowSaveModal(true)}
            className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg shadow-md transition duration-200 text-sm flex items-center space-x-1.5"
          >
            <span>💾 Export Studio Meme</span>
          </button>
        </div>
      </div>

      {alertMessage && (
        <div className="mb-6 p-4 rounded-lg bg-red-100 dark:bg-red-955 border border-red-200 dark:border-red-800 text-red-750 font-medium text-sm">
          {alertMessage}
        </div>
      )}

      {autoSaveToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white text-xs px-4 py-2 rounded-lg shadow-lg border border-gray-700 animate-pulse">
          💾 {autoSaveToast}
        </div>
      )}

      {/* Week 6: ffmpeg.wasm real-trim progress overlay */}
      {isTrimming && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-purple-700 rounded-2xl px-8 py-6 flex flex-col items-center gap-4 shadow-2xl min-w-[280px]">
            <div className="text-3xl animate-bounce">✂️</div>
            <p className="text-white font-bold text-sm">Trimming video…</p>
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.round(ffmpegProgress * 100)}%` }}
              />
            </div>
            <p className="text-gray-400 text-xs">{Math.round(ffmpegProgress * 100)}% — this may take 15–30 seconds</p>
          </div>
        </div>
      )}

            {/* Unified SaaS Workbench Card */}
      <div className={`flex flex-col lg:flex-row h-auto lg:h-[720px] rounded-2xl overflow-hidden shadow-2xl border ${
        highContrastMode 
          ? "bg-zinc-950 border-zinc-800 text-white" 
          : "bg-slate-50 border-gray-200 text-gray-800"
      }`}>
        
        {/* 1. LEFT SIDEBAR (Segmented Toolbar & Tab Content) */}
        <div className={`w-full lg:w-[360px] border-r flex flex-col shrink-0 h-[500px] lg:h-full ${
          highContrastMode
            ? "bg-zinc-900 border-zinc-800 text-white"
            : "bg-white border-gray-200 text-gray-800"
        }`}>
          {/* Segmented Control Pill Header */}
          <div className={`px-4 py-3 border-b ${
            highContrastMode ? "border-zinc-800 bg-zinc-950" : "border-gray-150 bg-gray-50/50"
          }`}>
            <div className={`flex p-1 rounded-xl space-x-1 ${
              highContrastMode ? "bg-zinc-850" : "bg-gray-100"
            }`}>
              <button
                type="button"
                onClick={() => setActiveControlTab("media")}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-bold rounded-lg transition ${
                  activeControlTab === "media"
                    ? (highContrastMode ? "bg-zinc-700 text-white shadow-sm" : "bg-white text-purple-700 shadow-sm")
                    : (highContrastMode ? "text-zinc-400 hover:text-zinc-200" : "text-gray-500 hover:text-gray-800")
                }`}
              >
                <span>📁</span>
                <span>Media & Templates</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveControlTab("text")}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-bold rounded-lg transition ${
                  activeControlTab === "text"
                    ? (highContrastMode ? "bg-zinc-700 text-white shadow-sm" : "bg-white text-purple-700 shadow-sm")
                    : (highContrastMode ? "text-zinc-400 hover:text-zinc-200" : "text-gray-500 hover:text-gray-800")
                }`}
              >
                <span>✍️</span>
                <span>Text</span>
              </button>
            </div>
          </div>

          {/* Active Tab Panel Content */}
          <div className="flex-grow p-5 overflow-y-auto space-y-6">
            {/* MEDIA CONTROLS */}
            {activeControlTab === "media" && (
              <div className="space-y-6">

                {/* Library templates matching the active format */}
                {(() => {
                  const DEFAULT_IMAGE_TEMPLATES = [
                    { id: "preset-sanders", title: "Bernie Asking", media_url: "https://api.memegen.link/images/sanders.png", format: "image" },
                    { id: "preset-smart", title: "Smart Logic", media_url: "https://api.memegen.link/images/smart.png", format: "image" },
                    { id: "preset-success", title: "Success Kid", media_url: "https://api.memegen.link/images/success.png", format: "image" },
                    { id: "preset-gru", title: "Gru's 4-Panel Plan", media_url: "https://api.memegen.link/images/gru.png", format: "image" }
                  ];

                  const dbFormatTemplates = availableTemplates.filter(temp => {
                    if (activeTab === "image") return !temp.format || temp.format === "image";
                    return temp.format === activeTab;
                  });

                  // Merge with default image presets if on active image tab
                  const templatesToDisplay = [
                    ...dbFormatTemplates,
                    ...(activeTab === "image" ? DEFAULT_IMAGE_TEMPLATES : [])
                  ];

                  // Sort so featured templates come first
                  templatesToDisplay.sort((a, b) => {
                    const aFeat = !!a.is_featured;
                    const bFeat = !!b.is_featured;
                    if (aFeat && !bFeat) return -1;
                    if (!aFeat && bFeat) return 1;
                    return 0;
                  });

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-1.5 border-gray-150 dark:border-zinc-800">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Library Templates ({activeTab})</span>
                      </div>
                      {templatesToDisplay.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2.5 max-h-[160px] overflow-y-auto pr-1">
                          {templatesToDisplay.map((temp) => (
                            <button
                              type="button"
                              key={temp.id}
                              onClick={() => handleSelectTemplate(temp)}
                              className="flex flex-col items-center p-1.5 border border-gray-200 dark:border-zinc-850 rounded-xl hover:border-purple-500 hover:bg-purple-50/10 transition text-left w-full active:scale-95 bg-white dark:bg-zinc-900 shadow-sm"
                            >
                              <div className="w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center mb-1 relative">
                                {temp.is_featured && (
                                  <div className="absolute top-1 left-1 bg-yellow-400 text-black text-[8px] font-extrabold px-1 rounded shadow z-10">
                                    ⭐ FEATURED
                                  </div>
                                )}
                                {temp.format === "video" ? (
                                  <div className="text-white text-[9px] font-bold">🎥 Video Template</div>
                                ) : temp.format === "audio" ? (
                                  <div className="text-white text-[9px] font-bold">🎵 Audio Template</div>
                                ) : (
                                  <img src={temp.media_url} alt={temp.title} className="w-full h-full object-cover" />
                                )}
                              </div>
                              <span className="text-[9px] font-bold truncate w-full text-center text-gray-700 dark:text-gray-300">{temp.title}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-405 text-[10px] italic">No approved templates available yet. Click Contribute below to submit one!</p>
                      )}
                    </div>
                  );
                })()}
                
                {activeTab === "image" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-zinc-800">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400">Collage Media Assets</h3>
                      <span className="text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full">
                        {images.length}/4 Images
                      </span>
                    </div>

                    {/* Premium Dashed-Border Upload Dropzone */}
                    <div 
                      onDragOver={(e) => { e.preventDefault(); setIsDragOverDropzone(true); }}
                      onDragLeave={() => setIsDragOverDropzone(false)}
                      onDrop={handleDropzoneDrop}
                      className={`border-2 border-dashed rounded-xl p-5 text-center transition cursor-pointer relative flex flex-col items-center justify-center min-h-[140px] ${
                        isDragOverDropzone
                          ? "border-purple-600 bg-purple-50/50 dark:bg-purple-955/20"
                          : (highContrastMode 
                              ? "border-zinc-700 bg-zinc-900/50 hover:border-zinc-500" 
                              : "border-gray-300 bg-slate-50/50 hover:border-purple-450 hover:bg-slate-50")
                      }`}
                    >
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <svg className="w-8 h-8 text-purple-500 mb-2.5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                        Drag & drop images here
                      </span>
                      <span className="text-[10px] text-gray-500 block">
                        or click to browse your files
                      </span>
                    </div>

                    {/* Remix from Library Button */}
                    <button
                      type="button"
                      onClick={() => setShowLibraryPickerModal(true)}
                      className="w-full border-2 border-purple-500 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-955/20 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                    >
                      <span>📖</span>
                      <span>Remix from Library</span>
                    </button>

                    {/* Per-image thumbnail strip with individual ✕ removal */}
                    {images.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {images.map((src, idx) => (
                            <div key={idx} className="relative group w-14 h-14 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-zinc-700 hover:border-purple-500 transition flex-shrink-0">
                              <img src={src} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removeImage(idx)}
                                className="absolute top-0 right-0 w-4 h-4 bg-red-600 text-white text-[9px] font-black rounded-bl-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition leading-none"
                                title={`Remove image ${idx + 1}`}
                              >
                                ✕
                              </button>
                              <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center py-0.5 font-semibold">{idx + 1}</span>
                            </div>
                          ))}
                          {images.length < 4 && (
                            <label className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 dark:border-zinc-700 flex items-center justify-center cursor-pointer hover:border-purple-400 transition flex-shrink-0 relative">
                              <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                              <span className="text-xl text-gray-400 leading-none">+</span>
                            </label>
                          )}
                        </div>

                        {/* Layout Organization controls (only shown when ≥2 images) */}
                        {images.length >= 2 && (
                          <div className="space-y-2">
                            <div>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Organize Layout</span>
                              <div className="flex gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCollageLayout("columns");
                                    setPanelSizes([1, 1, 1, 1]);
                                  }}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition border flex items-center gap-1 ${
                                    collageLayout === "columns"
                                      ? "bg-purple-600 text-white border-purple-600"
                                      : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:border-purple-400"
                                  }`}
                                  title="Arrange in vertical columns"
                                >
                                  <span>║</span>
                                  <span>Columns</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCollageLayout("rows");
                                    setPanelSizes([1, 1, 1, 1]);
                                  }}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition border flex items-center gap-1 ${
                                    collageLayout === "rows"
                                      ? "bg-purple-600 text-white border-purple-600"
                                      : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:border-purple-400"
                                  }`}
                                  title="Arrange in horizontal rows"
                                >
                                  <span>═</span>
                                  <span>Rows</span>
                                </button>
                                {images.length === 4 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCollageLayout("grid");
                                      setGridSplit({ x: 0.5, y: 0.5, topX: 0.5, bottomX: 0.5 });
                                    }}
                                    className={`text-[10px] font-bold px-2 py-1 rounded-lg transition border flex items-center gap-1 ${
                                      collageLayout === "grid"
                                        ? "bg-purple-600 text-white border-purple-600"
                                        : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:border-purple-400"
                                    }`}
                                    title="Arrange in a 2x2 grid"
                                  >
                                    <span>田</span>
                                    <span>Grid</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setPanelSizes([1, 1, 1, 1]);
                                setGridSplit({ y: 0.5, topX: 0.5, bottomX: 0.5 });
                              }}
                              className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                            >
                              ↺ Reset Split Proportions
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => { setImages([]); setImageFiles([]); }}
                          className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center space-x-1 transition"
                        >
                          <span>🗑️</span>
                          <span>Clear All Images</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "video" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-zinc-800">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400">Video Media Assets</h3>
                      {videoUrl && (
                        <span className="text-[10px] bg-green-100 dark:bg-green-955/40 text-green-700 dark:text-green-300 font-bold px-2 py-0.5 rounded-full">
                          Loaded
                        </span>
                      )}
                    </div>

                    {/* Week 6: Browser compatibility warning for ffmpeg.wasm */}
                    {!window.crossOriginIsolated && (
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                        <span className="text-sm shrink-0">⚠️</span>
                        <p className="text-[10px] leading-relaxed">
                          <strong>Real video trimming unavailable.</strong> Your browser or server lacks Cross-Origin Isolation.
                          Trimming works best on Chrome/Edge. The video will upload without applying the trim.
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {/* Premium Dashed-Border Upload Dropzone */}
                      <div 
                        onDragOver={(e) => { e.preventDefault(); setIsDragOverDropzone(true); }}
                        onDragLeave={() => setIsDragOverDropzone(false)}
                        onDrop={handleDropzoneDrop}
                        className={`border-2 border-dashed rounded-xl p-5 text-center transition cursor-pointer relative flex flex-col items-center justify-center min-h-[140px] ${
                          isDragOverDropzone
                            ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/20"
                            : (highContrastMode 
                                ? "border-zinc-700 bg-zinc-900/50 hover:border-zinc-500" 
                                : "border-gray-300 bg-slate-50/50 hover:border-purple-450 hover:bg-slate-50")
                        }`}
                      >
                        <input 
                          type="file" 
                          accept="video/*" 
                          onChange={handleVideoUpload} 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <svg className="w-8 h-8 text-purple-500 mb-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                          Drag & drop video here
                        </span>
                        <span className="text-[10px] text-gray-500 block">
                          or click to browse (&lt; 15s limit)
                        </span>
                      </div>

                      <div>
                        <span className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-gray-500">Or Load Mock Sample</span>
                        <div className="flex flex-wrap gap-2">
                          {MEDIA_SAMPLES.video.map((sample, idx) => (
                            <button
                              key={sample.id}
                              type="button"
                              onClick={() => selectMediaPreset(sample.url, "video", 15)}
                              className="text-[11px] bg-purple-50 dark:bg-purple-955/20 text-purple-755 dark:text-purple-300 font-bold px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100 transition active:scale-95"
                            >
                              Sample {idx + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {videoUrl && (
                      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                        <span className="block text-[11px] font-semibold uppercase tracking-wider mb-3 text-gray-550">Crop / Trim Playback Window</span>
                        <div className="space-y-3 text-xs font-semibold">
                          <div>
                            <label className="flex justify-between">
                              <span>Start Timestamp</span>
                              <span className="text-purple-600">{videoTrimStart.toFixed(1)}s</span>
                            </label>
                            <input 
                              type="range" 
                              min="0" 
                              max={videoTrimEnd} 
                              step="0.1"
                              value={videoTrimStart}
                              onChange={(e) => setVideoTrimStart(parseFloat(e.target.value))}
                              className="w-full accent-purple-650 h-1 bg-gray-250 rounded-lg cursor-pointer mt-1"
                            />
                          </div>
                          <div>
                            <label className="flex justify-between">
                              <span>End Timestamp</span>
                              <span className="text-purple-600">{videoTrimEnd.toFixed(1)}s</span>
                            </label>
                            <input 
                              type="range" 
                              min={videoTrimStart} 
                              max={videoDuration} 
                              step="0.1"
                              value={videoTrimEnd}
                              onChange={(e) => setVideoTrimEnd(parseFloat(e.target.value))}
                              className="w-full accent-purple-650 h-1 bg-gray-250 rounded-lg cursor-pointer mt-1"
                            />
                          </div>
                        </div>

                        {/* Phase 2E: Video Captions textarea */}
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-gray-550">
                            Timed Captions
                          </label>
                          <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
                            One caption per line. Format: <code className="bg-gray-100 dark:bg-zinc-800 px-1 rounded">0:02 – Caption text</code>
                          </p>
                          <textarea
                            value={videoCaptions}
                            onChange={(e) => setVideoCaptions(e.target.value)}
                            placeholder={`0:01 – Title of this video\n0:05 – Key concept here\n0:10 – Summary or punchline`}
                            rows={5}
                            className={`w-full text-xs rounded-lg border px-3 py-2 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                              highContrastMode
                                ? "bg-zinc-900 border-zinc-700 text-white placeholder-zinc-600"
                                : "bg-white border-gray-200 text-gray-800 placeholder-gray-400"
                            }`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "gif" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-zinc-800">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400">GIF Media Assets</h3>
                      {gifUrl && (
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full">
                          Loaded
                        </span>
                      )}
                    </div>
                    <div className="space-y-4">
                      {/* Premium Dashed-Border Upload Dropzone */}
                      <div 
                        onDragOver={(e) => { e.preventDefault(); setIsDragOverDropzone(true); }}
                        onDragLeave={() => setIsDragOverDropzone(false)}
                        onDrop={handleDropzoneDrop}
                        className={`border-2 border-dashed rounded-xl p-5 text-center transition cursor-pointer relative flex flex-col items-center justify-center min-h-[140px] ${
                          isDragOverDropzone
                            ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/20"
                            : (highContrastMode 
                                ? "border-zinc-700 bg-zinc-900/50 hover:border-zinc-500" 
                                : "border-gray-300 bg-slate-50/50 hover:border-purple-450 hover:bg-slate-50")
                        }`}
                      >
                        <input 
                          type="file" 
                          accept="image/gif" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setGifUrl(createObjectURLSafe(file));
                              setGifFile(file);
                            }
                          }} 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <svg className="w-8 h-8 text-purple-500 mb-2.5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                          Drag & drop GIF here
                        </span>
                        <span className="text-[10px] text-gray-500 block">
                          or click to browse your files
                        </span>
                      </div>

                      {/* Giphy Search Engine */}
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2 text-gray-500">Search Giphy Library</label>
                        <GiphySearch onSelect={(url) => {
                          setGifUrl(url);
                          setGifFile(null);
                        }} />
                      </div>

                      {/* Paste URL Collapsible/Advanced details option */}
                      <details className="text-[10px] font-semibold text-gray-500">
                        <summary className="cursor-pointer hover:text-purple-600 transition select-none">Advanced: Paste direct GIF URL</summary>
                        <div className="pt-2">
                          <input 
                            type="text" 
                            value={gifUrl.startsWith("blob:") ? "" : gifUrl} 
                            onChange={(e) => {
                              setGifUrl(e.target.value);
                              setGifFile(null);
                            }} 
                            placeholder="Paste Giphy URL or external link..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                        </div>
                      </details>

                      <div>
                        <span className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-gray-550">Or Load Mock Sample</span>
                        <div className="flex flex-wrap gap-2">
                          {MEDIA_SAMPLES.gif.map((sample, idx) => (
                            <button
                              key={sample.id}
                              type="button"
                              onClick={() => {
                                selectMediaPreset(sample.url, "gif");
                                setGifFile(null);
                              }}
                              className="text-[11px] bg-purple-50 dark:bg-purple-955/20 text-purple-755 dark:text-purple-300 font-bold px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100 transition active:scale-95"
                            >
                              Sample {idx + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "audio" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-zinc-800">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400">Audio Media Assets</h3>
                      {audioUrl && (
                        <span className="text-[10px] bg-green-100 dark:bg-green-955/40 text-green-700 dark:text-green-300 font-bold px-2 py-0.5 rounded-full">
                          Loaded
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      {/* Premium Dashed-Border Upload Dropzone */}
                      <div 
                        onDragOver={(e) => { e.preventDefault(); setIsDragOverDropzone(true); }}
                        onDragLeave={() => setIsDragOverDropzone(false)}
                        onDrop={handleDropzoneDrop}
                        className={`border-2 border-dashed rounded-xl p-5 text-center transition cursor-pointer relative flex flex-col items-center justify-center min-h-[140px] ${
                          isDragOverDropzone
                            ? "border-purple-600 bg-purple-50/50 dark:bg-purple-955/20"
                            : (highContrastMode 
                                ? "border-zinc-700 bg-zinc-900/50 hover:border-zinc-500" 
                                : "border-gray-300 bg-slate-50/50 hover:border-purple-450 hover:bg-slate-50")
                        }`}
                      >
                        <input 
                          type="file" 
                          accept="audio/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setAudioUrl(createObjectURLSafe(file));
                              setAudioFile(file);
                            }
                          }} 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <svg className="w-8 h-8 text-purple-500 mb-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                          Drag & drop audio here
                        </span>
                        <span className="text-[10px] text-gray-500 block">
                          or click to browse (&lt; 20 MB limit)
                        </span>
                      </div>

                      <div>
                        <span className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-gray-500">Or Load Mock Sample</span>
                        <div className="flex flex-wrap gap-2">
                          {MEDIA_SAMPLES.audio.map((sample, idx) => (
                            <button
                              key={sample.id}
                              type="button"
                              onClick={() => selectMediaPreset(sample.url, "audio", 45)}
                              className="text-[11px] bg-purple-50 dark:bg-purple-955/20 text-purple-755 dark:text-purple-300 font-bold px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100 transition active:scale-95"
                            >
                              Sample {idx + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {audioUrl && (
                      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                        <span className="block text-[11px] font-semibold uppercase tracking-wider mb-3 text-gray-550">Crop / Trim Playback Window</span>
                        <div className="space-y-3 text-xs font-semibold">
                          <div>
                            <label className="flex justify-between">
                              <span>Start Timestamp</span>
                              <span className="text-purple-600">{audioTrimStart.toFixed(1)}s</span>
                            </label>
                            <input 
                              type="range" 
                              min="0" 
                              max={audioTrimEnd} 
                              step="0.1"
                              value={audioTrimStart}
                              onChange={(e) => setAudioTrimStart(parseFloat(e.target.value))}
                              className="w-full accent-purple-650 h-1 bg-gray-250 rounded-lg cursor-pointer mt-1"
                            />
                          </div>
                          <div>
                            <label className="flex justify-between">
                              <span>End Timestamp</span>
                              <span className="text-purple-600">{audioTrimEnd.toFixed(1)}s</span>
                            </label>
                            <input 
                              type="range" 
                              min={audioTrimStart} 
                              max="45" 
                              step="0.1"
                              value={audioTrimEnd}
                              onChange={(e) => setAudioTrimEnd(parseFloat(e.target.value))}
                              className="w-full accent-purple-650 h-1 bg-gray-250 rounded-lg cursor-pointer mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* TEXT LAYER CONTROLS */}
            {activeControlTab === "text" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-zinc-800">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400">Overlay Text Engine</h3>
                  {/* Undo / Redo */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={undoTextLayers}
                      disabled={!canUndo}
                      title="Undo (Ctrl+Z)"
                      className="w-6 h-6 flex items-center justify-center rounded text-[11px] font-bold disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                    >↩</button>
                    <button
                      type="button"
                      onClick={redoTextLayers}
                      disabled={!canRedo}
                      title="Redo (Ctrl+Y)"
                      className="w-6 h-6 flex items-center justify-center rounded text-[11px] font-bold disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                    >↪</button>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={addTextLayer}
                  className="w-full bg-purple-50 text-purple-700 dark:bg-purple-955/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 font-bold py-2.5 px-4 rounded-xl shadow-sm text-xs transition duration-200 mb-4 active:scale-95"
                >
                  ➕ Add New Text Layer
                </button>

                {/* Layer list */}
                {textLayers.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {textLayers.map((layer, idx) => (
                      <button
                        key={layer.id}
                        type="button"
                        onClick={() => setSelectedTextId(layer.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between gap-1 transition ${
                          selectedTextId === layer.id
                            ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700"
                            : "bg-gray-50 dark:bg-zinc-800/60 hover:bg-gray-100 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                        }`}
                      >
                        <span className="truncate max-w-[140px]">{layer.text || `Layer ${idx + 1}`}</span>
                        <span className="text-[9px] text-gray-400 font-normal shrink-0">{layer.fontFamily}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeTextLayer ? (
                  <div className="space-y-4 text-xs font-semibold bg-gray-55 dark:bg-zinc-900/60 p-4 rounded-xl border border-gray-150 dark:border-zinc-800">
                    <div>
                      <label className="block text-gray-550 uppercase mb-1.5">Text String</label>
                      <textarea
                        value={activeTextLayer.text}
                        onChange={(e) => updateTextLayer("text", e.target.value)}
                        rows="2"
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>

                    {/* Alignment */}
                    <div>
                      <label className="block text-gray-550 uppercase mb-1.5">Alignment</label>
                      <div className="flex gap-1">
                        {[("left"), ("center"), ("right")].map(align => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => updateTextLayer("textAlign", align)}
                            className={`flex-1 py-1 rounded text-xs font-bold capitalize transition border ${
                              (activeTextLayer.textAlign || "left") === align
                                ? "bg-purple-600 text-white border-purple-600"
                                : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:border-purple-400"
                            }`}
                          >
                            {align === "left" ? "⮤" : align === "center" ? "⭎" : "⮥"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-555 uppercase mb-1.5">Font Family</label>
                        <select
                          value={activeTextLayer.fontFamily}
                          onChange={(e) => updateTextLayer("fontFamily", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded"
                          style={{ fontFamily: activeTextLayer.fontFamily }}
                        >
                          <optgroup label="Meme Classics">
                            <option value="Impact" style={{ fontFamily: "Impact" }}>Impact</option>
                            <option value="Bangers" style={{ fontFamily: "Bangers" }}>Bangers</option>
                            <option value="Comic Sans MS" style={{ fontFamily: "Comic Sans MS" }}>Comic Sans</option>
                          </optgroup>
                          <optgroup label="Modern">
                            <option value="Poppins" style={{ fontFamily: "Poppins" }}>Poppins Bold</option>
                            <option value="Oswald" style={{ fontFamily: "Oswald" }}>Oswald Bold</option>
                            <option value="Pacifico" style={{ fontFamily: "Pacifico" }}>Pacifico</option>
                          </optgroup>
                          <optgroup label="Educational">
                            <option value="Roboto Slab" style={{ fontFamily: "Roboto Slab" }}>Roboto Slab</option>
                            <option value="Georgia" style={{ fontFamily: "Georgia" }}>Georgia</option>
                          </optgroup>
                          <optgroup label="System">
                            <option value="Arial" style={{ fontFamily: "Arial" }}>Arial</option>
                            <option value="Courier New" style={{ fontFamily: "Courier New" }}>Courier</option>
                            <option value="Times New Roman" style={{ fontFamily: "Times New Roman" }}>Times</option>
                          </optgroup>
                        </select>
                      </div>

                      <div>
                        <label className="block text-gray-555 uppercase mb-1.5">Text Color</label>
                        <input
                          type="color"
                          value={activeTextLayer.color}
                          onChange={(e) => updateTextLayer("color", e.target.value)}
                          className="w-full h-8 border cursor-pointer rounded p-0 bg-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-555 uppercase mb-1.5">Font Size ({activeTextLayer.fontSize}px)</label>
                      <input
                        type="range"
                        min="10"
                        max="80"
                        value={activeTextLayer.fontSize}
                        onChange={(e) => updateTextLayer("fontSize", parseInt(e.target.value))}
                        className="w-full accent-purple-650 h-1 bg-gray-200 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Opacity */}
                    <div>
                      <label className="block text-gray-555 uppercase mb-1.5">Opacity ({Math.round((activeTextLayer.opacity ?? 1) * 100)}%)</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={activeTextLayer.opacity ?? 1}
                        onChange={(e) => updateTextLayer("opacity", parseFloat(e.target.value))}
                        className="w-full accent-purple-650 h-1 bg-gray-200 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Rotation */}
                    <div>
                      <label className="block text-gray-555 uppercase mb-1.5">Rotation ({activeTextLayer.rotation || 0}°)</label>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={activeTextLayer.rotation || 0}
                        onChange={(e) => updateTextLayer("rotation", parseInt(e.target.value))}
                        className="w-full accent-purple-650 h-1 bg-gray-200 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-555 uppercase mb-1.5">Stroke Shadow</label>
                        <input
                          type="color"
                          value={activeTextLayer.strokeColor}
                          onChange={(e) => updateTextLayer("strokeColor", e.target.value)}
                          className="w-full h-8 border cursor-pointer rounded p-0 bg-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-555 uppercase mb-1.5">Stroke Width ({activeTextLayer.strokeWidth}px)</label>
                        <input
                          type="range"
                          min="0"
                          max="6"
                          value={activeTextLayer.strokeWidth}
                          onChange={(e) => updateTextLayer("strokeWidth", parseInt(e.target.value))}
                          className="w-full accent-purple-650 h-1 bg-gray-200 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Text Wrap */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!activeTextLayer.maxWidth}
                          onChange={(e) => updateTextLayer("maxWidth", e.target.checked ? 200 : null)}
                          className="rounded accent-purple-600"
                        />
                        <span className="uppercase text-gray-555">Wrap Text</span>
                      </label>
                      {activeTextLayer.maxWidth && (
                        <div className="mt-2">
                          <label className="block text-gray-555 uppercase mb-1">Max Width ({activeTextLayer.maxWidth}px)</label>
                          <input
                            type="range"
                            min="60"
                            max="440"
                            step="10"
                            value={activeTextLayer.maxWidth}
                            onChange={(e) => updateTextLayer("maxWidth", parseInt(e.target.value))}
                            className="w-full accent-purple-650 h-1 bg-gray-200 rounded-lg cursor-pointer"
                          />
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-zinc-800 flex justify-between">
                      <button
                        type="button"
                        onClick={deleteSelectedText}
                        className="text-red-600 hover:text-red-700 font-bold"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={duplicateSelectedText}
                        className="text-purple-600 hover:text-purple-700 dark:text-purple-400 font-bold"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTextId(null)}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Deselect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 px-4 text-gray-400 text-xs border border-dashed border-gray-300 dark:border-zinc-700 rounded-xl bg-slate-50/50 dark:bg-zinc-900/50">
                    💡 Click a text layer above to edit, or add a new one.
                  </div>
                )}
              </div>
            )}



          </div>
        </div>

        {/* 2. RIGHT VIEWPORT WORKSPACE */}
        <div className="flex-grow flex flex-col h-full min-w-0 bg-slate-100 dark:bg-zinc-950 overflow-hidden relative">
          
          {/* Top workspace bar: Format Switcher + Canvas Controls */}
          <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b shrink-0 ${
            highContrastMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200"
          }`}>
            {/* Format Switcher */}
            <div className={`flex p-1 rounded-xl space-x-1 ${
              highContrastMode ? "bg-zinc-850" : "bg-gray-150"
            }`}>
              {["image", "video", "gif", "audio"].map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => { setActiveTab(tab); setAlertMessage(""); }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold capitalize rounded-lg transition ${
                    activeTab === tab 
                      ? (highContrastMode ? "bg-zinc-700 text-white shadow-sm" : "bg-white text-purple-700 shadow-sm") 
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  }`}
                >
                  {TAB_ICONS[tab]}
                  <span className="hidden sm:inline">{tab}</span>
                </button>
              ))}
            </div>

            {/* Canvas Controls — aspect ratio, background (image tab only) */}
            {activeTab === "image" && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Aspect Ratio */}
                <div className={`flex p-0.5 rounded-lg space-x-0.5 ${
                  highContrastMode ? "bg-zinc-800" : "bg-gray-100"
                }`}>
                  {Object.keys(ASPECT_RATIOS).map(ratio => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setCanvasAspect(ratio)}
                      title={`Canvas aspect ratio ${ratio}`}
                      className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${
                        canvasAspect === ratio
                          ? "bg-purple-600 text-white"
                          : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>

                {/* Background Color */}
                <label className="flex items-center gap-1.5 cursor-pointer" title="Canvas background color">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">BG</span>
                  <input
                    type="color"
                    value={canvasBg}
                    onChange={(e) => setCanvasBg(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border border-gray-300 dark:border-zinc-700 p-0"
                  />
                </label>
              </div>
            )}

            {/* Mobile Export button */}
            <button
              type="button"
              onClick={() => setShowSaveModal(true)}
              className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-1.5 px-4 rounded-lg shadow-sm transition text-xs flex items-center space-x-1.5 lg:hidden"
            >
              <span>💾 Export</span>
            </button>
          </div>

          {/* Drawing Workspace Canvas Container */}
          <div className="flex-grow overflow-y-auto flex flex-col items-center justify-center p-6 relative">
            {/* Soft Checkerboard Background Pattern */}
            <div 
              className="absolute inset-0 opacity-[0.25] pointer-events-none"
              style={{
                backgroundImage: highContrastMode 
                  ? "radial-gradient(circle, #717172 1.2px, transparent 1.2px)" 
                  : "radial-gradient(circle, #94a3b8 1.2px, transparent 1.2px)",
                backgroundSize: "24px 24px"
              }}
            />

            {/* Canvas Preview Area */}
            <div className="relative z-10 w-full flex flex-col items-center">
              <div 
                ref={canvasContainerRef}
                className={`relative w-full max-w-[480px] ${ASPECT_RATIOS[canvasAspect]?.css || "aspect-square"} flex items-center justify-center select-none shadow-xl border ${
                  highContrastMode 
                    ? "bg-zinc-900 border-zinc-800" 
                    : "border-slate-955"
                } rounded-2xl overflow-hidden`}
                style={{ backgroundColor: canvasBg }}
              >
                {/* Draggable Text Overlays Layer wrapper */}
                <div className="absolute inset-0 z-20 pointer-events-none">
                  {textLayers.map((layer) => (
                    <div
                      key={layer.id}
                      onPointerDown={(e) => handleTextPointerDown(e, layer.id)}
                      onDoubleClick={() => setEditingTextId(layer.id)}
                    style={{
                        position: "absolute",
                        left: `${layer.x}px`,
                        top: `${layer.y}px`,
                        fontFamily: layer.fontFamily,
                        fontSize: `${layer.fontSize}px`,
                        color: layer.color,
                        WebkitTextStroke: `${layer.strokeWidth}px ${layer.strokeColor}`,
                        cursor: "move",
                        whiteSpace: layer.maxWidth ? "normal" : "nowrap",
                        maxWidth: layer.maxWidth ? `${layer.maxWidth}px` : undefined,
                        opacity: layer.opacity ?? 1,
                        transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                        textAlign: layer.textAlign || "left",
                        transformOrigin: "top left",
                      }}
                      className={`pointer-events-auto px-2 py-1 rounded transition select-none ${
                        selectedTextId === layer.id 
                          ? "border-2 border-dashed border-purple-500 ring-2 ring-purple-350 bg-purple-500/10" 
                          : ""
                      }`}
                    >
                      {editingTextId === layer.id ? (
                        <input
                          type="text"
                          value={layer.text}
                          onChange={(e) => updateTextLayer("text", e.target.value)}
                          onBlur={() => setEditingTextId(null)}
                          onKeyDown={(e) => { if (e.key === "Enter") setEditingTextId(null); }}
                          className="bg-black text-white px-1 text-base rounded border border-purple-400 focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        layer.text
                      )}
                    </div>
                  ))}
                </div>

                {/* Content rendering based on Active Tab */}
                {activeTab === "image" && (
                  <div className="w-full h-full flex flex-col">
                    {images.length > 0 ? (
                      images.length === 1 ? (
                        <div className="w-full h-full" style={{ userSelect: "none" }}>
                          <img
                            src={images[0]}
                            alt="Meme visual component"
                            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                          />
                        </div>
                      ) : collageLayout === "columns" ? (
                        <div className="w-full h-full flex" style={{ userSelect: "none" }}>
                          {images.map((src, idx) => {
                            const numImages = images.length;
                            const activeSizes = panelSizes.slice(0, numImages);
                            const totalWeight = activeSizes.reduce((a, b) => a + b, 0);
                            const flexVal = activeSizes[idx] / totalWeight;
                            const isLast = idx === numImages - 1;
                            return (
                              <React.Fragment key={idx}>
                                <div
                                  style={{ flexGrow: flexVal, flexShrink: 0, flexBasis: 0, minWidth: 0, position: "relative", overflow: "hidden" }}
                                >
                                  <img
                                    src={src}
                                    alt={`Collage panel ${idx + 1}`}
                                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                                  />
                                </div>
                                {!isLast && (
                                  <div
                                    style={{
                                      width: "6px",
                                      flexShrink: 0,
                                      cursor: "col-resize",
                                      background: "rgba(139,92,246,0.4)",
                                      zIndex: 25,
                                      position: "relative"
                                    }}
                                    onPointerDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const activeSizesNow = panelSizes.slice(0, images.length);
                                      collageDragRef.current = {
                                        active: true,
                                        type: "columns",
                                        dividerIdx: idx,
                                        startX: e.clientX,
                                        startSizes: [...activeSizesNow]
                                      };
                                      const containerW = canvasContainerRef.current?.offsetWidth || 480;
                                      const onMove = (me) => {
                                        if (!collageDragRef.current.active) return;
                                        const dx = me.clientX - collageDragRef.current.startX;
                                        const pxPerUnit = containerW / collageDragRef.current.startSizes.reduce((a, b) => a + b, 0);
                                        const delta = dx / pxPerUnit;
                                        const newSizes = [...collageDragRef.current.startSizes];
                                        const minSize = 0.1;
                                        newSizes[idx] = Math.max(minSize, newSizes[idx] + delta);
                                        newSizes[idx + 1] = Math.max(minSize, newSizes[idx + 1] - delta);
                                        setPanelSizes(prev => {
                                          const updated = [...prev];
                                          updated[idx] = newSizes[idx];
                                          updated[idx + 1] = newSizes[idx + 1];
                                          return updated;
                                        });
                                      };
                                      const onUp = () => {
                                        collageDragRef.current.active = false;
                                        window.removeEventListener("pointermove", onMove);
                                        window.removeEventListener("pointerup", onUp);
                                      };
                                      window.addEventListener("pointermove", onMove);
                                      window.addEventListener("pointerup", onUp);
                                    }}
                                    title="Drag to resize columns"
                                  >
                                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 2, height: 24, background: "rgba(255,255,255,0.7)", borderRadius: 2 }} />
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      ) : collageLayout === "rows" ? (
                        <div className="w-full h-full flex flex-col" style={{ userSelect: "none" }}>
                          {images.map((src, idx) => {
                            const numImages = images.length;
                            const activeSizes = panelSizes.slice(0, numImages);
                            const totalWeight = activeSizes.reduce((a, b) => a + b, 0);
                            const flexVal = activeSizes[idx] / totalWeight;
                            const isLast = idx === numImages - 1;
                            return (
                              <React.Fragment key={idx}>
                                <div
                                  style={{ flexGrow: flexVal, flexShrink: 0, flexBasis: 0, minHeight: 0, position: "relative", overflow: "hidden" }}
                                >
                                  <img
                                    src={src}
                                    alt={`Collage panel ${idx + 1}`}
                                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                                  />
                                </div>
                                {!isLast && (
                                  <div
                                    style={{
                                      height: "6px",
                                      flexShrink: 0,
                                      cursor: "row-resize",
                                      background: "rgba(139,92,246,0.4)",
                                      zIndex: 25,
                                      position: "relative"
                                    }}
                                    onPointerDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const activeSizesNow = panelSizes.slice(0, images.length);
                                      collageDragRef.current = {
                                        active: true,
                                        type: "rows",
                                        dividerIdx: idx,
                                        startY: e.clientY,
                                        startSizes: [...activeSizesNow]
                                      };
                                      const containerH = canvasContainerRef.current?.offsetHeight || 480;
                                      const onMove = (me) => {
                                        if (!collageDragRef.current.active) return;
                                        const dy = me.clientY - collageDragRef.current.startY;
                                        const pxPerUnit = containerH / collageDragRef.current.startSizes.reduce((a, b) => a + b, 0);
                                        const delta = dy / pxPerUnit;
                                        const newSizes = [...collageDragRef.current.startSizes];
                                        const minSize = 0.1;
                                        newSizes[idx] = Math.max(minSize, newSizes[idx] + delta);
                                        newSizes[idx + 1] = Math.max(minSize, newSizes[idx + 1] - delta);
                                        setPanelSizes(prev => {
                                          const updated = [...prev];
                                          updated[idx] = newSizes[idx];
                                          updated[idx + 1] = newSizes[idx + 1];
                                          return updated;
                                        });
                                      };
                                      const onUp = () => {
                                        collageDragRef.current.active = false;
                                        window.removeEventListener("pointermove", onMove);
                                        window.removeEventListener("pointerup", onUp);
                                      };
                                      window.addEventListener("pointermove", onMove);
                                      window.addEventListener("pointerup", onUp);
                                    }}
                                    title="Drag to resize rows"
                                  >
                                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 24, height: 2, background: "rgba(255,255,255,0.7)", borderRadius: 2 }} />
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      ) : collageLayout === "grid" && images.length === 4 ? (
                        <div className="w-full h-full flex flex-col" style={{ userSelect: "none" }}>
                          {/* Top Row */}
                          <div style={{ height: `${gridSplit.y * 100}%`, flexShrink: 0, display: "flex", position: "relative", minHeight: 0 }}>
                            <div style={{ width: `${gridSplit.topX * 100}%`, flexShrink: 0, position: "relative", height: "100%", overflow: "hidden" }}>
                              <img src={images[0]} alt="Grid 1" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            </div>
                            
                            {/* Vertical divider top */}
                            <div
                              style={{ width: "6px", cursor: "col-resize", background: "rgba(139,92,246,0.4)", zIndex: 25, position: "relative", flexShrink: 0 }}
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                collageDragRef.current = { active: true, type: "grid-v-top", startX: e.clientX, startSplit: { ...gridSplit } };
                                const containerW = canvasContainerRef.current?.offsetWidth || 480;
                                const onMove = (me) => {
                                  if (!collageDragRef.current.active) return;
                                  const dx = me.clientX - collageDragRef.current.startX;
                                  const deltaRatio = dx / containerW;
                                  setGridSplit(prev => ({ ...prev, topX: Math.max(0.1, Math.min(0.9, collageDragRef.current.startSplit.topX + deltaRatio)) }));
                                };
                                const onUp = () => {
                                  collageDragRef.current.active = false;
                                  window.removeEventListener("pointermove", onMove);
                                  window.removeEventListener("pointerup", onUp);
                                };
                                window.addEventListener("pointermove", onMove);
                                window.addEventListener("pointerup", onUp);
                              }}
                            />
                            
                            <div style={{ flexGrow: 1, position: "relative", height: "100%", overflow: "hidden" }}>
                              <img src={images[1]} alt="Grid 2" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            </div>
                          </div>

                          {/* Horizontal divider */}
                          <div
                            style={{ height: "6px", cursor: "row-resize", background: "rgba(139,92,246,0.4)", zIndex: 25, position: "relative", flexShrink: 0 }}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              collageDragRef.current = { active: true, type: "grid-h", startY: e.clientY, startSplit: { ...gridSplit } };
                              const containerH = canvasContainerRef.current?.offsetHeight || 480;
                              const onMove = (me) => {
                                  if (!collageDragRef.current.active) return;
                                  const dy = me.clientY - collageDragRef.current.startY;
                                  const deltaRatio = dy / containerH;
                                  setGridSplit(prev => ({ ...prev, y: Math.max(0.1, Math.min(0.9, collageDragRef.current.startSplit.y + deltaRatio)) }));
                                };
                                const onUp = () => {
                                  collageDragRef.current.active = false;
                                  window.removeEventListener("pointermove", onMove);
                                  window.removeEventListener("pointerup", onUp);
                                };
                                window.addEventListener("pointermove", onMove);
                                window.addEventListener("pointerup", onUp);
                              }}
                            />

                          {/* Bottom Row */}
                          <div style={{ flexGrow: 1, display: "flex", position: "relative", minHeight: 0 }}>
                            <div style={{ width: `${gridSplit.bottomX * 100}%`, flexShrink: 0, position: "relative", height: "100%", overflow: "hidden" }}>
                              <img src={images[2]} alt="Grid 3" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            </div>

                            {/* Vertical divider bottom */}
                            <div
                              style={{ width: "6px", cursor: "col-resize", background: "rgba(139,92,246,0.4)", zIndex: 25, position: "relative", flexShrink: 0 }}
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                collageDragRef.current = { active: true, type: "grid-v-bottom", startX: e.clientX, startSplit: { ...gridSplit } };
                                const containerW = canvasContainerRef.current?.offsetWidth || 480;
                                const onMove = (me) => {
                                  if (!collageDragRef.current.active) return;
                                  const dx = me.clientX - collageDragRef.current.startX;
                                  const deltaRatio = dx / containerW;
                                  setGridSplit(prev => ({ ...prev, bottomX: Math.max(0.1, Math.min(0.9, collageDragRef.current.startSplit.bottomX + deltaRatio)) }));
                                };
                                const onUp = () => {
                                  collageDragRef.current.active = false;
                                  window.removeEventListener("pointermove", onMove);
                                  window.removeEventListener("pointerup", onUp);
                                };
                                window.addEventListener("pointermove", onMove);
                                window.addEventListener("pointerup", onUp);
                              }}
                            />

                            <div style={{ flexGrow: 1, position: "relative", height: "100%", overflow: "hidden" }}>
                              <img src={images[3]} alt="Grid 4" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex" style={{ userSelect: "none" }}>
                          {images.map((src, idx) => (
                            <img key={idx} src={src} alt="Fallback Columns" className="flex-1 object-contain" />
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 w-full h-full bg-slate-955/10">
                        {/* Premium "Start Creating" Empty State Illustration */}
                        <div className="mb-4 text-purple-400 animate-pulse">
                          <svg className="w-14 h-14 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="font-bold text-sm mb-1 text-gray-700 dark:text-gray-300">Start Creating Your Meme</p>
                        <p className="text-xs text-gray-500 max-w-xs">
                          Drag &amp; drop photos into the left panel dropzone, load templates, or add text overlays to begin.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "video" && (
                  <div className="w-full h-full flex items-center justify-center bg-black">
                    {videoUrl ? (
                      <video 
                        ref={videoPlayerRef}
                        src={videoUrl} 
                        controls 
                        className="w-full max-h-full object-contain" 
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 w-full h-full bg-slate-955/10">
                        <div className="mb-4 text-purple-400">
                          <svg className="w-14 h-14 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="font-bold text-sm mb-1 text-gray-700 dark:text-gray-300">Video Canvas Empty</p>
                        <p className="text-xs text-gray-500 max-w-xs">
                          Upload a short video clip or select a sample preset in the left panel to play and trim.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "gif" && (
                  <div className="w-full h-full flex items-center justify-center bg-black">
                    {gifUrl ? (
                      <img 
                        src={gifUrl} 
                        alt="Active GIF Loop" 
                        className="w-full max-h-full object-contain" 
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 w-full h-full bg-slate-955/10">
                        <div className="mb-4 text-purple-400">
                          <svg className="w-14 h-14 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <p className="font-bold text-sm mb-1 text-gray-700 dark:text-gray-300">GIF Canvas Empty</p>
                        <p className="text-xs text-gray-505 max-w-xs">
                          Paste a Giphy link or select a sample GIF preset to load your looping overlay context.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "audio" && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 p-4 gap-3 overflow-y-auto">
                    {audioUrl ? (
                      <>
                        {/* Week 7: Live audiogram card preview */}
                        <AudiogramCanvas
                          ref={audiogramRef}
                          audioFile={audioFile}
                          audioUrl={audioUrl}
                          title={title || "Untitled Audio Meme"}
                          subject={subject === "Other" ? (customSubject || "General") : subject}
                          creatorName={profile?.displayName || user?.email || "MemeClassroom"}
                          bgColor={audiogramBgColor}
                          accentColor={audiogramAccentColor}
                        />
                        {/* Audio player for trimming preview */}
                        <audio 
                          ref={audioPlayerRef}
                          src={audioUrl} 
                          controls 
                          className="w-full max-w-xs mt-1" 
                        />
                        {/* Card colour controls */}
                        <div className="flex items-center gap-4 text-white text-[10px] font-bold">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <span className="uppercase tracking-wide">Card BG</span>
                            <input
                              type="color"
                              value={audiogramBgColor}
                              onChange={(e) => setAudiogramBgColor(e.target.value)}
                              className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                              title="Audiogram background colour"
                            />
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <span className="uppercase tracking-wide">Waveform</span>
                            <input
                              type="color"
                              value={audiogramAccentColor}
                              onChange={(e) => setAudiogramAccentColor(e.target.value)}
                              className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                              title="Waveform bar colour"
                            />
                          </label>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 w-full h-full bg-slate-955/10">
                        <div className="mb-4 text-purple-400 animate-pulse">
                          <svg className="w-14 h-14 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                        <p className="font-bold text-sm mb-1 text-gray-700 dark:text-gray-300">Audio Workspace Empty</p>
                        <p className="text-xs text-gray-500 max-w-xs">
                          Upload an MP3/audio file or load a sample — a shareable audiogram card will be generated automatically.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <p className={`mt-3 text-[11px] text-center italic relative z-10 place-holder `}>
                💡 Drag text layers on the canvas to position them. Double-click to edit text strings directly.
              </p>
            </div>
          </div>
        </div>
      </div>
      
{/* SAVE MODAL DIALOG */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg p-6 rounded-xl overflow-y-auto max-h-[90vh] ${containerClass}`}>
            <h2 className="text-lg font-bold mb-1">Export & Publish Meme Studio</h2>
            <p className="text-xs text-gray-500 mb-5">
              Review your visual composition draft and download it locally, or enter details to publish to the community library.
            </p>

            {/* Visual Draft Preview */}
            <div className="mb-5 bg-gray-55 dark:bg-zinc-950/60 rounded-xl p-3 border border-gray-150 dark:border-zinc-800 flex flex-col items-center justify-center">
              <span className="block text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">Meme Composition Draft</span>
              <div className="w-56 aspect-video rounded-lg overflow-hidden border border-gray-250 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center relative shadow-sm">
                {activeTab === "image" && images.length > 0 ? (
                  <div className="w-full h-full flex flex-wrap">
                    {images.map((src, idx) => (
                      <img key={idx} src={src} className="flex-1 object-cover min-w-[50%] h-full" alt="preview" />
                    ))}
                  </div>
                ) : activeTab === "gif" && gifUrl ? (
                  <img src={gifUrl} className="w-full h-full object-contain" alt="preview" />
                ) : activeTab === "video" && videoUrl ? (
                  <video src={videoUrl} className="w-full h-full object-contain" />
                ) : activeTab === "audio" && audioUrl ? (
                  <div className="text-center p-4 text-gray-500 text-xs">
                    <span className="text-3xl block mb-1">🎵</span>
                    Audio Waveform Card
                  </div>
                ) : (
                  <div className="text-gray-405 text-xs italic">Empty Canvas</div>
                )}
                
                {/* Simulated text overlays on top of the preview */}
                {textLayers.length > 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-between p-2 pointer-events-none bg-black/10">
                    <div className="bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow">
                      {textLayers[0].text.length > 20 ? `${textLayers[0].text.substring(0, 20)}...` : textLayers[0].text}
                    </div>
                    {textLayers.length > 1 && (
                      <div className="bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow">
                        {textLayers[1].text.length > 20 ? `${textLayers[1].text.substring(0, 20)}...` : textLayers[1].text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Download Only / Local Export (Before the form) */}
            <div className="mb-5 bg-purple-50/50 dark:bg-purple-955/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800/40 text-center">
              <span className="block text-[10px] text-purple-700 dark:text-purple-300 font-bold mb-2 uppercase tracking-wider">Just want the file locally?</span>
              <button
                type="button"
                onClick={() => handlePublishSubmit(false)}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-750 text-white font-bold py-2.5 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/10"
              >
                <span>📥</span>
                <span>Download Only (Bypass Publish Details)</span>
              </button>
            </div>

            <div className="flex items-center my-5">
              <div className="flex-grow border-t border-gray-200 dark:border-zinc-800" />
              <span className="px-3 text-[10px] text-gray-400 font-bold uppercase tracking-wider">Or Publish to Library</span>
              <div className="flex-grow border-t border-gray-200 dark:border-zinc-800" />
            </div>

            <div className="space-y-4 text-xs font-semibold mb-6">
              <div>
                <label className="block text-gray-500 uppercase mb-1">Meme Title</label>
                <input
                  type="text"
                  placeholder="e.g. Mitosis Explanation Meme"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Subject</label>
                  <input
                    type="text"
                    placeholder="Search subject..."
                    value={formSubjectSearch}
                    onChange={(e) => setFormSubjectSearch(e.target.value)}
                    className="w-full px-2 py-1 mb-1 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded text-[10px]"
                  />
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    {subjects
                      .filter(s => s.toLowerCase().includes(formSubjectSearch.toLowerCase()))
                      .map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                  </select>
                  {subject === "Other" && (
                    <input
                      type="text"
                      placeholder="Type custom subject..."
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded mt-2"
                      required
                    />
                  )}
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Grade Level</label>
                  <select
                    value={ageGroup}
                    onChange={(e) => setAgeGroup(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    {gradeGroups.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Language</label>
                  <input
                    type="text"
                    placeholder="Search language..."
                    value={formLanguageSearch}
                    onChange={(e) => setFormLanguageSearch(e.target.value)}
                    className="w-full px-2 py-1 mb-1 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded text-[10px]"
                  />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    {languages
                      .filter(lang => lang.toLowerCase().includes(formLanguageSearch.toLowerCase()))
                      .map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                  </select>
                  {language === "Other" && (
                    <input
                      type="text"
                      placeholder="Type custom language..."
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded mt-2 text-xs"
                      value={customLanguage}
                      onChange={(e) => setCustomLanguage(e.target.value)}
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-gray-500 uppercase mb-1">Topic / Keywords (Separate with comma)</label>
                  <input
                    type="text"
                    placeholder="e.g. mitosis, cells, science jokes"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded placeholder-gray-400"
                  />
                </div>
              </div>

            </div>

            {/* Clearer Call-To-Action (CTA) Grid */}
            <div className="flex flex-col gap-2 mt-6 border-t pt-4 border-gray-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => handlePublishSubmit(true)}
                disabled={loading}
                className="w-full bg-purple-650 hover:bg-purple-755 text-white font-bold py-2.5 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/10"
              >
                <span>🚀</span>
                <span>Publish to Library & Download</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="w-full text-[10px] text-gray-400 hover:text-gray-500 font-bold py-1.5 text-center mt-1.5 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TUTORIAL MODAL DIALOG */}
      {showTutorialModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-xl p-6 rounded-xl ${containerClass} overflow-y-auto max-h-[85vh]`}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-lg font-bold">Meme Studio Guidelines & Tutorial</h2>
              <button onClick={() => setShowTutorialModal(false)} className="text-gray-400 hover:text-gray-550 font-bold text-lg">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-650 dark:text-gray-300">
              <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800/40">
                <h3 className="font-bold text-purple-750 dark:text-purple-300 mb-1 text-sm">💡 Quick Studio Tutorial</h3>
                <ol className="list-decimal list-inside space-y-2 mt-2">
                  <li><strong>Choose Workspace Tab:</strong> Select <strong>Image</strong> (supports collages), <strong>Video</strong>, <strong>GIF</strong>, or <strong>Audio</strong> at the top of the canvas workbench.</li>
                  <li><strong>Add Media Assets:</strong> Browse the <strong>Library Templates</strong>, upload custom files via the drag-and-drop dropzone, or click <strong>Remix from Library</strong> to import public memes.</li>
                  <li><strong>Add Text & Styles:</strong> Click the <strong>Text</strong> tab in the sidebar. Select layers to change font sizes, alignments, opacity, and rotation angles. You can drag text directly on the canvas.</li>
                  <li><strong>Save & Export:</strong> Click the <strong>Save</strong> button on the top right. Download the file locally, or check the box to publish and share it with the community!</li>
                </ol>
              </div>

              <div>
                <h3 className="font-bold text-purple-750 dark:text-purple-400 mb-1">Pedagogical Curation Standards</h3>
                <p className="text-xs text-gray-500">
                  A high-pedagogy meme visually aligns content elements to bridge humor with real educational cognitive recall. Avoid distraction: make sure formulas, dates, and terminology are factually correct.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-purple-750 dark:text-purple-400 mb-1">Appropriateness Checklist</h3>
                <ul className="list-disc list-inside text-xs space-y-1 text-gray-500">
                  <li><strong>Appropriateness:</strong> Ensure all text overlays are clean and suitable for classrooms.</li>
                  <li><strong>Privacy:</strong> Do not upload photos of students without parental consent.</li>
                  <li><strong>Source:</strong> Verify that custom template backgrounds are free of copyright restrictions.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowTutorialModal(false)}
                className={btnClass}
              >
                Close Guidelines
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE CONTRIBUTION MODAL */}
      {showContributeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-xl overflow-y-auto max-h-[90vh] ${containerClass}`}>
            <div className="flex items-center justify-between border-b pb-2 mb-4 border-gray-150 dark:border-zinc-800">
              <h3 className="font-bold text-sm uppercase tracking-wider text-purple-700 dark:text-purple-400">Contribute Template to Library</h3>
              <button 
                type="button" 
                onClick={() => { setShowContributeModal(false); setTemplateSuccess(""); }} 
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleTemplateUploadSubmit} className="space-y-4 text-xs font-semibold">
              {templateSuccess && (
                <div className="p-3 bg-purple-50 dark:bg-purple-955/25 text-purple-750 dark:text-purple-300 rounded-lg border">
                  {templateSuccess}
                </div>
              )}
              <div>
                <label className="block text-gray-500 uppercase mb-1.5">Template Title</label>
                <input
                  type="text"
                  placeholder="e.g. Distracted Boyfriend Blank"
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-500 uppercase mb-1.5">Upload File (Image/GIF/Video/Audio)</label>
                <input
                  type="file"
                  accept="image/*,video/*,audio/*"
                  onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={templateLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm active:scale-95"
              >
                {templateLoading ? "Uploading..." : "Submit Template"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* LIBRARY PICKER MODAL */}
      <LibraryPickerModal
        isOpen={showLibraryPickerModal}
        onClose={() => setShowLibraryPickerModal(false)}
        onSelect={(mediaUrl) => {
          if (images.length >= 4) {
            setAlertMessage("You can only add up to 4 images to the collage.");
            return;
          }
          setImages(prev => [...prev, mediaUrl]);
        }}
      />

    </div>
  );
};

export default Lab;
