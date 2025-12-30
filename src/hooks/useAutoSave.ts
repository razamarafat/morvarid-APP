
import { useEffect, useRef, useCallback } from 'react';

/**
 * A generic hook to auto-save state to localStorage with debouncing.
 * 
 * @param key The localStorage key to save data under.
 * @param data The data object to save.
 * @param onLoad Callback function that runs once on mount if data exists in storage.
 * @param delay Debounce delay in milliseconds (default 1000ms).
 * @param condition Optional boolean to control if saving should occur (default true).
 */
export function useAutoSave<T>(
    key: string,
    data: T,
    onLoad: (savedData: T) => void,
    delay: number = 1000,
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
                    onLoad(parsed);
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
                localStorage.setItem(key, JSON.stringify(data));
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
