import React from "react";
import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="mb-6 text-6xl select-none">😵</div>
      <h1 className="text-5xl font-black tracking-tight text-gray-900 dark:text-white mb-3">
        404
      </h1>
      <p className="text-base font-bold text-gray-500 dark:text-gray-400 mb-1">
        This page doesn't exist.
      </p>
      <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm mb-8 leading-relaxed">
        Like a meme that missed the moment — this URL is out of context. Let's
        get you back somewhere useful.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition"
        >
          Go Home
        </Link>
        <Link
          to="/library"
          className="border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold px-6 py-2.5 rounded-xl text-sm transition"
        >
          Browse Library
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
