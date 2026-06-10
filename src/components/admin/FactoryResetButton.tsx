import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { useToastStore } from '../../store/toastStore';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

type ResetStep = 'idle' | 'warning' | 'confirmation' | 'processing' | 'success' | 'error';

interface FactoryResetButtonProps {
  onResetComplete?: () => void;
}

/**
 * Completely wipes ALL local state: localStorage, sessionStorage, IndexedDB,
 * Cache API, and unregisters service workers.
 * This ensures no stale auth tokens, offline profiles, or cached data survive the reset.
 */
async function wipeAllLocalState(): Promise<void> {
  // 1. Sign out from Supabase (clears supabase auth tokens from localStorage)
  try {
    await supabase.auth.signOut();
  } catch {
    // Token may already be invalid after DB reset — that's expected and fine
  }

  // 2. Clear ALL localStorage (offline profiles, remember-me, activity, etc.)
  localStorage.clear();

  // 3. Clear sessionStorage (permission store, etc.)
  sessionStorage.clear();

  // 4. Delete ALL IndexedDB databases (Morvarid data stores, workbox caches, etc.)
  if ('indexedDB' in window && 'databases' in indexedDB) {
    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    } catch {
      // IndexedDB might not be available — non-critical
    }
  }

  // 5. Delete all Cache API caches (service worker caches, etc.)
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    } catch {
      // Non-critical
    }
  }

  // 6. Unregister all service workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    } catch {
      // Non-critical
    }
  }
}

