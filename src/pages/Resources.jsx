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
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // 1. Cycle Hero Featured Slider every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % MOCK_FEATURED.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

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

  // 3. Multi-Variable filters & Tab Segmentation
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

    setFilteredResources(result);
  }, [activeTab, subjectFilter, gradeFilter, resources]);

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

  // 6. Submit resource (atomic transaction increment user_stats)
  const handleResourceSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setUploadLoading(true);
    setUploadError("");

    let fileUrl = uploadUrl;

    try {
      // If a file is uploaded, push it to Firebase Storage
      if (uploadFile) {
        const storageRef = ref(storage, `resources/${user.uid}_res_${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, uploadFile);
        fileUrl = await getDownloadURL(snapshot.ref);
      }

      const resColRef = collection(db, "resources");
      const statsDocRef = doc(db, "user_stats", user.uid);

      // Perform transaction to write resource and increment stats atomically
      await runTransaction(db, async (transaction) => {
        const newDocRef = doc(resColRef);
        
        transaction.set(newDocRef, {
          title: uploadTitle,
          body: uploadBody,
          type: uploadType,
          subject: uploadSubject,
          grade_group: uploadGrade,
          file_url: fileUrl,
          author_id: user.uid,
          status: "approved", // Live immediately by default
          created_at: serverTimestamp()
        });

        transaction.update(statsDocRef, {
          resources_contributed_count: increment(1)
        });
      });

      setShowUploadModal(false);
      setUploadTitle("");
      setUploadBody("");
      setUploadUrl("");
      setUploadFile(null);
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

  const activeFeat = MOCK_FEATURED[featuredIndex];

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
            <button onClick={() => setShowUploadModal(true)} className={btnClass}>
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
          {MOCK_FEATURED.map((_, idx) => (
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
                const authorName = res.author_id === "admin" ? "Admin" : (userCache[res.author_id] || "Contributor");

                return (
                  <div key={res.id} className={`p-5 flex flex-col justify-between h-full ${containerClass}`}>
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="bg-purple-50 dark:bg-purple-950/20 text-purple-750 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">
                          {res.type.replace("_", " ")}
                        </span>
                        
                        {/* Contributor Label clickable username gateway link */}
                        <button
                          onClick={() => openUserModal(res.author_id)}
                          className="text-[10px] text-gray-400 hover:text-purple-650 font-medium"
                        >
                          By {authorName}
                        </button>
                      </div>

                      <h3 className="font-extrabold text-sm mb-2">{res.title}</h3>
                      <p className="text-xs text-gray-500 mb-4 line-clamp-3 leading-relaxed">{res.body}</p>

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

                    <div className="pt-3 border-t border-gray-150 dark:border-gray-750 flex items-center justify-between text-xs font-semibold">
                      <div className="flex space-x-3">
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
                      </div>
                      
                      {res.file_url && res.type !== "course" && (
                        <a
                          href={res.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-650 hover:underline text-[11px]"
                        >
                          Access File ↗
                        </a>
                      )}
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
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">Grade Group</label>
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

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
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
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Resources;
