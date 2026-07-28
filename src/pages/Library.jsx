import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  runTransaction
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import { useUserModal } from "../context/UserModalContext";
import { SUBJECTS, GRADE_GROUPS } from "../constants/taxonomy";

import { trackCustomSubmission } from "../utils/taxonomyUtils";
import {
  Search,
  Flame,
  Trophy,
  Star,
  Image,
  Video,
  Smile,
  MoreVertical,
  Heart,
  MessageSquare,
  Download,
  Bookmark,
  Sparkles,
  Music,
  X,
  Camera,
  Flag,
  ShieldCheck,
  AlertCircle,
  Lock,
  Share2,
  Shuffle
} from "lucide-react";

const Library = () => {
  const { user, profile } = useAuth();
  const { highContrastMode } = useUdl();
  const { openUserModal } = useUserModal();
  const navigate = useNavigate();

  // Memes list & filtering state
  const [memes, setMemes] = useState([]);
  const [filteredMemes, setFilteredMemes] = useState([]);
  const [userCache, setUserCache] = useState({});

  // Sidebar Filter Options
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [allRatings, setAllRatings] = useState([]);
  const [sortBy, setSortBy] = useState("newest");
  const [animatingHeartMemeId, setAnimatingHeartMemeId] = useState(null);
  const [likePendingMap, setLikePendingMap] = useState({});

  // Modals & Details Overlay
  const [activeMeme, setActiveMeme] = useState(null);
  const [allComments, setAllComments] = useState([]);        // all comments for active meme
  const [expertComments, setExpertComments] = useState([]);  // filtered: is_expert_comment === true
  const [userComments, setUserComments] = useState([]);      // filtered: is_expert_comment !== true
  const [newExpertComment, setNewExpertComment] = useState("");
  const [newUserComment, setNewUserComment] = useState("");
  const [activeModalTab, setActiveModalTab] = useState("comments"); // "comments" | "expert" | "ratings"
  const [showDirectUploadModal, setShowDirectUploadModal] = useState(false);

  // Ratings for current active meme
  const [currentMemeRatings, setCurrentMemeRatings] = useState([]);
  const [userSubmittedRating, setUserSubmittedRating] = useState(null);

  // Likes map for the current user
  const [userLikesMap, setUserLikesMap] = useState({});
  const [userSavesMap, setUserSavesMap] = useState({});

  // Direct Upload fields
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSubject, setUploadSubject] = useState("Biology");
  const [uploadCustomSubject, setUploadCustomSubject] = useState("");
  const [uploadGrade, setUploadGrade] = useState("High School (9–10)");
  const [uploadLanguage, setUploadLanguage] = useState("English");
  const [uploadCustomLanguage, setUploadCustomLanguage] = useState("");
  const [uploadKeywords, setUploadKeywords] = useState("");
  const [uploadFormat, setUploadFormat] = useState("image");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [filterSubjectSearch, setFilterSubjectSearch] = useState("");
  const [filterLanguageSearch, setFilterLanguageSearch] = useState("");
  const [formSubjectSearch, setFormSubjectSearch] = useState("");
  const [formLanguageSearch, setFormLanguageSearch] = useState("");

  const [subjects, setSubjects] = useState(SUBJECTS);
  const [gradeGroups, setGradeGroups] = useState(GRADE_GROUPS);
  const [languages, setLanguages] = useState(["English", "Hindi", "Malayalam", "Tamil", "Other"]);

  // Proportional white bottom border containing the MemeClassroom watermark and CC license text via CORS proxy
  const downloadMemeWithWatermark = async (imageUrl, title) => {
    try {
      // Use corsproxy.io to bypass browser caching and cross-origin blocking
      const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(imageUrl)}`;
      const response = await fetch(proxiedUrl);
      if (!response.ok) throw new Error("CORS proxy fetch failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const img = new Image();
      img.src = blobUrl;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const w = img.naturalWidth || img.width || 500;
        const h = img.naturalHeight || img.height || 500;

        // Proportional border height (approx 8% of image height, minimum 45px, maximum 120px)
        const borderHeight = Math.max(45, Math.min(120, Math.round(h * 0.08)));

        canvas.width = w;
        canvas.height = h + borderHeight;

        // Draw original image on top
        ctx.drawImage(img, 0, 0, w, h);

        // Draw bottom white border background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, h, w, borderHeight);

        // Draw a neat inner border around the meme image itself to separate it
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, w, h);

        // Proportional font size
        const fontSize = Math.max(11, Math.round(borderHeight * 0.28));
        ctx.fillStyle = "#374151"; // Slate-700
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textBaseline = "middle";

        const paddingX = Math.max(15, Math.round(w * 0.04));
        const textY = h + Math.round(borderHeight / 2);

        // Left aligned watermark
        ctx.textAlign = "left";
        ctx.fillText("MemeClassroom", paddingX, textY);

        // Right aligned watermark/license
        ctx.textAlign = "right";
        ctx.fillText("CC BY-NC-SA 4.0 License", w - paddingX, textY);

        // Draw a neat outer border around the entire downloaded card canvas
        ctx.strokeStyle = "#d1d5db";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        const link = document.createElement("a");
        link.download = `${title || 'meme'}_watermarked.png`;
        link.href = canvas.toDataURL("image/png");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        fallbackDirectDownload(imageUrl, title);
      };
    } catch (err) {
      console.error("Watermark download error, falling back", err);
      fallbackDirectDownload(imageUrl, title);
    }
  };

  const fallbackDirectDownload = (imageUrl, title) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.target = "_blank";
    link.download = `${title || 'meme'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Direct download for Videos and Audios with CC license toast reminder
  const handleMediaDownload = (url, title) => {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.download = title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert("License Notice: This media file is licensed under Creative Commons CC BY-NC-SA 4.0 parameters.");
  };

  const resolvedCreatorsRef = useRef({});

  // 1. Real-time Curation Feed Listener (Database-Side Sorting)
  useEffect(() => {
    const memesCol = collection(db, "memes");
    // Show only public, unflagged memes, sorted newest first
    const q = query(memesCol, where("visibility", "==", "public"), orderBy("created_at", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memeList = [];
      snapshot.forEach((doc) => {
        memeList.push({ id: doc.id, ...doc.data() });
      });

      setMemes(memeList);
      setFilteredMemes(memeList);
    }, (error) => {
      console.error("Firestore listening failed", error);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Ratings Subscription (to compute card-level averages on client)
  useEffect(() => {
    const ratingsCol = collection(db, "ratings");
    const unsubscribe = onSnapshot(ratingsCol, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push(doc.data());
      });
      setAllRatings(list);
    }, (error) => {
      console.error("Firestore ratings listening failed", error);
    });

    return () => unsubscribe();
  }, []);

  const getMemeAverageRating = (memeId, criteria) => {
    const memeRatings = allRatings.filter(r => r.meme_id === memeId && r[criteria] !== undefined && r[criteria] !== null);
    if (memeRatings.length === 0) return 0;
    const sum = memeRatings.reduce((acc, curr) => acc + (curr[criteria] || 0), 0);
    return sum / memeRatings.length;
  };

  const getMemeRatingCount = (memeId, criteria) => {
    return allRatings.filter(r => r.meme_id === memeId && r[criteria] !== undefined && r[criteria] !== null).length;
  };

  const getOverallAverageRating = (memeId) => {
    const ageAvg = getMemeAverageRating(memeId, "age_appropriateness");
    const langAvg = getMemeAverageRating(memeId, "language_appropriateness");
    const valAvg = getMemeAverageRating(memeId, "content_validity");
    const creatAvg = getMemeAverageRating(memeId, "creativity");
    const active = [ageAvg, langAvg, valAvg, creatAvg].filter(x => x > 0);
    return active.length > 0 ? active.reduce((sum, x) => sum + x, 0) / active.length : 0;
  };

  const getSubjectTagClass = (subj) => {
    switch (String(subj).toLowerCase()) {
      case 'maths':
      case 'math':
      case 'mathematics':
        return 'tag-subject-maths';
      case 'biology':
        return 'tag-subject-biology';
      case 'physics':
        return 'tag-subject-physics';
      case 'chemistry':
        return 'tag-subject-chemistry';
      case 'history':
        return 'tag-subject-history';
      case 'geography':
        return 'tag-subject-geography';
      default:
        return 'tag-subject-default';
    }
  };

  // Dedicated User profile (name and role) resolution listener
  useEffect(() => {
    const creatorIds = memes.map(m => m.creator_id);
    const commenterIds = expertComments.map(c => c.user_id);
    const uniqueIds = [...new Set([...creatorIds, ...commenterIds])];

    const fetchUsers = async () => {
      const idsToFetch = uniqueIds.filter(id => id !== "admin" && !resolvedCreatorsRef.current[id]);
      if (idsToFetch.length === 0) return;

      // Mark all as fetching
      idsToFetch.forEach(id => {
        resolvedCreatorsRef.current[id] = "fetching";
      });

      try {
        const newCacheUpdates = {};
        await Promise.all(idsToFetch.map(async (userId) => {
          try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              resolvedCreatorsRef.current[userId] = "fetched";
              newCacheUpdates[userId] = {
                name: userData.name || "Unknown User",
                role: userData.role || "student",
                is_verified: userData.is_verified || false,
                avatar_url: userData.avatar_url || "/avatar1.png"
              };
            } else {
              resolvedCreatorsRef.current[userId] = "fetched";
              newCacheUpdates[userId] = { name: "Unknown User", role: "student", is_verified: false, avatar_url: "/avatar1.png" };
            }
          } catch (e) {
            console.error("Error resolving user profile", e);
            resolvedCreatorsRef.current[userId] = "failed"; // set to failed to prevent infinite retry loop
          }
        }));

        if (Object.keys(newCacheUpdates).length > 0) {
          setUserCache(prev => ({ ...prev, ...newCacheUpdates }));
        }
      } catch (err) {
        console.error("Failed fetching users in batch", err);
      }
    };

    fetchUsers();
  }, [memes, expertComments]);

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
    });
    return () => unsub();
  }, []);

  // Real-time Likes list for the user (mapped to dedicated 'likes' collection)
  useEffect(() => {
    if (!user) return;
    const likesCol = collection(db, "likes");
    const q = query(likesCol, where("user_id", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        map[data.meme_id] = doc.id;
      });
      setUserLikesMap(map);
    }, (error) => {
      console.error("User likes subscription failed:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Real-time Saves/Bookmarks list for the user (mapped to dedicated 'saves' collection)
  useEffect(() => {
    if (!user) return;
    const savesCol = collection(db, "saves");
    const q = query(savesCol, where("user_id", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        map[data.meme_id] = doc.id;
      });
      setUserSavesMap(map);
    }, (error) => {
      console.error("User saves subscription failed:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // 2. Multi-Variable Sidebar Filtering Logic
  useEffect(() => {
    let result = memes;

    if (appliedSearchQuery.trim()) {
      const q = appliedSearchQuery.toLowerCase().trim();
      result = result.filter(m =>
        m.title?.toLowerCase().includes(q) ||
        (Array.isArray(m.keywords)
          ? m.keywords.some(k => k.toLowerCase().includes(q))
          : String(m.keywords || "").toLowerCase().includes(q))
      );
    }
    if (subjectFilter) {
      result = result.filter(m => m.subject === subjectFilter);
    }
    if (gradeFilter) {
      result = result.filter(m => m.age_group === gradeFilter);
    }
    if (languageFilter) {
      result = result.filter(m => m.language === languageFilter);
    }
    if (formatFilter) {
      result = result.filter(m => m.format === formatFilter);
    }

    // Dynamic sorting
    if (sortBy === "newest") {
      result = [...result].sort((a, b) => {
        const timeA = a.created_at?.seconds || 0;
        const timeB = b.created_at?.seconds || 0;
        return timeB - timeA;
      });
    } else if (sortBy === "likes") {
      result = [...result].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
    } else if (sortBy === "rating") {
      result = [...result].sort((a, b) => {
        const getOverall = (memeId) => {
          const ageAvg = getMemeAverageRating(memeId, "age_appropriateness");
          const langAvg = getMemeAverageRating(memeId, "language_appropriateness");
          const valAvg = getMemeAverageRating(memeId, "content_validity");
          const creatAvg = getMemeAverageRating(memeId, "creativity");
          const active = [ageAvg, langAvg, valAvg, creatAvg].filter(x => x > 0);
          return active.length > 0 ? active.reduce((sum, x) => sum + x, 0) / active.length : 0;
        };
        return getOverall(b.id) - getOverall(a.id);
      });
    }

    setFilteredMemes(result);
  }, [appliedSearchQuery, subjectFilter, gradeFilter, languageFilter, formatFilter, sortBy, memes, allRatings]);

  // Load All Comments & Ratings for the Active Expanded Meme
  useEffect(() => {
    let unsubscribeComments = () => { };
    let unsubscribeRatings = () => { };

    // Clear stale data immediately on activeMeme change
    setCurrentMemeRatings([]);
    setUserSubmittedRating(null);
    setAllComments([]);
    setExpertComments([]);
    setUserComments([]);

    if (activeMeme) {
      // Listen to ALL comments for this meme (separate expert vs user client-side)
      const commentsCol = collection(db, "comments");
      const commentsQuery = query(
        commentsCol,
        where("meme_id", "==", activeMeme.id)
      );

      unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
        const all = [];
        snapshot.forEach((doc) => { all.push({ id: doc.id, ...doc.data() }); });
        setAllComments(all);
        setExpertComments(all.filter(c => c.is_expert_comment === true));
        setUserComments(all.filter(c => !c.is_expert_comment));
      }, (error) => {
        console.error("Comments subscription failed:", error);
      });

      // Listen to ratings
      const ratingsCol = collection(db, "ratings");
      const ratingsQuery = query(ratingsCol, where("meme_id", "==", activeMeme.id));
      unsubscribeRatings = onSnapshot(ratingsQuery, (snapshot) => {
        const ratingList = [];
        snapshot.forEach((doc) => { ratingList.push({ id: doc.id, ...doc.data() }); });
        setCurrentMemeRatings(ratingList);
        if (user) {
          const myRating = ratingList.find(r => r.user_id === user.uid);
          setUserSubmittedRating(myRating || null);
        }
      }, (error) => {
        console.error("Ratings subscription failed:", error);
      });
    }

    return () => {
      unsubscribeComments();
      unsubscribeRatings();
    };
  }, [activeMeme, user]);

  // 3. Direct Finished Meme Upload
  const handleDirectUploadSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!uploadFile) {
      setUploadError("Please select a meme file to upload.");
      return;
    }

    setUploadLoading(true);
    setUploadError("");

    // Validate uploaded file matching selection format
    const fileType = uploadFile.type;
    const fileName = uploadFile.name;

    if (uploadFormat === "image") {
      if (!fileType.startsWith("image/") || fileType === "image/gif") {
        setUploadError("Selected file must be a static image (e.g. PNG, JPEG).");
        setUploadLoading(false);
        return;
      }
    } else if (uploadFormat === "gif") {
      if (fileType !== "image/gif" && !fileName.toLowerCase().endsWith(".gif")) {
        setUploadError("Selected file must be a GIF image.");
        setUploadLoading(false);
        return;
      }
    } else if (uploadFormat === "video") {
      if (!fileType.startsWith("video/")) {
        setUploadError("Selected file must be a video.");
        setUploadLoading(false);
        return;
      }
    } else if (uploadFormat === "audio") {
      if (!fileType.startsWith("audio/")) {
        setUploadError("Selected file must be an audio file.");
        setUploadLoading(false);
        return;
      }
    }

    try {
      const extension = fileName.split('.').pop() || "bin";
      const storageRef = ref(storage, `memes/${user.uid}_meme_${Date.now()}.${extension}`);
      const snapshot = await uploadBytes(storageRef, uploadFile);
      const fileUrl = await getDownloadURL(snapshot.ref);

      const finalSubject = uploadSubject === "Other" ? (uploadCustomSubject.trim() || "Other") : uploadSubject;
      const finalLanguage = uploadLanguage === "Other" ? (uploadCustomLanguage.trim() || "Other") : uploadLanguage;
      const parsedKeywords = uploadKeywords ? uploadKeywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean) : [];

      await addDoc(collection(db, "memes"), {
        title: uploadTitle || "Direct Gallery Upload",
        creator_id: user.uid,
        subject: finalSubject,
        age_group: uploadGrade,
        language: finalLanguage,
        keywords: parsedKeywords,
        format: uploadFormat,
        visibility: "public",
        media_url: fileUrl,
        template_id: "", // Direct uploads do not have a remix templates reference
        text_layers_json: "[]", // Schema alignment fix
        created_at: serverTimestamp()
      });

      if (uploadSubject === "Other" && uploadCustomSubject.trim()) {
        trackCustomSubmission("subject", uploadCustomSubject.trim());
      }
      if (uploadLanguage === "Other" && uploadCustomLanguage.trim()) {
        trackCustomSubmission("language", uploadCustomLanguage.trim());
      }

      // Update user stats
      const statsRef = doc(db, "user_stats", user.uid);
      await setDoc(statsRef, {
        memes_created_count: increment(1)
      }, { merge: true });

      setShowDirectUploadModal(false);
      setUploadTitle("");
      setUploadCustomSubject("");
      setUploadCustomLanguage("");
      setUploadKeywords("");
      setUploadFile(null);
    } catch (err) {
      console.error(err);
      setUploadError("Direct file upload failed. Try again.");
    } finally {
      setUploadLoading(false);
    }
  };

  // 4. Community Moderation (Flag content) — NEW PROTOCOL: no auto-hide, admin decides
  const [flaggedByUser, setFlaggedByUser] = useState({});
  const [showFlagPopup, setShowFlagPopup] = useState(false);
  const [libToast, setLibToast] = useState(null);

  const showLibToast = (message, type = "info") => {
    setLibToast({ message, type, id: Date.now() });
    setTimeout(() => setLibToast(null), 4500);
  };

  const handleFlagContent = async (memeId) => {
    if (!user) { showLibToast("Please sign in to report content.", "warning"); return; }
    if (flaggedByUser[memeId]) { showLibToast("You have already reported this content.", "info"); return; }
    try {
      // Check in Firestore if user already flagged
      const flagsRef = collection(db, "flags");
      const q = query(
        flagsRef,
        where("reporter_id", "==", user.uid),
        where("content_id", "==", memeId)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setFlaggedByUser((prev) => ({ ...prev, [memeId]: true }));
        showLibToast("You have already reported this content.", "info");
        return;
      }

      // Write flag record
      await addDoc(collection(db, "flags"), {
        reporter_id: user.uid,
        content_type: "meme",
        content_id: memeId,
        reason: "Inappropriate Content / Report",
        status: "pending",
        created_at: serverTimestamp()
      });

      // Increment flag_count on the meme — do NOT auto-hide
      const memeDocRef = doc(db, "memes", memeId);
      await updateDoc(memeDocRef, { flag_count: increment(1) });

      setFlaggedByUser((prev) => ({ ...prev, [memeId]: true }));
      setShowFlagPopup(true);
    } catch (e) {
      console.error("Flag content failed", e);
      showLibToast("Failed to submit report. Please try again.", "error");
    }
  };

  // 5. Like Matrix: increment/decrement total_likes_received of the creator
  const handleLikeToggle = async (memeId, creatorId) => {
    if (!user) return;
    if (likePendingMap[memeId]) return;

    // Concurrency block
    setLikePendingMap(prev => ({ ...prev, [memeId]: true }));

    // Trigger scale pop animation
    setAnimatingHeartMemeId(memeId);
    setTimeout(() => {
      setAnimatingHeartMemeId(null);
    }, 300);

    const existingLikeId = userLikesMap[memeId];
    const statsRef = doc(db, "user_stats", creatorId);
    const memeRef = doc(db, "memes", memeId);

    try {
      if (existingLikeId) {
        // Unlike: remove from likes & decrement creator likes count
        await deleteDoc(doc(db, "likes", existingLikeId));
        await setDoc(statsRef, {
          total_likes_received: increment(-1)
        }, { merge: true });
        await updateDoc(memeRef, {
          likes_count: increment(-1)
        });
      } else {
        // Like: create like document & increment creator likes count
        const likeDocId = `${user.uid}_${memeId}`;
        await setDoc(doc(db, "likes", likeDocId), {
          user_id: user.uid,
          meme_id: memeId,
          created_at: serverTimestamp()
        });
        await setDoc(statsRef, {
          total_likes_received: increment(1)
        }, { merge: true });
        await updateDoc(memeRef, {
          likes_count: increment(1)
        });
      }
    } catch (e) {
      console.error("Like toggle failed", e);
    } finally {
      // Clear block
      setLikePendingMap(prev => ({ ...prev, [memeId]: false }));
    }
  };

  // Save/Bookmark toggle logic
  const handleSaveToggle = async (meme) => {
    if (!user) {
      showLibToast("Please log in to save memes to your bookmarks.", "info");
      return;
    }
    const existingSaveId = userSavesMap[meme.id];
    try {
      if (existingSaveId) {
        // Remove bookmark
        await deleteDoc(doc(db, "saves", existingSaveId));
        showLibToast("Meme removed from your bookmarks.", "success");
      } else {
        // Save bookmark
        const saveDocId = `${user.uid}_${meme.id}`;
        await setDoc(doc(db, "saves", saveDocId), {
          user_id: user.uid,
          meme_id: meme.id,
          created_at: serverTimestamp()
        });
        showLibToast("Meme saved to your bookmarks!", "success");
      }
    } catch (e) {
      console.error("Save toggle failed", e);
      showLibToast("Failed to update bookmark. Please try again.", "error");
    }
  };

  // Share handler: Web Share API with clipboard fallback
  const handleShare = async (meme) => {
    const url = `${window.location.origin}/library`;
    const shareData = { title: meme.title || "Check out this meme on MemeClassroom!", url };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        showLibToast("Link copied to clipboard!", "success");
      } catch (_) {
        showLibToast("Could not copy link.", "error");
      }
    }
  };

  // 6. Ratings Tracker: Submit 1-to-5 star evaluation on 4 criteria
  const handleRateSubmit = async (criteria, score) => {
    if (!user || !activeMeme) return;

    const ratingDocId = `${user.uid}_${activeMeme.id}`;
    const ratingRef = doc(db, "ratings", ratingDocId);
    const statsRef = doc(db, "user_stats", user.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const ratingDoc = await transaction.get(ratingRef);
        const existingData = ratingDoc.exists() ? ratingDoc.data() : {};

        const statsDoc = await transaction.get(statsRef);
        const currentCount = statsDoc.exists() ? (statsDoc.data().ratings_provided_count || 0) : 0;

        let newRating = {
          meme_id: activeMeme.id,
          user_id: user.uid,
          ...existingData,
          [criteria]: score,
          updated_at: new Date()
        };

        if (!existingData.created_at) {
          newRating.created_at = new Date();
        }

        transaction.set(ratingRef, newRating);

        // Only increment user's ratings_provided_count if it's their first time rating this meme
        if (!ratingDoc.exists()) {
          transaction.set(statsRef, {
            ratings_provided_count: currentCount + 1
          }, { merge: true });
        }
      });
    } catch (e) {
      console.error("Rating transaction failed", e);
    }
  };

  // 7. User Comment submission (any logged-in user)
  const handleUserCommentSubmit = async (e) => {
    e.preventDefault();
    if (!user || !activeMeme || !newUserComment.trim()) return;
    try {
      await addDoc(collection(db, "comments"), {
        meme_id: activeMeme.id,
        user_id: user.uid,
        body: newUserComment.trim(),
        timestamp: serverTimestamp(),
        parent_id: null,
        is_expert_comment: false
      });
      setNewUserComment("");
    } catch (e) {
      console.error("User comment save failed", e);
      showLibToast("Failed to post comment. Please try again.", "error");
    }
  };

  // 8. Expert Review submission
  const handleExpertCommentSubmit = async (e) => {
    e.preventDefault();
    if (!user || !profile || !activeMeme || !newExpertComment) return;

    // Enforce role-based locking: must have expert role matching the subject area
    if (profile.role !== "expert" && profile.role !== "admin") return;
    // (Optional subject match check if user has custom subject field, e.g. profile.field)

    try {
      await addDoc(collection(db, "comments"), {
        meme_id: activeMeme.id,
        user_id: user.uid,
        body: newExpertComment,
        timestamp: serverTimestamp(),
        parent_id: null,
        is_expert_comment: true // Sets high-priority expert verification flag
      });

      setNewExpertComment("");
    } catch (e) {
      console.error("Expert comment save failed", e);
    }
  };

  const handleDeleteMeme = async (memeId) => {
    if (!window.confirm("Are you sure you want to delete this meme? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "memes", memeId));
      if (user) {
        const statsDocRef = doc(db, "user_stats", user.uid);
        await setDoc(statsDocRef, {
          memes_created_count: increment(-1)
        }, { merge: true });
      }
      setActiveMeme(null);
      alert("Meme deleted successfully.");
    } catch (e) {
      console.error("Failed to delete meme", e);
      alert("Failed to delete meme. Please try again.");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    try {
      await deleteDoc(doc(db, "comments", commentId));
      alert("Comment deleted successfully.");
    } catch (e) {
      console.error("Failed to delete comment", e);
      alert("Failed to delete comment. Please try again.");
    }
  };

  // Helper to compute average criteria score
  const getAverageScore = (criteria) => {
    if (currentMemeRatings.length === 0) return 0;
    const validRatings = currentMemeRatings.filter(r => r[criteria] !== undefined && r[criteria] !== null);
    if (validRatings.length === 0) return 0;
    const sum = validRatings.reduce((acc, curr) => acc + (curr[criteria] || 0), 0);
    return sum / validRatings.length;
  };

  const getScoreCount = (criteria) => {
    return currentMemeRatings.filter(r => r[criteria] !== undefined && r[criteria] !== null).length;
  };

  // Dynamic styling configurations for UDL contrast adjustments
  const containerClass = "bg-white/45 dark:bg-zinc-900/45 backdrop-blur-sm border border-gray-200/50 dark:border-zinc-800/40 shadow-md hover:shadow-xl rounded-xl transition-all duration-300";

  const inputClass = highContrastMode
    ? "w-full px-3 py-2 border border-zinc-800 bg-zinc-950 rounded-lg text-xs text-white placeholder-gray-500"
    : "w-full px-3 py-2 border border-gray-300 bg-gray-50 rounded-lg text-xs text-gray-850";

  const btnClass = "bg-purple-600 hover:bg-purple-750 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition shadow-sm";

  /**
   * VideoWithCaptions — renders a <video> with timed text captions overlaid.
   * Reads captions_json (array of { time, text }) from the meme document and
   * shows the matching caption as a subtitle bar at the bottom of the player.
   */
  const VideoWithCaptions = ({ meme }) => {
    const vidRef = React.useRef(null);
    const [activeCaption, setActiveCaption] = React.useState("");

    // Parse captions once from the Firestore field
    const captions = React.useMemo(() => {
      if (!meme?.captions_json) return [];
      try {
        const parsed = JSON.parse(meme.captions_json);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }, [meme?.captions_json]);

    React.useEffect(() => {
      const video = vidRef.current;
      if (!video || captions.length === 0) return;

      const handleTimeUpdate = () => {
        const t = video.currentTime;
        // Find the last caption whose time is <= current time
        let matched = "";
        for (const cap of captions) {
          if (cap.time <= t) matched = cap.text;
        }
        setActiveCaption(matched);
      };

      video.addEventListener("timeupdate", handleTimeUpdate);
      return () => video.removeEventListener("timeupdate", handleTimeUpdate);
    }, [captions]);

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <video
          ref={vidRef}
          src={meme.media_url}
          controls
          className="max-w-full max-h-full"
        />
        {activeCaption && (
          <div
            className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none px-4"
            aria-live="polite"
          >
            <span
              className="bg-black/75 text-white text-sm font-semibold px-4 py-1.5 rounded-lg shadow-lg max-w-[90%] text-center leading-snug"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
            >
              {activeCaption}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">

      {/* Library Toast */}
      {libToast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-start gap-3 px-5 py-4 rounded-xl shadow-2xl text-white text-sm font-medium max-w-sm ${libToast.type === "success" ? "bg-green-600" : libToast.type === "warning" ? "bg-yellow-500 text-gray-900" : libToast.type === "error" ? "bg-red-600" : "bg-indigo-600"
          }`}>
          <span className="flex-1">{libToast.message}</span>
          <button onClick={() => setLibToast(null)} className="opacity-70 hover:opacity-100 font-bold text-lg leading-none">×</button>
        </div>
      )}

      {/* Flag Popup */}
      {showFlagPopup && (
        <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4" onClick={() => setShowFlagPopup(false)}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-8 max-w-sm text-center space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center text-purple-650 dark:text-purple-400"><Flag className="w-12 h-12 animate-bounce" /></div>
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Report Submitted</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Thank you for reporting. This content will only be removed upon admin review and approval.
            </p>
            <button onClick={() => setShowFlagPopup(false)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition">
              Got it
            </button>
          </div>
        </div>
      )}

      <style>{`
        .gallery-header-title {
          background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        @keyframes cardEntrance {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .meme-card-animate {
          animation: cardEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes heartPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.4); }
          100% { transform: scale(1); }
        }

        .heart-pop-active {
          animation: heartPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }

        .tag-subject-maths {
          background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%) !important;
          color: white !important;
          border: none !important;
        }
        .tag-subject-biology {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          color: white !important;
          border: none !important;
        }
        .tag-subject-physics {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
          color: white !important;
          border: none !important;
        }
        .tag-subject-chemistry {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
          color: white !important;
          border: none !important;
        }
        .tag-subject-history {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%) !important;
          color: white !important;
          border: none !important;
        }
        .tag-subject-geography {
          background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%) !important;
          color: white !important;
          border: none !important;
        }
        .tag-subject-default {
          background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%) !important;
          color: white !important;
          border: none !important;
        }
      `}</style>

      {/* Page Title & Search Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white font-sans gallery-header-title">Explore Memes</h1>
          <p className="text-xs text-gray-500 mt-1">Discover and evaluate humor-based classroom assets.</p>
        </div>

        {/* Search Bar Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedSearchQuery(searchQuery);
          }}
          className="flex-grow max-w-md flex items-center bg-white dark:bg-zinc-900 px-4 py-1.5 rounded-full border border-gray-200 dark:border-zinc-800 shadow-md dark:shadow-black/25 focus-within:shadow-lg focus-within:shadow-purple-500/10 dark:focus-within:shadow-black/40 focus-within:ring-2 focus-within:ring-purple-500 transition-all duration-300"
        >
          <Search className="w-4 h-4 text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search memes, topics or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-0 text-xs focus:outline-none dark:text-white placeholder-gray-400 py-1.5"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setAppliedSearchQuery("");
              }}
              className="text-gray-400 hover:text-gray-600 text-xs px-2"
            >
              ✕
            </button>
          )}
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs p-2 rounded-full transition flex items-center justify-center w-8 h-8 shrink-0"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Horizontal tag filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none select-none">
        <button
          onClick={() => {
            setSubjectFilter("");
            setAppliedSearchQuery("");
          }}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${(!subjectFilter && !appliedSearchQuery) ? "bg-purple-100 text-purple-750 dark:bg-purple-950/40 dark:text-purple-300" : "bg-white dark:bg-zinc-900 text-gray-500 hover:bg-gray-50 border border-gray-200 dark:border-zinc-800"}`}
        >
          <Flame className="w-3.5 h-3.5 text-orange-500 animate-pulse" /> Trending
        </button>
        {["Exams", "Teachers", "Assignments", "Science", "Coding", "Relatable"].map((tag) => {
          const isActive = subjectFilter === tag || appliedSearchQuery === tag;
          return (
            <button
              key={tag}
              onClick={() => {
                setSubjectFilter(tag);
                setAppliedSearchQuery("");
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${isActive ? "bg-purple-100 text-purple-750 dark:bg-purple-950/40 dark:text-purple-300" : "bg-white dark:bg-zinc-900 text-gray-500 hover:bg-gray-50 border border-gray-200 dark:border-zinc-800"}`}
            >
              {tag}
            </button>
          );
        })}
        <button
          onClick={() => {
            setSubjectFilter("");
            setGradeFilter("");
            setLanguageFilter("");
            setFormatFilter("");
            setSearchQuery("");
            setAppliedSearchQuery("");
          }}
          className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline ml-2"
        >
          View all
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_200px] gap-5 items-start">
        {/* Left Column: Sorting & Filtering (lg:col-span-1) */}
        <div className={`p-3 h-fit ${containerClass}`}>
          <div className="mb-6">
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-2">SORT BY</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={inputClass}
            >
              <option value="newest">Newest Uploads</option>
              <option value="likes">Most Popular (Likes)</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>

          <h2 className="text-[11px] font-bold uppercase tracking-wider mb-4 border-b pb-2 text-gray-400">FILTERS</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Subject</label>
              <input
                type="text"
                placeholder="Search subject..."
                value={filterSubjectSearch}
                onChange={(e) => setFilterSubjectSearch(e.target.value)}
                className="w-full px-2 py-1 mb-1 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded text-[10px]"
              />
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">All Subjects</option>
                {subjects
                  .filter(s => s !== "Other" && s.toLowerCase().includes(filterSubjectSearch.toLowerCase()))
                  .map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Grade</label>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">All Grades</option>
                {gradeGroups.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Language</label>
              <input
                type="text"
                placeholder="Search language..."
                value={filterLanguageSearch}
                onChange={(e) => setFilterLanguageSearch(e.target.value)}
                className="w-full px-2 py-1 mb-1 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded text-[10px]"
              />
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">All Languages</option>
                {languages
                  .filter(lang => lang !== "Other" && lang.toLowerCase().includes(filterLanguageSearch.toLowerCase()))
                  .map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Format</label>
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">All Formats</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="gif">GIF</option>
                <option value="audio">Audio</option>
              </select>
            </div>

            {(subjectFilter || gradeFilter || languageFilter || formatFilter || appliedSearchQuery) && (
              <button
                onClick={() => {
                  setSubjectFilter("");
                  setGradeFilter("");
                  setLanguageFilter("");
                  setFormatFilter("");
                  setSearchQuery("");
                  setAppliedSearchQuery("");
                }}
                className="w-full text-center text-xs font-semibold text-red-650 hover:underline pt-2"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Direct Upload Option */}
          {user && (
            <div className="mt-8 border-t pt-4">
              <button
                onClick={() => setShowDirectUploadModal(true)}
                className={`${btnClass} w-full`}
              >
                Direct Meme Upload
              </button>
            </div>
          )}
        </div>

        {/* Center Column: Feed */}
        <div className="space-y-5 min-w-0">
          {/* Share a meme with the classroom container */}
          <div
            onClick={() => user ? setShowDirectUploadModal(true) : navigate("/auth")}
            className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm p-4 rounded-2xl border border-gray-200/50 dark:border-zinc-800/40 shadow-md dark:shadow-black/20 hover:shadow-lg cursor-pointer transition-all duration-300 select-none flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <img
                src={profile?.avatar_url || user?.photoURL || "/avatar1.png"}
                alt="User"
                className="w-9 h-9 rounded-full object-cover border border-purple-100/50"
              />
              <span className="text-gray-400 text-xs font-medium">Share a meme with the classroom...</span>
            </div>
            <div className="flex items-center gap-3 text-gray-400 mr-2">
              <span title="Add Image" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
                <Image className="w-5 h-5" />
              </span>
              <span title="Add GIF" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
                <Camera className="w-5 h-5" />
              </span>
              <span title="Add Emoji" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
                <Smile className="w-5 h-5" />
              </span>
            </div>
          </div>

          {filteredMemes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMemes.map((meme) => {
                const isLiked = !!userLikesMap[meme.id];
                const isSaved = !!userSavesMap[meme.id];
                const creatorName = meme.creator_id === "admin" ? "Admin" : (userCache[meme.creator_id]?.name || "Creator");
                const timeAgo = meme.created_at ? "2h ago" : "Just now";

                return (
                  <div key={meme.id} className="flex flex-col h-full bg-white/45 dark:bg-zinc-900/45 backdrop-blur-sm border border-gray-200/50 dark:border-zinc-800/40 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
                    {/* Card Header: Avatar & Option Menu */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100/50 dark:border-zinc-800/40">
                      <div
                        onClick={(e) => { e.stopPropagation(); openUserModal(meme.creator_id); }}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <img
                          src={userCache[meme.creator_id]?.avatar_url || "/avatar1.png"}
                          alt={creatorName}
                          className="w-8 h-8 rounded-full object-cover border border-purple-100"
                        />
                        <div>
                          <h5 className="text-[11px] font-extrabold text-gray-900 dark:text-white group-hover:text-purple-650 transition truncate max-w-[120px]">{creatorName}</h5>
                          <span className="text-[9px] text-gray-400 block">{timeAgo}</span>
                        </div>
                      </div>

                      <button className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 p-1" title="Options">
                        ⋮
                      </button>
                    </div>

                    {/* Card Body: Caption text & Media container */}
                    <div className="p-4 flex-grow flex flex-col justify-between">
                      {meme.title && (
                        <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200 mb-3 leading-relaxed">
                          {meme.title}
                        </p>
                      )}

                      {/* Media Image/Video Box — adaptive height, portrait & landscape friendly */}
                      <div className="relative w-full bg-zinc-950 flex items-center justify-center overflow-hidden rounded-xl border border-gray-200/10 shadow-inner group" style={{ height: '210px' }}>
                        {/* Hover View Details Overlay */}
                        <div
                          onClick={() => setActiveMeme(meme)}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer z-10"
                        >
                          <span className="bg-white/90 dark:bg-zinc-900/90 text-gray-900 dark:text-white px-3.5 py-1.5 rounded-full text-[10px] font-bold shadow-md hover:scale-105 transition-transform flex items-center gap-1">
                            👁️ View Details
                          </span>
                        </div>

                        {meme.format === "image" && (
                          <img src={meme.media_url} alt={meme.title} className="w-full h-full object-contain" />
                        )}
                        {meme.format === "video" && (
                          <div className="w-full h-full">
                            <VideoWithCaptions meme={meme} />
                          </div>
                        )}
                        {meme.format === "gif" && (
                          <img src={meme.media_url} alt={meme.title} className="w-full h-full object-contain" />
                        )}
                        {meme.format === "audio" && (
                          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-indigo-950/20">
                            <span className="text-3xl mb-1.5">🎵</span>
                            <audio src={meme.media_url} controls className="w-full max-w-xs scale-90" />
                          </div>
                        )}
                      </div>

                      {/* Subject, Grade & Rating pill row */}
                      <div className="flex items-start justify-between gap-1.5 mt-3.5">
                        <div className="flex flex-wrap items-center gap-1 min-w-0 flex-1">
                          <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold shadow-sm ${getSubjectTagClass(meme.subject)}`}>
                            {meme.subject}
                          </span>
                          <span className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 text-[8px] px-2 py-0.5 rounded-full font-bold">
                            {meme.age_group}
                          </span>
                        </div>
                        {/* Rating — anchored top right */}
                        <button
                          onClick={() => setActiveMeme(meme)}
                          className="shrink-0 flex items-center gap-1 text-yellow-500 hover:text-yellow-600 hover:scale-110 active:scale-95 transition-all bg-yellow-50/50 dark:bg-yellow-950/20 px-1.5 py-0.5 rounded-full border border-yellow-200/50 dark:border-yellow-800/40"
                          title={getOverallAverageRating(meme.id) > 0
                            ? `Rating: ${getOverallAverageRating(meme.id).toFixed(1)}/5 — click to rate`
                            : 'Not yet rated — click to rate'}
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-yellow-500" strokeWidth={1.5} />
                          <span className="text-[10px] font-extrabold tabular-nums text-yellow-700 dark:text-yellow-400">
                            {getOverallAverageRating(meme.id) > 0
                              ? getOverallAverageRating(meme.id).toFixed(1)
                              : '—'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Card Footer: 7-icon action row — outline/minimalistic style */}
                    <div className="px-3 pb-3 pt-2 border-t border-gray-100/50 dark:border-zinc-800/40">
                      <div className="flex items-center justify-between text-gray-400 dark:text-gray-500">

                        {/* 1. Like */}
                        <button
                          onClick={() => user
                            ? handleLikeToggle(meme.id, meme.creator_id)
                            : showLibToast("Sign in to like memes.", "info")}
                          className={`flex items-center gap-0.5 hover:scale-110 active:scale-95 transition-all ${isLiked ? 'text-red-500' : 'hover:text-red-500'}`}
                          title="Like"
                        >
                          <Heart
                            className={`w-[15px] h-[15px] ${isLiked ? 'fill-current' : ''} ${animatingHeartMemeId === meme.id ? 'heart-pop-active' : ''}`}
                            strokeWidth={1.5}
                          />
                          <span className="text-[9px] font-bold tabular-nums">{meme.likes_count || 0}</span>
                        </button>

                        {/* 2. Comment */}
                        <button
                          onClick={() => setActiveMeme(meme)}
                          className="hover:text-blue-500 hover:scale-110 active:scale-95 transition-all"
                          title="Comment"
                        >
                          <MessageSquare className="w-[15px] h-[15px]" strokeWidth={1.5} />
                        </button>

                        {/* 3. Share */}
                        <button
                          onClick={() => handleShare(meme)}
                          className="hover:text-green-500 hover:scale-110 active:scale-95 transition-all"
                          title="Share"
                        >
                          <Share2 className="w-[15px] h-[15px]" strokeWidth={1.5} />
                        </button>

                        {/* 4. Download */}
                        <button
                          onClick={() => {
                            if (meme.format === "image" || meme.format === "gif") {
                              downloadMemeWithWatermark(meme.media_url, meme.title);
                            } else {
                              handleMediaDownload(meme.media_url, meme.title);
                            }
                          }}
                          className="hover:text-indigo-500 hover:scale-110 active:scale-95 transition-all"
                          title="Download"
                        >
                          <Download className="w-[15px] h-[15px]" strokeWidth={1.5} />
                        </button>

                        {/* 5. Remix / Customise */}
                        <button
                          onClick={() => navigate(`/lab?templateId=${meme.id}`)}
                          className="hover:text-purple-500 hover:scale-110 active:scale-95 transition-all"
                          title="Remix"
                        >
                          <Shuffle className="w-[15px] h-[15px]" strokeWidth={1.5} />
                        </button>

                        {/* 6. Bookmark */}
                        <button
                          onClick={() => handleSaveToggle(meme)}
                          className={`hover:scale-110 active:scale-95 transition-all ${isSaved ? 'text-amber-500' : 'hover:text-amber-500'}`}
                          title="Bookmark"
                        >
                          <Bookmark
                            className={`w-[15px] h-[15px] ${isSaved ? 'fill-current' : ''}`}
                            strokeWidth={1.5}
                          />
                        </button>

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm border border-gray-200/50 dark:border-zinc-800/40 rounded-2xl p-12 text-center text-gray-500 shadow-md flex flex-col items-center justify-center">
              <div className="flex justify-center text-gray-400 mb-3"><Flag className="w-12 h-12" /></div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">No matching memes found</h3>
              <p className="text-xs text-gray-400">Try broadening your subject, grade or format choices.</p>
            </div>
          )}

          {/* Create. Share. Inspire. banner */}
          <div className="bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10 border border-amber-200/50 dark:border-amber-800/30 p-5 rounded-2xl flex items-center justify-between gap-4 shadow-md hover:shadow-lg transition-all duration-300 select-none">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⭐</span>
              <div>
                <h4 className="text-sm font-extrabold text-gray-900 dark:text-white leading-tight">Create. Share. Inspire.</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">Add your memes and make the classroom a happier place.</p>
              </div>
            </div>
            {user && (
              <button
                onClick={() => setShowDirectUploadModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-sm hover:shadow"
              >
                Upload Meme
              </button>
            )}
          </div>
        </div>

        {/* Right Sidebar: Trending & Top Creators */}
        <div className="space-y-5">
          {/* Trending Now Card */}
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm p-5 rounded-2xl border border-gray-200/50 dark:border-zinc-800/40 shadow-md dark:shadow-black/25 hover:shadow-lg transition-all duration-300 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
              🔥 Trending Now
            </h3>
            <div className="space-y-3">
              {(() => {
                const subjectCounts = {};
                memes.forEach(m => {
                  if (m.subject) subjectCounts[m.subject] = (subjectCounts[m.subject] || 0) + 1;
                });
                const sortedSubjects = Object.entries(subjectCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5);

                if (sortedSubjects.length === 0) {
                  return <p className="text-[10px] text-gray-400 italic">No trends available.</p>;
                }

                return sortedSubjects.map(([subject, count]) => (
                  <div
                    key={subject}
                    onClick={() => setSubjectFilter(subject)}
                    className="flex justify-between items-center text-xs font-semibold cursor-pointer hover:text-purple-650 transition"
                  >
                    <span className="text-gray-705 dark:text-zinc-350">{subject}</span>
                    <span className="text-gray-400 text-[10px] tabular-nums">{count} {count === 1 ? 'meme' : 'memes'}</span>
                  </div>
                ));
              })()}
            </div>
            <button
              onClick={() => setSubjectFilter("")}
              className="text-[10px] text-purple-600 dark:text-purple-400 font-bold hover:underline block pt-1"
            >
              View all trends →
            </button>
          </div>

          {/* Top Creators Card */}
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm p-5 rounded-2xl border border-gray-200/50 dark:border-zinc-800/40 shadow-md dark:shadow-black/25 hover:shadow-lg transition-all duration-300 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
              🏆 Top Creators
            </h3>
            <div className="space-y-3">
              {(() => {
                const creatorCounts = {};
                memes.forEach(m => {
                  if (m.creator_id) creatorCounts[m.creator_id] = (creatorCounts[m.creator_id] || 0) + 1;
                });
                const sortedCreators = Object.entries(creatorCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3);

                if (sortedCreators.length === 0) {
                  return <p className="text-[10px] text-gray-400 italic">No creators active yet.</p>;
                }

                return sortedCreators.map(([creatorId, count]) => {
                  const creatorInfo = userCache[creatorId] || { name: creatorId === "admin" ? "Admin" : "Contributor" };
                  return (
                    <div
                      key={creatorId}
                      onClick={() => openUserModal(creatorId)}
                      className="flex items-center justify-between text-xs font-semibold cursor-pointer hover:text-purple-650 transition"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={creatorInfo.avatar_url || "/avatar1.png"}
                          alt={creatorInfo.name}
                          className="w-6 h-6 rounded-full object-cover border border-purple-100"
                        />
                        <span className="text-gray-750 dark:text-zinc-350 truncate max-w-[100px]">{creatorInfo.name}</span>
                      </div>
                      <span className="text-gray-400 text-[10px] tabular-nums">{count} {count === 1 ? 'meme' : 'memes'}</span>
                    </div>
                  );
                });
              })()}
            </div>
            <button
              onClick={() => navigate("/staffroom")}
              className="text-[10px] text-purple-600 dark:text-purple-400 font-bold hover:underline block pt-1"
            >
              View leaderboard →
            </button>
          </div>
        </div>
      </div>

      {/* 2. MEME DETAIL OVERLAY EXPANSION MODAL */}
      {activeMeme && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl p-6 rounded-2xl overflow-y-auto max-h-[90vh] grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-zinc-900 shadow-2xl border border-gray-200 dark:border-zinc-700">

            {/* Left Column: Visual Asset & Title */}
            <div>
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-extrabold leading-tight">{activeMeme.title}</h2>
                <button
                  onClick={() => setActiveMeme(null)}
                  className="text-gray-400 hover:text-gray-500 font-bold md:hidden"
                >
                  ✕
                </button>
              </div>

              {/* Detail Preview Area — adaptive aspect ratio for landscape & portrait */}
              <div className="bg-black rounded-xl overflow-hidden flex items-center justify-center mb-3 w-full" style={{ maxHeight: '55vh', minHeight: '200px' }}>
                {activeMeme.format === "image" && (
                  <img src={activeMeme.media_url} alt={activeMeme.title} className="max-w-full max-h-full object-contain" />
                )}
                {activeMeme.format === "video" && (
                  <VideoWithCaptions meme={activeMeme} />
                )}
                {activeMeme.format === "gif" && (
                  <img src={activeMeme.media_url} alt={activeMeme.title} className="max-w-full max-h-full object-contain" />
                )}
                {activeMeme.format === "audio" && (
                  <audio src={activeMeme.media_url} controls className="w-full px-6" />
                )}
              </div>

              {/* Modal Icon Action Row — outline minimalistic style, visible contrast */}
              <div className="flex items-center justify-between mb-3 px-1 pb-3 border-b border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400">
                {/* Like */}
                <button
                  onClick={() => user
                    ? handleLikeToggle(activeMeme.id, activeMeme.creator_id)
                    : showLibToast("Sign in to like memes.", "info")}
                  className={`flex items-center gap-1 hover:scale-110 transition-all ${
                    userLikesMap[activeMeme.id] ? 'text-red-500' : 'hover:text-red-500'
                  }`}
                  title="Like"
                >
                  <Heart
                    className={`w-4 h-4 ${userLikesMap[activeMeme.id] ? 'fill-current' : ''}`}
                    strokeWidth={1.5}
                  />
                  <span className="text-[10px] font-bold tabular-nums">{activeMeme.likes_count || 0}</span>
                </button>

                {/* Comment */}
                <button
                  className="hover:text-blue-500 hover:scale-110 transition-all"
                  title={user ? "Comments" : "Sign in to comment"}
                  onClick={() => setActiveModalTab("comments")}
                >
                  <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
                </button>

                {/* Share */}
                <button
                  onClick={() => handleShare(activeMeme)}
                  className="hover:text-green-500 hover:scale-110 transition-all"
                  title="Share"
                >
                  <Share2 className="w-4 h-4" strokeWidth={1.5} />
                </button>

                {/* Download */}
                <button
                  onClick={() => {
                    if (activeMeme.format === "image" || activeMeme.format === "gif") {
                      downloadMemeWithWatermark(activeMeme.media_url, activeMeme.title);
                    } else {
                      handleMediaDownload(activeMeme.media_url, activeMeme.title);
                    }
                  }}
                  className="hover:text-indigo-500 hover:scale-110 transition-all"
                  title="Download (CC BY-NC-SA 4.0)"
                >
                  <Download className="w-4 h-4" strokeWidth={1.5} />
                </button>

                {/* Rating — switches to ratings tab */}
                <button
                  onClick={() => setActiveModalTab("ratings")}
                  className="flex items-center gap-1 text-yellow-500 hover:text-yellow-600 hover:scale-110 transition-all"
                  title="Rating"
                >
                  <Star className="w-4 h-4 fill-amber-400 text-yellow-500" strokeWidth={1.5} />
                  <span className="text-xs font-extrabold tabular-nums">
                    {(() => { const o = getOverallAverageRating(activeMeme.id); return o > 0 ? o.toFixed(1) : '—'; })()}
                  </span>
                </button>

                {/* Remix */}
                <button
                  onClick={() => navigate(`/lab?templateUrl=${encodeURIComponent(activeMeme.media_url)}&format=${activeMeme.format}&clearText=true`)}
                  className="hover:text-purple-500 hover:scale-110 transition-all"
                  title="Remix"
                >
                  <Shuffle className="w-4 h-4" strokeWidth={1.5} />
                </button>

                {/* Bookmark — login required */}
                <button
                  onClick={() => handleSaveToggle(activeMeme)}
                  className={`hover:scale-110 transition-all ${
                    userSavesMap[activeMeme.id] ? 'text-amber-500' : 'hover:text-amber-500'
                  }`}
                  title={user ? "Bookmark" : "Sign in to bookmark"}
                >
                  <Bookmark
                    className={`w-4 h-4 ${userSavesMap[activeMeme.id] ? 'fill-current' : ''}`}
                    strokeWidth={1.5}
                  />
                </button>

                {/* Flag */}
                <button
                  onClick={() => handleFlagContent(activeMeme.id)}
                  className="hover:text-red-500 hover:scale-110 transition-all"
                  title="Report"
                >
                  <Flag className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              {/* Creator details and potential Delete option */}

              <div className="flex justify-between items-center text-xs font-semibold text-gray-500">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openUserModal(activeMeme.creator_id)}
                    className="hover:underline text-purple-750"
                  >
                    By {activeMeme.creator_id === "admin" ? "Admin" : (userCache[activeMeme.creator_id]?.name || "Creator")}
                  </button>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-red-500 fill-current" /> {activeMeme.likes_count || 0} Likes</span>
                </div>
                {user && (activeMeme.creator_id === user.uid || profile?.role === "admin") && (
                  <button
                    onClick={() => handleDeleteMeme(activeMeme.id)}
                    className="text-red-500 hover:text-red-750 hover:underline transition"
                  >
                    Delete Meme
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Tabbed — Comments | Expert Comments | Ratings */}
            <div className="flex flex-col h-full min-h-0">

              {/* Tab bar + close button */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-0.5 bg-gray-100 dark:bg-zinc-800 rounded-lg p-0.5">
                  {[
                    { key: "comments", label: "Comments", count: userComments.length },
                    { key: "expert",   label: "Expert",   count: expertComments.length },
                    { key: "ratings",  label: "Ratings",  count: currentMemeRatings.length }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveModalTab(tab.key)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                        activeModalTab === tab.key
                          ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      }`}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[9px] font-bold px-1.5 rounded-full">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setActiveMeme(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 font-bold text-lg leading-none p-1"
                >
                  ✕
                </button>
              </div>

              {/* ── TAB: Comments (any user) ── */}
              {activeModalTab === "comments" && (
                <div className="flex flex-col flex-1 min-h-0">
                  <div id="modal-comment-section" className="flex-1 overflow-y-auto space-y-3 mb-3 max-h-[42vh] pr-1">
                    {userComments.length === 0 ? (
                      <p className="text-center text-gray-400 dark:text-gray-500 text-xs py-10 italic">
                        No comments yet. Be the first to share your thoughts!
                      </p>
                    ) : (
                      userComments
                        .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
                        .map(comment => {
                          const commenter = userCache[comment.user_id];
                          const commenterName = commenter?.name || "Anonymous";
                          const isAuthor = user && (comment.user_id === user.uid || profile?.role === "admin");
                          return (
                            <div key={comment.id} className="flex gap-2.5 text-xs">
                              <img
                                src={commenter?.avatar_url || "/avatar1.png"}
                                alt={commenterName}
                                className="w-7 h-7 rounded-full object-cover border border-purple-100 shrink-0 mt-0.5"
                              />
                              <div className="flex-1 bg-gray-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold text-gray-800 dark:text-zinc-200">{commenterName}</span>
                                  <div className="flex items-center gap-2 text-gray-400">
                                    <span className="text-[9px]">
                                      {comment.timestamp?.seconds
                                        ? new Date(comment.timestamp.seconds * 1000).toLocaleDateString()
                                        : "Just now"}
                                    </span>
                                    {isAuthor && (
                                      <button
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="text-red-400 hover:text-red-600 font-bold transition"
                                      >×</button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-gray-700 dark:text-zinc-300 leading-relaxed">{comment.body}</p>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                  {/* Comment input */}
                  {user ? (
                    <form onSubmit={handleUserCommentSubmit} className="flex gap-2 border-t border-gray-100 dark:border-zinc-800 pt-3">
                      <img
                        src={profile?.avatar_url || user?.photoURL || "/avatar1.png"}
                        alt="You"
                        className="w-7 h-7 rounded-full object-cover border border-purple-100 shrink-0"
                      />
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          placeholder="Write a comment…"
                          value={newUserComment}
                          onChange={(e) => setNewUserComment(e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                          required
                        />
                        <button
                          type="submit"
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition"
                        >
                          Post
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="border-t border-gray-100 dark:border-zinc-800 pt-3 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Sign in to leave a comment.
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: Expert Comments ── */}
              {activeModalTab === "expert" && (
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto space-y-3 mb-3 max-h-[42vh] pr-1">
                    {expertComments.length === 0 ? (
                      <p className="text-center text-gray-400 dark:text-gray-500 text-xs py-10 italic">
                        No expert comments for this meme yet.
                      </p>
                    ) : (
                      expertComments
                        .filter(comment => {
                          const commenter = userCache[comment.user_id];
                          return commenter?.role === "expert" || commenter?.role === "admin" || commenter?.is_verified === true || comment.user_id === "admin";
                        })
                        .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
                        .map(comment => {
                          const commenter = userCache[comment.user_id];
                          const commenterName = commenter?.name || "Expert Reviewer";
                          const isAuthor = user && (comment.user_id === user.uid || profile?.role === "admin");
                          return (
                            <div key={comment.id} className="flex gap-2.5 text-xs">
                              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 mt-0.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div className="flex-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl px-3 py-2">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{commenterName}</span>
                                  <div className="flex items-center gap-2 text-gray-400">
                                    <span className="text-[9px]">
                                      {comment.timestamp?.seconds
                                        ? new Date(comment.timestamp.seconds * 1000).toLocaleDateString()
                                        : "Just now"}
                                    </span>
                                    {isAuthor && (
                                      <button
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="text-red-400 hover:text-red-600 font-bold transition"
                                      >×</button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-gray-700 dark:text-zinc-300 leading-relaxed">{comment.body}</p>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                  {/* Expert input — role-gated */}
                  {user && profile && (profile.role === "expert" || profile.role === "admin" || profile.is_verified === true) ? (
                    <form onSubmit={handleExpertCommentSubmit} className="space-y-2 border-t border-gray-100 dark:border-zinc-800 pt-3">
                      <span className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Add Expert Comment
                      </span>
                      <textarea
                        placeholder="Write an expert or academic comment on this meme…"
                        value={newExpertComment}
                        onChange={(e) => setNewExpertComment(e.target.value)}
                        rows="2"
                        className="w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                        required
                      />
                      <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-1.5 rounded-xl transition">
                        Submit Expert Comment
                      </button>
                    </form>
                  ) : (
                    <div className="border-t border-gray-100 dark:border-zinc-800 pt-3 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Expert comments are restricted to verified users and subject-matter experts.
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: Ratings ── */}
              {activeModalTab === "ratings" && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[55vh]">
                  {/* Overall badge */}
                  <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-800">
                    <span className="uppercase tracking-wider text-gray-400 text-[10px] font-bold">Pedagogical Evaluation</span>
                    {(() => {
                      const avgs = [
                        getAverageScore("age_appropriateness"),
                        getAverageScore("language_appropriateness"),
                        getAverageScore("content_validity"),
                        getAverageScore("creativity")
                      ].filter(a => a > 0);
                      const overall = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
                      return (
                        <span className="text-purple-600 font-bold text-xs bg-purple-50 dark:bg-purple-950/20 px-2 py-0.5 rounded">
                          Overall: {overall > 0 ? `${overall.toFixed(1)}/5` : "—"}
                        </span>
                      );
                    })()}
                  </div>

                  {[
                    { label: "Age Appropriateness",    key: "age_appropriateness" },
                    { label: "Language Appropriateness", key: "language_appropriateness" },
                    { label: "Content Validity",        key: "content_validity" },
                    { label: "Creativity",              key: "creativity" }
                  ].map((crit) => {
                    const avg = getAverageScore(crit.key);
                    const myVal = userSubmittedRating?.[crit.key] || 0;
                    return (
                      <div key={crit.key} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-gray-700 dark:text-zinc-300">{crit.label}</span>
                          <span className="text-purple-600 font-bold">
                            {avg > 0 ? `${avg.toFixed(1)}/5 (${getScoreCount(crit.key)})` : "—"}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-purple-500 h-full transition-all duration-500"
                            style={{ width: `${(avg / 5) * 100}%` }}
                          />
                        </div>
                        {/* Star selector */}
                        {user ? (
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-[9px] text-gray-400 mr-1">Your rating:</span>
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleRateSubmit(crit.key, star)}
                                className={`text-sm transition-transform hover:scale-110 ${
                                  star <= myVal ? 'text-yellow-500' : 'text-gray-300 dark:text-zinc-600'
                                }`}
                              >★</button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[9px] text-gray-400 text-right">Sign in to rate</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* 3. DIRECT MEME UPLOAD MODAL */}
      {showDirectUploadModal && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ animation: 'modalBackdropFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
        >
          <div 
            className={`w-full max-w-lg p-6 rounded-2xl overflow-y-auto max-h-[95vh] shadow-2xl ${containerClass} border border-gray-200/80 dark:border-zinc-800/80`}
            style={{ animation: 'modalContainerScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          >
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">Direct Meme Upload</h2>
              <button 
                type="button"
                onClick={() => setShowDirectUploadModal(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
                aria-label="Close upload modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              Skip the editor canvas and upload a finished image meme directly from your device storage.
            </p>

            {uploadError && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-250 dark:bg-rose-950/20 dark:border-rose-900/50 text-rose-750 dark:text-rose-300 rounded-xl text-xs font-semibold leading-relaxed">
                ⚠️ {uploadError}
              </div>
            )}

            <form onSubmit={handleDirectUploadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-600 dark:text-gray-400 font-bold mb-1.5 text-xs">Meme Title</label>
                <input
                  type="text"
                  placeholder="e.g. Mitosis vs Meiosis"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-650 dark:focus:border-purple-500 transition text-xs font-semibold text-gray-800 dark:text-zinc-200 placeholder-gray-400"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 font-bold mb-1.5 text-xs">Subject</label>
                  <select
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-650 dark:focus:border-purple-500 transition text-xs font-semibold text-gray-800 dark:text-zinc-200"
                  >
                    {subjects.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {uploadSubject === "Other" && (
                    <input
                      type="text"
                      placeholder="Type your subject..."
                      className="w-full px-3 py-2.5 border border-gray-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-650 dark:focus:border-purple-500 transition text-xs font-semibold text-gray-800 dark:text-zinc-200 mt-2 placeholder-gray-400"
                      value={uploadCustomSubject || ""}
                      onChange={(e) => setUploadCustomSubject(e.target.value)}
                      required
                    />
                  )}
                </div>
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 font-bold mb-1.5 text-xs">Grade</label>
                  <select
                    value={uploadGrade}
                    onChange={(e) => setUploadGrade(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-650 dark:focus:border-purple-500 transition text-xs font-semibold text-gray-800 dark:text-zinc-200"
                  >
                    {gradeGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 font-bold mb-1.5 text-xs">Language</label>
                  <select
                    value={uploadLanguage}
                    onChange={(e) => setUploadLanguage(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-650 dark:focus:border-purple-500 transition text-xs font-semibold text-gray-800 dark:text-zinc-200"
                  >
                    {languages.map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                  {uploadLanguage === "Other" && (
                    <input
                      type="text"
                      placeholder="Type custom language..."
                      className="w-full px-3 py-2.5 border border-gray-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-650 dark:focus:border-purple-500 transition text-xs font-semibold text-gray-800 dark:text-zinc-200 mt-2 placeholder-gray-400"
                      value={uploadCustomLanguage}
                      onChange={(e) => setUploadCustomLanguage(e.target.value)}
                      required
                    />
                  )}
                </div>
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 font-bold mb-1.5 text-xs">Format Type</label>
                  <select
                    value={uploadFormat}
                    onChange={(e) => setUploadFormat(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-650 dark:focus:border-purple-500 transition text-xs font-semibold text-gray-800 dark:text-zinc-200"
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="gif">GIF</option>
                    <option value="audio">Audio</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 font-bold mb-1.5 text-xs">Topic / Keywords</label>
                <input
                  type="text"
                  placeholder="e.g. cell division, mitosis, biology meme"
                  value={uploadKeywords}
                  onChange={(e) => setUploadKeywords(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-650 dark:focus:border-purple-500 transition text-xs font-semibold text-gray-800 dark:text-zinc-200 placeholder-gray-400"
                />
                <span className="text-[10px] text-gray-400 dark:text-gray-500 block mt-1.5 font-normal leading-normal">
                  💡 Separate keywords with commas to help others find and filter your meme.
                </span>
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 font-bold mb-1.5 text-xs">Attach Meme File</label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-zinc-800 rounded-2xl p-6 cursor-pointer hover:bg-purple-50/10 dark:hover:bg-purple-950/5 hover:border-purple-500 dark:hover:border-purple-500/50 transition duration-200">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-3 bg-purple-50 dark:bg-zinc-950 rounded-full text-purple-600 dark:text-purple-400">
                      <Image className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-gray-650 dark:text-gray-300 text-center">
                      {uploadFile ? uploadFile.name : "Click to select a file"}
                    </span>
                    <span className="text-[10px] text-gray-450 dark:text-gray-500 font-normal">
                      PNG, JPG, GIF, MP4, or MP3 (Max 100MB)
                    </span>
                  </div>
                  <input
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                    required
                  />
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setShowDirectUploadModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 px-4 py-2.5 rounded-xl font-bold transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold transition text-xs shadow-sm hover:shadow-purple-500/10 disabled:opacity-60"
                >
                  {uploadLoading ? "Uploading..." : "Publish Meme"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalBackdropFadeIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(4px); }
        }
        @keyframes modalContainerScaleIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Library;
