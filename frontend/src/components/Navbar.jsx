import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useTheme } from '../context/ThemeContext';
import { getUserRole, getRoleBadgeStyle } from '../auth/roleUtils';
import {
  BookOpen,
  BarChart2,
  LogOut,
  LogIn,
  User as UserIcon,
  Shield,
  Sparkles,
  ChevronDown,
  Sliders,
  Sun,
  Moon
} from 'lucide-react';

export const Navbar = () => {
  const { user, logout, isAdmin, isAuthenticated, role } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const currentRole = role || getUserRole(user, isAuthenticated);
  const badgeStyle = getRoleBadgeStyle(currentRole);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate('/auth', { replace: true });
  };

  // Close dropdown on outside click or Esc
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Top navigation items - My Courses, Mastery & Progress
  const navItems = [
    { path: '/', label: 'My Courses', icon: BookOpen },
    { path: '/progress', label: 'Mastery & Progress', icon: BarChart2 },
  ];

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : (user?.username ? `@${user.username}` : (user?.email?.split('@')[0] || (currentRole === 'Guest' ? 'Guest' : 'Student')));

  return (
    <header className="bg-[var(--bg-navbar)] backdrop-blur-md border-b border-[var(--border-color)] sticky top-0 z-40 text-[var(--text-primary)] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group" aria-label="Syllabus Tutor Home">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform" aria-hidden="true">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 dark:from-indigo-300 dark:via-indigo-200 dark:to-purple-300 bg-clip-text text-transparent">
                SyllabusTutor
              </span>
              <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                AI Multi-Agent
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-label={item.label}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-semibold border border-indigo-500/30 shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {isAdmin && (
              <Link
                to="/admin"
                aria-label="Administrator Control Center"
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-all"
              >
                <Shield className="w-4 h-4 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                <span>Admin</span>
              </Link>
            )}
          </nav>

          {/* Theme Toggle & Consolidated Profile Dropdown */}
          <div className="flex items-center gap-2">
            {/* Quick Theme Toggle Button */}
            <button
              type="button"
              id="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)] transition-all cursor-pointer shadow-2xs"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[var(--text-secondary)]" />
              )}
            </button>

            {/* Profile Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                id="profile-dropdown-btn"
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)] transition-all text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm group"
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="Avatar"
                    className="w-6 h-6 rounded-full object-cover border border-indigo-500 shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold shrink-0 group-hover:bg-indigo-500 transition-colors">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-[var(--text-primary)] truncate max-w-[120px] sm:max-w-[150px]">
                  {displayName}
                </span>
                <span
                  id="user-role-badge"
                  data-role={currentRole.toLowerCase()}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${badgeStyle}`}
                >
                  {currentRole}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${
                    dropdownOpen ? 'rotate-180 text-indigo-500' : ''
                  }`}
                />
              </button>

              {/* Interactive Dropdown Menu */}
              {dropdownOpen && (
                <div
                  id="profile-dropdown-menu"
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-[var(--text-primary)]"
                >
                  {/* Account details header */}
                  <div className="px-4 py-2.5 border-b border-[var(--border)] text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[var(--text-primary)] truncate">{displayName}</p>
                      <span
                        id="dropdown-role-badge"
                        data-role={currentRole.toLowerCase()}
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${badgeStyle}`}
                      >
                        {currentRole}
                      </span>
                    </div>
                    <p className="text-[var(--text-muted)] text-[11px] truncate mt-0.5">
                      {user?.email || (currentRole === 'Guest' ? 'Visitor / Guest Access' : '')}
                    </p>
                  </div>

                  <div className="py-1">
                    {isAuthenticated ? (
                      <>
                        {/* Action 1: Profile */}
                        <button
                          type="button"
                          id="dropdown-profile-btn"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate('/profile', { state: { tab: 'personal' } });
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors text-left cursor-pointer"
                        >
                          <UserIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                          <span>Profile</span>
                        </button>

                        {/* Action 2: Settings */}
                        <button
                          type="button"
                          id="dropdown-settings-btn"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate('/profile', { state: { tab: 'preferences' } });
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors text-left cursor-pointer"
                        >
                          <Sliders className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                          <span>Settings</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        id="dropdown-login-btn"
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate('/auth');
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors text-left cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>Sign In / Register</span>
                      </button>
                    )}
                  </div>

                  {/* Action 3: Log Out (only if logged in) */}
                  {isAuthenticated && (
                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        type="button"
                        id="dropdown-logout-btn"
                        onClick={() => {
                          setDropdownOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
