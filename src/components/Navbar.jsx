import React, { useState, useEffect, useRef, useCallback } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
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
  Newspaper as NewspaperIcon,
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

const TASKBAR_PAGE_SHOW_MS  = 45_000; // visible for 45 s after page load / navigation
const TASKBAR_HOVER_LEAVE_MS = 1_500;  // hide 1.5 s after mouse leaves the taskbar area

const Navbar = () => {
  const { user, profile, signOut } = useAuth();
  const { highContrastMode, toggleHighContrast, a11yMenuOpen, toggleA11yMenu } = useUdl();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [globalIndex, setGlobalIndex] = useState([]);
  const [searchExpanded, setSearchExpanded] = useState(false);
  // Taskbar auto-hide: visible on page load; hides after 45 s or 1.5 s post-hover
  const [taskbarVisible, setTaskbarVisible] = useState(true);
  const hideTimerRef      = useRef(null);
  const isHoveringRef     = useRef(false); // true while mouse is inside taskbar / hover zone
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  // On the Home page only, the header floats transparently over the hero
  // until the user scrolls a little, then becomes today's solid header.
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  useEffect(() => {
    if (!isHome) { setScrolledPastHero(false); return; }
    const onScroll = () => setScrolledPastHero(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);
  const isFloatingHeader = isHome && !scrolledPastHero;

  // Load global search items
  useEffect(() => {
    let isMounted = true;
    const fetchGlobalItems = async () => {
      try {
        // allSettled, not all: one source failing (a permission error, a missing
        // index) must not wipe out the entire search index. Promise.all used to
        // reject the whole batch, so a single denied query left the global
        // search box with nothing in it at all.
        const [memesSnap, resourcesSnap, threadsSnap] = await Promise.allSettled([
          getDocs(query(collection(db, "memes"), where("visibility", "==", "public"), limit(30))),
          getDocs(query(collection(db, "resources"), limit(30))),
          getDocs(query(collection(db, "threads"), limit(30)))
        ]);

        if (!isMounted) return;

        const docsOf = (settled) => (settled.status === "fulfilled" ? settled.value.docs : []);
        const combined = [
          ...docsOf(memesSnap).map((d) => ({ id: d.id, ...d.data(), _type: "meme" })),
          ...docsOf(resourcesSnap).map((d) => ({ id: d.id, ...d.data(), _type: d.data().type || "resource" })),
          ...docsOf(threadsSnap).map((d) => ({ id: d.id, ...d.data(), _type: d.data().post_type || "thread" }))
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

  // ── Taskbar auto-hide helpers ─────────────────────────────────────────────
  // Schedule a hide after `delay` ms — but only if the mouse isn't inside.
  const scheduleHide = useCallback((delay) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isHoveringRef.current) setTaskbarVisible(false);
    }, delay);
  }, []);

  // Show taskbar and start the 45 s page-visibility countdown.
  const showTaskbar = useCallback((delay = TASKBAR_PAGE_SHOW_MS) => {
    setTaskbarVisible(true);
    scheduleHide(delay);
  }, [scheduleHide]);

  // On every page navigation: show taskbar and (re)start the 45 s timer.
  useEffect(() => {
    isHoveringRef.current = false;
    showTaskbar(TASKBAR_PAGE_SHOW_MS);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Mouse enters taskbar or hover zone → show immediately, cancel hide timer.
  const handleTaskbarEnter = useCallback(() => {
    isHoveringRef.current = true;
    setTaskbarVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  // Mouse leaves taskbar → hide after a short grace period.
  const handleTaskbarLeave = useCallback(() => {
    isHoveringRef.current = false;
    scheduleHide(TASKBAR_HOVER_LEAVE_MS);
  }, [scheduleHide]);

  // Arrow toggle: click to pin open (45 s timer) or force-close.
  const toggleTaskbar = useCallback(() => {
    if (taskbarVisible) {
      isHoveringRef.current = false;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setTaskbarVisible(false);
    } else {
      showTaskbar(TASKBAR_PAGE_SHOW_MS);
    }
  }, [taskbarVisible, showTaskbar]);
  // ──────────────────────────────────────────────────────────────────────────

  const bottomNavItems = [
    { to: "/", label: "Home", Icon: Home, end: true },
    { to: "/resources", label: "Resources", Icon: BookOpenCheck },
    { to: "/library", label: "Library", Icon: BookOpen },
    { to: "/lab", label: "Lab", Icon: FlaskConical },
    { to: "/staffroom", label: "Staffroom", Icon: MessageSquare },
    { to: "/newspaper", label: "Newspaper", Icon: NewspaperIcon },
  ];

  return (
    <>
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP HEADER (Central Classroom Title + Menu Trigger & Quick Actions)
          ────────────────────────────────────────────────────────────────────────── */}
      <header
        className={
          isFloatingHeader
            ? "fixed top-0 inset-x-0 z-30 bg-transparent border-b border-transparent text-gray-900 dark:text-white transition-all duration-300"
            : isHome
              // Solid state on Home stays `fixed` too (never `sticky`) — switching
              // position type mid-scroll breaks sticky's "stuck to viewport"
              // behavior, since its in-flow anchor point is above the scrolled
              // viewport by then. A permanently-fixed header on Home just overlays
              // content once scrolled, which is fine given this page's spacing.
              ? "fixed top-0 inset-x-0 z-30 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md border-b border-gray-200/80 dark:border-zinc-800/80 text-gray-850 dark:text-zinc-100 transition-all duration-200"
              : "sticky top-0 z-30 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md border-b border-gray-200/80 dark:border-zinc-800/80 text-gray-850 dark:text-zinc-100 transition-all duration-200"
        }
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">

            {/* Left: Menu Drawer Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDrawerOpen(true)}
                className={
                  isFloatingHeader
                    ? "inline-flex items-center justify-center p-2 rounded-xl bg-gray-900/5 dark:bg-white/10 backdrop-blur-sm text-gray-900 dark:text-white hover:bg-gray-900/10 dark:hover:bg-white/20 transition border border-gray-300 dark:border-white/20"
                    : "inline-flex items-center justify-center p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-ruby-50 hover:text-ruby-600 dark:hover:bg-ruby-950/40 dark:hover:text-ruby-400 transition border border-gray-200 dark:border-zinc-700 shadow-xs"
                }
                aria-label="Open menu drawer"
              >
                <Menu className={isFloatingHeader ? "w-5 h-5 text-gray-900 dark:text-white" : "w-5 h-5 text-ruby-600 dark:text-ruby-400"} />
              </button>
            </div>

            {/* Center: Centralized Classroom Title — hidden while floating over the
                hero (the hero's own big "MemeClassroom" title sits right below it) */}
            <div className="flex items-center justify-center flex-1">
              {!isFloatingHeader && (
                <Link
                  to="/"
                  className="group inline-flex items-center gap-1.5 text-xl sm:text-2xl font-black tracking-tight text-gray-900 dark:text-white hover:text-ruby-600 dark:hover:text-ruby-400 transition"
                >
                  <span style={{ fontFamily: "'Pacifico', cursive" }} className="text-ruby-600 dark:text-ruby-400">Meme</span>
                  <span className="font-extrabold tracking-tight">Classroom</span>
                  <span className="w-2 h-2 rounded-full bg-ruby-600 dark:bg-ruby-400" />
                </Link>
              )}
            </div>

            {/* Right: Accessibility Toggle, Notifications, User Avatar */}
            <div className="flex items-center space-x-2.5">
              {/* Accessibility / High Contrast Toggle */}
              <button
                onClick={toggleHighContrast}
                className={
                  isFloatingHeader
                    ? "p-2 rounded-full border border-gray-300 dark:border-white/20 bg-gray-900/5 dark:bg-white/10 backdrop-blur-sm text-gray-900 dark:text-white hover:bg-gray-900/10 dark:hover:bg-white/20 transition"
                    : `p-2 rounded-full border transition ${highContrastMode
                      ? "border-ruby-500 bg-ruby-600/10 text-ruby-400 hover:bg-ruby-600/20"
                      : "border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
                      }`
                }
                title={highContrastMode ? "Disable Dark Theme" : "Enable Dark Theme"}
                aria-label="Toggle Dark Theme"
              >
                <ContrastIcon />
              </button>

              {/* Real-time Notifications Bell */}
              <div className="relative">
                <button
                  onClick={() => {
                    if (user) {
                      setNotificationsOpen(!notificationsOpen);
                      setUserDropdownOpen(false);
                    } else {
                      navigate("/auth");
                    }
                  }}
                  className={
                    isFloatingHeader
                      ? "p-2 rounded-full text-gray-900 dark:text-white relative focus:outline-none transition border border-gray-300 dark:border-white/20 bg-gray-900/5 dark:bg-white/10 backdrop-blur-sm hover:bg-gray-900/10 dark:hover:bg-white/20"
                      : "p-2 rounded-full text-gray-500 dark:text-gray-400 hover:text-ruby-600 dark:hover:text-ruby-400 relative focus:outline-none transition border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  }
                  aria-label="View notifications"
                >
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-ruby-600 ring-2 ring-white dark:ring-zinc-900 animate-pulse" />
                  )}
                  <BellIcon />
                </button>

                {user && notificationsOpen && (
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
                          <div key={notif.id} className="p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition">
                            <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200">{notif.title || notif.message}</p>
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

              {/* User Dropdown or Guest Avatar CTA */}
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
                    className="flex items-center gap-2 group"
                    title="Sign In / Register"
                  >
                    <img
                      src="/avatar1.png"
                      className="h-9 w-9 rounded-full object-cover border-2 border-ruby-500 shadow-sm group-hover:scale-105 transition"
                      alt="Sign in"
                    />
                  </Link>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. WINDOWS-STYLE TASKBAR (Fixed Full-Width Viewport Docked Taskbar)
          • Shows for 45 s on every page load / navigation, then slides down.
          • Hovering the bottom edge (hover zone) instantly slides it back up.
          • Mouse leaving the taskbar area hides it after 1.5 s grace period.
          • Arrow toggle pins it open (45 s) or force-closes it.
          ────────────────────────────────────────────────────────────────────────── */}

      {/*
        Invisible hover zone — always rendered at the very bottom of the viewport.
        When the taskbar is hidden (translated off-screen) this thin strip is the
        only thing the user's cursor touches, triggering the slide-up reveal.
        z-index is between the taskbar (z-40) and page content so it never blocks
        any interactive elements above it.
      */}
      <div
        aria-hidden="true"
        onMouseEnter={handleTaskbarEnter}
        onMouseLeave={handleTaskbarLeave}
        className="fixed bottom-0 left-0 right-0 z-[39] h-5"
      />

      {/* Left-side arrow toggle — always visible, sticks to bottom-left corner */}
      <button
        id="taskbar-toggle-btn"
        onClick={toggleTaskbar}
        onMouseEnter={handleTaskbarEnter}
        onMouseLeave={handleTaskbarLeave}
        aria-label={taskbarVisible ? "Hide taskbar" : "Show taskbar"}
        aria-expanded={taskbarVisible}
        title={taskbarVisible ? "Hide taskbar (T)" : "Show taskbar (T)"}
        className={`fixed bottom-4 left-0 z-50 flex items-center justify-center w-5 h-10 rounded-r-xl transition-all duration-300 shadow-md border border-l-0 ${
          highContrastMode
            ? "bg-zinc-800 border-zinc-600 text-ruby-400 hover:bg-zinc-700 hover:text-ruby-300"
            : "bg-white/95 dark:bg-zinc-900/95 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:text-ruby-600 dark:hover:text-ruby-400 hover:border-ruby-300 dark:hover:border-ruby-600"
        } backdrop-blur-md`}
      >
        {/* Chevron rotates to indicate direction */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform duration-300 ${taskbarVisible ? "rotate-90" : "-rotate-90"}`}
        >
          <polyline points="2,8 5,5 8,8" />
        </svg>
      </button>

      <nav
        aria-label="Windows Taskbar Navigation"
        onMouseEnter={handleTaskbarEnter}
        onMouseLeave={handleTaskbarLeave}
        className={`fixed bottom-0 left-0 right-0 z-40 w-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border-t border-gray-200/90 dark:border-zinc-800/90 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_-6px_30px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-in-out ${
          taskbarVisible ? "translate-y-0 pointer-events-auto" : "translate-y-full pointer-events-none"
        }`}
      >
        <div className="relative max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">

          {/* Left: Collapsed Search Icon Button / Expanded Search Bar */}
          <div className="flex items-center z-10">
            {searchExpanded ? (
              <div className="flex items-center gap-1.5 w-60 sm:w-72 md:w-80 animate-fadeIn">
                <SmartSearchBar
                  items={globalIndex}
                  fieldWeights={[
                    { field: "title", weight: 3 },
                    { field: "subject", weight: 2 },
                    { field: "keywords", weight: 2 }
                  ]}
                  placeholder="Search memes, resources..."
                  onSuggestionSelect={(s) => {
                    handleGlobalSuggestionSelect(s);
                    setSearchExpanded(false);
                  }}
                  onSearch={(q) => {
                    handleGlobalSearch(q);
                    setSearchExpanded(false);
                  }}
                  voiceEnabled={true}
                  autoFocus={true}
                  size="sm"
                  dropdownPosition="top"
                  className="w-full"
                />
                <button
                  type="button"
                  onClick={() => setSearchExpanded(false)}
                  className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition shrink-0"
                  title="Close search"
                  aria-label="Close search"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSearchExpanded(true)}
                className={`flex items-center justify-center p-2 sm:p-2.5 rounded-xl transition duration-200 border shadow-xs group ${highContrastMode
                  ? "bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:text-ruby-400"
                  : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200/80 hover:text-ruby-600"
                  }`}
                title="Search memes, resources... (Click to expand)"
                aria-label="Expand search"
              >
                <Search className={`w-4 h-4 transition-transform group-hover:scale-110 ${highContrastMode ? "text-ruby-400" : "text-ruby-600"}`} />
              </button>
            )}
          </div>

          {/* Center: Mathematically Centered Navigation Items */}
          <div className={`absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-0.5 sm:gap-1 md:gap-1.5 transition-all duration-200 ${searchExpanded ? 'hidden sm:flex opacity-40 md:opacity-100 pointer-events-none md:pointer-events-auto' : 'flex'}`}>
            {bottomNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs transition-all duration-200 group ${isActive
                    ? "text-ruby-600 dark:text-ruby-400 font-extrabold bg-ruby-50/90 dark:bg-ruby-950/50 shadow-xs"
                    : "text-gray-600 dark:text-zinc-400 hover:text-ruby-600 dark:hover:text-ruby-400 font-medium hover:bg-gray-100/80 dark:hover:bg-zinc-850/80"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.Icon
                      className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-ruby-600 dark:text-ruby-400" : ""
                        }`}
                      strokeWidth={isActive ? 2.4 : 2}
                    />
                    <span className="hidden md:inline">{item.label}</span>
                    {/* Active Windows taskbar indicator pill */}
                    {isActive && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 sm:w-6 h-0.5 sm:h-1 bg-ruby-600 dark:bg-ruby-400 rounded-full shadow-sm" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Right: Windows System Tray (Accessibility Button - Icon only, full dark theme support) */}
          <div className="flex items-center justify-end z-10">
            <button
              id="a11y-widget-trigger"
              onClick={toggleA11yMenu}
              aria-label="Open accessibility menu (Ctrl+U)"
              aria-expanded={a11yMenuOpen}
              aria-haspopup="dialog"
              title="Accessibility Options (Ctrl+U)"
              className={`flex items-center justify-center p-2 sm:p-2.5 rounded-xl transition-all duration-200 border shadow-xs ${a11yMenuOpen
                ? "bg-ruby-600 text-white border-ruby-500 shadow-md shadow-ruby-500/30 scale-105"
                : highContrastMode
                  ? "bg-zinc-800 text-ruby-400 border-zinc-700 hover:bg-zinc-700 hover:text-ruby-300 hover:border-ruby-500/60"
                  : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-ruby-50 hover:text-ruby-600 hover:border-ruby-200"
                }`}
            >
              {/* Person with arms raised — universal accessibility icon */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`shrink-0 ${a11yMenuOpen
                  ? "text-white"
                  : highContrastMode
                    ? "text-ruby-400"
                    : "text-gray-700"
                  }`}
              >
                <circle
                  cx="12"
                  cy="5"
                  r="2.5"
                  fill={a11yMenuOpen ? "currentColor" : highContrastMode ? "#fb7185" : "#e11d48"}
                  stroke="none"
                />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="5" y1="9" x2="12" y2="12" />
                <line x1="19" y1="9" x2="12" y2="12" />
                <line x1="12" y1="16" x2="9" y2="21" />
                <line x1="12" y1="16" x2="14" y2="21" />
              </svg>
            </button>
          </div>

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
                  <span>Resources</span>
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
                  <span>Meme Lab</span>
                </Link>

                <Link
                  to="/staffroom"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 hover:text-ruby-600 transition"
                >
                  <MessageSquare className="w-4 h-4 text-teal-500" />
                  <span>Staffroom</span>
                </Link>

                <Link
                  to="/newspaper"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 hover:text-ruby-600 transition"
                >
                  <NewspaperIcon className="w-4 h-4 text-rose-500" />
                  <span>Newspaper</span>
                </Link>

                <Link
                  to="/meme-literacy-test"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600 transition"
                >
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Meme Literacy Test</span>
                </Link>

                <Link
                  to="/about"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-800 dark:text-zinc-200 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 hover:text-ruby-600 transition"
                >
                  <Info className="w-4 h-4 text-blue-500" />
                  <span>About</span>
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
                        <span>Admin</span>
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
                    Register
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleSignOut}
                  className="w-full py-2.5 text-center text-xs font-extrabold text-red-600 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 rounded-xl transition"
                >
                  Sign Out
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
