import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";

const Navbar = () => {
  const { user, profile, signOut } = useAuth();
  const { highContrastMode, toggleHighContrast } = useUdl();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: "🎉 Welcome to Meme Classroom! Explore resources and start building memes.", read: false, time: "Just now" },
    { id: 2, text: "🏆 Level 1 badge unlocked! Check your profile page to see achievements.", read: false, time: "1 hour ago" },
    { id: 3, text: "💬 New thread in Staffroom: 'Pedagogical benefits of science memes'.", read: false, time: "2 hours ago" }
  ]);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      setUserDropdownOpen(false);
      navigate("/");
    } catch (e) {
      console.error("Sign out failed", e);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const renderNavLinks = (mobile = false) => {
    const linkClass = mobile
      ? "block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-250 hover:bg-gray-100 dark:hover:bg-gray-800"
      : "text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 font-medium transition duration-150";

    const links = [
      { to: "/", label: "Home" },
      { to: "/library", label: "Meme Library" },
      { to: "/resources", label: "Meme Resources" },
      { to: "/about", label: "About" }
    ];

    if (user && profile) {
      links.push({ to: "/lab", label: "Meme Lab" });
      links.push({ to: "/staffroom", label: "Staffroom" });
      links.push({ to: "/profile", label: "Profile" });

      if (profile.role === "admin" || profile.role === "manager") {
        links.push({ to: "/admin", label: "Admin Panel" });
      }
    }

    return links.map((link) => (
      <Link
        key={link.to}
        to={link.to}
        onClick={() => setMobileMenuOpen(false)}
        className={linkClass}
      >
        {link.label}
      </Link>
    ));
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

          <div className="flex items-center space-x-4">
            {/* High Contrast Toggle */}
            <button
              onClick={toggleHighContrast}
              className={`p-1.5 rounded-full border ${highContrastMode ? 'border-yellow-400 bg-yellow-400 text-black' : 'border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              title="Toggle High Contrast Mode"
            >
              <img src="dark-mode.png" alt="not" className="w-6 h-6" />
            </button>

            {/* Notification Bell */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => {
                    setNotificationsOpen(!notificationsOpen);
                    setUserDropdownOpen(false);
                  }}
                  className="p-1.5 rounded-full text-gray-400 hover:text-gray-500 relative focus:outline-none"
                >
                  <span className="sr-only">View notifications</span>
                  {notifications.some(n => !n.read) && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900 animate-pulse"></span>
                  )}
                  <svg className="w-6 h-6 text-gray-500 hover:text-purple-650 dark:text-gray-400 dark:hover:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl shadow-xl py-2 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 z-50 animate-fadeIn">
                    <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">Notifications</span>
                      {notifications.some(n => !n.read) && (
                        <button
                          onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                          className="text-[10px] text-purple-650 hover:text-purple-750 dark:text-purple-400 dark:hover:text-purple-300 font-extrabold"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-750">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-gray-400">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className={`px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-750 ${notif.read ? 'opacity-70' : 'bg-purple-50/20 dark:bg-purple-950/5'}`}
                          >
                            <p className="text-xs text-gray-800 dark:text-gray-200 leading-normal">{notif.text}</p>
                            <span className="block text-[9px] text-gray-400 mt-1">{notif.time}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Auth Buttons or User Menu */}
            {user && profile ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center space-x-2 focus:outline-none"
                >
                  <img
                    src={profile.avatar_url || "/avatar1.png"}
                    className="h-8 w-8 rounded-full object-cover border-2 border-purple-300"
                    alt={profile.name}
                  />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-50">
                    <div className="px-4 py-2 border-b border-gray-150 dark:border-gray-700">
                      <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{profile.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Your Profile
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-red-650 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-600"
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
                  className="text-gray-700 dark:text-gray-300 hover:text-purple-650 font-medium text-sm transition"
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
              >
                <span className="sr-only">Open main menu</span>
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
