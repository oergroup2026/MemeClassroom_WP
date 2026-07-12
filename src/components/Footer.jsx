import React from "react";
import { Link } from "react-router-dom";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">

          {/* Brand */}
          <div className="space-y-3">
            <p className="font-extrabold text-lg text-purple-600 dark:text-purple-400 tracking-tight">
              MemeClassroom
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">
              An open ped-tech platform for educators who believe learning can be
              both rigorous and joyful.
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-600">
              CC BY-NC-SA 4.0 · Content belongs to its creators
            </p>
          </div>

          {/* Platform links */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Platform
            </p>
            <ul className="space-y-2">
              {[
                { to: "/library", label: "Meme Library" },
                { to: "/resources", label: "Meme Reads" },
                { to: "/staffroom", label: "Staffroom" },
                { to: "/about", label: "About" },
              ].map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-xs text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info links */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Info
            </p>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/auth"
                  className="text-xs text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition"
                >
                  Sign In / Join
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className="text-xs text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition"
                >
                  Pedagogical Framework
                </Link>
              </li>
              <li>
                <a
                  href="mailto:memeclassroom@gmail.com"
                  className="text-xs text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition"
                >
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-[10px] text-gray-400">
            © {year} MemeClassroom. Built for educators, by educators.
          </p>
          <p className="text-[10px] text-gray-400">
            Powered by Open Pedagogy principles
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
