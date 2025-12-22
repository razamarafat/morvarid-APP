
import React, { Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            // M3 Dialog: rounded-[28px], bg-surface, elevation-3
            className="relative bg-[#FDFBFF] dark:bg-[#2B2930] rounded-[28px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            <header className="flex items-center justify-between px-6 pt-6 pb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Icons.X className="w-6 h-6" />
              </button>
            </header>
            
            <main className="px-6 py-2 overflow-y-auto custom-scrollbar">
              {children}
            </main>
            
            {footer && (
              <footer className="flex justify-end items-center gap-2 p-6 pt-4">
                {footer}
              </footer>
            )}
            {/* If no footer prop is passed, sometimes children include buttons. 
                But for pure M3 structure, actions are usually separate. 
                We keep existing structure where children often contain form actions 
                but ensure padding is consistent. */}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
