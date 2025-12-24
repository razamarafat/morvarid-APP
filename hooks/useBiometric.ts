
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';

export const useBiometric = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const { user, registerBiometric } = useAuthStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(available => setIsAvailable(available))
        .catch(() => setIsAvailable(false));
    }
  }, []);

  const register = async () => {
    try {
      // In a real app, fetch challenge from backend options = await api.get('/auth/webauthn/register')
      // const credential = await navigator.credentials.create({ publicKey: options });
      // await api.post('/auth/webauthn/verify', credential);
      
      // Simulation
      await new Promise(resolve => setTimeout(resolve, 1000));
      registerBiometric();
      addToast('اثر انگشت با موفقیت ثبت شد', 'success');
      return true;
    } catch (error) {
      addToast('خطا در ثبت اثر انگشت', 'error');
      return false;
    }
