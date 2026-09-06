import React, { useState, useEffect } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import SmartSearchBar from "./SmartSearchBar";
import {
  Home,
  BookOpen,
  FlaskConical,
  MessageSquare,
  BookOpenCheck,
  Info,
  User,
  Settings,
  Menu,
  X,
  Award,
  Search,
  Sparkles
} from "lucide-react";

// Contrast/accessibility icon
const ContrastIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
  </svg>
);

const BellIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const Navbar = () => {
  const { user, profile, signOut } = useAuth();
  const { highContrastMode, toggleHighContrast } = useUdl();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [globalIndex, setGlobalIndex] = useState([]);
  const navigate = useNavigate();

  // Load global search items
  useEffect(() => {
    let isMounted = true;
    const fetchGlobalItems = async () => {
      try {
        const [memesSnap, resourcesSnap, threadsSnap] = await Promise.all([
          getDocs(query(collection(db, "memes"), where("visibility", "==", "public"), limit(30))),
          getDocs(query(collection(db, "resources"), limit(30))),
          getDocs(query(collection(db, "threads"), limit(30)))
        ]);

        if (!isMounted) return;

        const combined = [
          ...memesSnap.docs.map((d) => ({ id: d.id, ...d.data(), _type: "meme" })),
          ...resourcesSnap.docs.map((d) => ({ id: d.id, ...d.data(), _type: d.data().type || "resource" })),
          ...threadsSnap.docs.map((d) => ({ id: d.id, ...d.data(), _type: d.data().post_type || "thread" }))
        ];
        setGlobalIndex(combined);
      } catch (e) {
        console.warn("Could not populate global search index", e);
      }
    };

    fetchGlobalItems();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleGlobalSuggestionSelect = (suggestion) => {
    const item = suggestion.item || {};
    const type = item._type || item.type || item.format || "";
    if (type === "meme" || type === "image" || type === "video" || type === "gif" || type === "audio") {
      navigate(`/library?q=${encodeURIComponent(suggestion.label)}`);
    } else if (type === "resource" || type === "article" || type === "research_paper" || type === "activity" || type === "stories") {
      navigate(`/resources?q=${encodeURIComponent(suggestion.label)}`);
    } else {
      navigate(`/staffroom?q=${encodeURIComponent(suggestion.label)}`);
    }
    setDrawerOpen(false);
  };

  const handleGlobalSearch = (queryStr) => {
    if (queryStr && queryStr.trim()) {
      navigate(`/library?q=${encodeURIComponent(queryStr.trim())}`);
      setDrawerOpen(false);
    }
  };

  // Real-time notifications
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", user.uid),
      orderBy("created_at", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setNotifications(list.slice(0, 10));
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
      setDrawerOpen(false);
      navigate("/");
    } catch (e) {
      console.error("Sign out failed", e);
    }
  };

  const bottomNavItems = [
    { to: "/", label: "Home", Icon: Home, end: true },
    { to: "/resources", label: "Resources", Icon: BookOpenCheck },
    { to: "/library", label: "Library", Icon: BookOpen },
    { to: "/lab", label: "Lab", Icon: FlaskConical },
    { to: "/staffroom", label: "Staffroom", Icon: MessageSquare },
  ];

  return (
    <>
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP HEADER (Central Classroom Title + Menu Trigger & Quick Actions)
          ────────────────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md border-b border-gray-200/80 dark:border-zinc-800/80 text-gray-850 dark:text-zinc-100 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Left: Menu Drawer Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-ruby-50 hover:text-ruby-600 dark:hover:bg-ruby-950/40 dark:hover:text-ruby-400 font-semibold text-xs transition border border-gray-200 dark:border-zinc-700 shadow-xs"
                aria-label="Open menu drawer"
              >
                <Menu className="w-4 h-4 text-ruby-600 dark:text-ruby-400" />
                <span className="hidden sm:inline">Menu</span>
              </button>
            </div>

            {/* Center: Centralized Classroom Title */}
            <div className="flex items-center justify-center flex-1">
              <Link
                to="/"
                className="group inline-flex items-center gap-1.5 text-xl sm:text-2xl font-black tracking-tight text-gray-900 dark:text-white hover:text-ruby-600 dark:hover:text-ruby-400 transition"
              >
                <span style={{ fontFamily: "'Pacifico', cursive" }} className="text-ruby-600 dark:text-ruby-400">
                  Meme
                </span>
                <span className="font-extrabold tracking-tight">Classroom</span>
                <span className="w-2 h-2 rounded-full bg-ruby-600 dark:bg-ruby-400 animate-pulse" />
              </Link>
            </div>

            {/* Right: Accessibility Toggle, Notifications, User Avatar */}
            <div className="flex items-center space-x-2.5">
              {/* Accessibility / High Contrast Toggle */}
              <button
                onClick={toggleHighContrast}
                className={`p-2 rounded-full border transition ${
                  highContrastMode
                    ? "border-ruby-500 bg-ruby-600/10 text-ruby-400 hover:bg-ruby-600/20"
                    : "border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
                }`}
                title={highContrastMode ? "Disable Dark Theme" : "Enable Dark Theme"}
                aria-label="Toggle Dark Theme"
              >
                <ContrastIcon />
              </button>

              {/* Real-time Notifications Bell */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setNotificationsOpen(!notificationsOpen);
                      setUserDropdownOpen(false);
                    }}
                    className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:text-ruby-600 dark:hover:text-ruby-400 relative focus:outline-none transition border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    aria-label="View notifications"
                  >
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-ruby-600 ring-2 ring-white dark:ring-zinc-900 animate-pulse" />
                    )}
                    <BellIcon />
                  </button>

                  {notificationsOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-2xl shadow-2xl py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 z-50 animate-fadeIn">
                      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 dark:border-zinc-800">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">Notifications</span>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllRead}
                            className="text-[10px] text-ruby-600 hover:text-ruby-700 dark:text-ruby-400 font-extrabold"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 dark:divide-zinc-800">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <p className="text-sm text-gray-400">No notifications yet.</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Activity from badges and replies will appear here.</p>
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className={`px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition ${
                                notif.read ? "opacity-60" : "bg-ruby-50/30 dark:bg-ruby-950/20"
                              }`}
                            >
                              <p className="text-xs text-gray-800 dark:text-gray-200 leading-normal">
                                {notif.message || notif.text}
                              </p>
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

              {/* User Dropdown or Sign In CTA */}
              {user && profile ? (
                <div className="relative">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(!userDropdownOpen);
                      setNotificationsOpen(false);
                    }}
                    className="flex items-center space-x-1.5 focus:outline-none"
                    aria-label="User menu"
                  >
                    <img
                      src={profile.avatar_url || "/avatar1.png"}
                      className="h-9 w-9 rounded-full object-cover border-2 border-ruby-500 shadow-sm"
                      alt={profile.name}
                    />
                  </button>

                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-52 rounded-2xl shadow-2xl py-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 z-50 animate-fadeIn">
                      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-zinc-800">
                        <p className="text-sm font-extrabold truncate text-gray-900 dark:text-white">{profile.name}</p>
                        <p className="text-xs text-ruby-600 dark:text-ruby-400 capitalize font-medium">{profile.role}</p>
                      </div>
                      <Link
                        to="/profile"
                        onClick={() => setUserDropdownOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-ruby-50 dark:hover:bg-zinc-800 font-medium"
                      >
                        Your Profile
                      </Link>
                      <Link
                        to="/lab"
                        onClick={() => setUserDropdownOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-ruby-50 dark:hover:bg-zinc-800 font-medium"
                      >
                        Meme Lab
                      </Link>
                      {profile.role === "admin" && (
                        <Link
                          to="/admin"
                          onClick={() => setUserDropdownOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-ruby-50 dark:hover:bg-zinc-800 font-medium"
                        >
                          Admin Panel
                        </Link>
                      )}
                      <button
                        onClick={handleSignOut}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link
                    to="/auth"
                    className="text-gray-700 dark:text-gray-300 hover:text-ruby-600 dark:hover:text-ruby-400 font-bold text-xs px-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/auth?mode=register"
                    className="bg-ruby-600 hover:bg-ruby-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-md shadow-ruby-500/20 transition"
                  >
                    Join Free
                  </Link>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. BOTTOM NAVIGATION BAR (Fixed Viewport Docked App Bar)
          ────────────────────────────────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 sm:bottom-3 left-0 right-0 z-40 px-2 sm:px-4 pointer-events-none">
        <div className="pointer-events-auto max-w-lg mx-auto bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-gray-200/80 dark:border-zinc-800/80 shadow-2xl rounded-t-2xl sm:rounded-full py-1.5 px-2 sm:px-4 flex justify-around items-center gap-1">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center px-2 py-1.5 rounded-xl text-[10px] sm:text-xs transition-all duration-200 flex-1 ${
                  isActive
                    ? "text-ruby-600 dark:text-ruby-400 font-extrabold bg-ruby-50/90 dark:bg-ruby-950/50 scale-105"
                    : "text-gray-500 dark:text-gray-400 hover:text-ruby-600 dark:hover:text-ruby-400 font-medium hover:bg-gray-100/60 dark:hover:bg-zinc-800/60"
                }`
              }
            >
              <item.Icon className="w-5 h-5 mb-0.5" strokeWidth={2.2} />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Menu Drawer Toggle in Bottom Bar */}
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={`flex flex-col items-center justify-center px-2 py-1.5 rounded-xl text-[10px] sm:text-xs transition-all duration-200 flex-1 ${
              drawerOpen
                ? "text-ruby-600 dark:text-ruby-400 font-extrabold bg-ruby-50/90 dark:bg-ruby-950/50"
                : "text-gray-500 dark:text-gray-400 hover:text-ruby-600 dark:hover:text-ruby-400 font-medium hover:bg-gray-100/60 dark:hover:bg-zinc-800/60"
            }`}
          >
            <Menu className="w-5 h-5 mb-0.5" strokeWidth={2.2} />
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. FULL SLIDE-OUT MENU DRAWER (Global Search, Literacy Test, Links)
          ────────────────────────────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col justify-between p-5 overflow-y-auto border-r border-gray-200 dark:border-zinc-800">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-150 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "'Pacifico', cursive" }} className="text-xl text-ruby-600 dark:text-ruby-400">
                    MemeClassroom
                  </span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Global Search inside Drawer */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Global Search
                </span>
                <SmartSearchBar
                  items={globalIndex}
                  fieldWeights={[
                    { field: "title", weight: 3 },
                    { field: "subject", weight: 2 },
                    { field: "keywords", weight: 2 }
                  ]}
                  placeholder="Search memes, use cases..."
                  onSuggestionSelect={handleGlobalSuggestionSelect}
                  onSearch={handleGlobalSearch}
                  voiceEnabled={true}
                  size="sm"
                />
              </div>

              {/* Drawer Links */}
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-2">
                  Navigation & Tools
                </span>
                
                <Link
                  to="/"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 hover:text-ruby-600 transition"
                >
                  <Home className="w-4 h-4 text-ruby-600 dark:text-ruby-400" />
                  <span>Home</span>
                </Link>

                <Link
                  to="/resources"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 hover:text-ruby-600 transition"
                >
                  <BookOpenCheck className="w-4 h-4 text-amber-500" />
                  <span>Resources & Use Cases</span>
                </Link>

                <Link
                  to="/library"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 hover:text-ruby-600 transition"
                >
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <span>Meme Library</span>
                </Link>

                <Link
                  to="/lab"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 hover:text-ruby-600 transition"
                >
                  <FlaskConical className="w-4 h-4 text-ruby-500" />
                  <span>Meme Lab Studio</span>
                </Link>

                <Link
                  to="/staffroom"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 hover:text-ruby-600 transition"
                >
                  <MessageSquare className="w-4 h-4 text-teal-500" />
                  <span>Staffroom Forum</span>
                </Link>

                <Link
                  to="/meme-literacy-test"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600 transition"
                >
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Meme Literacy Assessment</span>
                </Link>

                <Link
                  to="/about"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 hover:text-ruby-600 transition"
                >
                  <Info className="w-4 h-4 text-blue-500" />
                  <span>About MemeClassroom</span>
                </Link>

                {user && profile && (
                  <>
                    <Link
                      to="/profile"
                      onClick={() => setDrawerOpen(false)}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 hover:text-ruby-600 transition"
                    >
                      <User className="w-4 h-4 text-purple-500" />
                      <span>Your Profile & Badges</span>
                    </Link>

                    {(profile.role === "admin" || profile.role === "manager") && (
                      <Link
                        to="/admin"
                        onClick={() => setDrawerOpen(false)}
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 hover:text-ruby-600 transition"
                      >
                        <Settings className="w-4 h-4 text-emerald-500" />
                        <span>Admin Management</span>
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Footer in Drawer */}
            <div className="pt-4 border-t border-gray-150 dark:border-zinc-800 space-y-3">
              {!user ? (
                <div className="space-y-2">
                  <Link
                    to="/auth"
                    onClick={() => setDrawerOpen(false)}
                    className="w-full block text-center py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/auth?mode=register"
                    onClick={() => setDrawerOpen(false)}
                    className="w-full block text-center py-2.5 bg-ruby-600 hover:bg-ruby-700 text-white rounded-xl text-sm font-bold shadow-md shadow-ruby-500/20 transition"
                  >
                    Join Free
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleSignOut}
                  className="w-full py-2.5 text-center text-xs font-extrabold text-red-600 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 rounded-xl transition"
                >
                  Sign Out of Account
                </button>
              )}
            </div>

          </div>
          {/* Overlay dismissal */}
          <div className="flex-1" onClick={() => setDrawerOpen(false)} />
        </div>
      )}
    </>
  );
};

export default Navbar;
