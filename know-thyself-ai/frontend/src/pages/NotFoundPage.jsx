import React from 'react';
import { Link } from 'react-router-dom';
import { BrainCircuit, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 shadow-sm">
        <BrainCircuit className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">404</h1>
      <h2 className="text-base font-bold text-slate-700 mt-1 mb-2">Page Not Found</h2>
      <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
        The personal intelligence pathway you are trying to visit does not exist or has been relocated.
      </p>
      <Link
        to="/dashboard"
        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/25 flex items-center gap-2 transition-all"
      >
        <Home className="w-4 h-4" />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
}
