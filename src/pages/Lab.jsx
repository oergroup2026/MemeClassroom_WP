import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  HelpCircle,
  UploadCloud,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Sparkles,
  Download,
  Layers,
  Sliders,
  Palette,
  Type,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  Smile,
  ChevronDown,
  Check,
  Bold,
  Italic,
  Underline,
  RotateCcw,
  Search,
  Trash2,
  Copy,
  Share2,
  Plus,
  LayoutGrid
} from "lucide-react";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  updateDoc,
  increment,
  query,
  where,
  onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { checkUpload } from "../utils/uploadLimits";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import { MEDIA_SAMPLES } from "../constants/mediaSamples";
import { SUBJECTS, GRADE_GROUPS } from "../constants/taxonomy";
import { trackCustomSubmission } from "../utils/taxonomyUtils";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useVideoTrim } from "../hooks/useVideoTrim";
import { compileVideoMeme } from "../utils/videoCompiler";
import LibraryPickerModal from "../components/LibraryPickerModal";
import { subscribeStoryTemplateIds } from "../utils/storyTemplates";
import RichTextArea from "../components/RichTextArea";
import GiphySearch from "../components/GiphySearch";
import AudiogramCanvas from "../components/AudiogramCanvas";
import { useToast } from "../components/ToastNotification";
import { extractDominantColors } from "../utils/colorUtils";
import { generateMemeCaptions } from "../services/geminiClient";
import AiQuotaModal from "../components/AiQuotaModal";
import html2canvas from "html2canvas";
import { useTour } from "../hooks/useTour";
import TourOverlay from "../components/TourOverlay";
import PageHelpPanel from "../components/PageHelpPanel";
import ClassicVideoEditor from "../components/ClassicVideoEditor";

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

class LabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Meme Lab Error Boundary Caught Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto my-12 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center font-bold text-xl">⚠️</div>
          <h2 className="text-xl font-bold text-red-800 dark:text-red-300">Meme Studio Error Encountered</h2>
          <p className="text-sm text-red-600 dark:text-red-400 font-mono bg-red-100/50 dark:bg-red-900/40 p-3 rounded-lg text-left overflow-x-auto">
            {this.state.error?.toString() || "Unknown Error"}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition"
          >
            Reload Studio Workstation
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Lab = () => {
  const audioPlayerRef = useRef(null);
  const { user, profile, loading: authLoading } = useAuth();
  const { highContrastMode, fontSizeAdjustment } = useUdl();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Interactive Tour Hook
  const {
    isTourOpen,
    currentStep,
    totalSteps,
    currentStepData,
    pageTitle,
    hasSkippedTour,
    nextStep,
    prevStep,
    skipTour,
    resetTour,
  } = useTour("lab");

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

  // Fetch approved templates that have a meme story from Firestore
  useEffect(() => {
    // 1. Templates collection
    const qTemplates = query(
      collection(db, "templates"),
      where("status", "==", "approved")
    );
    const unsubTemplates = onSnapshot(qTemplates, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, isTemplate: true, ...doc.data() }));
      setAvailableTemplates(list);
    }, (error) => {
      console.warn("Templates subscription failed:", error);
      setAlertMessage("Couldn't load templates right now. Try refreshing the page.");
    });

    // 2. Ids of templates that have a meme story; only those are offered in the Lab
    const unsubStories = subscribeStoryTemplateIds(setStoryTemplateIds, (error) => {
      console.warn("Meme stories subscription failed:", error);
      setAlertMessage("Couldn't load meme templates right now. Try refreshing the page.");
    });

    return () => {
      unsubTemplates();
      unsubStories();
    };
  }, []);

  const handleSelectTemplate = (temp) => {
    setTemplateId(temp.id);
    const mediaUrl = temp.media_url || temp.image_url || temp.thumbnail || (temp.images && temp.images[0]);
    if (temp.format === "image" || !temp.format) {
      if (images.length >= 4) {
        setAlertMessage("You can only add up to 4 images to the collage.");
        return;
      }
      setImages(prev => (prev.length === 0 ? [mediaUrl] : [...prev, mediaUrl]));
      setActiveTab("image");
    } else if (temp.format === "video") {
      setVideoUrl(mediaUrl);
      setActiveTab("video");
    } else if (temp.format === "gif") {
      setGifUrl(mediaUrl);
      setActiveTab("gif");
    } else if (temp.format === "audio") {
      setAudioUrl(mediaUrl);
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
    }, (error) => {
      console.error("Taxonomy configs subscription failed:", error);
      setAlertMessage("Couldn't load subject/grade options right now. Try refreshing the page.");
    });
    return () => unsub();
  }, []);

  // Preload draft parameters to resume editing
  useEffect(() => {
    const draftId = searchParams.get("draftId");
    if (!draftId || authLoading) return;

    const loadDraft = async () => {
      try {
        const draftDoc = await getDoc(doc(db, "memes", draftId));
        if (draftDoc.exists()) {
          const data = draftDoc.data();
          if (data.creator_id !== user?.uid) {
            setAlertMessage("You don't have permission to open this draft.");
            return;
          }
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
  }, [searchParams, authLoading, user]);

  // --- Image Tab State ---
  const [images, setImages] = useState([]); // Array of base64/object URLs
  const [imageFiles, setImageFiles] = useState([]); // Array of raw File objects

  // Collage layout format: "columns" | "rows" | "grid"
  const [collageLayout, setCollageLayout] = useState("rows");

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
    // "Single" only ever shows the first image, so adding another one would
    // look like the upload silently failed — switch to a real collage layout.
    if (images.length > 1 && collageLayout === "single") {
      setCollageLayout("rows");
    }
  }, [images.length]);

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // --- Video Tab State ---
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null); // Raw File object
  const [videoDuration, setVideoDuration] = useState(30);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoTrimStart, setVideoTrimStart] = useState(0);
  const [videoTrimEnd, setVideoTrimEnd] = useState(30);
  // Phase 2E: timed captions — one per line, format: "0:02 – Caption text"
  const [videoCaptions, setVideoCaptions] = useState("");
  const [activeVideoCaptionText, setActiveVideoCaptionText] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [videoSubTab, setVideoSubTab] = useState("assets"); // "assets" | "trim" | "subtitles"
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoLoop, setVideoLoop] = useState(true);
  const [subtitlePosition, setSubtitlePosition] = useState("bottom"); // "bottom" | "middle" | "top"
  const [subtitleBgOpacity, setSubtitleBgOpacity] = useState(0.85);

  // --- GIF Tab State ---
  const [gifUrl, setGifUrl] = useState("");
  const [gifFile, setGifFile] = useState(null);
  const [showLibraryPickerModal, setShowLibraryPickerModal] = useState(false);

  // --- Audio Tab State ---
  const [audioUrl, setAudioUrl] = useState(MEDIA_SAMPLES?.audio?.[0]?.url || "");
  const [audioFile, setAudioFile] = useState(null); // Raw File object
  const [audioTrimStart, setAudioTrimStart] = useState(0);
  const [audioTrimEnd, setAudioTrimEnd] = useState(15);

  // --- Text Overlay State (with undo/redo history) ---
  // Text layer coordinate system:
  //   x, y, maxWidth  — percentages (0-100) of the canvas width (x, maxWidth) / height (y).
  //                      Rendered with plain CSS %, so they always track the actual canvas
  //                      box regardless of its on-screen size or aspect ratio.
  //   fontSize, strokeWidth — "reference px" authored against a 640px-wide canvas, converted
  //                      to CSS container-query width units (cqw) at render time and to
  //                      canvas-pixel units at export time via TEXT_LAYER_REF_WIDTH.
  const DEFAULT_TOP_LAYER = {
    id: "txt-top",
    role: "top",
    text: "FINISHED THE ASSIGNMENT A DAY BEFORE DEADLINE",
    x: 6,
    y: 5,
    fontSize: 26,
    color: "#FFFFFF",
    fontFamily: "Impact",
    strokeColor: "#000000",
    strokeWidth: 2.5,
    textAlign: "center",
    opacity: 1,
    rotation: 0,
    maxWidth: 88,
    fontWeight: "bold",
  };

  const DEFAULT_BOTTOM_LAYER = {
    id: "txt-bottom",
    role: "bottom",
    text: "REALIZES THERE'S STILL THE PRESENTATION LEFT",
    x: 6,
    y: 80,
    fontSize: 26,
    color: "#FFFFFF",
    fontFamily: "Impact",
    strokeColor: "#000000",
    strokeWidth: 2.5,
    textAlign: "center",
    opacity: 1,
    rotation: 0,
    maxWidth: 88,
    fontWeight: "bold",
  };

  // Reference canvas width that layer.fontSize/strokeWidth values are authored against.
  const TEXT_LAYER_REF_WIDTH = 640;

  const {
    state: textLayers,
    set: setTextLayersWithHistory,
    undo: undoTextLayers,
    redo: redoTextLayers,
    canUndo,
    canRedo,
  } = useUndoRedo([]);

  // Convenience wrapper that also accepts functional updaters
  const setTextLayers = useCallback((updater) => {
    setTextLayersWithHistory(prev =>
      typeof updater === "function" ? updater(prev) : updater
    );
  }, [setTextLayersWithHistory]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [suggestedColors, setSuggestedColors] = useState(["#FFFFFF", "#000000", "#FFD700", "#FF4500", "#9333EA"]);

  // Extract color palette whenever image/media source updates
  useEffect(() => {
    const src = images[0] || gifUrl || null;
    if (src) {
      extractDominantColors(src).then((colors) => {
        if (colors && colors.length) setSuggestedColors(colors);
      });
    }
  }, [images, gifUrl]);

  // --- General Modals & Alert States ---
  const [activeControlTab, setActiveControlTab] = useState("text"); // "text" | "image" | "filters" | "effects"

  // The Text/Subtitle tool is built around the image canvas — hide it once
  // another format tab (video/gif/audio) is active instead of leaving it selected but blank.
  useEffect(() => {
    if (activeTab !== "image" && activeControlTab === "text") {
      setActiveControlTab("filters");
    }
  }, [activeTab, activeControlTab]);

  // Workspace side panel: the image-editor controls and the template browser
  // are separate tabs so only one is on screen at a time. The Video Studio has
  // no editor controls, so it always shows the templates panel.
  const [sidePanelTab, setSidePanelTab] = useState("templates"); // "editor" | "templates"
  const panelTab = activeTab === "video" ? "templates" : sidePanelTab;
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedCategory, setSelectedCategory] = useState("popular");
  const [topTextInput, setTopTextInput] = useState("");
  const [bottomTextInput, setBottomTextInput] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [textEffectShadow, setTextEffectShadow] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [publishToLibrary, setPublishToLibrary] = useState(true);
  const [downloadLocally, setDownloadLocally] = useState(true);
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

  // Helper to get active section templates: approved templates that have a meme story
  const getActiveFormatTemplates = () => {
    const storyTemplates = availableTemplates.filter(t => storyTemplateIds.has(t.id));
    let list = [];
    if (activeTab === "image") {
      list = storyTemplates
        .filter(t => !t.format || t.format === "image")
        .map(t => ({
          id: t.id,
          title: t.title || "Template",
          thumbnail: t.media_url || t.thumbnail_url || t.image_url,
          images: [t.media_url || t.thumbnail_url || t.image_url],
          format: "image",
          category: t.category || (t.subject ? "academic" : "popular"),
          subject: t.subject || "",
          isDatabase: true
        }));
    } else if (activeTab === "video" || activeTab === "gif") {
      list = storyTemplates
        .filter(t => t.format === activeTab)
        .map(t => ({ id: t.id, title: t.title, thumbnail: t.media_url, url: t.media_url, format: activeTab, isDatabase: true }));
    } else if (activeTab === "audio") {
      list = storyTemplates
        .filter(t => t.format === "audio")
        .map(t => ({ id: t.id, title: t.title, thumbnail: t.media_url || "/templates/leonardo-toast.jpg", url: t.media_url, format: "audio", isDatabase: true }));
    }

    // Filter by search query
    if (templateSearchQuery && templateSearchQuery.trim()) {
      const q = templateSearchQuery.toLowerCase();
      list = list.filter(t => t.title?.toLowerCase().includes(q));
    }

    // Filter by category
    if (selectedCategory && selectedCategory !== "all" && selectedCategory !== "popular") {
      const filtered = list.filter(t => {
        if (selectedCategory === "academic") {
          return t.category === "academic" || Boolean(t.subject && t.subject !== "General");
        }
        if (selectedCategory === "reactions") {
          return t.category === "reactions" || t.title?.toLowerCase().includes("reaction") || t.format === "gif";
        }
        if (selectedCategory === "students") {
          return t.category === "students" || t.title?.toLowerCase().includes("student") || t.title?.toLowerCase().includes("assignment") || t.title?.toLowerCase().includes("exam");
        }
        return true;
      });
      if (filtered.length > 0) {
        list = filtered;
      }
    }

    return list;
  };

  // Bidirectional sync for Top & Bottom text inputs
  const handleTopTextChange = (val) => {
    setTopTextInput(val);
    setTextLayers(prev => {
      const topL = prev.find(l => l.role === "top" || l.id === "txt-top");
      if (topL) {
        return prev.map(l => l.id === topL.id ? { ...l, text: val } : l);
      }
      return [{ ...DEFAULT_TOP_LAYER, text: val }, ...prev];
    });
  };

  const handleBottomTextChange = (val) => {
    setBottomTextInput(val);
    setTextLayers(prev => {
      const btmL = prev.find(l => l.role === "bottom" || l.id === "txt-bottom");
      if (btmL) {
        return prev.map(l => l.id === btmL.id ? { ...l, text: val } : l);
      }
      return [...prev, { ...DEFAULT_BOTTOM_LAYER, text: val }];
    });
  };

  // Clear/delete specific text layers
  const deleteTopText = () => {
    setTextLayers(prev => prev.filter(l => l.role !== "top" && l.id !== "txt-top"));
    setTopTextInput("");
  };

  const deleteBottomText = () => {
    setTextLayers(prev => prev.filter(l => l.role !== "bottom" && l.id !== "txt-bottom"));
    setBottomTextInput("");
  };

  const deleteTextLayer = (id) => {
    setTextLayers(prev => prev.filter(l => l.role !== id && l.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
    if (editingTextId === id) setEditingTextId(null);
  };

  const clearAllText = () => {
    setTextLayers([]);
    setTopTextInput("");
    setBottomTextInput("");
    setSelectedTextId(null);
    setEditingTextId(null);
  };

  const addNewTextLayer = () => {
    const newId = `txt-${Date.now()}`;
    const newLayer = {
      id: newId,
      text: "CUSTOM CAPTION",
      x: 25 + Math.random() * 15,
      y: 40 + Math.random() * 15,
      fontSize: 24,
      color: "#FFFFFF",
      fontFamily: "Impact, sans-serif",
      strokeColor: "#000000",
      strokeWidth: 2,
      textAlign: "center",
      opacity: 1,
      rotation: 0,
      maxWidth: 60,
      fontWeight: "bold",
    };
    setTextLayers(prev => [...prev, newLayer]);
    setSelectedTextId(newId);
  };

  useEffect(() => {
    const topL = textLayers.find(l => l.role === "top" || l.id === "txt-top") || textLayers[0];
    const btmL = textLayers.find(l => l.role === "bottom" || l.id === "txt-bottom") || textLayers[1];
    if (topL && topL.text !== topTextInput) setTopTextInput(topL.text || "");
    if (btmL && btmL.text !== bottomTextInput) setBottomTextInput(btmL.text || "");
  }, [textLayers]);

  const handleFontChange = (fontFamily) => {
    if (selectedTextId) {
      updateTextLayer("fontFamily", fontFamily);
    } else {
      setTextLayers(prev => prev.map(l => ({ ...l, fontFamily })));
    }
  };

  const handleFontSizeChange = (sizeName) => {
    const sizeMap = {
      Small: 18,
      Medium: 24,
      Large: 30,
      "Extra Large": 38,
    };
    const px = sizeMap[sizeName] || parseInt(sizeName) || 26;
    if (selectedTextId) {
      updateTextLayer("fontSize", px);
    } else {
      setTextLayers(prev => prev.map(l => ({ ...l, fontSize: px })));
    }
  };

  const handleColorChange = (color) => {
    if (selectedTextId) {
      updateTextLayer("color", color);
    } else {
      setTextLayers(prev => prev.map(l => ({ ...l, color })));
    }
  };

  const handleStyleToggle = (styleType) => {
    setTextLayers(prev => prev.map(l => {
      if (selectedTextId && l.id !== selectedTextId) return l;
      if (styleType === "bold") {
        return { ...l, fontWeight: l.fontWeight === "bold" ? "normal" : "bold" };
      }
      if (styleType === "italic") {
        return { ...l, fontStyle: l.fontStyle === "italic" ? "normal" : "italic" };
      }
      if (styleType === "underline") {
        return { ...l, textDecoration: l.textDecoration === "underline" ? "none" : "underline" };
      }
      if (styleType === "uppercase") {
        const isUpper = l.text === l.text.toUpperCase();
        return { ...l, text: isUpper ? l.text.toLowerCase() : l.text.toUpperCase() };
      }
      return l;
    }));
  };

  const handleSelectTemplatePreset = (tpl) => {
    if (tpl.id) setTemplateId(tpl.id);
    if (tpl.format === "video" || activeTab === "video") {
      const vUrl = tpl.url || tpl.media_url;
      if (vUrl) {
        setVideoUrl(vUrl);
        setVideoDuration(30);
        setVideoCurrentTime(0);
      }
    } else if (tpl.format === "gif" || activeTab === "gif") {
      const gUrl = tpl.url || tpl.media_url;
      if (gUrl) setGifUrl(gUrl);
    } else if (tpl.format === "audio" || activeTab === "audio") {
      const aUrl = tpl.url || tpl.media_url;
      if (aUrl) {
        setAudioUrl(aUrl);
        selectMediaPreset(aUrl, "audio", 30);
      }
    } else {
      const imgUrl = tpl.thumbnail || tpl.media_url || (tpl.images && tpl.images[0]);
      if (tpl.images && tpl.images.length > 0) {
        setImages(tpl.images);
        if (tpl.collage) setCollageLayout(tpl.collage);
        else setCollageLayout(tpl.images.length > 1 ? "rows" : "single");
      } else if (imgUrl) {
        setImages([imgUrl]);
        setCollageLayout("single");
      }
      if (tpl.defaultTop !== undefined) handleTopTextChange(tpl.defaultTop);
      if (tpl.defaultBottom !== undefined) handleBottomTextChange(tpl.defaultBottom);
    }
  };

  const FILTER_MAP = {
    none: "",
    grayscale: "grayscale(100%)",
    sepia: "sepia(80%)",
    contrast: "contrast(150%) brightness(110%)",
    warm: "sepia(30%) saturate(140%)",
    cool: "hue-rotate(180deg)",
    invert: "invert(100%)",
    vintage: "sepia(40%) contrast(120%) saturate(80%)",
    neon: "contrast(130%) saturate(180%) drop-shadow(0 0 6px rgba(244,63,94,0.6))"
  };

  // --- AI Meme Caption Generator State ---
  const [showAiModal, setShowAiModal] = useState(false);
  const [showAiPunchlinesModal, setShowAiPunchlinesModal] = useState(false);
  const [aiPromptTopic, setAiPromptTopic] = useState("");
  const [aiCaptions, setAiCaptions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const handleGenerateAiCaptions = async () => {
    setAiLoading(true);
    setAiError("");
    setAiCaptions([]);
    try {
      const activeSub = subject === "Other" ? customSubject : subject;
      const resText = await generateMemeCaptions({
        subject: activeSub || "General",
        topic: aiPromptTopic || title || "High school classroom humor",
        tone: "witty & educational"
      });
      // Parse numbered list
      const lines = resText
        .split("\n")
        .map(l => l.replace(/^\d+\.\s*["']?/, "").replace(/["']$/, "").trim())
        .filter(l => l.length > 5);
      setAiCaptions(lines.length ? lines : [resText]);
    } catch (err) {
      if (err.message === "QUOTA_EXCEEDED") {
        setShowAiPunchlinesModal(false);
        setShowAiModal(true);
      } else {
        setAiError(err.message || "Failed to generate AI captions.");
      }
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiCaption = (captionText) => {
    if (activeTextLayer) {
      updateTextLayer("text", captionText);
    } else {
      addTextLayer(captionText);
    }
    setShowAiPunchlinesModal(false);
  };

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
  const [storyTemplateIds, setStoryTemplateIds] = useState(() => new Set());
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");

  // --- Meme Story State ---
  const [memeStoryModal, setMemeStoryModal] = useState({ open: false, story: null, template: null, loading: false });
  const [storyExpanded, setStoryExpanded] = useState(false);
  // Contribute story fields (inside contribute template modal)
  const [includeStory, setIncludeStory] = useState(false);
  const [storyOrigin, setStoryOrigin] = useState("");
  const [storyUsageContext, setStoryUsageContext] = useState("");
  const [storyEducationalUse, setStoryEducationalUse] = useState("");
  const [storyExampleImages, setStoryExampleImages] = useState([""]); // array of URLs
  const [storyExampleFiles, setStoryExampleFiles] = useState([]); // array of File objects for upload

  // Refs
  const canvasContainerRef = useRef(null);
  const videoPlayerRef = useRef(null);
  const timelineTrackRef = useRef(null);
  const dragInfoRef = useRef({ isDragging: false, textId: null, startX: 0, startY: 0, startLeft: 0, startTop: 0 });
  const resizeInfoRef = useRef({ isResizing: false, handle: null, textId: null, startX: 0, startY: 0, startFontSize: 24 });

  // Tracks the live rendered width of the canvas box, so text-layer fontSize/strokeWidth
  // (authored as "reference px" against TEXT_LAYER_REF_WIDTH) can scale to match it.
  // NOTE: deliberately NOT using CSS `container-type` for this — applying it to
  // canvasContainerRef collapses its size to 0 in this flex/aspect-ratio layout.
  const [canvasBoxWidth, setCanvasBoxWidth] = useState(340);
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const update = () => setCanvasBoxWidth(el.offsetWidth || 340);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
    // Only re-attach when the element itself swaps (activeTab toggles whether
    // canvasContainerRef is mounted at all); ResizeObserver handles all other
    // size changes (aspect-ratio switch, window resize) without needing more deps.
  }, [activeTab]);
  // --- Compact Studio Controls & Filter States ---
  const [activeEffect, setActiveEffect] = useState("none");
  const [filterBrightness, setFilterBrightness] = useState(100);
  const [filterContrast, setFilterContrast] = useState(100);
  const [filterSaturation, setFilterSaturation] = useState(100);

  // Builds the canvas ctx.filter string from the SAME `selectedFilter` state
  // the live on-screen preview uses (FILTER_MAP), so exported memes match what's shown.
  const getCanvasFilterString = () => {
    const parts = [];
    if (FILTER_MAP[selectedFilter]) parts.push(FILTER_MAP[selectedFilter]);

    if (activeEffect === "deepfry") parts.push("contrast(250%) saturate(300%) brightness(110%)");
    else if (activeEffect === "blur") parts.push("blur(2px)");

    if (filterBrightness !== 100) parts.push(`brightness(${filterBrightness}%)`);
    if (filterContrast !== 100) parts.push(`contrast(${filterContrast}%)`);
    if (filterSaturation !== 100) parts.push(`saturate(${filterSaturation}%)`);

    return parts.length > 0 ? parts.join(" ") : "none";
  };

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
        const validFiles = [];
        for (const file of fileArray) {
          const problem = checkUpload(file, { allow: ["image"] });
          if (problem) {
            setAlertMessage(problem);
            continue;
          }
          validFiles.push(file);
        }
        if (validFiles.length === 0) return;
        const newUrls = validFiles.map(file => createObjectURLSafe(file));
        setImages(prev => [...prev, ...newUrls]);
        setImageFiles(prev => [...prev, ...validFiles]);
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

    // Size gate before anything else: this file is handed to ffmpeg.wasm, which
    // runs single-threaded in the browser and will exhaust memory on a phone
    // long before Firebase would reject the upload.
    const problem = checkUpload(file, { allow: ["video"] });
    if (problem) {
      setAlertMessage(problem);
      e.target.value = "";
      setVideoUrl("");
      setVideoFile(null);
      return;
    }

    // Create virtual video element to inspect duration metadata
    const videoElement = document.createElement("video");
    videoElement.preload = "metadata";
    videoElement.src = URL.createObjectURL(file);
    videoElement.onloadedmetadata = () => {
      window.URL.revokeObjectURL(videoElement.src);
      if (videoElement.duration > 30) {
        setAlertMessage("Video memes must be under 30 seconds");
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

  // The sidebar "Choose File" input accepts image, video and audio, so a video
  // picked there must go to the video editor instead of the image collage.
  // (GIF/Audio tabs keep their existing behaviour.)
  const handleSidebarFileChange = (e) => {
    const picked = Array.from(e.target.files || []);
    const pickedVideo = picked.find((f) => f.type.startsWith("video/"));
    if ((activeTab === "image" || activeTab === "video") && pickedVideo) {
      setActiveTab("video");
      handleVideoUpload({ target: { files: [pickedVideo], value: "" } });
      e.target.value = "";
      return;
    }
    handleImageUpload(e);
  };

  // Image Upload support (max 4 collage images)
  const handleImageUpload = (e) => {
    setAlertMessage("");
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 4) {
      setAlertMessage("You can select up to 4 images for the collage.");
      return;
    }

    const validFiles = [];
    for (const file of files) {
      const problem = checkUpload(file, { allow: ["image"] });
      if (problem) {
        setAlertMessage(problem);
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) {
      e.target.value = "";
      return;
    }

    const newUrls = validFiles.map(file => createObjectURLSafe(file));
    setImages(prev => [...prev, ...newUrls]);
    setImageFiles(prev => [...prev, ...validFiles]);
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
    setSidePanelTab("editor");

    const layer = textLayers.find(l => l.id === textId);
    if (!layer) return;

    dragInfoRef.current = {
      isDragging: true,
      textId: textId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: layer.x,
      startTop: layer.y,
      // Captured once at drag-start: converts screen-px mouse movement into
      // percentage-of-canvas deltas, since layer.x/y are stored as percentages.
      containerW: canvasContainerRef.current?.offsetWidth || 340,
      containerH: canvasContainerRef.current?.offsetHeight || 340
    };
  };

  const handleResizePointerDown = (e, textId, handle) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTextId(textId);
    const layer = textLayers.find(l => l.id === textId);
    if (!layer) return;

    resizeInfoRef.current = {
      isResizing: true,
      handle: handle,
      textId: textId,
      startX: e.clientX,
      startY: e.clientY,
      startFontSize: layer.fontSize || 24,
      // fontSize is stored in "reference px" (see TEXT_LAYER_REF_WIDTH) — convert
      // screen-px resize movement into that same reference scale.
      containerW: canvasContainerRef.current?.offsetWidth || 340
    };
  };

  const handlePointerMove = (e) => {
    if (resizeInfoRef.current.isResizing) {
      const rInfo = resizeInfoRef.current;
      const deltaX = e.clientX - rInfo.startX;
      const deltaY = e.clientY - rInfo.startY;

      let delta = 0;
      if (rInfo.handle === "se") {
        delta = deltaX + deltaY;
      } else if (rInfo.handle === "sw") {
        delta = -deltaX + deltaY;
      } else if (rInfo.handle === "ne") {
        delta = deltaX - deltaY;
      } else if (rInfo.handle === "nw") {
        delta = -deltaX - deltaY;
      }

      const refScale = TEXT_LAYER_REF_WIDTH / (rInfo.containerW || 340);
      const newFontSize = Math.max(10, Math.min(180, Math.round(rInfo.startFontSize + delta * 0.3 * refScale)));

      setTextLayers(prev =>
        prev.map(layer => {
          if (layer.id === rInfo.textId) {
            return { ...layer, fontSize: newFontSize };
          }
          return layer;
        })
      );
      return;
    }

    if (!dragInfoRef.current.isDragging) return;
    const info = dragInfoRef.current;

    const deltaX = e.clientX - info.startX;
    const deltaY = e.clientY - info.startY;
    const deltaXPercent = (deltaX / (info.containerW || 340)) * 100;
    const deltaYPercent = (deltaY / (info.containerH || 340)) * 100;

    setTextLayers(prev =>
      prev.map(layer => {
        if (layer.id === info.textId) {
          return {
            ...layer,
            x: info.startLeft + deltaXPercent,
            y: info.startTop + deltaYPercent
          };
        }
        return layer;
      })
    );
  };

  const handlePointerUp = () => {
    dragInfoRef.current.isDragging = false;
    resizeInfoRef.current.isResizing = false;
  };

  const moveLayerUp = (id) => {
    setTextLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx <= 0) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx - 1];
      copy[idx - 1] = temp;
      return copy;
    });
  };

  const moveLayerDown = (id) => {
    setTextLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx + 1];
      copy[idx + 1] = temp;
      return copy;
    });
  };

  const addTextLayer = (text = "New Text Layer") => {
    const newId = `txt-${Date.now()}`;
    setTextLayers(prev => [
      ...prev,
      {
        id: newId,
        text,
        x: 20 + Math.random() * 15,
        y: 35 + Math.random() * 15,
        fontSize: 24,
        color: "#FFFFFF",
        fontFamily: "Impact",
        strokeColor: "#000000",
        strokeWidth: 2,
        textAlign: "center",
        opacity: 1,
        rotation: 0,
        maxWidth: 60,
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
    setTextLayers(prev => [...prev, { ...layer, id: newId, x: Math.min(90, layer.x + 4), y: Math.min(90, layer.y + 4) }]);
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

    video.muted = videoMuted;

    const checkTime = () => {
      setVideoCurrentTime(video.currentTime);

      if (video.currentTime >= videoTrimEnd) {
        if (videoLoop) {
          video.currentTime = videoTrimStart;
        } else {
          video.pause();
          video.currentTime = videoTrimStart;
        }
      }
      if (video.currentTime < videoTrimStart) {
        video.currentTime = videoTrimStart;
      }

      // Parse captions
      const parsedCaptions = videoCaptions
        .split("\n")
        .map(line => {
          const match = line.match(/^(\d+):(\d+)\s*[–\-]\s*(.+)$/);
          if (!match) return null;
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          return { time: minutes * 60 + seconds, text: match[3].trim() };
        })
        .filter(Boolean);

      const active = parsedCaptions
        .slice()
        .reverse()
        .find(c => c.time <= video.currentTime);
      setActiveVideoCaptionText(active ? active.text : "");
    };

    const handleLoadedMetadata = () => {
      if (video.duration) {
        setVideoDuration(video.duration);
        if (videoTrimEnd === 30 || videoTrimEnd > video.duration) {
          setVideoTrimEnd(video.duration);
        }
      }
    };

    video.addEventListener("timeupdate", checkTime);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener("timeupdate", checkTime);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [videoTrimStart, videoTrimEnd, videoUrl, activeTab, videoCaptions, videoMuted, videoLoop]);

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

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const rebuildCaptionsString = (list) => {
    return list
      .map(c => `${formatTime(c.time)} – ${c.text}`)
      .join("\n");
  };

  const handleAddCaptionAtCurrentTime = () => {
    const video = videoPlayerRef.current;
    const time = video ? Math.floor(video.currentTime) : 0;
    const parsed = parseCaptionLines(videoCaptions);
    parsed.push({ time, text: "New timed subtitle" });
    parsed.sort((a, b) => a.time - b.time);
    setVideoCaptions(rebuildCaptionsString(parsed));
  };

  const handleDeleteCaptionIndex = (indexToDelete) => {
    const parsed = parseCaptionLines(videoCaptions);
    const filtered = parsed.filter((_, idx) => idx !== indexToDelete);
    setVideoCaptions(rebuildCaptionsString(filtered));
  };

  const handleEditCaptionText = (indexToEdit) => {
    const parsed = parseCaptionLines(videoCaptions);
    const currentText = parsed[indexToEdit]?.text || "";
    const newText = prompt("Edit Subtitle Text:", currentText);
    if (newText !== null) {
      parsed[indexToEdit].text = newText.trim() || "Subtitle";
      setVideoCaptions(rebuildCaptionsString(parsed));
    }
  };

  // --- Video Splitting States & Handlers ---
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitProgress, setSplitProgress] = useState("");

  // Hotkey listener for video studio playback (Space, Left/Right arrows, M key)
  useEffect(() => {
    if (activeTab !== "video") return;
    const anyModalOpen = showSaveModal || showTutorialModal || showLibraryPickerModal
      || showAiPunchlinesModal || showAiModal || showContributeModal || showSplitModal;
    if (anyModalOpen) return;
    const handleKeyDown = (e) => {
      // Ignore key events when typing in inputs or textareas
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;

      if (e.code === "Space") {
        e.preventDefault();
        const video = videoPlayerRef.current;
        if (video) {
          if (video.paused) video.play().catch(() => { });
          else video.pause();
        }
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        const video = videoPlayerRef.current;
        if (video) {
          const target = Math.max(0, video.currentTime - 0.5);
          video.currentTime = target;
          setVideoCurrentTime(target);
        }
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        const video = videoPlayerRef.current;
        if (video) {
          const target = Math.min(videoDuration, video.currentTime + 0.5);
          video.currentTime = target;
          setVideoCurrentTime(target);
        }
      } else if (e.code === "KeyM") {
        e.preventDefault();
        setVideoMuted(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, videoDuration, showSaveModal, showTutorialModal, showLibraryPickerModal, showAiPunchlinesModal, showAiModal, showContributeModal, showSplitModal]);

  const handleSplitVideoAtCurrentTime = () => {
    if (!videoUrl) {
      setAlertMessage("Please load a video first.");
      return;
    }
    // Verify that current time is strictly between trim start and end with a 0.5s margin
    if (videoCurrentTime <= videoTrimStart + 0.5 || videoCurrentTime >= videoTrimEnd - 0.5) {
      setAlertMessage("Playhead must be at least 0.5s away from the trim handles to split.");
      return;
    }
    setShowSplitModal(true);
  };

  const handleKeepLeftPart = () => {
    setVideoTrimEnd(videoCurrentTime);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = videoTrimStart;
    }
    setShowSplitModal(false);
    setAutoSaveToast("Trimmed to left part!");
    setTimeout(() => setAutoSaveToast(""), 3000);
  };

  const handleKeepRightPart = () => {
    setVideoTrimStart(videoCurrentTime);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = videoCurrentTime;
    }
    setShowSplitModal(false);
    setAutoSaveToast("Trimmed to right part!");
    setTimeout(() => setAutoSaveToast(""), 3000);
  };

  const handleDownloadBothParts = async () => {
    setSplitLoading(true);
    setSplitProgress("Initializing FFmpeg...");
    try {
      let fileToTrim = videoFile;
      if (!fileToTrim && videoUrl) {
        setSplitProgress("Fetching source video...");
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        fileToTrim = new File([blob], "source.mp4", { type: "video/mp4" });
      }

      if (!fileToTrim) throw new Error("No video file found.");

      setSplitProgress("Trimming Part 1 (Left)...");
      const part1Blob = await trimVideo(
        fileToTrim,
        videoTrimStart,
        videoCurrentTime,
        (p) => setSplitProgress(`Trimming Part 1: ${Math.round(p * 100)}%`)
      );

      setSplitProgress("Trimming Part 2 (Right)...");
      const part2Blob = await trimVideo(
        fileToTrim,
        videoCurrentTime,
        videoTrimEnd,
        (p) => setSplitProgress(`Trimming Part 2: ${Math.round(p * 100)}%`)
      );

      setSplitProgress("Triggering downloads...");
      const downloadBlob = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      const baseName = title.trim() || "meme_split";
      downloadBlob(part1Blob, `${baseName}_part1.mp4`);
      downloadBlob(part2Blob, `${baseName}_part2.mp4`);

      setShowSplitModal(false);
      setAutoSaveToast("Successfully split and downloaded both parts!");
      setTimeout(() => setAutoSaveToast(""), 4000);
    } catch (err) {
      console.error(err);
      setAlertMessage(err.message || "Failed to split and download video.");
    } finally {
      setSplitLoading(false);
      setSplitProgress("");
    }
  };

  const handleSaveBothPartsAsDrafts = async () => {
    if (!user) {
      setAlertMessage("You must be logged in to save drafts.");
      return;
    }
    setSplitLoading(true);
    setSplitProgress("Initializing FFmpeg...");
    try {
      let fileToTrim = videoFile;
      if (!fileToTrim && videoUrl) {
        setSplitProgress("Fetching source video...");
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        fileToTrim = new File([blob], "source.mp4", { type: "video/mp4" });
      }

      if (!fileToTrim) throw new Error("No video file found.");

      setSplitProgress("Trimming Part 1...");
      const part1Blob = await trimVideo(
        fileToTrim,
        videoTrimStart,
        videoCurrentTime,
        (p) => setSplitProgress(`Trimming Part 1: ${Math.round(p * 100)}%`)
      );

      setSplitProgress("Trimming Part 2...");
      const part2Blob = await trimVideo(
        fileToTrim,
        videoCurrentTime,
        videoTrimEnd,
        (p) => setSplitProgress(`Trimming Part 2: ${Math.round(p * 100)}%`)
      );

      setSplitProgress("Uploading Part 1...");
      const storageRef1 = ref(storage, `memes/${user.uid}_part1_${Date.now()}.mp4`);
      const snapshot1 = await uploadBytes(storageRef1, part1Blob);
      const url1 = await getDownloadURL(snapshot1.ref);

      setSplitProgress("Uploading Part 2...");
      const storageRef2 = ref(storage, `memes/${user.uid}_part2_${Date.now()}.mp4`);
      const snapshot2 = await uploadBytes(storageRef2, part2Blob);
      const url2 = await getDownloadURL(snapshot2.ref);

      const allCaptions = parseCaptionLines(videoCaptions);
      const leftCaptions = allCaptions
        .filter(c => c.time >= videoTrimStart && c.time < videoCurrentTime)
        .map(c => ({ time: c.time - videoTrimStart, text: c.text }));
      const rightCaptions = allCaptions
        .filter(c => c.time >= videoCurrentTime && c.time <= videoTrimEnd)
        .map(c => ({ time: c.time - videoCurrentTime, text: c.text }));

      setSplitProgress("Saving Part 1 draft...");
      const finalSubject = subject === "Other" ? (customSubject.trim() || "Other") : subject;
      const finalLanguage = language === "Other" ? (customLanguage.trim() || "Other") : language;
      const parsedKeywords = keywords ? keywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean) : [];

      const draftName = title.trim() || "Meme Video";
      await addDoc(collection(db, "memes"), {
        creator_id: user.uid,
        title: `${draftName} (Part 1)`,
        subject: finalSubject,
        age_group: ageGroup,
        format: "video",
        language: finalLanguage,
        keywords: parsedKeywords,
        visibility: "draft",
        media_url: url1,
        media_urls_json: "[]",
        text_layers_json: JSON.stringify(textLayers),
        captions_json: JSON.stringify(leftCaptions),
        template_id: templateId || "",
        created_at: serverTimestamp()
      });

      setSplitProgress("Saving Part 2 draft...");
      await addDoc(collection(db, "memes"), {
        creator_id: user.uid,
        title: `${draftName} (Part 2)`,
        subject: finalSubject,
        age_group: ageGroup,
        format: "video",
        language: finalLanguage,
        keywords: parsedKeywords,
        visibility: "draft",
        media_url: url2,
        media_urls_json: "[]",
        text_layers_json: JSON.stringify(textLayers),
        captions_json: JSON.stringify(rightCaptions),
        template_id: templateId || "",
        created_at: serverTimestamp()
      });

      setShowSplitModal(false);
      setAutoSaveToast("Saved both parts to your library drafts!");
      setTimeout(() => setAutoSaveToast(""), 4000);
    } catch (err) {
      console.error(err);
      setAlertMessage(err.message || "Failed to split and save drafts.");
    } finally {
      setSplitLoading(false);
      setSplitProgress("");
    }
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
    const isCrossOrigin = src.startsWith("http") && !src.startsWith(window.location.origin);

    // Cross-origin sources (e.g. Firebase Storage) need crossOrigin="anonymous"
    // set BEFORE loading, or the image will visually load fine but "taint" the
    // canvas, making canvas.toBlob() throw a SecurityError later at export time.
    const loadDirect = () => new Promise((resolve, reject) => {
      const img = new Image();
      if (isCrossOrigin) img.crossOrigin = "anonymous";
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
    });

    // Fallback for sources that don't send CORS headers at all (so the direct,
    // CORS-tagged load fails outright): fetch through a public CORS proxy and
    // draw the resulting same-origin blob instead.
    const loadViaProxy = () => new Promise((resolve, reject) => {
      const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(src)}`;
      fetch(proxiedUrl)
        .then((response) => {
          if (!response.ok) throw new Error(`CORS proxy fetch failed: ${response.status}`);
          return response.blob();
        })
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.src = blobUrl;
          img.onload = () => {
            resolve(img);
            URL.revokeObjectURL(blobUrl);
          };
          img.onerror = (e) => {
            URL.revokeObjectURL(blobUrl);
            reject(e);
          };
        })
        .catch(reject);
    });

    if (!isCrossOrigin) return loadDirect();
    return loadDirect().catch(loadViaProxy);
  };

  // --- Canvas Settings State ---
  const [canvasAspect, setCanvasAspect] = useState("1:1"); // "1:1" | "16:9" | "9:16" | "4:3"
  const [canvasBg, setCanvasBg] = useState(highContrastMode ? "#111624" : "#ffffff"); // background fill color

  useEffect(() => {
    setCanvasBg(highContrastMode ? "#111624" : "#ffffff");
  }, [highContrastMode]);

  const ASPECT_RATIOS = {
    "1:1": { css: "aspect-square", w: 1, h: 1 },
    "16:9": { css: "aspect-video", w: 16, h: 9 },
    "9:16": { css: "aspect-[9/16]", w: 9, h: 16 },
    "4:3": { css: "aspect-[4/3]", w: 4, h: 3 },
  };

  const generateMemeBlob = async () => {
    const container = canvasContainerRef.current;
    if (!container) return null;
    const scale = 1;
    const displayW = container.offsetWidth || 500;
    const displayH = container.offsetHeight || 500;
    const width = displayW * scale;
    const height = displayH * scale;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Draw background
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, width, height);

    // Apply visual filters if any
    const filterStr = getCanvasFilterString();
    if (filterStr && filterStr !== "none") {
      ctx.filter = filterStr;
    }

    // Draw images collage if activeTab is "image"
    if (activeTab === "image" && images.length > 0) {
      const numImages = images.length;
      const loadedImages = [];
      let failedCount = 0;
      for (let i = 0; i < numImages; i++) {
        try {
          const img = await loadImage(images[i]);
          loadedImages.push(img);
        } catch (err) {
          console.error("Failed to load image", images[i], err);
          loadedImages.push(null);
          failedCount += 1;
        }
      }
      if (failedCount > 0) {
        // Abort rather than export/publish a meme that's silently missing an image.
        const loadErr = new Error(
          `Couldn't load ${failedCount} of ${numImages} image${numImages > 1 ? "s" : ""} for export, ` +
          "so nothing was exported. Try re-uploading the image, or pick a different template."
        );
        loadErr.userFacing = true;
        throw loadErr;
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

    // Reset filter for overlays & text
    ctx.filter = "none";

    // Overlay White Border effect if selected
    if (activeEffect === "whiteborder") {
      ctx.fillStyle = "#FFFFFF";
      const borderH = Math.round(height * 0.08);
      ctx.fillRect(0, 0, width, borderH);
      ctx.fillRect(0, height - borderH, width, borderH);
    }

    // Draw text overlays — supports align, opacity, rotation, maxWidth, bold, italic, allCaps
    // layer.x/y/maxWidth are percentages of the canvas; fontSize/strokeWidth are
    // "reference px" against TEXT_LAYER_REF_WIDTH — matches the live DOM preview's
    // %/cqw units exactly so the export always looks like what was on screen.
    const textRefScale = width / TEXT_LAYER_REF_WIDTH;
    textLayers.forEach(layer => {
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;

      const scaledX = (layer.x / 100) * width;
      const scaledY = (layer.y / 100) * height;
      const scaledFontSize = layer.fontSize * textRefScale;

      // Rotate around the text origin point
      if (layer.rotation) {
        ctx.translate(scaledX, scaledY);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.translate(-scaledX, -scaledY);
      }

      const isBold = layer.isBold || layer.fontFamily === "Impact";
      const fontStyle = layer.isItalic ? "italic " : "";
      const fontWeight = isBold ? "bold " : "";
      ctx.font = `${fontStyle}${fontWeight}${scaledFontSize}px ${layer.fontFamily || 'Impact'}`;
      ctx.fillStyle = layer.color || '#FFFFFF';
      ctx.strokeStyle = layer.strokeColor || '#000000';
      ctx.lineWidth = (layer.strokeWidth || 0) * 2 * textRefScale;
      ctx.textBaseline = 'top';
      ctx.textAlign = layer.textAlign || 'left';

      const maxW = layer.maxWidth ? (layer.maxWidth / 100) * width : undefined;
      const renderText = layer.isAllCaps ? (layer.text || "").toUpperCase() : (layer.text || "");

      if (layer.strokeWidth > 0) {
        ctx.strokeText(renderText, scaledX, scaledY, maxW);
      }
      ctx.fillText(renderText, scaledX, scaledY, maxW);
      ctx.restore();
    });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/png");
    });
  };

  // --- Final Publish & Save Workflow ---
  const handlePublishSubmit = async (doDownload, doPublish) => {
    // --- CASE A: DOWNLOAD ONLY FLOW (Bypass cloud database & validations) ---
    if (!doPublish) {
      if (!doDownload) return;
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
          if (textLayers.length === 0 && gifUrl) {
            // No text overlays to burn in — keep the GIF animated instead of flattening to a PNG
            const a = document.createElement("a");
            a.download = `${title.trim() || "gif_meme"}.gif`;
            a.href = gifUrl;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } else {
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
          }
        } else if (activeTab === "video") {
          try {
            setIsTrimming(true);
            setFfmpegProgress(0);
            const sourceUrl = videoFile ? URL.createObjectURL(videoFile) : videoUrl;
            const compiledBlob = await compileVideoMeme({
              videoUrl: sourceUrl,
              // The Video Studio has no text-layer editor (only captions), so the
              // image editor's shared text layers must not leak into the export.
              textLayers: [],
              videoCaptions: videoCaptions,
              videoTrimStart: videoTrimStart,
              videoTrimEnd: videoTrimEnd,
              aspectRatio: aspectRatio || "16:9",
              subtitlePosition: subtitlePosition,
              onProgress: (p) => setFfmpegProgress(p / 100)
            });

            if (videoFile) {
              URL.revokeObjectURL(sourceUrl);
            }

            const url = URL.createObjectURL(compiledBlob);
            const a = document.createElement("a");
            a.download = `${title.trim() || "video_meme"}.mp4`;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch (err) {
            console.error("Compilation failed:", err);
            setAlertMessage("Failed to compile video meme.");
          } finally {
            setIsTrimming(false);
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
        setAlertMessage(err.userFacing ? err.message : "Failed to download local file.");
        if (err.userFacing) setShowSaveModal(false);
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- CASE B: PUBLISH TO COMMUNITY LIBRARY FLOW (Require authentication & fields metadata validation) ---
    if (!user) {
      setAlertMessage(
        "To contribute to the library and build credibility as an educator, you need to sign in — it only takes a moment. " +
        "You can still create and download your meme without signing in!"
      );
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

          if (doDownload) {
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
      }
      // 2. Week 6: Real video compiler → upload compiled video to Storage
      else if (activeTab === "video") {
        let videoBlob;
        try {
          setIsTrimming(true);
          setFfmpegProgress(0);
          const sourceUrl = videoFile ? URL.createObjectURL(videoFile) : videoUrl;
          videoBlob = await compileVideoMeme({
            videoUrl: sourceUrl,
            textLayers: [],
            videoCaptions: videoCaptions,
            videoTrimStart: videoTrimStart,
            videoTrimEnd: videoTrimEnd,
            aspectRatio: aspectRatio || "16:9",
            subtitlePosition: subtitlePosition,
            onProgress: (p) => setFfmpegProgress(p / 100)
          });
          if (videoFile) {
            URL.revokeObjectURL(sourceUrl);
          }
        } catch (compileErr) {
          console.warn("video compilation failed, falling back to raw source:", compileErr);
          const res = await fetch(videoUrl);
          videoBlob = await res.blob();
        } finally {
          setIsTrimming(false);
        }

        const storageRef = ref(storage, `memes/${user.uid}_meme_${Date.now()}.mp4`);
        const snapshot = await uploadBytes(storageRef, videoBlob);
        fileUrl = await getDownloadURL(snapshot.ref);

        if (doDownload) {
          // Local download of compiled video
          const compiledUrl = URL.createObjectURL(videoBlob);
          const link = document.createElement("a");
          link.download = `${title.trim() || 'meme'}.mp4`;
          link.href = compiledUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(compiledUrl);
        }
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

              if (doDownload) {
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
            }
          } catch (cardErr) {
            console.warn("Audiogram card generation failed, using raw audio URL:", cardErr);
            fileUrl = audioFileUrl;
          }
        } else {
          fileUrl = audioFileUrl;
        }
      }
      // 4. GIF: upload the animated file as-is. Only flatten to a PNG (via html2canvas)
      //    when text overlays need to be burned in — otherwise the published/downloaded
      //    meme stays a real animated GIF instead of a frozen frame.
      else if (activeTab === "gif") {
        if (gifFile) {
          const storageRef = ref(storage, `memes/${user.uid}_gif_${Date.now()}.gif`);
          const snapshot = await uploadBytes(storageRef, gifFile);
          fileUrl = await getDownloadURL(snapshot.ref);
        }

        if (textLayers.length > 0) {
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

                if (doDownload) {
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
              }
            } catch (err) {
              console.error("html2canvas screenshot failed", err);
            }
          }
        } else if (doDownload) {
          // No overlays — download the original animated GIF unmodified
          const link = document.createElement("a");
          link.download = `${title.trim() || 'meme'}.gif`;
          link.href = fileUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
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
      setAlertMessage(
        err.userFacing
          ? err.message
          : `Failed to save and publish the creation: ${err.code || err.message || "Unknown error"}`
      );
      if (err.userFacing) setShowSaveModal(false);
    } finally {
      setLoading(false);
    }
  };

  // --- Meme Story Fetch ---
  const fetchStoryForTemplate = async (templateId) => {
    setMemeStoryModal(prev => ({ ...prev, loading: true }));
    try {
      const q = query(
        collection(db, "resources"),
        where("template_id", "==", templateId)
      );
      const snap = await getDocs(q);
      const matchingDoc = snap.docs.find(d => {
        const t = d.data().type;
        return t === "stories" || t === "story" || d.data().uploadType === "stories";
      }) || (snap.empty ? null : snap.docs[0]);

      const story = matchingDoc ? { id: matchingDoc.id, ...matchingDoc.data() } : null;
      setMemeStoryModal(prev => ({ ...prev, loading: false, story }));
    } catch (err) {
      console.error("Story fetch failed", err);
      setMemeStoryModal(prev => ({ ...prev, loading: false, story: null }));
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

      const templateDocRef = await addDoc(collection(db, "templates"), {
        title: templateTitle || "Blank Background Template",
        creator_id: user.uid,
        media_url: fileUrl,
        format: detectedFormat,
        is_admin_preset: false,
        status: "pending", // Baseline schema requirement to lock visibility from editor
        created_at: serverTimestamp()
      });

      // Optionally attach a meme story to this template contribution
      if (includeStory && (templateTitle.trim() || storyOrigin.trim())) {
        let uploadedExampleUrls = [];
        if (storyExampleFiles.length > 0) {
          for (let i = 0; i < storyExampleFiles.length; i++) {
            const exFile = storyExampleFiles[i];
            if (exFile) {
              const exRef = ref(storage, `resources/examples_${user.uid}_${Date.now()}_${i}`);
              const exSnap = await uploadBytes(exRef, exFile);
              const exUrl = await getDownloadURL(exSnap.ref);
              uploadedExampleUrls.push(exUrl);
            }
          }
        }
        await addDoc(collection(db, "resources"), {
          type: "stories",
          title: templateTitle.trim() || "Blank Background Template",
          meme_name: templateTitle.trim() || "Blank Background Template",
          body: storyOrigin.trim(),
          usage_context: storyUsageContext.trim(),
          educational_use: storyEducationalUse.trim(),
          example_images: uploadedExampleUrls,
          template_id: templateDocRef.id,
          author_id: user.uid,
          status: "live",
          admin_approved: false,
          likes_count: 0,
          flag_count: 0,
          view_count: 0,
          created_at: serverTimestamp()
        });
      }

      setTemplateSuccess(includeStory && templateTitle.trim() ? "Template + meme story contributed! Awaiting Admin approval." : "Template contributed successfully! Awaiting Admin approval.");
      setTemplateTitle("");
      setTemplateFile(null);
      setIncludeStory(false);
      setStoryOrigin("");
      setStoryUsageContext("");
      setStoryEducationalUse("");
      setStoryExampleImages([""]);
      setStoryExampleFiles([]);
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
    <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6 py-3 flex flex-col min-h-[calc(100vh-70px)] pb-16 bg-[#FAFAF9] dark:bg-[#090D16] text-slate-800 dark:text-white transition-colors duration-200" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>

      {/* ── TOP STUDIO WORKBENCH NAVIGATION BAR ─────────────────────────── */}
      <div className="bg-white dark:bg-[#0e131f] border border-slate-200/80 dark:border-[#1b2336] text-slate-800 dark:text-white rounded-2xl p-2.5 sm:p-3 mb-3 flex flex-wrap items-center justify-between gap-3 shadow-sm dark:shadow-lg transition-colors duration-200 select-none">
        {/* Left section: Studio Brand + Unified Format Tabs */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-rose-50 dark:bg-[#250a18] border border-rose-200 dark:border-[#e11d48]/40 rounded-full text-xs font-black tracking-wider text-[#e11d48] dark:text-[#f43f5e] shadow-xs">
            <span className="text-sm">🎨</span>
            <span>MEME STUDIO</span>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-[#1e273a] hidden sm:block" />

          {/* Format Switcher Tabs */}
          <div className="flex bg-slate-100 dark:bg-[#111624] p-1 rounded-xl border border-slate-200 dark:border-[#1e273a] gap-1 shadow-inner">
            {[
              { id: "image", label: "Image", icon: <ImageIcon className="w-3.5 h-3.5" /> },
              { id: "video", label: "Video", icon: <VideoIcon className="w-3.5 h-3.5" /> },
              { id: "gif", label: "GIF", icon: <Smile className="w-3.5 h-3.5" /> },
              { id: "audio", label: "Audio", icon: <Music className="w-3.5 h-3.5" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setAlertMessage(""); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-[#e11d48] text-white shadow-md shadow-[#e11d48]/25 font-bold scale-[1.02]"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-[#1b2336] font-semibold"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right section: Global Actions (Undo/Redo, AI Punchlines, Export) */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Undo / Redo */}
          <div className="flex items-center bg-slate-100 dark:bg-[#111624] p-1 rounded-xl border border-slate-200 dark:border-[#1e273a] gap-0.5 shadow-inner">
            <button
              type="button"
              onClick={undoTextLayers}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-25 rounded-lg hover:bg-slate-200/70 dark:hover:bg-[#1e273a] transition"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={redoTextLayers}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-25 rounded-lg hover:bg-slate-200/70 dark:hover:bg-[#1e273a] transition"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => { setAiError(""); setShowAiPunchlinesModal(true); }}
            className="bg-slate-100 dark:bg-[#111624] hover:bg-slate-200/80 dark:hover:bg-[#1e273a] text-slate-800 dark:text-white border border-slate-200 dark:border-[#1e273a] hover:border-[#e11d48]/60 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs active:scale-95"
          >
            <span className="text-[#f43f5e]">⚡</span>
            <span>AI Punchlines</span>
          </button>

          {/* Single Vibrant Neon Pink Export Button matching screenshot */}
          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            className="bg-[#e11d48] hover:bg-[#f43f5e] text-white font-extrabold text-xs px-4.5 py-2 rounded-xl shadow-lg shadow-[#e11d48]/30 hover:shadow-[#e11d48]/50 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
            title="Export & publish your meme composition"
          >
            <Download className="w-4 h-4" strokeWidth={2.2} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {alertMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-medium text-xs">
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
            <p className="text-gray-400 text-xs">{Math.round(ffmpegProgress * 100)}% — processing media</p>
          </div>
        </div>
      )}

      {/* ── TWO-COLUMN SAAS WORKSTATION LAYOUT ── */}
      {/* On lg+ this is a two-column grid: the canvas on the left and a single
          tabbed side panel (Editor / Templates) on the right. Below lg everything
          stacks: canvas, tab bar, then whichever panel is active. */}
      <div className="flex-1 flex flex-col gap-4 w-full min-h-[calc(100vh-140px)] lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_auto] lg:content-start lg:gap-x-4 lg:gap-y-3">

        {/* ── LEFT COLUMN: COMPACT CANVAS BOX + BOTTOM CONTROLS CARD ── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 lg:contents">

          {/* 1. COMPACT CANVAS AREA BOX (Reduced height & size for optimal viewport fit) */}
          <div
            id="lab-canvas-area"
            className="lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:self-start bg-slate-100/90 dark:bg-[#0b0e14] border border-slate-200 dark:border-[#1b2336] rounded-2xl shadow-sm relative flex items-center justify-center p-2.5 sm:p-3 min-h-[260px] lg:min-h-[280px] overflow-hidden select-none"
            style={{
              backgroundImage: highContrastMode
                ? "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)"
                : "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
              backgroundSize: "20px 20px"
            }}
          >
            {/* Floating Bottom-Left: Zoom Controls Capsule (Image Canvas Only) */}
            {activeTab === "image" && (
              <div className="absolute bottom-3 left-3 z-30 flex items-center gap-1.5 bg-white/90 dark:bg-[#101626]/90 backdrop-blur-md border border-slate-200 dark:border-[#1e273d] px-2.5 py-1.5 rounded-xl shadow-md text-xs font-semibold text-slate-700 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
                  className="w-5 h-5 flex items-center justify-center hover:text-rose-600 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 transition text-sm font-bold"
                  title="Zoom Out"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className="hover:text-rose-600 dark:hover:text-white transition px-1 text-[11px] font-bold"
                  title="Reset Zoom"
                >
                  {zoomLevel}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(200, prev + 10))}
                  className="w-5 h-5 flex items-center justify-center hover:text-rose-600 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800/60 transition text-sm font-bold"
                  title="Zoom In"
                >
                  +
                </button>
                <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className="p-0.5 text-slate-500 hover:text-rose-600 dark:hover:text-white transition"
                  title="Fit Canvas"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Floating Right: Aspect Ratio Capsule & BG Color Picker (Image Canvas Only) */}
            {activeTab === "image" && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 bg-white/90 dark:bg-[#101626]/90 backdrop-blur-md border border-slate-200 dark:border-[#1e273d] p-1.5 rounded-xl shadow-md">
                {["1:1", "16:9", "9:16", "4:3"].map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setCanvasAspect(ratio)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all ${
                      canvasAspect === ratio
                        ? "bg-gradient-to-r from-[#e11d48] to-[#f43f5e] text-white shadow-xs scale-105"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
                <div className="w-full h-px bg-slate-200 dark:bg-slate-800 my-0.5" />
                <label className="flex items-center justify-center gap-1 cursor-pointer py-0.5 px-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition text-[10px] font-bold text-slate-600 dark:text-slate-400" title="Canvas Background Color">
                  <span className="text-[9px]">BG</span>
                  <div
                    className="w-3.5 h-3.5 rounded border border-slate-400 dark:border-slate-600 relative overflow-hidden shadow-xs"
                    style={{ backgroundColor: canvasBg }}
                  >
                    <input
                      type="color"
                      value={canvasBg}
                      onChange={(e) => setCanvasBg(e.target.value)}
                      className="opacity-0 absolute inset-0 cursor-pointer"
                    />
                  </div>
                </label>
              </div>
            )}

            {/* Canvas Viewport (Reduced max-width & max-height) */}
            <div
              style={{
                transform: activeTab === "image" ? `scale(${zoomLevel / 100})` : undefined,
                transition: "transform 0.15s ease-out"
              }}
              className={`flex items-center justify-center ${activeTab === "video" ? "w-full h-full" : "max-w-full max-h-full"}`}
            >
              {activeTab === "video" ? (
                <div className="w-full h-full min-h-[320px] shadow-lg rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col">
                  <ClassicVideoEditor
                    videoUrl={videoUrl}
                    videoFile={videoFile}
                    videoDuration={videoDuration}
                    videoCurrentTime={videoCurrentTime}
                    setVideoCurrentTime={setVideoCurrentTime}
                    videoTrimStart={videoTrimStart}
                    setVideoTrimStart={setVideoTrimStart}
                    videoTrimEnd={videoTrimEnd}
                    setVideoTrimEnd={setVideoTrimEnd}
                    videoCaptions={videoCaptions}
                    setVideoCaptions={setVideoCaptions}
                    activeVideoCaptionText={activeVideoCaptionText}
                    aspectRatio={aspectRatio}
                    setAspectRatio={setAspectRatio}
                    videoSubTab={videoSubTab}
                    setVideoSubTab={setVideoSubTab}
                    videoMuted={videoMuted}
                    setVideoMuted={setVideoMuted}
                    videoLoop={videoLoop}
                    setVideoLoop={setVideoLoop}
                    subtitlePosition={subtitlePosition}
                    setSubtitlePosition={setSubtitlePosition}
                    videoPlayerRef={videoPlayerRef}
                    timelineTrackRef={timelineTrackRef}
                    handleVideoUpload={handleVideoUpload}
                    handleAddCaptionAtCurrentTime={handleAddCaptionAtCurrentTime}
                    handleDeleteCaptionIndex={handleDeleteCaptionIndex}
                    handleEditCaptionText={handleEditCaptionText}
                    handleSplitVideoAtCurrentTime={handleSplitVideoAtCurrentTime}
                    selectMediaPreset={selectMediaPreset}
                    parseCaptionLines={parseCaptionLines}
                    formatTime={formatTime}
                    rebuildCaptionsString={rebuildCaptionsString}
                    handleDropzoneDrop={handleDropzoneDrop}
                    isDragOverDropzone={isDragOverDropzone}
                    setIsDragOverDropzone={setIsDragOverDropzone}
                  />
                </div>
              ) : (
                <div
                  ref={canvasContainerRef}
                  className={`relative w-full max-w-[340px] max-h-[40vh] sm:max-h-[300px] ${
                    activeTab === "image"
                      ? (ASPECT_RATIOS[canvasAspect]?.css || "aspect-square")
                      : activeTab === "audio"
                      ? "aspect-[16/10] max-w-[420px]"
                      : "aspect-square"
                  } flex items-center justify-center select-none shadow-xl border border-slate-300 dark:border-[#1b2336] rounded-2xl overflow-hidden`}
                  style={{
                    backgroundColor: canvasBg,
                    filter: FILTER_MAP[selectedFilter] || undefined
                  }}
                >
                  {/* Draggable Text Overlays */}
                  <div className="absolute inset-0 z-20 pointer-events-none">
                    {textLayers.map((layer) => {
                      const fontRefScale = canvasBoxWidth / TEXT_LAYER_REF_WIDTH;
                      const scaledFontSizePx = layer.fontSize * fontRefScale;
                      const scaledStrokeWidthPx = (layer.strokeWidth ?? 2) * fontRefScale;
                      return (
                      <div
                        key={layer.id}
                        onPointerDown={(e) => handleTextPointerDown(e, layer.id)}
                        onDoubleClick={() => setEditingTextId(layer.id)}
                        style={{
                          position: "absolute",
                          left: `${layer.x}%`,
                          top: `${layer.y}%`,
                          fontFamily: layer.fontFamily,
                          fontSize: `${scaledFontSizePx}px`,
                          fontWeight: layer.fontWeight || "bold",
                          fontStyle: layer.fontStyle || "normal",
                          textDecoration: layer.textDecoration || "none",
                          color: layer.color,
                          WebkitTextStroke: `${scaledStrokeWidthPx}px ${layer.strokeColor ?? "#000000"}`,
                          textShadow: textEffectShadow ? "2px 2px 8px rgba(0,0,0,0.9)" : undefined,
                          cursor: "move",
                          whiteSpace: layer.maxWidth ? "normal" : "nowrap",
                          maxWidth: layer.maxWidth ? `${layer.maxWidth}%` : undefined,
                          opacity: layer.opacity ?? 1,
                          transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                          textAlign: layer.textAlign || "center",
                          transformOrigin: "top left",
                        }}
                        className={`pointer-events-auto px-2 py-1 rounded transition select-none ${
                          selectedTextId === layer.id
                            ? "border-2 border-dashed border-[#e11d48] ring-2 ring-[#e11d48]/50 bg-[#e11d48]/10"
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
                            className="bg-black/90 text-white px-1 text-sm rounded border border-[#e11d48] focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          layer.text
                        )}
                        {selectedTextId === layer.id && (
                          <>
                            <div
                              onPointerDown={(e) => handleResizePointerDown(e, layer.id, "nw")}
                              className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-[#e11d48] border-2 border-white rounded-full cursor-nw-resize z-30 shadow-md hover:scale-125 transition"
                              title="Drag to resize text"
                            />
                            <div
                              onPointerDown={(e) => handleResizePointerDown(e, layer.id, "ne")}
                              className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#e11d48] border-2 border-white rounded-full cursor-ne-resize z-30 shadow-md hover:scale-125 transition"
                              title="Drag to resize text"
                            />
                            <div
                              onPointerDown={(e) => handleResizePointerDown(e, layer.id, "sw")}
                              className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-[#e11d48] border-2 border-white rounded-full cursor-sw-resize z-30 shadow-md hover:scale-125 transition"
                              title="Drag to resize text"
                            />
                            <div
                              onPointerDown={(e) => handleResizePointerDown(e, layer.id, "se")}
                              className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-[#e11d48] border-2 border-white rounded-full cursor-se-resize z-30 shadow-md hover:scale-125 transition"
                              title="Drag to resize text"
                            />
                          </>
                        )}
                      </div>
                      );
                    })}
                  </div>

                  {activeTab === "image" && (
                    <div className="w-full h-full flex flex-col">
                      {images.length > 0 ? (
                        images.length === 1 || collageLayout === "single" ? (
                          <div className="w-full h-full" style={{ userSelect: "none" }}>
                            <img
                              src={images[0]}
                              alt="Meme visual"
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
                                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                    />
                                  </div>
                                  {!isLast && (
                                    <div
                                      style={{
                                        width: "6px",
                                        flexShrink: 0,
                                        cursor: "col-resize",
                                        background: "rgba(225,29,72,0.5)",
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
                                        const containerW = canvasContainerRef.current?.offsetWidth || 400;
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
                                    >
                                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 2, height: 20, background: "rgba(255,255,255,0.7)", borderRadius: 2 }} />
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
                                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                    />
                                  </div>
                                  {!isLast && (
                                    <div
                                      style={{
                                        height: "6px",
                                        flexShrink: 0,
                                        cursor: "row-resize",
                                        background: "rgba(225,29,72,0.5)",
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
                                        const containerH = canvasContainerRef.current?.offsetHeight || 380;
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
                                    >
                                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 20, height: 2, background: "rgba(255,255,255,0.7)", borderRadius: 2 }} />
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        ) : collageLayout === "grid" ? (
                          <div className="w-full h-full flex flex-col" style={{ userSelect: "none" }}>
                            {/* Top Row */}
                            <div style={{ flexGrow: 1, display: "flex", position: "relative", minHeight: 0 }}>
                              <div style={{ width: `${gridSplit.topX * 100}%`, flexShrink: 0, position: "relative", height: "100%", overflow: "hidden" }}>
                                <img src={images[0]} alt="Grid 1" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                              <div
                                style={{ width: "6px", cursor: "col-resize", background: "rgba(225,29,72,0.5)", zIndex: 25, position: "relative", flexShrink: 0 }}
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  collageDragRef.current = { active: true, type: "grid-v-top", startX: e.clientX, startSplit: { ...gridSplit } };
                                  const containerW = canvasContainerRef.current?.offsetWidth || 400;
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
                                <img src={images[1] || images[0]} alt="Grid 2" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                            </div>

                            {/* Horizontal divider */}
                            <div
                              style={{ height: "6px", cursor: "row-resize", background: "rgba(225,29,72,0.5)", zIndex: 25, position: "relative", flexShrink: 0 }}
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                collageDragRef.current = { active: true, type: "grid-h", startY: e.clientY, startSplit: { ...gridSplit } };
                                const containerH = canvasContainerRef.current?.offsetHeight || 380;
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
                                <img src={images[2] || images[0]} alt="Grid 3" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                              <div
                                style={{ width: "6px", cursor: "col-resize", background: "rgba(225,29,72,0.5)", zIndex: 25, position: "relative", flexShrink: 0 }}
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  collageDragRef.current = { active: true, type: "grid-v-bottom", startX: e.clientX, startSplit: { ...gridSplit } };
                                  const containerW = canvasContainerRef.current?.offsetWidth || 400;
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
                                <img src={images[3] || images[1] || images[0]} alt="Grid 4" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex" style={{ userSelect: "none" }}>
                            {images.map((src, idx) => (
                              <img key={idx} src={src} alt="Fallback" className="flex-1 object-contain" />
                            ))}
                          </div>
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-center w-full h-full select-none">
                          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-[#1b2336] border border-rose-200 dark:border-[#e11d48]/30 flex items-center justify-center mb-3 shadow-xs text-[#e11d48] dark:text-[#f43f5e]">
                            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="font-bold text-sm mb-1 text-slate-800 dark:text-slate-200">Start Your Meme Creation</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                            Choose a template from the database on the right or upload your own media.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowLibraryPickerModal(true)}
                              className="px-3.5 py-1.5 rounded-xl bg-[#e11d48] hover:bg-[#f43f5e] text-white text-xs font-bold shadow-md shadow-[#e11d48]/20 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                            >
                              <span>+</span>
                              <span>Browse Templates</span>
                            </button>
                            <label className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#111624] border border-slate-200 dark:border-[#1e273a] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition flex items-center gap-1.5 active:scale-95 cursor-pointer">
                              <span>⬆️</span>
                              <span>Upload Image</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "gif" && (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-black/90">
                      {gifUrl ? (
                        <img
                          src={gifUrl}
                          alt="Active GIF Loop"
                          className="w-full max-h-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 w-full h-full">
                          <p className="font-bold text-xs mb-1 text-slate-700 dark:text-slate-300">GIF Canvas Empty</p>
                          <p className="text-[11px] text-slate-500 max-w-xs">Select a looping GIF reaction template.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "audio" && (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 gap-3 overflow-y-auto">
                      {audioUrl ? (
                        <>
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
                          <audio
                            ref={audioPlayerRef}
                            src={audioUrl}
                            controls
                            className="w-full max-w-xs mt-1"
                          />
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 w-full h-full">
                          <p className="font-bold text-xs mb-1 text-slate-300">Audio Workspace Empty</p>
                          <p className="text-[11px] text-slate-500 max-w-xs">Select an audio template or upload an MP3.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* WORKSPACE PANEL TABS: Editor | Templates (one panel visible at a time) */}
          {activeTab !== "video" && (
            <div
              role="tablist"
              aria-label="Workspace panel"
              className="lg:col-start-2 lg:row-start-1 grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-[#0b0e14] border border-slate-200/80 dark:border-[#1b2336]"
            >
              {[
                { id: "editor", label: "Editor", icon: <Sliders className="w-3.5 h-3.5" /> },
                { id: "templates", label: "Templates", icon: <LayoutGrid className="w-3.5 h-3.5" /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`lab-panel-tab-${tab.id}`}
                  aria-selected={panelTab === tab.id}
                  aria-controls={`lab-panel-${tab.id}`}
                  onClick={() => setSidePanelTab(tab.id)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e11d48]/60 ${
                    panelTab === tab.id
                      ? "bg-white dark:bg-[#1b2336] text-[#e11d48] dark:text-white shadow-sm ring-1 ring-[#e11d48]/40"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-[#111624]"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
              <style>{`
                @keyframes labPanelIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
                .lab-panel-in { animation: labPanelIn 0.22s ease-out; }
                @media (prefers-reduced-motion: reduce) { .lab-panel-in { animation: none; } }
              `}</style>
            </div>
          )}

          {/* 2. BOTTOM CONTROLS CARD (the "Editor" tab panel) */}
          <div
            role="tabpanel"
            id="lab-panel-editor"
            aria-labelledby="lab-panel-tab-editor"
            className={`${panelTab !== "editor" ? "hidden " : "lab-panel-in "}lg:col-start-2 lg:row-start-2 lg:self-start bg-white dark:bg-[#0e131f] border border-slate-200/80 dark:border-[#1b2336] rounded-2xl p-4 shadow-sm dark:shadow-xl flex flex-col gap-3 text-slate-800 dark:text-white transition-colors duration-200`}
          >
            {/* Controls Tabs Navigation */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 lg:gap-1 border-b border-slate-100 dark:border-[#1b2336] pb-3">
              {[
                { id: "text", label: "Text", icon: <Type className="w-3.5 h-3.5" /> },
                { id: "image", label: "Image", icon: <ImageIcon className="w-3.5 h-3.5" /> },
                { id: "filters", label: "Filters", icon: <Palette className="w-3.5 h-3.5" /> },
                { id: "effects", label: "Effects", icon: <Sliders className="w-3.5 h-3.5" /> }
              ].filter((tab) => tab.id !== "text" || activeTab === "image").map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveControlTab(tab.id)}
                  className={`flex items-center gap-1 px-1.5 flex-1 justify-center sm:gap-1.5 sm:px-4 sm:flex-none sm:justify-start lg:gap-1 lg:px-1.5 lg:flex-1 lg:justify-center py-2 rounded-xl text-xs font-bold transition-all ${
                    activeControlTab === tab.id
                      ? "bg-[#e11d48] text-white shadow-md shadow-[#e11d48]/25 font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#111624]"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* TAB CONTENT: TEXT */}
            {activeControlTab === "text" && activeTab === "image" && (
              <div className="flex flex-col gap-3">
                {/* Row 1: Top Text & Bottom Text Inputs with Clear/Delete buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Top Text
                      </label>
                      {topTextInput && (
                        <button
                          type="button"
                          onClick={deleteTopText}
                          className="text-[10px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-bold flex items-center gap-1 hover:underline transition"
                          title="Delete / Clear Top Text"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={topTextInput}
                        onChange={(e) => handleTopTextChange(e.target.value)}
                        placeholder="e.g. FINISHED ASSIGNMENT BEFORE DEADLINE"
                        className="w-full bg-slate-50 dark:bg-[#111624] border border-slate-200 dark:border-[#1e273a] focus:border-[#e11d48] rounded-xl pl-3.5 pr-8 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-bold focus:outline-none focus:ring-1 focus:ring-[#e11d48] transition shadow-inner"
                      />
                      {topTextInput && (
                        <button
                          type="button"
                          onClick={deleteTopText}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 p-0.5"
                          title="Clear text"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Bottom Text
                      </label>
                      {bottomTextInput && (
                        <button
                          type="button"
                          onClick={deleteBottomText}
                          className="text-[10px] text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-bold flex items-center gap-1 hover:underline transition"
                          title="Delete / Clear Bottom Text"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={bottomTextInput}
                        onChange={(e) => handleBottomTextChange(e.target.value)}
                        placeholder="e.g. REALIZES THERE'S A PRESENTATION LEFT"
                        className="w-full bg-slate-50 dark:bg-[#111624] border border-slate-200 dark:border-[#1e273a] focus:border-[#e11d48] rounded-xl pl-3.5 pr-8 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-bold focus:outline-none focus:ring-1 focus:ring-[#e11d48] transition shadow-inner"
                      />
                      {bottomTextInput && (
                        <button
                          type="button"
                          onClick={deleteBottomText}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 p-0.5"
                          title="Clear text"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Font Dropdown, Size Dropdown, Color Circles, Style Buttons, Add & Delete text buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {/* Font Select */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Font:</span>
                    <select
                      onChange={(e) => handleFontChange(e.target.value)}
                      defaultValue="Impact, sans-serif"
                      className="bg-slate-50 dark:bg-[#111624] border border-slate-200 dark:border-[#1e273a] text-xs text-slate-800 dark:text-white font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#e11d48] cursor-pointer"
                    >
                      <option value="Impact, sans-serif">Impact</option>
                      <option value="Montserrat, sans-serif">Montserrat</option>
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="'Comic Sans MS', cursive">Comic Sans</option>
                      <option value="'Bebas Neue', sans-serif">Bebas Neue</option>
                      <option value="'Anton', sans-serif">Anton</option>
                      <option value="Courier New, monospace">Courier New</option>
                    </select>
                  </div>

                  {/* Size Select */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Size:</span>
                    <select
                      onChange={(e) => handleFontSizeChange(e.target.value)}
                      defaultValue="Large"
                      className="bg-slate-50 dark:bg-[#111624] border border-slate-200 dark:border-[#1e273a] text-xs text-slate-800 dark:text-white font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#e11d48] cursor-pointer"
                    >
                      <option value="Small">Small (18px)</option>
                      <option value="Medium">Medium (24px)</option>
                      <option value="Large">Large (30px)</option>
                      <option value="Extra Large">XL (38px)</option>
                      <option value="48">XXL (48px)</option>
                    </select>
                  </div>

                  <div className="h-5 w-px bg-slate-200 dark:bg-[#1e273a] hidden sm:block lg:hidden" />

                  {/* Color Circular Swatches */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Color:</span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { color: "#ffffff", title: "White" },
                        { color: "#000000", title: "Black" },
                        { color: "#f43f5e", title: "Pink" },
                        { color: "#facc15", title: "Yellow" },
                        { color: "#38bdf8", title: "Sky Blue" },
                        { color: "#4ade80", title: "Green" },
                        { color: "#ef4444", title: "Red" }
                      ].map((item) => (
                        <button
                          key={item.color}
                          type="button"
                          onClick={() => handleColorChange(item.color)}
                          title={item.title}
                          className="w-5 h-5 rounded-full border border-slate-300 dark:border-white/20 hover:scale-125 transition-transform shadow-xs cursor-pointer"
                          style={{ backgroundColor: item.color }}
                        />
                      ))}
                      {/* Rainbow / Custom Color Picker */}
                      <label
                        className="w-5 h-5 rounded-full border border-slate-300 dark:border-white/30 cursor-pointer flex items-center justify-center overflow-hidden hover:scale-125 transition-transform shadow-xs relative"
                        style={{
                          background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)"
                        }}
                        title="Custom Color"
                      >
                        <input
                          type="color"
                          onChange={(e) => handleColorChange(e.target.value)}
                          className="opacity-0 absolute inset-0 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="h-5 w-px bg-slate-200 dark:bg-[#1e273a] hidden sm:block lg:hidden" />

                  {/* Style Toggle Buttons: [B] [I] [U] [↻] */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#111624] p-1 rounded-xl border border-slate-200 dark:border-[#1e273a]">
                    <button
                      type="button"
                      onClick={() => handleStyleToggle("bold")}
                      className={`w-7 h-7 flex items-center justify-center font-black text-xs rounded-lg transition ${
                        (selectedTextId ? activeTextLayer?.fontWeight === "bold" : textLayers.some(l => l.fontWeight === "bold"))
                          ? "bg-[#e11d48]/25 border border-[#e11d48] text-[#e11d48] dark:text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1b2336]"
                      }`}
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStyleToggle("italic")}
                      className={`w-7 h-7 flex items-center justify-center italic font-bold text-xs rounded-lg transition ${
                        (selectedTextId ? activeTextLayer?.fontStyle === "italic" : textLayers.some(l => l.fontStyle === "italic"))
                          ? "bg-[#e11d48]/25 border border-[#e11d48] text-[#e11d48] dark:text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1b2336]"
                      }`}
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStyleToggle("underline")}
                      className={`w-7 h-7 flex items-center justify-center underline font-bold text-xs rounded-lg transition ${
                        (selectedTextId ? activeTextLayer?.textDecoration === "underline" : textLayers.some(l => l.textDecoration === "underline"))
                          ? "bg-[#e11d48]/25 border border-[#e11d48] text-[#e11d48] dark:text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1b2336]"
                      }`}
                      title="Underline"
                    >
                      U
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStyleToggle("uppercase")}
                      className="w-7 h-7 flex items-center justify-center text-[10px] font-black tracking-tighter text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1b2336] rounded-lg transition"
                      title="Toggle All-Caps"
                    >
                      Aa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTextLayers(prev => prev.map(l => {
                          if (l.role === "top" || l.id === "txt-top") {
                            return { ...l, x: DEFAULT_TOP_LAYER.x, y: DEFAULT_TOP_LAYER.y, rotation: 0 };
                          }
                          if (l.role === "bottom" || l.id === "txt-bottom") {
                            return { ...l, x: DEFAULT_BOTTOM_LAYER.x, y: DEFAULT_BOTTOM_LAYER.y, rotation: 0 };
                          }
                          return { ...l, rotation: 0 };
                        }));
                      }}
                      className="w-7 h-7 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1b2336] rounded-lg transition"
                      title="Reset position & rotation of all text layers (keeps your text and layer count)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Add Text Layer Button */}
                  <button
                    type="button"
                    onClick={addNewTextLayer}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 hover:bg-rose-100 font-bold text-xs transition active:scale-95 cursor-pointer"
                    title="Add new custom text overlay"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Text</span>
                  </button>

                  {/* Clear All Text Button (Always visible delete option) */}
                  <button
                    type="button"
                    onClick={clearAllText}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 hover:border-red-300 font-bold text-xs transition active:scale-95"
                    title="Delete and clear all text captions"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Text</span>
                  </button>

                  {/* Delete Selected Layer Button */}
                  {selectedTextId && (
                    <button
                      type="button"
                      onClick={() => deleteTextLayer(selectedTextId)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-100 font-bold text-xs transition active:scale-95 ml-auto"
                      title="Delete selected text layer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Layer</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: IMAGE */}
            {activeControlTab === "image" && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Collage Layout:</span>
                {[
                  { id: "single", label: "Single" },
                  { id: "rows", label: "2 Rows (Meme)" },
                  { id: "columns", label: "2 Columns" },
                  { id: "grid", label: "4 Grid" }
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setCollageLayout(l.id);
                      if (l.id === "rows" && images.length === 1) {
                        setImages([images[0], images[0]]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                      collageLayout === l.id
                        ? "bg-[#e11d48]/15 border-[#e11d48] text-rose-600 dark:text-white"
                        : "bg-slate-100 dark:bg-[#111624] border-slate-200 dark:border-[#1e273a] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
                {images.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setImages([])}
                    className="ml-auto text-xs text-red-500 hover:text-red-700 font-bold px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 transition"
                  >
                    Clear Image
                  </button>
                )}
              </div>
            )}

            {/* TAB CONTENT: FILTERS */}
            {activeControlTab === "filters" && (
              <div className="flex flex-wrap items-center gap-2">
                {Object.keys(FILTER_MAP).map((fName) => (
                  <button
                    key={fName}
                    type="button"
                    onClick={() => setSelectedFilter(fName)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition border ${
                      selectedFilter === fName
                        ? "bg-gradient-to-r from-[#e11d48] to-[#f43f5e] text-white border-transparent shadow-xs"
                        : "bg-slate-100 dark:bg-[#111624] border-slate-200 dark:border-[#1e273a] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {fName}
                  </button>
                ))}
              </div>
            )}

            {/* TAB CONTENT: EFFECTS */}
            {activeControlTab === "effects" && (
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setTextEffectShadow(prev => !prev)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                    textEffectShadow
                      ? "bg-[#e11d48]/15 border-[#e11d48] text-rose-600 dark:text-white"
                      : "bg-slate-100 dark:bg-[#111624] border-slate-200 dark:border-[#1e273a] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Drop Shadow: {textEffectShadow ? "ON" : "OFF"}
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Stroke:</span>
                  {[
                    { label: "None", width: 0 },
                    { label: "Thin", width: 1 },
                    { label: "Bold", width: 2 },
                    { label: "Heavy", width: 4 }
                  ].map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        if (selectedTextId) {
                          updateTextLayer("strokeWidth", s.width);
                        } else {
                          setTextLayers(prev => prev.map(l => ({ ...l, strokeWidth: s.width })));
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-[#111624] border border-slate-200 dark:border-[#1e273a] text-slate-700 dark:text-slate-300 hover:text-rose-600 font-bold"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Image Effect:</span>
                  {[
                    { id: "none", label: "None" },
                    { id: "deepfry", label: "Deep Fry" },
                    { id: "blur", label: "Blur" },
                    { id: "whiteborder", label: "White Border" }
                  ].map((eff) => (
                    <button
                      key={eff.id}
                      type="button"
                      onClick={() => setActiveEffect(prev => prev === eff.id ? "none" : eff.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                        activeEffect === eff.id
                          ? "bg-[#e11d48]/15 border-[#e11d48] text-rose-600 dark:text-white"
                          : "bg-slate-100 dark:bg-[#111624] border-slate-200 dark:border-[#1e273a] text-slate-700 dark:text-slate-300 hover:text-rose-600"
                      }`}
                    >
                      {eff.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: SECTION-SPECIFIC TEMPLATES & UPLOAD SIDEBAR ── */}
        {/* Also the "Templates" tab panel: hidden while the Editor tab is active. */}
        <div
          role="tabpanel"
          id="lab-panel-templates"
          aria-labelledby="lab-panel-tab-templates"
          className={`${panelTab !== "templates" ? "hidden " : "lab-panel-in "}w-full min-w-0 flex flex-col gap-3.5 lg:col-start-2 lg:self-start ${
            activeTab === "video" ? "lg:row-start-1 lg:row-span-2" : "lg:row-start-2"
          }`}
        >
          <div className="bg-white dark:bg-[#0e131f] border border-slate-200/80 dark:border-[#1b2336] rounded-2xl p-4 shadow-sm dark:shadow-xl flex flex-col gap-3.5 text-slate-800 dark:text-white transition-colors duration-200">

            {/* Search Templates Bar */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search templates..."
                value={templateSearchQuery}
                onChange={(e) => setTemplateSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-[#111624] border border-slate-200 dark:border-[#1e273a] focus:border-[#e11d48] rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-medium focus:outline-none focus:ring-1 focus:ring-[#e11d48] transition shadow-inner"
              />
            </div>

            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {[
                { id: "popular", label: "Popular" },
                { id: "academic", label: "Academic" },
                { id: "reactions", label: "Reactions" },
                { id: "students", label: "Students" }
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? "border border-[#e11d48] text-[#e11d48] dark:text-[#f43f5e] bg-rose-50 dark:bg-[#e11d48]/15 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#111624] border border-transparent"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
              <span className="text-slate-500 dark:text-slate-400 text-xs font-medium px-1 cursor-pointer hover:text-slate-900 dark:hover:text-white flex items-center gap-0.5">
                More ⌄
              </span>
            </div>

            {/* Live Giphy Search (GIF tab only) */}
            {activeTab === "gif" && (
              <div className="pb-1">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-2">
                  Search Giphy
                </span>
                <GiphySearch onSelect={(url) => { setGifUrl(url); setGifFile(null); }} />
              </div>
            )}

            {/* Database & Section Templates Cards in 3-Column Grid */}
            <div className="grid grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1">
              {getActiveFormatTemplates().map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectTemplatePreset(tpl)}
                  className={`group relative h-20 sm:h-22 w-full rounded-xl overflow-hidden border cursor-pointer bg-slate-100 dark:bg-[#111624] shadow-xs transition-all duration-200 hover:scale-[1.03] hover:shadow-md shrink-0 select-none ${
                    tpl.id === templateId
                      ? "border-[#e11d48] ring-2 ring-[#e11d48] shadow-[#e11d48]/20"
                      : "border-slate-200 dark:border-[#1e273a] hover:border-[#e11d48]"
                  }`}
                  title={tpl.title}
                >
                  {tpl.format === "video" ? (
                    // A video's own URL can't be an <img> source; show its first frame instead.
                    <video
                      src={`${tpl.thumbnail}#t=0.1`}
                      aria-label={tpl.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      preload="metadata"
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={tpl.thumbnail}
                      alt={tpl.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />

                  {/* Format Pill */}
                  <div className="absolute top-1 left-1 z-20">
                    <span className="bg-black/65 backdrop-blur-xs text-white text-[8px] font-bold uppercase px-1 py-0.5 rounded shadow pointer-events-none">
                      {tpl.format || activeTab}
                    </span>
                  </div>

                  {/* Bottom Title Bar */}
                  <div className="absolute inset-x-0 bottom-0 p-1 z-10">
                    <span className="text-[9px] font-bold text-white truncate block w-full leading-tight drop-shadow-sm">
                      {tpl.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Browse More Templates Button */}
            <button
              type="button"
              onClick={() => setShowLibraryPickerModal(true)}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-[#1e273a] bg-slate-50 dark:bg-[#111624] hover:bg-slate-100 dark:hover:bg-[#1b2336] hover:border-[#e11d48] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer"
              title="Browse every template that has a meme story"
            >
              <span>+</span>
              <span>Browse More Templates</span>
            </button>

            {/* Upload Media Dashed Dropzone */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Upload Media
              </span>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOverDropzone(true); }}
                onDragLeave={() => setIsDragOverDropzone(false)}
                onDrop={handleDropzoneDrop}
                className={`border-2 border-dashed rounded-xl p-4 text-center transition relative flex flex-col items-center justify-center gap-1.5 ${
                  isDragOverDropzone
                    ? "border-[#e11d48] bg-rose-50/60 dark:bg-[#e11d48]/10"
                    : "border-slate-300 dark:border-[#1e273a] bg-slate-50/60 dark:bg-[#0b0e14]/60 hover:border-[#e11d48]/60"
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*"
                  onChange={handleSidebarFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-[#1b2336] flex items-center justify-center text-[#e11d48] dark:text-[#f43f5e]">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Drag and drop an image, video or audio file here,
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">or</p>
                </div>
                <button
                  type="button"
                  className="bg-[#e11d48] hover:bg-[#f43f5e] text-white text-xs font-bold px-5 py-1.5 rounded-xl shadow-md shadow-[#e11d48]/25 transition pointer-events-none"
                >
                  Choose File
                </button>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  Supports: JPG, PNG, GIF, MP4, WEBP (Max 10MB)
                </span>
              </div>
            </div>

            {/* Contribute Template */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Contribute Template
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    setAlertMessage("Please sign in to contribute a template to the library.");
                    return;
                  }
                  setShowContributeModal(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-[#1e273a] bg-slate-50/60 dark:bg-[#0b0e14]/60 hover:border-[#e11d48]/60 hover:bg-rose-50/60 dark:hover:bg-[#e11d48]/10 text-slate-600 dark:text-slate-400 hover:text-[#e11d48] dark:hover:text-[#f43f5e] text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                title="Share a new template with the community library"
              >
                <span>+</span>
                <span>Contribute a Template</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* SAVE MODAL DIALOG */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-xl overflow-y-auto max-h-[90vh] ${containerClass}`}>
            <h2 className="text-lg font-bold mb-1">Export Meme</h2>
            <p className="text-xs text-gray-500 mb-5">
              Give your creation a title, choose how you'd like to export it, then confirm below.
            </p>

            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Meme Title</label>
              <input
                type="text"
                placeholder="e.g. Mitosis Explanation Meme"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
              />
            </div>

            <div className="flex flex-col gap-2.5 mb-5">
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={downloadLocally}
                  onChange={(e) => setDownloadLocally(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-purple-600 cursor-pointer"
                />
                <span className="text-xs">
                  <span className="block font-bold text-gray-700 dark:text-gray-200">📥 Download to my device</span>
                  <span className="block text-[11px] text-gray-500 mt-0.5">Save the exported file locally.</span>
                </span>
              </label>

              <label className={`flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 ${user ? "cursor-pointer" : "opacity-60 cursor-not-allowed"}`}>
                <input
                  type="checkbox"
                  checked={!!user && publishToLibrary}
                  onChange={(e) => setPublishToLibrary(e.target.checked)}
                  disabled={!user}
                  className="mt-0.5 w-4 h-4 accent-purple-600 cursor-pointer"
                />
                <span className="text-xs">
                  <span className="block font-bold text-gray-700 dark:text-gray-200">🚀 Publish to the community library</span>
                  <span className="block text-[11px] text-gray-500 mt-0.5">
                    {user ? (
                      "Share it publicly and earn contributor points."
                    ) : (
                      <>
                        <button type="button" onClick={() => { setShowSaveModal(false); navigate("/auth"); }} className="text-purple-500 hover:underline font-semibold">Sign in</button>
                        {" "}to publish to the library.
                      </>
                    )}
                  </span>
                </span>
              </label>
            </div>

            {user && publishToLibrary && (
              <div className="space-y-4 text-xs font-semibold mb-5">
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
            )}

            {user && publishToLibrary && (
              <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 text-center space-y-1 mb-5">
                <p className="text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed">
                  💡 <strong>Educational Fair Use:</strong> Memes created here are for non-commercial learning, teaching, and criticism (Indian Copyright Act Sec 52 & Fair Use).
                </p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 leading-relaxed">
                  Published under{" "}
                  <a
                    href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-500 hover:underline font-semibold"
                  >
                    CC BY-NC-SA 4.0
                  </a>{" "}
                  — others may share and remix non-commercially with attribution.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t pt-4 border-gray-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  const doPublish = !!user && publishToLibrary;
                  if (!downloadLocally && !doPublish) {
                    setAlertMessage("Select at least one option: Download or Publish.");
                    return;
                  }
                  if (activeTab === "video" && !videoUrl && !videoFile) {
                    setAlertMessage("Please select or upload a video before exporting.");
                    return;
                  }
                  if (doPublish && !title.trim()) {
                    setAlertMessage("Creations published to the library require a Meme Title.");
                    return;
                  }
                  handlePublishSubmit(downloadLocally, doPublish);
                }}
                disabled={loading || (!downloadLocally && !(user && publishToLibrary))}
                className="w-full bg-purple-650 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>✅</span>
                <span>Export</span>
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
              <button onClick={() => setShowTutorialModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 font-bold text-lg">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-700 dark:text-gray-300">
              <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800/40">
                <h3 className="font-bold text-purple-750 dark:text-purple-300 mb-1 text-sm flex items-center gap-1.5"><HelpCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Quick Studio Tutorial</h3>
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

      {/* MEME STORY MODAL */}
      {memeStoryModal.open && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setMemeStoryModal({ open: false, story: null, template: null, loading: false })}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-amber-200/30 dark:border-amber-700/30 bg-gradient-to-b from-amber-50 to-white dark:from-zinc-900 dark:to-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Book-themed header */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📖</span>
                <div>
                  <h3 className="text-white font-extrabold text-sm">About This Meme</h3>
                  {memeStoryModal.template && (
                    <p className="text-amber-100 text-[10px] font-semibold mt-0.5">{memeStoryModal.template.title}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setMemeStoryModal({ open: false, story: null, template: null, loading: false })}
                className="text-white/80 hover:text-white text-xl font-bold leading-none transition"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              {memeStoryModal.loading ? (
                <div className="flex flex-col items-center justify-center py-10 text-amber-600">
                  <div className="w-8 h-8 border-4 border-amber-300 border-t-amber-600 rounded-full animate-spin mb-3" />
                  <p className="text-xs font-semibold text-gray-500">Fetching the story...</p>
                </div>
              ) : memeStoryModal.story ? (
                <>
                  {/* Meme name */}
                  {memeStoryModal.story.meme_name && (
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-extrabold px-3 py-1 rounded-full border border-amber-200 dark:border-amber-700">
                        🎭 {memeStoryModal.story.meme_name}
                      </span>
                    </div>
                  )}

                  {/* Origin Story / Background section */}
                  {memeStoryModal.story.body && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                        <span>📜</span> Background
                      </h4>
                      <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                        {/* Show Read Full Story toggle for long content */}
                        {memeStoryModal.story.body.length > 280 && !storyExpanded
                          ? <>
                            <p>{memeStoryModal.story.body.slice(0, 280)}...</p>
                            <button
                              onClick={() => setStoryExpanded(true)}
                              className="text-amber-600 dark:text-amber-400 font-bold hover:underline mt-1 text-[10px]"
                            >
                              Read Full Story ↓
                            </button>
                          </>
                          : <p className="whitespace-pre-wrap">{memeStoryModal.story.body}</p>
                        }
                      </div>
                    </div>
                  )}

                  {/* Typical Meaning & Usage section */}
                  {memeStoryModal.story.usage_context && (
                    <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-4">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-2 flex items-center gap-1">
                        <span>💡</span> Typical Meaning & Usage
                      </h4>
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{memeStoryModal.story.usage_context}</p>
                    </div>
                  )}

                  {/* Educational Use section */}
                  {memeStoryModal.story.educational_use && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1">
                        <span>🎓</span> Educational Use
                      </h4>
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{memeStoryModal.story.educational_use}</p>
                    </div>
                  )}
                </>
              ) : (
                /* No story yet state */
                <div className="text-center py-8 space-y-3">
                  <div className="text-4xl">📭</div>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No story added yet</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Know this meme? Contribute its story to help others!</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-amber-100 dark:border-zinc-800 mt-1">
              <a
                href="/resources?tab=stories"
                className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
              >
                📚 Read More on Resources →
              </a>
              <button
                onClick={() => setMemeStoryModal({ open: false, story: null, template: null, loading: false })}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE CONTRIBUTION MODAL */}
      {showContributeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-xl overflow-y-auto max-h-[90vh] ${containerClass}`}>
            <div className="flex items-center justify-between border-b pb-2 mb-4 border-gray-200 dark:border-zinc-800">
              <h3 className="font-bold text-sm uppercase tracking-wider text-purple-700 dark:text-purple-400">Contribute Template to Library</h3>
              <button
                type="button"
                onClick={() => { setShowContributeModal(false); setTemplateSuccess(""); setIncludeStory(false); setStoryOrigin(""); setStoryUsageContext(""); setStoryEducationalUse(""); setStoryExampleImages([""]); }}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleTemplateUploadSubmit} className="space-y-4 text-xs font-semibold">
              {templateSuccess && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/25 text-purple-750 dark:text-purple-300 rounded-lg border">
                  {templateSuccess}
                </div>
              )}
              {/* Attach File Option Moved to Top */}
              <div>
                <label className="block text-gray-500 uppercase mb-1.5">Attach File / Customizable Image Template *</label>
                <input
                  type="file"
                  accept="image/*,video/*,audio/*"
                  onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  required
                />
                <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1">
                  💡 This image/media file will be customizable by users in the Meme Lab.
                </p>
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1.5">Template/Meme Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Winnie the Pooh Reading a Paper"
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  required
                />
              </div>

              {/* ── Meme Story toggle section ── */}
              <div className="border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 bg-amber-50/50 dark:bg-amber-950/10 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeStory}
                    onChange={(e) => setIncludeStory(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                  <span>
                    <p className="font-bold text-gray-700 dark:text-gray-200 text-xs">📖 Add the background story of this meme?</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Help other users understand the meme's origin and context.</p>
                  </span>
                </label>

                {includeStory && (
                  <div className="space-y-3 pt-2 border-t border-amber-200 dark:border-amber-800/40">
                    <div>
                      <label className="block text-gray-500 uppercase mb-1">Background — How it became a meme</label>
                      <RichTextArea
                        placeholder="How it became a meme: Mention where this template originated (movie, TV show, game, viral event) and how it gained popularity."
                        value={storyOrigin}
                        onChange={(e) => setStoryOrigin(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 uppercase mb-1">Typical Meaning & Usage</label>
                      <RichTextArea
                        placeholder="Used to express confusion while reading something complicated or reacting to unexpected information."
                        value={storyUsageContext}
                        onChange={(e) => setStoryUsageContext(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 uppercase mb-1">Educational Use</label>
                      <RichTextArea
                        placeholder="Suggest classroom situations where this template can be used. E.g. Assignment instructions"
                        value={storyEducationalUse}
                        onChange={(e) => setStoryEducationalUse(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 uppercase mb-1">Example Images (Upload Multiple Images)</label>
                      <p className="text-[10px] text-gray-400 mb-2">Upload real example images of this meme being used.</p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setStoryExampleFiles(prev => [...prev, ...files]);
                        }}
                        className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                      />
                      {storyExampleFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {storyExampleFiles.map((file, idx) => (
                            <div key={idx} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-amber-300 dark:border-amber-700 bg-gray-100">
                              <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setStoryExampleFiles(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute top-0 right-0 bg-red-600 text-white rounded-bl p-0.5 text-[10px] font-bold leading-none"
                                title="Remove"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
        format={activeTab}
        onSelect={(mediaUrl) => {
          if (activeTab === "video") {
            setVideoUrl(mediaUrl);
          } else if (activeTab === "gif") {
            setGifUrl(mediaUrl);
          } else if (activeTab === "audio") {
            setAudioUrl(mediaUrl);
            selectMediaPreset(mediaUrl, "audio", 30);
          } else {
            if (images.length >= 4) {
              setAlertMessage("You can only add up to 4 images to the collage.");
              return;
            }
            setImages(prev => [...prev, mediaUrl]);
          }
        }}
      />

      {/* AI PUNCHLINES GENERATOR MODAL */}
      {showAiPunchlinesModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => setShowAiPunchlinesModal(false)}
        >
          <div
            className="bg-white dark:bg-[#111624] border border-gray-200 dark:border-[#1e273a] rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="text-[#f43f5e]">⚡</span> AI Punchlines
              </h3>
              <button
                type="button"
                onClick={() => setShowAiPunchlinesModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
              >
                <span className="sr-only">Close</span>✕
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">
              Generate witty, subject-aware caption ideas for your {subject === "Other" ? (customSubject || "topic") : subject} meme, then apply one to your selected text layer.
            </p>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={aiPromptTopic}
                onChange={(e) => setAiPromptTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !aiLoading) handleGenerateAiCaptions(); }}
                placeholder="Topic (e.g. Photosynthesis, Algebra II)..."
                className="flex-1 bg-slate-50 dark:bg-[#0e131f] border border-slate-200 dark:border-[#1e273a] rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-bold focus:outline-none focus:ring-1 focus:ring-[#e11d48] focus:border-[#e11d48] transition"
              />
              <button
                type="button"
                onClick={handleGenerateAiCaptions}
                disabled={aiLoading}
                className="px-4 py-2 rounded-xl bg-[#e11d48] hover:bg-[#f43f5e] disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
              >
                {aiLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Generate</span>
              </button>
            </div>

            {aiError && (
              <div className="mb-3 p-2.5 rounded-lg bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] font-medium">
                {aiError}
              </div>
            )}

            {aiLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-zinc-500 text-xs">
                <div className="w-6 h-6 border-2 border-[#e11d48] border-t-transparent rounded-full animate-spin" />
                Brainstorming punchlines...
              </div>
            ) : aiCaptions.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                {aiCaptions.map((cap, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyAiCaption(cap)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-[#1e273a] bg-slate-50 dark:bg-[#0e131f] hover:border-[#e11d48] hover:bg-rose-50/60 dark:hover:bg-[#1e273a] transition text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-start justify-between gap-2 group"
                  >
                    <span>{cap}</span>
                    <span className="shrink-0 text-[10px] font-bold text-[#e11d48] opacity-0 group-hover:opacity-100 transition">Use</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-zinc-500">
                Enter a topic (optional) and hit Generate to get 3 caption ideas.
              </div>
            )}

            <button
              type="button"
              onClick={() => { setShowAiPunchlinesModal(false); setShowAiModal(true); }}
              className="mt-4 w-full text-center text-[10px] font-semibold text-slate-400 dark:text-zinc-500 hover:text-[#e11d48] transition"
            >
              View AI credits & quota
            </button>
          </div>
        </div>
      )}

      {/* VIDEO SPLITTING MODAL */}
      {showSplitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-scaleIn">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span>✂️</span> Split Video Clip
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-6">
              Split the video at the current playhead position: <strong className="text-purple-600 font-mono">{videoCurrentTime.toFixed(1)}s</strong>.
            </p>

            {splitLoading ? (
              <div className="py-6 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-600 dark:text-zinc-300 font-medium">{splitProgress}</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleKeepLeftPart}
                    className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 hover:bg-purple-50 dark:hover:bg-purple-950/20 hover:border-purple-300 transition text-center"
                  >
                    <span className="text-lg mb-1">👈</span>
                    <span className="text-xs font-bold text-gray-800 dark:text-zinc-200">Keep Left Part</span>
                    <span className="text-[10px] text-gray-500 mt-0.5">{videoTrimStart.toFixed(1)}s – {videoCurrentTime.toFixed(1)}s</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleKeepRightPart}
                    className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 hover:bg-purple-50 dark:hover:bg-purple-950/20 hover:border-purple-300 transition text-center"
                  >
                    <span className="text-lg mb-1">👉</span>
                    <span className="text-xs font-bold text-gray-800 dark:text-zinc-200">Keep Right Part</span>
                    <span className="text-[10px] text-gray-500 mt-0.5">{videoCurrentTime.toFixed(1)}s – {videoTrimEnd.toFixed(1)}s</span>
                  </button>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={handleDownloadBothParts}
                    className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-purple-500/10"
                  >
                    <span>⬇️</span> Download Both Parts
                  </button>

                  {user && (
                    <button
                      type="button"
                      onClick={handleSaveBothPartsAsDrafts}
                      className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <span>📁</span> Save Both as Library Drafts
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowSplitModal(false)}
                    className="w-full py-2 px-4 rounded-xl border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 font-semibold text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI QUOTA & AD-GATE MODAL */}
      <AiQuotaModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
      />

      {/* Interactive First-Time Tour */}
      <TourOverlay
        isOpen={isTourOpen}
        currentStep={currentStep}
        totalSteps={totalSteps}
        stepData={currentStepData}
        pageTitle={pageTitle}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipTour}
      />

      {/* Floating Page Help Panel */}
      <PageHelpPanel
        pageKey="lab"
        onRestartTour={resetTour}
        hasSkippedTour={hasSkippedTour}
      />

    </div>
  );
};

const LabWrapped = (props) => (
  <LabErrorBoundary>
    <Lab {...props} />
  </LabErrorBoundary>
);

export default LabWrapped;
