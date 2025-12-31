
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useToastStore } from '../store/toastStore';

/**
 * Hook to implement "Double Back Press to Exit" pattern for PWA/Mobile.
 * Prevents accidental app exit from dashboard pages.
 */
export const useDoubleBackExit = () => {
    const location = useLocation();
    const { addToast } = useToastStore();
    const lastBackPress = useRef<number>(0);

    // DASHBOARD_PATHS should match the root routes where we want to prevent direct exit
    const DASHBOARD_PATHS = ['/admin', '/registration', '/sales', '/home'];

    useEffect(() => {
        const isDashboard = DASHBOARD_PATHS.includes(location.pathname);

        if (!isDashboard) return;

        // Push a dummy state to history. When back is pressed, popstate triggers 
        // and we are technically still in the app.
        window.history.pushState(null, '', window.location.href);

        const handlePopState = () => {
            const now = Date.now();
            const delay = now - lastBackPress.current;

            if (delay < 2000) {
                // If double pressed within 2 seconds
                // We actually want to exit. Since we pushed state, going back 
                // once just returns to the state before our dummy push.
                // We go back again to truly "exit" the current history entry.
                window.history.back();
                // Note: In most browsers/PWAs, you can't force the browser to CLOSE
                // via JS for security reasons, but this will allow the 'back' 
                // to proceed and exit the app's history stack.
            } else {
                // Prevent exit and show warning
                lastBackPress.current = now;
                addToast('برای خروج دوباره دکمه بازگشت را بزنید', 'info');

                // Re-push dummy state to capture the NEXT back press
                window.history.pushState(null, '', window.location.href);
            }
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [location.pathname, addToast]);
};
