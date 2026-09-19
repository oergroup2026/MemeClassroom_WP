import React, { lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AccessibilityWidget from './components/AccessibilityWidget';
import ProtectedRoute from './components/ProtectedRoute';
import WelcomeModal from './components/WelcomeModal';
import DeferredSetupBanner from './components/DeferredSetupBanner';
import BadgeAwardModal from './components/BadgeAwardModal';
import { useUdl } from './context/UdlContext';
import { useAuth } from './context/AuthContext';

// Statically import Home for fast initial LCP
import Home from './pages/Home';

// Lazy-loaded page components for optimal code splitting & bundle reduction
const Library = lazy(() => import('./pages/Library'));
const Lab = lazy(() => import('./pages/Lab'));
const Resources = lazy(() => import('./pages/Resources'));
const Newspaper = lazy(() => import('./pages/Newspaper'));
const MemeStoryDetail = lazy(() => import('./pages/MemeStoryDetail'));
const ActivityDetail = lazy(() => import('./pages/ActivityDetail'));
const Staffroom = lazy(() => import('./pages/Staffroom'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/Admin'));
const Auth = lazy(() => import('./pages/Auth'));
const About = lazy(() => import('./pages/About'));
const NotFound = lazy(() => import('./pages/NotFound'));
const MemeLiteracyTest = lazy(() => import('./pages/MemeLiteracyTest'));
const SlangQuiz = lazy(() => import('./pages/SlangQuiz'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const IsBanned = lazy(() => import('./pages/IsBanned'));

// Page loading fallback spinner
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
    <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin dark:border-purple-900/50 dark:border-t-purple-400" />
    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 animate-pulse">Loading MemeClassroom…</span>
  </div>
);

function App() {
  const { highContrastMode, fontSizeAdjustment } = useUdl();
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect banned users to /banned
  React.useEffect(() => {
    if (user && profile?.banned && location.pathname !== '/banned') {
      navigate('/banned', { replace: true });
    }
  }, [user, profile?.banned, location.pathname, navigate]);

  React.useEffect(() => {
    if (highContrastMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [highContrastMode]);

  // Scroll to top on route change
  React.useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } else {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    }
  }, [location.pathname, location.hash]);

  // UDL baseline styling options
  const themeClasses = highContrastMode 
    ? 'bg-zinc-900 text-zinc-100' 
    : 'bg-[#FAFAF9] text-gray-800';

  // Legibility rules: normal baseline is 'text-base'
  const sizeClasses = fontSizeAdjustment === 'large' 
    ? 'text-lg' 
    : fontSizeAdjustment === 'extra-large' 
      ? 'text-xl' 
      : 'text-base'; 

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-all duration-200 ${themeClasses} ${sizeClasses}`}>
      <div id="app-navbar"><Navbar /></div>
      <main id="main-content" key={location.pathname} className={`flex-grow page-enter overflow-x-hidden ${location.pathname === '/lab' ? 'w-full min-h-[calc(100dvh-64px)] pb-24 sm:pb-28 overflow-y-auto flex flex-col p-1.5 sm:p-2 bg-[#FAFAF9] dark:bg-[#090D16] text-slate-800 dark:text-white transition-colors duration-200' : location.pathname === '/' ? 'w-full pb-24 sm:pb-28' : 'container mx-auto px-4 py-6 pb-24 sm:pb-28'}`}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            {/* Library and Resources are public — no login needed to view */}
            <Route path="/library" element={<Library />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/resources/story/:id" element={<MemeStoryDetail />} />
            <Route path="/resources/activity/:id" element={<ActivityDetail />} />
            <Route path="/newspaper" element={<Newspaper />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/about" element={<About />} />
            
            {/* Public Routes accessible without authentication */}
            <Route path="/lab" element={<Lab />} />
            <Route path="/staffroom" element={<Staffroom />} />
            <Route path="/meme-literacy-test" element={<MemeLiteracyTest />} />
            <Route path="/meme-literacy-test/:testId" element={<MemeLiteracyTest />} />
            <Route path="/slang-quiz" element={<SlangQuiz />} />
            
            <Route path="/banned" element={<IsBanned />} />

            <Route path="/profile" element={
              <ProtectedRoute allowedRoles={['student', 'teacher', 'research', 'parent', 'other', 'expert', 'admin', 'manager']}>
                <Profile />
              </ProtectedRoute>
            } />
            
            {/* Protected Route for Admins & Managers */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin', 'manager']}>
                <Admin />
              </ProtectedRoute>
            } />

            {/* Legal pages */}
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />

            {/* Catch-all 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {location.pathname !== '/lab' && <div id="app-footer"><Footer /></div>}
      <AccessibilityWidget />
      <WelcomeModal />
      <DeferredSetupBanner />
      <BadgeAwardModal />
    </div>
  );
}

export default App;

