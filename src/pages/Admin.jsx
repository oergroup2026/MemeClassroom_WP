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
  runTransaction
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { sendPasswordResetEmail } from "firebase/auth";
import { db, storage, auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import { useToast } from "../components/ToastNotification";
import ConfirmDialog from "../components/ConfirmDialog";

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
  const [memes, setMemes] = useState([]);
  const [resources, setResources] = useState([]);
  const [flags, setFlags] = useState([]);
  const [expertApps, setExpertApps] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sponsoredAds, setSponsoredAds] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [pruningLog, setPruningLog] = useState({ pruned_count: 0, space_saved_mb: 0 });
  const [taxonomy, setTaxonomy] = useState({ subjects: [], grades: [] });

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
  const [resTemplateId, setResTemplateId] = useState("");
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
  const [taxSubjectSearch, setTaxSubjectSearch] = useState("");
  const [taxGradeSearch, setTaxGradeSearch] = useState("");
  const [taxLangSearch, setTaxLangSearch] = useState("");

  const [loadingAction, setLoadingAction] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

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

    return () => {
      uUnsub();
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
      allPostsUnsub();
      allRepliesUnsub();
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
          resourceData.meme_name = resTitle.trim();
          resourceData.usage_context = resUsageContext.trim();
          resourceData.educational_use = resEducationalUse.trim();
          if (resTemplateId.trim()) resourceData.template_id = resTemplateId.trim();
          resourceData.admin_approved = true; // Admin seeds are auto-approved
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
        setResTemplateId("");
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

      await runTransaction(db, async (transaction) => {
        transaction.set(userRef, {
          id: generatedId,
          name: newUserName,
          email: newUserEmail,
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
      await updateDoc(doc(db, "users", userId), { banned: !currentBanned });
      triggerAlert(`Suspension status ${!currentBanned ? "activated" : "revoked"} for user.`);
    } catch (e) {
      triggerAlert(e.message || "Ban status toggle failed.", "error");
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
          is_placeholder: true,
          created_at: serverTimestamp()
        },
        {
          title: "Merlot II Computer Fundamentals Tutorials Reference",
          description: "Peer-reviewed OER collection spanning binary numbers conversion, hardware systems, logic gates, and processor architectures.",
          destination_url: "https://www.merlot.org/merlot/index.htm",
          image_url: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80",
          contributor_id: user.uid,
          is_placeholder: true,
          created_at: serverTimestamp()
        },
        {
          title: "PhET Interactive Chemistry Simulations Toolkit",
          description: "Freely accessible HTML5 atomic structure simulations supporting student hypothesis testing and OER activity sheets.",
          destination_url: "https://phet.colorado.edu/",
          image_url: "https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?auto=format&fit=crop&w=600&q=80",
          contributor_id: user.uid,
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

  // UDL Styling classes
  const containerClass = highContrastMode
    ? "bg-zinc-900 border border-zinc-800 text-white shadow-sm rounded-xl"
    : "bg-white border border-gray-200 shadow-sm rounded-xl";

  const bannerClass = highContrastMode
    ? "bg-zinc-900 border border-zinc-800 text-zinc-300 p-5 rounded-xl text-xs font-semibold leading-relaxed"
    : "bg-purple-50 text-purple-750 border border-purple-200 p-5 rounded-xl text-xs font-semibold leading-relaxed";

  const headerCellClass = highContrastMode
    ? "bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-extrabold uppercase text-[10px] p-3 text-left"
    : "bg-gray-100 border-b border-gray-250 text-gray-500 font-bold uppercase text-[10px] p-3 text-left";

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
                          u.email?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter ? u.role === userRoleFilter : true;
    return matchesSearch && matchesRole;
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-850 pb-5">
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
        <div className={`p-4 rounded-xl border flex items-center space-x-2 text-xs font-bold ${
          alertType === "error"
            ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900 dark:text-red-300"
            : "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-900 dark:text-green-300"
        }`}>
          <span>{alertType === "error" ? "⚠️" : "✅"}</span>
          <span>{alertMsg}</span>
        </div>
      )}

      {/* 2. Folder Tabs Row */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        {[
          { id: "analytics", label: "Analytics", roles: ["admin", "manager"] },
          { id: "moderation", label: "Moderation Queue", roles: ["admin", "manager"] },
          { id: "archivist", label: "Content Archivist", roles: ["admin", "manager"] },
          { id: "users", label: "User Directory", roles: ["admin", "manager"] },
          { id: "content", label: "🛡️ Content Manager", roles: ["admin"] },
          { id: "marketing", label: "Monetization & Ads", roles: ["admin"] },
          { id: "taxonomy", label: "System Taxonomy", roles: ["admin"] }
        ]
          .filter(tab => tab.roles.includes(profile?.role))
          .map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                activeTab === tab.id
                  ? "bg-purple-650 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-850"
              }`}
            >
              {tab.label}
            </button>
          ))}
      </div>

      {/* TAB CONTENT A: SYSTEM ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className={`p-5 text-center ${containerClass}`}>
              <span className="text-xl block mb-1">👥</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Total Users</span>
              <span className="text-3xl font-extrabold block mt-2">{users.length}</span>
            </div>
            <div className={`p-5 text-center ${containerClass}`}>
              <span className="text-xl block mb-1">🧪</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Total Memes</span>
              <span className="text-3xl font-extrabold block mt-2">{memes.length}</span>
            </div>
            <div className={`p-5 text-center ${containerClass}`}>
              <span className="text-xl block mb-1">📄</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Total Resources</span>
              <span className="text-3xl font-extrabold block mt-2">{resources.length}</span>
            </div>
            <div className={`p-5 text-center ${containerClass}`}>
              <span className="text-xl block mb-1">🏳️</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Pending Flags</span>
              <span className="text-3xl font-extrabold block mt-2 text-red-500">{flags.length}</span>
            </div>
            <div className={`p-5 text-center ${containerClass}`}>
              <span className="text-xl block mb-1">💾</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Storage saved</span>
              <span className="text-3xl font-extrabold block mt-2 text-indigo-600">
                {pruningLog.space_saved_mb ? pruningLog.space_saved_mb.toFixed(1) : "0"} MB
              </span>
            </div>
          </div>

          <div className={`p-6 ${containerClass}`}>
            <h3 className="text-sm font-extrabold mb-4 border-b pb-2 uppercase tracking-wider text-gray-400">
              Users Demographics Breakdowns
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
              {[
                { label: "Students", val: users.filter(u => u.role === "student").length, color: "text-purple-650" },
                { label: "Teachers", val: users.filter(u => u.role === "teacher").length, color: "text-indigo-600" },
                { label: "Experts", val: users.filter(u => u.role === "expert").length, color: "text-green-600" },
                { label: "Managers", val: users.filter(u => u.role === "manager").length, color: "text-amber-600" },
                { label: "Admins", val: users.filter(u => u.role === "admin").length, color: "text-red-500" }
              ].map((roleRow, idx) => (
                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-150 dark:border-gray-800">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">{roleRow.label}</span>
                  <span className={`text-xl font-extrabold mt-1 block ${roleRow.color}`}>{roleRow.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT B: MODERATION & APPROVAL QUEUES */}
      {activeTab === "moderation" && (
        <div className="space-y-8">

          {/* Resources Pending Admin Approval */}
          {(() => {
            const pendingResources = resources.filter(r => !r.admin_approved);
            return (
              <div className={`p-6 ${containerClass}`}>
                <h3 className="text-sm font-extrabold mb-1 border-b pb-2 uppercase text-yellow-600 dark:text-yellow-400">
                  ⏳ Resources Pending Approval ({pendingResources.length})
                </h3>
                <p className="text-xs text-gray-400 mb-4">These resources are live on the platform but need your review. Approve to remove the 'Pending Admin Approval' badge, or delete if inappropriate.</p>
                {pendingResources.length > 0 ? (
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
                        {pendingResources.map((res) => (
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
                ) : (
                  <p className="text-xs text-gray-400 italic">All resources have been reviewed. No pending approvals.</p>
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
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition capitalize ${
                  archivistMode === modeOpt 
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
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Age Group *</label>
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
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Age Group *</label>
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
                    {resType === "stories" ? "Background *" : "Summary / Body *"}
                  </label>
                  <textarea 
                    value={resBody} 
                    onChange={e => setResBody(e.target.value)} 
                    className={`${inputClass} h-20`}
                    placeholder={resType === "stories" ? "Where did this template originate? Mention the source (movie, TV show, game, etc.) and how it became popular." : "Provide a quick summary or layout description..."}
                    required
                  />
                </div>

                {/* Story-specific fields */}
                {resType === "stories" && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Typical Meaning & Usage</label>
                      <textarea 
                        value={resUsageContext} 
                        onChange={e => setResUsageContext(e.target.value)} 
                        className={`${inputClass} h-16`}
                        placeholder="Used to express confusion while reading something complicated or reacting to unexpected information."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Educational Use</label>
                      <textarea 
                        value={resEducationalUse} 
                        onChange={e => setResEducationalUse(e.target.value)} 
                        className={`${inputClass} h-16`}
                        placeholder="Suggest classroom situations where this template can be used. E.g. Assignment instructions"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Linked Template ID (optional)</label>
                      <input 
                        type="text" 
                        value={resTemplateId} 
                        onChange={e => setResTemplateId(e.target.value)} 
                        className={inputClass}
                        placeholder="Paste Firestore template document ID"
                      />
                    </div>
                  </>
                )}
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

          <div className={`p-6 ${containerClass}`}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={headerCellClass}>User Name</th>
                    <th className={headerCellClass}>Email Address</th>
                    <th className={headerCellClass}>Role</th>
                    <th className={headerCellClass}>Institution</th>
                    <th className={headerCellClass}>Banned Status</th>
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
                              <img src="/verified-badge.png" className="w-4 h-4 ml-1 inline-block" alt="Verified" title="Verified" />
                            )}
                          </div>
                        </td>
                        <td className={rowCellClass}>{uItem.email}</td>
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
                              onClick={() => handleTriggerPasswordReset(uItem.email)}
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
                <textarea 
                  value={testBody} 
                  onChange={e => setTestBody(e.target.value)} 
                  className={`${inputClass} h-16`} 
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
                Grade Groups Config
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
                <p className="text-xs text-gray-550 mt-2 leading-relaxed">
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
                    setCmTplStatus("all"); setCmTplFormat("all"); setCmTplCreator("all"); setCmTplSelected(new Set());
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    contentManagerTab === st.id
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
            return (
              <div className={`p-6 ${containerClass}`}>
                <h3 className="text-sm font-extrabold mb-1 border-b pb-2 uppercase text-indigo-600 dark:text-indigo-400">
                  All Memes — Full Catalog ({filtered.length} of {memes.length})
                </h3>
                <p className="text-xs text-gray-400 mb-2">
                  Includes public, flagged-hidden, and admin-hidden memes. Hide suppresses from Library feed; Delete is permanent.
                </p>

                {/* Memes filter bar */}
                <div className="flex flex-wrap gap-2 mb-4 items-center">
                  <select value={cmMemeVisibility} onChange={e => setCmMemeVisibility(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Visibility</option>
                    <option value="public">✅ Public</option>
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
                      {filtered.map(meme => (
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
                    <option value="approved">✅ Approved</option>
                    <option value="pending">⏳ Pending</option>
                    <option value="admin_hidden">🚫 Admin Hidden</option>
                    <option value="hidden_moderation">🏳️ Moderation</option>
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
                      {filtered.map(res => (
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
                              <span className="bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-[10px] font-bold">🚫 Admin Hidden</span>
                            ) : res.status === "hidden_moderation" ? (
                              <span className="bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded text-[10px] font-bold">🏳️ Moderation</span>
                            ) : res.admin_approved ? (
                              <span className="bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-[10px] font-bold">✅ Approved</span>
                            ) : (
                              <span className="bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded text-[10px] font-bold">⏳ Pending</span>
                            )}
                          </td>
                          <td className={rowCellClass}>
                            {res.created_at ? new Date(res.created_at.seconds * 1000).toLocaleDateString() : "—"}
                          </td>
                          <td className={rowCellClass}>
                            <div className="flex space-x-2">
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
                      {filtered.map(post => {
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
              return true;
            });
            const anyTplFilter = cmTplStatus !== "all" || cmTplFormat !== "all" || cmTplCreator !== "all";
            // Selection helpers
            const isAllTplSelected = filtered.length > 0 && filtered.every(t => cmTplSelected.has(t.id));
            const isSomeTplSelected = filtered.some(t => cmTplSelected.has(t.id));
            const toggleTpl = (id) => setCmTplSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
            const toggleAllTpl = () => {
              if (isAllTplSelected) setCmTplSelected(prev => { const n = new Set(prev); filtered.forEach(t => n.delete(t.id)); return n; });
              else setCmTplSelected(prev => { const n = new Set(prev); filtered.forEach(t => n.add(t.id)); return n; });
            };
            return (
              <div className={`p-6 ${containerClass}`}>
                <h3 className="text-sm font-extrabold mb-1 border-b pb-2 uppercase text-indigo-600 dark:text-indigo-400">
                  All Templates — Full Catalog ({filtered.length} of {templates.length})
                </h3>
                <p className="text-xs text-gray-400 mb-2">
                  Includes pending, approved, and rejected templates. Delete permanently removes the document (unlike Reject in the Moderation tab which only changes status).
                </p>

                {/* Templates filter bar */}
                <div className="flex flex-wrap gap-2 mb-4 items-center">
                  <select value={cmTplStatus} onChange={e => setCmTplStatus(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Statuses</option>
                    <option value="approved">✅ Approved</option>
                    <option value="pending">⏳ Pending</option>
                    <option value="rejected">❌ Rejected</option>
                  </select>
                  <select value={cmTplFormat} onChange={e => setCmTplFormat(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Formats</option>
                    {tplFormats.filter(f => f !== "all").map(f => (
                      <option key={f} value={f} className="capitalize">{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                    ))}
                  </select>
                  <select value={cmTplCreator} onChange={e => setCmTplCreator(e.target.value)} className={`${inputClass} !py-1 !text-[11px] w-auto`}>
                    <option value="all">All Creators</option>
                    <option value="admin">🔐 Admin-seeded</option>
                    <option value="user">👤 User-submitted</option>
                  </select>
                  {anyTplFilter && (
                    <button
                      onClick={() => { setCmTplStatus("all"); setCmTplFormat("all"); setCmTplCreator("all"); }}
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
                        <th className={headerCellClass}>Status</th>
                        <th className={headerCellClass}>Date</th>
                        <th className={headerCellClass}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(temp => (
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
                                <span className="bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-[10px] font-bold">✅ Approved</span>
                              ) : temp.status === "rejected" ? (
                                <span className="bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-[10px] font-bold">❌ Rejected</span>
                              ) : (
                                <span className="bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded text-[10px] font-bold">⏳ Pending</span>
                              )}
                              {temp.is_featured && <span className="text-yellow-500 text-xs">⭐</span>}
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
                </div>
              </div>
            );
          })()}

        </div>
      )}
    </div>
  );
};

export default Admin;
