import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  increment,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import { useToast } from "../components/ToastNotification";

const MILESTONES = [0, 1, 5, 10, 25, 50];
const LEVEL_NAMES = ["None", "Bronze", "Silver", "Gold", "Platinum", "Diamond"];

const getBadgeIcon = (level) => {
  if (level >= 5) return "/diamond.png";
  if (level >= 3) return "/trophy.png";
  if (level >= 1) return "/medal.png";
  return "/medal.png";
};

const CATEGORY_NAMES = {
  content_creator: { label: "Content Creator Medal", statKey: "memes_created_count" },
  knowledge_contributor: { label: "Knowledge Contributor Medal", statKey: "resources_contributed_count" },
  community_voice: { label: "Community Voice Medal", statKey: "staffroom_posts_count" },
  peer_evaluator: { label: "Peer Evaluator Medal", statKey: "ratings_provided_count" },
  star_educator: { label: "Star Educator Medal", statKey: "total_likes_received" }
};

const Profile = () => {
  const { user, profile } = useAuth();
  const { highContrastMode } = useUdl();
  const navigate = useNavigate();
  const toast = useToast();

  // Tab selections: "my-memes" | "my-drafts" | "bookmarks"
  const [activeTab, setActiveTab] = useState("my-memes");

  // User Stats & Badges states
  const [stats, setStats] = useState({
    memes_created_count: 0,
    resources_contributed_count: 0,
    staffroom_posts_count: 0,
    ratings_provided_count: 0,
    total_likes_received: 0
  });

  const [earnedBadges, setEarnedBadges] = useState([]);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  // Profile details editing state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editInstitution, setEditInstitution] = useState("");
  const [editPlace, setEditPlace] = useState("");
  const [editState, setEditState] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editTagline, setEditTagline] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const openEditModal = () => {
    setEditName(profile?.name || "");
    setEditInstitution(profile?.institution || "");
    setEditPlace(profile?.place || "");
    setEditState(profile?.state || "");
    setEditCountry(profile?.country || "");
    setEditTagline(profile?.tagline || "");
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setEditLoading(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        name: editName.trim(),
        institution: editInstitution.trim(),
        place: editPlace.trim(),
        state: editState.trim(),
        country: editCountry.trim(),
        tagline: editTagline.trim(),
      });
      setShowEditModal(false);
      toast("Profile updated successfully!", "success");
    } catch (err) {
      console.error("Failed to update profile details", err);
      toast("Failed to save changes. Please try again.", "error");
    } finally {
      setEditLoading(false);
    }
  };

  // Meme Lists
  const [myMemes, setMyMemes] = useState([]);
  const [myDrafts, setMyDrafts] = useState([]);
  const [bookmarkedMemes, setBookmarkedMemes] = useState([]);

  // Cache to resolve creator usernames on bookmark cards
  const [creatorCache, setCreatorCache] = useState({});

  // Fetch User Stats
  useEffect(() => {
    if (!user) return;
    const statsDocRef = doc(db, "user_stats", user.uid);
    const unsubscribe = onSnapshot(statsDocRef, (snap) => {
      if (snap.exists()) {
        setStats(snap.data());
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch User's Published Memes & Drafts
  useEffect(() => {
    if (!user) return;
    const memesCol = collection(db, "memes");
    const q = query(memesCol, where("creator_id", "==", user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memesList = [];
      const draftsList = [];
      snapshot.forEach((doc) => {
        const item = { id: doc.id, ...doc.data() };
        if (item.visibility === "public") {
          memesList.push(item);
        } else if (item.visibility === "draft") {
          draftsList.push(item);
        }
      });
      setMyMemes(memesList);
      setMyDrafts(draftsList);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch User's Bookmarked Memes
  useEffect(() => {
    if (!user) return;
    const savesCol = collection(db, "saves");
    const q = query(savesCol, where("user_id", "==", user.uid));

    const unsubscribeSaves = onSnapshot(q, (snapshot) => {
      const savedIds = [];
      snapshot.forEach((doc) => {
        savedIds.push({ saveId: doc.id, memeId: doc.data().meme_id });
      });

      const loadBookmarks = async () => {
        const list = [];
        for (const bookmark of savedIds) {
          try {
            const memeDoc = await getDoc(doc(db, "memes", bookmark.memeId));
            if (memeDoc.exists() && memeDoc.data().visibility !== "flagged_hidden") {
              const data = memeDoc.data();

              // Query ratings for this meme to compute averages
              const rList = [];
              const rSnap = await getDocs(query(collection(db, "ratings"), where("meme_id", "==", bookmark.memeId)));
              rSnap.forEach(rd => rList.push(rd.data()));

              // Calculate averages
              const averages = {
                age_appropriateness: 0,
                language_appropriateness: 0,
                content_validity: 0,
                creativity: 0
              };
              if (rList.length > 0) {
                Object.keys(averages).forEach(k => {
                  const sum = rList.reduce((acc, curr) => acc + (curr[k] || 0), 0);
                  averages[k] = sum / rList.length;
                });
              }

              list.push({
                id: memeDoc.id,
                saveId: bookmark.saveId,
                averages,
                ...data
              });

              // Resolve creator username
              const cId = data.creator_id;
              if (cId === "admin") {
                setCreatorCache(prev => ({ ...prev, admin: "Admin" }));
              } else if (!creatorCache[cId]) {
                const cDoc = await getDoc(doc(db, "users", cId));
                if (cDoc.exists()) {
                  setCreatorCache(prev => ({ ...prev, [cId]: cDoc.data().name }));
                }
              }
            }
          } catch (e) {
            console.error("Failed loading bookmark detail", e);
          }
        }
        setBookmarkedMemes(list);
      };

      loadBookmarks();
    });

    return () => unsubscribeSaves();
  }, [user]);

  // Fetch user's earned badges
  useEffect(() => {
    if (!user) return;
    const badgesCol = collection(db, "badges");
    const q = query(badgesCol, where("user_id", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setEarnedBadges(list);
    });
    return () => unsubscribe();
  }, [user]);

  // Automatic Badge progression level calculations
  const calculateLevel = (count) => {
    if (count >= 50) return 5;
    if (count >= 25) return 4;
    if (count >= 10) return 3;
    if (count >= 5) return 2;
    if (count >= 1) return 1;
    return 0;
  };

  // Badge transaction checks trigger
  useEffect(() => {
    if (!user || earnedBadges.length === 0 && myMemes.length === 0) return;

    const checkAndAwardBadges = async () => {
      for (const [category, config] of Object.entries(CATEGORY_NAMES)) {
        const count = stats[config.statKey] || 0;
        const currentLevel = calculateLevel(count);

        if (currentLevel > 0) {
          const hasBadge = earnedBadges.some(
            b => b.category === category && b.level === currentLevel
          );

          if (!hasBadge) {
            try {
              const badgeName = `${LEVEL_NAMES[currentLevel]} ${config.label}`;
              await addDoc(collection(db, "badges"), {
                user_id: user.uid,
                category,
                level: currentLevel,
                badge_name: badgeName,
                awarded_at: serverTimestamp()
              });
            } catch (err) {
              console.error("Failed to log badge milestone", err);
            }
          }
        }
      }
    };

    checkAndAwardBadges();
  }, [stats, earnedBadges, user]);

  const getProgressDetails = (count) => {
    const currentLevel = calculateLevel(count);
    const currentBadgeName = currentLevel > 0 ? `${LEVEL_NAMES[currentLevel]} Medal` : "Locked";

    if (currentLevel === 5) {
      return {
        currentLevel,
        currentBadgeName,
        progressPercent: 100,
        text: "Diamond Mastery reached!"
      };
    }

    const currentMin = MILESTONES[currentLevel];
    const nextTarget = MILESTONES[currentLevel + 1];
    const nextLevelName = LEVEL_NAMES[currentLevel + 1];
    const needed = nextTarget - count;
    const progressRatio = (count - currentMin) / (nextTarget - currentMin);
    const progressPercent = Math.max(0, Math.min(100, Math.round(progressRatio * 100)));

    return {
      currentLevel,
      currentBadgeName,
      progressPercent,
      text: `${needed} more to unlock ${nextLevelName}`
    };
  };

  const handleAvatarSelect = async (avatarUrl) => {
    if (!user) return;
    setAvatarLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { avatar_url: avatarUrl });
      setShowAvatarModal(false);
    } catch (err) {
      console.error("Failed to update avatar", err);
      toast("Failed to update avatar. Please try again.", "error");
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleCustomAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setAvatarLoading(true);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}_${Date.now()}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { avatar_url: downloadUrl });

      setShowAvatarModal(false);
    } catch (err) {
      console.error("Failed to upload custom avatar", err);
      toast("Failed to upload image. Please try again.", "error");
    } finally {
      setAvatarLoading(false);
    }
  };

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

  const handleMediaDownload = (url, title) => {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.download = title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("License Notice: This file is licensed under Creative Commons CC BY-NC-SA 4.0.", "info");
  };

  const handleRemoveBookmark = async (saveId) => {
    try {
      await deleteDoc(doc(db, "saves", saveId));
    } catch (e) {
      console.error("Failed to remove bookmark", e);
    }
  };

  const handleDeleteMeme = async (memeId, isDraft) => {
    if (!window.confirm(`Are you sure you want to delete this ${isDraft ? "draft" : "meme"}? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, "memes", memeId));
      if (!isDraft && user) {
        const statsDocRef = doc(db, "user_stats", user.uid);
        await updateDoc(statsDocRef, {
          memes_created_count: increment(-1)
        });
      }
      toast(`${isDraft ? "Draft" : "Meme"} deleted successfully.`, "success");
    } catch (e) {
      console.error("Failed to delete meme", e);
      toast("Failed to delete. Please try again.", "error");
    }
  };

  const containerClass = highContrastMode
    ? "bg-zinc-900 border border-zinc-800 text-white shadow-sm rounded-xl"
    : "bg-white border border-gray-200 shadow-sm rounded-xl";

  const renderCardGrid = (items, isBookmarkTab = false) => {
    if (items.length === 0) {
      return (
        <div className={`p-12 text-center text-gray-500 ${containerClass}`}>
          <p className="text-sm font-medium">No items found in this section.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((meme) => {
          const creatorName = meme.creator_id === "admin" ? "Admin" : (creatorCache[meme.creator_id] || "Creator");
          return (
            <div key={meme.id} className={`flex flex-col h-full overflow-hidden ${containerClass}`}>

              {/* Media Preview */}
              <div className="bg-gray-100 dark:bg-gray-900 aspect-video relative flex items-center justify-center overflow-hidden">
                {meme.format === "image" && (
                  <img src={meme.media_url} alt={meme.title} className="w-full h-full object-cover" />
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
                <div className="absolute top-2 left-2 z-10">
                  <span className="bg-gray-950/70 text-white text-[10px] px-2 py-0.5 rounded">
                    {meme.format.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-grow flex flex-col justify-between">
                <div>
                  <h4 className="font-extrabold text-sm mb-2 line-clamp-1">{meme.title}</h4>

                  {/* Tag list */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    <span className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 text-[9px] px-1.5 py-0.5 rounded font-bold">
                      {meme.subject}
                    </span>
                    <span className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 text-[9px] px-1.5 py-0.5 rounded font-bold">
                      {meme.age_group}
                    </span>
                  </div>

                  {/* Bookmark specific average evaluations progress bars */}
                  {isBookmarkTab && meme.averages && (
                    <div className="space-y-1.5 my-3 bg-gray-55 dark:bg-gray-900 p-2.5 rounded text-[10px] font-semibold text-gray-500">
                      {[
                        { label: "Age Appr.", key: "age_appropriateness" },
                        { label: "Language", key: "language_appropriateness" },
                        { label: "Validity", key: "content_validity" }
                      ].map(bar => (
                        <div key={bar.key} className="flex items-center justify-between">
                          <span>{bar.label}</span>
                          <span className="text-purple-650 font-bold">{(meme.averages[bar.key] || 0).toFixed(1)}/5</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card footer controls */}
                <div className="pt-3 border-t border-gray-150 dark:border-gray-750 flex items-center justify-between text-[11px] font-semibold">
                  <div className="flex items-center space-x-2">
                    {/* Download Trigger */}
                    <button
                      onClick={() => {
                        if (meme.format === "image" || meme.format === "gif") {
                          downloadMemeWithWatermark(meme.media_url, meme.title);
                        } else {
                          handleMediaDownload(meme.media_url, meme.title);
                        }
                      }}
                      className="text-gray-500 hover:text-indigo-650"
                      title="Download Meme File"
                    >
                      Download
                    </button>

                    {isBookmarkTab && (
                      <button
                        onClick={() => handleRemoveBookmark(meme.saveId)}
                        className="text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    )}

                    {!isBookmarkTab && user && (meme.creator_id === user.uid || profile?.role === "admin") && (
                      <button
                        onClick={() => handleDeleteMeme(meme.id, meme.visibility === "draft")}
                        className="text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Remix Trigger / Resume in Lab if Draft */}
                  {meme.visibility === "draft" ? (
                    <button
                      onClick={() => navigate(`/lab?draftId=${meme.id}`)}
                      className="text-indigo-650 hover:underline"
                    >
                      Resume
                    </button>
                  ) : (
                    meme.template_id && (
                      <button
                        onClick={() => navigate(`/lab?templateId=${meme.template_id}&templateUrl=${meme.media_url}&format=${meme.format}`)}
                        className="text-purple-650 hover:underline"
                      >
                        🌀 Remix
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">

      {/* 1. Profile Demographics Card Header */}
      {profile && (
        <div className={`p-6 ${containerClass}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div 
                className="relative group cursor-pointer flex-shrink-0" 
                onClick={() => setShowAvatarModal(true)}
                title="Click to Change Avatar"
              >
                <img
                  src={profile.avatar_url || "/avatar1.png"}
                  className="w-20 h-20 rounded-full object-cover border-4 border-purple-200 dark:border-purple-800 transition group-hover:scale-105"
                  alt="Profile Avatar"
                />
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200">
                  <span className="text-[10px] text-white font-extrabold tracking-wide uppercase text-center px-2 leading-tight">Change Avatar</span>
                </div>
              </div>
              <div className="text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start space-x-2.5">
                  <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                    {profile.name}
                  </h2>
                  {profile.is_verified && (
                    <img src="/verified-badge.png" className="w-5 h-5 inline-block" alt="Verified Creator" title="Verified Creator" />
                  )}
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-purple-650 mt-1 capitalize">
                  {profile.role} • {profile.institution}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {[profile.place, profile.state, profile.country].filter(Boolean).join(", ") || "Location details not set"}
                </p>
                {profile.tagline && (
                  <p className="text-xs italic text-gray-400 dark:text-gray-500 mt-2 max-w-sm">
                    "{profile.tagline}"
                  </p>
                )}
                <button
                  onClick={openEditModal}
                  className="mt-3 bg-purple-50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-900/35 border border-purple-200 dark:border-purple-850 text-purple-700 dark:text-purple-300 font-bold text-xs px-3.5 py-1.5 rounded-lg transition"
                >
                  ⚙️ Edit Profile Details
                </button>
              </div>
            </div>

            {profile.id_card_url && (
              <a
                href={profile.id_card_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-850 px-4 py-2 rounded-lg hover:bg-indigo-100 transition"
              >
                🔍 Preview Verification ID Card
              </a>
            )}
          </div>
        </div>
      )}

      {/* 2. Scoreboard Activity Statistics Panel */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Memes Shared", val: stats.memes_created_count, icon: <img src="/research.png" alt="not" className="w-8 h-8 mx-auto" /> },
          { label: "Resources Shared", val: stats.resources_contributed_count, icon: <img src="/process.png" alt="not" className="w-8 h-8 mx-auto" /> },
          { label: "Staffroom Posts", val: stats.staffroom_posts_count, icon: <img src="/speech-bubbles.png" alt="not" className="w-8 h-8 mx-auto" /> },
          { label: "Ratings Provided", val: stats.ratings_provided_count, icon: <img src="/star.png" alt="not" className="w-8 h-8 mx-auto" /> },
          { label: "Likes Received", val: stats.total_likes_received, icon: <img src="/shape.png" alt="not" className="w-8 h-8 mx-auto" /> }
        ].map((stat, idx) => (
          <div key={idx} className={`p-4 text-center ${containerClass}`}>
            <span className="text-xl block mb-2">{stat.icon}</span>
            <span className="block text-[10px] text-gray-400 uppercase font-semibold">{stat.label}</span>
            <span className="text-2xl font-extrabold tracking-tight mt-1 block">{stat.val}</span>
          </div>
        ))}
      </div>

      {/* 3. Automatic 5-Category Badge progression matrix */}
      <div className={`p-6 ${containerClass}`}>
        <h3 className="text-sm font-bold uppercase tracking-wider border-b pb-2 mb-4">Milestone Progression Badges</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 text-xs font-semibold">
          {Object.entries(CATEGORY_NAMES).map(([category, config]) => {
            const count = stats[config.statKey] || 0;
            const progress = getProgressDetails(count);

            return (
              <div key={category} className="space-y-2 border border-gray-100 dark:border-gray-800 p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                <span className="block text-gray-400 uppercase text-[9px] truncate">{config.label}</span>
                <div className="flex items-center space-x-1.5">
                  <span className="text-base"><img src={getBadgeIcon(progress.currentLevel)} alt="Badge icon" className="w-6 h-6" /></span>
                  <span className="font-bold text-gray-850 dark:text-gray-100">{progress.currentBadgeName}</span>
                </div>

                {/* Horizontal Progress Bar with animation */}
                <div className="w-full bg-gray-250 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-650 h-full badge-progress-bar rounded-full"
                    style={{ '--progress-target': `${progress.progressPercent}%`, width: `${progress.progressPercent}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-gray-500 block leading-tight">{progress.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Portfolio folder tab selector */}
      <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab("my-memes")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${activeTab === "my-memes"
            ? "border-purple-600 text-purple-600 dark:text-purple-400"
            : "border-transparent text-gray-400 hover:text-gray-500"
            }`}
        >
          My Public Creations ({myMemes.length})
        </button>
        <button
          onClick={() => setActiveTab("my-drafts")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${activeTab === "my-drafts"
            ? "border-purple-600 text-purple-600 dark:text-purple-400"
            : "border-transparent text-gray-400 hover:text-gray-500"
            }`}
        >
          My Saved Drafts ({myDrafts.length})
        </button>
        <button
          onClick={() => setActiveTab("bookmarks")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${activeTab === "bookmarks"
            ? "border-purple-600 text-purple-600 dark:text-purple-400"
            : "border-transparent text-gray-400 hover:text-gray-500"
            }`}
        >
          My Bookmarked Memes ({bookmarkedMemes.length})
        </button>
      </div>

      {/* 5. Render Tab contents */}
      <div>
        {activeTab === "my-memes" && renderCardGrid(myMemes)}
        {activeTab === "my-drafts" && renderCardGrid(myDrafts)}
        {activeTab === "bookmarks" && renderCardGrid(bookmarkedMemes, true)}
      </div>

      {/* Avatar Picker Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-850 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 transform transition-all scale-100 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Choose Profile Avatar</h3>
              <button 
                onClick={() => setShowAvatarModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-6">
              Select one of the custom illustrations below to update your profile image across the application.
            </p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { url: "/avatar1.png", label: "Blonde Girl" },
                { url: "/avatar2.png", label: "Bun Girl" },
                { url: "/avatar3.png", label: "Overalls Girl" },
                { url: "/avatar4.png", label: "Hoodie Boy" },
                { url: "/avatar5.png", label: "Bearded Man" }
              ].map((avatar) => {
                const isSelected = profile.avatar_url === avatar.url || (!profile.avatar_url && avatar.url === "/avatar1.png");
                return (
                  <button
                    key={avatar.url}
                    onClick={() => handleAvatarSelect(avatar.url)}
                    disabled={avatarLoading}
                    className={`relative p-2 rounded-xl border-2 transition-all hover:scale-105 ${
                      isSelected
                        ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/20"
                        : "border-gray-100 dark:border-gray-800 hover:border-purple-300 bg-gray-50 dark:bg-gray-900"
                    }`}
                  >
                    <img src={avatar.url} alt={avatar.label} className="w-full h-auto rounded-lg object-cover" />
                    {isSelected && (
                      <span className="absolute -top-1.5 -right-1.5 bg-purple-600 text-white rounded-full p-0.5 text-[8px] font-bold w-4 h-4 flex items-center justify-center border border-white">
                        ✓
                      </span>
                    )}
                    <span className="block text-[8px] font-semibold text-gray-500 mt-1 truncate">{avatar.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Image Upload Option */}
            <div className="mt-2 pt-4 border-t border-gray-100 dark:border-gray-800 mb-6">
              <span className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                Or upload your own image:
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCustomAvatarUpload}
                  className="hidden"
                  id="custom-avatar-upload-input"
                  disabled={avatarLoading}
                />
                <label
                  htmlFor="custom-avatar-upload-input"
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-250 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-xs font-bold rounded-lg cursor-pointer transition shadow-sm inline-flex items-center gap-1.5"
                >
                  📁 Browse Image
                </label>
                {avatarLoading && (
                  <span className="text-[10px] text-gray-400 animate-pulse font-semibold">
                    Uploading...
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Profile Details Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-850 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 transform transition-all scale-100 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Profile Details</h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={inputClass}
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Institution Name</label>
                <input
                  type="text"
                  required
                  value={editInstitution}
                  onChange={(e) => setEditInstitution(e.target.value)}
                  className={inputClass}
                  placeholder="Oakridge High School"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Bio / Tagline</label>
                <input
                  type="text"
                  value={editTagline}
                  onChange={(e) => setEditTagline(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Biology Educator & Meme Enthusiast"
                  maxLength={100}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">City / Place</label>
                  <input
                    type="text"
                    value={editPlace}
                    onChange={(e) => setEditPlace(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Bangalore"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">State</label>
                  <input
                    type="text"
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Karnataka"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Country</label>
                <input
                  type="text"
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. India"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-sm"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;
