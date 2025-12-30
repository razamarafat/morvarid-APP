
import { useState, useLayoutEffect, useRef } from 'react';

export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
            // Use requestAnimationFrame to avoid "ResizeObserver loop limit exceeded"
            requestAnimationFrame(() => {
                setSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            });
        }
      }
    });

    observer.observe(ref.current);
    
    // Initial size calculation
    const rect = ref.current.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });

    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, width: size.width, height: size.height };
}
