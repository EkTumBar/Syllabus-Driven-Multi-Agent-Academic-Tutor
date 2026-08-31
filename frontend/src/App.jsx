import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/useAuth';
import { AuthPage } from './auth/AuthPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Course } from './pages/Course';
import { Progress } from './pages/Progress';

// Main application layout with persistent navbar
const AppLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="py-6 border-t border-slate-200 bg-white/50 text-center text-xs text-slate-400">
        <p>Syllabus-Driven Multi-Agent Academic Tutor • Powered by Google Gemini & LangGraph</p>
      </footer>
    </div>
  );
};

// Route component for /auth that redirects logged-in users to /
const PublicAuthRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <AuthPage />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Auth Screen */}
          <Route path="/auth" element={<PublicAuthRoute />} />

          {/* Protected Student Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/course/:id" element={<Course />} />
              <Route path="/progress" element={<Progress />} />
            </Route>
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
