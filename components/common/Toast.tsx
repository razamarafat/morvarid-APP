
import React from 'react';
import { useToastStore } from '../../store/toastStore';
import { Icons } from './Icons';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl min-w-[300px] border-r-8 ${
              toast.type === 'success' ? 'bg-white border-green-500 text-gray-800' :
              toast.type === 'error' ? 'bg-white border-red-500 text-gray-800' :
              toast.type === 'warning' ? 'bg-white border-yellow-500 text-gray-800' :
              'bg-white border-blue-500 text-gray-800'
            }`}
          >
            {toast.type === 'success' && <Icons.Check className="text-green-500 w-6 h-6" />}
            {toast.type === 'error' && <Icons.AlertCircle className="text-red-500 w-6 h-6" />}
            {toast.type === 'warning' && <Icons.AlertCircle className="text-yellow-500 w-6 h-6" />}
            {toast.type === 'info' && <Icons.Bell className="text-blue-500 w-6 h-6" />}
            
            <p className="flex-1 text-sm font-bold">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-gray-600">
              <Icons.X className="w-5 h-5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
