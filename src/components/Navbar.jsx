import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";

const Navbar = () => {
  const { user, profile, signOut } = useAuth();
  const { highContrastMode, toggleHighContrast } = useUdl();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
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
      { to: "/about", label: "About" },
      { to: "/more-resources", label: "More Resources" }
    ];

    if (user && profile) {
      links.push({ to: "/lab", label: "Meme Lab" });
      links.push({ to: "/staffroom", label: "Staffroom" });
      links.push({ to: "/resources", label: "Meme Resources" });
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
              <button className="p-1.5 rounded-full text-gray-400 hover:text-gray-500 relative">
                <span className="sr-only">View notifications</span>
                {/* <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white"></span> */}
                <img src="notification.png" alt="not" className="w-6 h-6" />
              </button>
            )}

            {/* Auth Buttons or User Menu */}
            {user && profile ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center space-x-2 focus:outline-none"
                >
                  <div className="h-8 w-8 rounded-full bg-purple-650 text-white flex items-center justify-center font-semibold text-sm border-2 border-purple-300">
                    {getInitials(profile.name)}
                  </div>
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
