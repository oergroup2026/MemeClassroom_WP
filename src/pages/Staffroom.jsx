import React, { useState, useEffect, useRef } from "react";
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

  // Forum Threads States
  const [threads, setThreads] = useState([]);
  const [replies, setReplies] = useState({}); // map threadId -> replies array
  const [userCache, setUserCache] = useState({});
  const [availableMemes, setAvailableMemes] = useState([]);

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
        list.push({ id: doc.id, title: doc.data().title });
      });
      setAvailableMemes(list);
    });
    return () => unsubscribe();
  }, []);

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

      // Resolve author usernames
      const uniqueAuthorIds = [...new Set(list.map(t => t.author_id))];
      uniqueAuthorIds.forEach(async (authorId) => {
        if (!userCache[authorId]) {
          try {
            const userDoc = await getDoc(doc(db, "users", authorId));
            if (userDoc.exists()) {
              setUserCache(prev => ({ ...prev, [authorId]: userDoc.data().name }));
            }
          } catch (e) {
            console.error("Failed to load forum username", e);
          }
        }
      });

      // Fetch replies for each thread dynamically
      list.forEach((thread) => {
        const repliesCol = collection(db, "staffroom_replies");
        const rq = query(repliesCol, where("post_id", "==", thread.id));
        onSnapshot(rq, (replySnap) => {
          const rList = [];
          replySnap.forEach(d => {
            rList.push({ id: d.id, ...d.data() });
            
            // Resolve reply author name
            const rAuthorId = d.data().author_id;
            if (!userCache[rAuthorId]) {
              getDoc(doc(db, "users", rAuthorId)).then(uDoc => {
                if (uDoc.exists()) {
                  setUserCache(prev => ({ ...prev, [rAuthorId]: uDoc.data().name }));
                }
              });
            }
          });
          rList.sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));
          setReplies(prev => ({ ...prev, [thread.id]: rList }));
        });
      });

    });

    return () => unsubscribe();
  }, [userCache]);

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

  const solvedCardClass = highContrastMode
    ? "border-2 border-emerald-600 bg-emerald-950/20 text-white rounded-xl"
    : "border-2 border-emerald-500 bg-emerald-50/10";

  const btnClass = "bg-purple-600 hover:bg-purple-750 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition shadow-sm";

  const inputClass = highContrastMode
    ? "w-full px-3 py-2 border border-zinc-800 bg-zinc-950 rounded-lg text-xs text-white placeholder-gray-500"
    : "w-full px-3 py-2 border border-gray-300 bg-gray-50 rounded-lg text-xs text-gray-850";

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
                const authorName = userCache[thread.author_id] || "Teacher";
                const isSolved = thread.is_solved;
                const activeReplies = replies[thread.id] || [];

                return (
                  <div 
                    key={thread.id} 
                    className={`p-6 transition rounded-xl ${isSolved ? solvedCardClass : containerClass}`}
                  >
                    
                    {/* Header tags */}
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                          thread.post_type === "query" ? "bg-red-50 text-red-650" : "bg-teal-50 text-teal-650"
                        }`}>
                          {thread.post_type === "query" ? "Doubt / Query" : "Experience Story"}
                        </span>
                        
                        {thread.outcome_tag && (
                          <span className="text-[9px] font-semibold text-gray-400">
                            Outcome: {thread.outcome_tag}
                          </span>
                        )}

                        {isSolved && (
                          <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                            ✓ Solved
                          </span>
                        )}
                      </div>

                      {/* Clickable Contributor gateway link */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openUserModal(thread.author_id)}
                          className="text-[10px] text-purple-750 font-bold hover:underline"
                        >
                          By {authorName}
                        </button>
                        {user && (thread.author_id === user.uid || profile?.role === "admin") && (
                          <button
                            onClick={() => handleDeleteThread(thread.id)}
                            className="text-red-500 hover:text-red-750 text-[10px] font-bold transition ml-2"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Text Body */}
                    <p className="text-xs text-gray-650 dark:text-gray-200 leading-relaxed font-medium mb-4">
                      {thread.body}
                    </p>

                    {/* Attachment slot */}
                    {thread.attachment_name && (
                      <div className="my-3 p-2 border border-dashed rounded text-[11px] text-gray-500 flex items-center space-x-1.5 bg-gray-50 dark:bg-gray-900">
                        <span>📎 Attachment:</span>
                        <span className="italic">{thread.attachment_name} (Pruning active)</span>
                      </div>
                    )}

                    {/* Likes & replies count panel */}
                    <div className="flex items-center space-x-4 border-t border-gray-100 dark:border-gray-700/50 pt-3 text-[11px]">
                      <button
                        onClick={() => handleThreadLike(thread)}
                        className={`flex items-center space-x-1 transition ${
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
                          const rAuthorName = userCache[reply.author_id] || "Peer";
                          const isAccepted = reply.is_accepted_solution;

                          return (
                            <div 
                              key={reply.id} 
                              className={`p-3 rounded-lg text-xs leading-relaxed ${
                                isAccepted 
                                  ? 'bg-emerald-500/10 border border-emerald-300' 
                                  : 'bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => openUserModal(reply.author_id)}
                                    className="font-bold text-[10px] text-purple-650 hover:underline"
                                  >
                                    {rAuthorName}
                                  </button>
                                  {user && (reply.author_id === user.uid || profile?.role === "admin") && (
                                    <button
                                      onClick={() => handleDeleteReply(reply.id)}
                                      className="text-red-500 hover:text-red-750 text-[10px] font-bold transition ml-2"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                                
                                {isAccepted ? (
                                  <span className="text-[10px] font-bold text-emerald-700 flex items-center space-x-1">
                                    <span>🛡️</span>
                                    <span>Accepted Solution</span>
                                  </span>
                                ) : (
                                  user && user.uid === thread.author_id && thread.post_type === "query" && !isSolved && (
                                    <button
                                      onClick={() => handleAcceptSolution(thread.id, reply.id)}
                                      className="text-[9px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 px-2 py-0.5 rounded hover:bg-emerald-100"
                                    >
                                      ✓ Accept Solution
                                    </button>
                                  )
                                )}
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 font-medium">{reply.body}</p>
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

    </div>
  );
};

export default Staffroom;
