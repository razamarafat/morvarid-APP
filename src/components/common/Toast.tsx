
import React from 'react';
import { useToastStore } from '../../store/toastStore';
import { Icons } from './Icons';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 md:translate-x-0 md:left-6 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4 md:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            // M3 Snackbar Style: Dark background (inverse surface), rounded-small or full
            className={`pointer-events-auto flex items-center gap-4 pl-4 pr-6 py-3.5 rounded-xl shadow-lg border-l-4 ${
              toast.type === 'success' ? 'bg-[#1E1E1E] text-white border-green-500' :
              toast.type === 'error' ? 'bg-[#1E1E1E] text-white border-red-500' :
              toast.type === 'warning' ? 'bg-[#1E1E1E] text-white border-yellow-500' :
              'bg-[#1E1E1E] text-white border-blue-500'
            }`}
          >
            {toast.type === 'success' && <Icons.Check className="text-green-400 w-5 h-5 shrink-0" />}
            {toast.type === 'error' && <Icons.AlertCircle className="text-red-400 w-5 h-5 shrink-0" />}
            {toast.type === 'warning' && <Icons.AlertCircle className="text-yellow-400 w-5 h-5 shrink-0" />}
            {toast.type === 'info' && <Icons.Bell className="text-blue-400 w-5 h-5 shrink-0" />}
            
            <p className="flex-1 text-sm font-medium tracking-wide leading-tight">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
              <Icons.X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
