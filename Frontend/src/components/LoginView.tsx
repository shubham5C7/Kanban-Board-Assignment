import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  User as UserIcon,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Layers,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface Persona {
  name: string;
  email: string;
  role: string;
  branch: string;
}

const demoAccounts: Persona[] = [
  { name: 'Arjun Mehta', email: 'arjun@acme.com', role: 'Admin', branch: 'Acme New York' },
  { name: 'Meera Patel', email: 'meera@acme.com', role: 'Member', branch: 'Acme New York' },
  { name: 'Priya Sharma', email: 'priya@acme.com', role: 'Org Admin', branch: 'Global HQ' },
  { name: 'David Smith', email: 'david@acme.com', role: 'Admin', branch: 'Acme London' },
  { name: 'John Doe', email: 'john@globex.com', role: 'Org Admin', branch: 'Globex Tokyo' },
];

const carouselSlides = [
  {
    tag: 'REAL-TIME WORKFLOW',
    title: 'Collaborative Kanban with zero friction',
    description:
      'Manage tasks with low-latency WebSocket synchronization, fractional ordering, and instant presence tracking.',
    icon: Zap,
  },
  {
    tag: 'MULTI-TENANT ISOLATION',
    title: 'Enterprise boundary security',
    description:
      'Strict multi-organization and tenant data scoping with anti-enumeration 404 access controls.',
    icon: Layers,
  },
  {
    tag: 'CONFLICT-FREE SYNC',
    title: 'Optimistic concurrency control',
    description:
      'ETag-based OCC versioning with automated 3-way visual diffing and monotonic sequence replay.',
    icon: ShieldCheck,
  },
];

