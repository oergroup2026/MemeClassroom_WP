import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto text-center py-12">
      <div className="mb-8">
        <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 text-xs font-bold px-3.5 py-1.5 rounded-lg uppercase tracking-wider">
          Learning + Humour
        </span>
      </div>

      <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 bg-gradient-to-r from-purple-700 via-indigo-650 to-cyan-600 bg-clip-text text-transparent leading-tight">
        MemeClassroom
      </h1>

      <p className="text-lg md:text-xl text-gray-550 dark:text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
        Where educational memes bridge the gap between textbook dry concepts and classroom laughter.
        Collaborate with teachers, students, and subject experts.
      </p>

      <div className="flex flex-wrap justify-center gap-4 mb-16">
        <Link
          to="/library"
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-7 py-3.5 rounded-xl shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md"
        >
          Browse Library
        </Link>
        {user ? (
          <Link
            to="/lab"
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold px-7 py-3.5 rounded-xl shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md"
          >
            Go to Meme Lab
          </Link>
        ) : (
          <Link
            to="/auth"
            className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold px-7 py-3.5 rounded-xl shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md"
          >
            Join Free
          </Link>
        )}
      </div>

      {/* Platform Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white dark:bg-gray-850 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mb-12">
        <div>
          <div className="text-3xl font-extrabold text-purple-600">1,250+</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Memes Created</div>
        </div>
        <div>
          <div className="text-3xl font-extrabold text-purple-600">340+</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Active Teachers</div>
        </div>
        <div>
          <div className="text-3xl font-extrabold text-purple-600">85+</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Verified Experts</div>
        </div>
        <div>
          <div className="text-3xl font-extrabold text-purple-600">15+</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1 font-bold">Subjects Covered</div>
        </div>
      </div>

      {/* Feature Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
        <Link to="/lab" className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md block">
          <div className="text-indigo-600 mb-4 text-2xl"><img src="research.png" alt="not" className="w-10 h-10" /></div>
          <h3 className="font-extrabold text-base mb-1.5">Meme Lab</h3>
          <p className="text-xs text-gray-500 leading-relaxed">Create image, video, audio or GIF memes with text overlays.</p>
        </Link>
        <Link to="/library" className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md block">
          <div className="text-indigo-600 mb-4 text-2xl"><img src="stack-of-books.png" alt="not" className="w-10 h-10" /></div>
          <h3 className="font-extrabold text-base mb-1.5">Meme Library</h3>
          <p className="text-xs text-gray-500 leading-relaxed">Explore, rate, like and comment on community-published memes.</p>
        </Link>
        <Link to="/staffroom" className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md block">
          <div className="text-indigo-600 mb-4 text-2xl"><img src="school.png" alt="not" className="w-10 h-10" /></div>
          <h3 className="font-extrabold text-base mb-1.5">Staffroom</h3>
          <p className="text-xs text-gray-500 leading-relaxed">Discuss classroom experiences, outcomes, and strategies.</p>
        </Link>
        <Link to="/resources" className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md block">
          <div className="text-indigo-600 mb-4 text-2xl"><img src="process.png" alt="not" className="w-10 h-10" /></div>
          <h3 className="font-extrabold text-base mb-1.5">Resources</h3>
          <p className="text-xs text-gray-500 leading-relaxed">Access research, lesson plans, articles, and activities.</p>
        </Link>
      </div>
    </div>
  );
};

export default Home;
