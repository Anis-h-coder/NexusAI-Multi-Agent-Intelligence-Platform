import React, { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { signIn, signUp, SessionInfo } from '../utils/auth';

interface AuthScreenProps {
  onAuthenticated: (session: SessionInfo) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result =
      mode === 'login' ? await signIn(email, password) : await signUp(email, password, displayName);
    setBusy(false);
    if (result.session) {
      setPassword('');
      onAuthenticated(result.session);
    } else {
      setError(result.error || 'Something went wrong');
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 font-sans text-slate-800">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20">
            <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-emerald-600 rounded-full" />
            </div>
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            Nexus<span className="text-emerald-500">AI</span>
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <h1 className="text-lg font-bold text-slate-900">
            {mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Your projects, files and results are private to your account.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Name
                </label>
                <input
                  id="auth-name"
                  className={inputClass}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  maxLength={80}
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-600 mb-1.5">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                maxLength={254}
                required
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-600 mb-1.5">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                maxLength={128}
                required
                placeholder={mode === 'login' ? 'Your password' : 'At least 10 characters'}
              />
            </div>

            {error && (
              <div role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !email || !password}
              className="w-full px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-emerald-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-slate-500">
            {mode === 'login' ? (
              <>
                New here?{' '}
                <button type="button" className="font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer" onClick={() => { setMode('register'); setError(null); }}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already registered?{' '}
                <button type="button" className="font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer" onClick={() => { setMode('login'); setError(null); }}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
