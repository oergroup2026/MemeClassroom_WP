import React, { useState, useEffect } from "react";
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
  runTransaction,
  orderBy,
  limit
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { sendPasswordResetEmail } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { db, storage, auth, functions } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Clock, Search, CheckCircle2, AlertCircle, EyeOff, Star, BadgeCheck, ShieldAlert, Newspaper as NewspaperIcon, Plus } from "lucide-react";
import { useUdl } from "../context/UdlContext";
import { useToast } from "../components/ToastNotification";
import ConfirmDialog from "../components/ConfirmDialog";
import AdminPagination from "../components/AdminPagination";
import RichTextArea from "../components/RichTextArea";
import AdminAnalyticsDashboard from "../components/AdminAnalyticsDashboard";
import { DEFAULT_TOOL_SECTIONS } from "../constants/taxonomy";
import { NEWSPAPER_CATEGORIES } from "../constants/newspaperCategories";
import { HIGHLIGHT_CONTENT_TYPES, HIGHLIGHT_PLACEMENTS, highlightContentTypeMeta } from "../constants/contentHighlights";
import { isStoryResource } from "../utils/storyTemplates";
import { basicQuestions } from "../data/memeTestQuestionsBasic";
import { SLANG_STARTER_WORDS } from "../data/slangStarterWords";

