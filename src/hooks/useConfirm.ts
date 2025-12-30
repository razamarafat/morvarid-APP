
import { useNotificationStore } from '../store/notificationStore';

export const useConfirm = () => {
  const showConfirm = useNotificationStore((state) => state.showConfirm);
  return { confirm: showConfirm };
};
