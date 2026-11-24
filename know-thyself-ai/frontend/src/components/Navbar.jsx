import React, { useState } from 'react';
import { Menu, Bell, Sparkles, User, Shield, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ setMobileOpen }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
      {/* Left side: mobile menu button & date */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl lg:hidden transition-colors"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {formattedDate}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
            <CheckCircle className="w-3.5 h-3.5" />
            System Live & Synchronized
          </span>
        </div>
      </div>

      {/* Right side: quick actions & profile avatar */}
      <div className="flex items-center gap-3">
        {/* Ask AI shortcut */}
        <button
          onClick={() => navigate('/chat')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border border-indigo-200/70 text-xs font-semibold shadow-xs transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Ask Your Data</span>
        </button>

        {/* Notifications toggle */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors relative"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-white"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Lifestyle Alerts
                </span>
                <span className="text-[11px] font-semibold text-indigo-600">Active</span>
              </div>
              <div className="py-3 space-y-2.5">
                <div className="text-xs text-slate-600 p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100/60">
                  <div className="font-semibold text-indigo-900 mb-0.5">Gemini Behavioral Engine</div>
                  <div>Your 7-day pattern analysis is ready with personalized habit recommendations.</div>
                </div>
                <div className="text-xs text-slate-600 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="font-semibold text-slate-800 mb-0.5">Hydration & Movement Check</div>
                  <div>Take 10 minutes away from screens to maintain your optimal energy curve.</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowNotifications(false);
                  navigate('/dashboard');
                }}
                className="w-full text-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 pt-2"
              >
                View all nudges on Dashboard →
              </button>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div
          onClick={() => navigate('/settings')}
          className="cursor-pointer flex items-center gap-2 p-1 pl-2 rounded-xl hover:bg-slate-100 transition-colors"
          title="Account settings"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <span className="hidden md:inline text-xs font-semibold text-slate-700">
            {user?.name ? user.name.split(' ')[0] : 'Account'}
          </span>
        </div>
      </div>
    </header>
  );
}