export const LoginView: React.FC = () => {
  const { login, register, isLoading } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('arjun@acme.com');
  const [password, setPassword] = useState('Password123!');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % carouselSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('resetToken');
    if (token) {
      setResetToken(token);
      setMode('reset');
      setNotice('Choose a new password for your account.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      if (mode === 'login') {
        await login(email, password, rememberMe);
      } else if (mode === 'register') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        await register(name, email, password);
      } else if (mode === 'forgot') {
        const result = await api.requestPasswordReset(email);
        if (result.resetToken) {
          setResetToken(result.resetToken);
          setMode('reset');
          setNotice('Development reset link ready. Choose a new password below.');
        } else {
          setNotice(result.message);
        }
      } else {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        await api.resetPassword({ token: resetToken, password });
        window.history.replaceState({}, document.title, window.location.pathname);
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setResetToken('');
        setNotice('Password updated. Sign in with your new password.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    }
  };

  const handlePersonaSelect = async (persona: Persona) => {
    setEmail(persona.email);
    setPassword('Password123!');
    setError(null);
    try {
      await login(persona.email, 'Password123!', rememberMe);
    } catch (err: any) {
      setError(err.message || `Demo account ${persona.email} is unavailable. Seed demo data first.`);
    }
  };

  return (
    <div className="h-dvh w-full relative overflow-hidden bg-slate-50 dark:bg-[#0B0F19] flex items-center justify-center p-3 sm:p-6 transition-colors">
      <div className="relative w-full h-full max-w-5xl flex items-center justify-center">
        {/* The Split-Screen Card */}
        <div className="relative w-full max-h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-xl shadow-slate-200/70 dark:shadow-black/40 overflow-hidden grid grid-cols-1 xl:grid-cols-2">
          {/* ========================================================
              LEFT ZONE: Functional, Distraction-Free Authentication Form
             ======================================================== */}
          <div className="p-4 sm:p-7 lg:p-9 flex flex-col justify-between gap-4 sm:gap-5">
            <div className="space-y-4 sm:space-y-6">
              {/* Brand Header */}
              <div className="flex items-center gap-3">
                <img
                  src="/logo.svg"
                  alt="CollabKanban Logo"
                  className="w-10 h-10 rounded-xl object-contain"
                />
                <div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    CollabKanban
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enterprise Workspace
                  </p>
                </div>
              </div>

              {/* Form Heading */}
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Choose a new password'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  {mode === 'login' ? 'Please enter your details to sign in.' : mode === 'register' ? 'Your workspace and main branch will be created automatically.' : mode === 'forgot' ? 'We’ll email a secure reset link if the account exists.' : 'Use a new password with at least 8 characters.'}
                </p>
              </div>

              {error && (
                <div className="p-3 text-xs bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 rounded-xl">
                  {error}
                </div>
              )}
              {notice && (
                <div role="status" className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-xl">
                  {notice}
                </div>
              )}

              {/* Authentication Form */}
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                {mode === 'register' && (
                  <div className="space-y-2">
                    <label htmlFor="register-name" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Full name</label>
                    <input id="register-name" type="text" value={name} onChange={event => setName(event.target.value)} required minLength={2} autoComplete="name" className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#5D8FFC]" />
                  </div>
                )}
                {/* Email Input with User Silhouette Inline Icon */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Email
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="name@company.com"
                      className="w-full pl-11 pr-4 py-3 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#5D8FFC] focus:ring-4 focus:ring-[#5D8FFC]/10 transition-all"
                    />
                  </div>
                </div>

                {/* Password Input with Key Icon and Eye Toggle */}
                {mode !== 'forgot' && <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    {mode === 'login' && <button type="button" onClick={() => { setMode('forgot'); setError(null); setNotice(null); }} className="text-[11px] font-medium text-[#5D8FFC] hover:underline">Forgot password?</button>}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={mode === 'register' || mode === 'reset' ? 8 : undefined}
                      autoComplete={mode === 'register' || mode === 'reset' ? 'new-password' : 'current-password'}
                      placeholder="••••••••••••"
                      className="w-full pl-11 pr-11 py-3 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#5D8FFC] focus:ring-4 focus:ring-[#5D8FFC]/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>}

                {(mode === 'register' || mode === 'reset') && (
                  <div className="space-y-2">
                    <label htmlFor="confirm-password" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Confirm password</label>
                    <input id="confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#5D8FFC]" />
                  </div>
                )}

                {/* Remember Me Checkbox */}
                {mode === 'login' && <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 text-[#5D8FFC] border-slate-300 dark:border-slate-700 rounded focus:ring-[#5D8FFC]"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer"
                  >
                    Remember me for 30 days
                  </label>
                </div>}

                {/* Primary CTA Button: LOGIN */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-[#4779ee] hover:bg-[#3868d8] disabled:opacity-60 text-white font-semibold text-sm rounded-xl shadow-lg shadow-[#5D8FFC]/25 hover:shadow-xl hover:shadow-[#5D8FFC]/30 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? 'SIGNING IN...' : mode === 'login' ? 'LOGIN' : mode === 'register' ? 'CREATE ACCOUNT' : mode === 'forgot' ? 'SEND RESET LINK' : 'UPDATE PASSWORD'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>

              {(mode === 'forgot' || mode === 'reset') && <p className="text-center text-sm text-slate-500"><button type="button" onClick={() => { setMode('login'); setError(null); setNotice(null); }} className="font-semibold text-[#4779ee] hover:underline">Back to sign in</button></p>}
              {mode === 'register' && <p className="text-center text-sm text-slate-500">Already registered? <button type="button" onClick={() => { setMode('login'); setError(null); }} className="font-semibold text-[#4779ee] hover:underline">Sign in</button></p>}

            </div>

            {/* Quick 1-Click Test Personas */}
            {mode === 'login' && <div className="hidden sm:block pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 flex items-center justify-between">
                <span>Demo accounts · one click sign in</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {demoAccounts.map(account => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => handlePersonaSelect(account)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      email === account.email
                        ? 'bg-blue-50/80 border-blue-400 text-blue-600 dark:bg-blue-950/60 dark:border-blue-500 dark:text-blue-300'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {account.name.split(' ')[0]} ({account.role})
                  </button>
                ))}
              </div>
            </div>}
          </div>

          {/* ========================================================
              RIGHT ZONE: Value-Driven Lifestyle / Branding Panel
             ======================================================== */}
          <div className="relative hidden xl:flex min-h-[600px] bg-slate-900 flex-col justify-between p-8 text-white overflow-hidden">
            {/* Sign-in illustration */}
            <div
              className="absolute inset-0 bg-[#e9edff] bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: 'url("/WhatsApp%20Image%202026-11-20%20at%207.18.51%20PM.jpeg")' }}
            />

            {/* Soft Contrast Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/15 to-transparent" />

            {/* Top Branding Pill */}
            

            {/* Bottom Value-Driven Carousel Content & Pagination Dots */}
            <div className="relative z-10 space-y-4">
              <div className="space-y-1.5 transition-all duration-500 min-h-[78px]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#5D8FFC]">
                    {carouselSlides[currentSlide].tag}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {carouselSlides[currentSlide].title}
                </h3>
                <p className="text-xs text-white/70 leading-relaxed max-w-sm">
                  {carouselSlides[currentSlide].description}
                </p>
              </div>

              {/* Carousel Pagination Indicators (Bottom Dots) */}
              <div className="flex items-center gap-2 pt-2">
                {carouselSlides.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCurrentSlide(index)}
                    title={`View slide ${index + 1}`}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentSlide
                        ? 'w-7 bg-[#5D8FFC]'
                        : 'w-2 bg-white/40 hover:bg-white/70'
                    }`}
                    aria-label={`Slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
