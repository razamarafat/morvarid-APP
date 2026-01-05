import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('returns updated value after delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    // Initial value
    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated', delay: 500 });
    expect(result.current).toBe('initial'); // Should still be old value

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
  });

  it('respects different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'test', delay: 1000 } }
    );

    rerender({ value: 'updated', delay: 1000 });

    // After 500ms, should still be old value
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('test');

    // After another 500ms (total 1000ms), should be updated
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('updated');
  });

  it('cancels previous timeout when value changes quickly', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'first', delay: 500 } }
    );

    // Change value quickly (before first timeout completes)
    rerender({ value: 'second', delay: 500 });

    // Advance time by 300ms (less than delay)
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('first'); // Should still be first value

    // Change again quickly
    rerender({ value: 'third', delay: 500 });

    // Advance another 300ms (total 600ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('first'); // Should still be first value

    // Advance remaining time to complete the latest timeout
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('third'); // Should be the latest value
  });

  it('handles rapid successive changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'v1', delay: 200 } }
    );

    // Rapid changes
    rerender({ value: 'v2', delay: 200 });
    rerender({ value: 'v3', delay: 200 });
    rerender({ value: 'v4', delay: 200 });

    // Advance time by less than delay
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe('v1'); // Should still be initial value

    // Advance enough time for the latest timeout
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('v4'); // Should be the final value
  });

  it('works with different data types', () => {
    // String
    const { result: stringResult, rerender: rerenderString } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 'string' } }
    );

    rerenderString({ value: 'updated string' });
    act(() => vi.advanceTimersByTime(100));
    expect(stringResult.current).toBe('updated string');

    // Number
    const { result: numberResult, rerender: rerenderNumber } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 42 } }
    );

    rerenderNumber({ value: 100 });
    act(() => vi.advanceTimersByTime(100));
    expect(numberResult.current).toBe(100);

    // Object
    const obj1 = { id: 1, name: 'test' };
    const obj2 = { id: 2, name: 'updated' };
    const { result: objectResult, rerender: rerenderObject } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: obj1 } }
    );

    rerenderObject({ value: obj2 });
    act(() => vi.advanceTimersByTime(100));
    expect(objectResult.current).toBe(obj2);
  });

  it('handles zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 0 } }
    );

    rerender({ value: 'updated', delay: 0 });

    // With zero delay, should update immediately (next tick)
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current).toBe('updated');
  });

  it('cleans up timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount } = renderHook(() => useDebounce('test', 500));

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('handles delay changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'test', delay: 1000 } }
    );

    rerender({ value: 'updated', delay: 100 });

    // With shorter delay, should update faster
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('updated');
  });
});
