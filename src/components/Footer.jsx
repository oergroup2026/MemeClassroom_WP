import React from "react";
import { Link } from "react-router-dom";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pb-20 sm:pb-24">
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
                <Link
                  to="/privacy"
                  className="text-xs text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-xs text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="/terms#fair-use"
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline transition font-medium"
                >
                  Fair Use & OER Notice ↗
                </a>
              </li>
              <li>
                <a
                  href="mailto:memeclassroom@gmail.com"
                  className="text-xs text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition"
                >
                  Contact Grievance Officer
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Educational-use & content withdrawal notice.
            Deliberately in plain language and at a readable size: the small
            print below carries the same meaning in legal terms, but students,
            parents and teachers need to be able to actually read and act on
            this. Shown site-wide. */}
        <div className="mt-8 rounded-2xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/70 dark:bg-amber-950/25 p-4 sm:p-5">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-1.5">
            About the content on this site
          </h3>
          <p className="text-xs leading-relaxed text-amber-900/85 dark:text-amber-100/80">
            MemeClassroom is a <strong>non-commercial educational project</strong>. Memes and
            other material are shared here for teaching, learning and commentary only.
            Some posts may include well-known images or clips, used for educational
            purposes under fair dealing / fair use.
          </p>
          <p className="mt-2.5 text-xs leading-relaxed text-amber-900/85 dark:text-amber-100/80">
            <strong>If you own the rights to something here and would like it removed,
            or if you have posted something and want it taken down, just ask.</strong>{" "}
            Email{" "}
            <a
              href="mailto:memeclassroom@gmail.com?subject=Content%20withdrawal%20request"
              className="font-semibold text-amber-800 dark:text-amber-300 underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-200"
            >
              memeclassroom@gmail.com
            </a>{" "}
            and we will withdraw it promptly. No explanation needed, and no account is
            required to make a request.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-[10px] text-gray-400">
            © {year} MemeClassroom. Built for educators, by educators.
          </p>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 text-[10px] text-gray-500 dark:text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Open Educational Resource (OER) · Indian Copyright Act Sec 52 & Fair Use · CC BY-NC-SA 4.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
