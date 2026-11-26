import React, { useState } from 'react';
import { Server, CheckCircle2, AlertCircle, Edit2, RotateCw } from 'lucide-react';
import axios from 'axios';
import { getApiBaseUrl, setCustomApiBaseUrl } from '../services/api';

export default function BackendServerConfig() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(getApiBaseUrl());
  const [inputUrl, setInputUrl] = useState(getApiBaseUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleSave = async (e) => {
    e?.preventDefault();
    setTesting(true);
    setTestResult(null);

    let testTarget = inputUrl.trim().replace(/\/+$/, '');
    if (!testTarget.endsWith('/api') && testTarget.startsWith('http')) {
      testTarget = `${testTarget}/api`;
    }

    try {
      // Test the endpoint
      await axios.get(`${testTarget}/health`, { timeout: 6000 });
      setCustomApiBaseUrl(testTarget);
      setCurrentUrl(testTarget);
      setTestResult({ success: true, message: 'Backend reachable and verified!' });
      setTimeout(() => setIsOpen(false), 1200);
    } catch (err) {
      // Even if /health doesn't return 200, if it responded with anything other than network error, server is alive
      if (err.response) {
        setCustomApiBaseUrl(testTarget);
        setCurrentUrl(testTarget);
        setTestResult({ success: true, message: 'Server reached! Saved successfully.' });
        setTimeout(() => setIsOpen(false), 1200);
      } else {
        setTestResult({ success: false, message: 'Could not connect. Ensure your Render backend is running.' });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleReset = () => {
    setCustomApiBaseUrl('');
    setCurrentUrl(getApiBaseUrl());
    setInputUrl(getApiBaseUrl());
    setTestResult(null);
    setIsOpen(false);
  };

  return (
    <div className="mt-4 text-center">
      <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-100/80 px-3 py-1 rounded-full border border-slate-200/60">
        <Server className="w-3 h-3 text-indigo-500" />
        <span className="truncate max-w-[200px]">API: {currentUrl}</span>
        <button
          onClick={() => {
            setInputUrl(currentUrl);
            setIsOpen(!isOpen);
          }}
          className="text-indigo-600 hover:text-indigo-800 font-semibold ml-1 flex items-center gap-0.5"
        >
          <Edit2 className="w-2.5 h-2.5" />
          <span>{isOpen ? 'Close' : 'Change'}</span>
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSave} className="mt-3 p-3.5 bg-white rounded-2xl border border-indigo-100 shadow-md max-w-sm mx-auto text-left space-y-2.5">
          <label className="text-[11px] font-bold text-slate-700 block">
            Backend Server URL (e.g. Render)
          </label>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="https://your-backend.onrender.com/api"
            className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {testResult && (
            <div className={`p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
              {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-slate-400 hover:text-slate-600 font-medium"
            >
              Reset Default
            </button>
            <button
              type="submit"
              disabled={testing}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1"
            >
              {testing ? <RotateCw className="w-3 h-3 animate-spin" /> : null}
              <span>{testing ? 'Verifying...' : 'Save & Connect'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
