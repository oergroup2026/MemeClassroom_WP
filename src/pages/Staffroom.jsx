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
import { SUBJECTS, GRADE_GROUPS } from "../constants/taxonomy";

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
  const [composeType, setComposeType] = useState("story"); // "story" | "query" | "poll"
  const [composeBody, setComposeBody] = useState("");
  const [composeOutcome, setComposeOutcome] = useState("worked");
  const [linkedMemeId, setLinkedMemeId] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [composeSubject, setComposeSubject] = useState("Biology");
  const [composeGradeGroup, setComposeGradeGroup] = useState("Middle School (6–8)");
  const [composerTab, setComposerTab] = useState("write"); // "write" | "preview"
  const [pollOptions, setPollOptions] = useState(["", "", "", ""]);
  const [composeIsAnnouncement, setComposeIsAnnouncement] = useState(false); // Admin announcement posting right

  // User Stats & Badges (for Left Sidebar card)
  const [userStats, setUserStats] = useState({
    memes_created_count: 0,
    resources_contributed_count: 0,
    staffroom_posts_count: 0,
    ratings_provided_count: 0,
    total_likes_received: 0
  });
  const [userBadges, setUserBadges] = useState([]);

  // Search & Categories Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState(""); // Hashtag topic filter

  // Community Moderation (Flag/Report)
  const [flaggedByUser, setFlaggedByUser] = useState({});
  const [showFlagPopup, setShowFlagPopup] = useState(false);

  // Reply Compose state map (threadId -> text)
  const [replyInputMap, setReplyInputMap] = useState({});

  // Active modal tabs filters
  const [activeFilter, setActiveFilter] = useState("all"); // "all" | "story" | "query" | "poll"

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

  // 1.5. Fetch current user stats & badges for Left Profile card
  useEffect(() => {
    if (!user) return;
    const statsDocRef = doc(db, "user_stats", user.uid);
    const unsubStats = onSnapshot(statsDocRef, (snap) => {
      if (snap.exists()) {
        setUserStats(snap.data());
      }
    });

    const badgesCol = collection(db, "badges");
    const bQuery = query(badgesCol, where("user_id", "==", user.uid));
    const unsubBadges = onSnapshot(bQuery, (snap) => {
      const list = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setUserBadges(list);
    });

    return () => {
      unsubStats();
      unsubBadges();
    };
  }, [user]);

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
                is_verified: userData.is_verified || false,
                avatar_url: userData.avatar_url || ""
              };
            } else {
              newCacheUpdates[userId] = { name: "Unknown User", role: "student", is_verified: false, avatar_url: "" };
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



  // Community Moderation (Flag content) — No auto-hide, admin decides via flags collection
  const handleFlagContent = async (contentId, contentType = "meme") => {
    if (!user) { alert("Please sign in to report content."); return; }
    if (flaggedByUser[contentId]) { alert("You have already reported this content."); return; }
    try {
      // Check in Firestore if user already flagged
      const flagsRef = collection(db, "flags");
      const q = query(
        flagsRef,
        where("reporter_id", "==", user.uid),
        where("content_id", "==", contentId)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setFlaggedByUser((prev) => ({ ...prev, [contentId]: true }));
        alert("You have already reported this content.");
        return;
      }

      // Write flag record
      await addDoc(collection(db, "flags"), {
        reporter_id: user.uid,
        content_type: contentType,
        content_id: contentId,
        reason: "Inappropriate Content / Report",
        status: "pending",
        created_at: serverTimestamp()
      });

      // Increment flag_count on the meme — do NOT auto-hide
      if (contentType === "meme") {
        const memeDocRef = doc(db, "memes", contentId);
        await updateDoc(memeDocRef, { flag_count: increment(1) });
      } else if (contentType === "post") {
        const postDocRef = doc(db, "staffroom_posts", contentId);
        await updateDoc(postDocRef, { flag_count: increment(1) });
      }

      setFlaggedByUser((prev) => ({ ...prev, [contentId]: true }));
      setShowFlagPopup(true);
    } catch (e) {
      console.error("Flag content failed", e);
      alert("Failed to submit report. Please try again.");
    }
  };

  const handleThreadSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setComposeError("");

    if (composeBody.trim().length < 50) {
      setComposeError("Thread body text must be at least 50 characters long.");
      return;
    }

    if (composeType === "poll") {
      const cleanOptions = pollOptions.map(o => o.trim()).filter(Boolean);
      if (cleanOptions.length < 2) {
        setComposeError("A poll must contain at least 2 non-empty options.");
        return;
      }
    }

    setComposeLoading(true);

    try {
      const postsColRef = collection(db, "staffroom_posts");
      const statsDocRef = doc(db, "user_stats", user.uid);

      // Save post and increment statistics atomically via Firestore Transaction
      await runTransaction(db, async (transaction) => {
        const newPostRef = doc(postsColRef);
        
        const cleanOptions = pollOptions.map(o => o.trim()).filter(Boolean);
        const votesMap = {};
        cleanOptions.forEach((_, index) => {
          votesMap[index] = 0;
        });

        transaction.set(newPostRef, {
          author_id: user.uid,
          post_type: composeType,
          body: composeBody,
          outcome_tag: "",
          meme_id: linkedMemeId,
          attachment_name: attachmentName || "",
          likes: 0,
          liked_by: [],
          is_solved: false,
          solved_reply_id: "",
          subject: composeSubject,
          grade_group: composeGradeGroup,
          is_announcement: profile?.role === "admin" && composeIsAnnouncement,
          // Poll options fields
          poll_options: composeType === "poll" ? cleanOptions : [],
          poll_votes: composeType === "poll" ? votesMap : {},
          poll_voted_users: [],
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
      setPollOptions(["", "", "", ""]);
      setComposerTab("write");
      setComposeIsAnnouncement(false);
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

  // --- Phase 2E/Staffroom Upgrades: Markdown & Poll Helpers ---
  const handleVoteSubmit = async (threadId, optionIdx) => {
    if (!user) {
      alert("Please log in to vote.");
      return;
    }
    const threadRef = doc(db, "staffroom_posts", threadId);
    try {
      await runTransaction(db, async (transaction) => {
        const threadSnap = await transaction.get(threadRef);
        if (!threadSnap.exists()) return;
        const threadData = threadSnap.data();
        const votedUsers = threadData.poll_voted_users || [];
        if (votedUsers.includes(user.uid)) {
          alert("You have already voted on this poll.");
          return;
        }
        
        const currentVotes = threadData.poll_votes || {};
        const newVotesCount = (currentVotes[optionIdx] || 0) + 1;
        
        transaction.update(threadRef, {
          poll_voted_users: arrayUnion(user.uid),
          [`poll_votes.${optionIdx}`]: newVotesCount
        });
      });
    } catch (e) {
      console.error("Voting failed", e);
    }
  };

  const renderPoll = (thread) => {
    const options = thread.poll_options || [];
    const votes = thread.poll_votes || {};
    const votedUsers = thread.poll_voted_users || [];
    const totalVotes = Object.values(votes).reduce((sum, v) => sum + (v || 0), 0);
    const hasVoted = user && votedUsers.includes(user.uid);

    return (
      <div className="mt-3 space-y-3 bg-gray-50/50 dark:bg-zinc-950 p-4 rounded-xl border border-gray-150 dark:border-zinc-800">
        <span className="block text-[10px] font-extrabold uppercase tracking-wide text-purple-655 dark:text-purple-400 mb-1">
          📊 Classroom Poll ({totalVotes} total {totalVotes === 1 ? 'vote' : 'votes'})
        </span>
        <div className="space-y-2.5 text-left">
          {options.map((option, idx) => {
            const count = votes[idx] || 0;
            const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            
            if (user && !hasVoted) {
              return (
                <button
                  key={idx}
                  onClick={() => handleVoteSubmit(thread.id, idx)}
                  className="w-full text-left text-xs font-semibold px-4 py-2.5 rounded-lg border border-gray-205 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-purple-600 dark:hover:border-purple-500 transition duration-150 flex items-center justify-between"
                >
                  <span>{option}</span>
                  <span className="text-gray-400">🗳️</span>
                </button>
              );
            } else {
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
                    <span>{option}</span>
                    <span>{percent}% ({count})</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-600 h-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            }
          })}
        </div>
        {!user && (
          <span className="block text-[10px] text-gray-400 text-center italic mt-2">
            Please log in to cast your vote.
          </span>
        )}
      </div>
    );
  };

  const renderMarkdown = (text = "") => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const content = line.trim();
      
      // Headers
      if (content.startsWith("# ")) {
        return <h1 key={idx} className="text-lg font-black mt-2 mb-1">{content.slice(2)}</h1>;
      }
      if (content.startsWith("## ")) {
        return <h2 key={idx} className="text-base font-extrabold mt-2 mb-1">{content.slice(3)}</h2>;
      }
      if (content.startsWith("### ")) {
        return <h3 key={idx} className="text-sm font-bold mt-1.5 mb-1">{content.slice(4)}</h3>;
      }
      
      // Bullet list items
      if (content.startsWith("- ") || content.startsWith("* ")) {
        return (
          <li key={idx} className="list-disc list-inside ml-2 my-0.5 text-xs text-left">
            {parseMarkdownInline(content.slice(2))}
          </li>
        );
      }
      
      // Empty line
      if (!content.trim()) {
        return <div key={idx} className="h-2" />;
      }
      
      return <p key={idx} className="my-1 text-xs leading-relaxed text-left">{parseMarkdownInline(content)}</p>;
    });
  };

  const parseMarkdownInline = (text = "") => {
    return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-extrabold text-purple-650 dark:text-purple-400">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={i} className="italic text-gray-600 dark:text-gray-300">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="bg-gray-150 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-[10px]">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  // Dynamic trending topics extracted directly from active thread body descriptions
  const trendingTopics = React.useMemo(() => {
    const counts = {};
    threads.forEach(t => {
      if (!t.body) return;
      const tags = t.body.match(/#\w+/g);
      if (tags) {
        // De-duplicate tags per post
        const uniqueTags = [...new Set(tags.map(tag => tag.toLowerCase()))];
        uniqueTags.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });
    // Sort topics by post count descending
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // top 8 topics
  }, [threads]);

  // Filter threads dynamically by Tab, Search, Subject, Grade Group, and Hashtag Topic
  const filteredThreads = React.useMemo(() => {
    const list = threads.filter(t => {
      if (activeFilter === "story" && t.post_type !== "story") return false;
      if (activeFilter === "query" && t.post_type !== "query") return false;
      if (activeFilter === "poll" && t.post_type !== "poll") return false;
      
      // Subject filter matching
      if (subjectFilter) {
        const threadSubject = t.subject || "";
        const linkedMeme = availableMemes.find(m => m.id === t.meme_id);
        const memeSubject = linkedMeme?.subject || "";
        if (threadSubject.toLowerCase() !== subjectFilter.toLowerCase() && memeSubject.toLowerCase() !== subjectFilter.toLowerCase()) {
          return false;
        }
      }

      // Grade Group filter matching
      if (gradeFilter) {
        const threadGrade = t.grade_group || "";
        const linkedMeme = availableMemes.find(m => m.id === t.meme_id);
        const memeGrade = linkedMeme?.age_group || "";
        if (threadGrade.toLowerCase() !== gradeFilter.toLowerCase() && memeGrade.toLowerCase() !== gradeFilter.toLowerCase()) {
          return false;
        }
      }

      // Hashtag topic filter matching
      if (topicFilter) {
        if (!t.body?.toLowerCase().includes(topicFilter.toLowerCase())) {
          return false;
        }
      }

      // Keyword search matching
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const bodyMatch = (t.body || "").toLowerCase().includes(q);
        const author = userCache[t.author_id]?.name || "";
        const authorMatch = author.toLowerCase().includes(q);
        const linkedMeme = availableMemes.find(m => m.id === t.meme_id);
        const memeMatch = linkedMeme ? linkedMeme.title.toLowerCase().includes(q) : false;
        if (!bodyMatch && !authorMatch && !memeMatch) return false;
      }

      return true;
    });

    // Priority Sort: Admin Announcements (is_announcement: true) always float to the top
    return [...list].sort((a, b) => {
      const aAnn = a.is_announcement ? 1 : 0;
      const bAnn = b.is_announcement ? 1 : 0;
      if (aAnn !== bAnn) return bAnn - aAnn; // announcements first
      // fall back to time sorting
      return (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0);
    });
  }, [threads, activeFilter, subjectFilter, gradeFilter, topicFilter, searchQuery, userCache, availableMemes]);

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

  const getAvatarImage = (userId) => {
    const author = userCache[userId];
    if (author?.avatar_url) return author.avatar_url;
    const fallbackIdx = (userId ? userId.length % 5 : 0) + 1;
    return `/avatar${fallbackIdx}.png`;
  };

  const btnClass = "bg-purple-600 hover:bg-purple-750 text-white font-semibold text-sm px-4 py-2 rounded-lg transition shadow-sm";

  const inputClass = highContrastMode
    ? "w-full px-3 py-2 border border-zinc-800 bg-zinc-950 rounded-lg text-sm text-white placeholder-gray-500"
    : "w-full px-3 py-2 border border-gray-300 bg-gray-50 rounded-lg text-sm text-gray-850";

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      
      {/* Smart Pruning Warning Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4">
        <div className="text-xs text-amber-800 dark:text-amber-300 font-semibold leading-relaxed">
          ⚠️ **Data Retention Policy Notice**: Attached heavy media files (Images, PDFs, Videos) are pruned after 30 days to limit storage bloat, keeping raw text logs intact.
        </div>
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

      {/* Main LinkedIn-Style Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* LEFT COLUMN: Educator Profile Widget (1 Column) */}
        <div className="lg:col-span-1 space-y-4">
          {user ? (
            <div 
              onClick={() => navigate("/profile")}
              className={`overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 ${containerClass}`}
            >
              {/* Header Gradient cover banner */}
              <div className="h-16 bg-gradient-to-r from-purple-600 to-indigo-650" />
              {/* Avatar position offset */}
              <div className="px-4 pb-4 text-center relative">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                  <img
                    src={profile?.avatar_url || `/avatar${(user.uid.length % 5) + 1}.png`}
                    alt="User Avatar"
                    className="w-16 h-16 rounded-full border-4 border-white dark:border-zinc-900 shadow-md object-cover"
                  />
                </div>
                <div className="pt-8">
                  <h3 className="font-extrabold text-sm text-gray-905 dark:text-white hover:underline leading-tight">
                    {profile?.name || "Educator"}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-semibold mt-1 uppercase tracking-wider">
                    {profile?.role || "Teacher"}
                  </p>
                </div>
                
                {/* Stats list */}
                <div className="mt-4 pt-4 border-t border-gray-150 dark:border-zinc-800 text-left space-y-2.5 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                  <div className="flex justify-between items-center">
                    <span>Contribution Points</span>
                    <span className="text-purple-650 dark:text-purple-400">
                      {(userStats.memes_created_count * 10) + (userStats.staffroom_posts_count * 5) + (userStats.ratings_provided_count * 2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Upvotes Received</span>
                    <span className="text-gray-800 dark:text-gray-200">{userStats.total_likes_received}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Ratings Provided</span>
                    <span className="text-gray-800 dark:text-gray-200">{userStats.ratings_provided_count}</span>
                  </div>
                </div>

                {/* Earned badges rendering */}
                {userBadges.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800 text-left">
                    <span className="block text-[9px] uppercase tracking-wider text-gray-400 font-extrabold mb-2">My Milestones</span>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {userBadges.map(badge => (
                        <span 
                          key={badge.id} 
                          title={badge.badge_name}
                          className="text-[9px] bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 font-extrabold px-2 py-0.5 rounded border border-amber-200 dark:border-amber-850"
                        >
                          🎖️ {badge.badge_name.split(" ")[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={`p-4 text-center space-y-3 ${containerClass}`}>
              <span className="block text-2xl">🏫</span>
              <p className="text-xs text-gray-500 leading-relaxed font-semibold">Join MemeClassroom's professional educator hub to post threads and upvote ideas.</p>
              <button 
                onClick={() => navigate("/auth")}
                className="w-full bg-purple-600 hover:bg-purple-755 text-white font-bold py-2 rounded-lg text-xs transition shadow-sm"
              >
                Sign In / Register
              </button>
            </div>
          )}

          {/* Quick shortcuts widget card */}
          <div className={`p-4 ${containerClass} hidden lg:block`}>
            <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-extrabold mb-3">Quick Navigation</span>
            <div className="space-y-2 text-xs font-bold text-gray-655 dark:text-gray-300">
              <button onClick={() => navigate("/lab")} className="block hover:text-purple-650 transition text-left">🎨 Design workbench</button>
              <button onClick={() => navigate("/library")} className="block hover:text-purple-650 transition text-left">📚 Meme Gallery database</button>
              <button onClick={() => navigate("/resources")} className="block hover:text-purple-650 transition text-left">📖 Lesson Plan Repository</button>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Main post creator and threads timeline (2 Columns) */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Start a Post Compose Header (LinkedIn-style composer box) */}
          {user && (
            <div className={`p-4 ${containerClass}`}>
              <div className="flex items-center gap-3">
                <img
                  src={profile?.avatar_url || `/avatar${(user.uid.length % 5) + 1}.png`}
                  alt="My Avatar"
                  className="w-9 h-9 rounded-full border shadow-sm object-cover cursor-pointer hover:opacity-90 animate-fade-in"
                  onClick={() => navigate("/profile")}
                />
                <button
                  onClick={() => { setComposeType("story"); setShowComposeModal(true); }}
                  className="flex-grow text-left text-xs bg-slate-50 hover:bg-slate-100 dark:bg-zinc-950 dark:hover:bg-zinc-805 text-gray-500 font-semibold px-4 py-2.5 rounded-full border border-gray-200 dark:border-zinc-800 transition duration-155"
                >
                  Share an experience, doubt, or poll... (Markdown enabled)
                </button>
              </div>
              <div className="flex justify-around items-center border-t border-gray-100 dark:border-zinc-800 mt-3 pt-2 text-[10px] font-bold text-gray-550 dark:text-gray-400">
                <button
                  onClick={() => { setComposeType("story"); setShowComposeModal(true); }}
                  className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-850 px-3 py-1.5 rounded-lg transition"
                >
                  <span className="text-sm">📝</span>
                  <span>Write Story</span>
                </button>
                <button
                  onClick={() => { setComposeType("query"); setShowComposeModal(true); }}
                  className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-850 px-3 py-1.5 rounded-lg transition"
                >
                  <span className="text-sm">❓</span>
                  <span>Ask Doubt</span>
                </button>
                <button
                  onClick={() => { setComposeType("poll"); setShowComposeModal(true); }}
                  className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-850 px-3 py-1.5 rounded-lg transition"
                >
                  <span className="text-sm">📊</span>
                  <span>Create Poll</span>
                </button>
              </div>
            </div>
          )}

          {/* Timeline filter toggles + Search & Category Filters */}
          <div className={`p-4 space-y-3.5 ${containerClass}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "all", label: "All Feed" },
                  { id: "story", label: "Stories" },
                  { id: "query", label: "Queries" },
                  { id: "poll", label: "Polls" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveFilter(tab.id); setTopicFilter(""); }}
                    className={`text-xs font-bold border-b-2 pb-1 transition ${
                      activeFilter === tab.id
                        ? "border-purple-650 text-purple-650 dark:text-purple-400"
                        : "border-transparent text-gray-400 hover:text-gray-500"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {/* Reset active hashtag topic filter label */}
              {topicFilter && (
                <div className="flex items-center gap-1 bg-purple-50 text-purple-750 dark:bg-purple-955/20 dark:text-purple-305 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-purple-200">
                  <span>Topic: {topicFilter}</span>
                  <button onClick={() => setTopicFilter("")} className="hover:text-red-500 font-bold ml-1">✕</button>
                </div>
              )}
            </div>

            {/* Dynamic keyword Search and Category select drop-downs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
              <input
                type="text"
                placeholder="Search threads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  highContrastMode
                    ? "bg-zinc-955 border-zinc-800 text-white placeholder-zinc-600"
                    : "bg-white border-gray-250 text-gray-800 placeholder-gray-400"
                }`}
              />
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className={`px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  highContrastMode ? "bg-zinc-955 border-zinc-800 text-white" : "bg-white border-gray-250 text-gray-805"
                }`}
              >
                <option value="">All Subjects</option>
                {SUBJECTS.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className={`px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  highContrastMode ? "bg-zinc-955 border-zinc-800 text-white" : "bg-white border-gray-250 text-gray-805"
                }`}
              >
                <option value="">All Grades</option>
                {GRADE_GROUPS.map(gr => (
                  <option key={gr} value={gr}>{gr}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Timeline feed cards list */}
          <div className="space-y-4">
            {filteredThreads.length > 0 ? (
              filteredThreads.map((thread) => {
                const authorName = userCache[thread.author_id]?.name || "Teacher";
                const isSolved = thread.is_solved;
                const activeReplies = replies[thread.id] || [];
                const linkedMeme = availableMemes.find(m => m.id === thread.meme_id);
                const isAnnouncement = thread.is_announcement;

                return (
                  <div 
                    key={thread.id} 
                    className={`p-5 transition rounded-xl border ${
                      isAnnouncement
                        ? (highContrastMode ? "border-amber-600 bg-amber-955/20 text-white shadow-sm" : "border-amber-400 bg-amber-50/20 shadow-sm")
                        : isSolved 
                          ? (highContrastMode ? "border-emerald-600 bg-emerald-955/20 text-white shadow-sm" : "border-emerald-450 bg-emerald-50/10 shadow-sm") 
                          : (highContrastMode ? "bg-zinc-900 border-zinc-800 text-white shadow-sm" : "bg-white border-gray-150 shadow-sm")
                    }`}
                  >
                    
                    {/* Header tags */}
                    <div className="flex flex-wrap gap-2 justify-between items-center mb-4 border-b border-gray-50 dark:border-zinc-800/40 pb-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isAnnouncement && (
                          <span className="bg-amber-100 text-amber-850 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-extrabold px-2.5 py-1 rounded border border-amber-300 flex items-center gap-1 uppercase tracking-wide">
                            📢 Official Announcement
                          </span>
                        )}
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded tracking-wide ${
                          thread.post_type === "query" 
                            ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-955/30 dark:text-rose-300 dark:border-rose-800" 
                            : thread.post_type === "poll"
                              ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-955/30 dark:text-purple-305 dark:border-purple-800"
                              : "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-955/30 dark:text-teal-303 dark:border-teal-800"
                        }`}>
                          {thread.post_type === "query" ? "Doubt / Query" : thread.post_type === "poll" ? "Community Poll" : "Experience Story"}
                        </span>
                        
                        {isSolved && (
                          <span className="bg-emerald-100 text-emerald-808 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-250 flex items-center gap-1">
                            <span>✓</span>
                            <span>Solved</span>
                          </span>
                        )}

                        {/* Thread Subject/Grade categorization tags */}
                        {thread.subject && (
                          <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-955/30 dark:text-indigo-305 text-[10px] px-2 py-0.5 rounded font-bold border border-indigo-150">
                            {thread.subject}
                          </span>
                        )}
                        {thread.grade_group && (
                          <span className="bg-amber-50 text-amber-705 dark:bg-amber-955/30 dark:text-amber-305 text-[10px] px-2 py-0.5 rounded font-bold border border-amber-150">
                            {thread.grade_group}
                          </span>
                        )}
                      </div>
 
                      {/* Clickable Contributor gateway link & Reputation Role Badge */}
                      <div className="flex items-center space-x-2.5">
                        <div className="flex items-center gap-2">
                          <img
                            src={getAvatarImage(thread.author_id)}
                            alt="Author Avatar"
                            onClick={() => openUserModal(thread.author_id)}
                            className="w-7 h-7 rounded-full border shadow-sm object-cover cursor-pointer hover:opacity-90"
                          />
                          <div className="text-left">
                            <button
                              onClick={() => openUserModal(thread.author_id)}
                              className="text-xs text-purple-755 font-black hover:underline block leading-tight"
                            >
                              {authorName}
                            </button>
                            {(() => {
                              const author = userCache[thread.author_id];
                              if (!author) return null;
                              let badgeClass = "bg-gray-150 text-gray-700 dark:bg-zinc-850 dark:text-gray-300";
                              if (author.role === "admin") badgeClass = "bg-rose-100 text-rose-700 dark:bg-rose-955/50 dark:text-rose-300";
                              else if (author.role === "expert") badgeClass = "bg-indigo-100 text-indigo-700 dark:bg-indigo-955/50 dark:text-indigo-300";
                              else if (author.role === "teacher") badgeClass = "bg-purple-100 text-purple-700 dark:bg-purple-955/50 dark:text-purple-305";
                              return (
                                <span className={`text-[8px] font-extrabold px-1 py-0.2 rounded tracking-wider uppercase ${badgeClass} inline-block mt-0.5`}>
                                  {author.role || "MEMBER"} {author.is_verified ? "🛡️" : ""}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
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
 
                    {/* Text Body parsed as Markdown */}
                    <div className="prose prose-sm dark:prose-invert max-w-none mb-4 text-left leading-relaxed text-gray-800 dark:text-gray-150 font-medium">
                      {renderMarkdown(thread.body)}
                    </div>

                    {/* Interactive Poll Area */}
                    {thread.post_type === "poll" && renderPoll(thread)}
 
                    {/* Linked Meme Preview Box */}
                    {linkedMeme && (
                      <div 
                        onClick={() => setActiveMeme(linkedMeme)}
                        title="Click to view details, ratings and reviews"
                        className="my-4 border border-gray-150 dark:border-zinc-850 rounded-xl overflow-hidden bg-gray-50 dark:bg-zinc-950 flex flex-col sm:flex-row items-center p-3 gap-4 cursor-pointer hover:shadow-md hover:ring-2 hover:ring-purple-500/20 transition duration-200"
                      >
                        <div 
                          className="w-full sm:w-32 aspect-[4/3] relative flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg border border-gray-100 dark:border-zinc-800 overflow-hidden flex-shrink-0"
                          onClick={(e) => {
                            if (linkedMeme.format === "video" || linkedMeme.format === "audio") {
                              e.stopPropagation();
                            }
                          }}
                        >
                          {linkedMeme.format === "image" && (
                            <img src={linkedMeme.media_url} alt={linkedMeme.title} className="max-w-full max-h-full object-contain" />
                          )}
                          {linkedMeme.format === "gif" && (
                            <img src={linkedMeme.media_url} alt={linkedMeme.title} className="max-w-full max-h-full object-contain" />
                          )}
                          {linkedMeme.format === "video" && (
                            <video 
                              src={linkedMeme.media_url} 
                              className="max-w-full max-h-full object-contain" 
                              controls 
                              onClick={e => e.stopPropagation()}
                            />
                          )}
                          {linkedMeme.format === "audio" && (
                            <div className="flex flex-col items-center justify-center p-2 w-full h-full">
                              <span className="text-xl mb-1">🎵</span>
                              <audio 
                                src={linkedMeme.media_url} 
                                controls 
                                className="w-full max-w-[120px] scale-90"
                                onClick={e => e.stopPropagation()}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex-grow min-w-0 text-left">
                          <span className="text-[10px] uppercase tracking-wider text-purple-655 dark:text-purple-400 font-bold block mb-0.5">Linked Meme Reference (Click to view details)</span>
                          <h4 className="font-extrabold text-sm text-gray-905 dark:text-white truncate">{linkedMeme.title}</h4>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="bg-indigo-50 dark:bg-indigo-955/20 text-indigo-750 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              {linkedMeme.subject}
                            </span>
                            <span className="bg-teal-50 dark:bg-teal-955/20 text-teal-750 dark:text-teal-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              {linkedMeme.age_group}
                            </span>
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-605 dark:text-gray-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
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

                    {/* Likes, replies & Report actions panel */}
                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 pt-3 text-xs mt-3">
                      <div className="flex items-center space-x-4">
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
                          <span>💬</span>
                          <span>{activeReplies.length} Replies</span>
                        </span>
                      </div>
                      
                      {/* Report/Flag Thread Button */}
                      <button
                        onClick={() => handleFlagContent(thread.id, "post")}
                        className={`text-xs flex items-center gap-1 transition ${
                          flaggedByUser[thread.id] ? "text-red-500 font-bold" : "text-gray-400 hover:text-red-500"
                        }`}
                        title="Report Inappropriate Discussion Thread"
                      >
                        <span>🏳️</span>
                        <span>{flaggedByUser[thread.id] ? "Reported" : "Report"}</span>
                      </button>
                    </div>

                    {/* Threaded Solution replies list */}
                    {activeReplies.length > 0 && (
                      <div className="mt-4 pl-4 border-l border-gray-200 dark:border-gray-750 space-y-3.5">
                        {activeReplies.map((reply) => {
                          const rAuthorName = userCache[reply.author_id]?.name || "Peer";
                          const isAccepted = reply.is_accepted_solution;

                          return (
                            <div 
                              key={reply.id} 
                              className={`p-3 rounded-lg text-xs leading-relaxed ${
                                isAccepted 
                                  ? 'bg-emerald-500/10 border border-emerald-300' 
                                  : 'bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-805'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1.5">
                                <div className="flex items-center gap-2">
                                  <img
                                    src={getAvatarImage(reply.author_id)}
                                    alt="Commenter Avatar"
                                    onClick={() => openUserModal(reply.author_id)}
                                    className="w-5 h-5 rounded-full object-cover shadow-sm cursor-pointer"
                                  />
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
                              <p className="text-gray-700 dark:text-gray-305 font-semibold text-left">{reply.body}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Compose Reply Form */}
                    {user && (
                      <div className="mt-4 pt-3 border-t border-gray-150 dark:border-gray-800/40 flex gap-2">
                        <input
                          type="text"
                          placeholder="Write a peer response..."
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
              <div className="bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center text-gray-550 shadow-sm">
                <p className="text-sm font-semibold mb-1">No timeline threads match these filters.</p>
                <p className="text-xs text-gray-400">Try broadening your subject, grade, or query keywords.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Trending tags/topics and fallback widgets (1 Column) */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* Dynamic Trending Topics Box (extracted keywords) */}
          <div className={`p-4 ${containerClass}`}>
            <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-extrabold mb-3"># Trending Topics</span>
            {trendingTopics.length > 0 ? (
              <div className="space-y-2 text-left">
                {trendingTopics.map(topic => (
                  <button
                    key={topic.name}
                    onClick={() => setTopicFilter(topic.name)}
                    className={`block text-xs font-semibold hover:underline w-full text-left truncate ${
                      topicFilter.toLowerCase() === topic.name.toLowerCase()
                        ? "text-purple-650 font-black"
                        : "text-gray-600 dark:text-gray-300 hover:text-purple-650"
                    }`}
                  >
                    {topic.name} <span className="text-[10px] text-gray-400 font-medium">({topic.count} {topic.count === 1 ? 'post' : 'posts'})</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="block text-xs text-gray-450 italic">No topics tagged in posts yet. Try adding #Hashtags to your descriptions!</span>
            )}
          </div>

          {/* Social Embed Fallback card */}
          {showEmbedFallback ? (
            <div className={`p-4 ${containerClass}`}>
              <h3 className="font-extrabold text-[10px] uppercase tracking-wider mb-2">Community Feed</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-4">
                To prevent layout errors caused by browser tracking protections, we've constructed this direct fallback card.
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
            <div id="twitter-widget-holder" className="w-full h-80 bg-gray-255 animate-pulse rounded-xl">
              {/* Twitter widgets inject here */}
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
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Format</label>
                  <select
                    value={composeType}
                    onChange={(e) => setComposeType(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    <option value="story">Story</option>
                    <option value="query">Query</option>
                    <option value="poll">Poll</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Subject</label>
                  <select
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    {SUBJECTS.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Grades</label>
                  <select
                    value={composeGradeGroup}
                    onChange={(e) => setComposeGradeGroup(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    {GRADE_GROUPS.map(gr => (
                      <option key={gr} value={gr}>{gr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-gray-500 uppercase">Description (Min 50 characters)</label>
                  <div className="flex space-x-1 bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-md">
                    <button
                      type="button"
                      onClick={() => setComposerTab("write")}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${composerTab === "write" ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-gray-500"}`}
                    >
                      Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerTab("preview")}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${composerTab === "preview" ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-gray-500"}`}
                    >
                      Preview
                    </button>
                  </div>
                </div>
                {composerTab === "write" ? (
                  <textarea
                    placeholder="Describe your thread (supports Markdown bold **text**, italic *text*, `code` list items)..."
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    rows="4"
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded resize-y focus:outline-none"
                    required
                  />
                ) : (
                  <div className="w-full min-h-[104px] px-3 py-2 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded overflow-y-auto max-h-44 text-[11px] text-left">
                    {composeBody ? renderMarkdown(composeBody) : <span className="text-gray-400 italic">No text written to preview.</span>}
                  </div>
                )}
                <p className="text-[10px] text-gray-450 mt-1">Length: {composeBody.length} characters</p>
              </div>



              {composeType === "poll" && (
                <div className="space-y-2 border-t pt-3 border-gray-100 dark:border-gray-800">
                  <span className="block text-[10px] text-gray-550 uppercase tracking-wider mb-1">Poll Options (Min 2 required)</span>
                  {pollOptions.map((opt, idx) => (
                    <input
                      key={idx}
                      type="text"
                      placeholder={`Option ${idx + 1}${idx < 2 ? ' (Required)' : ' (Optional)'}`}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...pollOptions];
                        newOpts[idx] = e.target.value;
                        setPollOptions(newOpts);
                      }}
                      className="w-full px-2.5 py-1 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded text-xs"
                      required={idx < 2}
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 border-t pt-3 border-gray-100 dark:border-gray-800">
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Linked Meme Reference</label>
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
                  <label className="block text-gray-500 uppercase mb-1">Attach File (Pruning active)</label>
                  <input
                    type="file"
                    onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || "")}
                    className="block w-full text-[10px] mt-1"
                  />
                </div>
              </div>

              {profile?.role === "admin" && (
                <div className="flex items-center gap-2 border-t pt-3 border-gray-100 dark:border-gray-800">
                  <input
                    type="checkbox"
                    id="adminAnnouncement"
                    checked={composeIsAnnouncement}
                    onChange={(e) => setComposeIsAnnouncement(e.target.checked)}
                    className="w-4 h-4 text-purple-650 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="adminAnnouncement" className="text-amber-800 dark:text-amber-300 font-bold text-xs select-none">
                    📢 Post as Official Announcement (Pin to top of feed)
                  </label>
                </div>
              )}

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