const Admin = () => {
  const { user, profile } = useAuth();
  const { highContrastMode } = useUdl();
  const toast = useToast();

  // Active Tab: "analytics" | "moderation" | "archivist" | "users" | "marketing" | "taxonomy"
  const [activeTab, setActiveTab] = useState("analytics");
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState("success"); // "success" | "error"

  // ConfirmDialog state
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: "", message: "", variant: "danger", confirmLabel: "Delete", onConfirm: null });
  const openConfirm = (opts) => setConfirmState({ isOpen: true, ...opts });
  const closeConfirm = () => setConfirmState((s) => ({ ...s, isOpen: false, onConfirm: null }));

  // Staffroom attachments
  const [staffroomAttachments, setStafroomAttachments] = useState([]);

  // Firestore collections state
  const [users, setUsers] = useState([]);
  // Email addresses live in /private_contacts/{uid} (owner/admin only), keyed by
  // uid here since /users no longer carries email — see firestore.rules.
  const [contactEmailsById, setContactEmailsById] = useState({});
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [unbanRequests, setUnbanRequests] = useState([]);
  const [memes, setMemes] = useState([]);
  const [resources, setResources] = useState([]);
  const [flags, setFlags] = useState([]);
  const [newspaperItems, setNewspaperItems] = useState([]);
  const [newspaperForm, setNewspaperForm] = useState({
    title: "", sourceUrl: "", summaryText: "", category: NEWSPAPER_CATEGORIES[0].value,
    classroomTalkingPoint: "", imageUrl: "", imageFile: null, imagePreview: "",
  });
  const [fetchingNewspaperThumbnail, setFetchingNewspaperThumbnail] = useState(false);
  const [isForceFetchingNewspaper, setIsForceFetchingNewspaper] = useState(false);
  const [newspaperStatusFilter, setNewspaperStatusFilter] = useState("pending"); // "pending" | "approved" | "all"
  const [newspaperPage, setNewspaperPage] = useState(1);
  const [resourcesPendingPage, setResourcesPendingPage] = useState(1);
  const [slangPendingPage, setSlangPendingPage] = useState(1);
  const [cmMemesPage, setCmMemesPage] = useState(1);
  const [cmResourcesPage, setCmResourcesPage] = useState(1);
  const [cmPostsPage, setCmPostsPage] = useState(1);
  const [cmTemplatesPage, setCmTemplatesPage] = useState(1);

  // ── Content Highlights (homepage + Newspaper hero curation) ──────────────
  const [highlightDocs, setHighlightDocs] = useState([]);
  const [hlView, setHlView] = useState("list"); // "list" | "form"
  const [hlEditId, setHlEditId] = useState(null);
  const [hlfContentType, setHlfContentType] = useState("newspaper_item");
  const [hlfContentId, setHlfContentId] = useState("");
  const [hlfPlacement, setHlfPlacement] = useState("newspaper");
  const [hlfTitle, setHlfTitle] = useState("");
  const [hlfSummary, setHlfSummary] = useState("");
  const [hlfSourceLabel, setHlfSourceLabel] = useState("");
  const [hlfLink, setHlfLink] = useState("");
  const [hlfImageUrl, setHlfImageUrl] = useState("");
  const [hlfImageFile, setHlfImageFile] = useState(null);
  const [hlfImagePreview, setHlfImagePreview] = useState("");
  const [hlfOrder, setHlfOrder] = useState(0);
  const [hlfActive, setHlfActive] = useState(true);
  const [hlSaving, setHlSaving] = useState(false);
  const [expertApps, setExpertApps] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sponsoredAds, setSponsoredAds] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [pruningLog, setPruningLog] = useState({ pruned_count: 0, space_saved_mb: 0 });
  const [taxonomy, setTaxonomy] = useState({ subjects: [], grades: [] });

  const [literacyTests, setLiteracyTests] = useState([]);
  const [literacyQuestions, setLiteracyQuestions] = useState([]);
  const [ltActiveTestId, setLtActiveTestId] = useState(null);
  const [ltView, setLtView] = useState("list");
  const [ltSaving, setLtSaving] = useState(false);

  // Slang Decoder — dictionary (for moderation queue) & quiz question bank
  const [slangTerms, setSlangTerms] = useState([]);
  const [slangQuizQuestions, setSlangQuizQuestions] = useState([]);
  const [sqView, setSqView] = useState("list"); // "list" | "form"
  const [sqEditId, setSqEditId] = useState(null); // null = new
  const [sqSaving, setSqSaving] = useState(false);
  const [sqText, setSqText] = useState("");
  const [sqCategory, setSqCategory] = useState("genz");
  const [sqOptions, setSqOptions] = useState(["", "", "", ""]);
  const [sqCorrectIdx, setSqCorrectIdx] = useState(0);
  const [sqExplanation, setSqExplanation] = useState("");
  const [sqIsActive, setSqIsActive] = useState(true);

  // Slang Decoder — manage/edit already-uploaded words & their meme images
  const [slangAdminSubTab, setSlangAdminSubTab] = useState("quiz"); // "quiz" | "words"
  const [stView, setStView] = useState("list"); // "list" | "form"
  const [stEditId, setStEditId] = useState(null);
  const [stSaving, setStSaving] = useState(false);
  const [stTerm, setStTerm] = useState("");
  const [stCategory, setStCategory] = useState("genz");
  const [stDefinition, setStDefinition] = useState("");
  const [stExampleUsage, setStExampleUsage] = useState("");
  const [stLinks, setStLinks] = useState([{ title: "", url: "" }]);
  const [stExistingMemeUrls, setStExistingMemeUrls] = useState([]);
  const [stNewMemeFiles, setStNewMemeFiles] = useState([]);
  const [stNewMemePreviews, setStNewMemePreviews] = useState([]);

  // ─── Hero Cards State ────────────────────────────────────────────────────────
  const [heroCardsList, setHeroCardsList] = useState([]);
  const [heroCardsLoading, setHeroCardsLoading] = useState(false);
  const [hcView, setHcView] = useState("list"); // "list" | "form"
  const [hcEditId, setHcEditId] = useState(null); // null = new
  const [hcSaving, setHcSaving] = useState(false);
  // Form fields
  const [hcfPillar, setHcfPillar] = useState("pedagogy");
  const [hcfType, setHcfType] = useState("");
  const [hcfTitle, setHcfTitle] = useState("");
  const [hcfSnippet, setHcfSnippet] = useState("");
  const [hcfSource, setHcfSource] = useState("");
  const [hcfHref, setHcfHref] = useState("/resources");
  const [hcfMediaType, setHcfMediaType] = useState("none"); // "none" | "image" | "video"
  const [hcfMediaUrl, setHcfMediaUrl] = useState("");
  const [hcfMediaFile, setHcfMediaFile] = useState(null);
  const [hcfOrder, setHcfOrder] = useState(0);
  const [hcfActive, setHcfActive] = useState(true);

  // Test form fields
  const [ltfTitle, setLtfTitle] = useState("");
  const [ltfDesc, setLtfDesc] = useState("");
  const [ltfDifficulty, setLtfDifficulty] = useState("beginner");
  const [ltfCategory, setLtfCategory] = useState("");
  const [ltfBadgeIcon, setLtfBadgeIcon] = useState("🏅");
  const [ltfBadgeLabel, setLtfBadgeLabel] = useState("");
  const [ltfPassThreshold, setLtfPassThreshold] = useState(60);
  const [ltfIsActive, setLtfIsActive] = useState(true);
  // Question form fields
  const [ltqEditId, setLtqEditId] = useState(null); // null = new
  const [ltqText, setLtqText] = useState("");
  const [ltqDimension, setLtqDimension] = useState("");
  const [ltqOptions, setLtqOptions] = useState(["", "", "", ""]);
  const [ltqCorrectIdx, setLtqCorrectIdx] = useState(0);
  const [ltqExplanation, setLtqExplanation] = useState("");
  const [ltqMemeUrl, setLtqMemeUrl] = useState("");
  const [ltqMemeFile, setLtqMemeFile] = useState(null);
  const [ltqOrder, setLtqOrder] = useState(0);

  // Filtering / Search States (User Directory)
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");

  // Modals / Form States
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("student");
  const [newUserInstitution, setNewUserInstitution] = useState("");
  const [newUserPlace, setNewUserPlace] = useState("");
  const [newUserState, setNewUserState] = useState("");
  const [newUserCountry, setNewUserCountry] = useState("");

  // Direct Archivist Form States
  const [archivistMode, setArchivistMode] = useState("template"); // "template" | "meme" | "resource"

  // Template Form
  const [tempTitle, setTempTitle] = useState("");
  const [tempFormat, setTempFormat] = useState("image");
  const [tempUrl, setTempUrl] = useState("");
  const [tempFile, setTempFile] = useState(null);

  // Meme Form
  const [memeTitle, setMemeTitle] = useState("");
  const [memeFormat, setMemeFormat] = useState("image");
  const [memeUrl, setMemeUrl] = useState("");
  const [memeFile, setMemeFile] = useState(null);
  const [memeSubject, setMemeSubject] = useState("Biology");
  const [memeGrade, setMemeGrade] = useState("High School (9–10)");
  const [memeLang, setMemeLang] = useState("English");

  // Resource Form
  const [resTitle, setResTitle] = useState("");
  const [resType, setResType] = useState("article");
  const [resSubject, setResSubject] = useState("Biology");
  const [resGrade, setResGrade] = useState("High School (9–10)");
  const [resBody, setResBody] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [resFile, setResFile] = useState(null);
  const [resPublicationYear, setResPublicationYear] = useState("");
  const [resPublisherName, setResPublisherName] = useState("");
  const [resThumbnailUrl, setResThumbnailUrl] = useState("");
  const [resThumbnailFile, setResThumbnailFile] = useState(null);
  const [resKeywords, setResKeywords] = useState("");
  // Story-specific archivist fields
  const [resUsageContext, setResUsageContext] = useState("");
  const [resExampleImages, setResExampleImages] = useState([""]); // array of URL strings
  const [resExampleFiles, setResExampleFiles] = useState([]); // array of File objects
  const [resEducationalUse, setResEducationalUse] = useState("");

  // Marketing Form States
  const [adTitle, setAdTitle] = useState("");
  const [adImageUrl, setAdImageUrl] = useState("");
  const [adImageFile, setAdImageFile] = useState(null);
  const [adDestUrl, setAdDestUrl] = useState("");
  const [adIsActive, setAdIsActive] = useState(true);

  // Testimonial Form States
  const [testAuthor, setTestAuthor] = useState("");
  const [testInst, setTestInst] = useState("");
  const [testBody, setTestBody] = useState("");
  const [testImageUrl, setTestImageUrl] = useState("");
  const [testImageFile, setTestImageFile] = useState(null);
  const [testIsFeatured, setTestIsFeatured] = useState(true);

  // Taxonomy Form States
  const [newTaxSubject, setNewTaxSubject] = useState("");
  const [newTaxGrade, setNewTaxGrade] = useState("");
  const [newTaxLanguage, setNewTaxLanguage] = useState("");
  const [newTaxToolSection, setNewTaxToolSection] = useState("");
  const [taxSubjectSearch, setTaxSubjectSearch] = useState("");
  const [taxGradeSearch, setTaxGradeSearch] = useState("");
  const [taxLangSearch, setTaxLangSearch] = useState("");
  const [taxSectionSearch, setTaxSectionSearch] = useState("");

  const [loadingAction, setLoadingAction] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isClearingNewspaper, setIsClearingNewspaper] = useState(false);

  // Content Manager Tab State
  const [contentManagerTab, setContentManagerTab] = useState("memes"); // "memes" | "resources" | "posts" | "templates"
  const [cmSearch, setCmSearch] = useState("");
  const [staffroomAllPosts, setStafroomAllPosts] = useState([]);
  const [staffroomAllReplies, setStafroomAllReplies] = useState([]);

  // Content Manager — per-sub-tab filter states
  const [cmMemeVisibility, setCmMemeVisibility] = useState("all"); // "all"|"public"|"admin_hidden"|"flagged_hidden"
  const [cmMemeFormat, setCmMemeFormat] = useState("all");         // "all"|"image"|"video"|"gif"|"audio"
  const [cmMemeCreator, setCmMemeCreator] = useState("all");       // "all"|"admin"|"user"

  const [cmResStatus, setCmResStatus] = useState("all");           // "all"|"approved"|"pending"|"admin_hidden"|"hidden_moderation"
  const [cmResType, setCmResType] = useState("all");               // "all"| resource type key
  const [cmResCreator, setCmResCreator] = useState("all");         // "all"|"admin"|"user"

  const [cmPostVisibility, setCmPostVisibility] = useState("all"); // "all"|"visible"|"admin_hidden"
  const [cmPostType, setCmPostType] = useState("all");             // "all"|post_type value
  const [cmPostCreator, setCmPostCreator] = useState("all");       // "all"|"admin"|"user"

  const [cmTplStatus, setCmTplStatus] = useState("all");           // "all"|"approved"|"pending"|"rejected"
  const [cmTplFormat, setCmTplFormat] = useState("all");           // "all"|"image"|"video"|"gif"|"audio"
  const [cmTplCreator, setCmTplCreator] = useState("all");         // "all"|"admin"|"user"
  const [cmTplStory, setCmTplStory] = useState("all");             // "all"|"linked"|"unlinked"

  // Content Manager — bulk selection (Set of IDs per sub-tab)
  const [cmMemeSelected, setCmMemeSelected] = useState(new Set());
  const [cmResSelected, setCmResSelected] = useState(new Set());
  const [cmPostSelected, setCmPostSelected] = useState(new Set());
  const [cmTplSelected, setCmTplSelected] = useState(new Set());

  // Force Tab check for Manager restrictions
  useEffect(() => {
    if (profile && profile.role === "manager") {
      if (activeTab === "marketing" || activeTab === "taxonomy") {
        setActiveTab("analytics");
      }
    }
  }, [profile, activeTab]);

  // Real-time queries
  useEffect(() => {
    // 1. Users
    const uUnsub = onSnapshot(collection(db, "users"), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setUsers(list);
    });

    // 1a. Contact emails (admin-only collection, keyed by uid)
    const cUnsub = onSnapshot(collection(db, "private_contacts"), (snap) => {
      const map = {};
      snap.forEach(d => { map[d.id] = d.data()?.email || ""; });
      setContactEmailsById(map);
    });

    // 1b. Users pending ID card verification
    const vUnsub = onSnapshot(
      query(collection(db, "users"), where("verification_status", "==", "id_submitted")),
      (snap) => {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setPendingVerifications(list);
      }
    );

    // 2. Memes
    const mUnsub = onSnapshot(collection(db, "memes"), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setMemes(list);
    });

    // 3. Resources
    const rUnsub = onSnapshot(collection(db, "resources"), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setResources(list);
    });

    // 4. Pending Flags
    const fUnsub = onSnapshot(query(collection(db, "flags"), where("status", "==", "pending")), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setFlags(list);
    });

    // 5. Pending Expert Applications
    const eUnsub = onSnapshot(query(collection(db, "expert_apps"), where("status", "==", "pending")), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setExpertApps(list);
    });

    // 6. Pending Templates
    const tUnsub = onSnapshot(collection(db, "templates"), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setTemplates(list);
    });

    // 7. Sponsored Ads
    const adUnsub = onSnapshot(collection(db, "sponsored_ads"), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setSponsoredAds(list);
    });

    // 8. Testimonials
    const testUnsub = onSnapshot(collection(db, "testimonials"), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setTestimonials(list);
    });

    // 9. Pruning Log
    const pUnsub = onSnapshot(doc(db, "configs", "pruning"), (snap) => {
      if (snap.exists()) {
        setPruningLog(snap.data());
      }
    });

    // 10. Taxonomy
    const taxUnsub = onSnapshot(doc(db, "configs", "taxonomy"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const hasOldGrades = data.grades?.some(g => ["10-12", "13-15", "16-18", "University", "Adult / Lifelong Learning"].includes(g));
        const missingLanguages = !data.languages || data.languages.length === 0;

        if (hasOldGrades || missingLanguages) {
          const updates = {};
          if (hasOldGrades) {
            updates.grades = [
              "Middle School (6–8)",
              "High School (9–10)",
              "Senior Secondary (11–12)",
              "Undergraduate",
              "Postgraduate",
              "Competitive Exams",
              "General"
            ];
          }
          if (missingLanguages) {
            updates.languages = ["English", "Hindi", "Malayalam", "Tamil", "Other"];
          }
          setDoc(doc(db, "configs", "taxonomy"), { ...data, ...updates }, { merge: true })
            .catch(err => console.error("Taxonomy auto-migration failed", err));
        }
        setTaxonomy(data);
      } else {
        // Fallback default taxonomy settings
        setTaxonomy({
          subjects: ["Biology", "Physics", "Maths", "Chemistry", "History", "Geography", "English", "Computer Science", "Environmental Science", "Economics", "Other"],
          grades: [
            "Middle School (6–8)",
            "High School (9–10)",
            "Senior Secondary (11–12)",
            "Undergraduate",
            "Postgraduate",
            "Competitive Exams",
            "General"
          ],
          languages: ["English", "Hindi", "Malayalam", "Tamil", "Other"]
        });
      }
    });

    // 11. Staffroom posts with real attachments
    const attQ = query(collection(db, "staffroom_posts"), where("attachment_storage_path", "!=", ""));
    const attUnsub = onSnapshot(attQ, (snap) => {
      const list = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.attachment_storage_path) {
          list.push({ id: d.id, title: data.title || data.body?.slice(0, 50) || "Untitled", attachment_name: data.attachment_name, attachment_url: data.attachment_url, attachment_storage_path: data.attachment_storage_path, author_id: data.author_id, created_at: data.created_at });
        }
      });
      list.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setStafroomAttachments(list);
    });

    // 12. All staffroom posts (for Content Manager tab — admin full authority view)
    const allPostsUnsub = onSnapshot(collection(db, "staffroom_posts"), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setStafroomAllPosts(list);
    });

    // 13. All staffroom replies (for Content Manager tab — inline reply deletion)
    const allRepliesUnsub = onSnapshot(collection(db, "staffroom_replies"), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setStafroomAllReplies(list);
    });

    // 14. Literacy Tests
    const ltTestsUnsub = onSnapshot(collection(db, "literacy_tests"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));
      setLiteracyTests(list);
    });

    // 15. Literacy Test Questions
    const ltQuestionsUnsub = onSnapshot(collection(db, "literacy_test_questions"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      setLiteracyQuestions(list);
    });

    // 16. Unban Requests
    const unbanReqsUnsub = onSnapshot(collection(db, "unban_requests"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUnbanRequests(list);
    });

    // 18. Slang Decoder — dictionary entries (for the moderation queue)
    const slangTermsUnsub = onSnapshot(collection(db, "slang_terms"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));
      setSlangTerms(list);
    });

    // 19. Slang Decoder — quiz question bank
    const slangQuestionsUnsub = onSnapshot(collection(db, "slang_quiz_questions"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSlangQuizQuestions(list);
    });

    // 17. Newspaper Items
    const newsUnsub = onSnapshot(collection(db, "newspaper_items"), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setNewspaperItems(list);
    });

    // 20. Content Highlights (homepage + Newspaper hero curation)
    const highlightsUnsub = onSnapshot(collection(db, "content_highlights"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      setHighlightDocs(list);
    });

    return () => {
      uUnsub();
      cUnsub();
      vUnsub();
      mUnsub();
      rUnsub();
      fUnsub();
      eUnsub();
      tUnsub();
      adUnsub();
      testUnsub();
      pUnsub();
      taxUnsub();
      attUnsub();
      newsUnsub();
      allPostsUnsub();
      allRepliesUnsub();
      ltTestsUnsub();
      ltQuestionsUnsub();
      unbanReqsUnsub();
      slangTermsUnsub();
      slangQuestionsUnsub();
      highlightsUnsub();
    };
  }, []);


  const triggerAlert = (msg, type = "success") => {
    setAlertMsg(msg);
    setAlertType(type);
    setTimeout(() => setAlertMsg(""), 6000);
  };

  // MODERATION ACTIONS
  const handleDismissFlag = async (flagId, contentType, contentId) => {
    try {
      // Resolve report — mark as dismissed only (no longer hide/unhide content)
      await updateDoc(doc(db, "flags", flagId), { status: "dismissed" });
      triggerAlert("Flag dismissed. Content remains visible unless admin takes further action.");
    } catch (e) {
      triggerAlert(e.message || "Action failed.", "error");
    }
  };

  const handleConfirmDeleteFlag = async (flagId, contentType, contentId) => {
    try {
      await updateDoc(doc(db, "flags", flagId), { status: "deleted" });

      if (contentType === "resource") {
        await deleteDoc(doc(db, "resources", contentId));
      } else if (contentType === "meme") {
        // Hide meme (admin decision) instead of hard delete
        await updateDoc(doc(db, "memes", contentId), { visibility: "flagged_hidden" });
      } else if (contentType === "post") {
        await deleteDoc(doc(db, "staffroom_posts", contentId));
      } else if (contentType === "newspaper_item") {
        await deleteDoc(doc(db, "newspaper_items", contentId));
      }
      triggerAlert("Content actioned by admin. Flag resolved.");
    } catch (e) {
      triggerAlert(e.message || "Deletion failed.", "error");
    }
  };

  // RESOURCE APPROVAL ACTIONS
  const handleApproveResource = async (resourceId) => {
    try {
      await updateDoc(doc(db, "resources", resourceId), { admin_approved: true });
      triggerAlert("Resource approved. 'Pending Admin Approval' badge removed.");
    } catch (e) {
      triggerAlert(e.message || "Approval failed.", "error");
    }
  };

  // SLANG TERM APPROVAL ACTIONS
  const handleApproveSlangTerm = async (termId) => {
    try {
      await updateDoc(doc(db, "slang_terms", termId), { status: "approved", admin_approved: true });
      triggerAlert("Slang word approved — now visible in the Slang Decoder dictionary.");
    } catch (e) {
      triggerAlert(e.message || "Approval failed.", "error");
    }
  };

  const handleRejectSlangTerm = (termId, term) => {
    openConfirm({
      title: "Reject Slang Word?",
      message: `Permanently delete "${term}"? This cannot be undone.`,
      variant: "danger",
      confirmLabel: "Reject & Delete",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "slang_terms", termId));
          triggerAlert("Slang word rejected and removed.");
        } catch (e) {
          triggerAlert(e.message || "Deletion failed.", "error");
        }
      },
    });
  };

  // NEWSPAPER APPROVAL ACTIONS
  const handleApproveNewspaperItem = async (itemId) => {
    try {
      await updateDoc(doc(db, "newspaper_items", itemId), { admin_approved: true });
      triggerAlert("Newspaper item approved. 'Pending Admin Approval' badge removed.");
    } catch (e) {
      triggerAlert(e.message || "Approval failed.", "error");
    }
  };

  // Auto-fetched items are auto-categorized from which RSS search found them,
  // which is often wrong (e.g. a "misinformation" search can surface an
  // article that isn't really about misinformation) — let admin correct it.
  const handleChangeNewspaperCategory = async (itemId, category) => {
    try {
      await updateDoc(doc(db, "newspaper_items", itemId), { category });
    } catch (e) {
      triggerAlert(e.message || "Failed to update category.", "error");
    }
  };

  // Manual thumbnail fix — auto-fetch's og:image scrape often fails (many
  // publishers block server-side scrapers, and Google News search results
  // link through a redirect page that sometimes needs a browser to resolve),
  // so this is the reliable fallback: upload a real photo directly, no need
  // to also mark the item as a Highlight to get an image onto it.
  const handleQuickSetNewspaperImage = async (itemId, file) => {
    if (!file) return;
    try {
      const storageRef = ref(storage, `newspaper/${itemId}_${Date.now()}_${file.name}`);
      const snap = await uploadBytes(storageRef, file);
      const imageUrl = await getDownloadURL(snap.ref);
      await updateDoc(doc(db, "newspaper_items", itemId), { image_url: imageUrl });
      triggerAlert("Thumbnail updated.");
    } catch (e) {
      triggerAlert(e.message || "Thumbnail upload failed.", "error");
    }
  };

  const handleDeleteNewspaperItem = (itemId) => {
    openConfirm({
      title: "Delete Newspaper Item?",
      message: "Permanently delete this newspaper item? This cannot be undone.",
      variant: "danger",
      confirmLabel: "Delete",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "newspaper_items", itemId));
          triggerAlert("Newspaper item permanently removed.");
        } catch (e) {
          triggerAlert(e.message || "Deletion failed.", "error");
        }
      },
    });
  };

  const handleToggleNewspaperVisibility = async (itemId, currentStatus) => {
    try {
      const newStatus = currentStatus === "admin_hidden" ? "live" : "admin_hidden";
      await updateDoc(doc(db, "newspaper_items", itemId), { status: newStatus });
      triggerAlert(newStatus === "admin_hidden" ? "Newspaper item hidden." : "Newspaper item restored.");
    } catch (e) {
      triggerAlert(e.message || "Action failed.", "error");
    }
  };

  const handleFetchNewspaperThumbnail = async () => {
    if (!newspaperForm.sourceUrl.trim()) { triggerAlert("Paste a source link first.", "error"); return; }
    try {
      new URL(newspaperForm.sourceUrl.trim());
    } catch {
      triggerAlert("That source link doesn't look valid.", "error");
      return;
    }

    setFetchingNewspaperThumbnail(true);
    try {
      const fetchArticleThumbnail = httpsCallable(functions, "fetchArticleThumbnail");
      const { data } = await fetchArticleThumbnail({ url: newspaperForm.sourceUrl.trim() });
      if (data?.imageUrl) {
        setNewspaperForm((f) => ({ ...f, imageUrl: data.imageUrl, imageFile: null, imagePreview: data.imageUrl }));
      } else {
        triggerAlert("No image found — upload one instead.", "error");
      }
    } catch (e) {
      console.error("fetchArticleThumbnail failed", e);
      triggerAlert("Couldn't fetch a thumbnail — upload one instead.", "error");
    } finally {
      setFetchingNewspaperThumbnail(false);
    }
  };

  const handleForceFetchNewspaperItems = async () => {
    setIsForceFetchingNewspaper(true);
    try {
      const forceFetchNewspaperItems = httpsCallable(functions, "forceFetchNewspaperItems");
      const { data } = await forceFetchNewspaperItems();
      const total = data?.totalAdded || 0;
      if (total > 0) {
        const perCategory = Object.entries(data.addedPerCategory || {})
          .map(([cat, count]) => `${cat.replace(/_/g, " ")}: ${count}`)
          .join(", ");
        triggerAlert(`Force-fetched ${total} new item(s). ${perCategory}`);
      } else {
        triggerAlert("No new items found — sources may be exhausted or already fetched.");
      }
    } catch (e) {
      console.error("forceFetchNewspaperItems failed", e);
      triggerAlert(e.message || "Force fetch failed.", "error");
    } finally {
      setIsForceFetchingNewspaper(false);
    }
  };

  const handleAddNewspaperItem = async (formState, resetForm) => {
    try {
      let domain = "";
      try { domain = new URL(formState.sourceUrl.trim()).hostname.replace(/^www\./, ""); } catch (_) {}

      let imageUrl = formState.imageUrl.trim();
      if (formState.imageFile) {
        const imgRef = ref(storage, `newspaper/admin_${Date.now()}`);
        const snap = await uploadBytes(imgRef, formState.imageFile);
        imageUrl = await getDownloadURL(snap.ref);
      }

      await addDoc(collection(db, "newspaper_items"), {
        title: formState.title.trim(),
        source_url: formState.sourceUrl.trim(),
        source_domain: domain,
        summary_text: formState.summaryText.trim(),
        classroom_talking_point: formState.classroomTalkingPoint.trim(),
        category: formState.category,
        image_url: imageUrl,
        keywords: [],
        source_trust: "trusted",
        admin_approved: true,
        status: "live",
        author_id: "admin",
        author_name: "Admin",
        view_count: 0,
        likes_count: 0,
        flag_count: 0,
        auto_fetched: false,
        fetch_source_id: null,
        external_id: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      triggerAlert("Newspaper item published.");
      resetForm();
    } catch (e) {
      triggerAlert(e.message || "Publish failed.", "error");
    }
  };

  // ── CONTENT HIGHLIGHTS (homepage + Newspaper hero curation) ───────────────
  const hlResetForm = () => {
    setHlEditId(null);
    setHlfContentType("newspaper_item");
    setHlfContentId("");
    setHlfPlacement("newspaper");
    setHlfTitle("");
    setHlfSummary("");
    setHlfSourceLabel("");
    setHlfLink("");
    setHlfImageUrl("");
    setHlfImageFile(null);
    setHlfImagePreview("");
    setHlfOrder(highlightDocs.length);
    setHlfActive(true);
  };

  // Pre-fills a new highlight from an existing piece of content (Newspaper
  // item / Resource / Meme / Staffroom post), so curating a pick is a couple
  // of clicks from wherever that content is already being managed, instead
  // of re-typing its title/image/link by hand. Admin can still edit
  // everything (including swap in a different thumbnail) before saving.
  const handleQuickHighlight = (contentType, item) => {
    const meta = highlightContentTypeMeta(contentType);
    // A highlighted item needs to actually be visible on the site, so
    // highlighting also approves it — otherwise a pick made from the
    // Pending Approval queue would resolve to nothing on the public page
    // until someone separately clicked Approve too.
    if (item.admin_approved === false) {
      const approveCollection = contentType === "newspaper_item" ? "newspaper_items" : "resources";
      updateDoc(doc(db, approveCollection, item.id), { admin_approved: true }).catch(() => {});
    }
    setHlEditId(null);
    setHlfContentType(contentType);
    setHlfContentId(item.id);
    setHlfPlacement(contentType === "newspaper_item" ? "newspaper" : "home");
    setHlfTitle(item.title || "");
    setHlfSummary((item.summary_text || item.body || item.caption || "").trim().slice(0, 240));
    setHlfSourceLabel(meta?.label || "");
    setHlfLink(meta?.buildLink(item.id) || "");
    setHlfImageUrl(item.image_url || item.thumbnail_url || item.media_url || item.attachment_url || "");
    setHlfImageFile(null);
    setHlfImagePreview(item.image_url || item.thumbnail_url || item.media_url || item.attachment_url || "");
    setHlfOrder(highlightDocs.length);
    setHlfActive(true);
    setActiveTab("highlights");
    setHlView("form");
  };

  const hlPrefillForm = (h) => {
    setHlEditId(h.id);
    setHlfContentType(h.content_type || "newspaper_item");
    setHlfContentId(h.content_id || "");
    setHlfPlacement(h.placement || "home");
    setHlfTitle(h.title || "");
    setHlfSummary(h.summary || "");
    setHlfSourceLabel(h.source_label || "");
    setHlfLink(h.link || "");
    setHlfImageUrl(h.image_url || "");
    setHlfImageFile(null);
    setHlfImagePreview(h.image_url || "");
    setHlfOrder(h.order ?? 0);
    setHlfActive(h.active ?? true);
    setHlView("form");
  };

  const handleHlSave = async (e) => {
    e.preventDefault();
    if (!hlfTitle.trim() || !hlfLink.trim()) {
      triggerAlert("Title and link are required.", "error");
      return;
    }
    setHlSaving(true);
    try {
      let imageUrl = hlfImageUrl;
      if (hlfImageFile) {
        const storageRef = ref(storage, `content_highlights/${hlEditId || Date.now()}_${hlfImageFile.name}`);
        const snap = await uploadBytes(storageRef, hlfImageFile);
        imageUrl = await getDownloadURL(snap.ref);
      }
      const data = {
        content_type: hlfContentType,
        content_id: hlfContentId,
        placement: hlfPlacement,
        title: hlfTitle.trim(),
        summary: hlfSummary.trim(),
        source_label: hlfSourceLabel.trim(),
        link: hlfLink.trim(),
        image_url: imageUrl.trim(),
        order: Number(hlfOrder),
        active: hlfActive,
        updated_at: serverTimestamp(),
      };
      if (hlEditId) {
        await updateDoc(doc(db, "content_highlights", hlEditId), data);
        triggerAlert("Highlight updated!");
      } else {
        await addDoc(collection(db, "content_highlights"), { ...data, created_at: serverTimestamp(), created_by: user.uid });
        triggerAlert("Highlight created!");
      }
      hlResetForm();
      setHlView("list");
    } catch (e) {
      triggerAlert(e.message || "Save failed.", "error");
    } finally {
      setHlSaving(false);
    }
  };

  const handleHlDelete = (h) => {
    openConfirm({
      title: "Remove Highlight?",
      message: `Remove "${h.title}" from the highlights carousel? The original content is not affected.`,
      variant: "danger",
      confirmLabel: "Remove",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "content_highlights", h.id));
          triggerAlert("Highlight removed.");
        } catch (e) { triggerAlert(e.message || "Delete failed.", "error"); }
      }
    });
  };

  const handleHlToggleActive = async (h) => {
    try {
      await updateDoc(doc(db, "content_highlights", h.id), { active: !h.active, updated_at: serverTimestamp() });
    } catch (e) { triggerAlert(e.message || "Toggle failed.", "error"); }
  };

  const handleHlReorder = async (placement, highlightId, direction) => {
    const list = highlightDocs.filter(h => h.placement === placement);
    const idx = list.findIndex(h => h.id === highlightId);
    if ((direction === "up" && idx === 0) || (direction === "down" && idx === list.length - 1)) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const newList = [...list];
    [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];
    await Promise.all(newList.map((h, i) => updateDoc(doc(db, "content_highlights", h.id), { order: i })));
  };

  const handleDeleteResourceAdmin = (resourceId) => {
    openConfirm({
      title: "Delete Resource?",
      message: "Permanently delete this resource? This cannot be undone.",
      variant: "danger",
      confirmLabel: "Delete",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "resources", resourceId));
          triggerAlert("Resource permanently removed.");
        } catch (e) {
          triggerAlert(e.message || "Deletion failed.", "error");
        }
      },
    });
  };

  const handleApproveExpert = async (appId, applicantId) => {
    try {
      await updateDoc(doc(db, "users", applicantId), { role: "expert", is_verified: true });
      await updateDoc(doc(db, "expert_apps", appId), { status: "approved" });
      triggerAlert("User upgraded to Verified Expert successfully.");
    } catch (e) {
      triggerAlert(e.message || "Failed to approve applicant.", "error");
    }
  };

  // ID-card verification: admin approves → set is_verified: true
  const handleApproveIdVerification = async (userId) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        is_verified: true,
        verification_status: "verified",
      });
      triggerAlert("User institution verified via ID card.");
    } catch (e) {
      triggerAlert(e.message || "Failed to approve verification.", "error");
    }
  };

  // ID-card verification: admin rejects → clear the submission
  const handleRejectIdVerification = async (userId) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        verification_status: "rejected",
        is_verified: false,
      });
      triggerAlert("Verification request rejected.");
    } catch (e) {
      triggerAlert(e.message || "Failed to reject verification.", "error");
    }
  };

  const handleRejectExpert = async (appId) => {
    try {
      await updateDoc(doc(db, "expert_apps", appId), { status: "rejected" });
      triggerAlert("Expert application status updated to rejected.");
    } catch (e) {
      triggerAlert(e.message || "Failed to update application.", "error");
    }
  };

  const handleApproveTemplate = async (tempId) => {
    try {
      await updateDoc(doc(db, "templates", tempId), { status: "approved" });
      triggerAlert("Template approved to Meme Lab catalog.");
    } catch (e) {
      triggerAlert(e.message || "Template approval failed.", "error");
    }
  };

  const handleRejectTemplate = async (tempId) => {
    try {
      await updateDoc(doc(db, "templates", tempId), { status: "rejected" });
      // Also hide any linked meme story resource
      const linkedStoryQ = query(
        collection(db, "resources"),
        where("type", "==", "stories"),
        where("template_id", "==", tempId)
      );
      const linkedSnap = await getDocs(linkedStoryQ);
      await Promise.all(linkedSnap.docs.map(d => updateDoc(doc(db, "resources", d.id), { status: "hidden_moderation" })));
      triggerAlert("Template rejected. Any linked meme story has been hidden.");
    } catch (e) {
      triggerAlert(e.message || "Template rejection failed.", "error");
    }
  };

  const handleToggleFeatureTemplate = async (tempId, currentFeatured) => {
    try {
      await updateDoc(doc(db, "templates", tempId), { is_featured: !currentFeatured });
      triggerAlert(`Template featured status updated to ${!currentFeatured ? "featured" : "unfeatured"}.`);
    } catch (e) {
      triggerAlert(e.message || "Failed to toggle featured status.", "error");
    }
  };

  // DIRECT SEED SUBMISSIONS
  const handleDirectSeed = async (e) => {
    e.preventDefault();
    setLoadingAction(true);
    try {
      if (archivistMode === "template") {
        let mediaUrl = tempUrl;
        if (tempFile) {
          const storageRef = ref(storage, `templates/seed_${Date.now()}`);
          const snap = await uploadBytes(storageRef, tempFile);
          mediaUrl = await getDownloadURL(snap.ref);
        }
        await addDoc(collection(db, "templates"), {
          title: tempTitle,
          format: tempFormat,
          media_url: mediaUrl,
          status: "approved",
          creator_id: user.uid,
          created_at: serverTimestamp()
        });
        setTempTitle("");
        setTempUrl("");
        setTempFile(null);
        triggerAlert("System Template seeded directly into Meme Lab catalog.");
      } else if (archivistMode === "meme") {
        let mediaUrl = memeUrl;
        if (memeFile) {
          const storageRef = ref(storage, `memes/seed_${Date.now()}`);
          const snap = await uploadBytes(storageRef, memeFile);
          mediaUrl = await getDownloadURL(snap.ref);
        }
        await addDoc(collection(db, "memes"), {
          title: memeTitle,
          format: memeFormat,
          media_url: mediaUrl,
          subject: memeSubject,
          age_group: memeGrade,
          language: memeLang,
          visibility: "public",
          creator_id: user.uid,
          creator_name: profile.name || "System Admin",
          likes_count: 0,
          ratings_count: 0,
          created_at: serverTimestamp()
        });
        setMemeTitle("");
        setMemeUrl("");
        setMemeFile(null);
        triggerAlert("Finished Meme seeded directly into Meme Library feed.");
      } else if (archivistMode === "resource") {
        let fileUrl = resUrl;
        if (resFile) {
          const storageRef = ref(storage, `resources/seed_${Date.now()}`);
          const snap = await uploadBytes(storageRef, resFile);
          fileUrl = await getDownloadURL(snap.ref);
        }

        let thumbnailUrl = resThumbnailUrl;
        if (resThumbnailFile) {
          const thumbRef = ref(storage, `resources/thumb_seed_${Date.now()}`);
          const snap = await uploadBytes(thumbRef, resThumbnailFile);
          thumbnailUrl = await getDownloadURL(snap.ref);
        }

        const parsedKeywords = resKeywords
          ? resKeywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean)
          : [];

        const resourceData = {
          title: resTitle.trim(),
          type: resType,
          subject: resType === "stories" ? "" : resSubject,
          grade_group: resType === "stories" ? "" : resGrade,
          body: resBody.trim(),
          file_url: fileUrl,
          thumbnail_url: thumbnailUrl,
          keywords: parsedKeywords,
          likes_count: 0,
          status: "approved",
          author_id: user.uid,
          created_at: serverTimestamp()
        };

        if (resType === "article" || resType === "research_paper") {
          resourceData.publication_year = resPublicationYear;
          resourceData.publisher_name = resPublisherName;
        }

        // If it's a meme story, attach story-specific fields
        if (resType === "stories") {
          let extraExampleUrls = [];
          if (resExampleFiles.length > 0) {
            for (let i = 0; i < resExampleFiles.length; i++) {
              const file = resExampleFiles[i];
              if (file) {
                const exRef = ref(storage, `resources/examples_seed_${Date.now()}_${i}`);
                const exSnap = await uploadBytes(exRef, file);
                const exUrl = await getDownloadURL(exSnap.ref);
                extraExampleUrls.push(exUrl);
              }
            }
          }
          resourceData.meme_name = resTitle.trim();
          resourceData.usage_context = resUsageContext.trim();
          resourceData.educational_use = resEducationalUse.trim();
          resourceData.example_images = [
            ...resExampleImages.map(u => u.trim()).filter(Boolean),
            ...extraExampleUrls
          ];
          resourceData.keywords = []; // remove keywords for stories
          resourceData.admin_approved = true; // Admin seeds are auto-approved

          // The attached "customizable" image is meant to double as a Lab
          // template — create the linked `templates` doc so the story
          // actually surfaces there, instead of only living in Meme Stories.
          if (fileUrl) {
            let detectedFormat = "image";
            if (resFile?.type?.startsWith("video/")) detectedFormat = "video";
            else if (resFile?.type?.startsWith("audio/")) detectedFormat = "audio";
            else if (resFile?.type === "image/gif") detectedFormat = "gif";
            const templateDocRef = await addDoc(collection(db, "templates"), {
              title: resTitle.trim(),
              creator_id: user.uid,
              media_url: fileUrl,
              format: detectedFormat,
              is_admin_preset: true,
              status: "approved",
              created_at: serverTimestamp()
            });
            resourceData.template_id = templateDocRef.id;
          }
        }

        await addDoc(collection(db, "resources"), resourceData);
        setResTitle("");
        setResBody("");
        setResUrl("");
        setResFile(null);
        setResPublicationYear("");
        setResPublisherName("");
        setResThumbnailUrl("");
        setResThumbnailFile(null);
        setResKeywords("");
        setResUsageContext("");
        setResExampleImages([""]);
        setResExampleFiles([]);
        setResEducationalUse("");
        triggerAlert("Academic Resource seeded directly into Meme Reads gallery.");
      }
    } catch (e) {
      triggerAlert(e.message || "Seeding failed.", "error");
    } finally {
      setLoadingAction(false);
    }
  };

  // USER MANAGEMENT ACTIONS (Restrained to Admin)
  const handleAddNewUser = async (e) => {
    e.preventDefault();
    if (profile.role !== "admin") return;
    setLoadingAction(true);

    try {
      const generatedId = `usr_${Math.random().toString(36).substring(2, 11)}`;
      const userRef = doc(db, "users", generatedId);
      const statsRef = doc(db, "user_stats", generatedId);
      const contactRef = doc(db, "private_contacts", generatedId);

      await runTransaction(db, async (transaction) => {
        transaction.set(contactRef, { email: newUserEmail, updated_at: serverTimestamp() });
        transaction.set(userRef, {
          id: generatedId,
          name: newUserName,
          role: newUserRole,
          institution: newUserInstitution,
          place: newUserPlace,
          state: newUserState,
          country: newUserCountry,
          id_card_url: "",
          is_verified: newUserRole === "expert" || newUserRole === "admin" || newUserRole === "manager",
          banned: false,
          created_at: serverTimestamp()
        });

        transaction.set(statsRef, {
          memes_created_count: 0,
          resources_contributed_count: 0,
          staffroom_posts_count: 0,
          ratings_provided_count: 0,
          total_likes_received: 0
        });
      });

      setShowAddUserModal(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserInstitution("");
      setNewUserPlace("");
      setNewUserState("");
      setNewUserCountry("");
      triggerAlert(`Created profile record for ${newUserName} in Firestore directory.`);
    } catch (e) {
      triggerAlert(e.message || "Failed to create user profile.", "error");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleToggleBan = async (userId, currentBanned) => {
    if (profile.role !== "admin") return;
    try {
      if (!currentBanned) {
        const reason = window.prompt("Enter reason for user suspension:", "Violation of community rules");
        if (reason === null) return; // User cancelled
        await updateDoc(doc(db, "users", userId), { banned: true, ban_reason: reason || "Violation of community rules" });
        triggerAlert("User account suspended.");
      } else {
        await updateDoc(doc(db, "users", userId), { banned: false });
        await setDoc(doc(db, "unban_requests", userId), { status: "approved", reviewed_at: serverTimestamp() }, { merge: true }).catch(() => {});
        triggerAlert("User suspension revoked.");
      }
    } catch (e) {
      triggerAlert(e.message || "Ban status toggle failed.", "error");
    }
  };

  const handleApproveUnbanRequest = async (userId) => {
    if (profile.role !== "admin") return;
    try {
      await updateDoc(doc(db, "users", userId), { banned: false });
      await setDoc(doc(db, "unban_requests", userId), { status: "approved", reviewed_at: serverTimestamp() }, { merge: true });
      triggerAlert("User unbanned and appeal approved successfully!");
    } catch (e) {
      triggerAlert(e.message || "Failed to approve unban request.", "error");
    }
  };

  const handleRejectUnbanRequest = async (userId) => {
    if (profile.role !== "admin") return;
    try {
      await setDoc(doc(db, "unban_requests", userId), { status: "rejected", reviewed_at: serverTimestamp() }, { merge: true });
      triggerAlert("Unban appeal status updated to rejected.");
    } catch (e) {
      triggerAlert(e.message || "Failed to reject unban request.", "error");
    }
  };

  const handleTriggerPasswordReset = async (email) => {
    if (profile.role !== "admin") return;
    try {
      await sendPasswordResetEmail(auth, email);
      triggerAlert(`Password recovery email triggered to ${email}.`);
    } catch (e) {
      triggerAlert(e.message || "Email trigger failed.", "error");
    }
  };

  const handleDeleteUser = (userId) => {
    if (profile.role !== "admin") return;
    openConfirm({
      title: "Delete User?",
      message: "Permanently delete this user document? This action is irreversible.",
      variant: "danger",
      confirmLabel: "Delete User",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "users", userId));
          await deleteDoc(doc(db, "user_stats", userId));
          triggerAlert("User files permanently purged from database registries.");
        } catch (e) {
          triggerAlert(e.message || "User deletion failed.", "error");
        }
      },
    });
  };

  // MARKETING SUBMISSIONS (Strictly Admin)
  const handleAddAd = async (e) => {
    e.preventDefault();
    if (profile.role !== "admin") return;
    setLoadingAction(true);
    try {
      let imageUrl = adImageUrl;
      if (adImageFile) {
        const storageRef = ref(storage, `sponsored_ads/ad_${Date.now()}`);
        const snap = await uploadBytes(storageRef, adImageFile);
        imageUrl = await getDownloadURL(snap.ref);
      }
      await addDoc(collection(db, "sponsored_ads"), {
        title: adTitle,
        image_url: imageUrl,
        destination_url: adDestUrl,
        is_active: adIsActive,
        created_at: serverTimestamp()
      });
      setAdTitle("");
      setAdImageUrl("");
      setAdImageFile(null);
      setAdDestUrl("");
      triggerAlert("Sponsored Ad placement compiled successfully.");
    } catch (e) {
      triggerAlert(e.message || "Ad submission failed.", "error");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteAd = async (adId) => {
    if (profile.role !== "admin") return;
    try {
      await deleteDoc(doc(db, "sponsored_ads", adId));
      triggerAlert("Sponsored Ad deleted.");
    } catch (e) {
      triggerAlert(e.message || "Failed to delete ad.", "error");
    }
  };

  const handleAddTestimonial = async (e) => {
    e.preventDefault();
    if (profile.role !== "admin") return;
    setLoadingAction(true);
    try {
      let imageUrl = testImageUrl;
      if (testImageFile) {
        const storageRef = ref(storage, `testimonials/test_${Date.now()}`);
        const snap = await uploadBytes(storageRef, testImageFile);
        imageUrl = await getDownloadURL(snap.ref);
      }
      await addDoc(collection(db, "testimonials"), {
        author_name: testAuthor,
        institution: testInst,
        body: testBody,
        image_url: imageUrl,
        is_featured: testIsFeatured,
        created_at: serverTimestamp()
      });
      setTestAuthor("");
      setTestInst("");
      setTestBody("");
      setTestImageUrl("");
      setTestImageFile(null);
      triggerAlert("User review feedback testimonial added.");
    } catch (e) {
      triggerAlert(e.message || "Testimonial compilation failed.", "error");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteTestimonial = async (testId) => {
    if (profile.role !== "admin") return;
    try {
      await deleteDoc(doc(db, "testimonials", testId));
      triggerAlert("Testimonial deleted.");
    } catch (e) {
      triggerAlert(e.message || "Failed to delete testimonial.", "error");
    }
  };

  // SYSTEM TAXONOMY CONFIG ACTIONS (Strictly Admin)
  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (profile.role !== "admin" || !newTaxSubject) return;
    try {
      const currentSubjects = taxonomy.subjects || [];
      if (currentSubjects.includes(newTaxSubject)) {
        triggerAlert("Subject already exists in list.", "error");
        return;
      }
      const updated = [...currentSubjects, newTaxSubject];
      await setDoc(doc(db, "configs", "taxonomy"), { ...taxonomy, subjects: updated }, { merge: true });
      setNewTaxSubject("");
      triggerAlert(`Added ${newTaxSubject} to subject config lists.`);
    } catch (e) {
      triggerAlert(e.message || "Failed to update subjects.", "error");
    }
  };

  const handleRemoveSubject = async (sub) => {
    if (profile.role !== "admin") return;
    try {
      const updated = (taxonomy.subjects || []).filter(item => item !== sub);
      await setDoc(doc(db, "configs", "taxonomy"), { ...taxonomy, subjects: updated }, { merge: true });
      triggerAlert(`Removed ${sub} from configuration catalogs.`);
    } catch (e) {
      triggerAlert(e.message || "Removal failed.", "error");
    }
  };

  const handleAddGrade = async (e) => {
    e.preventDefault();
    if (profile.role !== "admin" || !newTaxGrade) return;
    try {
      const currentGrades = taxonomy.grades || [];
      if (currentGrades.includes(newTaxGrade)) {
        triggerAlert("Grade already exists in list.", "error");
        return;
      }
      const updated = [...currentGrades, newTaxGrade];
      await setDoc(doc(db, "configs", "taxonomy"), { ...taxonomy, grades: updated }, { merge: true });
      setNewTaxGrade("");
      triggerAlert(`Added grade block ${newTaxGrade} to index.`);
    } catch (e) {
      triggerAlert(e.message || "Failed to update grades.", "error");
    }
  };

  const handleRemoveGrade = async (gr) => {
    if (profile.role !== "admin") return;
    try {
      const updated = (taxonomy.grades || []).filter(item => item !== gr);
      await setDoc(doc(db, "configs", "taxonomy"), { ...taxonomy, grades: updated }, { merge: true });
      triggerAlert(`Removed grade ${gr} from catalogs.`);
    } catch (e) {
      triggerAlert(e.message || "Removal failed.", "error");
    }
  };

  const handleAddLanguage = async (e) => {
    e.preventDefault();
    if (profile.role !== "admin" || !newTaxLanguage) return;
    try {
      const currentLanguages = taxonomy.languages || ["English", "Hindi", "Malayalam", "Tamil", "Other"];
      if (currentLanguages.includes(newTaxLanguage)) {
        triggerAlert("Language already exists in list.", "error");
        return;
      }
      let updated = [...currentLanguages];
      const otherIdx = updated.indexOf("Other");
      if (otherIdx !== -1) {
        updated.splice(otherIdx, 0, newTaxLanguage);
      } else {
        updated.push(newTaxLanguage);
      }
      await setDoc(doc(db, "configs", "taxonomy"), { ...taxonomy, languages: updated }, { merge: true });
      setNewTaxLanguage("");
      triggerAlert(`Added language ${newTaxLanguage} to config lists.`);
    } catch (e) {
      triggerAlert(e.message || "Failed to update languages.", "error");
    }
  };

  const handleRemoveLanguage = async (lang) => {
    if (profile.role !== "admin") return;
    try {
      const currentLanguages = taxonomy.languages || ["English", "Hindi", "Malayalam", "Tamil", "Other"];
      const updated = currentLanguages.filter(item => item !== lang);
      await setDoc(doc(db, "configs", "taxonomy"), { ...taxonomy, languages: updated }, { merge: true });
      triggerAlert(`Removed language ${lang} from configuration catalogs.`);
    } catch (e) {
      triggerAlert(e.message || "Removal failed.", "error");
    }
  };

  const handleAddToolSection = async (e) => {
    e.preventDefault();
    if (profile.role !== "admin" || !newTaxToolSection.trim()) return;
    const cleanSection = newTaxToolSection.trim();
    try {
      const currentSections = taxonomy.tool_sections || DEFAULT_TOOL_SECTIONS;
      if (currentSections.includes(cleanSection)) {
        triggerAlert("Section already exists in list.", "error");
        return;
      }
      const updated = [...currentSections, cleanSection];
      await setDoc(doc(db, "configs", "taxonomy"), { ...taxonomy, tool_sections: updated }, { merge: true });
      setNewTaxToolSection("");
      triggerAlert(`Added tool section "${cleanSection}" to catalogs.`);
    } catch (e) {
      triggerAlert(e.message || "Failed to update tool sections.", "error");
    }
  };

  const handleRemoveToolSection = async (sectionName) => {
    if (profile.role !== "admin") return;
    try {
      const currentSections = taxonomy.tool_sections || DEFAULT_TOOL_SECTIONS;
      const updated = currentSections.filter(item => item !== sectionName);
      await setDoc(doc(db, "configs", "taxonomy"), { ...taxonomy, tool_sections: updated }, { merge: true });
      triggerAlert(`Removed section "${sectionName}" from catalogs.`);
    } catch (e) {
      triggerAlert(e.message || "Removal failed.", "error");
    }
  };

  // MANUAL STAFFROOM MEDIA PRUNING OVERRIDE — deletes real Storage files older than 30 days
  const handleManualPruningOverride = async () => {
    if (profile.role !== "admin") return;
    setLoadingAction(true);
    try {
      const cutoffSeconds = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
      let prunedCount = 0;
      let spaceSavedMb = 0;

      // Query posts with a real attachment storage path
      const snap = await getDocs(
        query(collection(db, "staffroom_posts"), where("attachment_storage_path", "!=", ""))
      );

      for (const postDoc of snap.docs) {
        const data = postDoc.data();
        const postAge = data.created_at?.seconds || 0;
        if (postAge < cutoffSeconds && data.attachment_storage_path) {
          try {
            // Delete from Firebase Storage
            const fileRef = ref(storage, data.attachment_storage_path);
            await deleteObject(fileRef);
            // Clear the attachment fields on the post (keep text)
            await updateDoc(postDoc.ref, {
              attachment_url: "",
              attachment_storage_path: "",
              attachment_name: data.attachment_name + " (pruned)"
            });
            prunedCount++;
            spaceSavedMb += 1.2; // estimate per file
          } catch (fileErr) {
            console.warn("Could not prune file:", data.attachment_storage_path, fileErr);
          }
        }
      }

      const logsRef = doc(db, "configs", "pruning");
      await setDoc(logsRef, {
        pruned_count: (pruningLog.pruned_count || 0) + prunedCount,
        space_saved_mb: Math.round(((pruningLog.space_saved_mb || 0) + spaceSavedMb) * 10) / 10,
        last_pruned_at: serverTimestamp()
      });

      triggerAlert(
        prunedCount > 0
          ? `Pruning complete! Deleted ${prunedCount} expired attachments (~${spaceSavedMb.toFixed(1)} MB freed).`
          : "No attachments older than 30 days found. Storage is clean."
      );
    } catch (e) {
      triggerAlert(e.message || "Manual pruning cleanup failed.", "error");
    } finally {
      setLoadingAction(false);
    }
  };

  // DELETE STAFFROOM ATTACHMENT — admin one-off removal
  const handleDeleteAttachment = (postId, storagePath, attachmentName) => {
    openConfirm({
      title: "Delete Attachment?",
      message: `Permanently delete "${attachmentName}" from storage? The post text will remain.`,
      variant: "danger",
      confirmLabel: "Delete File",
      onConfirm: async () => {
        closeConfirm();
        try {
          if (storagePath) {
            const fileRef = ref(storage, storagePath);
            await deleteObject(fileRef);
          }
          await updateDoc(doc(db, "staffroom_posts", postId), {
            attachment_url: "",
            attachment_storage_path: "",
            attachment_name: attachmentName + " (deleted by admin)"
          });
          triggerAlert("Attachment deleted from storage successfully.");
        } catch (e) {
          triggerAlert(e.message || "Failed to delete attachment.", "error");
        }
      },
    });
  };

  // ─── CONTENT MANAGER ACTIONS (Admin Universal Authority) ─────────────────────

  // Toggle meme visibility: public ↔ admin_hidden
  const handleAdminToggleMemeVisibility = (memeId, currentVisibility) => {
    const newVisibility = currentVisibility === "admin_hidden" ? "public" : "admin_hidden";
    const willHide = newVisibility === "admin_hidden";
    openConfirm({
      title: willHide ? "Hide Meme?" : "Restore Meme?",
      message: willHide
        ? "This will suppress the meme from the public Library feed. You can reverse this at any time."
        : "This will restore the meme to the public Library feed.",
      variant: willHide ? "danger" : "success",
      confirmLabel: willHide ? "Hide Meme" : "Restore to Public",
      onConfirm: async () => {
        closeConfirm();
        try {
          await updateDoc(doc(db, "memes", memeId), { visibility: newVisibility });
          triggerAlert(`Meme ${willHide ? "hidden from" : "restored to"} public Library.`);
        } catch (e) {
          triggerAlert(e.message || "Failed to update meme visibility.", "error");
        }
      },
    });
  };

  // Hard delete a meme from Firestore
  const handleAdminDeleteMeme = (memeId, memeTitle) => {
    openConfirm({
      title: "Permanently Delete Meme?",
      message: `Delete "${memeTitle}"? This action is irreversible and removes the meme from all feeds permanently.`,
      variant: "danger",
      confirmLabel: "Delete Permanently",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "memes", memeId));
          triggerAlert("Meme permanently removed from database.");
        } catch (e) {
          triggerAlert(e.message || "Meme deletion failed.", "error");
        }
      },
    });
  };

  // Toggle resource visibility: approved ↔ admin_hidden
  const handleAdminToggleResourceVisibility = (resourceId, currentStatus) => {
    const newStatus = currentStatus === "admin_hidden" ? "approved" : "admin_hidden";
    const willHide = newStatus === "admin_hidden";
    openConfirm({
      title: willHide ? "Hide Resource?" : "Restore Resource?",
      message: willHide
        ? "This will suppress the resource from Meme Reads. You can restore it at any time."
        : "This will restore the resource to the Meme Reads gallery.",
      variant: willHide ? "danger" : "success",
      confirmLabel: willHide ? "Hide Resource" : "Restore",
      onConfirm: async () => {
        closeConfirm();
        try {
          await updateDoc(doc(db, "resources", resourceId), { status: newStatus });
          triggerAlert(`Resource ${willHide ? "hidden from" : "restored to"} public gallery.`);
        } catch (e) {
          triggerAlert(e.message || "Failed to update resource status.", "error");
        }
      },
    });
  };

  // Hard delete a template document (permanent, unlike handleRejectTemplate which only changes status)
  const handleAdminHardDeleteTemplate = (templateId, templateTitle) => {
    openConfirm({
      title: "Permanently Delete Template?",
      message: `Delete "${templateTitle}"? This completely removes the template from the Meme Lab catalog and cannot be undone.`,
      variant: "danger",
      confirmLabel: "Delete Template",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "templates", templateId));
          triggerAlert("Template permanently removed from Meme Lab catalog.");
        } catch (e) {
          triggerAlert(e.message || "Template deletion failed.", "error");
        }
      },
    });
  };

  // Toggle staffroom post visibility: (no visibility field) ↔ admin_hidden
  const handleAdminTogglePostVisibility = (postId, currentVisibility) => {
    const newVisibility = currentVisibility === "admin_hidden" ? "" : "admin_hidden";
    const willHide = newVisibility === "admin_hidden";
    openConfirm({
      title: willHide ? "Hide Post?" : "Restore Post?",
      message: willHide
        ? "This will suppress the post from the Staffroom feed. You can restore it at any time."
        : "This will restore the post to the Staffroom feed.",
      variant: willHide ? "danger" : "success",
      confirmLabel: willHide ? "Hide Post" : "Restore Post",
      onConfirm: async () => {
        closeConfirm();
        try {
          await updateDoc(doc(db, "staffroom_posts", postId), { visibility: newVisibility });
          triggerAlert(`Post ${willHide ? "hidden from" : "restored to"} Staffroom.`);
        } catch (e) {
          triggerAlert(e.message || "Failed to update post visibility.", "error");
        }
      },
    });
  };

  // Hard delete a staffroom post
  const handleAdminDeletePost = (postId, postLabel) => {
    openConfirm({
      title: "Delete Staffroom Post?",
      message: `Permanently delete "${postLabel}"? This removes the thread. Existing replies will be orphaned.`,
      variant: "danger",
      confirmLabel: "Delete Post",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "staffroom_posts", postId));
          triggerAlert("Staffroom post permanently deleted.");
        } catch (e) {
          triggerAlert(e.message || "Post deletion failed.", "error");
        }
      },
    });
  };

  // Hard delete a staffroom reply
  const handleAdminDeleteReply = (replyId) => {
    openConfirm({
      title: "Delete Reply?",
      message: "Permanently delete this reply? This action cannot be undone.",
      variant: "danger",
      confirmLabel: "Delete Reply",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "staffroom_replies", replyId));
          triggerAlert("Reply deleted successfully.");
        } catch (e) {
          triggerAlert(e.message || "Reply deletion failed.", "error");
        }
      },
    });
  };

  // ─── BULK DELETE HANDLERS (Content Manager) ────────────────────────────────

  const handleBulkDeleteMemes = (ids) => {
    if (!ids.length) return;
    openConfirm({
      title: `Delete ${ids.length} Meme${ids.length > 1 ? "s" : ""}?`,
      message: `Permanently delete ${ids.length} selected meme${ids.length > 1 ? "s" : ""}? This action is irreversible.`,
      variant: "danger",
      confirmLabel: `Delete ${ids.length} Meme${ids.length > 1 ? "s" : ""}`,
      onConfirm: async () => {
        closeConfirm();
        try {
          await Promise.all(ids.map(id => deleteDoc(doc(db, "memes", id))));
          setCmMemeSelected(new Set());
          triggerAlert(`${ids.length} meme${ids.length > 1 ? "s" : ""} permanently deleted.`);
        } catch (e) {
          triggerAlert(e.message || "Bulk meme deletion failed.", "error");
        }
      },
    });
  };

  const handleBulkDeleteResources = (ids) => {
    if (!ids.length) return;
    openConfirm({
      title: `Delete ${ids.length} Resource${ids.length > 1 ? "s" : ""}?`,
      message: `Permanently delete ${ids.length} selected resource${ids.length > 1 ? "s" : ""}? This action is irreversible.`,
      variant: "danger",
      confirmLabel: `Delete ${ids.length} Resource${ids.length > 1 ? "s" : ""}`,
      onConfirm: async () => {
        closeConfirm();
        try {
          await Promise.all(ids.map(id => deleteDoc(doc(db, "resources", id))));
          setCmResSelected(new Set());
          triggerAlert(`${ids.length} resource${ids.length > 1 ? "s" : ""} permanently deleted.`);
        } catch (e) {
          triggerAlert(e.message || "Bulk resource deletion failed.", "error");
        }
      },
    });
  };

  const handleBulkDeletePosts = (ids) => {
    if (!ids.length) return;
    openConfirm({
      title: `Delete ${ids.length} Post${ids.length > 1 ? "s" : ""}?`,
      message: `Permanently delete ${ids.length} selected staffroom post${ids.length > 1 ? "s" : ""}? This action is irreversible.`,
      variant: "danger",
      confirmLabel: `Delete ${ids.length} Post${ids.length > 1 ? "s" : ""}`,
      onConfirm: async () => {
        closeConfirm();
        try {
          await Promise.all(ids.map(id => deleteDoc(doc(db, "staffroom_posts", id))));
          setCmPostSelected(new Set());
          triggerAlert(`${ids.length} post${ids.length > 1 ? "s" : ""} permanently deleted.`);
        } catch (e) {
          triggerAlert(e.message || "Bulk post deletion failed.", "error");
        }
      },
    });
  };

  const handleBulkDeleteTemplates = (ids) => {
    if (!ids.length) return;
    openConfirm({
      title: `Delete ${ids.length} Template${ids.length > 1 ? "s" : ""}?`,
      message: `Permanently delete ${ids.length} selected template${ids.length > 1 ? "s" : ""}? This action is irreversible.`,
      variant: "danger",
      confirmLabel: `Delete ${ids.length} Template${ids.length > 1 ? "s" : ""}`,
      onConfirm: async () => {
        closeConfirm();
        try {
          await Promise.all(ids.map(id => deleteDoc(doc(db, "templates", id))));
          setCmTplSelected(new Set());
          triggerAlert(`${ids.length} template${ids.length > 1 ? "s" : ""} permanently deleted.`);
        } catch (e) {
          triggerAlert(e.message || "Bulk template deletion failed.", "error");
        }
      },
    });
  };

  // SEED TEST DATA ACTION
  const handleSeedTestData = async () => {
    if (profile.role !== "admin") return;
    setIsSeeding(true);
    try {
      const mockTemplates = [
        {
          title: "Physics: Centripetal Force vs Inertia Breakdown",
          format: "image",
          media_url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=600&q=80",
          status: "approved",
          creator_id: user.uid,
          is_placeholder: true,
          created_at: serverTimestamp()
        },
        {
          title: "Computer Science: Fetch-Decode-Execute Cycle Loop",
          format: "gif",
          media_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80",
          status: "approved",
          creator_id: user.uid,
          is_placeholder: true,
          created_at: serverTimestamp()
        }
      ];

      const mockMemes = [
        {
          title: "Chemistry: Valency Shell Octet Configuration Mock",
          format: "image",
          media_url: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=600&q=80",
          subject: "Chemistry",
          age_group: "High School (9–10)",
          language: "English",
          visibility: "public",
          creator_id: user.uid,
          creator_name: profile.name || "Guest Developer",
          likes_count: 12,
          ratings_count: 4,
          is_placeholder: true,
          created_at: serverTimestamp()
        },
        {
          title: "Mathematics: The Fibonacci Spiral Proportion Meme",
          format: "image",
          media_url: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=600&q=80",
          subject: "Maths",
          age_group: "Middle School (6–8)",
          language: "English",
          visibility: "public",
          creator_id: user.uid,
          creator_name: profile.name || "Guest Developer",
          likes_count: 8,
          ratings_count: 2,
          is_placeholder: true,
          created_at: serverTimestamp()
        }
      ];

      const mockExternalLinks = [
        {
          title: "OER Commons High School Physics Lab Guides",
          description: "Open educational resources index detailing hands-on kinematics activities, vector coordinates, and centripetal acceleration templates.",
          destination_url: "https://www.oercommons.org/hubs/physics",
          image_url: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=600&q=80",
          contributor_id: user.uid,
          admin_approved: true,
          is_placeholder: true,
          created_at: serverTimestamp()
        },
        {
          title: "Merlot II Computer Fundamentals Tutorials Reference",
          description: "Peer-reviewed OER collection spanning binary numbers conversion, hardware systems, logic gates, and processor architectures.",
          destination_url: "https://www.merlot.org/merlot/index.htm",
          image_url: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80",
          contributor_id: user.uid,
          admin_approved: true,
          is_placeholder: true,
          created_at: serverTimestamp()
        },
        {
          title: "PhET Interactive Chemistry Simulations Toolkit",
          description: "Freely accessible HTML5 atomic structure simulations supporting student hypothesis testing and OER activity sheets.",
          destination_url: "https://phet.colorado.edu/",
          image_url: "https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?auto=format&fit=crop&w=600&q=80",
          contributor_id: user.uid,
          admin_approved: true,
          is_placeholder: true,
          created_at: serverTimestamp()
        }
      ];

      // Seed templates
      for (const t of mockTemplates) {
        await addDoc(collection(db, "templates"), t);
      }

      // Seed memes
      for (const m of mockMemes) {
        await addDoc(collection(db, "memes"), m);
      }

      // Seed external links
      for (const el of mockExternalLinks) {
        await addDoc(collection(db, "external_links"), el);
      }

      triggerAlert("Sandbox Test Data seeded successfully! Staged 7 placeholder documents.");
    } catch (e) {
      triggerAlert(e.message || "Failed to seed test data.", "error");
    } finally {
      setIsSeeding(false);
    }
  };

  // WIPE PLACEHOLDER DATA ACTION
  const handleWipePlaceholderData = async () => {
    if (profile.role !== "admin") return;
    setIsWiping(true);
    try {
      let count = 0;

      // Wipe templates
      const templatesSnap = await getDocs(query(collection(db, "templates"), where("is_placeholder", "==", true)));
      for (const d of templatesSnap.docs) {
        await deleteDoc(d.ref);
        count++;
      }

      // Wipe memes
      const memesSnap = await getDocs(query(collection(db, "memes"), where("is_placeholder", "==", true)));
      for (const d of memesSnap.docs) {
        await deleteDoc(d.ref);
        count++;
      }

      // Wipe external links
      const linksSnap = await getDocs(query(collection(db, "external_links"), where("is_placeholder", "==", true)));
      for (const d of linksSnap.docs) {
        await deleteDoc(d.ref);
        count++;
      }

      triggerAlert(`Wipe complete! Removed ${count} placeholder documents from Firestore collections.`);
    } catch (e) {
      triggerAlert(e.message || "Failed to wipe placeholder data.", "error");
    } finally {
      setIsWiping(false);
    }
  };

  // CLEAR ALL NEWSPAPER ITEMS ACTION
  const handleClearAllNewspaperItems = () => {
    if (profile.role !== "admin") return;
    openConfirm({
      title: "Clear All Newspaper Items?",
      message: "Permanently delete every item in the Newspaper feed (auto-fetched, admin-added, and user-contributed). This cannot be undone.",
      variant: "danger",
      confirmLabel: "Delete All",
      onConfirm: async () => {
        closeConfirm();
        setIsClearingNewspaper(true);
        try {
          const snap = await getDocs(collection(db, "newspaper_items"));
          for (const d of snap.docs) {
            await deleteDoc(d.ref);
          }
          triggerAlert(`Cleared ${snap.docs.length} newspaper item(s).`);
        } catch (e) {
          triggerAlert(e.message || "Failed to clear newspaper items.", "error");
        } finally {
          setIsClearingNewspaper(false);
        }
      },
    });
  };

  // UDL Styling classes
  const containerClass = highContrastMode
    ? "bg-zinc-900 border border-zinc-800 text-white shadow-sm rounded-xl"
    : "bg-white border border-gray-200 shadow-sm rounded-xl";

  const bannerClass = highContrastMode
    ? "bg-zinc-900 border border-zinc-800 text-zinc-300 p-5 rounded-xl text-xs font-semibold leading-relaxed"
    : "bg-purple-50 text-purple-750 border border-purple-200 p-5 rounded-xl text-xs font-semibold leading-relaxed";

  const headerCellClass = highContrastMode
    ? "bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-extrabold uppercase text-[10px] p-3 text-left"
    : "bg-gray-100 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] p-3 text-left";

  const rowCellClass = highContrastMode
    ? "border-b border-zinc-800 p-3 text-white bg-zinc-900 text-xs font-medium"
    : "border-b border-gray-150 p-3 text-gray-700 text-xs";

  const inputClass = highContrastMode
    ? "w-full p-2 border border-zinc-800 bg-zinc-950 rounded-lg text-xs text-white placeholder-zinc-500 outline-none"
    : "w-full p-2 border border-gray-300 bg-gray-50 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-500";

  const btnClass = (customColor = "purple") => {
    const colorMap = {
      purple: "bg-purple-600 hover:bg-purple-700 text-white",
      red: "bg-red-600 hover:bg-red-700 text-white",
      indigo: "bg-indigo-600 hover:bg-indigo-700 text-white",
      green: "bg-green-600 hover:bg-green-700 text-white",
      gray: "bg-gray-100 hover:bg-gray-200 text-gray-700"
    };
    if (highContrastMode) {
      colorMap.gray = "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700";
    }
    return `${colorMap[customColor]} font-bold px-3.5 py-1.5 rounded-lg text-xs transition shadow-sm`;
  };

  // Filter users list based on search/role
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      contactEmailsById[u.id]?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter ? u.role === userRoleFilter : true;
    return matchesSearch && matchesRole;
  });

  // ─── Literacy Tests CRUD Handlers ────────────────────────────────────────────

  const ltResetTestForm = () => {
    setLtfTitle(""); setLtfDesc(""); setLtfDifficulty("beginner");
    setLtfCategory(""); setLtfBadgeIcon("🏅"); setLtfBadgeLabel("");
    setLtfPassThreshold(60); setLtfIsActive(true);
  };
  const ltResetQuestionForm = () => {
    setLtqEditId(null); setLtqText(""); setLtqDimension("");
    setLtqOptions(["", "", "", ""]); setLtqCorrectIdx(0);
    setLtqExplanation(""); setLtqMemeUrl(""); setLtqMemeFile(null); setLtqOrder(0);
  };

  const handleLtSaveTest = async (editId = null) => {
    if (!ltfTitle.trim()) { triggerAlert("Test title is required.", "error"); return; }
    setLtSaving(true);
    try {
      const data = {
        title: ltfTitle.trim(), description: ltfDesc.trim(),
        difficulty: ltfDifficulty, category: ltfCategory.trim(),
        badge_icon: ltfBadgeIcon, badge_label: ltfBadgeLabel.trim(),
        pass_threshold: Number(ltfPassThreshold), is_active: ltfIsActive,
        updated_at: serverTimestamp(),
      };
      if (editId) {
        await updateDoc(doc(db, "literacy_tests", editId), data);
        triggerAlert("Test updated successfully.");
      } else {
        await addDoc(collection(db, "literacy_tests"), { ...data, question_count: 0, created_at: serverTimestamp(), created_by: user.uid });
        triggerAlert("New test created!");
      }
      ltResetTestForm();
      setLtView("list");
    } catch (e) { triggerAlert(e.message || "Save failed.", "error"); }
    finally { setLtSaving(false); }
  };

  const handleLtDeleteTest = (testId, testTitle) => {
    openConfirm({
      title: "Delete Test?",
      message: `Permanently delete "${testTitle}"? All questions for this test will also be deleted.`,
      variant: "danger", confirmLabel: "Delete Test",
      onConfirm: async () => {
        closeConfirm();
        try {
          // Delete all questions for this test first
          const qSnap = await getDocs(query(collection(db, "literacy_test_questions"), where("test_id", "==", testId)));
          await Promise.all(qSnap.docs.map(d => deleteDoc(d.ref)));
          await deleteDoc(doc(db, "literacy_tests", testId));
          triggerAlert("Test and all its questions deleted.");
          if (ltActiveTestId === testId) { setLtActiveTestId(null); setLtView("list"); }
        } catch (e) { triggerAlert(e.message || "Delete failed.", "error"); }
      }
    });
  };

  const handleLtSaveQuestion = async () => {
    if (!ltqText.trim() || ltqOptions.some(o => !o.trim())) {
      triggerAlert("Question text and all 4 options are required.", "error"); return;
    }
    if (!ltActiveTestId) { triggerAlert("No test selected.", "error"); return; }
    setLtSaving(true);
    try {
      let memeImageUrl = ltqMemeUrl;
      if (ltqMemeFile) {
        const storageRef = ref(storage, `literacy_test_memes/${ltActiveTestId}/${ltqEditId || Date.now()}`);
        const snap = await uploadBytes(storageRef, ltqMemeFile);
        memeImageUrl = await getDownloadURL(snap.ref);
      }
      const data = {
        test_id: ltActiveTestId,
        question_text: ltqText.trim(),
        dimension: ltqDimension.trim(),
        options: ltqOptions.map(o => o.trim()),
        correct_index: ltqCorrectIdx,
        explanation: ltqExplanation.trim(),
        meme_image_url: memeImageUrl,
        order: Number(ltqOrder),
        updated_at: serverTimestamp(),
      };
      if (ltqEditId) {
        await updateDoc(doc(db, "literacy_test_questions", ltqEditId), data);
        triggerAlert("Question updated.");
      } else {
        await addDoc(collection(db, "literacy_test_questions"), { ...data, created_at: serverTimestamp() });
        // Increment question_count on parent test
        const qCount = literacyQuestions.filter(q => q.test_id === ltActiveTestId).length + 1;
        await updateDoc(doc(db, "literacy_tests", ltActiveTestId), { question_count: qCount });
        triggerAlert("Question added!");
      }
      ltResetQuestionForm();
      setLtView("questions");
    } catch (e) { triggerAlert(e.message || "Save failed.", "error"); }
    finally { setLtSaving(false); }
  };

  const handleLtDeleteQuestion = (qId) => {
    openConfirm({
      title: "Delete Question?",
      message: "Permanently delete this question from the test?",
      variant: "danger", confirmLabel: "Delete",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "literacy_test_questions", qId));
          const qCount = Math.max(0, literacyQuestions.filter(q => q.test_id === ltActiveTestId).length - 1);
          if (ltActiveTestId) await updateDoc(doc(db, "literacy_tests", ltActiveTestId), { question_count: qCount });
          triggerAlert("Question deleted.");
        } catch (e) { triggerAlert(e.message || "Delete failed.", "error"); }
      }
    });
  };

  const handleLtEditTestPrefill = (test) => {
    setLtfTitle(test.title || ""); setLtfDesc(test.description || "");
    setLtfDifficulty(test.difficulty || "beginner"); setLtfCategory(test.category || "");
    setLtfBadgeIcon(test.badge_icon || "🏅"); setLtfBadgeLabel(test.badge_label || "");
    setLtfPassThreshold(test.pass_threshold ?? 60); setLtfIsActive(test.is_active !== false);
    setLtView("edit_test"); setLtActiveTestId(test.id);
  };

  const handleLtEditQuestionPrefill = (q) => {
    setLtqEditId(q.id); setLtqText(q.question_text || "");
    setLtqDimension(q.dimension || ""); setLtqOptions(q.options?.length === 4 ? q.options : ["", "", "", ""]);
    setLtqCorrectIdx(q.correct_index ?? 0); setLtqExplanation(q.explanation || "");
    setLtqMemeUrl(q.meme_image_url || ""); setLtqMemeFile(null); setLtqOrder(q.order ?? 0);
    setLtView("edit_question");
  };

  // ─── Slang Decoder Quiz — Question Bank CRUD ──────────────────────────────
  const sqResetForm = () => {
    setSqEditId(null); setSqText(""); setSqCategory("genz");
    setSqOptions(["", "", "", ""]); setSqCorrectIdx(0);
    setSqExplanation(""); setSqIsActive(true);
  };

  const handleSqSaveQuestion = async () => {
    if (!sqText.trim() || sqOptions.some(o => !o.trim())) {
      triggerAlert("Question text and all 4 options are required.", "error"); return;
    }
    setSqSaving(true);
    try {
      const data = {
        question_text: sqText.trim(),
        category: sqCategory,
        options: sqOptions.map(o => o.trim()),
        correct_index: sqCorrectIdx,
        explanation: sqExplanation.trim(),
        is_active: sqIsActive,
        updated_at: serverTimestamp(),
      };
      if (sqEditId) {
        await updateDoc(doc(db, "slang_quiz_questions", sqEditId), data);
        triggerAlert("Question updated.");
      } else {
        await addDoc(collection(db, "slang_quiz_questions"), { ...data, created_at: serverTimestamp() });
        triggerAlert("Question added to the Slang Decoder quiz bank!");
      }
      sqResetForm();
      setSqView("list");
    } catch (e) { triggerAlert(e.message || "Save failed.", "error"); }
    finally { setSqSaving(false); }
  };

  const handleSqDeleteQuestion = (qId) => {
    openConfirm({
      title: "Delete Question?",
      message: "Permanently delete this question from the Slang Decoder quiz bank?",
      variant: "danger", confirmLabel: "Delete",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "slang_quiz_questions", qId));
          triggerAlert("Question deleted.");
        } catch (e) { triggerAlert(e.message || "Delete failed.", "error"); }
      }
    });
  };

  const handleSqEditPrefill = (q) => {
    setSqEditId(q.id); setSqText(q.question_text || "");
    setSqCategory(q.category || "genz");
    setSqOptions(q.options?.length === 4 ? q.options : ["", "", "", ""]);
    setSqCorrectIdx(q.correct_index ?? 0); setSqExplanation(q.explanation || "");
    setSqIsActive(q.is_active !== false);
    setSqView("form");
  };

  // ─── Slang Decoder — edit an already-uploaded word & manage its memes ────
  const stResetForm = () => {
    setStEditId(null); setStTerm(""); setStCategory("genz");
    setStDefinition(""); setStExampleUsage("");
    setStLinks([{ title: "", url: "" }]);
    setStExistingMemeUrls([]); setStNewMemeFiles([]); setStNewMemePreviews([]);
  };

  const handleStEditPrefill = (t) => {
    setStEditId(t.id); setStTerm(t.term || ""); setStCategory(t.category || "genz");
    setStDefinition(t.definition || ""); setStExampleUsage(t.example_usage || "");
    setStLinks(Array.isArray(t.related_links) && t.related_links.length > 0 ? t.related_links : [{ title: "", url: "" }]);
    setStExistingMemeUrls(Array.isArray(t.meme_image_urls) ? t.meme_image_urls : []);
    setStNewMemeFiles([]); setStNewMemePreviews([]);
    setStView("form");
  };

  const handleStAddNewMemeFiles = (fileList) => {
    const files = Array.from(fileList || []).slice(0, 4);
    setStNewMemeFiles(files);
    setStNewMemePreviews(files.map(f => URL.createObjectURL(f)));
  };

  const handleStRemoveExistingMeme = (idx) => {
    setStExistingMemeUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const handleStSaveTerm = async () => {
    if (!stTerm.trim() || !stDefinition.trim()) {
      triggerAlert("Term and definition are required.", "error"); return;
    }
    setStSaving(true);
    try {
      const uploadedUrls = [];
      for (let i = 0; i < stNewMemeFiles.length; i++) {
        const memeRef = ref(storage, `slang_memes/admin_${stEditId || Date.now()}_${i}`);
        const snap = await uploadBytes(memeRef, stNewMemeFiles[i]);
        uploadedUrls.push(await getDownloadURL(snap.ref));
      }
      const relatedLinks = stLinks.map(l => ({ title: l.title.trim(), url: l.url.trim() })).filter(l => l.url);
      const data = {
        term: stTerm.trim(),
        category: stCategory,
        definition: stDefinition.trim(),
        example_usage: stExampleUsage.trim(),
        related_links: relatedLinks,
        meme_image_urls: [...stExistingMemeUrls, ...uploadedUrls],
        updated_at: serverTimestamp(),
      };
      if (stEditId) {
        await updateDoc(doc(db, "slang_terms", stEditId), data);
        triggerAlert("Word updated.");
      } else {
        await addDoc(collection(db, "slang_terms"), {
          ...data,
          status: "approved",
          admin_approved: true,
          contributor_id: user.uid,
          contributor_name: "Admin",
          likes_count: 0,
          created_at: serverTimestamp(),
        });
        triggerAlert("Word added and published!");
      }
      stResetForm();
      setStView("list");
    } catch (e) { triggerAlert(e.message || "Save failed.", "error"); }
    finally { setStSaving(false); }
  };

  const handleDeleteSlangTermAdmin = (termId, term) => {
    openConfirm({
      title: "Delete Slang Word?",
      message: `Permanently delete "${term}"? This cannot be undone.`,
      variant: "danger",
      confirmLabel: "Delete",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "slang_terms", termId));
          triggerAlert("Slang word deleted.");
        } catch (e) { triggerAlert(e.message || "Delete failed.", "error"); }
      },
    });
  };

  // The bundled starter dictionary (~30 words shown by default in the
  // Slang Decoder) ships as local JS data, not Firestore docs — so until
  // seeded, there's nothing here for admins to edit or attach memes to.
  // This imports them into `slang_terms` (same idea as Seed Starter Test
  // for literacy questions), after which they behave like any other word.
  const handleSeedStarterWords = async () => {
    setStSaving(true);
    try {
      const existingTermsLower = new Set(slangTerms.map(t => (t.term || "").trim().toLowerCase()));
      const toSeed = SLANG_STARTER_WORDS.filter(w => !existingTermsLower.has(w.term.trim().toLowerCase()));

      if (toSeed.length === 0) {
        triggerAlert("Starter words are already seeded — edit them from the list below.");
        return;
      }

      await Promise.all(toSeed.map(w => addDoc(collection(db, "slang_terms"), {
        term: w.term,
        category: w.category,
        definition: w.definition,
        example_usage: w.example_usage || "",
        related_links: w.related_links || [],
        meme_image_urls: w.meme_image_urls || [],
        status: "approved",
        admin_approved: true,
        contributor_id: user?.uid || "admin",
        contributor_name: "Admin (Starter Set)",
        is_starter_seed: true,
        likes_count: 0,
        created_at: serverTimestamp(),
      })));

      triggerAlert(`🌱 Imported ${toSeed.length} starter word(s) — you can now edit them or add meme images below.`);
    } catch (e) {
      console.error(e);
      triggerAlert(e.message || "Failed to seed starter words.", "error");
    } finally {
      setStSaving(false);
    }
  };

  const handleSeedStarterTest = async () => {
    setLtSaving(true);
    try {
      // Check if starter test already exists in database
      const existingStarter = literacyTests.find(t => t.title?.toLowerCase().includes("starter") || t.is_starter_test);
      if (existingStarter) {
        setLtActiveTestId(existingStarter.id);
        setLtView("questions");
        triggerAlert("Starter test already exists in database! Opening its questions for editing.");
        setLtSaving(false);
        return;
      }

      // Create test document
      const testData = {
        title: "Meme Literacy Starter",
        description: "New to meme literacy? Start here. 15 simple questions that cover the basics — what memes mean, why people share them, and how to spot when they might be misleading.",
        difficulty: "beginner",
        category: "Foundations",
        badge_icon: "🌱",
        badge_label: "Meme Starter",
        pass_threshold: 60,
        is_active: true,
        is_starter_test: true,
        question_count: basicQuestions.length,
        created_at: serverTimestamp(),
        created_by: user?.uid || "admin",
      };
      const testRef = await addDoc(collection(db, "literacy_tests"), testData);

      // Create all 15 basic questions in Firestore
      const promises = basicQuestions.map((q, i) => {
        return addDoc(collection(db, "literacy_test_questions"), {
          test_id: testRef.id,
          question_text: q.question,
          dimension: q.dimension || "General",
          options: q.options,
          correct_index: q.correctIndex,
          explanation: q.explanation || "",
          meme_image_url: q.memeUrl || "",
          order: i,
          created_at: serverTimestamp(),
        });
      });
      await Promise.all(promises);
      setLtActiveTestId(testRef.id);
      setLtView("questions");
      triggerAlert("🌱 Starter Meme Literacy Test imported to database! You can now edit any question, image, or answer.");
    } catch (e) {
      console.error(e);
      triggerAlert(e.message || "Failed to seed starter test.", "error");
    } finally {
      setLtSaving(false);
    }
  };

  // Small helper: fetches the private verification doc and shows a link
  const ViewIdCardButton = ({ userId }) => {
    const [url, setUrl] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const handleFetch = async () => {
      if (url) { window.open(url, "_blank"); return; }
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "users", userId, "private", "verification"));
        if (snap.exists() && snap.data().id_card_url) {
          const fetchedUrl = snap.data().id_card_url;
          setUrl(fetchedUrl);
          window.open(fetchedUrl, "_blank");
        } else {
          alert("ID card not found in storage.");
        }
      } catch (e) {
        alert("Failed to fetch ID card: " + e.message);
      } finally {
        setLoading(false);
      }
    };
    return (
      <button
        onClick={handleFetch}
        disabled={loading}
        className="text-indigo-600 dark:text-indigo-400 hover:underline text-[10px] font-bold disabled:opacity-50"
      >
        {loading ? "Loading…" : url ? "View ↗" : "Fetch & View ↗"}
      </button>
    );
  };

  // Templates that a live (non-hidden) meme story links to — the only
  // templates the intended workflow considers "reviewed" and intentional.
  // Anything outside this set is either awaiting a story or was added
  // outside that pipeline (e.g. earlier unreviewed seeding).
  const storyTemplateIds = new Set(
    resources.filter(isStoryResource).map((r) => r.template_id)
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      {/* Confirm dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-purple-650 dark:text-purple-400">
            Administrative Operations HQ
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Dashboard management console for roles: <span className="capitalize font-bold text-gray-800 dark:text-gray-200">{profile?.role}</span>
          </p>
        </div>
      </div>

      {/* Alert Notifications */}
      {alertMsg && (
        <div className={`p-4 rounded-xl border flex items-center space-x-2 text-xs font-bold ${alertType === "error"
            ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900 dark:text-red-300"
            : "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-900 dark:text-green-300"
          }`}>
          {alertType === "error" ? <AlertCircle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
          <span>{alertMsg}</span>
        </div>
      )}

      {/* 2. Folder Tabs Row */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        {[
          { id: "analytics", label: "Analytics", roles: ["admin", "manager"] },
          { id: "moderation", label: "Moderation Queue", roles: ["admin", "manager"] },
          { id: "newspaper", label: "Newspaper", roles: ["admin", "manager"] },
          { id: "highlights", label: "✨ Highlights", roles: ["admin", "manager"] },
          { id: "archivist", label: "Content Archivist", roles: ["admin", "manager"] },
          { id: "users", label: "User Directory", roles: ["admin", "manager"] },
          { id: "content", label: "Content Manager", roles: ["admin"] },
          { id: "marketing", label: "Monetization & Ads", roles: ["admin"] },
          { id: "taxonomy", label: "System Taxonomy", roles: ["admin"] },
          { id: "literacy_tests", label: "🧪 Literacy Tests", roles: ["admin"] },
          { id: "slang_quiz", label: "🗣️ Slang Quiz", roles: ["admin"] },
          { id: "hero_cards", label: "🏠 Hero Cards", roles: ["admin"] },
        ]
          .filter(tab => tab.roles.includes(profile?.role))
          .map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === tab.id
                  ? "bg-purple-650 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
                }`}
            >
              {tab.label}
            </button>
          ))}
      </div>

      {/* TAB CONTENT A: SYSTEM ANALYTICS */}
      {activeTab === "analytics" && (
        // memes is filtered to visibility === "public" so this dashboard's
        // counts match what the public Library actually shows — otherwise
        // auto-saved drafts (Lab autosaves every 30s while editing) and
        // hidden memes inflate "Memes Created" and the subject/format charts.
        <AdminAnalyticsDashboard
          users={users}
          memes={memes.filter(m => m.visibility === "public")}
          resources={resources}
          literacyTests={literacyTests}
        />
      )}

      {/* TAB CONTENT B: MODERATION & APPROVAL QUEUES */}
      {activeTab === "newspaper" && (
        <div className="space-y-8">

          {/* Force Fetch — immediately pulls up to 5 real RSS items per category instead of waiting on the weekly schedule */}
          <div className={`p-6 ${containerClass}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-extrabold uppercase text-gray-400 flex items-center gap-1.5">
                  <NewspaperIcon className="w-4 h-4" /> Force Fetch RSS Feeds
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  The scheduled fetch adds at most 1 new item per category per week. Force fetch pulls up to 2 items per category right now, from the same sources.
                </p>
              </div>
              <button
                onClick={handleForceFetchNewspaperItems}
                disabled={isForceFetchingNewspaper}
                className={btnClass("indigo")}
              >
                {isForceFetchingNewspaper ? "Fetching…" : "⚡ Force Fetch Now (2 per category)"}
              </button>
            </div>
          </div>

          {/* Add Newspaper Item (admin-authored, always approved) */}
          <div className={`p-6 ${containerClass}`}>
            <h3 className="text-sm font-extrabold mb-1 border-b pb-2 uppercase text-gray-400 flex items-center gap-1.5">
              <NewspaperIcon className="w-4 h-4" /> Add Newspaper Item
            </h3>
            <p className="text-xs text-gray-400 mb-4">Published directly, live and already approved.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={newspaperForm.title}
                onChange={e => setNewspaperForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Title"
                className={inputClass}
              />
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={newspaperForm.sourceUrl}
                  onChange={e => setNewspaperForm(f => ({ ...f, sourceUrl: e.target.value }))}
                  placeholder="Source link (https://...)"
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={handleFetchNewspaperThumbnail}
                  disabled={fetchingNewspaperThumbnail}
                  className="flex-shrink-0 text-[10px] font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 border border-gray-300 dark:border-zinc-700 px-2.5 py-2 rounded-xl transition whitespace-nowrap disabled:opacity-50"
                >
                  {fetchingNewspaperThumbnail ? "Fetching…" : "🔎 Fetch thumbnail"}
                </button>
              </div>
              <select
                value={newspaperForm.category}
                onChange={e => setNewspaperForm(f => ({ ...f, category: e.target.value }))}
                className={inputClass}
              >
                {NEWSPAPER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <div className="flex items-center gap-3 sm:col-span-2">
                {newspaperForm.imagePreview && (
                  <img src={newspaperForm.imagePreview} alt="Thumbnail preview" className="w-16 h-12 object-cover rounded-lg border border-gray-200 dark:border-zinc-700 flex-shrink-0" />
                )}
                <label className="cursor-pointer bg-gray-100 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 text-xs font-bold px-3 py-2 rounded-xl transition inline-block">
                  📁 Choose Thumbnail
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0] || null;
                      setNewspaperForm(f => ({
                        ...f,
                        imageFile: file,
                        imagePreview: file ? URL.createObjectURL(file) : "",
                      }));
                    }}
                  />
                </label>
                <input
                  type="url"
                  value={newspaperForm.imageUrl}
                  onChange={e => setNewspaperForm(f => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="...or paste a thumbnail image URL instead"
                  className={`${inputClass} flex-1`}
                  disabled={!!newspaperForm.imageFile}
                />
              </div>
              <textarea
                value={newspaperForm.summaryText}
                onChange={e => setNewspaperForm(f => ({ ...f, summaryText: e.target.value }))}
                placeholder="Short summary"
                rows={2}
                className={`${inputClass} sm:col-span-2`}
              />
              <textarea
                value={newspaperForm.classroomTalkingPoint}
                onChange={e => setNewspaperForm(f => ({ ...f, classroomTalkingPoint: e.target.value }))}
                placeholder="Why this matters for class (optional)"
                rows={2}
                className={`${inputClass} sm:col-span-2`}
              />
            </div>
            <button
              onClick={() => {
                if (!newspaperForm.title.trim() || !newspaperForm.sourceUrl.trim() || !newspaperForm.summaryText.trim()) {
                  triggerAlert("Title, source link, and summary are required.", "error");
                  return;
                }
                handleAddNewspaperItem(newspaperForm, () => setNewspaperForm({
                  title: "", sourceUrl: "", summaryText: "", category: NEWSPAPER_CATEGORIES[0].value,
                  classroomTalkingPoint: "", imageUrl: "", imageFile: null, imagePreview: "",
                }));
              }}
              className={`${btnClass("purple")} mt-3 flex items-center gap-1.5`}
            >
              <Plus className="w-3.5 h-3.5" /> Publish Item
            </button>
          </div>

          {/* Newspaper Items — one filterable, paginated list instead of separate
              Pending/All tables, so the tab doesn't run on forever. */}
          {(() => {
            const pendingCount = newspaperItems.filter(n => !n.admin_approved).length;
            const approvedCount = newspaperItems.filter(n => n.admin_approved && n.status !== "admin_hidden").length;
            const filtered = newspaperItems.filter(item => {
              if (newspaperStatusFilter === "pending") return !item.admin_approved;
              if (newspaperStatusFilter === "approved") return item.admin_approved && item.status !== "admin_hidden";
              return true;
            });
            const pageItems = filtered.slice((newspaperPage - 1) * 10, newspaperPage * 10);

            return (
              <div className={`p-6 ${containerClass}`}>
                <div className="flex items-center justify-between border-b pb-3 mb-4 flex-wrap gap-3">
                  <h3 className="text-sm font-extrabold uppercase text-gray-400">
                    Newspaper Items ({filtered.length})
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { key: "pending", label: `Pending (${pendingCount})` },
                      { key: "approved", label: `Approved (${approvedCount})` },
                      { key: "all", label: `All (${newspaperItems.length})` },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => { setNewspaperStatusFilter(f.key); setNewspaperPage(1); }}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition ${
                          newspaperStatusFilter === f.key
                            ? "bg-purple-650 text-white border-purple-650"
                            : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-700"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                    <button
                      onClick={handleClearAllNewspaperItems}
                      disabled={isClearingNewspaper}
                      className={btnClass("red") + " border border-red-650 bg-red-900/10 hover:bg-red-900/20 text-red-500"}
                    >
                      {isClearingNewspaper ? "Clearing..." : "🗑️ Clear All"}
                    </button>
                  </div>
                </div>
                {filtered.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className={headerCellClass}>Title</th>
                            <th className={headerCellClass}>Category</th>
                            <th className={headerCellClass}>Status</th>
                            <th className={headerCellClass}>Source</th>
                            <th className={headerCellClass}>Date</th>
                            <th className={headerCellClass}>Flags</th>
                            <th className={headerCellClass}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageItems.map((item) => (
                            <tr key={item.id}>
                              <td className={rowCellClass}>
                                <div className="flex items-center gap-2">
                                  {item.image_url ? (
                                    <img src={item.image_url} alt="" className="w-10 h-8 object-cover rounded border border-gray-200 dark:border-zinc-700 flex-shrink-0" />
                                  ) : (
                                    <label
                                      className="w-10 h-8 flex-shrink-0 rounded border border-dashed border-gray-300 dark:border-zinc-600 flex items-center justify-center text-[9px] text-gray-400 cursor-pointer hover:border-purple-400 hover:text-purple-500"
                                      title="Auto-fetch found no image — upload one"
                                    >
                                      📷
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) handleQuickSetNewspaperImage(item.id, f); }}
                                      />
                                    </label>
                                  )}
                                  <span className="font-semibold">{item.title}</span>
                                </div>
                              </td>
                              <td className={rowCellClass}>
                                <select
                                  value={item.category || ""}
                                  onChange={e => handleChangeNewspaperCategory(item.id, e.target.value)}
                                  className={inputClass}
                                  title="Fix the category if the auto-fetch guessed wrong"
                                >
                                  {NEWSPAPER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                              </td>
                              <td className={rowCellClass}>
                                {item.status === "admin_hidden" ? (
                                  <span className="text-gray-400">Hidden</span>
                                ) : !item.admin_approved ? (
                                  <span className="text-yellow-600">Pending</span>
                                ) : (
                                  <span className="text-green-600">Live</span>
                                )}
                              </td>
                              <td className={rowCellClass}>
                                <a href={item.source_url} target="_blank" rel="noreferrer" className="text-indigo-600 text-[10px] hover:underline">{item.source_domain || "link"} ↗</a>
                              </td>
                              <td className={rowCellClass}>
                                {item.created_at ? new Date(item.created_at.seconds * 1000).toLocaleDateString() : "—"}
                              </td>
                              <td className={rowCellClass}>
                                {(item.flag_count || 0) > 0 ? (
                                  <span className="text-red-500 font-bold">🏳️ {item.flag_count}</span>
                                ) : "—"}
                              </td>
                              <td className={rowCellClass}>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleQuickHighlight("newspaper_item", item)}
                                    className={btnClass("purple")}
                                    title="Feature this item in the Newspaper hero and/or homepage highlights"
                                  >
                                    ⭐ Highlight
                                  </button>
                                  {!item.admin_approved && (
                                    <button
                                      onClick={() => handleApproveNewspaperItem(item.id)}
                                      className={btnClass("green")}
                                    >
                                      ✅ Approve
                                    </button>
                                  )}
                                  {item.admin_approved && (
                                    <button
                                      onClick={() => handleToggleNewspaperVisibility(item.id, item.status)}
                                      className={btnClass("gray")}
                                    >
                                      {item.status === "admin_hidden" ? "Restore" : "Hide"}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteNewspaperItem(item.id)}
                                    className={btnClass("red")}
                                  >
                                    🗑️ Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <AdminPagination page={newspaperPage} setPage={setNewspaperPage} total={filtered.length} pageSize={10} />
                  </>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    {newspaperStatusFilter === "pending" ? "All newspaper items have been reviewed. No pending approvals." : "No newspaper items here."}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === "moderation" && (
        <div className="space-y-8">

          {/* Resources Pending Admin Approval */}
          {(() => {
            const pendingResources = resources.filter(r => !r.admin_approved);
            const pageItems = pendingResources.slice((resourcesPendingPage - 1) * 10, resourcesPendingPage * 10);
            return (
              <div className={`p-6 ${containerClass}`}>
                <h3 className="text-sm font-extrabold mb-1 border-b pb-2 uppercase text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-450" /> Resources Pending Approval ({pendingResources.length})
                </h3>
                <p className="text-xs text-gray-400 mb-4">These resources are live on the platform but need your review. Approve to remove the 'Pending Admin Approval' badge, or delete if inappropriate.</p>
                {pendingResources.length > 0 ? (
                  <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={headerCellClass}>Title</th>
                          <th className={headerCellClass}>Type</th>
                          <th className={headerCellClass}>Subject</th>
                          <th className={headerCellClass}>Author ID</th>
                          <th className={headerCellClass}>Date</th>
                          <th className={headerCellClass}>Flags</th>
                          <th className={headerCellClass}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((res) => (
                          <tr key={res.id}>
                            <td className={rowCellClass}>
                              <span className="font-semibold">{res.title}</span>
                              {res.file_url && (
                                <a href={res.file_url} target="_blank" rel="noreferrer" className="block text-indigo-600 text-[9px] hover:underline mt-0.5">View File ↗</a>
                              )}
                            </td>
                            <td className={`${rowCellClass} capitalize`}>{res.type?.replace(/_/g, " ")}</td>
                            <td className={rowCellClass}>{res.subject || "—"}</td>
                            <td className={`${rowCellClass} font-mono text-[10px]`}>{res.author_id}</td>
                            <td className={rowCellClass}>
                              {res.created_at ? new Date(res.created_at.seconds * 1000).toLocaleDateString() : "—"}
                            </td>
                            <td className={rowCellClass}>
                              {(res.flag_count || 0) > 0 ? (
                                <span className="text-red-500 font-bold">🏳️ {res.flag_count}</span>
                              ) : "—"}
                            </td>
                            <td className={rowCellClass}>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleQuickHighlight(
                                    res.type === "activity" ? "activity" : (res.type === "stories" || res.type === "story") ? "meme_story" : "resource",
                                    res
                                  )}
                                  className={btnClass("purple")}
                                  title="Feature this in the homepage highlights"
                                >
                                  ⭐ Highlight
                                </button>
                                <button
                                  onClick={() => handleApproveResource(res.id)}
                                  className={btnClass("green")}
                                >
                                  ✅ Approve
                                </button>
                                <button
                                  onClick={() => handleDeleteResourceAdmin(res.id)}
                                  className={btnClass("red")}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <AdminPagination page={resourcesPendingPage} setPage={setResourcesPendingPage} total={pendingResources.length} pageSize={10} />
                  </>
                ) : (
                  <p className="text-xs text-gray-400 italic">All resources have been reviewed. No pending approvals.</p>
                )}
              </div>
            );
          })()}

          {/* Slang Decoder Words Pending Admin Approval */}
          {(() => {
            const pendingSlangTerms = slangTerms.filter(t => t.status === "pending");
            const pageItems = pendingSlangTerms.slice((slangPendingPage - 1) * 10, slangPendingPage * 10);
            return (
              <div className={`p-6 ${containerClass}`}>
                <h3 className="text-sm font-extrabold mb-1 border-b pb-2 uppercase text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-450" /> Slang Words Pending Approval ({pendingSlangTerms.length})
                </h3>
                <p className="text-xs text-gray-400 mb-4">These contributed words are hidden from the public Slang Decoder dictionary until approved.</p>
                {pendingSlangTerms.length > 0 ? (
                  <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={headerCellClass}>Term</th>
                          <th className={headerCellClass}>Category</th>
                          <th className={headerCellClass}>Definition</th>
                          <th className={headerCellClass}>Contributor</th>
                          <th className={headerCellClass}>Date</th>
                          <th className={headerCellClass}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((t) => (
                          <tr key={t.id}>
                            <td className={rowCellClass}><span className="font-semibold">{t.term}</span></td>
                            <td className={`${rowCellClass} capitalize`}>{t.category}</td>
                            <td className={rowCellClass}>
                              <span className="line-clamp-2">{t.definition}</span>
                              {Array.isArray(t.meme_image_urls) && t.meme_image_urls.length > 0 && (
                                <span className="block text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5">🖼️ {t.meme_image_urls.length} meme example(s)</span>
                              )}
                            </td>
                            <td className={`${rowCellClass} font-mono text-[10px]`}>{t.contributor_name || t.contributor_id}</td>
                            <td className={rowCellClass}>
                              {t.created_at ? new Date(t.created_at.seconds * 1000).toLocaleDateString() : "—"}
                            </td>
                            <td className={rowCellClass}>
                              <div className="flex space-x-2">
                                <button onClick={() => handleApproveSlangTerm(t.id)} className={btnClass("green")}>✅ Approve</button>
                                <button onClick={() => handleRejectSlangTerm(t.id, t.term)} className={btnClass("red")}>🗑️ Reject</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <AdminPagination page={slangPendingPage} setPage={setSlangPendingPage} total={pendingSlangTerms.length} pageSize={10} />
                  </>
                ) : (
                  <p className="text-xs text-gray-400 italic">All slang words have been reviewed. No pending approvals.</p>
                )}
              </div>
            );
          })()}

          <div className={`p-6 ${containerClass}`}>
            <h3 className="text-sm font-extrabold mb-4 border-b pb-2 uppercase text-gray-400">
              Flagged Items Feed ({flags.length})
            </h3>
            {flags.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={headerCellClass}>Content Type</th>
                      <th className={headerCellClass}>Reason</th>
                      <th className={headerCellClass}>Content ID</th>
                      <th className={headerCellClass}>Reporter</th>
                      <th className={headerCellClass}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flags.map((flag) => (
                      <tr key={flag.id}>
                        <td className={`${rowCellClass} capitalize`}>{flag.content_type}</td>
                        <td className={rowCellClass}>{flag.reason}</td>
                        <td className={`${rowCellClass} font-mono text-[10px]`}>{flag.content_id}</td>
                        <td className={`${rowCellClass} font-mono text-[10px]`}>{flag.reporter_id}</td>
                        <td className={rowCellClass}>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleDismissFlag(flag.id, flag.content_type, flag.content_id)}
                              className={btnClass("green")}
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => handleConfirmDeleteFlag(flag.id, flag.content_type, flag.content_id)}
                              className={btnClass("red")}
                            >
                              Archive/Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No items flagged for moderation reviews.</p>
            )}
          </div>

          {/* Expert Applications */}
          <div className={`p-6 ${containerClass}`}>
            <h3 className="text-sm font-extrabold mb-4 border-b pb-2 uppercase text-gray-400">
              Pending Expert Verifications ({expertApps.length})
            </h3>
            {expertApps.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={headerCellClass}>Name</th>
                      <th className={headerCellClass}>Email</th>
                      <th className={headerCellClass}>Institution</th>
                      <th className={headerCellClass}>ID Credentials</th>
                      <th className={headerCellClass}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expertApps.map((app) => (
                      <tr key={app.id}>
                        <td className={rowCellClass}>{app.name || "Anonymous Applicant"}</td>
                        <td className={rowCellClass}>{app.email || "No Email"}</td>
                        <td className={rowCellClass}>{app.institution}</td>
                        <td className={rowCellClass}>
                          {app.id_card_url ? (
                            <a
                              href={app.id_card_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-purple-650 hover:underline font-bold"
                            >
                              View ID Card File 📄
                            </a>
                          ) : (
                            <span className="text-gray-405 italic">None Attached</span>
                          )}
                        </td>
                        <td className={rowCellClass}>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApproveExpert(app.id, app.user_id)}
                              className={btnClass("purple")}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectExpert(app.id)}
                              className={btnClass("gray")}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No verification requests pending review.</p>
            )}
          </div>

          {/* Pending Lab Templates Queue */}
          <div className={`p-6 ${containerClass}`}>
            <h3 className="text-sm font-extrabold mb-4 border-b pb-2 uppercase text-gray-400">
              Pending Lab Templates ({templates.filter(t => t.status === "pending").length})
            </h3>
            {templates.filter(t => t.status === "pending").length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={headerCellClass}>Template Title</th>
                      <th className={headerCellClass}>Format</th>
                      <th className={headerCellClass}>Has Story</th>
                      <th className={headerCellClass}>Media Url</th>
                      <th className={headerCellClass}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.filter(t => t.status === "pending").map((temp) => {
                      const linkedStory = resources.find(r => r.type === "stories" && r.template_id === temp.id);
                      return (
                        <tr key={temp.id}>
                          <td className={rowCellClass}>{temp.title}</td>
                          <td className={`${rowCellClass} capitalize`}>{temp.format}</td>
                          <td className={rowCellClass}>
                            {linkedStory ? (
                              <span className="bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">📖 Story Added</span>
                            ) : (
                              <span className="text-gray-400 text-[10px]">—</span>
                            )}
                          </td>
                          <td className={rowCellClass}>
                            <a
                              href={temp.media_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline font-bold truncate max-w-xs block"
                            >
                              {temp.media_url}
                            </a>
                          </td>
                          <td className={rowCellClass}>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleApproveTemplate(temp.id)}
                                className={btnClass("purple")}
                              >
                                Approve to Tray
                              </button>
                              <button
                                onClick={() => handleRejectTemplate(temp.id)}
                                className={btnClass("gray")}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No templates pending approvals.</p>
            )}
          </div>

          {/* Approved Curation Templates Queue */}
          <div className={`p-6 ${containerClass}`}>
            <h3 className="text-sm font-extrabold mb-4 border-b pb-2 uppercase text-gray-400">
              Manage Approved Templates ({templates.filter(t => t.status === "approved").length})
            </h3>
            {templates.filter(t => t.status === "approved").length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={headerCellClass}>Template Title</th>
                      <th className={headerCellClass}>Format</th>
                      <th className={headerCellClass}>Story</th>
                      <th className={headerCellClass}>Featured</th>
                      <th className={headerCellClass}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.filter(t => t.status === "approved").map((temp) => (
                      <tr key={temp.id}>
                        <td className={rowCellClass}>{temp.title}</td>
                        <td className={`${rowCellClass} capitalize`}>{temp.format}</td>
                        <td className={rowCellClass}>
                          {storyTemplateIds.has(temp.id) ? (
                            <span className="bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">📖 Linked</span>
                          ) : (
                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">⚠️ No story</span>
                          )}
                        </td>
                        <td className={rowCellClass}>
                          {temp.is_featured ? (
                            <span className="text-yellow-500 font-bold">⭐ Featured</span>
                          ) : (
                            <span className="text-gray-405">Regular</span>
                          )}
                        </td>
                        <td className={rowCellClass}>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleToggleFeatureTemplate(temp.id, !!temp.is_featured)}
                              className={btnClass(temp.is_featured ? "gray" : "purple")}
                            >
                              {temp.is_featured ? "✰ Unfeature" : "⭐ Feature"}
                            </button>
                            <button
                              onClick={() => handleRejectTemplate(temp.id)}
                              className={btnClass("red")}
                            >
                              🗑️ Revoke/Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No approved templates in catalog yet.</p>
            )}
          </div>

          {/* Staffroom Attachments Manager */}
          <div className={`p-6 ${containerClass}`}>
            <h3 className="text-sm font-extrabold mb-1 border-b pb-2 uppercase text-sky-600 dark:text-sky-400">
              📎 Staffroom Uploaded Attachments ({staffroomAttachments.length})
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Files uploaded by educators to Staffroom threads. Remove individual files to free storage, or use the bulk pruning tool (Analytics tab) to clear all attachments older than 30 days.
            </p>
            {staffroomAttachments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={headerCellClass}>Thread</th>
                      <th className={headerCellClass}>File Name</th>
                      <th className={headerCellClass}>Uploaded</th>
                      <th className={headerCellClass}>View</th>
                      <th className={headerCellClass}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffroomAttachments.map((att) => (
                      <tr key={att.id}>
                        <td className={rowCellClass}>
                          <span className="font-semibold truncate block max-w-[180px]">{att.title}</span>
                        </td>
                        <td className={`${rowCellClass} font-mono text-[10px]`}>
                          <span className="truncate block max-w-[150px]">{att.attachment_name}</span>
                        </td>
                        <td className={rowCellClass}>
                          {att.created_at ? new Date(att.created_at.seconds * 1000).toLocaleDateString() : "—"}
                        </td>
                        <td className={rowCellClass}>
                          {att.attachment_url ? (
                            <a href={att.attachment_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-[10px] font-bold">
                              View ↗
                            </a>
                          ) : "—"}
                        </td>
                        <td className={rowCellClass}>
                          <button
                            onClick={() => handleDeleteAttachment(att.id, att.attachment_storage_path, att.attachment_name)}
                            className={btnClass("red")}
                          >
                            🗑️ Delete File
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No uploaded attachments found. Files appear here once teachers upload them to Staffroom posts.</p>
            )}
          </div>

        </div>
      )}


      {/* TAB CONTENT C: DIRECT GLOBAL CONTENT ARCHIVIST */}
      {activeTab === "archivist" && (
        <div className={`p-6 ${containerClass} max-w-2xl mx-auto`}>
          <h3 className="text-sm font-extrabold mb-4 border-b pb-2 uppercase text-gray-400">
            Direct Global Content Archivist
          </h3>
          <p className="text-xs text-gray-500 mb-6 leading-relaxed">
            Directly seed content bypassing typical workflow validation boundaries. Select content type to proceed.
          </p>

          <div className="flex space-x-2 mb-6">
            {["template", "meme", "resource"].map(modeOpt => (
              <button
                key={modeOpt}
                onClick={() => setArchivistMode(modeOpt)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition capitalize ${archivistMode === modeOpt
                    ? "bg-indigo-650 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-500"
                  }`}
              >
                {modeOpt}
              </button>
            ))}
          </div>

          <form onSubmit={handleDirectSeed} className="space-y-4">
            {archivistMode === "template" && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Template Title *</label>
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={e => setTempTitle(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Surprised Pikachu"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Format *</label>
                  <select
                    value={tempFormat}
                    onChange={e => setTempFormat(e.target.value)}
                    className={inputClass}
                  >
                    <option value="image">Image</option>
                    <option value="gif">GIF</option>
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Image/Media Source URL *</label>
                  <input
                    type="url"
                    value={tempUrl}
                    onChange={e => setTempUrl(e.target.value)}
                    className={inputClass}
                    placeholder="https://example.com/image.png"
                    required={!tempFile}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Or Upload Media File</label>
                  <input
                    type="file"
                    onChange={e => setTempFile(e.target.files?.[0] || null)}
                    className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-800"
                  />
                </div>
              </>
            )}

            {archivistMode === "meme" && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Meme Title *</label>
                  <input
                    type="text"
                    value={memeTitle}
                    onChange={e => setMemeTitle(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Physics Gravity Joke"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Format *</label>
                  <select
                    value={memeFormat}
                    onChange={e => setMemeFormat(e.target.value)}
                    className={inputClass}
                  >
                    <option value="image">Image</option>
                    <option value="gif">GIF</option>
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Subject *</label>
                  <select
                    value={memeSubject}
                    onChange={e => setMemeSubject(e.target.value)}
                    className={inputClass}
                  >
                    {taxonomy.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Grade Level *</label>
                  <select
                    value={memeGrade}
                    onChange={e => setMemeGrade(e.target.value)}
                    className={inputClass}
                  >
                    {taxonomy.grades.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Language *</label>
                  <input
                    type="text"
                    value={memeLang}
                    onChange={e => setMemeLang(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. English"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Media Source URL *</label>
                  <input
                    type="url"
                    value={memeUrl}
                    onChange={e => setMemeUrl(e.target.value)}
                    className={inputClass}
                    placeholder="https://example.com/meme.png"
                    required={!memeFile}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Or Upload Media File</label>
                  <input
                    type="file"
                    onChange={e => setMemeFile(e.target.files?.[0] || null)}
                    className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-800"
                  />
                </div>
              </>
            )}

            {archivistMode === "resource" && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Resource Type *</label>
                  <select
                    value={resType}
                    onChange={e => setResType(e.target.value)}
                    className={inputClass}
                  >
                    <option value="article">Article</option>
                    <option value="research_paper">Research Paper</option>
                    <option value="activity">Classroom Activity</option>
                    <option value="course">Lesson Course</option>
                    <option value="stories">Meme Story</option>
                    <option value="other">Other Tool</option>
                  </select>
                </div>

                {/* Attach File Option Moved to Top for Meme Stories */}
                {resType === "stories" && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Attach File / Customizable Image Template *</label>
                    <input
                      type="file"
                      accept="image/*,video/*,audio/*"
                      onChange={e => setResFile(e.target.files?.[0] || null)}
                      className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-800"
                    />
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1">
                      💡 Users can customize this image/template in the Meme Lab.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                    {resType === "stories" ? "Template/Meme Name *" : "Resource Title *"}
                  </label>
                  <input
                    type="text"
                    value={resTitle}
                    onChange={e => setResTitle(e.target.value)}
                    className={inputClass}
                    placeholder={resType === "stories" ? "e.g. Winnie the Pooh Reading a Paper" : "e.g. Gamification in Maths Pedagogy"}
                    required
                  />
                </div>
                {resType !== "stories" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Subject *</label>
                      <select
                        value={resSubject}
                        onChange={e => setResSubject(e.target.value)}
                        className={inputClass}
                      >
                        {taxonomy.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Grade Level *</label>
                      <select
                        value={resGrade}
                        onChange={e => setResGrade(e.target.value)}
                        className={inputClass}
                      >
                        {taxonomy.grades.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {(resType === "article" || resType === "research_paper") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Year of Publication *</label>
                      <input
                        type="text"
                        value={resPublicationYear}
                        onChange={e => setResPublicationYear(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. 2024"
                        required={resType === "article" || resType === "research_paper"}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Journal/Magazine/Website *</label>
                      <input
                        type="text"
                        value={resPublisherName}
                        onChange={e => setResPublisherName(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Nature Science"
                        required={resType === "article" || resType === "research_paper"}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                    {resType === "stories" ? "Background — How it became a meme *" : "Summary / Body *"}
                  </label>
                  <RichTextArea
                    value={resBody}
                    onChange={e => setResBody(e.target.value)}
                    rows={3}
                    placeholder={resType === "stories" ? "How it became a meme: Mention where this template originated (movie, TV show, game, viral event) and how it gained popularity." : "Provide a quick summary or layout description..."}
                    required
                  />
                </div>

                {/* Story-specific fields */}
                {resType === "stories" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Typical Meaning & Usage</label>
                      <RichTextArea
                        value={resUsageContext}
                        onChange={e => setResUsageContext(e.target.value)}
                        rows={2}
                        placeholder="Used to express confusion while reading something complicated or reacting to unexpected information."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Educational Use</label>
                      <RichTextArea
                        value={resEducationalUse}
                        onChange={e => setResEducationalUse(e.target.value)}
                        rows={2}
                        placeholder="Suggest classroom situations where this template can be used. E.g. Assignment instructions"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Example Images (Upload Multiple Images)</label>
                      <p className="text-[10px] text-gray-400 mb-2">Upload real example images of this meme being used.</p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={e => {
                          const files = Array.from(e.target.files || []);
                          setResExampleFiles(prev => [...prev, ...files]);
                        }}
                        className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-800 cursor-pointer"
                      />
                      {resExampleFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {resExampleFiles.map((file, idx) => (
                            <div key={idx} className="relative group w-12 h-12 rounded overflow-hidden border border-gray-300 dark:border-gray-700">
                              <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setResExampleFiles(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute top-0 right-0 bg-red-600 text-white rounded-bl p-0.5 text-[9px] font-bold"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {resType !== "stories" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Attachment File/Source URL</label>
                      <input
                        type="url"
                        value={resUrl}
                        onChange={e => setResUrl(e.target.value)}
                        className={inputClass}
                        placeholder="https://example.com/document.pdf"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Or Upload PDF/Attachment File</label>
                      <input
                        type="file"
                        onChange={e => setResFile(e.target.files?.[0] || null)}
                        className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-800"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Thumbnail Image URL</label>
                        <input
                          type="url"
                          value={resThumbnailUrl}
                          onChange={e => setResThumbnailUrl(e.target.value)}
                          className={inputClass}
                          placeholder="https://example.com/thumbnail.png"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Or Upload Thumbnail Image</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => setResThumbnailFile(e.target.files?.[0] || null)}
                          className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-800"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Keywords (comma-separated)</label>
                      <input
                        type="text"
                        value={resKeywords}
                        onChange={e => setResKeywords(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. biology, cell, science"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={loadingAction}
              className={btnClass("purple") + " w-full mt-4"}
            >
              {loadingAction ? "Archiving..." : "Archive & Publish Seed"}
            </button>
          </form>
        </div>
      )}

      {/* TAB CONTENT D: TOTAL USER ACCOUNT DIRECTORY */}
      {activeTab === "users" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className={`${inputClass} sm:w-60`}
                placeholder="Search user name or email..."
              />
              <select
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                className={`${inputClass} sm:w-40`}
              >
                <option value="">All Roles</option>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="expert">Expert</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {profile.role === "admin" && (
              <button
                onClick={() => setShowAddUserModal(true)}
                className={btnClass("purple")}
              >
                ➕ Create User Profile
              </button>
            )}
          </div>

          {/* ── Pending Unban Appeals Queue ───────────────────────────────────── */}
          {unbanRequests.filter(r => r.status === "pending").length > 0 && (
            <div className={`p-6 mb-6 ${containerClass}`}>
              <h3 className="text-sm font-extrabold mb-1 border-b pb-2 uppercase text-red-600 dark:text-red-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Pending Account Unban Appeals ({unbanRequests.filter(r => r.status === "pending").length})
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Users who submitted an appeal for account restoration. Review their message and decide whether to reinstate or maintain suspension.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={headerCellClass}>User</th>
                      <th className={headerCellClass}>Email</th>
                      <th className={headerCellClass}>Role / Institution</th>
                      <th className={headerCellClass}>Suspension Reason</th>
                      <th className={headerCellClass}>Appeal Message</th>
                      <th className={headerCellClass}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unbanRequests.filter(r => r.status === "pending").map((req) => (
                      <tr key={req.id}>
                        <td className={rowCellClass}>
                          <span className="font-bold">{req.user_name || "User"}</span>
                        </td>
                        <td className={`${rowCellClass} font-mono text-[10px]`}>{req.user_email || "—"}</td>
                        <td className={rowCellClass}>{req.role || "student"} ({req.institution || "N/A"})</td>
                        <td className={`${rowCellClass} text-red-500 font-semibold`}>{req.ban_reason || "Community violation"}</td>
                        <td className={`${rowCellClass} max-w-xs`}>
                          <p className="text-xs italic bg-gray-50 dark:bg-zinc-950 p-2 rounded-lg border border-gray-200 dark:border-zinc-800 line-clamp-3">
                            "{req.appeal_message}"
                          </p>
                        </td>
                        <td className={rowCellClass}>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApproveUnbanRequest(req.user_id || req.id)}
                              className={btnClass("green")}
                            >
                              ✓ Approve & Unban
                            </button>
                            <button
                              onClick={() => handleRejectUnbanRequest(req.user_id || req.id)}
                              className={btnClass("red")}
                            >
                              ✕ Reject Appeal
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Pending ID Card Verification Queue ──────────────────────────────── */}
          {pendingVerifications.length > 0 && (
            <div className={`p-6 ${containerClass}`}>
              <h3 className="text-sm font-extrabold mb-1 border-b pb-2 uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <BadgeCheck className="w-4 h-4" />
                Pending Institution ID Verifications ({pendingVerifications.length})
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Users who uploaded an institution ID card. Review the file and approve or reject their verification request.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={headerCellClass}>Name</th>
                      <th className={headerCellClass}>Email</th>
                      <th className={headerCellClass}>Institution</th>
                      <th className={headerCellClass}>Type</th>
                      <th className={headerCellClass}>ID Card</th>
                      <th className={headerCellClass}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingVerifications.map((uv) => (
                      <tr key={uv.id}>
                        <td className={rowCellClass}>
                          <span className="font-bold">{uv.name || "—"}</span>
                        </td>
                        <td className={`${rowCellClass} font-mono text-[10px]`}>{contactEmailsById[uv.id] || "—"}</td>
                        <td className={rowCellClass}>{uv.institution || "—"}</td>
                        <td className={rowCellClass}>{uv.institution_type || "—"}</td>
                        <td className={rowCellClass}>
                          <ViewIdCardButton userId={uv.id} />
                        </td>
                        <td className={rowCellClass}>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApproveIdVerification(uv.id)}
                              className={btnClass("green")}
                            >
                              ✓ Verify
                            </button>
                            <button
                              onClick={() => handleRejectIdVerification(uv.id)}
                              className={btnClass("gray")}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className={`p-6 ${containerClass}`}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={headerCellClass}>User Name</th>
                    <th className={headerCellClass}>Email Address</th>
                    <th className={headerCellClass}>Role</th>
                    <th className={headerCellClass}>Institution</th>
                    <th className={headerCellClass}>Account Status</th>
                    <th className={headerCellClass}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((uItem) => {
                    const isSelf = uItem.id === user.uid;
                    const isReadOnly = profile.role !== "admin" || isSelf;

                    return (
                      <tr key={uItem.id}>
                        <td className={rowCellClass}>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-extrabold">{uItem.name}</span>
                            {uItem.is_verified && (
                              <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" title="Institution Verified" />
                            )}
                          </div>
                        </td>
                        <td className={rowCellClass}>{contactEmailsById[uItem.id] || "—"}</td>
                        <td className={`${rowCellClass} capitalize font-bold`}>{uItem.role}</td>
                        <td className={rowCellClass}>{uItem.institution || "None"}</td>
                        <td className={rowCellClass}>
                          {uItem.banned ? (
                            <span className="bg-red-100 text-red-750 dark:bg-red-950/20 dark:text-red-300 px-2 py-0.5 rounded text-[10px] font-bold">
                              Suspended
                            </span>
                          ) : (
                            <span className="bg-green-150 text-green-750 dark:bg-green-950/20 dark:text-green-300 px-2 py-0.5 rounded text-[10px] font-bold">
                              Active
                            </span>
                          )}
                        </td>
                        <td className={rowCellClass}>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleTriggerPasswordReset(contactEmailsById[uItem.id])}
                              disabled={isReadOnly}
                              className={btnClass("gray") + " disabled:opacity-50"}
                              title={isReadOnly ? "Actions limited to Admins" : "Trigger Reset Email"}
                            >
                              Reset Pass
                            </button>
                            <button
                              onClick={() => handleToggleBan(uItem.id, uItem.banned)}
                              disabled={isReadOnly}
                              className={btnClass(uItem.banned ? "green" : "red") + " disabled:opacity-50"}
                              title={isReadOnly ? "Actions limited to Admins" : ""}
                            >
                              {uItem.banned ? "Unban" : "Ban"}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(uItem.id)}
                              disabled={isReadOnly}
                              className={btnClass("red") + " bg-red-800 disabled:opacity-50"}
                              title={isReadOnly ? "Actions limited to Admins" : ""}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add User Modal */}
          {showAddUserModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md p-6 overflow-y-auto max-h-[90vh] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-2xl rounded-2xl">
                <h3 className="text-base font-extrabold mb-4">Create User Profile</h3>
                <form onSubmit={handleAddNewUser} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Display Name *</label>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={e => setNewUserName(e.target.value)}
                      className={inputClass}
                      placeholder="Jane Doe"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Email Address *</label>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={e => setNewUserEmail(e.target.value)}
                      className={inputClass}
                      placeholder="jane.doe@school.edu"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Default Role *</label>
                    <select
                      value={newUserRole}
                      onChange={e => setNewUserRole(e.target.value)}
                      className={inputClass}
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="expert">Expert</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Institution</label>
                    <input
                      type="text"
                      value={newUserInstitution}
                      onChange={e => setNewUserInstitution(e.target.value)}
                      className={inputClass}
                      placeholder="Oakridge High School"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">City</label>
                      <input
                        type="text"
                        value={newUserPlace}
                        onChange={e => setNewUserPlace(e.target.value)}
                        className={inputClass}
                        placeholder="Paris"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">State</label>
                      <input
                        type="text"
                        value={newUserState}
                        onChange={e => setNewUserState(e.target.value)}
                        className={inputClass}
                        placeholder="IDF"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Country</label>
                      <input
                        type="text"
                        value={newUserCountry}
                        onChange={e => setNewUserCountry(e.target.value)}
                        className={inputClass}
                        placeholder="France"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setShowAddUserModal(false)}
                      className="px-4 py-2 font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loadingAction}
                      className={btnClass("purple")}
                    >
                      {loadingAction ? "Creating..." : "Create User Profile"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT E: MARKETING & MONETIZATION (Admin Only) */}
      {activeTab === "marketing" && profile.role === "admin" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Ad Banners */}
          <div className={`p-6 ${containerClass} space-y-6`}>
            <h3 className="text-sm font-extrabold mb-4 border-b pb-2 uppercase text-gray-400">
              Sponsored Ads placements ({sponsoredAds.length})
            </h3>

            <form onSubmit={handleAddAd} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Ad Label / Title *</label>
                <input
                  type="text"
                  value={adTitle}
                  onChange={e => setAdTitle(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Back to School Discounts"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Target Outbound Link *</label>
                <input
                  type="url"
                  value={adDestUrl}
                  onChange={e => setAdDestUrl(e.target.value)}
                  className={inputClass}
                  placeholder="https://sponsor.com/sale"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Ad Image Banner URL</label>
                <input
                  type="url"
                  value={adImageUrl}
                  onChange={e => setAdImageUrl(e.target.value)}
                  className={inputClass}
                  placeholder="https://sponsor.com/banner.png"
                  required={!adImageFile}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Or Upload Banner Image File</label>
                <input
                  type="file"
                  onChange={e => setAdImageFile(e.target.files?.[0] || null)}
                  className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-800"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="adActiveCheck"
                  checked={adIsActive}
                  onChange={e => setAdIsActive(e.target.checked)}
                />
                <label htmlFor="adActiveCheck" className="text-xs font-semibold">Render Sponsored Banner on Home page</label>
              </div>
              <button
                type="submit"
                disabled={loadingAction}
                className={btnClass("purple") + " w-full"}
              >
                {loadingAction ? "Saving..." : "Add Advertisement Placement"}
              </button>
            </form>

            <div className="pt-4 border-t border-gray-150 dark:border-gray-800 space-y-3">
              <h4 className="text-xs font-bold text-gray-400">Current active placements</h4>
              {sponsoredAds.map(ad => (
                <div key={ad.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs">
                  <div>
                    <span className="font-extrabold">{ad.title}</span>
                    <span className="block text-[10px] text-gray-400 truncate max-w-xs">{ad.destination_url}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={ad.is_active ? "text-green-600 font-bold" : "text-gray-400"}>
                      {ad.is_active ? "Active" : "Inactive"}
                    </span>
                    <button onClick={() => handleDeleteAd(ad.id)} className="text-red-500 font-bold hover:underline">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial Form */}
          <div className={`p-6 ${containerClass} space-y-6`}>
            <h3 className="text-sm font-extrabold mb-4 border-b pb-2 uppercase text-gray-400">
              Testimonials Compiler ({testimonials.length})
            </h3>

            <form onSubmit={handleAddTestimonial} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Author Name *</label>
                <input
                  type="text"
                  value={testAuthor}
                  onChange={e => setTestAuthor(e.target.value)}
                  className={inputClass}
                  placeholder="Dr. Sarah Jenkins"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Institution *</label>
                <input
                  type="text"
                  value={testInst}
                  onChange={e => setTestInst(e.target.value)}
                  className={inputClass}
                  placeholder="Vanderbilt University"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Review Body Text *</label>
                <RichTextArea
                  value={testBody}
                  onChange={e => setTestBody(e.target.value)}
                  rows={2}
                  placeholder="Testimonial details..."
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Inline Image URL</label>
                <input
                  type="url"
                  value={testImageUrl}
                  onChange={e => setTestImageUrl(e.target.value)}
                  className={inputClass}
                  placeholder="https://domain.com/photo.png"
                  required={!testImageFile}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Or Upload Photo / Video Attachment</label>
                <input
                  type="file"
                  onChange={e => setTestImageFile(e.target.files?.[0] || null)}
                  className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-800"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="testFeaturedCheck"
                  checked={testIsFeatured}
                  onChange={e => setTestIsFeatured(e.target.checked)}
                />
                <label htmlFor="testFeaturedCheck" className="text-xs font-semibold">Highlight Review as Featured testimonial</label>
              </div>
              <button
                type="submit"
                disabled={loadingAction}
                className={btnClass("purple") + " w-full"}
              >
                {loadingAction ? "Saving..." : "Add User Feedback Testimonial"}
              </button>
            </form>

            <div className="pt-4 border-t border-gray-150 dark:border-gray-800 space-y-3">
              <h4 className="text-xs font-bold text-gray-400">Current testimonials</h4>
              {testimonials.map(t => (
                <div key={t.id} className="flex justify-between items-center p-3 bg-gray-55 dark:bg-gray-900 rounded-lg text-xs">
                  <div>
                    <span className="font-extrabold">{t.author_name}</span>
                    <span className="block text-[10px] text-gray-400">{t.institution}</span>
                  </div>
                  <button onClick={() => handleDeleteTestimonial(t.id)} className="text-red-500 font-bold hover:underline">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT F: SYSTEM TAXONOMY CONFIGS (Admin Only) */}
      {activeTab === "taxonomy" && profile.role === "admin" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Subjects configuration list */}
            <div className={`p-6 ${containerClass} space-y-4`}>
              <h3 className="text-sm font-extrabold mb-2 border-b pb-2 uppercase text-gray-400">
                Curricular Subjects Config
              </h3>

              <form onSubmit={handleAddSubject} className="flex space-x-2">
                <input
                  type="text"
                  value={newTaxSubject}
                  onChange={e => setNewTaxSubject(e.target.value)}
                  className={inputClass}
                  placeholder="Add subject..."
                />
                <button type="submit" className={btnClass("purple")}>
                  Add
                </button>
              </form>

              {/* Subject Search Bar */}
              <input
                type="text"
                placeholder="🔍 Search subjects..."
                value={taxSubjectSearch}
                onChange={e => setTaxSubjectSearch(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded text-xs"
              />

              <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
                {(taxonomy.subjects || [])
                  .filter(sub => sub.toLowerCase().includes(taxSubjectSearch.toLowerCase()))
                  .map(sub => (
                    <div key={sub} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-150 dark:border-gray-800 text-xs">
                      <span>{sub}</span>
                      <button
                        onClick={() => handleRemoveSubject(sub)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Grades configuration list */}
            <div className={`p-6 ${containerClass} space-y-4`}>
              <h3 className="text-sm font-extrabold mb-2 border-b pb-2 uppercase text-gray-400">
                Grade Levels Config
              </h3>

              <form onSubmit={handleAddGrade} className="flex space-x-2">
                <input
                  type="text"
                  value={newTaxGrade}
                  onChange={e => setNewTaxGrade(e.target.value)}
                  className={inputClass}
                  placeholder="Add grade..."
                />
                <button type="submit" className={btnClass("purple")}>
                  Add
                </button>
              </form>

              {/* Grade Search Bar */}
              <input
                type="text"
                placeholder="🔍 Search grades..."
                value={taxGradeSearch}
                onChange={e => setTaxGradeSearch(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded text-xs"
              />

              <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
                {(taxonomy.grades || [])
                  .filter(gr => gr.toLowerCase().includes(taxGradeSearch.toLowerCase()))
                  .map(gr => (
                    <div key={gr} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-150 dark:border-gray-800 text-xs">
                      <span>{gr}</span>
                      <button
                        onClick={() => handleRemoveGrade(gr)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Languages configuration list */}
            <div className={`p-6 ${containerClass} space-y-4`}>
              <h3 className="text-sm font-extrabold mb-2 border-b pb-2 uppercase text-gray-400">
                Languages Config
              </h3>

              <form onSubmit={handleAddLanguage} className="flex space-x-2">
                <input
                  type="text"
                  value={newTaxLanguage}
                  onChange={e => setNewTaxLanguage(e.target.value)}
                  className={inputClass}
                  placeholder="Add language..."
                />
                <button type="submit" className={btnClass("purple")}>
                  Add
                </button>
              </form>

              {/* Language Search Bar */}
              <input
                type="text"
                placeholder="🔍 Search languages..."
                value={taxLangSearch}
                onChange={e => setTaxLangSearch(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded text-xs"
              />

              <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
                {(taxonomy.languages || ["English", "Hindi", "Malayalam", "Tamil", "Other"])
                  .filter(lang => lang.toLowerCase().includes(taxLangSearch.toLowerCase()))
                  .map(lang => (
                    <div key={lang} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-150 dark:border-gray-800 text-xs">
                      <span>{lang}</span>
                      {lang !== "Other" && (
                        <button
                          onClick={() => handleRemoveLanguage(lang)}
                          className="text-red-500 hover:text-red-700 font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            {/* Additional Tool Sections configuration list */}
            <div className={`p-6 ${containerClass} space-y-4`}>
              <h3 className="text-sm font-extrabold mb-2 border-b pb-2 uppercase text-gray-400">
                Additional Tool Sections & Categories
              </h3>

              <form onSubmit={handleAddToolSection} className="flex space-x-2">
                <input
                  type="text"
                  value={newTaxToolSection}
                  onChange={e => setNewTaxToolSection(e.target.value)}
                  className={inputClass}
                  placeholder="Add tool section..."
                />
                <button type="submit" className={btnClass("purple")}>
                  Add
                </button>
              </form>

              {/* Section Search Bar */}
              <input
                type="text"
                placeholder="🔍 Search tool sections..."
                value={taxSectionSearch}
                onChange={e => setTaxSectionSearch(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded text-xs"
              />

              <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
                {(taxonomy.tool_sections || DEFAULT_TOOL_SECTIONS)
                  .filter(sec => sec.toLowerCase().includes(taxSectionSearch.toLowerCase()))
                  .map(sec => (
                    <div key={sec} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-150 dark:border-gray-800 text-xs">
                      <span className="font-semibold">{sec}</span>
                      <button
                        onClick={() => handleRemoveToolSection(sec)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            {/* Manual Pruning trigger */}
            <div className={`p-6 ${containerClass} flex flex-col justify-between`}>
              <div>
                <h3 className="text-sm font-extrabold mb-4 border-b pb-2 uppercase text-gray-400">
                  Staffroom Pruning Controls
                </h3>

                <div className={bannerClass}>
                  <span className="text-base mr-2 block mb-1">🧼 Data Storage Policies</span>
                  To maintain database optimization guidelines, temporary media attachments contributed to Staffroom forum responses are archived and pruned automatically after 30 days. Text discussions remain completely intact.
                </div>

                <div className="mt-6 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Cleared Attachments:</span>
                    <span className="font-bold">{pruningLog.pruned_count || 0} files</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Reclaimed Hosting Space:</span>
                    <span className="font-bold text-purple-650">{(pruningLog.space_saved_mb || 0).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Last Cleanup Run:</span>
                    <span className="font-bold">
                      {pruningLog.last_pruned_at
                        ? new Date(pruningLog.last_pruned_at.seconds * 1000).toLocaleString()
                        : "Never"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleManualPruningOverride}
                disabled={loadingAction}
                className={btnClass("indigo") + " w-full mt-6"}
              >
                {loadingAction ? "Cleaning up..." : "🧹 Run Manual Pruning Override"}
              </button>
            </div>

            {/* Developer Sandbox Testing Utilities */}
            <div className={`p-6 ${containerClass} flex flex-col justify-between`}>
              <div>
                <h3 className="text-sm font-extrabold border-b pb-2 uppercase text-gray-400">
                  Developer Sandbox Testing Utilities
                </h3>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  Use these staging controls to seed or wipe highly realistic placeholder documents (`is_placeholder: true`) across `/memes`, `/templates`, and `/external_links` database paths to quickly evaluate UI bindings.
                </p>
              </div>
              <div className="flex flex-wrap gap-4 pt-6">
                <button
                  onClick={handleSeedTestData}
                  disabled={isSeeding}
                  className={btnClass("purple")}
                >
                  {isSeeding ? "Seeding..." : "🌱 Seed Sandbox Test Data"}
                </button>
                <button
                  onClick={handleWipePlaceholderData}
                  disabled={isWiping}
                  className={btnClass("red") + " border border-red-650 bg-red-900/10 hover:bg-red-900/20 text-red-500"}
                >
                  {isWiping ? "Wiping..." : "🗑️ Wipe Placeholder Data"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB CONTENT G: CONTENT MANAGER (Admin Only — Universal Authority) */}
      {activeTab === "content" && profile.role === "admin" && (
        <div className="space-y-6">

          {/* Sub-tab switcher + search bar */}
          <div className={`p-4 ${containerClass} flex flex-col sm:flex-row sm:items-center gap-4`}>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "memes", label: "🧪 All Memes", count: memes.length },
                { id: "resources", label: "📄 All Resources", count: resources.length },
                { id: "posts", label: "💬 All Posts", count: staffroomAllPosts.length },
                { id: "templates", label: "🖼️ All Templates", count: templates.length },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => {
                    setContentManagerTab(st.id);
                    setCmSearch("");
                    // Reset all per-tab filters and selections on switch
                    setCmMemeVisibility("all"); setCmMemeFormat("all"); setCmMemeCreator("all"); setCmMemeSelected(new Set());
                    setCmResStatus("all"); setCmResType("all"); setCmResCreator("all"); setCmResSelected(new Set());
                    setCmPostVisibility("all"); setCmPostType("all"); setCmPostCreator("all"); setCmPostSelected(new Set());
                    setCmTplStatus("all"); setCmTplFormat("all"); setCmTplCreator("all"); setCmTplStory("all"); setCmTplSelected(new Set());
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${contentManagerTab === st.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : highContrastMode
                        ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        : "bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                    }`}
                >
                  {st.label} <span className="opacity-60 font-normal">({st.count})</span>
                </button>
              ))}
            </div>
            <input
              type="text"
              value={cmSearch}
              onChange={e => setCmSearch(e.target.value)}
              className={`${inputClass} sm:w-72 sm:ml-auto`}
              placeholder="🔍 Search by title or creator ID..."
            />
          </div>

          {/* Authority legend */}
          <div className={bannerClass}>
            <span className="text-base mr-2">🛡️</span>
            <strong>Admin Content Authority</strong> — Full delete and visibility control over all platform content regardless of origin.{" "}
            <strong>Hide</strong> is reversible (soft-suppression from public feeds).{" "}
            <strong>Delete</strong> is permanent and irreversible.{" "}
            Content seeded by admin accounts is marked with{" "}
            <span className="inline-block bg-purple-200 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 px-1.5 rounded font-mono text-[10px]">🔐 Admin</span>.
          </div>

          {/* ── ALL MEMES ──────────────────────────────────────────────────────── */}
          {contentManagerTab === "memes" && (() => {
            const lower = cmSearch.toLowerCase();
            // Dynamic option lists derived from live data
            const memeFormats = ["all", ...new Set(memes.map(m => m.format).filter(Boolean))];
            const filtered = memes.filter(m => {
              if (lower && !(
                (m.title || "").toLowerCase().includes(lower) ||
                (m.creator_id || "").toLowerCase().includes(lower) ||
                (m.subject || "").toLowerCase().includes(lower)
              )) return false;
              if (cmMemeVisibility !== "all" && m.visibility !== cmMemeVisibility) return false;
              if (cmMemeFormat !== "all" && m.format !== cmMemeFormat) return false;
              if (cmMemeCreator === "admin" && m.creator_id !== user?.uid) return false;
              if (cmMemeCreator === "user" && m.creator_id === user?.uid) return false;
              return true;
            });
            const anyMemeFilter = cmMemeVisibility !== "all" || cmMemeFormat !== "all" || cmMemeCreator !== "all";
            // Selection helpers
            const isAllMemesSelected = filtered.length > 0 && filtered.every(m => cmMemeSelected.has(m.id));
            const isSomeMemesSelected = filtered.some(m => cmMemeSelected.has(m.id));
            const toggleMeme = (id) => setCmMemeSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
            const toggleAllMemes = () => {
              if (isAllMemesSelected) setCmMemeSelected(prev => { const n = new Set(prev); filtered.forEach(m => n.delete(m.id)); return n; });
              else setCmMemeSelected(prev => { const n = new Set(prev); filtered.forEach(m => n.add(m.id)); return n; });
            };
            const memesTotalPages = Math.max(1, Math.ceil(filtered.length / 10));
            const memesPage = Math.min(cmMemesPage, memesTotalPages);
            const pageItems = filtered.slice((memesPage - 1) * 10, memesPage * 10);
            const draftCount = memes.filter(m => m.visibility === "draft").length;
            const selectAllDrafts = () => {
              setCmMemeVisibility("draft");
              setCmMemeSelected(new Set(memes.filter(m => m.visibility === "draft").map(m => m.id)));
            };
            return (
              <div className={`p-6 ${containerClass}`}>
                <h3 className="text-sm font-extrabold mb-1 border-b pb-2 uppercase text-indigo-600 dark:text-indigo-400">
                  All Memes — Full Catalog ({filtered.length} of {memes.length})
                </h3>
                <p className="text-xs text-gray-400 mb-2">
                  Includes public, draft, flagged-hidden, and admin-hidden memes. Hide suppresses from Library feed; Delete is permanent.
                </p>

                {draftCount > 0 && (
                  <div className="flex items-center flex-wrap gap-2 mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                    <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                      📝 {draftCount} unpublished draft{draftCount !== 1 ? "s" : ""} — auto-saved by the Lab every 30s while editing, never shown in the public Library.
                    </span>
                    <button
                      onClick={selectAllDrafts}
                      className="ml-auto text-[10px] font-bold text-amber-700 dark:text-amber-300 underline hover:no-underline"
                    >
                      🧹 Select all {draftCount} drafts
                    </button>
                  </div>
                )}

                {/* Memes filter bar */}
                <div className="flex flex-wrap gap-2 mb-4 items-center">
                  <select value={cmMemeVisibility} onChange={e => setCmMemeVisibility(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Visibility</option>
                    <option value="public">✅ Public</option>
                    <option value="draft">📝 Draft</option>
                    <option value="flagged_hidden">🏳️ Flagged</option>
                    <option value="admin_hidden">🚫 Admin Hidden</option>
                  </select>
                  <select value={cmMemeFormat} onChange={e => setCmMemeFormat(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Formats</option>
                    {memeFormats.filter(f => f !== "all").map(f => (
                      <option key={f} value={f} className="capitalize">{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                    ))}
                  </select>
                  <select value={cmMemeCreator} onChange={e => setCmMemeCreator(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Creators</option>
                    <option value="admin">🔐 Admin-seeded</option>
                    <option value="user">👤 User-created</option>
                  </select>
                  {anyMemeFilter && (
                    <button
                      onClick={() => { setCmMemeVisibility("all"); setCmMemeFormat("all"); setCmMemeCreator("all"); }}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 underline hover:no-underline"
                    >✕ Clear filters</button>
                  )}
                  <span className="ml-auto text-[10px] text-gray-400 font-semibold">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Bulk action bar — Memes */}
                {cmMemeSelected.size > 0 && (
                  <div className="flex flex-wrap items-center gap-3 mb-3 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-900">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{cmMemeSelected.size} selected</span>
                    {!filtered.every(m => cmMemeSelected.has(m.id)) && (
                      <button onClick={() => setCmMemeSelected(prev => { const n = new Set(prev); filtered.forEach(m => n.add(m.id)); return n; })} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                        + Select all {filtered.length} in view
                      </button>
                    )}
                    <button onClick={() => setCmMemeSelected(new Set())} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">✕ Clear selection</button>
                    <button onClick={() => handleBulkDeleteMemes([...cmMemeSelected])} className={`${btnClass("red")} ml-auto`}>
                      🗑️ Delete {cmMemeSelected.size} selected
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={headerCellClass}>
                          <input
                            type="checkbox"
                            checked={isAllMemesSelected}
                            ref={el => { if (el) el.indeterminate = isSomeMemesSelected && !isAllMemesSelected; }}
                            onChange={toggleAllMemes}
                            className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                            title="Select / deselect all in current view"
                          />
                        </th>
                        <th className={headerCellClass}>Preview</th>
                        <th className={headerCellClass}>Title / Format</th>
                        <th className={headerCellClass}>Subject</th>
                        <th className={headerCellClass}>Creator</th>
                        <th className={headerCellClass}>Visibility</th>
                        <th className={headerCellClass}>Date</th>
                        <th className={headerCellClass}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map(meme => (
                        <tr key={meme.id} className={cmMemeSelected.has(meme.id) ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""}>
                          <td className={rowCellClass}>
                            <input
                              type="checkbox"
                              checked={cmMemeSelected.has(meme.id)}
                              onChange={() => toggleMeme(meme.id)}
                              className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                            />
                          </td>
                          <td className={rowCellClass}>
                            {meme.media_url ? (
                              <a href={meme.media_url} target="_blank" rel="noreferrer" title="Open media in new tab">
                                <img
                                  src={meme.media_url}
                                  alt={meme.title}
                                  className="w-14 h-10 object-cover rounded border border-gray-200 dark:border-gray-700 hover:opacity-80 transition"
                                />
                              </a>
                            ) : <span className="text-gray-400 text-[10px]">No media</span>}
                          </td>
                          <td className={rowCellClass}>
                            <span className="font-semibold block max-w-[180px] truncate">{meme.title || "Untitled"}</span>
                            {meme.format && <span className="text-[10px] text-gray-400 capitalize">{meme.format}</span>}
                          </td>
                          <td className={rowCellClass}>{meme.subject || "—"}</td>
                          <td className={`${rowCellClass} font-mono text-[10px]`}>
                            {meme.creator_id === user?.uid ? (
                              <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-bold">🔐 Admin</span>
                            ) : (
                              <span className="truncate block max-w-[90px]">{meme.creator_id || "—"}</span>
                            )}
                          </td>
                          <td className={rowCellClass}>
                            {meme.visibility === "admin_hidden" ? (
                              <span className="bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-[10px] font-bold">🚫 Admin Hidden</span>
                            ) : meme.visibility === "flagged_hidden" ? (
                              <span className="bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded text-[10px] font-bold">🏳️ Flagged</span>
                            ) : meme.visibility === "draft" ? (
                              <span className="bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">📝 Draft</span>
                            ) : (
                              <span className="bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-[10px] font-bold">✅ Public</span>
                            )}
                          </td>
                          <td className={rowCellClass}>
                            {meme.created_at ? new Date(meme.created_at.seconds * 1000).toLocaleDateString() : "—"}
                          </td>
                          <td className={rowCellClass}>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleQuickHighlight("meme", meme)}
                                className={btnClass("purple")}
                                title="Feature this meme in the homepage highlights"
                              >
                                ⭐ Highlight
                              </button>
                              <button
                                onClick={() => handleAdminToggleMemeVisibility(meme.id, meme.visibility)}
                                className={btnClass(meme.visibility === "admin_hidden" ? "green" : "gray")}
                                title={meme.visibility === "admin_hidden" ? "Restore to public Library" : "Hide from public Library"}
                              >
                                {meme.visibility === "admin_hidden" ? "👁️ Unhide" : "🚫 Hide"}
                              </button>
                              <button
                                onClick={() => handleAdminDeleteMeme(meme.id, meme.title)}
                                className={btnClass("red")}
                                title="Permanently delete this meme"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-6">No memes match your search query.</p>
                  )}
                  <AdminPagination page={memesPage} setPage={setCmMemesPage} total={filtered.length} pageSize={10} />
                </div>
              </div>
            );
          })()}

          {/* ── ALL RESOURCES ──────────────────────────────────────────────────── */}
          {contentManagerTab === "resources" && (() => {
            const lower = cmSearch.toLowerCase();
            // Derive unique resource types from live data
            const resTypes = ["all", ...new Set(resources.map(r => r.type).filter(Boolean))];
            const filtered = resources.filter(r => {
              if (lower && !(
                (r.title || "").toLowerCase().includes(lower) ||
                (r.author_id || "").toLowerCase().includes(lower) ||
                (r.type || "").toLowerCase().includes(lower) ||
                (r.subject || "").toLowerCase().includes(lower)
              )) return false;
              if (cmResStatus !== "all") {
                const resStatus = r.status === "admin_hidden" ? "admin_hidden"
                  : r.status === "hidden_moderation" ? "hidden_moderation"
                    : r.admin_approved ? "approved" : "pending";
                if (resStatus !== cmResStatus) return false;
              }
              if (cmResType !== "all" && r.type !== cmResType) return false;
              if (cmResCreator === "admin" && r.author_id !== user?.uid) return false;
              if (cmResCreator === "user" && r.author_id === user?.uid) return false;
              return true;
            });
            const anyResFilter = cmResStatus !== "all" || cmResType !== "all" || cmResCreator !== "all";
            // Selection helpers
            const isAllResSelected = filtered.length > 0 && filtered.every(r => cmResSelected.has(r.id));
            const isSomeResSelected = filtered.some(r => cmResSelected.has(r.id));
            const toggleRes = (id) => setCmResSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
            const toggleAllRes = () => {
              if (isAllResSelected) setCmResSelected(prev => { const n = new Set(prev); filtered.forEach(r => n.delete(r.id)); return n; });
              else setCmResSelected(prev => { const n = new Set(prev); filtered.forEach(r => n.add(r.id)); return n; });
            };
            const resTotalPages = Math.max(1, Math.ceil(filtered.length / 10));
            const resPage = Math.min(cmResourcesPage, resTotalPages);
            const pageItems = filtered.slice((resPage - 1) * 10, resPage * 10);
            return (
              <div className={`p-6 ${containerClass}`}>
                <h3 className="text-sm font-extrabold mb-1 border-b pb-2 uppercase text-indigo-600 dark:text-indigo-400">
                  All Resources — Full Catalog ({filtered.length} of {resources.length})
                </h3>
                <p className="text-xs text-gray-400 mb-2">
                  Includes approved, pending, and admin-hidden resources. Hide removes from Meme Reads gallery; Delete removes the document permanently.
                </p>

                {/* Resources filter bar */}
                <div className="flex flex-wrap gap-2 mb-4 items-center">
                  <select value={cmResStatus} onChange={e => setCmResStatus(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Statuses</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="admin_hidden">Admin Hidden</option>
                    <option value="hidden_moderation">Moderation Queue</option>
                  </select>
                  <select value={cmResType} onChange={e => setCmResType(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Types</option>
                    {resTypes.filter(t => t !== "all").map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                  <select value={cmResCreator} onChange={e => setCmResCreator(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Authors</option>
                    <option value="admin">🔐 Admin-seeded</option>
                    <option value="user">👤 User-created</option>
                  </select>
                  {anyResFilter && (
                    <button
                      onClick={() => { setCmResStatus("all"); setCmResType("all"); setCmResCreator("all"); }}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 underline hover:no-underline"
                    >✕ Clear filters</button>
                  )}
                  <span className="ml-auto text-[10px] text-gray-400 font-semibold">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Bulk action bar — Resources */}
                {cmResSelected.size > 0 && (
                  <div className="flex flex-wrap items-center gap-3 mb-3 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-900">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{cmResSelected.size} selected</span>
                    {!filtered.every(r => cmResSelected.has(r.id)) && (
                      <button onClick={() => setCmResSelected(prev => { const n = new Set(prev); filtered.forEach(r => n.add(r.id)); return n; })} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                        + Select all {filtered.length} in view
                      </button>
                    )}
                    <button onClick={() => setCmResSelected(new Set())} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">✕ Clear selection</button>
                    <button onClick={() => handleBulkDeleteResources([...cmResSelected])} className={`${btnClass("red")} ml-auto`}>
                      🗑️ Delete {cmResSelected.size} selected
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={headerCellClass}>
                          <input
                            type="checkbox"
                            checked={isAllResSelected}
                            ref={el => { if (el) el.indeterminate = isSomeResSelected && !isAllResSelected; }}
                            onChange={toggleAllRes}
                            className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                            title="Select / deselect all in current view"
                          />
                        </th>
                        <th className={headerCellClass}>Title</th>
                        <th className={headerCellClass}>Type</th>
                        <th className={headerCellClass}>Subject</th>
                        <th className={headerCellClass}>Author</th>
                        <th className={headerCellClass}>Status</th>
                        <th className={headerCellClass}>Date</th>
                        <th className={headerCellClass}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map(res => (
                        <tr key={res.id} className={cmResSelected.has(res.id) ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""}>
                          <td className={rowCellClass}>
                            <input
                              type="checkbox"
                              checked={cmResSelected.has(res.id)}
                              onChange={() => toggleRes(res.id)}
                              className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                            />
                          </td>
                          <td className={rowCellClass}>
                            <span className="font-semibold block max-w-[200px] truncate">{res.title || "Untitled"}</span>
                            {res.file_url && (
                              <a href={res.file_url} target="_blank" rel="noreferrer" className="text-indigo-600 text-[9px] hover:underline">
                                View File ↗
                              </a>
                            )}
                          </td>
                          <td className={`${rowCellClass} capitalize`}>{(res.type || "—").replace(/_/g, " ")}</td>
                          <td className={rowCellClass}>{res.subject || "—"}</td>
                          <td className={`${rowCellClass} font-mono text-[10px]`}>
                            {res.author_id === user?.uid ? (
                              <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-bold">🔐 Admin</span>
                            ) : (
                              <span className="truncate block max-w-[90px]">{res.author_id || "—"}</span>
                            )}
                          </td>
                          <td className={rowCellClass}>
                            {res.status === "admin_hidden" ? (
                              <span className="bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><EyeOff className="w-3 h-3 text-red-500" /> Admin Hidden</span>
                            ) : res.status === "hidden_moderation" ? (
                              <span className="bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3 text-orange-500" /> Moderation</span>
                            ) : res.admin_approved ? (
                              <span className="bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Approved</span>
                            ) : (
                              <span className="bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><Clock className="w-3 h-3 text-yellow-600" /> Pending</span>
                            )}
                          </td>
                          <td className={rowCellClass}>
                            {res.created_at ? new Date(res.created_at.seconds * 1000).toLocaleDateString() : "—"}
                          </td>
                          <td className={rowCellClass}>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleQuickHighlight(
                                  res.type === "activity" ? "activity" : (res.type === "stories" || res.type === "story") ? "meme_story" : "resource",
                                  res
                                )}
                                className={btnClass("purple")}
                                title="Feature this in the homepage highlights"
                              >
                                ⭐ Highlight
                              </button>
                              <button
                                onClick={() => handleAdminToggleResourceVisibility(res.id, res.status)}
                                className={btnClass(res.status === "admin_hidden" ? "green" : "gray")}
                                title={res.status === "admin_hidden" ? "Restore to Meme Reads" : "Hide from Meme Reads"}
                              >
                                {res.status === "admin_hidden" ? "👁️ Restore" : "🚫 Hide"}
                              </button>
                              <button
                                onClick={() => handleDeleteResourceAdmin(res.id)}
                                className={btnClass("red")}
                                title="Permanently delete this resource"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-6">No resources match your search query.</p>
                  )}
                  <AdminPagination page={resPage} setPage={setCmResourcesPage} total={filtered.length} pageSize={10} />
                </div>
              </div>
            );
          })()}

          {/* ── ALL STAFFROOM POSTS ─────────────────────────────────────────────── */}
          {contentManagerTab === "posts" && (() => {
            const lower = cmSearch.toLowerCase();
            // Derive unique post types from live data
            const postTypes = ["all", ...new Set(staffroomAllPosts.map(p => p.post_type).filter(Boolean))];
            const filtered = staffroomAllPosts.filter(p => {
              if (lower && !(
                (p.title || p.body || "").toLowerCase().includes(lower) ||
                (p.author_id || "").toLowerCase().includes(lower)
              )) return false;
              if (cmPostVisibility === "visible" && p.visibility === "admin_hidden") return false;
              if (cmPostVisibility === "admin_hidden" && p.visibility !== "admin_hidden") return false;
              if (cmPostType !== "all" && (p.post_type || "story") !== cmPostType) return false;
              if (cmPostCreator === "admin" && p.author_id !== user?.uid) return false;
              if (cmPostCreator === "user" && p.author_id === user?.uid) return false;
              return true;
            });
            const anyPostFilter = cmPostVisibility !== "all" || cmPostType !== "all" || cmPostCreator !== "all";
            // Selection helpers
            const isAllPostsSelected = filtered.length > 0 && filtered.every(p => cmPostSelected.has(p.id));
            const isSomePostsSelected = filtered.some(p => cmPostSelected.has(p.id));
            const togglePost = (id) => setCmPostSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
            const toggleAllPosts = () => {
              if (isAllPostsSelected) setCmPostSelected(prev => { const n = new Set(prev); filtered.forEach(p => n.delete(p.id)); return n; });
              else setCmPostSelected(prev => { const n = new Set(prev); filtered.forEach(p => n.add(p.id)); return n; });
            };
            const postsTotalPages = Math.max(1, Math.ceil(filtered.length / 10));
            const postsPage = Math.min(cmPostsPage, postsTotalPages);
            const pageItems = filtered.slice((postsPage - 1) * 10, postsPage * 10);
            return (
              <div className={`p-6 ${containerClass}`}>
                <h3 className="text-sm font-extrabold mb-1 border-b pb-2 uppercase text-indigo-600 dark:text-indigo-400">
                  All Staffroom Posts ({filtered.length} of {staffroomAllPosts.length})
                </h3>
                <p className="text-xs text-gray-400 mb-2">
                  All threads including admin-posted announcements. Use Hide to suppress from the public feed without deleting. Reply deletion is inline.
                </p>

                {/* Posts filter bar */}
                <div className="flex flex-wrap gap-2 mb-4 items-center">
                  <select value={cmPostVisibility} onChange={e => setCmPostVisibility(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Visibility</option>
                    <option value="visible">✅ Visible</option>
                    <option value="admin_hidden">🚫 Admin Hidden</option>
                  </select>
                  <select value={cmPostType} onChange={e => setCmPostType(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Types</option>
                    {postTypes.filter(t => t !== "all").map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                  <select value={cmPostCreator} onChange={e => setCmPostCreator(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Authors</option>
                    <option value="admin">🔐 Admin-posted</option>
                    <option value="user">👤 User-posted</option>
                  </select>
                  {anyPostFilter && (
                    <button
                      onClick={() => { setCmPostVisibility("all"); setCmPostType("all"); setCmPostCreator("all"); }}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 underline hover:no-underline"
                    >✕ Clear filters</button>
                  )}
                  <span className="ml-auto text-[10px] text-gray-400 font-semibold">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Bulk action bar — Posts */}
                {cmPostSelected.size > 0 && (
                  <div className="flex flex-wrap items-center gap-3 mb-3 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-900">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{cmPostSelected.size} selected</span>
                    {!filtered.every(p => cmPostSelected.has(p.id)) && (
                      <button onClick={() => setCmPostSelected(prev => { const n = new Set(prev); filtered.forEach(p => n.add(p.id)); return n; })} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                        + Select all {filtered.length} in view
                      </button>
                    )}
                    <button onClick={() => setCmPostSelected(new Set())} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">✕ Clear selection</button>
                    <button onClick={() => handleBulkDeletePosts([...cmPostSelected])} className={`${btnClass("red")} ml-auto`}>
                      🗑️ Delete {cmPostSelected.size} selected
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={headerCellClass}>
                          <input
                            type="checkbox"
                            checked={isAllPostsSelected}
                            ref={el => { if (el) el.indeterminate = isSomePostsSelected && !isAllPostsSelected; }}
                            onChange={toggleAllPosts}
                            className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                            title="Select / deselect all in current view"
                          />
                        </th>
                        <th className={headerCellClass}>Thread / Body</th>
                        <th className={headerCellClass}>Type</th>
                        <th className={headerCellClass}>Author</th>
                        <th className={headerCellClass}>Visibility</th>
                        <th className={headerCellClass}>Replies</th>
                        <th className={headerCellClass}>Date</th>
                        <th className={headerCellClass}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map(post => {
                        const postReplies = staffroomAllReplies.filter(r => r.post_id === post.id);
                        const postLabel = post.title || post.body?.slice(0, 50) || "Untitled";
                        return (
                          <tr key={post.id} className={`align-top ${cmPostSelected.has(post.id) ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""}`}>
                            <td className={rowCellClass}>
                              <input
                                type="checkbox"
                                checked={cmPostSelected.has(post.id)}
                                onChange={() => togglePost(post.id)}
                                className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                              />
                            </td>
                            <td className={rowCellClass}>
                              <span className="font-semibold block max-w-[200px] truncate">{postLabel}</span>
                              {post.attachment_name && (
                                <span className="text-[10px] text-sky-600 dark:text-sky-400 block mt-0.5">📎 {post.attachment_name}</span>
                              )}
                              {post.is_announcement && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 block mt-0.5">📢 Announcement</span>
                              )}
                            </td>
                            <td className={`${rowCellClass} capitalize`}>{post.post_type || "story"}</td>
                            <td className={`${rowCellClass} font-mono text-[10px]`}>
                              {post.author_id === user?.uid ? (
                                <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-bold">🔐 Admin</span>
                              ) : (
                                <span className="truncate block max-w-[90px]">{post.author_id || "—"}</span>
                              )}
                            </td>
                            <td className={rowCellClass}>
                              {post.visibility === "admin_hidden" ? (
                                <span className="bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-[10px] font-bold">🚫 Hidden</span>
                              ) : (
                                <span className="bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-[10px] font-bold">✅ Visible</span>
                              )}
                            </td>
                            <td className={rowCellClass}>
                              <span className="font-bold text-gray-600 dark:text-gray-300">{postReplies.length}</span>
                            </td>
                            <td className={rowCellClass}>
                              {post.created_at ? new Date(post.created_at.seconds * 1000).toLocaleDateString() : "—"}
                            </td>
                            <td className={rowCellClass}>
                              <div className="flex space-x-2 mb-2">
                                <button
                                  onClick={() => handleQuickHighlight("staffroom_post", { ...post, title: postLabel })}
                                  className={btnClass("purple")}
                                  title="Feature this post in the homepage highlights"
                                >
                                  ⭐ Highlight
                                </button>
                                <button
                                  onClick={() => handleAdminTogglePostVisibility(post.id, post.visibility)}
                                  className={btnClass(post.visibility === "admin_hidden" ? "green" : "gray")}
                                >
                                  {post.visibility === "admin_hidden" ? "👁️ Restore" : "🚫 Hide"}
                                </button>
                                <button
                                  onClick={() => handleAdminDeletePost(post.id, postLabel)}
                                  className={btnClass("red")}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                              {/* Inline reply management */}
                              {postReplies.length > 0 && (
                                <div className="space-y-1 border-t border-gray-150 dark:border-gray-800 pt-2">
                                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Replies:</span>
                                  {postReplies.map(reply => (
                                    <div
                                      key={reply.id}
                                      className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg px-2 py-1 border border-gray-150 dark:border-gray-800"
                                    >
                                      <span className="text-[10px] truncate max-w-[140px] text-gray-600 dark:text-gray-400">
                                        {reply.body?.slice(0, 55) || "—"}
                                      </span>
                                      <button
                                        onClick={() => handleAdminDeleteReply(reply.id)}
                                        className="text-red-500 hover:text-red-700 font-bold text-[10px] shrink-0 hover:underline"
                                        title="Delete this reply"
                                      >
                                        ✕ Del
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filtered.length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-6">No posts match your search query.</p>
                  )}
                  <AdminPagination page={postsPage} setPage={setCmPostsPage} total={filtered.length} pageSize={10} />
                </div>
              </div>
            );
          })()}

          {/* ── ALL TEMPLATES ──────────────────────────────────────────────────── */}
          {contentManagerTab === "templates" && (() => {
            const lower = cmSearch.toLowerCase();
            // Derive unique template formats from live data
            const tplFormats = ["all", ...new Set(templates.map(t => t.format).filter(Boolean))];
            const filtered = templates.filter(t => {
              if (lower && !(
                (t.title || "").toLowerCase().includes(lower) ||
                (t.creator_id || "").toLowerCase().includes(lower)
              )) return false;
              if (cmTplStatus !== "all" && (t.status || "pending") !== cmTplStatus) return false;
              if (cmTplFormat !== "all" && t.format !== cmTplFormat) return false;
              if (cmTplCreator === "admin" && t.creator_id !== user?.uid) return false;
              if (cmTplCreator === "user" && t.creator_id === user?.uid) return false;
              if (cmTplStory === "linked" && !storyTemplateIds.has(t.id)) return false;
              if (cmTplStory === "unlinked" && storyTemplateIds.has(t.id)) return false;
              return true;
            });
            const unlinkedCount = templates.filter(t => !storyTemplateIds.has(t.id)).length;
            const anyTplFilter = cmTplStatus !== "all" || cmTplFormat !== "all" || cmTplCreator !== "all" || cmTplStory !== "all";
            // Selection helpers
            const isAllTplSelected = filtered.length > 0 && filtered.every(t => cmTplSelected.has(t.id));
            const isSomeTplSelected = filtered.some(t => cmTplSelected.has(t.id));
            const toggleTpl = (id) => setCmTplSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
            const toggleAllTpl = () => {
              if (isAllTplSelected) setCmTplSelected(prev => { const n = new Set(prev); filtered.forEach(t => n.delete(t.id)); return n; });
              else setCmTplSelected(prev => { const n = new Set(prev); filtered.forEach(t => n.add(t.id)); return n; });
            };
            // One click: switch the view to templates with no linked meme story
            // (the "unreviewed / not from the Meme Stories pipeline" set) and
            // pre-select all of them across the whole catalog, ready to review
            // and bulk-delete below.
            const selectAllWithoutStory = () => {
              setCmTplStory("unlinked");
              setCmTplSelected(new Set(templates.filter(t => !storyTemplateIds.has(t.id)).map(t => t.id)));
            };
            const tplTotalPages = Math.max(1, Math.ceil(filtered.length / 10));
            const tplPage = Math.min(cmTemplatesPage, tplTotalPages);
            const pageItems = filtered.slice((tplPage - 1) * 10, tplPage * 10);
            return (
              <div className={`p-6 ${containerClass}`}>
                <h3 className="text-sm font-extrabold mb-1 border-b pb-2 uppercase text-indigo-600 dark:text-indigo-400">
                  All Templates — Full Catalog ({filtered.length} of {templates.length})
                </h3>
                <p className="text-xs text-gray-400 mb-2">
                  Includes pending, approved, and rejected templates. Delete permanently removes the document (unlike Reject in the Moderation tab which only changes status).
                </p>

                {unlinkedCount > 0 && (
                  <div className="flex items-center flex-wrap gap-2 mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
                    <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                      ⚠️ {unlinkedCount} template{unlinkedCount !== 1 ? "s" : ""} {unlinkedCount !== 1 ? "aren't" : "isn't"} linked to a Meme Story — outside the intended contribute-a-story pipeline.
                    </span>
                    <button
                      onClick={selectAllWithoutStory}
                      className="ml-auto text-[10px] font-bold text-amber-700 dark:text-amber-300 underline hover:no-underline"
                    >
                      🧹 Select all {unlinkedCount} without a story
                    </button>
                  </div>
                )}

                {/* Templates filter bar */}
                <div className="flex flex-wrap gap-2 mb-4 items-center">
                  <select value={cmTplStatus} onChange={e => setCmTplStatus(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Statuses</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <select value={cmTplFormat} onChange={e => setCmTplFormat(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Formats</option>
                    {tplFormats.filter(f => f !== "all").map(f => (
                      <option key={f} value={f} className="capitalize">{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                    ))}
                  </select>
                  <select value={cmTplCreator} onChange={e => setCmTplCreator(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Creators</option>
                    <option value="admin">Admin-seeded</option>
                    <option value="user">User-submitted</option>
                  </select>
                  <select value={cmTplStory} onChange={e => setCmTplStory(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">Linked + Unlinked</option>
                    <option value="linked">📖 Linked to a Story</option>
                    <option value="unlinked">⚠️ No Story</option>
                  </select>
                  {anyTplFilter && (
                    <button
                      onClick={() => { setCmTplStatus("all"); setCmTplFormat("all"); setCmTplCreator("all"); setCmTplStory("all"); }}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 underline hover:no-underline"
                    >✕ Clear filters</button>
                  )}
                  <span className="ml-auto text-[10px] text-gray-400 font-semibold">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Bulk action bar — Templates */}
                {cmTplSelected.size > 0 && (
                  <div className="flex flex-wrap items-center gap-3 mb-3 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-900">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{cmTplSelected.size} selected</span>
                    {!filtered.every(t => cmTplSelected.has(t.id)) && (
                      <button onClick={() => setCmTplSelected(prev => { const n = new Set(prev); filtered.forEach(t => n.add(t.id)); return n; })} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                        + Select all {filtered.length} in view
                      </button>
                    )}
                    <button onClick={() => setCmTplSelected(new Set())} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">✕ Clear selection</button>
                    <button onClick={() => handleBulkDeleteTemplates([...cmTplSelected])} className={`${btnClass("red")} ml-auto`}>
                      🗑️ Delete {cmTplSelected.size} selected
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={headerCellClass}>
                          <input
                            type="checkbox"
                            checked={isAllTplSelected}
                            ref={el => { if (el) el.indeterminate = isSomeTplSelected && !isAllTplSelected; }}
                            onChange={toggleAllTpl}
                            className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                            title="Select / deselect all in current view"
                          />
                        </th>
                        <th className={headerCellClass}>Preview</th>
                        <th className={headerCellClass}>Title</th>
                        <th className={headerCellClass}>Format</th>
                        <th className={headerCellClass}>Creator</th>
                        <th className={headerCellClass}>Story</th>
                        <th className={headerCellClass}>Status</th>
                        <th className={headerCellClass}>Date</th>
                        <th className={headerCellClass}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map(temp => (
                        <tr key={temp.id} className={cmTplSelected.has(temp.id) ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""}>
                          <td className={rowCellClass}>
                            <input
                              type="checkbox"
                              checked={cmTplSelected.has(temp.id)}
                              onChange={() => toggleTpl(temp.id)}
                              className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                            />
                          </td>
                          <td className={rowCellClass}>
                            {temp.media_url ? (
                              <a href={temp.media_url} target="_blank" rel="noreferrer" title="Open template media">
                                <img
                                  src={temp.media_url}
                                  alt={temp.title}
                                  className="w-14 h-10 object-cover rounded border border-gray-200 dark:border-gray-700 hover:opacity-80 transition"
                                />
                              </a>
                            ) : <span className="text-gray-400 text-[10px]">No media</span>}
                          </td>
                          <td className={rowCellClass}>
                            <span className="font-semibold block max-w-[180px] truncate">{temp.title || "Untitled"}</span>
                          </td>
                          <td className={`${rowCellClass} capitalize`}>{temp.format || "—"}</td>
                          <td className={rowCellClass}>
                            {storyTemplateIds.has(temp.id) ? (
                              <span className="bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">📖 Linked</span>
                            ) : (
                              <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">⚠️ No story</span>
                            )}
                          </td>
                          <td className={`${rowCellClass} font-mono text-[10px]`}>
                            {temp.creator_id === user?.uid ? (
                              <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-bold">🔐 Admin</span>
                            ) : (
                              <span className="truncate block max-w-[90px]">{temp.creator_id || "—"}</span>
                            )}
                          </td>
                          <td className={rowCellClass}>
                            <div className="flex items-center gap-1 flex-wrap">
                              {temp.status === "approved" ? (
                                <span className="bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Approved</span>
                              ) : temp.status === "rejected" ? (
                                <span className="bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3 text-red-500" /> Rejected</span>
                              ) : (
                                <span className="bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><Clock className="w-3 h-3 text-yellow-600" /> Pending</span>
                              )}
                              {temp.is_featured && <Star className="w-3 h-3 text-amber-500 fill-current" />}
                            </div>
                          </td>
                          <td className={rowCellClass}>
                            {temp.created_at ? new Date(temp.created_at.seconds * 1000).toLocaleDateString() : "—"}
                          </td>
                          <td className={rowCellClass}>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleToggleFeatureTemplate(temp.id, !!temp.is_featured)}
                                className={btnClass(temp.is_featured ? "gray" : "purple")}
                                title={temp.is_featured ? "Remove from featured" : "Mark as featured"}
                              >
                                {temp.is_featured ? "✰ Unfeature" : "⭐ Feature"}
                              </button>
                              <button
                                onClick={() => handleAdminHardDeleteTemplate(temp.id, temp.title)}
                                className={btnClass("red")}
                                title="Permanently delete this template document"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-6">No templates match your search query.</p>
                  )}
                  <AdminPagination page={tplPage} setPage={setCmTemplatesPage} total={filtered.length} pageSize={10} />
                </div>
              </div>
            );
          })()}

        </div>
      )}

      {/* TAB CONTENT: LITERACY TESTS */}
      {activeTab === "literacy_tests" && (() => {
        const ltInputClass = `w-full px-3 py-2 rounded-lg border text-sm ${containerClass} border-gray-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500`;
        const ltBtnPrimary = "bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition";
        const ltBtnGhost = "border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 font-bold px-4 py-2 rounded-lg text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 transition";
        const ltBtnDanger = "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-red-100 dark:hover:bg-red-950/40 transition";
        const ltSectionClass = `${containerClass} rounded-2xl p-5 space-y-4`;

        const activeTests = literacyTests.filter(t => t.is_active);
        const currentTestQuestions = literacyQuestions.filter(q => q.test_id === ltActiveTestId);
        const currentTest = literacyTests.find(t => t.id === ltActiveTestId);

        const DIFFICULTY_OPTIONS = [
          { value: "beginner", label: "🌱 Beginner" },
          { value: "intermediate", label: "🔍 Intermediate" },
          { value: "advanced", label: "🎓 Advanced" },
          { value: "expert", label: "🏛️ Expert" },
        ];

        const TestForm = ({ editId }) => (
          <div className={ltSectionClass}>
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => { ltResetTestForm(); setLtView("list"); }} className={ltBtnGhost}>← Back to Tests</button>
              <h3 className="text-base font-extrabold">{editId ? "Edit Test" : "New Test"}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Test Title *</label>
                <input value={ltfTitle} onChange={e => setLtfTitle(e.target.value)} className={ltInputClass} placeholder="e.g. Critical Meme Literacy Assessment" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Category / Subject</label>
                <input value={ltfCategory} onChange={e => setLtfCategory(e.target.value)} className={ltInputClass} placeholder="e.g. Media Literacy, Biology" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Description</label>
                <textarea value={ltfDesc} onChange={e => setLtfDesc(e.target.value)} rows={3} className={ltInputClass} placeholder="Brief description of what this test assesses..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Difficulty Level</label>
                <select value={ltfDifficulty} onChange={e => setLtfDifficulty(e.target.value)} className={ltInputClass}>
                  {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Pass Threshold (%)</label>
                <input type="number" min={0} max={100} value={ltfPassThreshold} onChange={e => setLtfPassThreshold(e.target.value)} className={ltInputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Badge Icon (emoji)</label>
                <input value={ltfBadgeIcon} onChange={e => setLtfBadgeIcon(e.target.value)} className={ltInputClass} placeholder="🏅" maxLength={4} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Badge Label</label>
                <input value={ltfBadgeLabel} onChange={e => setLtfBadgeLabel(e.target.value)} className={ltInputClass} placeholder="e.g. Meme Scholar, Media Critic" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="lt-active" checked={ltfIsActive} onChange={e => setLtfIsActive(e.target.checked)} className="w-4 h-4 accent-purple-600" />
              <label htmlFor="lt-active" className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Active (visible to users on the test page)</label>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleLtSaveTest(editId || null)} disabled={ltSaving} className={ltBtnPrimary}>
                {ltSaving ? "Saving…" : editId ? "Save Changes" : "Create Test"}
              </button>
              <button onClick={() => { ltResetTestForm(); setLtView("list"); }} className={ltBtnGhost}>Cancel</button>
            </div>
          </div>
        );

        const QuestionForm = ({ editId }) => (
          <div className={ltSectionClass}>
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => { ltResetQuestionForm(); setLtView("questions"); }} className={ltBtnGhost}>← Back to Questions</button>
              <h3 className="text-base font-extrabold">{editId ? "Edit Question" : "Add Question"}</h3>
              {currentTest && <span className="text-xs text-gray-400 dark:text-zinc-500">— {currentTest.title}</span>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Question Text *</label>
                <textarea value={ltqText} onChange={e => setLtqText(e.target.value)} rows={3} className={ltInputClass} placeholder="What does this meme suggest about its audience?" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Dimension / Tag</label>
                <input value={ltqDimension} onChange={e => setLtqDimension(e.target.value)} className={ltInputClass} placeholder="e.g. Critical Analysis, Context Awareness" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Display Order</label>
                <input type="number" min={0} value={ltqOrder} onChange={e => setLtqOrder(e.target.value)} className={ltInputClass} />
              </div>
              {/* Meme Image */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Meme Image (URL or upload)</label>
                <div className="flex gap-2">
                  <input value={ltqMemeUrl} onChange={e => setLtqMemeUrl(e.target.value)} className={ltInputClass} placeholder="https://… or upload below" />
                  <label className="flex-shrink-0 cursor-pointer flex items-center gap-1 border border-dashed border-gray-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 dark:text-zinc-400 hover:border-purple-400 hover:text-purple-600 transition">
                    📁 Upload
                    <input type="file" accept="image/*,video/*,image/gif" className="hidden" onChange={e => { setLtqMemeFile(e.target.files[0] || null); if (e.target.files[0]) setLtqMemeUrl(URL.createObjectURL(e.target.files[0])); }} />
                  </label>
                </div>
                {ltqMemeUrl && <img src={ltqMemeUrl} alt="preview" className="mt-2 max-h-32 rounded-lg border border-gray-200 dark:border-zinc-700 object-contain" />}
              </div>
              {/* 4 Options */}
              {[0, 1, 2, 3].map(i => (
                <div key={i}>
                  <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-2">
                    {["A", "B", "C", "D"][i]} Option *
                    <input type="radio" name="lt-correct" checked={ltqCorrectIdx === i} onChange={() => setLtqCorrectIdx(i)} className="ml-auto accent-green-600" title="Mark as correct answer" />
                    <span className="text-green-600 text-[10px]">Correct?</span>
                  </label>
                  <input value={ltqOptions[i]} onChange={e => { const o = [...ltqOptions]; o[i] = e.target.value; setLtqOptions(o); }} className={ltInputClass} placeholder={`Option ${["A","B","C","D"][i]}`} />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Explanation (shown after answering)</label>
                <textarea value={ltqExplanation} onChange={e => setLtqExplanation(e.target.value)} rows={3} className={ltInputClass} placeholder="Explain why the correct answer is right, with media literacy context…" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleLtSaveQuestion()} disabled={ltSaving} className={ltBtnPrimary}>
                {ltSaving ? "Saving…" : editId ? "Save Question" : "Add Question"}
              </button>
              <button onClick={() => { ltResetQuestionForm(); setLtView("questions"); }} className={ltBtnGhost}>Cancel</button>
            </div>
          </div>
        );

        return (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-extrabold">🧪 Literacy Tests</h2>
                <p className="text-xs text-gray-400 mt-0.5">{literacyTests.length} tests · {literacyQuestions.length} total questions</p>
              </div>
              {(ltView === "list") && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSeedStarterTest} 
                    disabled={ltSaving} 
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition flex items-center gap-1.5 shadow-sm"
                    title="Import or open the built-in 15-question starter test for editing"
                  >
                    🌱 {ltSaving ? "Importing..." : "Seed Starter Test"}
                  </button>
                  <button onClick={() => { ltResetTestForm(); setLtView("new_test"); }} className={ltBtnPrimary}>+ New Test</button>
                </div>
              )}
              {(ltView === "questions") && (
                <button onClick={() => { ltResetQuestionForm(); setLtView("new_question"); }} className={ltBtnPrimary}>+ Add Question</button>
              )}
            </div>

            {/* LIST VIEW */}
            {ltView === "list" && (
              <div className={ltSectionClass}>
                {literacyTests.length === 0 ? (
                  <div className="p-6 rounded-2xl border-2 border-dashed border-purple-200 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-950/20 text-center space-y-3">
                    <span className="text-4xl block">🌱</span>
                    <h3 className="font-extrabold text-base text-gray-800 dark:text-zinc-100">Ready to customize the Starter Assessment?</h3>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-md mx-auto">
                      Import the built-in 15-question Meme Literacy Starter Test into your database. Once imported, you can customize any question, change answer options, and upload or link your own meme images.
                    </p>
                    <div className="flex justify-center gap-3 pt-1">
                      <button 
                        onClick={handleSeedStarterTest} 
                        disabled={ltSaving} 
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md transition flex items-center gap-2"
                      >
                        🌱 {ltSaving ? "Importing Questions..." : "Import Starter Test to Database"}
                      </button>
                      <button 
                        onClick={() => { ltResetTestForm(); setLtView("new_test"); }} 
                        className={ltBtnGhost}
                      >
                        + Create Blank Test
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-3">
                  {literacyTests.map(test => (
                    <div key={test.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 hover:border-purple-300 dark:hover:border-purple-800 transition">
                      <span className="text-2xl">{test.badge_icon || "🧪"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-gray-800 dark:text-zinc-100 truncate">{test.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${test.is_active ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "bg-gray-200 dark:bg-zinc-800 text-gray-500"}`}>
                            {test.is_active ? "Active" : "Inactive"}
                          </span>
                          <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full capitalize">{test.difficulty}</span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{test.question_count || 0} questions · Pass at {test.pass_threshold || 60}%{test.category ? ` · ${test.category}` : ""}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => { setLtActiveTestId(test.id); setLtView("questions"); }} className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline px-2 py-1 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/20 transition">📝 Questions</button>
                        <button onClick={() => handleLtEditTestPrefill(test)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition">✏️ Edit</button>
                        <button onClick={() => handleLtDeleteTest(test.id, test.title)} className={ltBtnDanger}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* QUESTIONS VIEW */}
            {ltView === "questions" && (
              <div className={ltSectionClass}>
                <div className="flex items-center gap-3">
                  <button onClick={() => { setLtActiveTestId(null); setLtView("list"); }} className={ltBtnGhost}>← All Tests</button>
                  {currentTest && (
                    <div>
                      <span className="font-extrabold text-sm">{currentTest.badge_icon} {currentTest.title}</span>
                      <span className="ml-2 text-xs text-gray-400">({currentTestQuestions.length} questions)</span>
                    </div>
                  )}
                </div>
                {currentTestQuestions.length === 0 && <p className="text-sm text-gray-400 italic text-center py-6">No questions yet. Click "+ Add Question" to add the first one.</p>}
                <div className="space-y-2">
                  {currentTestQuestions.map((q, idx) => (
                    <div key={q.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                      <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-extrabold">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100 leading-snug line-clamp-2">{q.question_text}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {q.dimension && <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">{q.dimension}</span>}
                          <span className="text-[10px] text-gray-400">✓ {q.options?.[q.correct_index] || "?"}</span>
                          {q.meme_image_url && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">🖼️ Has meme</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => { setLtActiveTestId(q.test_id); handleLtEditQuestionPrefill(q); }} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition">✏️</button>
                        <button onClick={() => handleLtDeleteQuestion(q.id)} className={ltBtnDanger}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FORMS */}
            {(ltView === "new_test") && <TestForm editId={null} />}
            {(ltView === "edit_test") && <TestForm editId={ltActiveTestId} />}
            {(ltView === "new_question") && <QuestionForm editId={null} />}
            {(ltView === "edit_question") && <QuestionForm editId={ltqEditId} />}
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB: SLANG DECODER QUIZ — grow the question bank without a deploy
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "slang_quiz" && (() => {
        const sqInputClass = `w-full px-3 py-2 rounded-lg border text-sm ${containerClass} border-gray-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-teal-500`;
        const sqBtnPrimary = "bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition";
        const sqBtnGhost = "border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 font-bold px-4 py-2 rounded-lg text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 transition";
        const sqBtnDanger = "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-red-100 dark:hover:bg-red-950/40 transition";
        const sqSectionClass = `${containerClass} rounded-2xl p-5 space-y-4`;

        return (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-extrabold">🗣️ Slang Decoder</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {slangAdminSubTab === "quiz"
                    ? `${slangQuizQuestions.length} questions in the bank · quiz samples ${Math.min(10, slangQuizQuestions.length || 10)} at random per attempt`
                    : `${slangTerms.length} words in the dictionary · edit definitions, links & meme images`}
                </p>
              </div>
              {slangAdminSubTab === "quiz" && sqView === "list" && (
                <button onClick={() => { sqResetForm(); setSqView("form"); }} className={sqBtnPrimary}>+ Add Question</button>
              )}
              {slangAdminSubTab === "words" && stView === "list" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSeedStarterWords}
                    disabled={stSaving}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition flex items-center gap-1.5 shadow-sm"
                    title="Import the bundled starter words into the database so they can be edited and given meme images"
                  >
                    🌱 {stSaving ? "Importing..." : "Seed Starter Words"}
                  </button>
                  <button onClick={() => { stResetForm(); setStView("form"); }} className={sqBtnPrimary}>+ Add Word</button>
                </div>
              )}
            </div>

            {/* Sub-tab toggle */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-zinc-800 pb-2">
              <button
                onClick={() => setSlangAdminSubTab("quiz")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${slangAdminSubTab === "quiz" ? "bg-teal-600 text-white" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"}`}
              >
                🧪 Quiz Questions
              </button>
              <button
                onClick={() => setSlangAdminSubTab("words")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${slangAdminSubTab === "words" ? "bg-teal-600 text-white" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"}`}
              >
                📖 Manage Words
              </button>
            </div>

            {slangAdminSubTab === "quiz" && sqView === "list" && (
              <div className={sqSectionClass}>
                {slangQuizQuestions.length === 0 && (
                  <p className="text-sm text-gray-400 italic text-center py-6">
                    No admin-added questions yet — the quiz still works from a bundled 48-question starter bank. Add questions here to grow it further.
                  </p>
                )}
                <div className="space-y-2">
                  {slangQuizQuestions.map((q, idx) => (
                    <div key={q.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                      <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-xs font-extrabold">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100 leading-snug line-clamp-2">{q.question_text}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full capitalize">{q.category}</span>
                          <span className="text-[10px] text-gray-400">✓ {q.options?.[q.correct_index] || "?"}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${q.is_active !== false ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "bg-gray-200 dark:bg-zinc-800 text-gray-500"}`}>
                            {q.is_active !== false ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleSqEditPrefill(q)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition">✏️</button>
                        <button onClick={() => handleSqDeleteQuestion(q.id)} className={sqBtnDanger}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {slangAdminSubTab === "quiz" && sqView === "form" && (
              <div className={sqSectionClass}>
                <h3 className="font-extrabold text-sm">{sqEditId ? "Edit Question" : "Add Question"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Question Text *</label>
                    <textarea value={sqText} onChange={e => setSqText(e.target.value)} rows={3} className={sqInputClass} placeholder="What does 'no cap' mean?" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Category</label>
                    <select value={sqCategory} onChange={e => setSqCategory(e.target.value)} className={sqInputClass}>
                      <option value="genz">Gen Z</option>
                      <option value="genalpha">Gen Alpha</option>
                      <option value="internet">Internet Slang</option>
                      <option value="abbreviation">Abbreviation</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Active</label>
                    <label className="flex items-center gap-2 h-[38px]">
                      <input type="checkbox" checked={sqIsActive} onChange={e => setSqIsActive(e.target.checked)} className="w-4 h-4 accent-teal-600" />
                      <span className="text-xs text-gray-500">Include in the live quiz pool</span>
                    </label>
                  </div>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i}>
                      <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-2">
                        {["A", "B", "C", "D"][i]} Option *
                        <input type="radio" name="sq-correct" checked={sqCorrectIdx === i} onChange={() => setSqCorrectIdx(i)} className="ml-auto accent-green-600" title="Mark as correct answer" />
                        <span className="text-green-600 text-[10px]">Correct?</span>
                      </label>
                      <input value={sqOptions[i]} onChange={e => { const o = [...sqOptions]; o[i] = e.target.value; setSqOptions(o); }} className={sqInputClass} placeholder={`Option ${["A", "B", "C", "D"][i]}`} />
                    </div>
                  ))}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Explanation (shown after answering)</label>
                    <textarea value={sqExplanation} onChange={e => setSqExplanation(e.target.value)} rows={2} className={sqInputClass} placeholder="Explain what the term means and why the answer is correct…" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleSqSaveQuestion} disabled={sqSaving} className={sqBtnPrimary}>
                    {sqSaving ? "Saving…" : sqEditId ? "Save Question" : "Add Question"}
                  </button>
                  <button onClick={() => { sqResetForm(); setSqView("list"); }} className={sqBtnGhost}>Cancel</button>
                </div>
              </div>
            )}

            {/* ── Manage Words sub-tab ── */}
            {slangAdminSubTab === "words" && stView === "list" && (
              <div className={sqSectionClass}>
                {slangTerms.length === 0 && (
                  <div className="p-6 rounded-2xl border-2 border-dashed border-teal-200 dark:border-teal-800/50 bg-teal-50/50 dark:bg-teal-950/20 text-center space-y-3">
                    <span className="text-4xl block">🌱</span>
                    <h3 className="font-extrabold text-base text-gray-800 dark:text-zinc-100">The public dictionary is running on bundled starter words</h3>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-md mx-auto">
                      Those ~30 words (Rizz, Sigma, NPC, etc.) aren't in the database yet, so there's nothing here to edit or attach memes to. Import them once, then customize freely.
                    </p>
                    <button
                      onClick={handleSeedStarterWords}
                      disabled={stSaving}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md transition inline-flex items-center gap-2"
                    >
                      🌱 {stSaving ? "Importing..." : "Import Starter Words to Database"}
                    </button>
                  </div>
                )}
                <div className="space-y-2">
                  {slangTerms.map((t) => (
                    <div key={t.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-gray-800 dark:text-zinc-100">{t.term}</span>
                          <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full capitalize">{t.category}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === "approved" ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400"}`}>
                            {t.status === "approved" ? "Approved" : "Pending"}
                          </span>
                          {Array.isArray(t.meme_image_urls) && t.meme_image_urls.length > 0 && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">🖼️ {t.meme_image_urls.length}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 line-clamp-1">{t.definition}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleStEditPrefill(t)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition">✏️ Edit</button>
                        <button onClick={() => handleDeleteSlangTermAdmin(t.id, t.term)} className={sqBtnDanger}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {slangAdminSubTab === "words" && stView === "form" && (
              <div className={sqSectionClass}>
                <h3 className="font-extrabold text-sm">{stEditId ? "Edit Word" : "Add Word"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Term *</label>
                    <input value={stTerm} onChange={e => setStTerm(e.target.value)} className={sqInputClass} placeholder="e.g. Rizz" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Category</label>
                    <select value={stCategory} onChange={e => setStCategory(e.target.value)} className={sqInputClass}>
                      <option value="genz">Gen Z</option>
                      <option value="genalpha">Gen Alpha</option>
                      <option value="internet">Internet Slang</option>
                      <option value="abbreviation">Abbreviation</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Plain-Language Definition *</label>
                    <textarea value={stDefinition} onChange={e => setStDefinition(e.target.value)} rows={3} className={sqInputClass} placeholder="Explain it simply…" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Example Usage</label>
                    <input value={stExampleUsage} onChange={e => setStExampleUsage(e.target.value)} className={sqInputClass} placeholder='e.g. "That trick shot was so rizz."' />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-xs font-bold text-gray-500">Related Links</label>
                    {stLinks.map((link, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input value={link.title} onChange={e => { const l = [...stLinks]; l[idx] = { ...l[idx], title: e.target.value }; setStLinks(l); }} className={sqInputClass} placeholder="Link title" />
                        <input value={link.url} onChange={e => { const l = [...stLinks]; l[idx] = { ...l[idx], url: e.target.value }; setStLinks(l); }} className={sqInputClass} placeholder="https://..." />
                        {stLinks.length > 1 && (
                          <button type="button" onClick={() => setStLinks(stLinks.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 transition flex-shrink-0">✕</button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setStLinks([...stLinks, { title: "", url: "" }])} className="text-[11px] font-bold text-teal-600 hover:text-teal-700 transition">+ Add another link</button>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-xs font-bold text-gray-500">Meme Images</label>
                    {stExistingMemeUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {stExistingMemeUrls.map((url, idx) => (
                          <div key={idx} className="relative">
                            <img src={url} alt={`meme ${idx + 1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-zinc-700" />
                            <button
                              type="button"
                              onClick={() => handleStRemoveExistingMeme(idx)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold shadow"
                              title="Remove this image"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="cursor-pointer flex items-center gap-3 bg-gray-100 dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/20 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 transition">
                      <span className="text-xs text-gray-500">
                        {stNewMemeFiles.length > 0 ? `${stNewMemeFiles.length} new image(s) selected` : "Upload additional meme examples"}
                      </span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleStAddNewMemeFiles(e.target.files)} />
                    </label>
                    {stNewMemePreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {stNewMemePreviews.map((src, i) => (
                          <img key={i} src={src} alt={`new meme ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-zinc-700" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleStSaveTerm} disabled={stSaving} className={sqBtnPrimary}>
                    {stSaving ? "Saving…" : "Save Word"}
                  </button>
                  <button onClick={() => { stResetForm(); setStView("list"); }} className={sqBtnGhost}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB: HIGHLIGHTS — admin-curated Newspaper hero + homepage carousel
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "highlights" && (() => {
        const newspaperPicks = highlightDocs.filter(h => h.placement === "newspaper");
        const homePicks = highlightDocs.filter(h => h.placement === "home");

        const renderRow = (h, list, idx) => (
          <div key={h.id} className="flex items-center gap-3 p-4">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => handleHlReorder(h.placement, h.id, "up")} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30" aria-label="Move up">▲</button>
              <button onClick={() => handleHlReorder(h.placement, h.id, "down")} disabled={idx === list.length - 1} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30" aria-label="Move down">▼</button>
            </div>
            {h.image_url ? (
              <img src={h.image_url} alt="" className="w-14 h-10 object-cover rounded border border-gray-200 dark:border-zinc-700 flex-shrink-0" />
            ) : (
              <div className="w-14 h-10 rounded border border-gray-200 dark:border-zinc-700 flex-shrink-0 bg-gray-100 dark:bg-zinc-800" />
            )}
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex-shrink-0 bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300">
              {h.source_label || HIGHLIGHT_CONTENT_TYPES[h.content_type]?.label || h.content_type}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{h.title}</p>
              <p className="text-[11px] text-gray-400 truncate">{h.link}</p>
            </div>
            <button
              onClick={() => handleHlToggleActive(h)}
              className={`text-[10px] font-black px-2 py-0.5 rounded-full border transition ${
                h.active
                  ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400"
                  : "bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400"
              }`}
            >
              {h.active ? "● Live" : "○ Hidden"}
            </button>
            <button onClick={() => hlPrefillForm(h)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition">✏️ Edit</button>
            <button onClick={() => handleHlDelete(h)} className={btnClass("red")}>🗑️</button>
          </div>
        );

        return (
          <div className="space-y-6">
            <div className={`p-5 ${containerClass} flex items-center justify-between flex-wrap gap-3`}>
              <div>
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">✨ Highlights</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Curate what appears in the Newspaper page's hero and the homepage highlights carousel (shown after the Literacy Test banner). Use the ⭐ Highlight button next to an item in Newspaper or Content Manager to start from real content.
                </p>
              </div>
              {hlView === "form" && (
                <button onClick={() => { setHlView("list"); hlResetForm(); }} className={btnClass("gray")}>
                  ← Back to List
                </button>
              )}
            </div>

            {hlView === "list" && (
              <>
                <div className={containerClass}>
                  <div className="p-4 border-b border-gray-100 dark:border-zinc-800">
                    <h3 className="text-sm font-extrabold text-gray-700 dark:text-gray-200">📰 Newspaper Hero ({newspaperPicks.length})</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">When empty, the Newspaper page falls back to auto-picking one recent approved item per category.</p>
                  </div>
                  {newspaperPicks.length === 0 ? (
                    <p className="text-xs text-gray-400 italic p-6 text-center">No manual picks yet — the Newspaper hero is on auto-pick.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                      {newspaperPicks.map((h, idx) => renderRow(h, newspaperPicks, idx))}
                    </div>
                  )}
                </div>

                <div className={containerClass}>
                  <div className="p-4 border-b border-gray-100 dark:border-zinc-800">
                    <h3 className="text-sm font-extrabold text-gray-700 dark:text-gray-200">🏠 Homepage Highlights ({homePicks.length})</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Shown on the homepage, right after the Literacy Test banner. Hidden entirely when there are none.</p>
                  </div>
                  {homePicks.length === 0 ? (
                    <p className="text-xs text-gray-400 italic p-6 text-center">No homepage highlights yet.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                      {homePicks.map((h, idx) => renderRow(h, homePicks, idx))}
                    </div>
                  )}
                </div>
              </>
            )}

            {hlView === "form" && (
              <form onSubmit={handleHlSave} className={`p-6 space-y-3 ${containerClass}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select value={hlfContentType} onChange={e => setHlfContentType(e.target.value)} className={inputClass}>
                    {Object.entries(HIGHLIGHT_CONTENT_TYPES).map(([value, meta]) => (
                      <option key={value} value={value}>{meta.label}</option>
                    ))}
                  </select>
                  <select value={hlfPlacement} onChange={e => setHlfPlacement(e.target.value)} className={inputClass}>
                    {HIGHLIGHT_PLACEMENTS.map(p => (
                      <option key={p} value={p}>{p === "home" ? "Homepage Highlights" : "Newspaper Hero"}</option>
                    ))}
                  </select>
                  <input type="text" value={hlfTitle} onChange={e => setHlfTitle(e.target.value)} placeholder="Title" className={inputClass} />
                  <input type="text" value={hlfSourceLabel} onChange={e => setHlfSourceLabel(e.target.value)} placeholder="Small header, e.g. Resources" className={inputClass} />
                  <input type="text" value={hlfLink} onChange={e => setHlfLink(e.target.value)} placeholder="Link, e.g. /resources/activity/xyz" className={`${inputClass} sm:col-span-2`} />
                  <textarea value={hlfSummary} onChange={e => setHlfSummary(e.target.value)} placeholder="Short summary (optional)" rows={2} className={`${inputClass} sm:col-span-2`} />
                  <div className="flex items-center gap-3 sm:col-span-2">
                    {(hlfImagePreview || hlfImageUrl) && (
                      <img src={hlfImagePreview || hlfImageUrl} alt="Thumbnail preview" className="w-16 h-12 object-cover rounded-lg border border-gray-200 dark:border-zinc-700 flex-shrink-0" />
                    )}
                    <label className="cursor-pointer bg-gray-100 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 text-xs font-bold px-3 py-2 rounded-xl transition inline-block">
                      📁 Choose Thumbnail
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0] || null;
                          setHlfImageFile(file);
                          setHlfImagePreview(file ? URL.createObjectURL(file) : "");
                        }}
                      />
                    </label>
                    <input
                      type="url"
                      value={hlfImageUrl}
                      onChange={e => setHlfImageUrl(e.target.value)}
                      placeholder="...or paste an image URL"
                      className={`${inputClass} flex-1`}
                      disabled={!!hlfImageFile}
                    />
                  </div>
                  <input type="number" value={hlfOrder} onChange={e => setHlfOrder(e.target.value)} placeholder="Order" className={inputClass} />
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    <input type="checkbox" checked={hlfActive} onChange={e => setHlfActive(e.target.checked)} className="w-3.5 h-3.5 accent-purple-600" />
                    Active (visible on the site)
                  </label>
                </div>
                <button type="submit" disabled={hlSaving} className={`${btnClass("purple")} mt-1`}>
                  {hlSaving ? "Saving…" : hlEditId ? "Save Changes" : "Create Highlight"}
                </button>
              </form>
            )}
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB: HERO CARDS — admin-managed rotating cards on the homepage
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "hero_cards" && (() => {
        // Fetch hero cards on mount when this tab is active
        const fetchHeroCards = async () => {
          setHeroCardsLoading(true);
          try {
            const { getDocs: gd, query: q2, collection: col2, orderBy: ob } = await import("firebase/firestore");
            const snap = await gd(q2(col2(db, "heroCards"), ob("order", "asc")));
            setHeroCardsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch (e) {
            triggerAlert("Failed to load hero cards: " + e.message, "error");
          } finally {
            setHeroCardsLoading(false);
          }
        };

        const hcResetForm = () => {
          setHcEditId(null);
          setHcfPillar("pedagogy");
          setHcfType("");
          setHcfTitle("");
          setHcfSnippet("");
          setHcfSource("");
          setHcfHref("/resources");
          setHcfMediaType("none");
          setHcfMediaUrl("");
          setHcfMediaFile(null);
          setHcfOrder(heroCardsList.length);
          setHcfActive(true);
        };

        const hcPrefillForm = (card) => {
          setHcEditId(card.id);
          setHcfPillar(card.pillar || "pedagogy");
          setHcfType(card.type || "");
          setHcfTitle(card.title || "");
          setHcfSnippet(card.snippet || "");
          setHcfSource(card.source || "");
          setHcfHref(card.href || "/resources");
          setHcfMediaType(card.mediaType || "none");
          setHcfMediaUrl(card.mediaUrl || "");
          setHcfMediaFile(null);
          setHcfOrder(card.order ?? 0);
          setHcfActive(card.active ?? true);
          setHcView("form");
        };

        const handleHcSave = async (e) => {
          e.preventDefault();
          if (!hcfTitle.trim() || !hcfSnippet.trim()) {
            triggerAlert("Title and snippet are required.", "error");
            return;
          }
          setHcSaving(true);
          try {
            let mediaUrl = hcfMediaUrl;
            // Upload image file if provided
            if (hcfMediaType === "image" && hcfMediaFile) {
              const storageRef = ref(storage, `heroCards/${hcEditId || Date.now()}_${hcfMediaFile.name}`);
              const snap = await uploadBytes(storageRef, hcfMediaFile);
              mediaUrl = await getDownloadURL(snap.ref);
            }
            const label = hcfPillar === "pedagogy" ? "🎓 Memes as Pedagogy" : "🔍 Critical Literacy";
            const data = {
              pillar: hcfPillar,
              label,
              type: hcfType.trim(),
              title: hcfTitle.trim(),
              snippet: hcfSnippet.trim(),
              source: hcfSource.trim(),
              href: hcfHref.trim(),
              mediaType: hcfMediaType,
              mediaUrl: mediaUrl.trim(),
              order: Number(hcfOrder),
              active: hcfActive,
              updatedAt: serverTimestamp(),
            };
            if (hcEditId) {
              await updateDoc(doc(db, "heroCards", hcEditId), data);
              triggerAlert("Hero card updated!");
            } else {
              await addDoc(collection(db, "heroCards"), { ...data, createdAt: serverTimestamp(), createdBy: user.uid });
              triggerAlert("Hero card created!");
            }
            hcResetForm();
            setHcView("list");
            // Re-fetch
            const snap2 = await getDocs(query(collection(db, "heroCards"), orderBy("order", "asc")));
            setHeroCardsList(snap2.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch (e) {
            triggerAlert(e.message || "Save failed.", "error");
          } finally {
            setHcSaving(false);
          }
        };

        const handleHcDelete = (card) => {
          openConfirm({
            title: "Delete Hero Card?",
            message: `Permanently delete "${card.title}"? It will no longer appear on the homepage.`,
            variant: "danger",
            confirmLabel: "Delete Card",
            onConfirm: async () => {
              closeConfirm();
              try {
                await deleteDoc(doc(db, "heroCards", card.id));
                setHeroCardsList(prev => prev.filter(c => c.id !== card.id));
                triggerAlert("Hero card deleted.");
              } catch (e) { triggerAlert(e.message || "Delete failed.", "error"); }
            }
          });
        };

        const handleHcToggleActive = async (card) => {
          try {
            await updateDoc(doc(db, "heroCards", card.id), { active: !card.active, updatedAt: serverTimestamp() });
            setHeroCardsList(prev => prev.map(c => c.id === card.id ? { ...c, active: !c.active } : c));
          } catch (e) { triggerAlert(e.message || "Toggle failed.", "error"); }
        };

        const handleHcReorder = async (cardId, direction) => {
          const idx = heroCardsList.findIndex(c => c.id === cardId);
          if ((direction === "up" && idx === 0) || (direction === "down" && idx === heroCardsList.length - 1)) return;
          const newList = [...heroCardsList];
          const swapIdx = direction === "up" ? idx - 1 : idx + 1;
          [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];
          // Write new order values
          const updates = newList.map((c, i) => updateDoc(doc(db, "heroCards", c.id), { order: i }));
          await Promise.all(updates);
          setHeroCardsList(newList.map((c, i) => ({ ...c, order: i })));
        };

        return (
          <div className="space-y-6">
            {/* Header */}
            <div className={`p-5 ${containerClass} flex items-center justify-between`}>
              <div>
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white">🏠 Homepage Hero Cards</h2>
                <p className="text-xs text-gray-500 mt-0.5">Manage the rotating research/insight cards shown on the homepage hero section. Supports text, images, and YouTube embeds.</p>
              </div>
              <div className="flex gap-2">
                {hcView === "list" && (
                  <>
                    <button onClick={() => { fetchHeroCards(); }} className={btnClass("gray")}>
                      ↺ Refresh
                    </button>
                    <button onClick={() => { hcResetForm(); setHcView("form"); }} className={btnClass("purple")}>
                      + Add Card
                    </button>
                  </>
                )}
                {hcView === "form" && (
                  <button onClick={() => { setHcView("list"); hcResetForm(); }} className={btnClass("gray")}>
                    ← Back to List
                  </button>
                )}
              </div>
            </div>

            {/* ── LIST VIEW ── */}
            {hcView === "list" && (
              <div className={containerClass}>
                {heroCardsLoading && (
                  <div className="p-8 text-center text-xs text-gray-400">Loading cards…</div>
                )}
                {!heroCardsLoading && heroCardsList.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-sm text-gray-500">No hero cards yet.</p>
                    <p className="text-xs text-gray-400 mt-1">The homepage will show fallback cards until you add some here.</p>
                    <button onClick={() => { hcResetForm(); setHcView("form"); }} className={`mt-3 ${btnClass("purple")}`}>+ Add First Card</button>
                  </div>
                )}
                {!heroCardsLoading && heroCardsList.length > 0 && (
                  <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {heroCardsList.map((card, idx) => (
                      <div key={card.id} className="flex items-center gap-3 p-4">
                        {/* Reorder */}
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => handleHcReorder(card.id, "up")} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30" aria-label="Move up">▲</button>
                          <button onClick={() => handleHcReorder(card.id, "down")} disabled={idx === heroCardsList.length - 1} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30" aria-label="Move down">▼</button>
                        </div>
                        {/* Pillar indicator */}
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${
                          card.pillar === "pedagogy"
                            ? "bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300"
                            : "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                        }`}>
                          {card.pillar === "pedagogy" ? "🎓 Pedagogy" : "🔍 Literacy"}
                        </span>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{card.title}</p>
                          <p className="text-[11px] text-gray-400 truncate">{card.type} · {card.source}</p>
                          {card.mediaType !== "none" && card.mediaUrl && (
                            <span className="text-[10px] text-indigo-500">{card.mediaType === "image" ? "🖼️ Image" : "▶️ Video"}</span>
                          )}
                        </div>
                        {/* Active toggle */}
                        <button
                          onClick={() => handleHcToggleActive(card)}
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border transition ${
                            card.active
                              ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400"
                              : "bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400"
                          }`}
                        >
                          {card.active ? "● Live" : "○ Hidden"}
                        </button>
                        {/* Actions */}
                        <button onClick={() => hcPrefillForm(card)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition">✏️ Edit</button>
                        <button onClick={() => handleHcDelete(card)} className={btnClass("red")}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── FORM VIEW (Add / Edit) ── */}
            {hcView === "form" && (
              <form onSubmit={handleHcSave} className={`${containerClass} p-6 space-y-5`}>
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                  {hcEditId ? "Edit Hero Card" : "Add New Hero Card"}
                </h3>

                {/* Row: Pillar + Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Pillar *</label>
                    <select value={hcfPillar} onChange={e => setHcfPillar(e.target.value)} className={inputClass}>
                      <option value="pedagogy">🎓 Memes as Pedagogy</option>
                      <option value="literacy">🔍 Critical Literacy</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Type label (e.g. Research, Finding)</label>
                    <input value={hcfType} onChange={e => setHcfType(e.target.value)} placeholder="Research" className={inputClass} />
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Title *</label>
                  <input value={hcfTitle} onChange={e => setHcfTitle(e.target.value)} required placeholder="Card headline" className={inputClass} />
                </div>

                {/* Snippet */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Snippet / Quote *</label>
                  <textarea value={hcfSnippet} onChange={e => setHcfSnippet(e.target.value)} required rows={3} placeholder="Short insight, statistic, or quote to show on the card" className={inputClass} />
                </div>

                {/* Row: Source + Link */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Source / Citation</label>
                    <input value={hcfSource} onChange={e => setHcfSource(e.target.value)} placeholder="Journal name, Year" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Internal link (e.g. /resources)</label>
                    <input value={hcfHref} onChange={e => setHcfHref(e.target.value)} placeholder="/resources" className={inputClass} />
                  </div>
                </div>

                {/* Row: Order + Active */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Display order (0 = first)</label>
                    <input type="number" value={hcfOrder} onChange={e => setHcfOrder(e.target.value)} min={0} className={inputClass} />
                  </div>
                  <div className="flex items-end gap-3 pb-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={hcfActive} onChange={e => setHcfActive(e.target.checked)} className="w-4 h-4 accent-purple-600" />
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Active (visible on homepage)</span>
                    </label>
                  </div>
                </div>

                {/* Media Type */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Media</label>
                  <div className="flex gap-3">
                    {["none", "image", "video"].map(t => (
                      <button key={t} type="button" onClick={() => { setHcfMediaType(t); setHcfMediaUrl(""); setHcfMediaFile(null); }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                          hcfMediaType === t
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:border-purple-400"
                        }`}>
                        {t === "none" ? "No media" : t === "image" ? "🖼️ Image" : "▶️ YouTube Video"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image fields */}
                {hcfMediaType === "image" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400">Image — upload a file OR paste a URL</label>
                    <input type="file" accept="image/*" onChange={e => { setHcfMediaFile(e.target.files[0] || null); setHcfMediaUrl(""); }}
                      className="text-xs file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
                    <p className="text-[10px] text-gray-400">— or —</p>
                    <input value={hcfMediaUrl} onChange={e => { setHcfMediaUrl(e.target.value); setHcfMediaFile(null); }} placeholder="https://…image.jpg" className={inputClass} />
                    {(hcfMediaUrl || hcfMediaFile) && (
                      <div className="rounded-xl overflow-hidden max-h-32">
                        <img src={hcfMediaFile ? URL.createObjectURL(hcfMediaFile) : hcfMediaUrl} alt="preview" className="w-full object-cover" />
                      </div>
                    )}
                  </div>
                )}

                {/* Video fields */}
                {hcfMediaType === "video" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400">YouTube URL (youtu.be/… or youtube.com/watch?v=…)</label>
                    <input value={hcfMediaUrl} onChange={e => setHcfMediaUrl(e.target.value)} placeholder="https://youtu.be/dQw4w9WgXcQ" className={inputClass} />
                    {(() => {
                      const ytMatch = hcfMediaUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/);
                      const vid = ytMatch?.[1];
                      return vid ? (
                        <div className="rounded-xl overflow-hidden aspect-video max-w-xs">
                          <iframe src={`https://www.youtube.com/embed/${vid}`} title="Preview" className="w-full h-full border-0" allowFullScreen />
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={hcSaving} className={btnClass("purple")}>
                    {hcSaving ? "Saving…" : hcEditId ? "Update Card" : "Create Card"}
                  </button>
                  <button type="button" onClick={() => { setHcView("list"); hcResetForm(); }} className={btnClass("gray")}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        );
      })()}

    </div>
  );
};

export default Admin;
