
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
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'tween', duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="relative bg-[#FDFBFF] dark:bg-[#2B2930] rounded-[28px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden gpu-accelerated"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
