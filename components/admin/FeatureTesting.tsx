
import React, { useState, useRef, useEffect } from 'react';
import Button from '../common/Button';
import { useToastStore } from '../../store/toastStore';
import { useAlertStore } from '../../store/alertStore'; 
import { useFarmStore } from '../../store/farmStore';
import { supabase } from '../../lib/supabase';
import { Icons } from '../common/Icons';

const FeatureTesting: React.FC = () => {
  const { addToast } = useToastStore();
  const { sendAlert, triggerTestNotification } = useAlertStore();
  const { farms } = useFarmStore();
  const [isRunning, setIsRunning] = useState<string | null>(null);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const logBoxRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (logBoxRef.current) {
        logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [testLogs]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
      const now = new Date();
      const time = now.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
      const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warn' ? '⚠️' : 'ℹ️';
      const logLine = `[${time}] ${prefix} ${msg}`;
      setTestLogs(prev => [...prev, logLine]);
  };

  const handleCopyLogs = () => {
      if (testLogs.length === 0) return;
      navigator.clipboard.writeText(testLogs.join('\n'))
        .then(() => addToast('لاگ‌ها در حافظه کپی شدند', 'success'))
        .catch(() => addToast('خطا در کپی لاگ', 'error'));
  };

  const handleClearLogs = () => {
      setTestLogs([]);
  };

  const runTest = async (feature: string) => {
    setIsRunning(feature);
    addLog(`>>> STARTING TEST: ${feature.toUpperCase()} <<<`, 'info');
    
    let success = false;

    try {
        switch(feature) {
            case 'database_ping':
                addLog('Initiating Supabase connection...', 'info');
                const start = Date.now();
                
                // Technical query: Fetch minimal data to test connection
                const { data, error, status, statusText } = await supabase.from('farms').select('*', { count: 'exact', head: true });
                const duration = Date.now() - start;

                if (error) {
                    addLog(`Database Error: ${error.message} (Code: ${error.code})`, 'error');
                    addLog(`Details: ${JSON.stringify(error)}`, 'error');
                } else {
                    success = (status >= 200 && status < 300);
                    addLog(`Response Status: ${status} ${statusText}`, success ? 'success' : 'warn');
                    addLog(`Latency: ${duration}ms`, 'info');
                    addLog(`Data Integrity: Valid response received.`, 'success');
                }
                break;

            case 'realtime_broadcast':
                addLog('Checking user authentication...', 'info');
                const { data: { user } } = await supabase.auth.getUser();
                
                if (!user) {
                    addLog('Auth Error: No active session found. Cannot send broadcast.', 'error');
                    break;
                }
                addLog(`User ID: ${user.id}`, 'info');

                const target = farms[0] || { id: 'test-farm', name: 'Test Farm' };
                addLog(`Targeting channel for farm: ${target.name} (${target.id})`, 'info');
                
                const resp = await sendAlert(target.id, target.name, 'سیگنال تست مدیریت');
                
                addLog(`Payload Size: ${resp.bytes} bytes`, 'info');
                if (resp.success) {
                    addLog(`Broadcast Result: ${resp.detail}`, 'success');
                    success = true;
                } else {
                    addLog(`Broadcast Failed: ${resp.detail}`, 'error');
                }
                break;

            case 'pwa_environment':
                addLog('Analyzing browser environment...', 'info');
                const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
                
                addLog(`User Agent: ${navigator.userAgent}`, 'info');
                addLog(`Display Mode: ${isStandalone ? 'Standalone (Installed)' : 'Browser Tab'}`, isStandalone ? 'success' : 'warn');
                addLog(`Service Worker Support: ${'serviceWorker' in navigator ? 'Yes' : 'No'}`, 'info');
                addLog(`Platform: ${isIOS ? 'iOS' : 'Other'}`, 'info');
                
                if ('serviceWorker' in navigator) {
                    const reg = await navigator.serviceWorker.getRegistration();
                    addLog(`SW Status: ${reg ? 'Active' : 'Not Registered'}`, reg ? 'success' : 'warn');
                    if (reg) addLog(`SW Scope: ${reg.scope}`, 'info');
                }
                
                success = true;
                break;

            case 'system_notification':
                addLog('Initiating Notification & Service Worker Test...', 'info');
                
                // 1. Browser Support Check
                if (!("Notification" in window)) {
                    addLog('❌ Notification API not supported.', 'error');
                    break;
                }
                if (!("serviceWorker" in navigator)) {
                    addLog('❌ Service Worker API not supported.', 'error');
                    break;
                }

                // 2. Permission Check
                addLog(`Current Permission: ${Notification.permission}`, 'info');
                if (Notification.permission !== 'granted') {
                    addLog('Requesting permission...', 'info');
                    const permission = await Notification.requestPermission();
                    if (permission !== 'granted') {
                        addLog('❌ Permission denied by user.', 'error');
                        break;
                    }
                    addLog('✅ Permission granted.', 'success');
                }

                // 3. Service Worker Readiness
                try {
                    addLog('Waiting for Service Worker registration...', 'info');
                    const registration = await navigator.serviceWorker.ready;
                    if (!registration) {
                         addLog('❌ Service Worker not ready.', 'error');
                         break;
                    }
                    addLog(`✅ Service Worker Active (Scope: ${registration.scope})`, 'success');

                    // 4. Trigger Notification via SW
                    addLog('Dispatching notification via Service Worker...', 'info');
                    await triggerTestNotification();
                    
                    addLog('✅ Notification dispatched.', 'success');
                    addLog('👉 Please check your system tray or notification center.', 'warn');
                    success = true;

                } catch (e: any) {
                    addLog(`❌ Exception: ${e.message}`, 'error');
                }
                break;
        }
    } catch(e: any) {
        addLog(`CRITICAL EXCEPTION: ${e.message}`, 'error');
        console.error(e);
        success = false;
    }
    
    addLog(`TEST COMPLETED: ${success ? 'PASSED' : 'FAILED'}`, success ? 'success' : 'error');
    addLog('----------------------------------------', 'info');
    setIsRunning(null);
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 border-r-8 border-metro-teal shadow-md">
          <h2 className="text-xl font-black dark:text-white">کنسول عیب‌یابی و سنجش ویژگی‌ها</h2>
          <p className="text-sm text-gray-500 mt-2">
              نتایج تست‌های فنی به صورت بلادرنگ در باکس لاگ پایین صفحه نمایش داده می‌شود.
          </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 p-5 flex justify-between items-center shadow-sm border border-gray-100 dark:border-gray-700">
            <div>
                <h4 className="font-bold dark:text-white">پایداری اتصال دیتابیس</h4>
                <p className="text-xs text-gray-400">Ping و بررسی سلامت جداول</p>
            </div>
            <Button size="sm" onClick={() => runTest('database_ping')} isLoading={isRunning === 'database_ping'}>تست اتصال</Button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 flex justify-between items-center shadow-sm border border-gray-100 dark:border-gray-700">
            <div>
                <h4 className="font-bold dark:text-white">سیستم Broadcast زنده</h4>
                <p className="text-xs text-gray-400">تست کانال‌های Realtime</p>
            </div>
            <Button size="sm" onClick={() => runTest('realtime_broadcast')} isLoading={isRunning === 'realtime_broadcast'}>تست ارسال</Button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 flex justify-between items-center shadow-sm border border-gray-100 dark:border-gray-700">
            <div>
                <h4 className="font-bold dark:text-white">وضعیت محیط PWA</h4>
                <p className="text-xs text-gray-400">بررسی Manifest و SW</p>
            </div>
            <Button size="sm" onClick={() => runTest('pwa_environment')} isLoading={isRunning === 'pwa_environment'}>بررسی محیط</Button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 flex justify-between items-center shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-metro-orange">
            <div>
                <h4 className="font-bold dark:text-white">تست اعلان سیستمی (Push)</h4>
                <p className="text-xs text-gray-400">ارسال نوتیفیکیشن واقعی</p>
            </div>
            <Button size="sm" onClick={() => runTest('system_notification')} isLoading={isRunning === 'system_notification'}>ارسال اعلان</Button>
        </div>
      </div>

      {/* Technical Log Viewer Box */}
      <div className="mt-8 bg-[#1E1E1E] rounded-xl overflow-hidden shadow-lg border border-gray-700">
          <div className="bg-[#2D2D2D] px-4 py-2 flex justify-between items-center border-b border-gray-600">
              <span className="text-xs font-mono text-gray-300 flex items-center gap-2">
                  <Icons.HardDrive className="w-4 h-4" />
                  Technical Test Logs
              </span>
              <div className="flex gap-2">
                  <button onClick={handleCopyLogs} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors" title="کپی لاگ‌ها">
                      <Icons.FileText className="w-4 h-4" />
                  </button>
                  <button onClick={handleClearLogs} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400 transition-colors" title="پاکسازی">
                      <Icons.Trash className="w-4 h-4" />
                  </button>
              </div>
          </div>
          <div 
            ref={logBoxRef}
            className="h-64 overflow-y-auto p-4 font-mono text-xs md:text-sm custom-scrollbar bg-[#1E1E1E]"
            dir="ltr"
          >
              {testLogs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-600 italic">
                      No logs available. Run a test to see details.
                  </div>
              ) : (
                  testLogs.map((log, index) => (
                      <div key={index} className="mb-1 break-all whitespace-pre-wrap leading-relaxed">
                          {log.includes('❌') || log.includes('ERROR') ? (
                              <span className="text-red-400">{log}</span>
                          ) : log.includes('✅') || log.includes('SUCCESS') ? (
                              <span className="text-green-400">{log}</span>
                          ) : log.includes('⚠️') ? (
                              <span className="text-yellow-400">{log}</span>
                          ) : (
                              <span className="text-gray-300">{log}</span>
                          )}
                      </div>
                  ))
              )}
          </div>
      </div>
    </div>
  );
};

export default FeatureTesting;
