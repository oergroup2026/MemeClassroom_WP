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
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";

const MILESTONES = [0, 1, 5, 10, 25, 50];
const LEVEL_NAMES = ["None", "Bronze", "Silver", "Gold", "Platinum", "Diamond"];

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

  // Watermark Downloader logic
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

      ctx.fillStyle = "#1e1b4b";
      ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

      ctx.fillStyle = "#fbbf24";
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
      const link = document.createElement("a");
      link.href = imageUrl;
      link.target = "_blank";
      link.download = `${title || 'meme'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  };

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

  const handleRemoveBookmark = async (saveId) => {
    try {
      await deleteDoc(doc(db, "saves", saveId));
    } catch (e) {
      console.error("Failed to remove bookmark", e);
    }
  };

  const containerClass = highContrastMode
    ? "bg-black border-2 border-yellow-400 text-yellow-400"
    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl";

  const renderCardGrid = (items, isBookmarkTab = false) => {
    if (items.length === 0) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-500 shadow-sm">
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
                      Ages {meme.age_group}
                    </span>
                  </div>

                  {/* Bookmark specific average evaluations progress bars */}
                  {isBookmarkTab && meme.averages && (
                    <div className="space-y-1.5 my-3 bg-gray-55 dark:bg-gray-900 p-2.5 rounded text-[10px] font-semibold text-gray-500">
                      {[
                        { label: "Age Appr.", key: "age_appropriateness" },
                        { label: "Language", key: "language_appropriateness" },
                        { label: "Validity", key: "content_validity" },
                        { label: "Creativity", key: "creativity" }
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
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                  {profile.name}
                </h2>
                {profile.is_verified && (
                  <span className="text-xl" title="Verified Creator">
                    🔵
                  </span>
                )}
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-purple-650 mt-1 capitalize">
                {profile.role} • {profile.institution}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {profile.place}, {profile.state}, {profile.country}
              </p>
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
          { label: "Memes Shared", val: stats.memes_created_count, icon: <img src="research.png" alt="not" className="w-8 h-8" /> },
          { label: "Resources Shared", val: stats.resources_contributed_count, icon: <img src="process.png" alt="not" className="w-8 h-8" /> },
          { label: "Staffroom Posts", val: stats.staffroom_posts_count, icon: <img src="school.png" alt="not" className="w-8 h-8" /> },
          { label: "Ratings Provided", val: stats.ratings_provided_count, icon: <img src="star.png" alt="not" className="w-8 h-8" /> },
          { label: "Likes Received", val: stats.total_likes_received, icon: <img src="shape.png" alt="not" className="w-8 h-8" /> }
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
                  <span className="text-base"><img src="gold-medal.png" alt="not" className="w-6 h-6" /></span>
                  <span className="font-bold text-gray-850 dark:text-gray-100">{progress.currentBadgeName}</span>
                </div>

                {/* Horizontal Progress Bar */}
                <div className="w-full bg-gray-250 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-650 h-full transition-all duration-300"
                    style={{ width: `${progress.progressPercent}%` }}
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

    </div>
  );
};

export default Profile;
