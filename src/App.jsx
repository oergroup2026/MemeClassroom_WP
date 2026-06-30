import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
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
import MoreResources from './pages/MoreResources';
import { useUdl } from './context/UdlContext';

function App() {
  const { highContrastMode, fontSizeAdjustment } = useUdl();

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
      <main className="flex-grow container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/about" element={<About />} />
          <Route path="/more-resources" element={<MoreResources />} />
          
          {/* Protected Routes for Authenticated Users */}
          <Route path="/lab" element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'expert', 'admin']}>
              <Lab />
            </ProtectedRoute>
          } />
          <Route path="/resources" element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'expert', 'admin']}>
              <Resources />
            </ProtectedRoute>
          } />
          <Route path="/staffroom" element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'expert', 'admin']}>
              <Staffroom />
            </ProtectedRoute>
          } />
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
        </Routes>
      </main>
    </div>
  );
}

export default App;
