import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', title = '') => {
    const id = 'toast-' + Math.random().toString(36).substr(2, 9);
    
    const defaultTitle = 
      type === 'success' ? 'Success!' :
      type === 'error' ? 'Action Failed' :
      type === 'warning' ? 'Warning' : 'Information';

    const newToast = {
      id,
      message,
      type,
      title: title || defaultTitle
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      
      {/* Global Toast Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map(toast => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start space-x-3.5 p-4 rounded-2xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-slide-in ${
                isSuccess
                  ? 'bg-slate-900/95 text-white border-emerald-500/30 shadow-emerald-950/20'
                  : isError
                  ? 'bg-slate-900/95 text-white border-rose-500/30 shadow-rose-950/20'
                  : isWarning
                  ? 'bg-slate-900/95 text-white border-amber-500/30 shadow-amber-950/20'
                  : 'bg-slate-900/95 text-white border-blue-500/30 shadow-blue-950/20'
              }`}
            >
              {/* Icon Badge */}
              <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                isSuccess
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : isError
                  ? 'bg-rose-500/20 text-rose-400'
                  : isWarning
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}>
                {isSuccess && <CheckCircle2 className="h-5 w-5 animate-bounce" />}
                {isError && <AlertCircle className="h-5 w-5 animate-bounce" />}
                {isWarning && <AlertTriangle className="h-5 w-5 animate-bounce" />}
                {!isSuccess && !isError && !isWarning && <Info className="h-5 w-5 animate-bounce" />}
              </div>

              {/* Toast Message Content */}
              <div className="flex-1 space-y-0.5">
                <h4 className={`text-xs font-black tracking-wide uppercase ${
                  isSuccess ? 'text-emerald-400' : isError ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-blue-400'
                }`}>
                  {toast.title}
                </h4>
                <p className="text-xs text-slate-200 font-semibold leading-relaxed">
                  {toast.message}
                </p>
              </div>

              {/* Dismiss Button */}
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
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
