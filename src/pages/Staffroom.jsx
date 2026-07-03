import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  collection, 
  query, 
  where, 
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
  runTransaction,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import { useUserModal } from "../context/UserModalContext";

const Staffroom = () => {
  const { user, profile } = useAuth();
  const { highContrastMode } = useUdl();
  const { openUserModal } = useUserModal();
  const navigate = useNavigate();

  // Forum Threads States
  const [threads, setThreads] = useState([]);
  const [replies, setReplies] = useState({}); // map threadId -> replies array
  const [userCache, setUserCache] = useState({});
  const [availableMemes, setAvailableMemes] = useState([]);

  // Active Meme Detail Modal States
  const [activeMeme, setActiveMeme] = useState(null);
  const [expertComments, setExpertComments] = useState([]);
  const [newExpertComment, setNewExpertComment] = useState("");
  const [currentMemeRatings, setCurrentMemeRatings] = useState([]);
  const [userSubmittedRating, setUserSubmittedRating] = useState(null);
  const [userLikesMap, setUserLikesMap] = useState({});
  const [animatingHeartMemeId, setAnimatingHeartMemeId] = useState(null);
  const [likePendingMap, setLikePendingMap] = useState({});

  // Compose State
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeType, setComposeType] = useState("story"); // "story" | "query"
  const [composeBody, setComposeBody] = useState("");
  const [composeOutcome, setComposeOutcome] = useState("worked");
  const [linkedMemeId, setLinkedMemeId] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeError, setComposeError] = useState("");

  // Reply Compose state map (threadId -> text)
  const [replyInputMap, setReplyInputMap] = useState({});

  // Active modal tabs filters
  const [activeFilter, setActiveFilter] = useState("all"); // "all" | "story" | "query"

  // Widget fallback states
  const [showEmbedFallback, setShowEmbedFallback] = useState(true);

  // 1. Fetch available public memes for linked dropdown
  useEffect(() => {
    const memesCol = collection(db, "memes");
    const q = query(memesCol, where("visibility", "==", "public"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setAvailableMemes(list);
    });
    return () => unsubscribe();
  }, []);

  // Load Expert Comments & Ratings for the Active Expanded Meme
  useEffect(() => {
    let unsubscribeComments = () => {};
    let unsubscribeRatings = () => {};

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

  // 2. Real-Time Thread Feed listener
  useEffect(() => {
    const postsCol = collection(db, "staffroom_posts");
    const unsubscribe = onSnapshot(postsCol, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });

      // Sort newest first
      list.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setThreads(list);

      // Fetch replies for each thread dynamically
      list.forEach((thread) => {
        const repliesCol = collection(db, "staffroom_replies");
        const rq = query(repliesCol, where("post_id", "==", thread.id));
        onSnapshot(rq, (replySnap) => {
          const rList = [];
          replySnap.forEach(d => {
            rList.push({ id: d.id, ...d.data() });
          });
          rList.sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));
          setReplies(prev => ({ ...prev, [thread.id]: rList }));
        });
      });

    });

    return () => unsubscribe();
  }, []);

  // 2.5. Dedicated User profile (name, role, is_verified) resolution listener
  useEffect(() => {
    const ids = [];

    // Thread authors
    threads.forEach(t => {
      if (t.author_id) ids.push(t.author_id);
    });

    // Reply authors
    Object.values(replies).forEach(rList => {
      rList.forEach(r => {
        if (r.author_id) ids.push(r.author_id);
      });
    });

    // Active meme creator
    if (activeMeme && activeMeme.creator_id) {
      ids.push(activeMeme.creator_id);
    }

    // Active meme commenters
    expertComments.forEach(c => {
      if (c.user_id) ids.push(c.user_id);
    });

    const uniqueIds = [...new Set(ids)];

    const fetchUsers = async () => {
      const idsToFetch = uniqueIds.filter(id => id !== "admin" && !userCache[id]);
      if (idsToFetch.length === 0) return;

      // Mark loading placeholders immediately to prevent duplicate fetches
      const placeholderUpdates = {};
      idsToFetch.forEach(id => {
        placeholderUpdates[id] = { name: "Loading...", role: "student", is_verified: false };
      });
      setUserCache(prev => ({ ...prev, ...placeholderUpdates }));

      try {
        const newCacheUpdates = {};
        await Promise.all(idsToFetch.map(async (userId) => {
          try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              newCacheUpdates[userId] = {
                name: userData.name || "Unknown User",
                role: userData.role || "student",
                is_verified: userData.is_verified || false
              };
            } else {
              newCacheUpdates[userId] = { name: "Unknown User", role: "student", is_verified: false };
            }
          } catch (e) {
            console.error("Error resolving user profile in Staffroom", e);
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
  }, [threads, replies, activeMeme, expertComments]);

  // 3. Social Embed safe script watchdog timer
  useEffect(() => {
    const timer = setTimeout(() => {
      // Mock widget detection: if Twitter element hasn't mounted, show the card fallback
      const widget = document.getElementById("twitter-widget-holder");
      if (!widget || widget.children.length === 0) {
        setShowEmbedFallback(true);
      } else {
        setShowEmbedFallback(false);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Mock Backend Smart Pruning Simulation Helper
  const simulateSmartPruning = () => {
    alert("Pruning Daemon executed. Files older than 30 days have been cleared from Storage buckets, preserving Firestore text metadata structures.");
  };

  const handleThreadSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setComposeError("");

    if (composeBody.trim().length < 50) {
      setComposeError("Thread body text must be at least 50 characters long.");
      return;
    }

    setComposeLoading(true);

    try {
      const postsColRef = collection(db, "staffroom_posts");
      const statsDocRef = doc(db, "user_stats", user.uid);

      // Save post and increment statistics atomically via Firestore Transaction
      await runTransaction(db, async (transaction) => {
        const newPostRef = doc(postsColRef);
        
        transaction.set(newPostRef, {
          author_id: user.uid,
          post_type: composeType,
          body: composeBody,
          outcome_tag: composeType === "story" ? composeOutcome : "",
          meme_id: linkedMemeId,
          attachment_name: attachmentName || "",
          likes: 0,
          liked_by: [],
          is_solved: false,
          solved_reply_id: "",
          created_at: serverTimestamp()
        });

        transaction.update(statsDocRef, {
          staffroom_posts_count: increment(1)
        });
      });

      setShowComposeModal(false);
      setComposeBody("");
      setLinkedMemeId("");
      setAttachmentName("");
    } catch (err) {
      console.error(err);
      setComposeError("Failed to publish thread.");
    } finally {
      setComposeLoading(false);
    }
  };

  const handleReplySubmit = async (threadId) => {
    if (!user) return;
    const body = replyInputMap[threadId];
    if (!body || !body.trim()) return;

    try {
      await addDoc(collection(db, "staffroom_replies"), {
        post_id: threadId,
        author_id: user.uid,
        body: body,
        is_accepted_solution: false,
        created_at: serverTimestamp()
      });

      setReplyInputMap(prev => ({ ...prev, [threadId]: "" }));
    } catch (e) {
      console.error("Failed to submit reply", e);
    }
  };

  // Upvote/Like toggle trigger
  const handleThreadLike = async (thread) => {
    if (!user) {
      alert("Please log in to upvote threads.");
      return;
    }
    try {
      const threadRef = doc(db, "staffroom_posts", thread.id);
      const likedBy = thread.liked_by || [];
      const hasLiked = likedBy.includes(user.uid);

      if (hasLiked) {
        // Unlike: remove user from liked_by and decrement likes count
        await updateDoc(threadRef, {
          liked_by: arrayRemove(user.uid),
          likes: increment(-1)
        });
      } else {
        // Like: add user to liked_by and increment likes count
        await updateDoc(threadRef, {
          liked_by: arrayUnion(user.uid),
          likes: increment(1)
        });
      }
    } catch (e) {
      console.error("Like update failed", e);
    }
  };

  const handleDeleteThread = async (threadId) => {
    if (!window.confirm("Are you sure you want to delete this thread? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "staffroom_posts", threadId));
      if (user) {
        const statsDocRef = doc(db, "user_stats", user.uid);
        await updateDoc(statsDocRef, {
          staffroom_posts_count: increment(-1)
        });
      }
      alert("Thread deleted successfully.");
    } catch (e) {
      console.error("Failed to delete thread", e);
      alert("Failed to delete thread. Please try again.");
    }
  };

  const handleDeleteReply = async (replyId) => {
    if (!window.confirm("Are you sure you want to delete this reply?")) return;
    try {
      await deleteDoc(doc(db, "staffroom_replies", replyId));
      alert("Reply deleted successfully.");
    } catch (e) {
      console.error("Failed to delete reply", e);
      alert("Failed to delete reply. Please try again.");
    }
  };

  // "Accept Solution" solved logic gates
  const handleAcceptSolution = async (threadId, replyId) => {
    try {
      // 1. Update reply tag status
      const replyRef = doc(db, "staffroom_replies", replyId);
      await updateDoc(replyRef, {
        is_accepted_solution: true
      });

      // 2. Mark main thread post card as solved
      const threadRef = doc(db, "staffroom_posts", threadId);
      await updateDoc(threadRef, {
        is_solved: true,
        solved_reply_id: replyId
      });
    } catch (e) {
      console.error("Accept solution failed", e);
    }
  };

  // Filter threads
  const filteredThreads = threads.filter(t => {
    if (activeFilter === "story") return t.post_type === "story";
    if (activeFilter === "query") return t.post_type === "query";
    return true;
  });

  const containerClass = highContrastMode 
    ? "bg-zinc-900 border border-zinc-800 text-white shadow-sm rounded-xl" 
    : "bg-white border border-gray-200 shadow-sm rounded-xl";

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

  const downloadMemeWithWatermark = (imageUrl, title) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl + (imageUrl.includes("?") ? "&" : "?") + "t=" + new Date().getTime();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const w = img.naturalWidth || img.width || 500;
      const h = img.naturalHeight || img.height || 500;
      const borderHeight = Math.max(45, Math.min(120, Math.round(h * 0.08)));
      canvas.width = w;
      canvas.height = h + borderHeight;
      ctx.drawImage(img, 0, 0, w, h);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, h, w, borderHeight);
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, w, h);
      const fontSize = Math.max(11, Math.round(borderHeight * 0.28));
      ctx.fillStyle = "#374151";
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textBaseline = "middle";
      const paddingX = Math.max(15, Math.round(w * 0.04));
      const textY = h + Math.round(borderHeight / 2);
      ctx.textAlign = "left";
      ctx.fillText("MemeClassroom", paddingX, textY);
      ctx.textAlign = "right";
      ctx.fillText("CC BY-NC-SA 4.0 License", w - paddingX, textY);
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
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

  const handleRateSubmit = async (criteria, score) => {
    if (!user || !activeMeme) return;
    const ratingDocId = `${user.uid}_${activeMeme.id}`;
    const ratingRef = doc(db, "ratings", ratingDocId);
    const statsRef = doc(db, "user_stats", user.uid);
    try {
      await runTransaction(db, async (transaction) => {
        const ratingDoc = await transaction.get(ratingRef);
        const existingData = ratingDoc.exists() ? ratingDoc.data() : {};
        let newRating = {
          meme_id: activeMeme.id,
          user_id: user.uid,
          ...existingData,
          [criteria]: score,
          created_at: serverTimestamp()
        };
        transaction.set(ratingRef, newRating);
        if (!ratingDoc.exists()) {
          transaction.set(statsRef, {
            ratings_provided_count: increment(1)
          }, { merge: true });
        }
      });
    } catch (e) {
      console.error("Rating transaction failed", e);
    }
  };

  const handleExpertCommentSubmit = async (e) => {
    e.preventDefault();
    if (!user || !profile || !activeMeme || !newExpertComment) return;
    if (profile.role !== "expert" && profile.role !== "admin") return;
    try {
      await addDoc(collection(db, "comments"), {
        meme_id: activeMeme.id,
        user_id: user.uid,
        body: newExpertComment,
        timestamp: serverTimestamp(),
        parent_id: null,
        is_expert_comment: true
      });
      setNewExpertComment("");
    } catch (e) {
      console.error("Expert comment save failed", e);
    }
  };

  const handleLikeToggle = async (memeId, creatorId) => {
    if (!user) {
      alert("Please log in to like memes.");
      return;
    }
    if (likePendingMap[memeId]) return;
    setLikePendingMap(prev => ({ ...prev, [memeId]: true }));
    setAnimatingHeartMemeId(memeId);
    setTimeout(() => {
      setAnimatingHeartMemeId(null);
    }, 300);

    const existingLikeId = userLikesMap[memeId];
    const statsRef = doc(db, "user_stats", creatorId);
    const memeRef = doc(db, "memes", memeId);

    try {
      if (existingLikeId) {
        await deleteDoc(doc(db, "likes", existingLikeId));
        await setDoc(statsRef, {
          total_likes_received: increment(-1)
        }, { merge: true });
        await updateDoc(memeRef, {
          likes_count: increment(-1)
        });
      } else {
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
      setLikePendingMap(prev => ({ ...prev, [memeId]: false }));
    }
  };

  const solvedCardClass = highContrastMode
    ? "border-2 border-emerald-600 bg-emerald-950/20 text-white rounded-xl"
    : "border-2 border-emerald-500 bg-emerald-50/10";

  const btnClass = "bg-purple-600 hover:bg-purple-750 text-white font-semibold text-sm px-4 py-2 rounded-lg transition shadow-sm";

  const inputClass = highContrastMode
    ? "w-full px-3 py-2 border border-zinc-800 bg-zinc-950 rounded-lg text-sm text-white placeholder-gray-500"
    : "w-full px-3 py-2 border border-gray-300 bg-gray-50 rounded-lg text-sm text-gray-850";

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      
      {/* Smart Pruning Warning Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-amber-800 dark:text-amber-300 font-semibold leading-relaxed">
          ⚠️ **Data Retention Policy Notice**: Attached heavy media files (Images, PDFs, Videos) are pruned after 30 days to limit storage bloat, keeping raw text logs intact.
        </div>
        <button 
          onClick={simulateSmartPruning}
          className="text-[10px] font-bold text-amber-900 dark:text-amber-400 border border-amber-300 dark:border-amber-800 bg-white dark:bg-gray-900 px-3 py-1.5 rounded hover:bg-amber-100"
        >
          Simulate Pruning Sweep
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-850 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Staffroom Forum</h1>
          <p className="mt-1 text-sm text-gray-500">
            Share teacher stories or post queries for verified peer answers.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          {user && (
            <button onClick={() => setShowComposeModal(true)} className={btnClass}>
              📝 Compose Thread
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left Forum Feed, Right Embed Column */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left 3 Columns: timeline feed pane */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Timeline filter toggles */}
          <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-850 pb-2">
            {[
              { id: "all", label: "All Timeline Feed" },
              { id: "story", label: "Stories & Experiences" },
              { id: "query", label: "Queries & Doubts" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`text-xs font-bold border-b-2 pb-1.5 transition ${
                  activeFilter === tab.id
                    ? "border-purple-650 text-purple-650 dark:text-purple-400"
                    : "border-transparent text-gray-400 hover:text-gray-500"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {filteredThreads.length > 0 ? (
              filteredThreads.map((thread) => {
                const authorName = userCache[thread.author_id]?.name || "Teacher";
                const isSolved = thread.is_solved;
                const activeReplies = replies[thread.id] || [];
                const linkedMeme = availableMemes.find(m => m.id === thread.meme_id);

                return (
                  <div 
                    key={thread.id} 
                    className={`p-6 transition rounded-xl ${isSolved ? solvedCardClass : containerClass}`}
                  >
                    
                    {/* Header tags */}
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[11px] font-extrabold uppercase px-2.5 py-1 rounded ${
                          thread.post_type === "query" ? "bg-red-50 text-red-650" : "bg-teal-50 text-teal-650"
                        }`}>
                          {thread.post_type === "query" ? "Doubt / Query" : "Experience Story"}
                        </span>
                        
                        {thread.outcome_tag && (
                          <span className="text-[11px] font-semibold text-gray-550 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                            Outcome: {thread.outcome_tag}
                          </span>
                        )}

                        {isSolved && (
                          <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                            ✓ Solved
                          </span>
                        )}
                      </div>

                      {/* Clickable Contributor gateway link */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openUserModal(thread.author_id)}
                          className="text-xs text-purple-750 font-bold hover:underline"
                        >
                          By {authorName}
                        </button>
                        {user && (thread.author_id === user.uid || profile?.role === "admin") && (
                          <button
                            onClick={() => handleDeleteThread(thread.id)}
                            className="text-red-500 hover:text-red-750 text-xs font-bold transition ml-2"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Text Body */}
                    <p className="text-sm sm:text-[15px] text-gray-700 dark:text-gray-200 leading-relaxed font-medium mb-4 whitespace-pre-line">
                      {thread.body}
                    </p>

                    {/* Linked Meme Preview Box */}
                    {linkedMeme && (
                      <div 
                        onClick={() => setActiveMeme(linkedMeme)}
                        title="Click to view details, ratings and reviews"
                        className="my-4 border border-gray-150 dark:border-zinc-850 rounded-xl overflow-hidden bg-gray-50 dark:bg-zinc-950 flex flex-col sm:flex-row items-center p-3 gap-4 cursor-pointer hover:shadow-md hover:ring-2 hover:ring-purple-500/20 transition duration-200"
                      >
                        <div className="w-full sm:w-32 aspect-[4/3] relative flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg border border-gray-100 dark:border-zinc-800 overflow-hidden flex-shrink-0">
                          {linkedMeme.format === "image" && (
                            <img src={linkedMeme.media_url} alt={linkedMeme.title} className="max-w-full max-h-full object-contain" />
                          )}
                          {linkedMeme.format === "gif" && (
                            <img src={linkedMeme.media_url} alt={linkedMeme.title} className="max-w-full max-h-full object-contain" />
                          )}
                          {linkedMeme.format === "video" && (
                            <video src={linkedMeme.media_url} className="max-w-full max-h-full object-contain" controls />
                          )}
                          {linkedMeme.format === "audio" && (
                            <div className="text-2xl">🔊</div>
                          )}
                        </div>
                        <div className="flex-grow min-w-0 text-left">
                          <span className="text-[10px] uppercase tracking-wider text-purple-655 dark:text-purple-400 font-bold block mb-0.5">Linked Meme Reference (Click to view details)</span>
                          <h4 className="font-extrabold text-sm text-gray-905 dark:text-white truncate">{linkedMeme.title}</h4>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-750 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              {linkedMeme.subject}
                            </span>
                            <span className="bg-teal-50 dark:bg-teal-950/20 text-teal-750 dark:text-teal-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              Ages {linkedMeme.age_group}
                            </span>
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                              {linkedMeme.format}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Attachment slot */}
                    {thread.attachment_name && (
                      <div className="my-3 p-2 border border-dashed rounded text-xs text-gray-500 flex items-center space-x-1.5 bg-gray-50 dark:bg-gray-900">
                        <span>📎 Attachment:</span>
                        <span className="italic">{thread.attachment_name} (Pruning active)</span>
                      </div>
                    )}

                    {/* Likes & replies count panel */}
                    <div className="flex items-center space-x-4 border-t border-gray-100 dark:border-gray-700/50 pt-3 text-xs">
                      <button
                        onClick={() => handleThreadLike(thread)}
                        className={`flex items-center space-x-1.5 transition ${
                          user && thread.liked_by?.includes(user.uid)
                            ? "text-purple-600 font-bold"
                            : "text-gray-400 hover:text-purple-650"
                        }`}
                      >
                        <span>👍</span>
                        <span>{thread.likes || 0} Upvotes</span>
                      </button>
                      <span className="text-gray-400 flex items-center space-x-1.5">
                        <img src="/speech-bubbles.png" className="w-3.5 h-3.5" alt="Replies" />
                        <span>{activeReplies.length} Replies</span>
                      </span>
                    </div>

                    {/* Threaded Solution replies list */}
                    {activeReplies.length > 0 && (
                      <div className="mt-4 pl-4 border-l-2 border-gray-200 dark:border-gray-750 space-y-3.5">
                        {activeReplies.map((reply) => {
                          const rAuthorName = userCache[reply.author_id]?.name || "Peer";
                          const isAccepted = reply.is_accepted_solution;

                          return (
                            <div 
                              key={reply.id} 
                              className={`p-3 rounded-lg text-sm leading-relaxed ${
                                isAccepted 
                                  ? 'bg-emerald-500/10 border border-emerald-300' 
                                  : 'bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1.5">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => openUserModal(reply.author_id)}
                                    className="font-bold text-xs text-purple-650 hover:underline"
                                  >
                                    {rAuthorName}
                                  </button>
                                  {user && (reply.author_id === user.uid || thread.author_id === user.uid || profile?.role === "admin" || profile?.role === "expert") && (
                                    <button
                                      onClick={() => handleDeleteReply(reply.id)}
                                      className="text-red-500 hover:text-red-750 text-xs font-bold transition ml-2"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                                
                                {isAccepted ? (
                                  <span className="text-xs font-bold text-emerald-700 flex items-center space-x-1">
                                    <span>🛡️</span>
                                    <span>Accepted Solution</span>
                                  </span>
                                ) : (
                                  user && user.uid === thread.author_id && thread.post_type === "query" && !isSolved && (
                                    <button
                                      onClick={() => handleAcceptSolution(thread.id, reply.id)}
                                      className="text-xs bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 px-2.5 py-1 rounded hover:bg-emerald-100"
                                    >
                                      ✓ Accept Solution
                                    </button>
                                  )
                                )}
                              </div>
                              <p className="text-gray-700 dark:text-gray-305 font-medium">{reply.body}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Compose Reply Form */}
                    {user && (
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-750/30 flex gap-2">
                        <input
                          type="text"
                          placeholder="Type your solution reply here..."
                          value={replyInputMap[thread.id] || ""}
                          onChange={(e) => setReplyInputMap(prev => ({ ...prev, [thread.id]: e.target.value }))}
                          className={inputClass}
                        />
                        <button
                          onClick={() => handleReplySubmit(thread.id)}
                          className={btnClass}
                        >
                          Submit
                        </button>
                      </div>
                    )}

                  </div>
                );
              })
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-500 shadow-sm">
                <p className="text-sm font-medium">No forum posts currently listed.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Sidebar embed block */}
        <div>
          {showEmbedFallback ? (
            <div className={`p-6 ${containerClass}`}>
              <h3 className="font-bold text-xs uppercase tracking-wider mb-2">Community Feed</h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                To prevent layout errors caused by browser tracking protections or ad-blockers, we've constructed this direct fallback card.
              </p>
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                className="w-full inline-block text-center bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 rounded-lg text-xs transition"
              >
                Follow MemeClassroom Hub on X ↗
              </a>
            </div>
          ) : (
            <div id="twitter-widget-holder" className="w-full h-80 bg-gray-200 animate-pulse rounded-xl">
              {/* Twitter widgets would inject here */}
            </div>
          )}
        </div>

      </div>

      {/* 4. COMPOSE THREAD MODAL */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-xl overflow-y-auto max-h-[90vh] ${containerClass}`}>
            <h2 className="text-lg font-bold mb-2">Compose Thread</h2>
            <p className="text-xs text-gray-500 mb-6">
              Share details of a classroom experience outcome, or ask peers a question.
            </p>

            {composeError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-650 rounded text-xs">
                {composeError}
              </div>
            )}

            <form onSubmit={handleThreadSubmit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-gray-500 uppercase mb-1">Thread Format</label>
                <select
                  value={composeType}
                  onChange={(e) => setComposeType(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                >
                  <option value="story">Experience / Story</option>
                  <option value="query">Doubt / Query</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">Description (Min 50 characters)</label>
                <textarea
                  placeholder="Describe your story or query in detail (minimum 50 characters required)..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows="4"
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  required
                />
                <p className="text-[10px] text-gray-400 mt-1">Current length: {composeBody.length} characters</p>
              </div>

              {composeType === "story" && (
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Outcome Tag</label>
                  <select
                    value={composeOutcome}
                    onChange={(e) => setComposeOutcome(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    <option value="worked">Worked (pedagogical success)</option>
                    <option value="tweak">Tweak (requires revisions)</option>
                    <option value="miss">Miss (unsuccessful loop)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Linked Meme (Optional)</label>
                  <select
                    value={linkedMemeId}
                    onChange={(e) => setLinkedMemeId(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    <option value="">No linked meme</option>
                    {availableMemes.map(m => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Attach File (Optional)</label>
                  <input
                    type="file"
                    onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || "")}
                    className="block w-full text-[10px]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-755 px-4 py-2 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={composeLoading}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-750"
                >
                  {composeLoading ? "Publishing..." : "Submit Thread"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                      const isCommentAuthor = user && (comment.user_id === user.uid || profile?.role === "admin" || profile?.role === "expert");
                      return (
                        <div key={comment.id} className="border-b border-gray-200 dark:border-gray-800 pb-3 last:border-b-0 text-xs text-left">
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
                <form onSubmit={handleExpertCommentSubmit} className="space-y-3 border-t pt-4 text-left">
                  <span className="block text-xs font-semibold text-purple-750 uppercase">🛡️ Add Verification Review</span>
                  <textarea
                    placeholder="Write a verification review or academic comment on content validity..."
                    value={newExpertComment}
                    onChange={(e) => setNewExpertComment(e.target.value)}
                    rows="3"
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs rounded text-gray-850"
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

      <style>{`
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

    </div>
  );
};

export default Staffroom;
