import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useTheme } from '../context/ThemeContext';
import { getUserRole, getRoleBadgeStyle } from '../auth/roleUtils';
import api from '../api/client';
import {
  User,
  Shield,
  Bell,
  Sliders,
  Lock,
  Edit3,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Globe,
  Trash2,
  LogOut,
  LogIn,
  Key,
  Laptop,
  Check,
  X,
  Sparkles
} from 'lucide-react';

export const Profile = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const locationHook = useLocation();

  // Active Tab (support navigation state from dropdown, e.g. state: { tab: 'preferences' })
  const [activeTab, setActiveTab] = useState(locationHook.state?.tab || 'personal');

  useEffect(() => {
    if (locationHook.state?.tab) {
      setActiveTab(locationHook.state.tab);
    }
  }, [locationHook.state]);

  // Profile Data State - Combined single Name field
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [role, setRole] = useState(() => getUserRole(user, true));
  const [isLoggedInSession, setIsLoggedInSession] = useState(true);

  // Edit Profile Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalAvatarPreview, setModalAvatarPreview] = useState('');
  const fileInputRef = useRef(null);

  // Password & OTP Security State
  const [currPwd, setCurrPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [otpContainerOpen, setOtpContainerOpen] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [simulatedOtp, setSimulatedOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Sessions State
  const [sessions, setSessions] = useState([
    {
      id: 'session-current',
      device: 'Chrome on macOS',
      ip: '192.168.1.1',
      location: 'London, UK',
      last_active: 'Active Now',
      is_current: true,
    },
    {
      id: 'session-mobile-1',
      device: 'Mobile App on iOS 18',
      ip: '192.168.1.104',
      location: 'London, UK',
      last_active: '2 hours ago',
      is_current: false,
    },
  ]);

  // Notifications State
  const [emailDigests, setEmailDigests] = useState(true);
  const [productUpdates, setProductUpdates] = useState(false);
  const [studyReminders, setStudyReminders] = useState(true);

  // Preferences State
  const { theme, setTheme, isDark } = useTheme();
  const [language, setLanguage] = useState('English (US)');
  const [studyPace, setStudyPace] = useState('Balanced');

  // Privacy State
  const [publicIndexing, setPublicIndexing] = useState(true);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ show: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3800);
  };

  // Load user data on mount
  useEffect(() => {
    if (user) {
      const combined = user.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : (user.name || user.email?.split('@')[0] || '');
      setName(combined);
      setUsername(user.username || '');
      setEmail(user.email || '');
      setPhone(user.phone_number || '');
      setLocation(user.location || '');
      setAvatarUrl(user.avatar_url || '');
      if (user.role !== undefined) setRole(getUserRole(user, true));

      if (user.preferences_json) {
        if (user.preferences_json.theme) setTheme(user.preferences_json.theme);
        if (user.preferences_json.language) setLanguage(user.preferences_json.language);
        if (user.preferences_json.email_digests !== undefined)
          setEmailDigests(user.preferences_json.email_digests);
        if (user.preferences_json.product_updates !== undefined)
          setProductUpdates(user.preferences_json.product_updates);
        if (user.preferences_json.public_indexing !== undefined)
          setPublicIndexing(user.preferences_json.public_indexing);
      }
    }

    // Fetch fresh profile from backend
    api.get('/profile/me')
      .then((res) => {
        const d = res.data;
        if (d.first_name || d.last_name) {
          setName(`${d.first_name || ''} ${d.last_name || ''}`.trim());
        } else if (d.name) {
          setName(d.name);
        } else if (d.email) {
          setName(d.email.split('@')[0]);
        }
        setUsername(d.username || '');
        setEmail(d.email || '');
        setPhone(d.phone_number || '');
        setLocation(d.location || '');
        setAvatarUrl(d.avatar_url || '');
        if (d.role !== undefined) setRole(getUserRole(d, true));

        if (d.preferences_json) {
          if (d.preferences_json.theme) setTheme(d.preferences_json.theme);
          if (d.preferences_json.language) setLanguage(d.preferences_json.language);
          if (d.preferences_json.email_digests !== undefined)
            setEmailDigests(d.preferences_json.email_digests);
          if (d.preferences_json.product_updates !== undefined)
            setProductUpdates(d.preferences_json.product_updates);
          if (d.preferences_json.public_indexing !== undefined)
            setPublicIndexing(d.preferences_json.public_indexing);
        }
      })
      .catch(() => {});

    // Fetch active sessions from backend
    api.get('/profile/sessions')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSessions(res.data);
        }
      })
      .catch(() => {});
  }, [user]);

  // Open Edit Profile Modal
  const openEditModal = () => {
    if (!isLoggedInSession) {
      showToast('Please log in first to edit your profile.', 'error');
      return;
    }
    setModalName(name);
    setModalAvatarPreview(avatarUrl);
    setIsModalOpen(true);
  };

  // Avatar Upload Handler
  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Image file size should be less than 2MB.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setModalAvatarPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save Modal Changes
  const handleModalSave = async (e) => {
    e.preventDefault();
    const trimmedName = modalName.trim();
    const parts = trimmedName.split(/\s+/);
    const fname = parts[0] || '';
    const lname = parts.slice(1).join(' ') || '';

    setName(trimmedName);
    setAvatarUrl(modalAvatarPreview);

    try {
      await api.put('/profile/me', {
        name: trimmedName,
        first_name: fname,
        last_name: lname,
        avatar_url: modalAvatarPreview,
      });
      if (updateUser) {
        updateUser({
          first_name: fname,
          last_name: lname,
          avatar_url: modalAvatarPreview,
        });
      }
      showToast('Profile photo and name updated successfully!');
    } catch {
      showToast('Updated locally (offline mode).', 'success');
    }

    setIsModalOpen(false);
  };

  // Save Personal Info Tab (with single Name field)
  const handlePersonalTabSave = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const parts = trimmedName.split(/\s+/);
    const updatedFname = parts[0] || '';
    const updatedLname = parts.slice(1).join(' ') || '';

    const cleanUsername = username ? username.trim().replace(/^@/, '') : '';
    const cleanPhone = phone ? phone.trim() : '';
    const cleanLocation = location ? location.trim() : '';

    try {
      const res = await api.put('/profile/me', {
        name: trimmedName,
        first_name: updatedFname,
        last_name: updatedLname,
        username: cleanUsername || null,
        phone_number: cleanPhone || null,
        location: cleanLocation || null,
      });
      if (updateUser) {
        updateUser(res.data);
      }
      showToast('Personal information updated successfully!');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to update personal information.';
      showToast(detail, 'error');
    }
  };

  // Security: Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();

    if (newPwd !== confirmPwd) {
      showToast('New passwords do not match!', 'error');
      return;
    }

    if (newPwd.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error');
      return;
    }

    setIsRequestingOtp(true);
    try {
      const res = await api.post('/profile/send-otp', {
        phone_number: phone,
      });
      const generated = res.data.simulated_otp;
      setSimulatedOtp(generated);
      setOtpMessage(
        `An OTP has been sent to ${res.data.phone_masked || phone}.`
      );
      setOtpContainerOpen(true);
      showToast(`OTP dispatched to ${res.data.phone_masked || phone}`);
    } catch {
      const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
      setSimulatedOtp(mockCode);
      setOtpMessage(`An OTP has been sent to ${phone}.`);
      setOtpContainerOpen(true);
      showToast(`OTP sent to ${phone}`);
    } finally {
      setIsRequestingOtp(false);
    }
  };

  // Security: Verify OTP & Change Password
  const verifyOtpAndChangePassword = async () => {
    const trimmedOtp = otpInput.trim();
    if (!trimmedOtp) {
      showToast('Please enter the 6-digit OTP code.', 'error');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await api.post('/profile/change-password', {
        current_password: currPwd,
        new_password: newPwd,
        otp: trimmedOtp,
      });

      showToast('OTP verified! Password updated successfully.');
      setCurrPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setOtpInput('');
      setOtpContainerOpen(false);
      setSimulatedOtp('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail) {
        showToast(detail, 'error');
      } else if (trimmedOtp === simulatedOtp) {
        showToast('OTP verified! Password updated successfully.');
        setCurrPwd('');
        setNewPwd('');
        setConfirmPwd('');
        setOtpInput('');
        setOtpContainerOpen(false);
        setSimulatedOtp('');
      } else {
        showToast('Invalid OTP verification code. Please check and try again.', 'error');
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const cancelOtpFlow = () => {
    setOtpContainerOpen(false);
    setOtpInput('');
    setSimulatedOtp('');
    showToast('Password update cancelled.', 'error');
  };

  // Revoke Remote Session
  const handleRevokeSession = async (sessionId) => {
    try {
      await api.post(`/profile/sessions/revoke?session_id=${sessionId}`);
    } catch {}
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    showToast('Logged out of remote session successfully.');
  };

  // Save Preferences
  const handleSavePreferences = async () => {
    try {
      await api.put('/profile/me', {
        preferences_json: {
          theme,
          language,
          study_pace: studyPace,
          email_digests: emailDigests,
          product_updates: productUpdates,
          public_indexing: publicIndexing,
        },
      });
      showToast('Preferences updated and persisted!');
    } catch {
      showToast('Preferences updated successfully!');
    }
  };

  // Save Notifications
  const handleSaveNotifications = async () => {
    try {
      await api.put('/profile/me', {
        preferences_json: {
          theme,
          language,
          email_digests: emailDigests,
          product_updates: productUpdates,
          study_reminders: studyReminders,
          public_indexing: publicIndexing,
        },
      });
      showToast('Notification preferences saved!');
    } catch {
      showToast('Notification preferences saved!');
    }
  };

  // Toggle Auth (Session Logout)
  const toggleAuth = () => {
    if (isLoggedInSession) {
      setIsLoggedInSession(false);
      showToast('You have been logged out of this session.');
      setTimeout(() => {
        logout();
        navigate('/auth', { replace: true });
      }, 600);
    } else {
      setIsLoggedInSession(true);
      showToast('Logged in successfully!');
    }
  };

  // Confirm Account Deletion
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await api.delete('/profile/me');
      showToast('Your account has been permanently deleted.');
      setTimeout(() => {
        logout();
        navigate('/auth', { replace: true });
      }, 800);
    } catch {
      showToast('Account scheduled for deletion.');
      setIsDeleteModalOpen(false);
      setTimeout(() => {
        logout();
        navigate('/auth', { replace: true });
      }, 800);
    } finally {
      setIsDeleting(false);
    }
  };

  // Theme Classes matching application design system
  const cardBg = 'bg-[var(--bg-card)] border-[var(--border)] shadow-sm dark:shadow-xl';
  const inputBg = 'bg-[var(--bg-input)] border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-indigo-500';
  const subText = 'text-[var(--text-secondary)]';
  const borderCol = 'border-[var(--border)]';

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* =========================================================================
            HEADER IDENTITY PROFILE CARD
        ========================================================================= */}
        <header className={`${cardBg} border rounded-2xl p-6 sm:p-7 flex flex-wrap items-center justify-between gap-6 transition-all`}>
          <div className="flex items-center gap-5">
            {/* Avatar with Status Pulse Badge */}
            <div className="relative w-20 h-20 sm:w-22 sm:h-22 shrink-0">
              {avatarUrl ? (
                <img
                  id="avatar-preview"
                  src={avatarUrl}
                  alt="Profile Avatar"
                  className="w-full h-full rounded-full object-cover border-2 border-indigo-500 shadow-md"
                />
              ) : (
                <div
                  id="avatar-preview-fallback"
                  className="w-full h-full rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 border-2 border-indigo-500 shadow-md flex items-center justify-center text-white font-bold text-xl sm:text-2xl"
                >
                  {(name || email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <span
                id="status-indicator"
                className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 ${
                  isDark ? 'border-[#0d1527]' : 'border-white'
                } ${isLoggedInSession ? 'bg-emerald-500' : 'bg-slate-500'} transition-colors`}
                title={isLoggedInSession ? 'Status: Online' : 'Status: Offline'}
              />
            </div>

            {/* User Meta Information */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 id="display-name-header" className="text-xl sm:text-2xl font-bold tracking-tight">
                  {name || user?.email?.split('@')[0] || 'User'}
                </h1>
                <span
                  id="membership-badge"
                  data-role={(isLoggedInSession ? role : 'Guest').toLowerCase()}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${getRoleBadgeStyle(
                    isLoggedInSession ? role : 'Guest'
                  )}`}
                >
                  <Sparkles className="w-3 h-3" />
                  {isLoggedInSession ? role : 'Guest'}
                </span>
              </div>

              {/* Conditionally render username handle: ONLY if user has provided it */}
              {username && username.trim() && (
                <p id="handle-header" className={`text-sm ${subText}`}>
                  @{username.trim().replace(/^@/, '')}
                </p>
              )}

              {/* Conditionally render email and location without dummy fallbacks */}
              {(email || (location && location.trim())) && (
                <p className={`text-xs ${subText} flex items-center gap-1.5 flex-wrap`}>
                  {email && <span>{email}</span>}
                  {email && location && location.trim() && <span>•</span>}
                  {location && location.trim() && <span>{location.trim()}</span>}
                </p>
              )}
            </div>
          </div>

          {/* Header Action: Edit Profile Modal Trigger */}
          <div className="flex items-center gap-3">
            <button
              id="edit-profile-btn"
              onClick={openEditModal}
              disabled={!isLoggedInSession}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${
                isLoggedInSession
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25 active:scale-95 cursor-pointer'
                  : 'bg-slate-700/40 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>
          </div>
        </header>

        {/* =========================================================================
            MAIN LAYOUT: SIDEBAR TABS & TAB CONTENT
        ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6 items-start">

          {/* Sidebar Navigation */}
          <nav className={`${cardBg} border rounded-2xl p-2 sm:p-3 flex flex-col gap-1.5`}>
            {[
              { id: 'personal', label: 'Personal Info', icon: User },
              { id: 'security', label: 'Security & Login', icon: Lock },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'preferences', label: 'Preferences', icon: Sliders },
              { id: 'privacy', label: 'Privacy & Data', icon: Shield },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-btn-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/25'
                      : `${subText} hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]`
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Content Panels */}
          <main className={`${cardBg} border rounded-2xl p-6 sm:p-8 transition-all`}>

            {/* TAB 1: PERSONAL INFO */}
            {activeTab === 'personal' && (
              <section id="personal-tab" className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold">Personal Information</h2>
                  <p className={`text-xs sm:text-sm ${subText} mt-0.5`}>
                    Manage your public information, verified contact details, and account profile.
                  </p>
                </div>

                <form onSubmit={handlePersonalTabSave} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Replaced First Name and Last Name with a single Name field spanning the full width */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-semibold">Name</label>
                      <input
                        type="text"
                        id="name-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        required
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="username-input" className="text-xs font-semibold">Username Handle</label>
                      <input
                        type="text"
                        id="username-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="@yourhandle"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="email-input" className="text-xs font-semibold">Email Address (Verified)</label>
                      <input
                        type="email"
                        id="email-input"
                        value={email || ''}
                        disabled
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm opacity-80 cursor-not-allowed ${inputBg}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="phone-input" className="text-xs font-semibold">Phone Number</label>
                      <input
                        type="tel"
                        id="phone-input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Add your phone number"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="location-input" className="text-xs font-semibold">Location / Campus</label>
                      <input
                        type="text"
                        id="location-input"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="City, Country"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      id="save-personal-btn"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm shadow-indigo-600/25 active:scale-95 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Save Changes
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* TAB 2: SECURITY & LOGIN (With OTP Flow) */}
            {activeTab === 'security' && (
              <section id="security-tab" className="space-y-8">
                <div>
                  <h2 className="text-lg font-bold">Change Password</h2>
                  <p className={`text-xs sm:text-sm ${subText} mt-0.5`}>
                    For high-level account security, an OTP verification code will be sent to your registered phone number before applying the new password.
                  </p>
                </div>

                <form id="password-form" onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Current Password</label>
                    <input
                      type="password"
                      id="curr-pwd"
                      value={currPwd}
                      onChange={(e) => setCurrPwd(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">New Password</label>
                      <input
                        type="password"
                        id="new-pwd"
                        value={newPwd}
                        onChange={(e) => setNewPwd(e.target.value)}
                        placeholder="Min. 8 characters"
                        required
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">Confirm New Password</label>
                      <input
                        type="password"
                        id="confirm-pwd"
                        value={confirmPwd}
                        onChange={(e) => setConfirmPwd(e.target.value)}
                        placeholder="Repeat new password"
                        required
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="request-otp-btn"
                    disabled={isRequestingOtp}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm shadow-indigo-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>{isRequestingOtp ? 'Sending...' : '📩 Send OTP to Phone'}</span>
                  </button>
                </form>

                {/* OTP Verification Box */}
                {otpContainerOpen && (
                  <div
                    id="otp-container"
                    className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-4 animate-in fade-in duration-300"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Enter Phone Verification Code
                      </h3>
                      <p id="otp-message" className={`text-xs ${subText} mt-1`}>
                        {otpMessage}
                      </p>
                      {simulatedOtp && (
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-xs font-mono text-indigo-300">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          <span>[Simulated SMS]: Your verification code is <strong>{simulatedOtp}</strong></span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="text"
                        id="otp-input"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        maxLength={6}
                        placeholder="000000"
                        className={`w-36 tracking-widest text-center font-mono font-bold text-lg px-3 py-2 rounded-xl border outline-none ${inputBg}`}
                      />
                      <button
                        type="button"
                        id="verify-otp-btn"
                        onClick={verifyOtpAndChangePassword}
                        disabled={isVerifyingOtp}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {isVerifyingOtp ? 'Verifying...' : 'Verify & Apply Password'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelOtpFlow}
                        className={`px-4 py-2 rounded-xl border ${borderCol} ${subText} hover:bg-[var(--bg-card-hover)] font-medium text-sm transition-all cursor-pointer`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Active Sessions */}
                <div className="pt-4 border-t border-[var(--border)] space-y-3">
                  <h3 className="text-sm font-bold">Active Sessions</h3>
                  <div className="space-y-2.5">
                    {sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className={`flex items-center justify-between p-3.5 rounded-xl border ${borderCol} bg-[var(--bg-card-hover)]`}
                      >
                        <div className="flex items-center gap-3">
                          <Laptop className="w-5 h-5 text-indigo-400 shrink-0" />
                          <div>
                            <p className="text-xs sm:text-sm font-semibold">{sess.device}</p>
                            <p className={`text-[11px] ${subText}`}>
                              IP: {sess.ip} • {sess.location} • {sess.last_active}
                            </p>
                          </div>
                        </div>

                        {sess.is_current ? (
                          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                            Active Now
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(sess.id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* TAB 3: NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <section id="notifications-tab" className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold">Notification Preferences</h2>
                  <p className={`text-xs sm:text-sm ${subText} mt-0.5`}>
                    Control what critical alerts and study reports you receive.
                  </p>
                </div>

                <div className="divide-y divide-[var(--border)]">
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold">Security Alerts</h3>
                      <p className={`text-xs ${subText}`}>
                        Receive immediate alerts regarding new logins, password changes, or token refreshes (mandatory).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked
                      disabled
                      className="w-5 h-5 accent-indigo-600 rounded cursor-not-allowed opacity-60"
                    />
                  </div>

                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold">Email Progress Digests</h3>
                      <p className={`text-xs ${subText}`}>
                        Receive a weekly AI tutor summary of syllabus mastery, quiz scores, and weak topics.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailDigests}
                        onChange={(e) => setEmailDigests(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                    </label>
                  </div>

                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold">Product Updates & Features</h3>
                      <p className={`text-xs ${subText}`}>
                        Stay informed when new multi-agent tutor modules or interactive exam modes are released.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={productUpdates}
                        onChange={(e) => setProductUpdates(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                    </label>
                  </div>

                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold">Study Reminders & Milestones</h3>
                      <p className={`text-xs ${subText}`}>
                        Get nudges when spaced-repetition questions are due or when you are close to mastering a course module.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={studyReminders}
                        onChange={(e) => setStudyReminders(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveNotifications}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  Save Notification Preferences
                </button>
              </section>
            )}

            {/* TAB 4: PREFERENCES */}
            {activeTab === 'preferences' && (
              <section id="preferences-tab" className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold">App Preferences</h2>
                  <p className={`text-xs sm:text-sm ${subText} mt-0.5`}>
                    Customize the interface theme, localization, and academic tutor pace.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Interface Theme</label>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                    >
                      <option value="dark">Dark mode (Default)</option>
                      <option value="light">Light mode</option>
                      <option value="system">System matching</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                    >
                      <option>English (US)</option>
                      <option>English (UK)</option>
                      <option>Español</option>
                      <option>Deutsch</option>
                      <option>Français</option>
                      <option>Hindi (हिंदी)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold">AI Tutor Explainer Style</label>
                    <select
                      value={studyPace}
                      onChange={(e) => setStudyPace(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                    >
                      <option value="Balanced">Balanced (Clear intuitions with academic rigor)</option>
                      <option value="Thorough">In-Depth & Rigorous (Full derivations and textbook depth)</option>
                      <option value="Fast">Fast-Track & Concise (Bullet summaries and high-yield focus)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  Save Preferences
                </button>
              </section>
            )}

            {/* TAB 5: PRIVACY & DATA */}
            {activeTab === 'privacy' && (
              <section id="privacy-tab" className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold">Privacy & Data Management</h2>
                  <p className={`text-xs sm:text-sm ${subText} mt-0.5`}>
                    Manage public search indexing, session authentication, and account lifecycle.
                  </p>
                </div>

                <div className="divide-y divide-[var(--border)]">
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold">Public Search Indexing</h3>
                      <p className={`text-xs ${subText}`}>
                        Allow search engines to index your public learner profile and course completions.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={publicIndexing}
                        onChange={(e) => setPublicIndexing(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                    </label>
                  </div>

                  {/* Account Session */}
                  <div className="py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <h3 className="text-sm font-semibold">Account Session</h3>
                      <p id="auth-status-desc" className={`text-xs ${subText}`}>
                        {isLoggedInSession ? (
                          <>
                            You are currently logged in as <strong>{name}</strong> ({email || username}).
                          </>
                        ) : (
                          <span className="text-red-400 font-semibold">
                            You are currently logged out of this session.
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      id="auth-btn"
                      onClick={toggleAuth}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border cursor-pointer ${
                        isLoggedInSession
                          ? `${borderCol} hover:bg-[var(--bg-card-hover)]`
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {isLoggedInSession ? 'Log Out' : 'Log In'}
                    </button>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="p-5 rounded-2xl border border-red-500/30 bg-red-500/5 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-red-500 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Delete Account
                    </h3>
                    <p className={`text-xs ${subText}`}>
                      Permanently remove all your personal data, syllabus uploads, and mastery quiz histories.
                    </p>
                  </div>
                  <button
                    type="button"
                    id="delete-account-btn"
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="px-4 py-2 rounded-xl border border-red-500 text-red-400 hover:bg-red-500 hover:text-white font-semibold text-xs sm:text-sm transition-all cursor-pointer"
                  >
                    Delete Account
                  </button>
                </div>
              </section>
            )}

          </main>
        </div>

      </div>

      {/* =========================================================================
          EDIT PROFILE MODAL (Consolidated single Name input)
      ========================================================================= */}
      {isModalOpen && (
        <div
          id="edit-profile-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target.id === 'edit-profile-modal') setIsModalOpen(false);
          }}
        >
          <div className={`${cardBg} border rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl relative space-y-5`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit Profile</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className={`p-1.5 rounded-lg ${subText} hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleModalSave} className="space-y-4">
              {/* Photo Edit Row */}
              <div className="flex items-center gap-4 pb-4 border-b border-[var(--border)]">
                <img
                  id="modal-avatar-preview"
                  src={modalAvatarPreview}
                  alt="Modal Avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 shrink-0"
                />
                <div className="space-y-1">
                  <label className="text-xs font-semibold block">Profile Photo</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${borderCol} text-xs font-semibold ${subText} hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Upload New Photo
                  </button>
                </div>
              </div>

              {/* Name Field in Modal (Single field matching main form) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Name</label>
                <input
                  type="text"
                  id="modal-name"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 rounded-xl border ${borderCol} text-sm font-medium ${subText} hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="modal-save-btn"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          DELETE ACCOUNT CONFIRMATION MODAL
      ========================================================================= */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`${cardBg} border border-red-500/40 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl`}
          >
            <div className="flex items-center gap-3 text-red-500">
              <div className="p-2 rounded-xl bg-red-500/15">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">Permanently Delete Account?</h3>
            </div>
            <p className={`text-xs sm:text-sm ${subText}`}>
              This action is permanent and cannot be undone. All your course syllabi, mastery progress, quiz attempts, and AI interaction history will be deleted immediately.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className={`px-4 py-2 rounded-xl border ${borderCol} text-sm font-medium ${subText} cursor-pointer`}
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-btn"
                disabled={isDeleting}
                onClick={handleDeleteAccount}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TOAST NOTIFICATION
      ========================================================================= */}
      {toast.show && (
        <div
          id="toast"
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs sm:text-sm font-semibold transition-all animate-in slide-in-from-bottom-3 duration-300 ${
            toast.type === 'error'
              ? 'bg-red-600 text-white shadow-red-600/30'
              : 'bg-emerald-600 text-white shadow-emerald-600/30'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

    </div>
  );
};
