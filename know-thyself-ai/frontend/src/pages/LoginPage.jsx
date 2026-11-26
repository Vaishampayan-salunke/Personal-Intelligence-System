import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrainCircuit, Mail, Lock, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import BackendServerConfig from '../components/BackendServerConfig';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const { login, demoLogin } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      await login(email, password);
      success('Welcome back to Know Thyself AI!');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid email or password credentials.';
      setErrorMsg(msg);
      error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await demoLogin();
      success('Logged in as Alex Morgan (Demo Account) with 30 days of synthetic data!');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load demo account.';
      setErrorMsg(msg);
      error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <Link to="/" className="inline-flex items-center gap-2 mb-4 group">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <BrainCircuit className="w-6 h-6" />
          </div>
        </Link>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Sign in to Know Thyself AI
        </h2>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Access your personal analytics, Gemini insights, and goals
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl shadow-card border border-slate-200/80">
          {/* 1-Click Demo Login Banner */}
          <div className="mb-6 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/70 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Hackathon Evaluation Demo
              </div>
              <div className="text-[11px] text-indigo-700/80">Pre-populated with 30 days of data</div>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-500/25 transition-all flex-shrink-0"
            >
              1-Click Demo
            </button>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Don't have an account yet?{' '}
              <Link to="/register" className="font-bold text-indigo-600 hover:text-indigo-800">
                Create Account
              </Link>
            </p>
          </div>
        </div>

        <BackendServerConfig />
      </div>
    </div>
  );
}
