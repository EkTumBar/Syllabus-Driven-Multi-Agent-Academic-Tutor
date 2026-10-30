import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/useAuth';
import { ThemeProvider } from './context/ThemeContext';
import { AuthPage } from './auth/AuthPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './admin/AdminRoute';
import { Navbar } from './components/Navbar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './pages/Home';
import { Course } from './pages/Course';
import { Progress } from './pages/Progress';
import { CourseStats } from './pages/CourseStats';
import { Profile } from './pages/Profile';
import { AdminDashboard } from './admin/AdminDashboard';

// Main application layout with persistent navbar and global theme tokens
const AppLayout = () => {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col font-sans transition-colors duration-200">
      <Navbar />
      <main className="flex-1">
        <ErrorBoundary fallbackTitle="View Rendering Error" fallbackDescription="An unexpected error occurred while rendering this page:">
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="py-6 border-t border-[var(--border-color)] bg-[var(--bg-footer)] text-center text-xs text-[var(--text-secondary)] transition-colors duration-200">
        <p>Syllabus-Driven Multi-Agent Academic Tutor • Powered by Google Gemini & LangGraph</p>
      </footer>
    </div>
  );
};

// Route component for /auth that redirects logged-in users based ONLY on the
// role the backend returned for them (never on anything chosen in the UI):
// verified admins -> /admin, everyone else -> / (the student home).
const PublicAuthRoute = () => {
  const { isAuthenticated, isAdmin, isLoading, loading } = useAuth();
  const checking = isLoading ?? loading;

  if (checking) return null;
  if (isAuthenticated) {
    return <Navigate to={isAdmin ? '/admin' : '/'} replace />;
  }

  return <AuthPage />;
};

function App() {
  return (
    <ThemeProvider>
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
                <Route path="/mastery" element={<Navigate to="/progress" replace />} />
                <Route path="/mastery/:courseId" element={<CourseStats />} />
                <Route path="/profile" element={<Profile />} />

                {/* Admin Guarded Route */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                </Route>
              </Route>
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
