import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Lock,
  Mail,
  UserCheck,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Info
} from 'lucide-react';
import { useAuth } from './useAuth';
import { supabase } from '../supabaseClient';

export function AuthPage({ onAuthSuccess }) {
  // Ensure default state is strictly "Sign In" with empty input fields
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('student');
  const [rememberMe, setRememberMe] = useState(false);

  // Status and feedback states
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [ssoFeedback, setSsoFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login, signup, forgotPassword } = useAuth();

  // Reset to default Sign In state with clean inputs upon mounting
  // Restore remembered email if "Remember Me" was previously chosen
  useEffect(() => {
    setIsLogin(true);
    setIsForgotPassword(false);
    setError(null);
    setSuccessMessage(null);
    setSsoFeedback(null);
    setShowPassword(false);

    const savedRemember = localStorage.getItem('syllabus_remember_me') === 'true';
    const savedEmail = localStorage.getItem('syllabus_remembered_email') || '';
    if (savedRemember && savedEmail) {
      setRememberMe(true);
      setEmail(savedEmail);
    } else {
      setRememberMe(false);
      setEmail('');
    }
    setPassword('');
  }, []);

  const handleTabSwitch = (targetModeIsLogin) => {
    setError(null);
    setSuccessMessage(null);
    setSsoFeedback(null);
    setShowPassword(false);
    setIsForgotPassword(false);
    setIsLogin(targetModeIsLogin);
  };

  const handleOpenForgotPassword = () => {
    setError(null);
    setSuccessMessage(null);
    setSsoFeedback(null);
    setIsForgotPassword(true);
  };

  const handleBackToSignIn = () => {
    setError(null);
    setSuccessMessage(null);
    setSsoFeedback(null);
    setIsForgotPassword(false);
    setIsLogin(true);
  };

  // Validation & Submit for Login and Create Account
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSsoFeedback(null);

    // Client-side validation displayed in the error state container
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await login(trimmedEmail, password);

        // Handle Remember Me persistence
        if (rememberMe) {
          localStorage.setItem('syllabus_remember_me', 'true');
          localStorage.setItem('syllabus_remembered_email', trimmedEmail);
        } else {
          localStorage.removeItem('syllabus_remember_me');
          localStorage.removeItem('syllabus_remembered_email');
        }
      } else {
        await signup(trimmedEmail, password, role);
      }

      if (onAuthSuccess) {
        onAuthSuccess();
      }
    } catch (err) {
      // Anti-enumeration defense:
      // Catch generic 401 Unauthorized (both invalid passwords and unregistered emails)
      // and display uniform "Incorrect email or password" error in the error container
      if (err.response?.status === 401) {
        setError('Incorrect email or password');
      } else {
        const detail =
          err.response?.data?.detail ||
          err.message ||
          'Authentication failed. Please check your credentials.';
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  // Blind Password Reset Submit Handler
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSsoFeedback(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      // Backend instantly returns 200 OK regardless of whether email exists (anti-enumeration)
      const res = await forgotPassword(trimmedEmail);
      setSuccessMessage(
        res?.message ||
          'If an account with that email exists, we have sent a password reset link.'
      );
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        err.message ||
        'If an account with that email exists, we have sent a password reset link.';
      // Under anti-enumeration principles, we still display the generic reset confirmation
      setSuccessMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  // SSO Authentication Handler
  const handleSSOClick = async (provider) => {
    setError(null);
    setSuccessMessage(null);
    setSsoFeedback(`Connecting to ${provider} Single Sign-On...`);

    const providerKey = provider.toLowerCase();
    if (!supabase) {
      const msg = 'Supabase client is not initialized. Please verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
      console.error('[SSO Error]', msg);
      setError(msg);
      setSsoFeedback(null);
      return;
    }

    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: providerKey === 'google' ? 'google' : providerKey,
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (oauthError) {
        console.error(`[SSO Error] Failed to initiate ${provider} sign-in:`, oauthError);
        setError(oauthError.message || `Failed to connect to ${provider} SSO.`);
        setSsoFeedback(null);
      }
    } catch (err) {
      console.error(`[SSO Error] Unexpected exception during ${provider} sign-in:`, err);
      setError(err?.message || `Unexpected error connecting to ${provider} SSO.`);
      setSsoFeedback(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col justify-center items-center px-4 py-12 selection:bg-sky-500 selection:text-white relative overflow-hidden transition-colors">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-sky-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center p-3.5 bg-[var(--bg-card)] rounded-2xl border border-sky-500/30 dark:border-sky-500/40 shadow-sm dark:shadow-[0_0_25px_rgba(56,189,248,0.2)] mb-4">
            <GraduationCap className="w-8 h-8 text-sky-500 dark:text-sky-400" />
          </div>
          <p className="text-indigo-600 dark:text-indigo-400 text-sm font-medium tracking-wide">
            Multi-Agent AI Academic Learning Platform
          </p>
        </div>

        {/* Sliding Card Container */}
        <div className="bg-[var(--bg-card)]/95 backdrop-blur-xl border border-[var(--border)] rounded-3xl p-7 sm:p-8 shadow-xl dark:shadow-[0_0_50px_-15px_rgba(30,58,138,0.25)] overflow-hidden relative">
          {/* Mode Switcher Buttons (Tabs) */}
          <div
            className="relative flex p-1 bg-[var(--bg-card-hover)] rounded-2xl border border-[var(--border)] mb-5"
            role="tablist"
            aria-label="Authentication Mode"
          >
            {/* Sliding highlight indicator */}
            <motion.div
              className="absolute top-1 bottom-1 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-xl shadow-xs"
              initial={false}
              animate={{
                left: isLogin && !isForgotPassword ? '4px' : !isLogin && !isForgotPassword ? '50%' : '4px',
                width: 'calc(50% - 4px)',
                opacity: isForgotPassword ? 0.35 : 1,
              }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />
            <button
              type="button"
              role="tab"
              id="tab-signin"
              aria-selected={isLogin && !isForgotPassword}
              onClick={() => handleTabSwitch(true)}
              className={`relative z-10 w-1/2 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                isLogin && !isForgotPassword
                  ? 'text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              id="tab-create-account"
              aria-selected={!isLogin && !isForgotPassword}
              onClick={() => handleTabSwitch(false)}
              className={`relative z-10 w-1/2 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                !isLogin && !isForgotPassword
                  ? 'text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Dedicated Error & Status Container (Red Text Banner below tabs) */}
          <div
            id="auth-error-container"
            className="min-h-[44px] mb-4 flex flex-col justify-center"
            aria-live="polite"
          >
            <AnimatePresence mode="wait">
              {error ? (
                <motion.div
                  key="error-banner"
                  id="auth-error-banner"
                  role="alert"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5 shadow-sm"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500 dark:text-red-400" aria-hidden="true" />
                  <span className="font-medium leading-relaxed">{error}</span>
                </motion.div>
              ) : successMessage ? (
                <motion.div
                  key="success-banner"
                  id="auth-success-banner"
                  role="status"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span className="font-medium leading-relaxed">{successMessage}</span>
                </motion.div>
              ) : ssoFeedback ? (
                <motion.div
                  key="sso-feedback-banner"
                  id="auth-sso-banner"
                  role="status"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs flex items-start gap-2.5 shadow-sm"
                >
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-500 dark:text-sky-400" aria-hidden="true" />
                  <span className="font-medium leading-relaxed">{ssoFeedback}</span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Conditional Forms: Forgot Password View vs Standard Auth View */}
          <AnimatePresence mode="wait">
            {isForgotPassword ? (
              /* Forgot Password Form */
              <motion.form
                key="forgot-password-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                onSubmit={handleForgotPasswordSubmit}
                className="space-y-4"
              >
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-sky-500 dark:text-sky-400" aria-hidden="true" />
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      Password Recovery
                    </span>
                  </div>
                  <button
                    type="button"
                    id="back-to-signin-top-btn"
                    onClick={handleBackToSignIn}
                    className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1 font-medium transition-colors focus:outline-none cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Back to Sign In</span>
                  </button>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Enter your registered academic email address to receive password recovery instructions.
                </p>

                <div>
                  <label
                    htmlFor="forgot-password-email-input"
                    className="block text-xs font-medium text-[var(--text-primary)] mb-1.5"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="forgot-password-email-input"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@university.edu"
                      className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  id="forgot-password-submit-btn"
                  disabled={loading}
                  className="w-full mt-5 py-2.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer active:scale-98"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Sending reset link...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <ArrowRight
                        className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    id="back-to-signin-bottom-btn"
                    onClick={handleBackToSignIn}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    Remember your password? <span className="text-sky-600 dark:text-sky-400 hover:underline">Sign In</span>
                  </button>
                </div>
              </motion.form>
            ) : (
              /* Standard Auth Form (Sign In / Create Account) */
              <motion.form
                key={isLogin ? 'login-form' : 'signup-form'}
                initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="auth-email-input"
                    className="block text-xs font-medium text-[var(--text-primary)] mb-1.5"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-email-input"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@university.edu"
                      className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="auth-password-input"
                    className="block text-xs font-medium text-[var(--text-primary)] mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-password-input"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus:outline-none cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me (left) and Forgot Password? (right) on the same line directly beneath password */}
                {isLogin && (
                  <div className="flex items-center justify-between text-xs pt-0.5 pb-0.5">
                    <label className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer select-none transition-colors">
                      <input
                        type="checkbox"
                        id="remember-me-checkbox"
                        name="rememberMe"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border border-[var(--border)] bg-[var(--bg-input)] text-sky-500 focus:ring-sky-500/30 focus:ring-1 cursor-pointer accent-sky-500"
                      />
                      <span>Remember Me</span>
                    </label>
                    <button
                      type="button"
                      id="forgot-password-link"
                      onClick={handleOpenForgotPassword}
                      className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium transition-colors hover:underline focus:outline-none cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                {/* Role Selection on Signup */}
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-1"
                  >
                    <span className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                      Account Role
                    </span>
                    <div
                      className="grid grid-cols-2 gap-3"
                      role="radiogroup"
                      aria-label="Account Role"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={role === 'student'}
                        onClick={() => setRole('student')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-medium cursor-pointer ${
                          role === 'student'
                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300'
                            : 'border-[var(--border)] bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:border-indigo-500/30'
                        }`}
                      >
                        <UserCheck className="w-4 h-4" aria-hidden="true" />
                        <span>Student</span>
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={role === 'admin'}
                        onClick={() => setRole('admin')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-medium cursor-pointer ${
                          role === 'admin'
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                            : 'border-[var(--border)] bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:border-indigo-500/30'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                        <span>Admin</span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Primary Action Button */}
                <button
                  type="submit"
                  id="auth-submit-btn"
                  disabled={loading}
                  className="w-full mt-5 py-2.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer active:scale-98"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Please wait...</span>
                    </>
                  ) : (
                    <>
                      <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                      <ArrowRight
                        className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>

                {/* SSO Integration beneath primary Sign In button */}
                {isLogin && (
                  <div className="pt-2">
                    <div className="relative flex items-center justify-center my-3">
                      <div className="border-t border-[var(--border)] w-full"></div>
                      <span className="bg-[var(--bg-card)] px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)] shrink-0">
                        Or continue with
                      </span>
                      <div className="border-t border-[var(--border)] w-full"></div>
                    </div>

                    <div className="space-y-2.5">
                      {/* Sign in with Google */}
                      <button
                        type="button"
                        id="sso-google-btn"
                        onClick={() => handleSSOClick('Google')}
                        className="w-full py-2.5 px-4 bg-[var(--bg-card-hover)] hover:bg-[var(--bg-card)] border border-[var(--border)] hover:border-indigo-500/30 text-[var(--text-primary)] text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer shadow-xs group active:scale-[0.99]"
                      >
                        <svg
                          className="w-4 h-4 shrink-0"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span className="text-[var(--text-primary)] transition-colors">
                          Sign in with Google
                        </span>
                      </button>

                      {/* Sign in with facebook */}
                      <button
                        type="button"
                        id="sso-facebook-btn"
                        onClick={() => handleSSOClick('facebook')}
                        className="w-full py-2.5 px-4 bg-[var(--bg-card-hover)] hover:bg-[var(--bg-card)] border border-[var(--border)] hover:border-indigo-500/30 text-[var(--text-primary)] text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer shadow-xs group active:scale-[0.99]"
                      >
                        <svg
                          className="w-4 h-4 shrink-0 text-[#1877F2] fill-current"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        <span className="text-[var(--text-primary)] transition-colors">
                          Sign in with facebook
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Footer info matching reference styling */}
        <div className="mt-7 text-center text-xs text-indigo-600/70 dark:text-indigo-400/60 font-medium">
          Role-Based Access Control • Multi-Tenant Data Isolation
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
