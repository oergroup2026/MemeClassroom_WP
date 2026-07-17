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
  const [expertComments, setExpertComments] = useState([]);
  const [newExpertComment, setNewExpertComment] = useState("");
  const [showDirectUploadModal, setShowDirectUploadModal] = useState(false);

  // Ratings for current active meme
  const [currentMemeRatings, setCurrentMemeRatings] = useState([]);
  const [userSubmittedRating, setUserSubmittedRating] = useState(null);

  // Likes map for the current user
  const [userLikesMap, setUserLikesMap] = useState({});

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
                is_verified: userData.is_verified || false 
              };
            } else {
              resolvedCreatorsRef.current[userId] = "fetched";
              newCacheUpdates[userId] = { name: "Unknown User", role: "student", is_verified: false };
            }
          } catch (e) {
            console.error("Error resolving user profile", e);
            resolvedCreatorsRef.current[userId] = null; // reset so it can try again
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

  // Load Expert Comments & Ratings for the Active Expanded Meme
  useEffect(() => {
    let unsubscribeComments = () => {};
    let unsubscribeRatings = () => {};

    // Clear stale ratings and comments immediately on activeMeme changes to prevent UI flickering
    setCurrentMemeRatings([]);
    setUserSubmittedRating(null);
    setExpertComments([]);

    if (activeMeme) {
      // Listen to expert comments
      const commentsCol = collection(db, "comments");
      const commentsQuery = query(
        commentsCol,
        where("meme_id", "==", activeMeme.id),
        where("is_expert_comment", "==", true)
      );

      unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
        const commentList = [];
        snapshot.forEach((doc) => {
          commentList.push({ id: doc.id, ...doc.data() });
        });
        setExpertComments(commentList);
      });

      // Listen to ratings
      const ratingsCol = collection(db, "ratings");
      const ratingsQuery = query(ratingsCol, where("meme_id", "==", activeMeme.id));
      unsubscribeRatings = onSnapshot(ratingsQuery, (snapshot) => {
        const ratingList = [];
        snapshot.forEach((doc) => {
          ratingList.push({ id: doc.id, ...doc.data() });
        });
        setCurrentMemeRatings(ratingList);

        if (user) {
          const myRating = ratingList.find(r => r.user_id === user.uid);
          setUserSubmittedRating(myRating || null);
        }
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

  // 7. Expert Review submission
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
  const containerClass = highContrastMode
    ? "bg-zinc-900 border border-zinc-800 text-white shadow-sm rounded-xl"
    : "bg-white border border-gray-200 shadow-sm rounded-xl";

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
        <div className={`fixed bottom-6 right-6 z-[200] flex items-start gap-3 px-5 py-4 rounded-xl shadow-2xl text-white text-sm font-medium max-w-sm ${
          libToast.type === "success" ? "bg-green-600" : libToast.type === "warning" ? "bg-yellow-500 text-gray-900" : libToast.type === "error" ? "bg-red-600" : "bg-indigo-600"
        }`}>
          <span className="flex-1">{libToast.message}</span>
          <button onClick={() => setLibToast(null)} className="opacity-70 hover:opacity-100 font-bold text-lg leading-none">×</button>
        </div>
      )}

      {/* Flag Popup */}
      {showFlagPopup && (
        <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4" onClick={() => setShowFlagPopup(false)}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-8 max-w-sm text-center space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-5xl">🏳️</div>
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
      <div className="text-center mb-10 max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 gallery-header-title">Meme Curation Gallery</h1>
        <p className="text-sm text-gray-500 mb-6">
          Discover and evaluate humor-based classroom assets.
        </p>

        {/* Search Bar Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedSearchQuery(searchQuery);
          }}
          className="flex gap-2 items-center justify-center bg-white dark:bg-zinc-900 p-1.5 rounded-xl border border-gray-205 dark:border-zinc-800 shadow-sm focus-within:ring-2 focus-within:ring-purple-600 transition"
        >
          <div className="relative flex-grow flex items-center">
            <span className="absolute left-3 text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Search memes by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border-0 bg-transparent text-sm focus:outline-none dark:text-white placeholder-gray-400"
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
          </div>
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-750 text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition"
          >
            Search
          </button>
        </form>

        {appliedSearchQuery && (
          <p className="text-[11px] text-purple-650 dark:text-purple-400 mt-2 font-semibold">
            Showing search results for "{appliedSearchQuery}"
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Left Column: Portrait Rectangle Sidebar for Sorting & Filtering */}
        <div className={`p-6 h-fit ${containerClass}`}>
          {/* Sorting Dropdown */}
          <div className="mb-6">
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-2">Sort Memes By</label>
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

          <h2 className="text-xs font-bold uppercase tracking-wider mb-4 border-b pb-2">Filter Options</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Subject</label>
              <input
                type="text"
                placeholder="🔍 Search subject..."
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
              <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Grade</label>
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
              <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Language</label>
              <input
                type="text"
                placeholder="🔍 Search language..."
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
              <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Format</label>
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

        {/* Right 3 Columns: Grid Curation Cards */}
        <div className="lg:col-span-3">
          {filteredMemes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredMemes.map((meme) => {
                const isLiked = !!userLikesMap[meme.id];
                const creatorName = meme.creator_id === "admin" ? "Admin" : (userCache[meme.creator_id]?.name || "Creator");

                return (
                  <div key={meme.id} className={`flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out hover:-translate-y-1.5 hover:shadow-xl hover:ring-2 hover:ring-purple-500/20 meme-card-animate ${containerClass}`}>
                    {/* Media Content Body */}
                    <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center overflow-hidden group select-none">
                      
                      {/* Creator Profile Overlay - Social Media Style */}
                      <div 
                        onClick={(e) => { e.stopPropagation(); openUserModal(meme.creator_id); }}
                        className="absolute top-3 left-3 z-10 flex items-center space-x-1.5 bg-black/55 backdrop-blur-md px-2.5 py-1.2 rounded-full border border-white/10 shadow-sm transition hover:bg-black/75 cursor-pointer select-none"
                      >
                        <img
                          src={userCache[meme.creator_id]?.avatar_url || "/avatar1.png"}
                          alt={creatorName}
                          className="w-5 h-5 rounded-full object-cover border border-white/20"
                        />
                        <span className="text-[10px] font-bold text-white/90 truncate max-w-[80px]">
                          {creatorName}
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

                    {/* Info Card Content */}
                    <div className="p-4 flex-grow flex flex-col justify-between">
                      <div>
                        {/* Title and Rating Badge */}
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <h4 className="font-extrabold text-xs text-gray-900 dark:text-white line-clamp-1 leading-tight flex-1" title={meme.title}>
                            {meme.title}
                          </h4>
                          {(() => {
                            const overall = getOverallAverageRating(meme.id);
                            return overall > 0 ? (
                              <span className="shrink-0 text-[10px] font-extrabold text-yellow-650 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/25 px-2 py-0.5 rounded-md flex items-center gap-0.5 border border-yellow-200/50 dark:border-yellow-950/50 shadow-sm">
                                ⭐ {overall.toFixed(1)}
                              </span>
                            ) : null;
                          })()}
                        </div>

                        {meme.keywords && meme.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {meme.keywords.slice(0, 3).map((keyword, i) => (
                              <span key={i} className="text-[8px] text-purple-600 dark:text-purple-400 font-medium">
                                #{keyword}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Curriculum Tag Pills */}
                        <div className="flex flex-wrap gap-1.5 mb-3.5">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm ${getSubjectTagClass(meme.subject)}`}>
                            {meme.subject}
                          </span>
                          <span className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-750 dark:text-indigo-300 text-[9px] px-2 py-0.5 rounded-full font-bold">
                            {meme.age_group}
                          </span>
                          <span className="bg-teal-50 dark:bg-teal-950/20 text-teal-750 dark:text-teal-300 text-[9px] px-2 py-0.5 rounded-full font-bold">
                            {meme.language}
                          </span>
                          <span className="bg-gray-105 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">
                            {meme.format}
                          </span>
                        </div>

                        {/* Pedagogical Category Averages Panel */}
                        <div className="grid grid-cols-4 gap-1 bg-gray-50/50 dark:bg-zinc-900/40 p-2 rounded-lg text-[9px] mb-3 leading-tight border border-gray-150 dark:border-zinc-800/80">
                          <div className="text-center">
                            <span className="block text-gray-400 dark:text-gray-550 font-semibold uppercase">Age Appr.</span>
                            <span className="font-extrabold text-purple-700 dark:text-purple-400 block mt-0.5">
                              {getMemeAverageRating(meme.id, "age_appropriateness") > 0 
                                ? `${getMemeAverageRating(meme.id, "age_appropriateness").toFixed(1)}/5` 
                                : "—"}
                            </span>
                            <span className="text-[8px] text-gray-400 dark:text-gray-550 block">
                              ({getMemeRatingCount(meme.id, "age_appropriateness")})
                            </span>
                          </div>
                          <div className="text-center border-l border-gray-200 dark:border-zinc-800/85">
                            <span className="block text-gray-400 dark:text-gray-550 font-semibold uppercase">Lang. Appr.</span>
                            <span className="font-extrabold text-purple-700 dark:text-purple-400 block mt-0.5">
                              {getMemeAverageRating(meme.id, "language_appropriateness") > 0 
                                ? `${getMemeAverageRating(meme.id, "language_appropriateness").toFixed(1)}/5` 
                                : "—"}
                            </span>
                            <span className="text-[8px] text-gray-400 dark:text-gray-550 block">
                              ({getMemeRatingCount(meme.id, "language_appropriateness")})
                            </span>
                          </div>
                          <div className="text-center border-l border-gray-200 dark:border-zinc-800/85">
                            <span className="block text-gray-400 dark:text-gray-550 font-semibold uppercase">Validity</span>
                            <span className="font-extrabold text-purple-700 dark:text-purple-400 block mt-0.5">
                              {getMemeAverageRating(meme.id, "content_validity") > 0 
                                ? `${getMemeAverageRating(meme.id, "content_validity").toFixed(1)}/5` 
                                : "—"}
                            </span>
                            <span className="text-[8px] text-gray-400 dark:text-gray-550 block">
                              ({getMemeRatingCount(meme.id, "content_validity")})
                            </span>
                          </div>
                          <div className="text-center border-l border-gray-200 dark:border-zinc-800/85">
                            <span className="block text-gray-400 dark:text-gray-550 font-semibold uppercase">Creativity</span>
                            <span className="font-extrabold text-purple-700 dark:text-purple-400 block mt-0.5">
                              {getMemeAverageRating(meme.id, "creativity") > 0 
                                ? `${getMemeAverageRating(meme.id, "creativity").toFixed(1)}/5` 
                                : "—"}
                            </span>
                            <span className="text-[8px] text-gray-400 dark:text-gray-550 block">
                              ({getMemeRatingCount(meme.id, "creativity")})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 mt-auto">
                        {/* 5-Option Action Bar */}
                        <div className="flex items-center justify-between border-t border-gray-100 dark:border-zinc-850 pt-2.5 mt-2.5 text-gray-450 dark:text-gray-550">
                          {/* 1. Like */}
                          <button
                            onClick={() => handleLikeToggle(meme.id, meme.creator_id)}
                            className={`flex items-center space-x-1 hover:scale-110 active:scale-95 transition-all text-xs ${isLiked ? 'text-red-500 font-bold' : 'hover:text-red-500'}`}
                            title="Like Meme"
                          >
                            <span>{isLiked ? "❤️" : "🤍"}</span>
                            <span className="text-[10px] font-bold">{meme.likes_count || 0}</span>
                          </button>

                          {/* 2. Edit / Remix */}
                          <button
                            onClick={() => navigate(`/lab?templateId=${meme.id}`)}
                            className="hover:text-purple-650 hover:scale-110 active:scale-95 transition-all text-xs"
                            title={meme.template_id ? "Customise / Remix Meme" : "Use as Template"}
                          >
                            ✏️
                          </button>

                          {/* 3. Download */}
                          <button
                            onClick={() => {
                              if (meme.format === "image" || meme.format === "gif") {
                                downloadMemeWithWatermark(meme.media_url, meme.title);
                              } else {
                                handleMediaDownload(meme.media_url, meme.title);
                              }
                            }}
                            className="hover:text-indigo-650 hover:scale-110 active:scale-95 transition-all text-xs"
                            title="Download Meme (CC BY-NC-SA 4.0)"
                          >
                            📥
                          </button>

                          {/* 4. Rate */}
                          <button
                            onClick={() => setActiveMeme(meme)}
                            className={`flex items-center space-x-0.5 hover:text-yellow-500 hover:scale-110 active:scale-95 transition-all text-xs ${getOverallAverageRating(meme.id) > 0 ? 'text-yellow-500 font-bold' : ''}`}
                            title="Rate & View Comments"
                          >
                            <span>⭐</span>
                            {(() => {
                              const overall = getOverallAverageRating(meme.id);
                              return overall > 0 ? (
                                <span className="text-[10px] font-bold">{overall.toFixed(1)}</span>
                              ) : null;
                            })()}
                          </button>

                          {/* 5. Flag */}
                          <button
                            onClick={() => handleFlagContent(meme.id)}
                            className="hover:text-red-500 hover:scale-110 active:scale-95 transition-all text-xs"
                            title="Report Inappropriate Content"
                          >
                            🏳️
                          </button>
                        </div>

                        {/* License Info Footer */}
                        <div className="flex items-center text-[9px] text-gray-400 dark:text-gray-550 font-semibold space-x-1 pt-1.5 border-t border-gray-150 dark:border-zinc-850">
                          <span>🄲🄲 🄱🅈 🄽🄲 🅂🄰</span>
                          <span>BY-NC-SA 4.0</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-500 shadow-sm">
              <p className="text-lg font-medium mb-1">No memes match these filters</p>
              <p className="text-xs text-gray-450">Try broadening your subject, grade or format choices.</p>
            </div>
          )}
        </div>
      </div>

      {/* 2. MEME DETAIL OVERLAY EXPANSION MODAL */}
      {activeMeme && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-4xl p-6 rounded-xl overflow-y-auto max-h-[90vh] grid grid-cols-1 md:grid-cols-2 gap-6 ${containerClass}`}>

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

              {/* Detail Preview Area */}
              <div className="bg-black aspect-square rounded-xl overflow-hidden flex items-center justify-center mb-4">
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

              {/* Creator details and potential Delete option */}
              <div className="flex justify-between items-center mb-4 text-xs font-semibold text-gray-500">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openUserModal(activeMeme.creator_id)}
                    className="hover:underline text-purple-750"
                  >
                    By {activeMeme.creator_id === "admin" ? "Admin" : (userCache[activeMeme.creator_id]?.name || "Creator")}
                  </button>
                  <span>•</span>
                  <span>❤️ {activeMeme.likes_count || 0} Likes</span>
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

              {/* Download & Use as Template Action Triggers */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    if (activeMeme.format === "image" || activeMeme.format === "gif") {
                      downloadMemeWithWatermark(activeMeme.media_url, activeMeme.title);
                    } else {
                      handleMediaDownload(activeMeme.media_url, activeMeme.title);
                    }
                  }}
                  className="flex-1 bg-purple-50 dark:bg-purple-950/20 text-purple-750 dark:text-purple-300 font-bold py-2 rounded-lg border border-purple-200 dark:border-purple-800 text-xs flex items-center justify-center space-x-1.5 hover:bg-purple-100 transition"
                >
                  <span>📥</span>
                  <span>Download</span>
                </button>
                <button
                  onClick={() => navigate(`/lab?templateUrl=${encodeURIComponent(activeMeme.media_url)}&format=${activeMeme.format}&clearText=true`)}
                  className="flex-1 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-750 dark:text-indigo-300 font-bold py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 text-xs flex items-center justify-center space-x-1.5 hover:bg-indigo-100 transition"
                >
                  <span>🎨</span>
                  <span>Use as Template</span>
                </button>
              </div>

              {/* Criteria Progress evaluation bars */}
              <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl text-xs font-semibold">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-800 mb-2">
                  <span className="uppercase tracking-wider text-gray-400 text-[10px]">Pedagogical Evaluation Grades</span>
                  {(() => {
                    const ageAvg = getAverageScore("age_appropriateness");
                    const langAvg = getAverageScore("language_appropriateness");
                    const valAvg = getAverageScore("content_validity");
                    const creatAvg = getAverageScore("creativity");
                    const activeAverages = [ageAvg, langAvg, valAvg, creatAvg].filter(a => a > 0);
                    const overallAverage = activeAverages.length > 0 
                      ? activeAverages.reduce((a, b) => a + b, 0) / activeAverages.length 
                      : 0;
                    return (
                      <span className="text-purple-650 font-bold text-xs bg-purple-50 dark:bg-purple-950/20 px-2 py-0.5 rounded">
                        Avg: {overallAverage > 0 ? `${overallAverage.toFixed(1)}/5` : "—"}
                      </span>
                    );
                  })()}
                </div>

                {[
                  { label: "Age Appropriateness", key: "age_appropriateness" },
                  { label: "Language Appropriateness", key: "language_appropriateness" },
                  { label: "Content Validity", key: "content_validity" },
                  { label: "Creativity", key: "creativity" }
                ].map((crit) => {
                  const avg = getAverageScore(crit.key);
                  const myVal = userSubmittedRating?.[crit.key] || 0;

                  return (
                    <div key={crit.key} className="space-y-1 min-h-[70px]">
                      <div className="flex justify-between text-[11px]">
                        <span>{crit.label}</span>
                        <span className="text-purple-650 font-bold">
                          {avg > 0 ? `${avg.toFixed(1)}/5 (${getScoreCount(crit.key)} ${getScoreCount(crit.key) === 1 ? 'rating' : 'ratings'})` : "—/5 (0 ratings)"}
                        </span>
                      </div>

                      {/* Progress Bar representing average */}
                      <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-purple-600 h-full transition-all duration-300"
                          style={{ width: `${(avg / 5) * 100}%` }}
                        ></div>
                      </div>

                      {/* Active Star Selector submission */}
                      {user && (
                        <div className="flex space-x-1.5 pt-0.5 justify-end h-5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleRateSubmit(crit.key, star)}
                              className={`text-xs ${star <= myVal ? 'text-yellow-500' : 'text-gray-300'}`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Verified reviews & comments */}
            <div className="flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-2">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider">Verified Reviews</h3>
                  {expertComments.length > 0 && (
                    <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1">
                      <span>🛡️</span>
                      <span>Verified</span>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setActiveMeme(null)}
                  className="hidden md:block text-gray-400 hover:text-gray-500 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Expert scholarly Comments block */}
              <div className="flex-grow space-y-4 overflow-y-auto mb-6 max-h-[40vh] border border-gray-150 dark:border-gray-750 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                {expertComments.length > 0 ? (
                  (() => {
                    const verifiedComments = expertComments.filter(comment => {
                      const commenter = userCache[comment.user_id];
                      return commenter?.role === "expert" || commenter?.role === "admin" || commenter?.is_verified === true || comment.user_id === "admin";
                    });

                    if (verifiedComments.length === 0) {
                      return (
                        <p className="text-center text-gray-450 dark:text-gray-500 text-xs py-8">
                          No verified reviews have been logged for this meme's subject area yet.
                        </p>
                      );
                    }

                    return verifiedComments.map((comment) => {
                      const commenter = userCache[comment.user_id];
                      const commenterName = commenter?.name || "Verified Reviewer";
                      const isCommentAuthor = user && (comment.user_id === user.uid || profile?.role === "admin");
                      return (
                        <div key={comment.id} className="border-b border-gray-200 dark:border-gray-800 pb-3 last:border-b-0 text-xs">
                          <div className="flex justify-between items-center text-gray-500 mb-1">
                            <span className="font-bold text-purple-750">🛡️ Verified Review ({commenterName})</span>
                            <div className="flex items-center space-x-2">
                              <span>{comment.timestamp?.seconds ? new Date(comment.timestamp.seconds * 1000).toLocaleDateString() : "Just now"}</span>
                              {isCommentAuthor && (
                                <button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="text-red-500 hover:text-red-700 font-bold transition ml-2"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">{comment.body}</p>
                        </div>
                      );
                    });
                  })()
                ) : (
                  <p className="text-center text-gray-450 dark:text-gray-500 text-xs py-8">
                    No verified reviews have been logged for this meme's subject area yet.
                  </p>
                )}
              </div>

              {/* Expert & Verified User Submission Area */}
              {user && profile && (profile.role === "expert" || profile.role === "admin" || profile.is_verified === true) ? (
                <form onSubmit={handleExpertCommentSubmit} className="space-y-3 border-t pt-4">
                  <span className="block text-xs font-semibold text-purple-750 uppercase">🛡️ Add Verification Review</span>
                  <textarea
                    placeholder="Write a verification review or academic comment on content validity..."
                    value={newExpertComment}
                    onChange={(e) => setNewExpertComment(e.target.value)}
                    rows="3"
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs rounded"
                    required
                  />
                  <button type="submit" className={btnClass}>
                    Submit Verified Review
                  </button>
                </form>
              ) : (
                <div className="border-t pt-4 text-center text-xs text-gray-400">
                  🔒 Comments are restricted to verified users and subject-matter experts.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 3. DIRECT MEME UPLOAD MODAL */}
      {showDirectUploadModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-xl overflow-y-auto max-h-[90vh] ${containerClass}`}>
            <h2 className="text-lg font-bold mb-2">Direct Meme Upload</h2>
            <p className="text-xs text-gray-500 mb-6">
              Skip the editor canvas and upload a finished image meme directly from your device storage.
            </p>

            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 text-red-650 rounded text-xs">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleDirectUploadSubmit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-gray-500 uppercase mb-1">Meme Title</label>
                <input
                  type="text"
                  placeholder="e.g. Mitosis vs Meiosis"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
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
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    {subjects
                      .filter(s => s.toLowerCase().includes(formSubjectSearch.toLowerCase()))
                      .map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                  </select>
                  {uploadSubject === "Other" && (
                    <input
                      type="text"
                      placeholder="Type your subject..."
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded mt-2 text-xs"
                      value={uploadCustomSubject || ""}
                      onChange={(e) => setUploadCustomSubject(e.target.value)}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Grade</label>
                  <select
                    value={uploadGrade}
                    onChange={(e) => setUploadGrade(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    {gradeGroups.map(g => (
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
                    value={uploadLanguage}
                    onChange={(e) => setUploadLanguage(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    {languages
                      .filter(lang => lang.toLowerCase().includes(formLanguageSearch.toLowerCase()))
                      .map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                  </select>
                  {uploadLanguage === "Other" && (
                    <input
                      type="text"
                      placeholder="Type custom language..."
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded mt-2 text-xs"
                      value={uploadCustomLanguage}
                      onChange={(e) => setUploadCustomLanguage(e.target.value)}
                      required
                    />
                  )}
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Format Type</label>
                  <select
                    value={uploadFormat}
                    onChange={(e) => setUploadFormat(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="gif">GIF</option>
                    <option value="audio">Audio</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">Topic / Keywords (Separate with comma)</label>
                <input
                  type="text"
                  placeholder="e.g. cell division, mitosis, biology meme"
                  value={uploadKeywords}
                  onChange={(e) => setUploadKeywords(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded placeholder-gray-400"
                />
                <span className="text-[10px] text-gray-400 block mt-1 font-normal">
                  Note: Instruct users to separate keywords with comma. These keywords will be indexed to enable a smooth search and filtering.
                </span>
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">Attach Meme File</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDirectUploadModal(false)}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-750 dark:text-gray-200 px-4 py-2 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-750"
                >
                  {uploadLoading ? "Uploading..." : "Publish Meme"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Library;
