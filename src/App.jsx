import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Library from './pages/Library';
import Lab from './pages/Lab';
import Resources from './pages/Resources';
import Staffroom from './pages/Staffroom';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Auth from './pages/Auth';
import About from './pages/About';
import NotFound from './pages/NotFound';
import { useUdl } from './context/UdlContext';

function App() {
  const { highContrastMode, fontSizeAdjustment } = useUdl();
  const location = useLocation();

  React.useEffect(() => {
    if (highContrastMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [highContrastMode]);

  // UDL baseline styling options
  const themeClasses = highContrastMode 
    ? 'high-contrast bg-black text-gray-100' 
    : 'bg-white text-gray-800';

  // Legibility rules: normal baseline is 'text-base'
  const sizeClasses = fontSizeAdjustment === 'large' 
    ? 'text-lg' 
    : fontSizeAdjustment === 'extra-large' 
      ? 'text-xl' 
      : 'text-base'; 

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-all duration-200 ${themeClasses} ${sizeClasses}`}>
      <Navbar />
      <main key={location.pathname} className="flex-grow container mx-auto px-4 py-8 page-enter">
        <Routes>
          <Route path="/" element={<Home />} />
          {/* Library and Resources are public — no login needed to view */}
          <Route path="/library" element={<Library />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/about" element={<About />} />
          
          {/* Public Routes accessible without authentication */}
          <Route path="/lab" element={<Lab />} />
          <Route path="/staffroom" element={<Staffroom />} />
          
          <Route path="/profile" element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'expert', 'admin']}>
              <Profile />
            </ProtectedRoute>
          } />
          
          {/* Protected Route for Admins & Managers */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin', 'manager']}>
              <Admin />
            </ProtectedRoute>
          } />

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;

