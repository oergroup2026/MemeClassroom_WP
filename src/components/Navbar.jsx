import React, { useState, useEffect } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";

// Contrast/accessibility icon
const ContrastIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
  </svg>
);

const BellIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const Navbar = () => {
  const { user, profile, signOut } = useAuth();
  const { highContrastMode, toggleHighContrast } = useUdl();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  // ── Firestore: real-time notifications ────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      // Newest first
      list.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setNotifications(list.slice(0, 10)); // cap at 10
    });
    return () => unsub();
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!user) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, "notifications", n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark notifications read", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUserDropdownOpen(false);
      navigate("/");
    } catch (e) {
      console.error("Sign out failed", e);
    }
  };

  // Active link class helper
  const activeLink = ({ isActive }) =>
    isActive
      ? "text-purple-600 dark:text-purple-400 font-bold border-b-2 border-purple-500 pb-0.5 transition duration-150"
      : "text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 font-medium transition duration-150";

  const mobileLinkClass = "block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-250 hover:bg-gray-100 dark:hover:bg-gray-800";

  const renderNavLinks = (mobile = false) => {
    const links = [
      { to: "/", label: "Home", end: true },
      { to: "/library", label: "Meme Library" },
      { to: "/lab", label: "Meme Lab" },
      { to: "/staffroom", label: "Staffroom" },
      { to: "/resources", label: "Meme Reads" },
      { to: "/about", label: "About" },
    ];

    if (user && profile) {
      links.push({ to: "/profile", label: "Profile" });
      if (profile.role === "admin" || profile.role === "manager") {
        links.push({ to: "/admin", label: "Admin Panel" });
      }
    }

    return links.map((link) =>
      mobile ? (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          onClick={() => setMobileMenuOpen(false)}
          className={({ isActive }) =>
            `${mobileLinkClass} ${isActive ? "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-semibold" : ""}`
          }
        >
          {link.label}
        </NavLink>
      ) : (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={activeLink}
        >
          {link.label}
        </NavLink>
      )
    );
  };

  return (
    <nav className={`border-b ${highContrastMode ? 'bg-black border-yellow-400 text-yellow-400' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'} transition-all duration-200`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Logo */}
            <Link to="/" className="flex-shrink-0 flex items-center font-extrabold text-xl text-purple-600 dark:text-purple-400 tracking-tight">
              MemeClassroom
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:ml-8 md:flex md:space-x-6">
              {renderNavLinks()}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Accessibility / High Contrast Toggle */}
            <button
              onClick={toggleHighContrast}
              className={`p-1.5 rounded-full border transition ${highContrastMode ? 'border-yellow-400 bg-yellow-400 text-black' : 'border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              title={highContrastMode ? "Disable High Contrast" : "Enable High Contrast Mode (Accessibility)"}
              aria-label="Toggle High Contrast Mode"
            >
              <ContrastIcon />
            </button>

            {/* Notification Bell — real Firestore data */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => {
                    setNotificationsOpen(!notificationsOpen);
                    setUserDropdownOpen(false);
                  }}
                  className="p-1.5 rounded-full text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 relative focus:outline-none transition"
                  aria-label="View notifications"
                >
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900 animate-pulse" />
                  )}
                  <BellIcon />
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl shadow-xl py-2 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 z-50">
                    <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-[10px] text-purple-600 hover:text-purple-700 dark:text-purple-400 font-extrabold"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-750">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <p className="text-sm text-gray-400">No notifications yet.</p>
                          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Activity from badges, replies, and more will appear here.</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className={`px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition ${notif.read ? 'opacity-60' : 'bg-purple-50/30 dark:bg-purple-950/10'}`}
                          >
                            <p className="text-xs text-gray-800 dark:text-gray-200 leading-normal">{notif.message || notif.text}</p>
                            <span className="block text-[9px] text-gray-400 mt-1">
                              {notif.created_at?.seconds
                                ? new Date(notif.created_at.seconds * 1000).toLocaleString()
                                : "Just now"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User dropdown or auth buttons */}
            {user && profile ? (
              <div className="relative">
                <button
                  onClick={() => { setUserDropdownOpen(!userDropdownOpen); setNotificationsOpen(false); }}
                  className="flex items-center space-x-1.5 focus:outline-none"
                  aria-label="User menu"
                >
                  <img
                    src={profile.avatar_url || "/avatar1.png"}
                    className="h-8 w-8 rounded-full object-cover border-2 border-purple-300"
                    alt={profile.name}
                  />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-50">
                    <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{profile.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Your Profile
                    </Link>
                    <Link
                      to="/lab"
                      onClick={() => setUserDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Meme Lab
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center space-x-3">
                <Link
                  to="/auth"
                  className="text-gray-700 dark:text-gray-300 hover:text-purple-600 font-medium text-sm transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm px-4 py-2 rounded-lg transition"
                >
                  Join Free
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none"
                aria-label="Open main menu"
              >
                <span className="text-xl">{mobileMenuOpen ? "✕" : "☰"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-2 pt-2 pb-3 space-y-1">
          {renderNavLinks(true)}
          {!user && (
            <div className="pt-4 pb-2 border-t border-gray-200 dark:border-gray-800 flex flex-col space-y-2 px-3">
              <Link
                to="/auth"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center w-full block py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium text-gray-750 dark:text-gray-250 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Sign In
              </Link>
              <Link
                to="/auth?mode=register"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center w-full block py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700"
              >
                Join Free
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
