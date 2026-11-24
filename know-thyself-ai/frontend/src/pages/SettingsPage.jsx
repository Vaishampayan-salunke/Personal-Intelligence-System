import React, { useState } from 'react';
import { 
  Settings, 
  ShieldCheck, 
  Download, 
  Trash2, 
  LogOut, 
  User, 
  Bell, 
  Sparkles, 
  AlertTriangle,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { privacyService, authService } from '../services/api';

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const { success, error, info } = useToast();

  const [aiConsent, setAiConsent] = useState(user?.preferences?.ai_consent ?? true);
  const [savingConsent, setSavingConsent] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingData, setDeletingData] = useState(false);

  const handleToggleConsent = async () => {
    const nextConsent = !aiConsent;
    setSavingConsent(true);
    try {
      await privacyService.updateConsent(nextConsent);
      setAiConsent(nextConsent);
      updateUser({ preferences: { ...user.preferences, ai_consent: nextConsent } });
      success(nextConsent ? 'AI Processing Consent enabled.' : 'AI Processing Consent disabled. Analytics will run via local deterministic rules.');
    } catch (err) {
      error('Failed to update consent preference.');
    } finally {
      setSavingConsent(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const res = await privacyService.exportData();
      const jsonStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `know-thyself-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success('Complete lifestyle data archive exported successfully!');
    } catch (err) {
      error('Failed to export data.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeletePersonalData = async () => {
    const confirmed = window.confirm(
      'WARNING: Are you sure you want to permanently delete all your daily records, AI insights, goals, and chat history? Your account will remain active, but all lifestyle data will be permanently wiped.'
    );
    if (!confirmed) return;

    setDeletingData(true);
    try {
      const res = await privacyService.deleteData();
      success(res.data.message || 'All personal lifestyle data has been permanently deleted.');
    } catch (err) {
      error('Failed to delete personal data: ' + (err.response?.data?.detail || err.message));
    } finally {
      setDeletingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'DANGER: Are you sure you want to permanently delete your entire account and all associated data? This operation cannot be undone.'
    );
    if (!confirmed) return;

    try {
      await privacyService.deleteAccount();
      success('Account successfully deleted. Goodbye!');
      logout();
    } catch (err) {
      error('Failed to delete account.');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
          <ShieldCheck className="w-4 h-4" />
          <span>Security & Sovereignty</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Settings & Data Ownership
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Control your AI consent preferences, export your personal lifestyle records, or exercise full data deletion.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-card">
        <h2 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" />
          <span>User Profile Information</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Full Name
            </span>
            <span className="font-extrabold text-slate-900 text-sm">{user?.name}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Email Address
            </span>
            <span className="font-extrabold text-slate-900 text-sm">{user?.email}</span>
          </div>
        </div>
      </div>

      {/* AI Processing Consent Controls */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-extrabold text-slate-900">
                Google Gemini AI Processing Consent
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
              When enabled, your anonymized metrics are analyzed by Gemini to generate rich behavioral insights and respond to natural language questions. If disabled, Know Thyself AI runs strictly via on-device local deterministic Python rules.
            </p>
          </div>

          <button
            onClick={handleToggleConsent}
            disabled={savingConsent}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              aiConsent ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
            role="switch"
            aria-checked={aiConsent}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                aiConsent ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          <span>Passwords, emails, and personal identity credentials are never sent to external AI models.</span>
        </div>
      </div>

      {/* GDPR Data Export & Portability */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Download className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-extrabold text-slate-900">
              Complete Data Export (GDPR Article 20)
            </h2>
          </div>
          <p className="text-xs text-slate-600 max-w-lg leading-relaxed">
            Download a portable, structured JSON archive containing all your daily records, configured goals, generated insights, and chat inquiries.
          </p>
        </div>

        <button
          onClick={handleExportData}
          disabled={exporting}
          className="px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 font-bold text-xs flex items-center gap-1.5 transition-all flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{exporting ? 'Exporting...' : 'Download JSON Archive'}</span>
        </button>
      </div>

      {/* Danger Zone: Data Deletion & Account Wipe */}
      <div className="p-6 rounded-3xl bg-rose-50/60 border border-rose-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-rose-800">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider">
            Danger Zone & Data Eradication
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-rose-200/60">
          <div>
            <div className="text-xs font-extrabold text-rose-950">Wipe All Personal Lifestyle Records</div>
            <div className="text-[11px] text-rose-800/80">Permanently clears your daily logs, insights, nudges, and chat logs.</div>
          </div>
          <button
            onClick={handleDeletePersonalData}
            disabled={deletingData}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{deletingData ? 'Wiping Data...' : 'Wipe Lifestyle Records'}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-rose-200/60">
          <div>
            <div className="text-xs font-extrabold text-rose-950">Permanently Delete Account</div>
            <div className="text-[11px] text-rose-800/80">Deletes user profile, credentials, and all database associations.</div>
          </div>
          <button
            onClick={handleDeleteAccount}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-xs transition-colors flex-shrink-0"
          >
            Delete Account Permanently
          </button>
        </div>
      </div>

      {/* Logout Button */}
      <div className="pt-2 flex justify-end">
        <button
          onClick={logout}
          className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of Account</span>
        </button>
      </div>
    </div>
  );
}
