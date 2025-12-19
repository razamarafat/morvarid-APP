
import React from 'react';
import { useNotificationStore } from '../../store/notificationStore';
import Modal from './Modal';
import Button from './Button';
import { Icons } from './Icons';

const ConfirmDialog: React.FC = () => {
  const { confirmState, handleConfirm, handleCancel } = useNotificationStore();

  if (!confirmState.isOpen) {
    return null;
  }

  const { title = 'تایید عملیات', message, confirmText = 'تایید', cancelText = 'انصراف', type = 'info' } = confirmState;

  const typeStyles = {
    info: { icon: Icons.AlertCircle, color: 'text-blue-500' },
    warning: { icon: Icons.AlertCircle, color: 'text-yellow-500' },
    danger: { icon: Icons.AlertCircle, color: 'text-red-500' },
  };

  const Icon = typeStyles[type].icon;

  return (
    <Modal isOpen={confirmState.isOpen} onClose={handleCancel} title={title}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-opacity-10 ${typeStyles[type].color.replace('text-', 'bg-')}`}>
          <Icon className={`w-6 h-6 ${typeStyles[type].color}`} />
        </div>
        <div className="flex-1">
          <p className="text-gray-700 dark:text-gray-300">{message}</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={handleCancel}>
          {cancelText}
        </Button>
        <Button
          variant={type === 'danger' ? 'danger' : 'primary'}
          onClick={handleConfirm}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
