import React, { useState, useEffect, useRef } from "react";
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
      setImages([temp.media_url]);
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
          setSubject(data.subject || "Biology");
          setAgeGroup(data.age_group || "13-15");
          setLanguage(data.language || "English");
          setActiveTab(data.format || "image");

          if (data.format === "image") {
            setImages(data.media_url ? [data.media_url] : []);
          } else if (data.format === "video") {
            setVideoUrl(data.media_url || "");
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
  const [collageLayout, setCollageLayout] = useState("grid"); // "grid" | "vertical" | "horizontal"

  // --- Video Tab State ---
  const [videoUrl, setVideoUrl] = useState(MEDIA_SAMPLES?.video?.[0]?.url || "");
  const [videoFile, setVideoFile] = useState(null); // Raw File object
  const [videoDuration, setVideoDuration] = useState(15);
  const [videoTrimStart, setVideoTrimStart] = useState(0);
  const [videoTrimEnd, setVideoTrimEnd] = useState(15);

  // --- GIF Tab State ---
  const [gifUrl, setGifUrl] = useState(MEDIA_SAMPLES?.gif?.[0]?.url || "");

  // --- Audio Tab State ---
  const [audioUrl, setAudioUrl] = useState(MEDIA_SAMPLES?.audio?.[0]?.url || "");
  const [audioFile, setAudioFile] = useState(null); // Raw File object
  const [audioTrimStart, setAudioTrimStart] = useState(0);
  const [audioTrimEnd, setAudioTrimEnd] = useState(15);

  // --- Text Overlay State ---
  const [textLayers, setTextLayers] = useState([
    {
      id: "txt-1",
      text: "Double click to edit",
      x: 150,
      y: 100,
      fontSize: 28,
      color: "#FFFFFF",
      fontFamily: "Impact",
      strokeColor: "#000000",
      strokeWidth: 2
    }
  ]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);

  // --- General Modals & Alert States ---
  const [activeControlTab, setActiveControlTab] = useState("media");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [publishToLibrary, setPublishToLibrary] = useState(true);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Biology");
  const [ageGroup, setAgeGroup] = useState("13-15");
  const [language, setLanguage] = useState("English");
  const [alertMessage, setAlertMessage] = useState("");
  const [autoSaveToast, setAutoSaveToast] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Template Upload Pipeline State ---
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateFile, setTemplateFile] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateSuccess, setTemplateSuccess] = useState("");
  const [availableTemplates, setAvailableTemplates] = useState([]);

  // Refs
  const canvasContainerRef = useRef(null);
  const videoPlayerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const dragInfoRef = useRef({ isDragging: false, textId: null, startX: 0, startY: 0, startLeft: 0, startTop: 0 });

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
        strokeWidth: 2
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

  // --- Background Auto-Save Worker (30 Seconds) ---
  useEffect(() => {
    if (!user) return;

    const autoSaveInterval = setInterval(async () => {
      try {
        const docData = {
          creator_id: user.uid,
          title: title || "Auto-Saved Draft",
          subject,
          age_group: ageGroup,
          format: activeTab,
          language,
          visibility: "draft",
          media_url: activeTab === "image" ? (images[0] || "") : activeTab === "video" ? videoUrl : activeTab === "gif" ? gifUrl : audioUrl,
          text_layers_json: JSON.stringify(textLayers),
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
  }, [user, title, subject, ageGroup, activeTab, language, images, videoUrl, gifUrl, audioUrl, textLayers]);

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

  const generateMemeBlob = async () => {
    const container = canvasContainerRef.current;
    if (!container) return null;
    const width = container.offsetWidth || 500;
    const height = container.offsetHeight || 500;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Draw background color first
    ctx.fillStyle = "#ffffff";
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
        }
      }

      if (numImages === 1 && loadedImages[0]) {
        ctx.drawImage(loadedImages[0], 0, 0, width, height);
      } else if (numImages === 2) {
        const colWidth = width / 2;
        if (loadedImages[0]) ctx.drawImage(loadedImages[0], 0, 0, colWidth, height);
        if (loadedImages[1]) ctx.drawImage(loadedImages[1], colWidth, 0, colWidth, height);
      } else if (numImages === 3) {
        const colWidth = width / 3;
        if (loadedImages[0]) ctx.drawImage(loadedImages[0], 0, 0, colWidth, height);
        if (loadedImages[1]) ctx.drawImage(loadedImages[1], colWidth, 0, colWidth, height);
        if (loadedImages[2]) ctx.drawImage(loadedImages[2], colWidth * 2, 0, colWidth, height);
      } else if (numImages === 4) {
        const colWidth = width / 2;
        const rowHeight = height / 2;
        if (loadedImages[0]) ctx.drawImage(loadedImages[0], 0, 0, colWidth, rowHeight);
        if (loadedImages[1]) ctx.drawImage(loadedImages[1], colWidth, 0, colWidth, rowHeight);
        if (loadedImages[2]) ctx.drawImage(loadedImages[2], 0, rowHeight, colWidth, rowHeight);
        if (loadedImages[3]) ctx.drawImage(loadedImages[3], colWidth, rowHeight, colWidth, rowHeight);
      }
    }

    // Draw text overlays
    textLayers.forEach(layer => {
      ctx.font = `${layer.fontSize}px ${layer.fontFamily || 'Impact'}`;
      ctx.fillStyle = layer.color || '#FFFFFF';
      ctx.strokeStyle = layer.strokeColor || '#000000';
      ctx.lineWidth = (layer.strokeWidth || 0) * 2; // scale stroke to make it look prominent
      ctx.textBaseline = 'top';
      
      if (layer.strokeWidth > 0) {
        ctx.strokeText(layer.text, layer.x, layer.y);
      }
      ctx.fillText(layer.text, layer.x, layer.y);
    });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/png");
    });
  };

  // --- Final Publish & Save Workflow ---
  const handlePublishSubmit = async () => {
    if (!user) return;
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
          link.download = `${title || 'meme'}.png`;
          link.href = downloadUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
        }
      } 
      // 2. Upload video file to Storage if uploaded manually
      else if (activeTab === "video" && videoFile) {
        const storageRef = ref(storage, `memes/${user.uid}_meme_${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, videoFile);
        fileUrl = await getDownloadURL(snapshot.ref);

        // Local download of the video file
        const link = document.createElement("a");
        link.download = `${title || 'meme'}.mp4`;
        link.href = videoUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } 
      // 3. Upload audio file to Storage if uploaded manually
      else if (activeTab === "audio" && audioFile) {
        const storageRef = ref(storage, `memes/${user.uid}_meme_${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, audioFile);
        fileUrl = await getDownloadURL(snapshot.ref);

        // Local download of the audio file
        const link = document.createElement("a");
        link.download = `${title || 'meme'}.mp3`;
        link.href = audioUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      // 4. Download local GIF file if it is loaded
      else if (activeTab === "gif" && gifUrl) {
        const link = document.createElement("a");
        link.download = `${title || 'meme'}.gif`;
        link.href = gifUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      const memeData = {
        creator_id: user.uid,
        title: title || "My Meme Classroom Creation",
        subject,
        age_group: ageGroup,
        format: activeTab,
        language,
        visibility: publishToLibrary ? "public" : "draft",
        media_url: fileUrl,
        text_layers_json: JSON.stringify(textLayers),
        template_id: templateId || "",
        created_at: serverTimestamp()
      };

      if (draftIdRef.current) {
        const draftDocRef = doc(db, "memes", draftIdRef.current);
        await setDoc(draftDocRef, memeData, { merge: true });
      } else {
        await addDoc(collection(db, "memes"), memeData);
      }

      // If user checked publish, update user stats for contributor points
      if (publishToLibrary) {
        const statsRef = doc(db, "user_stats", user.uid);
        await setDoc(statsRef, {
          memes_created_count: increment(1)
        }, { merge: true });
      }

      // Mock Local Download Trigger (only if NOT image/video/audio which already download their visual assets)
      if (!publishToLibrary && activeTab !== "image" && activeTab !== "video" && activeTab !== "audio") {
        const link = document.createElement("a");
        link.download = `${title || 'meme'}_draft.txt`;
        link.href = `data:text/plain;charset=utf-8,${encodeURIComponent(JSON.stringify(memeData))}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setShowSaveModal(false);
      navigate("/library");
    } catch (err) {
      console.error(err);
      setAlertMessage("Failed to save the creation.");
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

      await addDoc(collection(db, "templates"), {
        title: templateTitle || "Blank Background Template",
        creator_id: user.uid,
        media_url: fileUrl,
        is_admin_preset: false,
        status: "pending", // Baseline schema requirement to lock visibility from editor
        created_at: serverTimestamp()
      });

      setTemplateSuccess("Template contributed successfully! Awaiting Admin approval.");
      setTemplateTitle("");
      setTemplateFile(null);
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

      {/* Main Studio Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column: Tabbed controls sidebar (1/3 width) */}
        <div className={`p-6 ${containerClass} flex flex-col h-full min-h-[550px] shadow-md`}>
          
          {/* Tab selectors for sidebar */}
          <div className="flex border-b border-gray-200 dark:border-gray-800 pb-3 mb-6 gap-2">
            {[
              { id: "media", label: "📁 Media" },
              { id: "text", label: "✍️ Text Overlays" },
              { id: "settings", label: "⚙️ Templates" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveControlTab(tab.id)}
                className={`flex-1 py-2 text-xs font-bold text-center rounded-lg transition-all ${
                  activeControlTab === tab.id
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-850"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sidebar Tab Contents wrapper */}
          <div className="flex-grow space-y-6 overflow-y-auto max-h-[70vh] pr-1">
            
            {/* 1. MEDIA TAB CONTROLS */}
            {activeControlTab === "media" && (
              <div className="space-y-6">
                
                {activeTab === "image" && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-purple-650 dark:text-purple-400 border-b pb-2">Collage Media Assets</h3>
                    <div className="flex flex-col gap-4">
                      <label className="w-full">
                        <span className="block text-[11px] font-semibold uppercase tracking-wider mb-2 text-gray-500">Upload pictures (Max 4)</span>
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                          className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        />
                      </label>
                      {images.length > 0 && (
                        <button 
                          onClick={() => setImages([])}
                          className="text-xs font-semibold text-red-655 hover:underline self-start mt-2"
                        >
                          Clear Collage Grid
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "video" && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-purple-650 dark:text-purple-400 border-b pb-2">Video Media Assets</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2 text-gray-500">Upload Video (&lt; 15s)</label>
                        <input 
                          type="file" 
                          accept="video/*" 
                          onChange={handleVideoUpload} 
                          className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] font-semibold uppercase tracking-wider mb-2 text-gray-500">Load Mock Sample</span>
                        <div className="flex flex-wrap gap-2">
                          {MEDIA_SAMPLES.video.map((sample, idx) => (
                            <button
                              key={sample.id}
                              onClick={() => selectMediaPreset(sample.url, "video", 15)}
                              className="text-[11px] bg-purple-50 dark:bg-purple-950/20 text-purple-750 dark:text-purple-300 font-bold px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100"
                            >
                              Sample {idx + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {videoUrl && (
                      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                        <span className="block text-[11px] font-semibold uppercase tracking-wider mb-3 text-gray-500">Crop / Trim Playback Window</span>
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
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "gif" && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-purple-655 dark:text-purple-400 border-b pb-2">GIF Media Assets</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2 text-gray-500">GIF Source URL</label>
                        <input 
                          type="text" 
                          value={gifUrl} 
                          onChange={(e) => setGifUrl(e.target.value)} 
                          placeholder="Giphy or upload URL"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-gray-55 dark:bg-gray-900"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] font-semibold uppercase tracking-wider mb-2 text-gray-500">Load Mock Sample</span>
                        <div className="flex flex-wrap gap-2">
                          {MEDIA_SAMPLES.gif.map((sample, idx) => (
                            <button
                              key={sample.id}
                              onClick={() => selectMediaPreset(sample.url, "gif")}
                              className="text-[11px] bg-purple-50 dark:bg-purple-950/20 text-purple-750 dark:text-purple-300 font-bold px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100"
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
                  <div className="space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-purple-650 dark:text-purple-400 border-b pb-2">Audio Media Assets</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2 text-gray-500">Upload Audio (&lt; 20 MB)</label>
                        <input 
                          type="file" 
                          accept="audio/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setAudioUrl(createObjectURLSafe(file));
                          }} 
                          className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] font-semibold uppercase tracking-wider mb-2 text-gray-500">Load Mock Sample</span>
                        <div className="flex flex-wrap gap-2">
                          {MEDIA_SAMPLES.audio.map((sample, idx) => (
                            <button
                              key={sample.id}
                              onClick={() => selectMediaPreset(sample.url, "audio", 45)}
                              className="text-[11px] bg-purple-50 dark:bg-purple-950/20 text-purple-750 dark:text-purple-300 font-bold px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100"
                            >
                              Sample {idx + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {audioUrl && (
                      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                        <span className="block text-[11px] font-semibold uppercase tracking-wider mb-3 text-gray-500">Crop / Trim Playback Window</span>
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

            {/* 2. TEXT TAB CONTROLS */}
            {activeControlTab === "text" && (
              <div className="space-y-6">
                <h3 className="font-bold text-xs uppercase tracking-wider text-purple-650 dark:text-purple-400 border-b pb-2">Overlay Text Engine</h3>
                
                <button
                  onClick={addTextLayer}
                  className="w-full bg-purple-100 text-purple-750 dark:bg-purple-950 dark:text-purple-300 border border-purple-250 dark:border-purple-800 hover:bg-purple-200 font-semibold py-2.5 px-4 rounded-lg shadow-sm text-xs transition duration-200 mb-4"
                >
                  ➕ Add Custom Text Layer
                </button>

                {activeTextLayer ? (
                  <div className="space-y-4 text-xs font-semibold bg-gray-55 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-150 dark:border-gray-800">
                    <div>
                      <label className="block text-gray-500 uppercase mb-1">Text String</label>
                      <textarea
                        value={activeTextLayer.text}
                        onChange={(e) => updateTextLayer("text", e.target.value)}
                        rows="2"
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-500 uppercase mb-1">Font Family</label>
                        <select
                          value={activeTextLayer.fontFamily}
                          onChange={(e) => updateTextLayer("fontFamily", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded"
                        >
                          <option value="Impact">Impact</option>
                          <option value="Arial">Arial</option>
                          <option value="Comic Sans MS">Comic Sans</option>
                          <option value="Georgia">Georgia</option>
                          <option value="Courier New">Courier</option>
                          <option value="Times New Roman">Times</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-gray-500 uppercase mb-1">Text Color</label>
                        <input
                          type="color"
                          value={activeTextLayer.color}
                          onChange={(e) => updateTextLayer("color", e.target.value)}
                          className="w-full h-8 border cursor-pointer rounded p-0 bg-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-500 uppercase mb-1">Font Size ({activeTextLayer.fontSize}px)</label>
                      <input
                        type="range"
                        min="10"
                        max="80"
                        value={activeTextLayer.fontSize}
                        onChange={(e) => updateTextLayer("fontSize", parseInt(e.target.value))}
                        className="w-full accent-purple-650 h-1 bg-gray-250 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-500 uppercase mb-1">Stroke Shadow</label>
                        <input
                          type="color"
                          value={activeTextLayer.strokeColor}
                          onChange={(e) => updateTextLayer("strokeColor", e.target.value)}
                          className="w-full h-8 border cursor-pointer rounded p-0 bg-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 uppercase mb-1">Stroke Width ({activeTextLayer.strokeWidth}px)</label>
                        <input
                          type="range"
                          min="0"
                          max="6"
                          value={activeTextLayer.strokeWidth}
                          onChange={(e) => updateTextLayer("strokeWidth", parseInt(e.target.value))}
                          className="w-full accent-purple-655 h-1 bg-gray-255 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t flex justify-between">
                      <button
                        onClick={deleteSelectedText}
                        className="text-red-655 hover:underline"
                      >
                        Delete Layer
                      </button>
                      <button
                        onClick={() => setSelectedTextId(null)}
                        className="text-gray-500 hover:underline"
                      >
                        Deselect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-xs border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                    Click a text overlay on the canvas to configure styling parameters.
                  </div>
                )}
              </div>
            )}

            {/* 3. SETTINGS TAB CONTROLS */}
            {activeControlTab === "settings" && (
              <div className="space-y-6">
                {/* Browse Templates Sub-Section */}
                <div className="space-y-4">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-purple-650 dark:text-purple-400 border-b pb-2">Browse Templates</h3>
                  {availableTemplates.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 max-h-[240px] overflow-y-auto pr-1">
                      {availableTemplates.map((temp) => (
                        <button
                          key={temp.id}
                          onClick={() => handleSelectTemplate(temp)}
                          className="flex flex-col items-center p-2 border border-gray-250 dark:border-gray-800 rounded-lg hover:border-purple-500 hover:bg-purple-50/10 transition text-left w-full"
                        >
                          <div className="w-full aspect-video bg-black rounded overflow-hidden flex items-center justify-center mb-1">
                            {temp.format === "video" ? (
                              <div className="text-white text-[10px]">🎥 Video Template</div>
                            ) : temp.format === "audio" ? (
                              <div className="text-white text-[10px]">🎵 Audio Template</div>
                            ) : (
                              <img src={temp.media_url} alt={temp.title} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <span className="text-[10px] font-bold truncate w-full text-center text-gray-700 dark:text-gray-300">{temp.title}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-[11px] italic">No approved templates available yet. Contribute one below!</p>
                  )}
                </div>

                <div className="border-t border-gray-250 dark:border-gray-800 pt-4 space-y-4">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-purple-650 dark:text-purple-400 border-b pb-2">Contribute Blank Template</h3>
                  <form onSubmit={handleTemplateUploadSubmit} className="space-y-4 text-xs font-semibold">
                    
                    {templateSuccess && (
                      <div className="p-3 bg-purple-55 dark:bg-purple-950/20 text-purple-750 rounded-lg border text-[11px]">
                        {templateSuccess}
                      </div>
                    )}

                    <div>
                      <label className="block text-gray-500 uppercase mb-1">Template Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Distracted Boyfriend Blank"
                        value={templateTitle}
                        onChange={(e) => setTemplateTitle(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-500 uppercase mb-1">Background Image/GIF File</label>
                      <input
                        type="file"
                        accept="image/*,image/gif"
                        onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                        className="block w-full text-[11px]"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={templateLoading}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-bold transition shadow-sm"
                    >
                      {templateLoading ? "Uploading..." : "Submit Template"}
                    </button>
                  </form>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Right 2 Columns: Media Tabs & Interactive Workspace Viewport (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Format Tabs Selection (Top switcher segment control) */}
          <div className="flex p-1 bg-gray-100 dark:bg-gray-850 rounded-xl space-x-1 w-fit">
            {["image", "video", "gif", "audio"].map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setAlertMessage(""); }}
                className={`px-6 py-2 text-xs font-bold capitalize rounded-lg transition-all ${
                  activeTab === tab 
                    ? "bg-white dark:bg-gray-800 text-purple-650 dark:text-purple-400 shadow-sm" 
                    : "text-gray-500 hover:text-gray-755 dark:text-gray-400"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Canvas physical drafting board board workspace */}
          <div className="flex flex-col items-center">
            <div 
              ref={canvasContainerRef}
              className="relative w-full max-w-lg mx-auto bg-slate-900 border border-slate-950 rounded-xl overflow-hidden aspect-square flex items-center justify-center select-none shadow-2xl ring-4 ring-slate-800/40"
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
                      whiteSpace: "nowrap"
                    }}
                    className={`pointer-events-auto px-2 py-1 rounded transition select-none ${
                      selectedTextId === layer.id 
                        ? "border-2 border-dashed border-purple-500 ring-2 ring-purple-300 bg-purple-500/10" 
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
                <div className={`w-full h-full grid gap-1 ${
                  images.length <= 1 ? "grid-cols-1" :
                  images.length === 2 ? "grid-cols-2" :
                  images.length === 3 ? "grid-cols-3" : "grid-cols-2 grid-rows-2"
                }`}>
                  {images.length > 0 ? (
                    images.map((src, idx) => (
                      <img 
                        key={idx} 
                        src={src} 
                        alt={`Collage slice ${idx}`} 
                        className="w-full h-full object-cover" 
                      />
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 w-full h-full">
                      <p className="font-semibold mb-1 text-white">Canvas is Empty</p>
                      <p className="text-xs text-gray-500">Upload layout pictures or preset templates in the Media tab.</p>
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
                    <p className="text-gray-500 text-xs">No video asset loaded</p>
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
                    <p className="text-gray-500 text-xs">No GIF loaded</p>
                  )}
                </div>
              )}

              {activeTab === "audio" && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 p-6 text-center text-white">
                  <div className="text-4xl mb-3 animate-pulse">🎵</div>
                  <p className="text-xs font-semibold mb-4 text-purple-400 uppercase tracking-wider">Audio Waveform Container</p>
                  {audioUrl ? (
                    <audio 
                      ref={audioPlayerRef}
                      src={audioUrl} 
                      controls 
                      className="w-full max-w-xs" 
                    />
                  ) : (
                    <p className="text-gray-500 text-xs">No audio file loaded</p>
                  )}
                </div>
              )}
            </div>
            
            <p className="mt-3 text-[11px] text-gray-400 text-center italic">
              💡 Drag text layers on the canvas to position them. Double-click to edit text strings directly.
            </p>
          </div>

        </div>

      </div>

      {/* SAVE MODAL DIALOG */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-xl overflow-y-auto max-h-[90vh] ${containerClass}`}>
            <h2 className="text-lg font-bold mb-2">Help Us Expand Our Library!</h2>
            <p className="text-xs text-gray-500 mb-6">
              Contribute your creation to the public catalog to earn a contributor badge and share pedagogical concepts.
            </p>

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
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    <option value="Biology">Biology</option>
                    <option value="Physics">Physics</option>
                    <option value="Maths">Maths</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="History">History</option>
                    <option value="Geography">Geography</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Age Group</label>
                  <select
                    value={ageGroup}
                    onChange={(e) => setAgeGroup(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    <option value="10-12">Ages 10-12</option>
                    <option value="13-15">Ages 13-15</option>
                    <option value="16-18">Ages 16-18</option>
                    <option value="University">University</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publishToLibrary}
                    onChange={(e) => setPublishToLibrary(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                  <span>Publish this meme to the public library gallery</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className={cancelBtnClass}
              >
                Cancel
              </button>
              <button
                onClick={handlePublishSubmit}
                disabled={loading}
                className={btnClass}
              >
                {loading ? "Saving..." : "Confirm & Save"}
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
              <button onClick={() => setShowTutorialModal(false)} className="text-gray-400 hover:text-gray-500 font-bold text-lg">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm text-gray-650 dark:text-gray-300">
              <div>
                <h3 className="font-bold text-purple-750 dark:text-purple-400 mb-1">1. Pedagogical Alignment Methodology</h3>
                <p className="text-xs">
                  A high-pedagogy meme does not just make jokes; it visually aligns content elements to bridge humor with real cognitive recall. Try mapping dry vocabulary to punchy overlay text overlays.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-purple-750 dark:text-purple-400 mb-1">2. Appropriateness Checklist</h3>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li>**Language**: Verify all overlays are appropriate for grade school classrooms.</li>
                  <li>**Copyright**: Use the template upload pipeline to contribute free-to-use blanks.</li>
                  <li>**Accuracy**: Ensure scientific formulas or historical timelines are factual.</li>
                </ul>
              </div>

              <div className="border border-gray-250 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg p-6 text-center text-xs">
                <span className="block font-bold mb-1 text-gray-500">Instructional Video Embed Tutorial</span>
                <span className="text-[11px] text-gray-400">Admin instructional video player slot will load here.</span>
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

    </div>
  );
};

export default Lab;