const FactoryResetButton: React.FC<FactoryResetButtonProps> = ({ onResetComplete }) => {
  const [step, setStep] = useState<ResetStep>('idle');
  const [confirmText, setConfirmText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resetDetails, setResetDetails] = useState<any>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (step === 'idle') { setConfirmText(''); setErrorMessage(''); setResetDetails(null); }
  }, [step]);

  useEffect(() => {
    if (step === 'confirmation' && confirmInputRef.current) { confirmInputRef.current.focus(); }
  }, [step]);

  if (user && user.role !== 'ADMIN') { return null; }

  const handleReset = async () => {
    if (confirmText !== 'حذف') { addToast('لطفاً کلمه «حذف» را دقیقاً تایپ کنید', 'error'); return; }
    setStep('processing');
    setErrorMessage('');
    try {
      const { data, error } = await supabase.rpc('factory_reset_system');
      if (error) throw error;
      if (data?.success) {
        setResetDetails(data.details);
        setStep('success');
        addToast('سیستم با موفقیت بازنشانی شد', 'success');
        if (onResetComplete) onResetComplete();
        
        // CRITICAL: Wipe ALL local state before reloading.
        // This clears offline profiles, remember-me data, Supabase auth tokens,
        // IndexedDB, sessionStorage, caches, and service workers.
        // Must happen BEFORE reload so no stale data survives the page refresh.
        await wipeAllLocalState();
        
        setTimeout(() => { window.location.reload(); }, 1000);
      } else { throw new Error(data?.message || 'خطای ناشناخته در بازنشانی'); }
    } catch (err: any) {
      console.error('[FactoryReset] Error:', err);
      setErrorMessage(err.message || 'خطا در اجرای بازنشانی');
      setStep('error');
      addToast(`خطا در بازنشانی: ${err.message}`, 'error');
    }
  };

  const handleCancel = () => { setStep('idle'); };
  const handleRetryFromError = () => { setStep('confirmation'); setConfirmText(''); setErrorMessage(''); };

  if (step === 'idle') {
    return (
      <div
        onClick={() => setStep('warning')}
        className="col-span-1 h-44 relative p-5 flex flex-col justify-between cursor-pointer select-none overflow-hidden group rounded-[32px] shadow-lg hover:shadow-2xl transition-all duration-300 transform-gpu hover:-translate-y-1 active:scale-[0.98] bg-gradient-to-br from-red-700 to-red-900 border border-red-500/30"
      >
        <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <Icons.AlertTriangle className="absolute -right-6 -bottom-6 w-32 h-32 opacity-[0.15] transform-gpu rotate-12 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 text-white" />
        <div className="relative z-10 flex justify-between items-start w-full">
          <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
            <Icons.AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <span className="text-3xl font-black text-white drop-shadow-md tracking-tight">خطر</span>
        </div>
        <div className="relative z-10">
          <h3 className="text-white font-black text-lg leading-tight drop-shadow-sm tracking-wide">بازنشانی کارخانه‌ای</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-[32px] shadow-2xl max-w-md w-full p-8 space-y-6 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {step === 'warning' && (
          <>
            <div className="flex items-center gap-3 text-red-400">
              <Icons.AlertTriangle className="w-8 h-8 flex-shrink-0" />
              <h3 className="text-xl font-black">هشدار بحرانی سیستم</h3>
            </div>
            <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-5 space-y-3">
              <p className="text-red-200 text-sm leading-relaxed font-bold">این عملیات تمام داده‌های سیستم را برای همیشه پاک می‌کند.</p>
              <ul className="text-red-300 text-sm space-y-1.5 mr-5 list-disc">
                <li>تمام آمار تولید و فروش روزانه</li>
                <li>تمام حواله‌ها و فاکتورها</li>
                <li>تمام فارم‌ها و تخصیص‌ها</li>
                <li>تمام کاربران غیرادمین</li>
                <li>تمام لاگ‌ها و تاریخچه سیستم</li>
              </ul>
              <p className="text-amber-300 text-xs font-bold mt-3">حساب ادمین اصلی حفظ می‌شود — اما سایر داده‌ها برگشت‌ناپذیر هستند.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCancel} className="flex-1 px-6 py-3 rounded-xl bg-gray-700 text-gray-300 font-bold hover:bg-gray-600 transition-colors">انصراف</button>
              <button onClick={() => setStep('confirmation')} className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white font-black hover:bg-red-500 transition-colors">ادامه عملیات</button>
            </div>
          </>
        )}
        {step === 'confirmation' && (
          <>
            <div className="flex items-center gap-3 text-red-400">
              <Icons.Shield className="w-7 h-7 flex-shrink-0" />
              <h3 className="text-lg font-black">تأیید نهایی عملیات</h3>
            </div>
            <div className="bg-gray-800 rounded-xl p-5 space-y-4">
              <p className="text-gray-300 text-sm leading-relaxed">برای تأیید نهایی، لطفاً کلمه زیر را دقیقاً تایپ کنید:</p>
              <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-5 py-3 text-center">
                <span className="text-red-400 font-black text-2xl tracking-widest">حذف</span>
              </div>
              <input ref={confirmInputRef} type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                placeholder="اینجا تایپ کنید..." className="w-full px-4 py-3 rounded-xl bg-gray-700 border-2 border-gray-600 text-white text-center text-lg font-bold outline-none focus:border-red-500 transition-colors"
                autoComplete="off" dir="rtl" onKeyDown={(e) => { if (e.key === 'Enter' && confirmText === 'حذف') handleReset(); }} />
            </div>
            <div className="flex gap-3">
              <button onClick={handleCancel} className="flex-1 px-6 py-3 rounded-xl bg-gray-700 text-gray-300 font-bold hover:bg-gray-600 transition-colors">بازگشت</button>
              <button onClick={handleReset} disabled={confirmText !== 'حذف'} className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white font-black hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-600">پاکسازی کامل سیستم</button>
            </div>
          </>
        )}
        {step === 'processing' && (
          <div className="space-y-6 text-center py-8">
            <div className="flex justify-center"><div className="animate-spin rounded-full h-16 w-16 border-4 border-red-500 border-t-transparent"></div></div>
            <div>
              <h3 className="text-lg font-black text-white mb-2">در حال بازنشانی سیستم...</h3>
              <p className="text-gray-400 text-sm">لطفاً صبر کنید، تمام داده‌ها در حال پاکسازی هستند</p>
              <p className="text-red-400 text-xs mt-3 font-bold">صفحه را نبندید و منتظر بمانید</p>
            </div>
          </div>
        )}
        {step === 'success' && (
          <div className="space-y-6 text-center py-6">
            <div className="flex justify-center"><div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center"><Icons.Check className="w-8 h-8 text-white" /></div></div>
            <div>
              <h3 className="text-lg font-black text-green-400 mb-2">بازنشانی با موفقیت انجام شد</h3>
              <p className="text-gray-400 text-sm">سیستم به حالت اولیه بازگشت</p>
              <p className="text-green-400 text-xs mt-2">صفحه به زودی بازآوری می‌شود...</p>
            </div>
            {resetDetails && (
              <div className="bg-gray-800 rounded-xl p-4 text-right space-y-1">
                <p className="text-xs text-gray-500">آمار حذف شده:</p>
                <p className="text-xs text-gray-400">حساب‌های کاربری: {resetDetails.auth_users_deleted || 0}</p>
                <p className="text-xs text-gray-400">پروفایل‌ها: {resetDetails.profiles_deleted || 0}</p>
                <p className="text-xs text-gray-400">فارم‌ها: {resetDetails.farms_deleted || 0}</p>
                <p className="text-xs text-gray-400">آمار روزانه: {resetDetails.daily_statistics_deleted || 0}</p>
                <p className="text-xs text-gray-400">حواله‌ها: {resetDetails.invoices_deleted || 0}</p>
              </div>
            )}
          </div>
        )}
        {step === 'error' && (
          <div className="space-y-6 text-center py-6">
            <div className="flex justify-center"><div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center"><Icons.X className="w-8 h-8 text-white" /></div></div>
            <div>
              <h3 className="text-lg font-black text-red-400 mb-2">خطا در بازنشانی سیستم</h3>
              <p className="text-gray-400 text-sm">{errorMessage || 'خطای ناشناخته رخ داده است. لطفاً دوباره تلاش کنید.'}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCancel} className="flex-1 px-6 py-3 rounded-xl bg-gray-700 text-gray-300 font-bold hover:bg-gray-600 transition-colors">بستن</button>
              <button onClick={handleRetryFromError} className="flex-1 px-6 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 transition-colors">تلاش مجدد</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FactoryResetButton;
