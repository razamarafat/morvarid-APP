
import { useEffect, useRef, useCallback } from 'react';
import { TIMING } from '../constants/config';
import { sanitizeObject } from '../utils/sanitizers';

/**
 * A generic hook to auto-save state to localStorage with debouncing.
 *
 * @param key The localStorage key to save data under.
 * @param data The data object to save.
 * @param onLoad Callback function that runs once on mount if data exists in storage.
 * @param delay Debounce delay in milliseconds (default from CONFIG.TIMING.AUTO_SAVE_DEBOUNCE).
 * @param condition Optional boolean to control if saving should occur (default true).
 */
export function useAutoSave<T>(
    key: string,
    data: T,
    onLoad: (savedData: T) => void,
    delay: number = TIMING.AUTO_SAVE_DEBOUNCE,
    condition: boolean = true
) {
    const isLoaded = useRef(false);
    const initialLoadDone = useRef(false);

    // Load from storage on mount
    useEffect(() => {
        if (initialLoadDone.current) return;

        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed) {
                    console.log(`[AutoSave] Restored draft for ${key}`);
                    // Sanitize the loaded data before passing to onLoad
                    const sanitizedData = sanitizeObject(parsed);
                    onLoad(sanitizedData);
                }
            } catch (error) {
                console.error(`[AutoSave] Failed to parse draft for ${key}`, error);
                localStorage.removeItem(key); // Clear corrupted data
            }
        }
        initialLoadDone.current = true;
        isLoaded.current = true;
    }, [key]); // Intentionally verify key only

    // Save to storage on data change
    useEffect(() => {
        if (!isLoaded.current || !condition) return;

        const handler = setTimeout(() => {
            // Only save if data is not empty/null (basic check)
            if (data && Object.keys(data as any).length > 0) {
                // Sanitize the data before saving
                const sanitizedData = sanitizeObject(data);
                localStorage.setItem(key, JSON.stringify(sanitizedData));
            }
        }, delay);

        return () => clearTimeout(handler);
    }, [data, key, delay, condition]);

    const clear = useCallback(() => {
        localStorage.removeItem(key);
        console.log(`[AutoSave] Cleared draft for ${key}`);
    }, [key]);

    return { clear };
}
