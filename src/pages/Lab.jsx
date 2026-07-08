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
  onSnapshot,
  runTransaction
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import { MEDIA_SAMPLES } from "../constants/mediaSamples";
import { SUBJECTS, GRADE_GROUPS } from "../constants/taxonomy";

const trackCustomSubmission = async (type, name) => {
  if (!name || !name.trim()) return;
  const cleanName = name.trim();
  const docId = `${type}_${cleanName.toLowerCase()}`;
  const counterRef = doc(db, "custom_counts", docId);
  const taxRef = doc(db, "configs", "taxonomy");

  try {
    await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let count = 1;
      if (counterSnap.exists()) {
        count = (counterSnap.data().count || 0) + 1;
      }
      transaction.set(counterRef, { name: cleanName, count, type }, { merge: true });

      if (count >= 10) {
        const taxSnap = await transaction.get(taxRef);
        if (taxSnap.exists()) {
          const taxData = taxSnap.data();
          if (type === "subject") {
            const subjects = taxData.subjects || [];
            const exists = subjects.some(s => s.toLowerCase() === cleanName.toLowerCase());
            if (!exists) {
              const otherIdx = subjects.indexOf("Other");
              if (otherIdx !== -1) {
                subjects.splice(otherIdx, 0, cleanName);
              } else {
                subjects.push(cleanName);
              }
              transaction.update(taxRef, { subjects });
            }
          } else if (type === "language") {
            const languages = taxData.languages || [];
            const exists = languages.some(l => l.toLowerCase() === cleanName.toLowerCase());
            if (!exists) {
              const otherIdx = languages.indexOf("Other");
              if (otherIdx !== -1) {
                languages.splice(otherIdx, 0, cleanName);
              } else {
                languages.push(cleanName);
              }
              transaction.update(taxRef, { languages });
            }
          }
        }
      }
    });
  } catch (err) {
    console.error("Error tracking custom submission", err);
  }
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

      const finalSubject = subject === "Other" ? (customSubject.trim() || "Other") : subject;
      const finalLanguage = language === "Other" ? (customLanguage.trim() || "Other") : language;
      const parsedKeywords = keywords ? keywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean) : [];
      const memeData = {
        creator_id: user.uid,
        title: title || "My Meme Classroom Creation",
        subject: finalSubject,
        age_group: ageGroup,
        format: activeTab,
        language: finalLanguage,
        keywords: parsedKeywords,
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

      if (subject === "Other" && customSubject.trim()) {
        trackCustomSubmission("subject", customSubject.trim());
      }
      if (language === "Other" && customLanguage.trim()) {
        trackCustomSubmission("language", customLanguage.trim());
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
                <span>Media</span>
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
              <button
                type="button"
                onClick={() => setActiveControlTab("settings")}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-bold rounded-lg transition ${
                  activeControlTab === "settings"
                    ? (highContrastMode ? "bg-zinc-700 text-white shadow-sm" : "bg-white text-purple-700 shadow-sm")
                    : (highContrastMode ? "text-zinc-400 hover:text-zinc-200" : "text-gray-500 hover:text-gray-800")
                }`}
              >
                <span>⚙️</span>
                <span>Templates</span>
              </button>
            </div>
          </div>

          {/* Active Tab Panel Content */}
          <div className="flex-grow p-5 overflow-y-auto space-y-6">
            {/* MEDIA CONTROLS */}
            {activeControlTab === "media" && (
              <div className="space-y-6">
                
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
                          ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/20"
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

                    {images.length > 0 && (
                      <button 
                        onClick={() => setImages([])}
                        className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center space-x-1 mt-2 transition"
                      >
                        <span>🗑️</span>
                        <span>Clear Collage Grid</span>
                      </button>
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
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "gif" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-zinc-800">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400">GIF Media Assets</h3>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2 text-gray-500">GIF Source URL</label>
                        <input 
                          type="text" 
                          value={gifUrl} 
                          onChange={(e) => setGifUrl(e.target.value)} 
                          placeholder="Giphy URL or external link..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-gray-500">Load Mock Sample</span>
                        <div className="flex flex-wrap gap-2">
                          {MEDIA_SAMPLES.gif.map((sample, idx) => (
                            <button
                              key={sample.id}
                              type="button"
                              onClick={() => selectMediaPreset(sample.url, "gif")}
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
                </div>
                
                <button
                  type="button"
                  onClick={addTextLayer}
                  className="w-full bg-purple-50 text-purple-700 dark:bg-purple-955/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 font-bold py-2.5 px-4 rounded-xl shadow-sm text-xs transition duration-200 mb-4 active:scale-95"
                >
                  ➕ Add New Text Layer
                </button>

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

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-555 uppercase mb-1.5">Font Family</label>
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

                    <div className="pt-4 border-t border-gray-200 dark:border-zinc-800 flex justify-between">
                      <button
                        type="button"
                        onClick={deleteSelectedText}
                        className="text-red-600 hover:text-red-700 font-bold"
                      >
                        Delete Layer
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
                    💡 Click a text overlay on the canvas preview to edit its fonts, sizes, and colors directly.
                  </div>
                )}
              </div>
            )}

            {/* TEMPLATES CONTROLS */}
            {activeControlTab === "settings" && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-zinc-800">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400">Browse Templates</h3>
                  </div>
                  {availableTemplates.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 max-h-[240px] overflow-y-auto pr-1">
                      {availableTemplates.map((temp) => (
                        <button
                          type="button"
                          key={temp.id}
                          onClick={() => handleSelectTemplate(temp)}
                          className="flex flex-col items-center p-2 border border-gray-200 dark:border-zinc-800 rounded-xl hover:border-purple-500 hover:bg-purple-50/10 transition text-left w-full active:scale-95"
                        >
                          <div className="w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center mb-1.5">
                            {temp.format === "video" ? (
                              <div className="text-white text-[10px] font-bold">🎥 Video Template</div>
                            ) : temp.format === "audio" ? (
                              <div className="text-white text-[10px] font-bold">🎵 Audio Template</div>
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

                <div className="border-t border-gray-200 dark:border-zinc-800 pt-4 space-y-4">
                  <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-zinc-800">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400">Contribute Blank Template</h3>
                  </div>
                  <form onSubmit={handleTemplateUploadSubmit} className="space-y-4 text-xs font-semibold">
                    
                    {templateSuccess && (
                      <div className="p-3 bg-purple-55 dark:bg-purple-955/20 text-purple-750 rounded-lg border text-[11px]">
                        {templateSuccess}
                      </div>
                    )}

                    <div>
                      <label className="block text-gray-555 uppercase mb-1.5">Template Title</label>
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
                      <label className="block text-gray-555 uppercase mb-1.5">Background Image/GIF File</label>
                      <input
                        type="file"
                        accept="image/*,image/gif"
                        onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                        className="block w-full text-[11px] file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-[11px] file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={templateLoading}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-xl font-bold transition shadow-sm active:scale-95"
                    >
                      {templateLoading ? "Uploading..." : "Submit Template"}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. RIGHT VIEWPORT WORKSPACE */}
        <div className="flex-grow flex flex-col h-full min-w-0 bg-slate-100 dark:bg-zinc-950 overflow-hidden relative">
          
          {/* Top workspace bar containing Format Switcher & Save */}
          <div className={`flex items-center justify-between px-6 py-3 border-b shrink-0 ${
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
                  className={`px-4 py-1.5 text-xs font-bold capitalize rounded-lg transition ${
                    activeTab === tab 
                      ? (highContrastMode ? "bg-zinc-700 text-white shadow-sm" : "bg-white text-purple-700 shadow-sm") 
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

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
                className={`relative w-full max-w-[480px] aspect-square flex items-center justify-center select-none shadow-xl border ${
                  highContrastMode 
                    ? "bg-zinc-900 border-zinc-800" 
                    : "bg-slate-900 border-slate-955"
                } rounded-2xl overflow-hidden`}
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
                      <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 w-full h-full bg-slate-955/10">
                        {/* Premium "Start Creating" Empty State Illustration */}
                        <div className="mb-4 text-purple-400 animate-pulse">
                          <svg className="w-14 h-14 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="font-bold text-sm mb-1 text-gray-700 dark:text-gray-300">Start Creating Your Meme</p>
                        <p className="text-xs text-gray-500 max-w-xs">
                          Drag & drop photos into the left panel dropzone, load templates, or add text overlays to begin.
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
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 p-6 text-center text-white">
                    {audioUrl ? (
                      <>
                        <div className="text-4xl mb-3 animate-pulse">🎵</div>
                        <p className="text-xs font-semibold mb-4 text-purple-455 uppercase tracking-wider">Audio Waveform Container</p>
                        <audio 
                          ref={audioPlayerRef}
                          src={audioUrl} 
                          controls 
                          className="w-full max-w-xs" 
                        />
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
                          Upload background MP3 audio files or load a pre-set sample to enable audio output.
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

              <div>
                <span className="text-[10px] text-gray-400 block mb-2 font-normal">
                  Note: Separate keywords with comma. These keywords will be indexed to enable a smooth search and filtering.
                </span>
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
