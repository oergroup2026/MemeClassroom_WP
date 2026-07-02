import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
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

// Initial Mock Featured Resources list for the Hero Slider
const MOCK_FEATURED = [
  {
    id: "feat-1",
    title: "Humor-Based Cognition: Visual Memory Triggers in STEM",
    body: "This literature analysis reviews how visual humor constructs cognitive neural shortcuts, dramatically improving recall of complex physics formulas among middle school students.",
    type: "research_paper",
    subject: "Physics",
    grade_group: "13-15",
    author_id: "admin"
  },
  {
    id: "feat-2",
    title: "Classroom Activity: Mitosis Dance Battle Meme Sheets",
    body: "An active learning lesson plan where students construct memes depicting cell division phases, followed by peer-to-peer voting criteria matrices.",
    type: "activity",
    subject: "Biology",
    grade_group: "10-12",
    author_id: "admin"
  }
];

const Resources = () => {
  const { user, profile } = useAuth();
  const { highContrastMode } = useUdl();
  const { openUserModal } = useUserModal();

  // Tab: "all" | "article_paper" | "activity" | "course" | "stories" | "other"
  const [activeTab, setActiveTab] = useState("all");
  const [resources, setResources] = useState([]);
  const [filteredResources, setFilteredResources] = useState([]);
  const [userCache, setUserCache] = useState({});

  // Hero Featured Slider States
  const [featuredIndex, setFeaturedIndex] = useState(0);

  // Filters State
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");

  // Saved/Bookmarks Map
  const [savedResourcesMap, setSavedResourcesMap] = useState({});

  // Upload Resource Modal States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadBody, setUploadBody] = useState("");
  const [uploadType, setUploadType] = useState("article");
  const [uploadSubject, setUploadSubject] = useState("Biology");
  const [uploadGrade, setUploadGrade] = useState("13-15");
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPublicationYear, setUploadPublicationYear] = useState("");
  const [uploadPublisherName, setUploadPublisherName] = useState("");
  const [uploadThumbnailUrl, setUploadThumbnailUrl] = useState("");
  const [uploadThumbnailFile, setUploadThumbnailFile] = useState(null);
  const [uploadKeywords, setUploadKeywords] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [savedResourceLikesMap, setSavedResourceLikesMap] = useState({});
  const [likePendingMap, setLikePendingMap] = useState({});
  const [featuredResources, setFeaturedResources] = useState(MOCK_FEATURED);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // 1. Cycle Hero Featured Slider every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % (featuredResources.length || 1));
    }, 6000);
    return () => clearInterval(timer);
  }, [featuredResources]);

  // Real-time Resource Likes listener
  useEffect(() => {
    if (!user) return;
    const likesCol = collection(db, "resource_likes");
    const q = query(likesCol, where("user_id", "==", user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        map[data.resource_id] = doc.id;
      });
      setSavedResourceLikesMap(map);
    });

    return () => unsubscribe();
  }, [user]);

  // Dynamic Hero Carousel promoting most liked resources
  useEffect(() => {
    if (resources.length > 0) {
      const sortedByLikes = [...resources]
        .filter(r => (r.likes_count || 0) > 0)
        .sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));

      if (sortedByLikes.length > 0) {
        // Map top liked resources (up to 3) to the carousel shape
        const topLiked = sortedByLikes.slice(0, 3).map(r => ({
          id: r.id,
          title: r.title,
          body: r.body,
          type: r.type,
          subject: r.subject,
          grade_group: r.grade_group,
          author_id: r.author_id
        }));
        setFeaturedResources(topLiked);
      } else {
        setFeaturedResources(MOCK_FEATURED);
      }
    } else {
      setFeaturedResources(MOCK_FEATURED);
    }
  }, [resources]);

  // 2. Real-Time resources listener (only approved ones)
  useEffect(() => {
    const resCol = collection(db, "resources");
    const q = query(resCol, where("status", "==", "approved"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });

      // Sort newest first
      list.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setResources(list);
      setFilteredResources(list);

      // Resolve author usernames
      const uniqueAuthorIds = [...new Set(list.map(r => r.author_id))];
      uniqueAuthorIds.forEach(async (authorId) => {
        if (!userCache[authorId] && authorId !== "admin") {
          try {
            const userDoc = await getDoc(doc(db, "users", authorId));
            if (userDoc.exists()) {
              setUserCache(prev => ({ ...prev, [authorId]: userDoc.data().name }));
            }
          } catch (e) {
            console.error("Username query failed", e);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [userCache]);

  // Real-time Saves listener for Resource Bookmarks
  useEffect(() => {
    if (!user) return;
    const savesCol = collection(db, "saves");
    const q = query(savesCol, where("user_id", "==", user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        map[data.meme_id] = doc.id; // saves collection maps to savesId
      });
      setSavedResourcesMap(map);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Multi-Variable filters & Tab Segmentation & Search
  useEffect(() => {
    let result = resources;

    // Filter by Tab type
    if (activeTab === "article_paper") {
      result = result.filter(r => r.type === "article" || r.type === "research_paper");
    } else if (activeTab !== "all") {
      result = result.filter(r => r.type === activeTab);
    }

    // Filter by Sidebar parameters
    if (subjectFilter) {
      result = result.filter(r => r.subject === subjectFilter);
    }
    if (gradeFilter) {
      result = result.filter(r => r.grade_group === gradeFilter);
    }

    // Filter by search bar query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => {
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchBody = r.body?.toLowerCase().includes(q);
        const matchSubject = r.subject?.toLowerCase().includes(q);
        const matchPublisher = r.publisher_name?.toLowerCase().includes(q);
        const matchType = r.type?.toLowerCase().includes(q);
        const matchKeywords = Array.isArray(r.keywords)
          ? r.keywords.some(k => k.toLowerCase().includes(q))
          : (r.keywords ? String(r.keywords).toLowerCase().includes(q) : false);

        return matchTitle || matchBody || matchSubject || matchPublisher || matchType || matchKeywords;
      });
    }

    setFilteredResources(result);
  }, [activeTab, subjectFilter, gradeFilter, searchQuery, resources]);

  // 4. Bookmark Resource Toggle
  const handleBookmarkToggle = async (resourceId) => {
    if (!user) return;
    const existingBookmarkId = savedResourcesMap[resourceId];

    try {
      if (existingBookmarkId) {
        await deleteDoc(doc(db, "saves", existingBookmarkId));
      } else {
        const saveDocId = `${user.uid}_${resourceId}`;
        await setDoc(doc(db, "saves", saveDocId), {
          user_id: user.uid,
          meme_id: resourceId, // reuse the field name for saves join
          content_type: "resource",
          created_at: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Bookmark toggle failed", e);
    }
  };

  // 5. Flag Content Moderation Override
  const handleFlagResource = async (resourceId) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "flags"), {
        reporter_id: user.uid,
        content_type: "resource",
        content_id: resourceId,
        reason: "Resource flagged",
        status: "pending",
        created_at: serverTimestamp()
      });

      // Switch status visibility parameter to hidden instantly
      const resDocRef = doc(db, "resources", resourceId);
      await updateDoc(resDocRef, {
        status: "hidden_moderation"
      });
    } catch (e) {
      console.error("Flag resource failed", e);
    }
  };

  const handleDeleteResource = async (resId) => {
    if (!window.confirm("Are you sure you want to delete this resource? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "resources", resId));
      if (user) {
        const statsDocRef = doc(db, "user_stats", user.uid);
        await updateDoc(statsDocRef, {
          resources_contributed_count: increment(-1)
        });
      }
      alert("Resource deleted successfully.");
    } catch (e) {
      console.error("Failed to delete resource", e);
      alert("Failed to delete resource. Please try again.");
    }
  };

  const handleResourceLikeToggle = async (resourceId, authorId) => {
    if (!user) return;
    if (likePendingMap[resourceId]) return;
    setLikePendingMap(prev => ({ ...prev, [resourceId]: true }));

    const existingLikeId = savedResourceLikesMap[resourceId];
    const resourceRef = doc(db, "resources", resourceId);
    const statsRef = doc(db, "user_stats", authorId);

    try {
      if (existingLikeId) {
        await deleteDoc(doc(db, "resource_likes", existingLikeId));
        if (authorId !== "admin") {
          await setDoc(statsRef, {
            total_likes_received: increment(-1)
          }, { merge: true });
        }
        await updateDoc(resourceRef, {
          likes_count: increment(-1)
        });
      } else {
        const likeDocId = `${user.uid}_${resourceId}`;
        await setDoc(doc(db, "resource_likes", likeDocId), {
          user_id: user.uid,
          resource_id: resourceId,
          created_at: serverTimestamp()
        });
        if (authorId !== "admin") {
          await setDoc(statsRef, {
            total_likes_received: increment(1)
          }, { merge: true });
        }
        await updateDoc(resourceRef, {
          likes_count: increment(1)
        });
      }
    } catch (e) {
      console.error("Resource like toggle failed", e);
    } finally {
      setLikePendingMap(prev => ({ ...prev, [resourceId]: false }));
    }
  };

  // 6. Submit resource (atomic transaction increment user_stats)
  const handleResourceSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setUploadLoading(true);
    setUploadError("");

    let fileUrl = uploadUrl;
    let thumbnailUrl = uploadThumbnailUrl;

    try {
      // If a file is uploaded, push it to Firebase Storage
      if (uploadFile) {
        const storageRef = ref(storage, `resources/${user.uid}_res_${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, uploadFile);
        fileUrl = await getDownloadURL(snapshot.ref);
      }

      // Upload thumbnail if file is selected
      if (uploadThumbnailFile) {
        const thumbRef = ref(storage, `resources/thumb_${user.uid}_${Date.now()}`);
        const snapshot = await uploadBytes(thumbRef, uploadThumbnailFile);
        thumbnailUrl = await getDownloadURL(snapshot.ref);
      }

      const parsedKeywords = uploadKeywords
        ? uploadKeywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean)
        : [];

      const resColRef = collection(db, "resources");
      const statsDocRef = doc(db, "user_stats", user.uid);
 
      // Perform transaction to write resource and increment stats atomically
      await runTransaction(db, async (transaction) => {
        const newDocRef = doc(resColRef);
        
        const resourceData = {
          title: uploadTitle,
          body: uploadBody,
          type: uploadType,
          subject: uploadSubject,
          grade_group: uploadGrade,
          file_url: fileUrl,
          thumbnail_url: thumbnailUrl,
          keywords: parsedKeywords,
          likes_count: 0,
          author_id: user.uid,
          status: "approved", // Live immediately by default
          created_at: serverTimestamp()
        };

        if (uploadType === "article" || uploadType === "research_paper") {
          resourceData.publication_year = uploadPublicationYear;
          resourceData.publisher_name = uploadPublisherName;
        }

        transaction.set(newDocRef, resourceData);
 
        transaction.update(statsDocRef, {
          resources_contributed_count: increment(1)
        });
      });
 
      setShowUploadModal(false);
      setUploadTitle("");
      setUploadBody("");
      setUploadUrl("");
      setUploadFile(null);
      setUploadPublicationYear("");
      setUploadPublisherName("");
      setUploadThumbnailUrl("");
      setUploadThumbnailFile(null);
      setUploadKeywords("");
    } catch (err) {
      console.error(err);
      setUploadError("Submission failed. Ensure connection is stable.");
    } finally {
      setUploadLoading(false);
    }
  };

  // UDL Styling classes
  const containerClass = highContrastMode 
    ? "bg-zinc-900 border border-zinc-800 text-white shadow-sm rounded-xl" 
    : "bg-white border border-gray-200 shadow-sm rounded-xl";

  const btnClass = "bg-purple-600 hover:bg-purple-750 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition shadow-sm";

  const inputClass = highContrastMode
    ? "w-full px-3 py-2 border border-zinc-800 bg-zinc-950 rounded-lg text-xs text-white placeholder-gray-500"
    : "w-full px-3 py-2 border border-gray-300 bg-gray-50 rounded-lg text-xs text-gray-855";

  const activeFeat = featuredResources[featuredIndex] || MOCK_FEATURED[0];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      
      {/* 1. Page Title Header and Upload trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-850 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Meme Resources (MemeReads)</h1>
          <p className="mt-1 text-sm text-gray-500">
            Access curriculum activities, lesson cards, research papers, and stories.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          {user && (
            <button onClick={() => {
              setUploadTitle("");
              setUploadBody("");
              setUploadUrl("");
              setUploadFile(null);
              setUploadPublicationYear("");
              setUploadPublisherName("");
              setUploadThumbnailUrl("");
              setUploadThumbnailFile(null);
              setUploadKeywords("");
              setShowUploadModal(true);
            }} className={btnClass}>
              ➕ Contribute Resource
            </button>
          )}
        </div>
      </div>

      {/* 2. Hero Featured Slider Carousel */}
      <div className={`p-6 rounded-xl border relative overflow-hidden flex flex-col justify-between min-h-[220px] ${
        highContrastMode ? 'bg-black border-yellow-400 text-yellow-400' : 'bg-gradient-to-r from-purple-900 via-indigo-900 to-indigo-950 text-white border-transparent'
      }`}>
        <div className="absolute top-4 right-4 bg-purple-500/20 text-purple-300 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-purple-500/30">
          Featured Article
        </div>
        
        <div className="max-w-2xl">
          <span className="text-[10px] font-extrabold uppercase bg-purple-600/50 px-2 py-0.5 rounded tracking-wide">
            {activeFeat.subject} • Ages {activeFeat.grade_group}
          </span>
          <h2 className="text-2xl font-extrabold mt-3 leading-tight tracking-tight">
            {activeFeat.title}
          </h2>
          <p className="text-sm mt-2 opacity-85 line-clamp-2 leading-relaxed">
            {activeFeat.body}
          </p>
        </div>

        <div className="flex space-x-1.5 pt-6">
          {featuredResources.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setFeaturedIndex(idx)}
              className={`h-1.5 rounded-full transition-all ${
                featuredIndex === idx ? 'w-6 bg-purple-500' : 'w-2 bg-gray-400/50'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 3. Category segmented tabs filter bar */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        {[
          { id: "all", label: "All Items" },
          { id: "article_paper", label: "Articles & Research Papers" },
          { id: "activity", label: "Classroom Activities" },
          { id: "course", label: "Lesson Courses" },
          { id: "stories", label: "Meme Stories" },
          { id: "other", label: "Other Tools" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === tab.id
                ? "bg-purple-600 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-850"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar Input */}
      <div className={`p-4 ${containerClass} flex items-center justify-between space-x-3`}>
        <div className="relative flex-grow">
          <span className="absolute left-3.5 top-2.5 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search resources by title, description, keywords, subject, or publisher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${inputClass} pl-10 h-10 w-full rounded-xl`}
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="text-xs font-bold text-red-655 hover:underline px-2"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left 1 Column: Filters Sidebar */}
        <div className={`p-6 h-fit ${containerClass}`}>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-4 border-b pb-2">Search Filters</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Subject</label>
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
              <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Grade Group</label>
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
          </div>
        </div>

        {/* Right 3 Columns: Resources Card List */}
        <div className="lg:col-span-3">
          {filteredResources.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredResources.map((res) => {
                const isBookmarked = !!savedResourcesMap[res.id];
                const isLiked = !!savedResourceLikesMap[res.id];
                const authorName = res.author_id === "admin" ? "Admin" : (userCache[res.author_id] || "Contributor");
 
                return (
                  <div key={res.id} className={`p-5 flex flex-col justify-between h-full ${containerClass}`}>
                    <div>
                      {/* Contributor profile details similar to Library card layout */}
                      <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-zinc-800 pb-3">
                        <div className="flex items-center min-w-0">
                          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-750 dark:text-purple-300 font-black text-xs mr-2.5 shadow-sm flex-shrink-0">
                            {authorName ? authorName.charAt(0).toUpperCase() : "C"}
                          </div>
                          <div className="flex-grow min-w-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); if (res.author_id !== "admin") openUserModal(res.author_id); }}
                              className="text-xs font-bold text-gray-900 dark:text-white hover:text-purple-650 dark:hover:text-purple-400 transition text-left block leading-tight truncate"
                            >
                              {authorName}
                            </button>
                            <span className="text-[9px] text-gray-400 block leading-tight mt-0.5">
                              Contributor
                            </span>
                          </div>
                        </div>
                        <span className="bg-purple-55 dark:bg-purple-950/20 text-purple-750 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ml-2">
                          {res.type.replace("_", " ")}
                        </span>
                      </div>
 
                      {/* Thumbnail Banner */}
                      {res.thumbnail_url && (
                        <div className="w-full aspect-[16/9] mb-3 rounded-lg overflow-hidden border border-gray-155 dark:border-zinc-800 bg-gray-50 flex items-center justify-center">
                          <img src={res.thumbnail_url} alt={res.title} className="w-full h-full object-cover" />
                        </div>
                      )}
 
                      <h3 className="font-extrabold text-sm mb-2">{res.title}</h3>
                      <p className="text-xs text-gray-500 mb-4 line-clamp-3 leading-relaxed">{res.body}</p>

                      {/* Keywords tags display */}
                      {res.keywords && res.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {res.keywords.map((k) => (
                            <span
                              key={k}
                              className="bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 text-[9px] px-1.5 py-0.5 rounded"
                            >
                              #{k}
                            </span>
                          ))}
                        </div>
                      )}
 
                      {/* Conditionally display Year of Publication & Publisher details for Article / Research Paper */}
                      {(res.type === "article" || res.type === "research_paper") && (res.publication_year || res.publisher_name) && (
                        <div className="mb-4 p-2 bg-purple-50/50 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900/50 rounded-lg text-[10px] text-purple-900 dark:text-purple-300 flex items-center space-x-1.5">
                          <span>📖</span>
                          <span className="font-semibold">
                            {res.publisher_name && `${res.publisher_name}`}
                            {res.publication_year && ` (${res.publication_year})`}
                          </span>
                        </div>
                      )}
 
                      {/* Course iFrame Embed stub */}
                      {res.type === "course" && res.file_url && (
                        <div className="w-full aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-black mb-4">
                          <iframe 
                            src={res.file_url} 
                            title={res.title} 
                            className="w-full h-full"
                            allowFullScreen 
                          />
                        </div>
                      )}
                    </div>
 
                    <div className="pt-3 border-t border-gray-150 dark:border-gray-750 flex flex-col space-y-2 text-xs font-semibold">
                      <div className="flex items-center justify-between text-gray-400 text-[10px] pb-1">
                        <span>📅 Added: {res.created_at ? new Date(res.created_at.seconds * 1000).toLocaleDateString() : "Just now"}</span>
                        {res.file_url && res.type !== "course" && (
                          <a
                            href={res.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-[10px] font-bold px-2.5 py-1 rounded-full transition duration-150 flex items-center"
                          >
                            {res.file_url.includes("firebasestorage.googleapis.com") ? "📄 Open PDF ↗" : "🔗 Visit Website ↗"}
                          </a>
                        )}
                      </div>
 
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex space-x-3">
                          {/* Like Button */}
                          <button
                            onClick={() => handleResourceLikeToggle(res.id, res.author_id)}
                            className={`flex items-center space-x-1 transition hover:scale-105 active:scale-95 ${isLiked ? 'text-red-500 font-bold' : 'text-gray-400 hover:text-gray-500'}`}
                            title="Like Resource"
                          >
                            <span>{isLiked ? "❤️" : "🤍"}</span>
                            <span>{res.likes_count || 0}</span>
                          </button>

                          {/* Bookmark Button */}
                          <button
                            onClick={() => handleBookmarkToggle(res.id)}
                            className={`flex items-center space-x-1 ${isBookmarked ? 'text-indigo-650' : 'text-gray-400 hover:text-gray-500'}`}
                          >
                            <span>📥</span>
                            <span>{isBookmarked ? 'Bookmarked' : 'Save'}</span>
                          </button>
 
                          {/* Moderation Flag Button */}
                          <button
                            onClick={() => handleFlagResource(res.id)}
                            className="text-gray-400 hover:text-red-500"
                            title="Report resource"
                          >
                            🏳️ Report
                          </button>
 
                          {/* Delete Resource Button */}
                          {user && (res.author_id === user.uid || profile?.role === "admin") && (
                            <button
                              onClick={() => handleDeleteResource(res.id)}
                              className="text-gray-405 hover:text-red-500 flex items-center space-x-1"
                              title="Delete Resource"
                            >
                              <span>🗑️</span>
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-500 shadow-sm">
              <p className="text-sm font-medium">No resources found matching these filter settings.</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. CONTRIBUTE RESOURCE MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-xl overflow-y-auto max-h-[90vh] ${containerClass}`}>
            <h2 className="text-lg font-bold mb-2">Contribute Resource</h2>
            <p className="text-xs text-gray-500 mb-6">
              Add research summaries, activity worksheets, or online course guides directly to the dashboard.
            </p>

            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 text-red-650 rounded text-xs">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleResourceSubmit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-gray-500 uppercase mb-1">Resource Title</label>
                <input
                  type="text"
                  placeholder="e.g. Cognitive Recalls on Meme-based Biology Charts"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">Description / Abstract Summary</label>
                <textarea
                  placeholder="Provide a detailed informational abstract of the resource..."
                  value={uploadBody}
                  onChange={(e) => setUploadBody(e.target.value)}
                  rows="3"
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Category Type</label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    <option value="article">Article</option>
                    <option value="research_paper">Research Paper</option>
                    <option value="activity">Classroom Activity</option>
                    <option value="course">Lesson Course</option>
                    <option value="stories">Meme Story</option>
                    <option value="other">Other Tool</option>
                  </select>
                </div>
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
                <label className="block text-gray-500 uppercase mb-1">Grade Group</label>
                <select
                  value={uploadGrade}
                  onChange={(e) => setUploadGrade(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-55 dark:bg-gray-900 rounded"
                >
                  <option value="10-12">Ages 10-12</option>
                  <option value="13-15">Ages 13-15</option>
                  <option value="16-18">Ages 16-18</option>
                  <option value="University">University</option>
                </select>
              </div>
 
              {(uploadType === "article" || uploadType === "research_paper") && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 uppercase mb-1">Year of Publication *</label>
                    <input
                      type="text"
                      placeholder="e.g. 2024"
                      value={uploadPublicationYear}
                      onChange={(e) => setUploadPublicationYear(e.target.value)}
                      className={inputClass}
                      required={uploadType === "article" || uploadType === "research_paper"}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 uppercase mb-1">Journal/Magazine/Website *</label>
                    <input
                      type="text"
                      placeholder="e.g. Nature Science"
                      value={uploadPublisherName}
                      onChange={(e) => setUploadPublisherName(e.target.value)}
                      className={inputClass}
                      required={uploadType === "article" || uploadType === "research_paper"}
                    />
                  </div>
                </div>
              )}
 
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-gray-500 uppercase mb-1">External Hyperlink / Embed URL</label>
                  <input
                    type="text"
                    placeholder="https://youtube.com/embed/..."
                    value={uploadUrl}
                    onChange={(e) => setUploadUrl(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Or Attach File (PDF/Image)</label>
                  <input
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Thumbnail Image URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/thumbnail.png"
                    value={uploadThumbnailUrl}
                    onChange={(e) => setUploadThumbnailUrl(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Or Upload Thumbnail Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setUploadThumbnailFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">Keywords (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. biology, cell division, mitosis"
                  value={uploadKeywords}
                  onChange={(e) => setUploadKeywords(e.target.value)}
                  className={inputClass}
                />
              </div>
 
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadTitle("");
                    setUploadBody("");
                    setUploadUrl("");
                    setUploadFile(null);
                    setUploadPublicationYear("");
                    setUploadPublisherName("");
                    setUploadThumbnailUrl("");
                    setUploadThumbnailFile(null);
                    setUploadKeywords("");
                  }}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-750 dark:text-gray-250 px-4 py-2 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-750"
                >
                  {uploadLoading ? "Publishing..." : "Submit Resource"}
                </button>
              </div>             </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Resources;
