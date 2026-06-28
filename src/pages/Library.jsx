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
  const [uploadGrade, setUploadGrade] = useState("13-15");
  const [uploadLanguage, setUploadLanguage] = useState("English");
  const [uploadFormat, setUploadFormat] = useState("image");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Watermark Downloader for Images/GIFs appending a 40px CC attribution footer
  const downloadMemeWithWatermark = (imageUrl, title) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.naturalWidth || img.width || 500;
      canvas.height = (img.naturalHeight || img.height || 500) + 40;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height - 40);

      ctx.fillStyle = "#1e1b4b"; // Dark indigo background
      ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

      ctx.fillStyle = "#fbbf24"; // High contrast yellow text
      ctx.font = "bold 14px sans-serif";
      ctx.textBaseline = "middle";

      ctx.textAlign = "left";
      ctx.fillText("Created on MemeClassroom", 20, canvas.height - 20);

      ctx.textAlign = "right";
      ctx.fillText("Licensed under CC BY-NC-SA 4.0", canvas.width - 20, canvas.height - 20);

      const link = document.createElement("a");
      link.download = `${title || 'meme'}_watermarked.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.onerror = () => {
      // Fallback direct link download
      const link = document.createElement("a");
      link.href = imageUrl;
      link.target = "_blank";
      link.download = `${title || 'meme'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
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

  // Dedicated User profile (name and role) resolution listener
  useEffect(() => {
    const creatorIds = memes.map(m => m.creator_id);
    const commenterIds = expertComments.map(c => c.user_id);
    const uniqueIds = [...new Set([...creatorIds, ...commenterIds])];

    uniqueIds.forEach(async (userId) => {
      if (userId === "admin") return;
      if (resolvedCreatorsRef.current[userId]) return;

      resolvedCreatorsRef.current[userId] = "fetching";
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          resolvedCreatorsRef.current[userId] = "fetched";
          setUserCache(prev => ({ 
            ...prev, 
            [userId]: { name: userData.name || "Unknown User", role: userData.role || "student" } 
          }));
        } else {
          resolvedCreatorsRef.current[userId] = "fetched";
          setUserCache(prev => ({ 
            ...prev, 
            [userId]: { name: "Unknown User", role: "student" } 
          }));
        }
      } catch (e) {
        console.error("Error resolving user profile", e);
        delete resolvedCreatorsRef.current[userId];
      }
    });
  }, [memes, expertComments]);

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

    setFilteredMemes(result);
  }, [subjectFilter, gradeFilter, languageFilter, formatFilter, memes]);

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

      await addDoc(collection(db, "memes"), {
        title: uploadTitle || "Direct Gallery Upload",
        creator_id: user.uid,
        subject: uploadSubject,
        age_group: uploadGrade,
        language: uploadLanguage,
        format: uploadFormat,
        visibility: "public",
        media_url: fileUrl,
        template_id: "", // Direct uploads do not have a remix templates reference
        text_layers_json: "[]", // Schema alignment fix
        created_at: serverTimestamp()
      });

      // Update user stats
      const statsRef = doc(db, "user_stats", user.uid);
      await updateDoc(statsRef, {
        memes_created_count: increment(1)
      });

      setShowDirectUploadModal(false);
      setUploadTitle("");
      setUploadFile(null);
    } catch (err) {
      console.error(err);
      setUploadError("Direct file upload failed. Try again.");
    } finally {
      setUploadLoading(false);
    }
  };

  // 4. Community Moderation (Flag content)
  const handleFlagContent = async (memeId) => {
    if (!user) return;
    try {
      // 1. Log flag event to Firestore
      await addDoc(collection(db, "flags"), {
        reporter_id: user.uid,
        content_type: "meme",
        content_id: memeId,
        reason: "Inappropriate Content / Report",
        status: "pending",
        created_at: serverTimestamp()
      });

      // 2. Switch visibility flag to hide reported item instantly from feed
      const memeDocRef = doc(db, "memes", memeId);
      await updateDoc(memeDocRef, {
        visibility: "flagged_hidden"
      });

      if (activeMeme && activeMeme.id === memeId) {
        setActiveMeme(null);
      }
    } catch (e) {
      console.error("Flag content failed", e);
    }
  };

  // 5. Like Matrix: increment/decrement total_likes_received of the creator
  const handleLikeToggle = async (memeId, creatorId) => {
    if (!user) return;
    const existingLikeId = userLikesMap[memeId];

    try {
      const statsRef = doc(db, "user_stats", creatorId);

      if (existingLikeId) {
        // Unlike: remove from likes & decrement creator likes count
        await deleteDoc(doc(db, "likes", existingLikeId));
        await updateDoc(statsRef, {
          total_likes_received: increment(-1)
        });
      } else {
        // Like: create like document & increment creator likes count
        const likeDocId = `${user.uid}_${memeId}`;
        await setDoc(doc(db, "likes", likeDocId), {
          user_id: user.uid,
          meme_id: memeId,
          created_at: serverTimestamp()
        });
        await updateDoc(statsRef, {
          total_likes_received: increment(1)
        });
      }
    } catch (e) {
      console.error("Like toggle failed", e);
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

        let newRating = {
          meme_id: activeMeme.id,
          user_id: user.uid,
          age_appropriateness: 3,
          language_appropriateness: 3,
          content_validity: 3,
          creativity: 3,
          ...userSubmittedRating,
          [criteria]: score,
          created_at: serverTimestamp()
        };

        transaction.set(ratingRef, newRating);

        // Only increment user's ratings_provided_count if it's their first time rating this meme
        if (!ratingDoc.exists()) {
          transaction.update(statsRef, {
            ratings_provided_count: increment(1)
          });
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

  // Helper to compute average criteria score
  const getAverageScore = (criteria) => {
    if (currentMemeRatings.length === 0) return 0;
    const sum = currentMemeRatings.reduce((acc, curr) => acc + (curr[criteria] || 0), 0);
    return sum / currentMemeRatings.length;
  };

  // Dynamic styling configurations for UDL contrast adjustments
  const containerClass = highContrastMode
    ? "bg-black border-2 border-yellow-400 text-yellow-400"
    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl";

  const inputClass = highContrastMode
    ? "bg-black border border-yellow-400 text-yellow-400 placeholder-yellow-600"
    : "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs";

  const btnClass = highContrastMode
    ? "bg-black border-2 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black font-bold text-xs px-3 py-1.5"
    : "bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition shadow-sm";

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">

      {/* Page Title Header and Action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-850 pb-5 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Meme Curation Gallery</h1>
          <p className="mt-1 text-sm text-gray-500">
            Discover and evaluate humor-based classroom assets.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          {user && (
            <button
              onClick={() => setShowDirectUploadModal(true)}
              className={btnClass}
            >
              Direct Meme Upload
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Left 1 Column: Filters Sidebar */}
        <div className={`p-6 h-fit ${containerClass}`}>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-4 border-b pb-2">Filter Options</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Subject</label>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">All Subjects</option>
                <option value="Biology">Biology</option>
                <option value="Physics">Physics</option>
                <option value="Maths">Maths</option>
                <option value="Chemistry">Chemistry</option>
                <option value="History">History</option>
                <option value="Geography">Geography</option>
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
                <option value="10-12">Ages 10-12</option>
                <option value="13-15">Ages 13-15</option>
                <option value="16-18">Ages 16-18</option>
                <option value="University">University</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Language</label>
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">All Languages</option>
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Malayalam">Malayalam</option>
                <option value="Tamil">Tamil</option>
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

            {(subjectFilter || gradeFilter || languageFilter || formatFilter) && (
              <button
                onClick={() => {
                  setSubjectFilter("");
                  setGradeFilter("");
                  setLanguageFilter("");
                  setFormatFilter("");
                }}
                className="w-full text-center text-xs font-semibold text-red-650 hover:underline pt-2"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Right 3 Columns: Grid Curation Cards */}
        <div className="lg:col-span-3">
          {filteredMemes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredMemes.map((meme) => {
                const isLiked = !!userLikesMap[meme.id];
                const creatorName = meme.creator_id === "admin" ? "Admin" : (userCache[meme.creator_id]?.name || "Creator");

                return (
                  <div key={meme.id} className={`flex flex-col h-full overflow-hidden transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md ${containerClass}`}>

                    {/* Visual Media Preview Box */}
                    <div
                      onClick={() => setActiveMeme(meme)}
                      className="bg-gray-100 dark:bg-gray-900 aspect-video relative flex items-center justify-center cursor-pointer overflow-hidden group"
                    >
                      {meme.format === "image" && (
                        <img src={meme.media_url} alt={meme.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                      )}
                      {meme.format === "video" && (
                        <video src={meme.media_url} className="w-full h-full object-cover" />
                      )}
                      {meme.format === "gif" && (
                        <img src={meme.media_url} alt={meme.title} className="w-full h-full object-cover" />
                      )}
                      {meme.format === "audio" && (
                        <div className="text-3xl">🔊</div>
                      )}

                      <div className="absolute top-2 left-2 flex gap-1 z-10">
                        {meme.creator_id === "admin" ? (
                          <span className="bg-purple-650 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                            Admin
                          </span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); openUserModal(meme.creator_id); }}
                            className="bg-gray-900/70 hover:bg-purple-650 text-white text-[10px] font-medium px-2 py-0.5 rounded-full transition cursor-pointer"
                          >
                            By {creatorName}
                          </button>
                        )}
                      </div>

                      {/* Hover Overlay Visual Indicator */}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <span className="text-white text-xs font-bold uppercase tracking-wider bg-black/60 px-3 py-1.5 rounded-lg">View details</span>
                      </div>
                    </div>

                    {/* Metadata Details Card Body */}
                    <div className="p-4 flex-grow flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3
                            onClick={() => setActiveMeme(meme)}
                            className="font-extrabold text-sm hover:text-purple-600 cursor-pointer line-clamp-1"
                          >
                            {meme.title}
                          </h3>
                        </div>

                        {/* Curriculum Tag Pills */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          <span className="bg-purple-50 dark:bg-purple-950/20 text-purple-750 dark:text-purple-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {meme.subject}
                          </span>
                          <span className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-750 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            Ages {meme.age_group}
                          </span>
                          <span className="bg-teal-50 dark:bg-teal-950/20 text-teal-750 dark:text-teal-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {meme.language}
                          </span>
                          <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                            {meme.format}
                          </span>
                        </div>
                      </div>

                      {/* Card Lower Controls Tray */}
                      <div className="pt-3 border-t border-gray-150 dark:border-gray-750 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-3">
                          {/* Like Heart Button */}
                          <button
                            onClick={() => handleLikeToggle(meme.id, meme.creator_id)}
                            className={`flex items-center space-x-1 ${isLiked ? 'text-red-500 font-bold' : 'text-gray-400 hover:text-gray-500'}`}
                          >
                            <span>{isLiked ? "❤️" : "🤍"}</span>
                            <span>Like</span>
                          </button>

                          {/* Flag Report Button */}
                          <button
                            onClick={() => handleFlagContent(meme.id)}
                            className="text-gray-400 hover:text-red-500 transition"
                            title="Report Inappropriate Content"
                          >
                            🏳️
                          </button>

                          {/* Download Button */}
                          <button
                            onClick={() => {
                              if (meme.format === "image" || meme.format === "gif") {
                                downloadMemeWithWatermark(meme.media_url, meme.title);
                              } else {
                                handleMediaDownload(meme.media_url, meme.title);
                              }
                            }}
                            className="text-gray-400 hover:text-indigo-650 transition"
                            title="Download Meme (CC BY-NC-SA 4.0)"
                          >
                            📥
                          </button>
                        </div>

                        {/* Edit/Remix Button (shown only if template_id exists) */}
                        {meme.template_id && (
                          <button
                            onClick={() => navigate(`/lab?templateId=${meme.template_id}&templateUrl=${meme.media_url}&format=${meme.format}`)}
                            className="text-[10px] font-bold text-purple-650 hover:underline flex items-center space-x-1"
                          >
                            <span>🌀</span>
                            <span>Remix</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-500 shadow-sm">
              <p className="text-lg font-medium mb-1">No memes match these filters</p>
              <p className="text-xs text-gray-400">Try broadening your subject, grade or format choices.</p>
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
                  <video src={activeMeme.media_url} controls className="max-w-full max-h-full" />
                )}
                {activeMeme.format === "gif" && (
                  <img src={activeMeme.media_url} alt={activeMeme.title} className="max-w-full max-h-full object-contain" />
                )}
                {activeMeme.format === "audio" && (
                  <audio src={activeMeme.media_url} controls className="w-full px-6" />
                )}
              </div>

              {/* Download Action Trigger */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    if (activeMeme.format === "image" || activeMeme.format === "gif") {
                      downloadMemeWithWatermark(activeMeme.media_url, activeMeme.title);
                    } else {
                      handleMediaDownload(activeMeme.media_url, activeMeme.title);
                    }
                  }}
                  className="w-full bg-purple-50 dark:bg-purple-950/20 text-purple-750 dark:text-purple-300 font-bold py-2 rounded-lg border border-purple-200 dark:border-purple-800 text-xs flex items-center justify-center space-x-1.5 hover:bg-purple-100 transition"
                >
                  <span>📥</span>
                  <span>Download Meme with CC License & Watermark</span>
                </button>
              </div>

              {/* Criteria Progress evaluation bars */}
              <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl text-xs font-semibold">
                <span className="block uppercase tracking-wider text-gray-400 text-[10px] mb-2">Pedagogical Evaluation Grades</span>

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
                        <span className="text-purple-650">{avg > 0 ? `${avg.toFixed(1)} / 5` : "— / 5"}</span>
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

            {/* Right Column: Expert comments & Remix workflows */}
            <div className="flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-2">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider">Expert Reviews</h3>
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
                      return commenter?.role === "expert" || commenter?.role === "admin" || comment.user_id === "admin";
                    });

                    if (verifiedComments.length === 0) {
                      return (
                        <p className="text-center text-gray-450 dark:text-gray-500 text-xs py-8">
                          No expert reviews have been logged for this meme's subject area yet.
                        </p>
                      );
                    }

                    return verifiedComments.map((comment) => {
                      const commenter = userCache[comment.user_id];
                      const commenterName = commenter?.name || "Verified Expert";
                      return (
                        <div key={comment.id} className="border-b border-gray-200 dark:border-gray-800 pb-3 last:border-b-0 text-xs">
                          <div className="flex justify-between text-gray-500 mb-1">
                            <span className="font-bold text-purple-750">🛡️ Certified Expert Review ({commenterName})</span>
                            <span>{comment.timestamp?.seconds ? new Date(comment.timestamp.seconds * 1000).toLocaleDateString() : "Just now"}</span>
                          </div>
                          <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">{comment.body}</p>
                        </div>
                      );
                    });
                  })()
                ) : (
                  <p className="text-center text-gray-450 dark:text-gray-500 text-xs py-8">
                    No expert reviews have been logged for this meme's subject area yet.
                  </p>
                )}
              </div>

              {/* Expert Only Submission Area */}
              {user && profile && (profile.role === "expert" || profile.role === "admin") ? (
                <form onSubmit={handleExpertCommentSubmit} className="space-y-3 border-t pt-4">
                  <span className="block text-xs font-semibold text-purple-750 uppercase">🛡️ Add Academic Review (Expert Only)</span>
                  <textarea
                    placeholder="Write a scholarly verification review on the content validity and accuracy..."
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
                  🔒 Comments are restricted to verified subject-matter experts.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 3. DIRECT MEME UPLOAD MODAL */}
      {showDirectUploadModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-xl ${containerClass}`}>
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
                  <select
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
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
                  <label className="block text-gray-500 uppercase mb-1">Grade</label>
                  <select
                    value={uploadGrade}
                    onChange={(e) => setUploadGrade(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    <option value="10-12">Ages 10-12</option>
                    <option value="13-15">Ages 13-15</option>
                    <option value="16-18">Ages 16-18</option>
                    <option value="University">University</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Language</label>
                  <select
                    value={uploadLanguage}
                    onChange={(e) => setUploadLanguage(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Malayalam">Malayalam</option>
                    <option value="Tamil">Tamil</option>
                  </select>
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
