import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BrainCircuit, 
  Sparkles, 
  ShieldCheck, 
  Activity, 
  Moon, 
  Smartphone, 
  ArrowRight, 
  CheckCircle2, 
  LineChart, 
  Lock, 
  MessageSquareText, 
  Compass
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, demoLogin } = useAuth();

  const handleDemo = async () => {
    try {
      await demoLogin();
      navigate('/dashboard');
    } catch (e) {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-900 bg-clip-text text-transparent">
              Know Thyself AI
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              Personal Intelligence System
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
                title="Sign in with another account"
              >
                Sign In
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleDemo}
                className="px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 transition-all"
              >
                1-Click Demo
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="hidden sm:inline-flex px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 transition-all"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/60 text-xs font-bold text-indigo-700 mb-6 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Transforming Raw Personal Data into Actionable Intelligence</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1] max-w-4xl mx-auto mb-6">
          Your Data.{' '}
          <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-500 bg-clip-text text-transparent">
            Your Intelligence.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-8 font-normal leading-relaxed">
          People generate huge amounts of lifestyle data across phones and wearables, yet struggle to understand their own habits. 
          <strong className="text-slate-900 font-semibold"> Know Thyself AI</strong> unifies your daily activity, sleep, screen time, and routines to uncover behavioural patterns and recommend achievable wellness habits.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto mb-16">
          <button
            onClick={() => navigate(user ? '/dashboard' : '/register')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2 transition-all hover:scale-102"
          >
            <span>Start Free Journey</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleDemo}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-indigo-900 font-bold text-sm border border-slate-200 shadow-sm flex items-center justify-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Launch Interactive Demo</span>
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-5xl mx-auto pt-6">
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-card hover:border-indigo-200 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <LineChart className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-2">Personal Intelligence Score</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Transparent 0–100 awareness score breaking down physical movement, sleep regularity, exercise frequency, and screen balance with full mathematical clarity.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-card hover:border-purple-200 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <MessageSquareText className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-2">Ask Your Data (Gemini AI)</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Signature conversational AI strictly grounded in your authenticated lifestyle metrics. Ask: "How did my sleep change this week?" and receive accurate answers.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-card hover:border-teal-200 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-2">Privacy & Full Ownership</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your data belongs to you. Strict per-user isolation, optional AI processing consent, instant 1-click JSON data export, and permanent data deletion controls.
            </p>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="bg-slate-100/70 py-16 border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">The Architecture</h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">How Know Thyself AI Works</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80">
              <div className="text-xs font-extrabold text-indigo-600 mb-1">01 / COLLECT</div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Daily Lifestyle Logging</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Log daily steps, sleep, screen time, exercise, water, and mood via manual input, CSV batch upload, or sample data.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80">
              <div className="text-xs font-extrabold text-purple-600 mb-1">02 / ANALYZE</div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Python Analytics Engine</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Calculates daily/weekly averages, variances, circadian regularity, standard deviations, and percentage trends.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80">
              <div className="text-xs font-extrabold text-teal-600 mb-1">03 / SYNTHESIZE</div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Gemini Behavioral Engine</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Generates structured insights with observation, supporting evidence, and non-medical practical recommendations.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80">
              <div className="text-xs font-extrabold text-coral-600 mb-1">04 / EMPOWER</div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Smart Nudges & Action</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Contextual, positive suggestions delivered at the right moment so small daily habits turn into lasting vitality.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-indigo-600" />
          <span className="font-bold text-slate-700">Know Thyself AI</span> — Your Data. Your Intelligence.
        </div>
        <div className="flex items-center gap-6">
          <span>PostgreSQL & SQLite Supported</span>
          <span>FastAPI + React Vite</span>
          <span>Google Gemini API</span>
        </div>
      </footer>
    </div>
  );
}
