import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const recentToastsRef = useRef(new Map());

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    if (!message) return;
    const now = Date.now();
    const lastSeen = recentToastsRef.current.get(message);

    // Deduplicate: Don't spawn identical toast message if already shown within 4.5 seconds
    if (lastSeen && now - lastSeen < 4500) {
      return;
    }
    recentToastsRef.current.set(message, now);

    const id = now + Math.random();
    // Keep at most 2 toasts visible at once, smoothly sliding in
    setToasts((prev) => [...prev.slice(-1), { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ 
      addToast, 
      success: (msg) => addToast(msg, 'success'), 
      error: (msg) => addToast(msg, 'error'), 
      info: (msg) => addToast(msg, 'info') 
    }}>
      {children}
      {/* Toast Notification Container - Locked down at bottom right */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3">
        {toasts.map((toast) => {
          let bg = 'bg-white border-slate-200 text-slate-800';
          let Icon = Info;
          let iconColor = 'text-indigo-500';

          if (toast.type === 'success') {
            bg = 'bg-emerald-50/95 border-emerald-300 text-emerald-950';
            Icon = CheckCircle2;
            iconColor = 'text-emerald-600';
          } else if (toast.type === 'error') {
            bg = 'bg-rose-50/95 border-rose-300 text-rose-950';
            Icon = AlertCircle;
            iconColor = 'text-rose-600';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-right-4 ${bg}`}
              role="alert"
            >
              <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconColor}`} />
              <div className="flex-1 text-xs font-semibold leading-relaxed">{toast.message}</div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg transition-colors ml-1"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
