import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, getDoc, doc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import { useUserModal } from "../context/UserModalContext";

const MoreResources = () => {
  const { user, profile } = useAuth();
  const { highContrastMode } = useUdl();
  const { openUserModal } = useUserModal();

  const [links, setLinks] = useState([]);
  const [userCache, setUserCache] = useState({});
  const [showFormModal, setShowFormModal] = useState(false);

  // New Link form states
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newDestUrl, setNewDestUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Real-time snapshot listener on `/external_links`
  useEffect(() => {
    const collRef = collection(db, "external_links");
    const unsubscribe = onSnapshot(collRef, (snapshot) => {
      const results = [];
      snapshot.forEach(d => {
        results.push({ id: d.id, ...d.data() });
      });
      // Sort newest first
      results.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setLinks(results);

      // Resolve usernames for contributors
      const contributorIds = [...new Set(results.map(l => l.contributor_id).filter(Boolean))];
      contributorIds.forEach(async (cId) => {
        if (!userCache[cId]) {
          try {
            const userSnap = await getDoc(doc(db, "users", cId));
            if (userSnap.exists()) {
              setUserCache(prev => ({ ...prev, [cId]: userSnap.data().name }));
            }
          } catch (e) {
            console.error("Contributor username resolution error", e);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [userCache]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!newTitle || !newDescription || !newDestUrl) {
      setSubmitError("Please fill out all required fields.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      await addDoc(collection(db, "external_links"), {
        title: newTitle,
        description: newDescription,
        image_url: newImageUrl || "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=400&q=80",
        destination_url: newDestUrl,
        contributor_id: user.uid,
        created_at: serverTimestamp()
      });
      setShowFormModal(false);
      setNewTitle("");
      setNewDescription("");
      setNewImageUrl("");
      setNewDestUrl("");
    } catch (err) {
      console.error(err);
      setSubmitError("Failed to add resource. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExternalLink = async (linkId) => {
    if (!window.confirm("Are you sure you want to delete this external link? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "external_links", linkId));
      alert("External link deleted successfully.");
    } catch (e) {
      console.error("Failed to delete external link", e);
      alert("Failed to delete. Please try again.");
    }
  };

  // UDL Styling classes
  const containerClass = highContrastMode
    ? "bg-zinc-900 border border-zinc-800 text-white p-5 rounded-xl shadow-sm flex flex-col justify-between h-full"
    : "glass-panel bg-white/50 backdrop-blur-md border border-gray-250/50 p-5 rounded-xl shadow-sm flex flex-col justify-between h-full transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md";

  const btnClass = "bg-purple-600 hover:bg-purple-750 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md";

  const actionBtnClass = "bg-indigo-650 hover:bg-indigo-700 text-white font-bold w-full py-2.5 rounded-lg text-xs text-center block transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md";

  const inputClass = highContrastMode
    ? "w-full p-2 border border-zinc-800 bg-zinc-950 rounded-lg text-xs text-white placeholder-gray-500 outline-none"
    : "w-full p-2 border border-gray-300 bg-gray-55 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 outline-none";

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-855 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">More Resources</h1>
          <p className="mt-1 text-sm text-gray-500">
            Curated list of external pedagogical websites, toolkits, and platforms.
          </p>
        </div>
        {user && (
          <button onClick={() => setShowFormModal(true)} className={btnClass}>
            ➕ Add External Resource Link
          </button>
        )}
      </div>

      {/* Grid container */}
      {links.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {links.map((link) => {
            const contributorName = userCache[link.contributor_id] || "Contributor";
            return (
              <div key={link.id} className={containerClass}>
                <div>
                  {/* Thumbnail Image Container */}
                  <div className="w-full aspect-video rounded-lg overflow-hidden mb-4 border border-gray-250/50 dark:border-gray-805 bg-gray-100 dark:bg-gray-955">
                    <img 
                      src={link.image_url} 
                      alt={link.title} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=400&q=80";
                      }}
                    />
                  </div>

                  <h3 className="font-extrabold text-base mb-1.5 line-clamp-1">{link.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 leading-relaxed h-8">
                    {link.description}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Launch button */}
                  <a 
                    href={link.destination_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={actionBtnClass}
                  >
                    Visit Resource ↗
                  </a>

                  {/* Contributor badge footer */}
                  <div className="pt-2 border-t border-gray-155 dark:border-gray-750 flex items-center justify-between text-[10px] text-gray-400 font-semibold">
                    <div className="flex items-center space-x-2">
                      <span>Added: {link.created_at ? new Date(link.created_at.seconds * 1000).toLocaleDateString() : "Just now"}</span>
                      {user && (link.contributor_id === user.uid || profile?.role === "admin") && (
                        <button
                          onClick={() => handleDeleteExternalLink(link.id)}
                          className="text-red-500 hover:text-red-700 font-bold transition ml-2"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => openUserModal(link.contributor_id)}
                      className="text-purple-650 hover:underline capitalize"
                    >
                      By {contributorName}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-sm text-gray-400">
          No external resources link documents found in /external_links database path.
        </div>
      )}

      {/* Form Submission modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 overflow-y-auto max-h-[90vh] ${highContrastMode ? 'bg-black border-2 border-yellow-400 text-yellow-400' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-xl'}`}>
            <h3 className="text-base font-extrabold mb-4">Contribute External Link</h3>
            
            {submitError && (
              <div className="text-xs text-red-500 bg-red-100 dark:bg-red-950/20 p-2.5 rounded mb-4 font-bold">
                ⚠️ {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Resource Title *</label>
                <input 
                  type="text" 
                  value={newTitle} 
                  onChange={(e) => setNewTitle(e.target.value)} 
                  className={inputClass}
                  placeholder="e.g. Edutopia Meme Resources"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Short Description *</label>
                <textarea 
                  value={newDescription} 
                  onChange={(e) => setNewDescription(e.target.value)} 
                  className={`${inputClass} h-16`}
                  placeholder="A quick summary of the tool or platform..."
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Thumbnail Image URL</label>
                <input 
                  type="url" 
                  value={newImageUrl} 
                  onChange={(e) => setNewImageUrl(e.target.value)} 
                  className={inputClass}
                  placeholder="e.g. https://domain.com/thumbnail.png"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Destination Target URL *</label>
                <input 
                  type="url" 
                  value={newDestUrl} 
                  onChange={(e) => setNewDestUrl(e.target.value)} 
                  className={inputClass}
                  placeholder="https://example.com/pedagogy-meme-reads"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 text-xs">
                <button 
                  type="button" 
                  onClick={() => setShowFormModal(false)}
                  className={`px-4 py-2 font-semibold ${highContrastMode ? 'text-yellow-400 border border-yellow-400 bg-black' : 'text-gray-505 hover:bg-gray-100 rounded-lg'}`}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className={btnClass}
                >
                  {submitting ? "Adding..." : "Add Resource Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoreResources;
