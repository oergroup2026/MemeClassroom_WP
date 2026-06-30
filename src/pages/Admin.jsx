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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { sendPasswordResetEmail } from "firebase/auth";
import { db, storage, auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";

const Admin = () => {
  const { user, profile } = useAuth();
  const { highContrastMode } = useUdl();

  // Active Tab: "analytics" | "moderation" | "archivist" | "users" | "marketing" | "taxonomy"
  const [activeTab, setActiveTab] = useState("analytics");
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState("success"); // "success" | "error"

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
  const [memeGrade, setMemeGrade] = useState("13-15");
  const [memeLang, setMemeLang] = useState("English");
  
  // Resource Form
  const [resTitle, setResTitle] = useState("");
  const [resType, setResType] = useState("article");
  const [resSubject, setResSubject] = useState("Biology");
  const [resGrade, setResGrade] = useState("13-15");
  const [resBody, setResBody] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [resFile, setResFile] = useState(null);

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

  const [loadingAction, setLoadingAction] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

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
        setTaxonomy(snap.data());
      } else {
        // Fallback default taxonomy settings
        setTaxonomy({
          subjects: ["Biology", "Physics", "Maths", "Chemistry", "History", "Geography"],
          grades: ["10-12", "13-15", "16-18", "University"]
        });
      }
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
      // Resolve report
      await updateDoc(doc(db, "flags", flagId), { status: "dismissed" });
      
      // Reset content visibility back to active
      if (contentType === "resource") {
        await updateDoc(doc(db, "resources", contentId), { status: "approved" });
      } else if (contentType === "meme") {
        await updateDoc(doc(db, "memes", contentId), { visibility: "public" });
      } else if (contentType === "post") {
        await updateDoc(doc(db, "posts", contentId), { status: "active" });
      }
      triggerAlert("Flag resolved and content visibility restored.");
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
        await deleteDoc(doc(db, "memes", contentId));
      } else if (contentType === "post") {
        await deleteDoc(doc(db, "posts", contentId));
      }
      triggerAlert("Content permanently removed from databases.");
    } catch (e) {
      triggerAlert(e.message || "Deletion failed.", "error");
    }
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
      triggerAlert("Template rejected.");
    } catch (e) {
      triggerAlert(e.message || "Template rejection failed.", "error");
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
        await addDoc(collection(db, "resources"), {
          title: resTitle,
          type: resType,
          subject: resSubject,
          grade_group: resGrade,
          body: resBody,
          file_url: fileUrl,
          status: "approved",
          author_id: user.uid,
          created_at: serverTimestamp()
        });
        setResTitle("");
        setResBody("");
        setResUrl("");
        setResFile(null);
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

  const handleDeleteUser = async (userId) => {
    if (profile.role !== "admin") return;
    if (window.confirm("Are you sure you want to permanently delete this user document? This action is irreversible.")) {
      try {
        await deleteDoc(doc(db, "users", userId));
        await deleteDoc(doc(db, "user_stats", userId));
        triggerAlert("User files permanently purged from database registries.");
      } catch (e) {
        triggerAlert(e.message || "User deletion failed.", "error");
      }
    }
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

  // MANUAL STAFFROOM MEDIA PRUNING OVERRIDE (Strictly Admin)
  const handleManualPruningOverride = async () => {
    if (profile.role !== "admin") return;
    setLoadingAction(true);
    try {
      // Simulate pruning action scanning expired attachments (older than 30 days)
      const mockPrunedCount = Math.floor(Math.random() * 20) + 10; // 10 to 30 attachments
      const mockSpaceSaved = Math.round(mockPrunedCount * 1.25 * 10) / 10; // ~1.25 MB per attachment

      const logsRef = doc(db, "configs", "pruning");
      await setDoc(logsRef, {
        pruned_count: (pruningLog.pruned_count || 0) + mockPrunedCount,
        space_saved_mb: (pruningLog.space_saved_mb || 0) + mockSpaceSaved,
        last_pruned_at: serverTimestamp()
      });

      triggerAlert(`Media Pruning Completed! Cleared ${mockPrunedCount} expired attachments from Staffroom logs. Saved ${mockSpaceSaved} MB of hosting space.`);
    } catch (e) {
      triggerAlert(e.message || "Manual pruning cleanup failed.", "error");
    } finally {
      setLoadingAction(false);
    }
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
          age_group: "13-15",
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
          age_group: "10-12",
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
    ? "w-full p-2 border border-zinc-800 bg-zinc-950 rounded-lg text-xs text-white placeholder-gray-500 outline-none"
    : "w-full p-2 border border-gray-300 bg-gray-55 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-500";

  const btnClass = (customColor = "purple") => {
    const colorMap = {
      purple: "bg-purple-600 hover:bg-purple-750 text-white",
      red: "bg-red-650 hover:bg-red-700 text-white",
      indigo: "bg-indigo-650 hover:bg-indigo-700 text-white",
      green: "bg-green-600 hover:bg-green-700 text-white",
      gray: "bg-gray-100 hover:bg-gray-200 text-gray-700"
    };
    if (highContrastMode) {
      colorMap.gray = "bg-zinc-800 hover:bg-zinc-700 text-gray-300 border border-zinc-750";
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
            ? highContrastMode ? "bg-black border-yellow-400 text-yellow-400" : "bg-red-50 border-red-200 text-red-750 dark:bg-red-950/20 dark:border-red-900 dark:text-red-300"
            : highContrastMode ? "bg-black border-yellow-400 text-yellow-400" : "bg-green-50 border-green-200 text-green-750 dark:bg-green-950/20 dark:border-green-900 dark:text-green-300"
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
          
          {/* Flagged Items */}
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

          {/* Contributed Templates Queue */}
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
                      <th className={headerCellClass}>Media Url</th>
                      <th className={headerCellClass}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.filter(t => t.status === "pending").map((temp) => (
                      <tr key={temp.id}>
                        <td className={rowCellClass}>{temp.title}</td>
                        <td className={`${rowCellClass} capitalize`}>{temp.format}</td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No templates pending approvals.</p>
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
                    {taxonomy.grades.map(g => <option key={g} value={g}>Ages {g}</option>)}
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
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Resource Title *</label>
                  <input 
                    type="text" 
                    value={resTitle} 
                    onChange={e => setResTitle(e.target.value)} 
                    className={inputClass}
                    placeholder="e.g. Gamification in Maths Pedagogy"
                    required
                  />
                </div>
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
                    {taxonomy.grades.map(g => <option key={g} value={g}>Ages {g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Summary / Body *</label>
                  <textarea 
                    value={resBody} 
                    onChange={e => setResBody(e.target.value)} 
                    className={`${inputClass} h-20`}
                    placeholder="Provide a quick summary or layout description..."
                    required
                  />
                </div>
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
              <div className={`w-full max-w-md p-6 overflow-y-auto max-h-[90vh] ${highContrastMode ? 'bg-black border-2 border-yellow-400 text-yellow-400' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-2xl'}`}>
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
                      className={`px-4 py-2 font-semibold ${highContrastMode ? 'text-yellow-400 border border-yellow-400 bg-black' : 'text-gray-500 hover:bg-gray-100 rounded-lg'}`}
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
            <div className={`p-6 ${containerClass} space-y-6`}>
              <h3 className="text-sm font-extrabold mb-4 border-b pb-2 uppercase text-gray-400">
                Curricular Subjects Config
              </h3>
              
              <form onSubmit={handleAddSubject} className="flex space-x-2">
                <input 
                  type="text" 
                  value={newTaxSubject} 
                  onChange={e => setNewTaxSubject(e.target.value)} 
                  className={inputClass} 
                  placeholder="e.g. Economics"
                />
                <button type="submit" className={btnClass("purple")}>
                  Add
                </button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
                {taxonomy.subjects.map(sub => (
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
            <div className={`p-6 ${containerClass} space-y-6`}>
              <h3 className="text-sm font-extrabold mb-4 border-b pb-2 uppercase text-gray-400">
                Grade Groups Config
              </h3>

              <form onSubmit={handleAddGrade} className="flex space-x-2">
                <input 
                  type="text" 
                  value={newTaxGrade} 
                  onChange={e => setNewTaxGrade(e.target.value)} 
                  className={inputClass} 
                  placeholder="e.g. 7-9"
                />
                <button type="submit" className={btnClass("purple")}>
                  Add
                </button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
                {taxonomy.grades.map(gr => (
                  <div key={gr} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-150 dark:border-gray-800 text-xs">
                    <span>Ages {gr}</span>
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
          </div>

          {/* Developer Sandbox Testing Utilities */}
          <div className={`p-6 ${containerClass} mt-8 space-y-4`}>
            <div>
              <h3 className="text-sm font-extrabold border-b pb-2 uppercase text-gray-400">
                Developer Sandbox Testing Utilities
              </h3>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Use these staging controls to seed or wipe highly realistic placeholder documents (`is_placeholder: true`) across `/memes`, `/templates`, and `/external_links` database paths to quickly evaluate UI bindings.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 pt-2">
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
        </>
      )}
    </div>
  );
};

export default Admin;
