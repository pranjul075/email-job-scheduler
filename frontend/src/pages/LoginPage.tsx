import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = api.getGoogleAuthUrl();
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fa] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-sm border border-gray-100 p-10 flex flex-col items-center">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00a854] to-[#05c464] flex items-center justify-center shadow-md shadow-emerald-500/15 text-white shrink-0">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="15" x="2" y="4" rx="2.5" />
              <path d="m22 6.5-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 6.5" />
            </svg>
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center text-xl font-bold tracking-tight text-gray-900 leading-none">
              <span>Reach</span>
              <span className="text-[#00a854]">Inbox</span>
            </div>
            <span className="text-[10px] font-semibold text-gray-400 tracking-wider uppercase mt-1">
              Job Scheduler
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-[#111827] mb-6 tracking-tight">
          {isRegister ? 'Create an account' : 'Welcome back'}
        </h1>

        {error && (
          <div className="w-full mb-6 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-600 text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#e6f4ea] hover:bg-[#d8edd9] text-gray-800 text-sm font-medium transition-colors mb-6 shadow-none"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.28 21.43 7.34 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.13z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.28 2.57 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
            />
          </svg>
          <span>Login with Google</span>
        </button>

        <div className="w-full flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-normal">
            or sign up through email
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {isRegister && (
            <div>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[#f4f5f7] border-0 rounded-xl px-4 py-3 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#00a854]"
              />
            </div>
          )}

          <div>
            <input
              type="email"
              placeholder="Email ID"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#f4f5f7] border-0 rounded-xl px-4 py-3 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#00a854]"
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#f4f5f7] border-0 rounded-xl px-4 py-3 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#00a854]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-[#00a854] hover:bg-[#008f47] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            type="button"
            className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            {isRegister
              ? 'Already have an account? Sign In'
              : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};
