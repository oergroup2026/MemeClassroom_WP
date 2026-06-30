import React, { createContext, useContext, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useUdl } from "./UdlContext";

const getBadgeIcon = (level) => {
  if (level >= 5) return "/diamond.png";
  if (level >= 3) return "/trophy.png";
  if (level >= 1) return "/medal.png";
  return "/medal.png";
};

const UserModalContext = createContext();

export const UserModalProvider = ({ children }) => {
  const { highContrastMode } = useUdl();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [userBadges, setUserBadges] = useState([]);

  const openUserModal = async (userId) => {
    if (!userId) return;
    setLoading(true);
    setIsOpen(true);
    setUserData(null);
    setUserBadges([]);

    try {
      // 1. Fetch user demographics profile
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        setUserData(userDocSnap.data());
      }

      // 2. Fetch user's unlocked badge medals
      const badgesColRef = collection(db, "badges");
      const q = query(badgesColRef, where("user_id", "==", userId));
      const querySnap = await getDocs(q);
      
      const badgeList = [];
      querySnap.forEach(d => {
        badgeList.push({ id: d.id, ...d.data() });
      });
      setUserBadges(badgeList);
    } catch (e) {
      console.error("Failed to load global overlay profile info", e);
    } finally {
      setLoading(false);
    }
  };

  const closeUserModal = () => {
    setIsOpen(false);
    setUserData(null);
    setUserBadges([]);
  };

  // UI styles dynamically bound to global high contrast rules
  const modalClass = highContrastMode
    ? "bg-black border-2 border-yellow-400 text-yellow-400"
    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-850 dark:text-gray-100 shadow-2xl rounded-xl";

  const closeBtnClass = highContrastMode
    ? "bg-black border-2 border-yellow-400 text-yellow-400 font-bold px-4 py-2 hover:bg-yellow-400 hover:text-black"
    : "bg-purple-650 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg transition shadow";

  return (
    <UserModalContext.Provider value={{ openUserModal, closeUserModal }}>
      {children}
      
      {/* Global User Info Box Overlay Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 overflow-y-auto max-h-[90vh] ${modalClass}`}>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
              </div>
            ) : userData ? (
              <div className="space-y-6">
                
                {/* Profile demographics header details */}
                <div className="flex items-center space-x-4">
                  <img
                    src={userData.avatar_url || "/avatar1.png"}
                    className="w-14 h-14 rounded-full object-cover border-2 border-purple-300 dark:border-purple-700"
                    alt={userData.name}
                  />
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xl font-extrabold">{userData.name}</h3>
                      {userData.is_verified && (
                        <img src="/verified-badge.png" className="w-5 h-5 ml-1 inline-block" alt="Verified User" title="Verified User" />
                      )}
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-purple-650 mt-1 capitalize">
                      {userData.role} • {userData.institution}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {userData.place}, {userData.state}, {userData.country}
                    </p>
                  </div>
                </div>

                {/* Milestone Badges lists */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Unlocked Medals</h4>
                  {userBadges.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {userBadges.map((badge) => (
                        <span 
                          key={badge.id} 
                          className="bg-purple-55 text-purple-750 dark:bg-purple-950/20 dark:text-purple-300 text-[10px] font-bold px-2 py-1 rounded border border-purple-200 dark:border-purple-800 flex items-center space-x-1"
                        >
                          <img src={getBadgeIcon(badge.level)} className="w-4 h-4" alt="Badge icon" />
                          <span>{badge.badge_name}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400">No milestone medals unlocked yet.</p>
                  )}
                </div>

                {/* Privacy check email box */}
                <div className="pt-4 border-t border-gray-150 dark:border-gray-700">
                  {userData.is_contact_public ? (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Direct Contact</h4>
                      <a 
                        href={`mailto:${userData.email}`} 
                        className="text-xs text-indigo-650 hover:underline font-semibold"
                      >
                        {userData.email}
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-450 dark:text-gray-500 italic">
                      🔒 User has chosen to keep contact details private.
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={closeUserModal}
                    className={closeBtnClass}
                  >
                    Close Profile
                  </button>
                </div>

              </div>
            ) : (
              <div className="text-center py-6 text-xs text-gray-400">
                Failed to resolve profile details.
                <div className="mt-4">
                  <button onClick={closeUserModal} className={closeBtnClass}>Close</button>
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}
    </UserModalContext.Provider>
  );
};

export const useUserModal = () => {
  const context = useContext(UserModalContext);
  if (!context) {
    throw new Error("useUserModal must be used within a UserModalProvider");
  }
  return context;
};
