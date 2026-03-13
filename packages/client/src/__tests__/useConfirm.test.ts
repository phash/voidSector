import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfirm } from '../hooks/useConfirm';

describe('useConfirm', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('isArmed returns false initially', () => {
    const { result } = renderHook(() => useConfirm());
    expect(result.current.isArmed('test-key')).toBe(false);
  });

  it('first click arms the key, does not call callback', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useConfirm());

    act(() => { result.current.confirm('test-key', callback); });

    expect(result.current.isArmed('test-key')).toBe(true);
    expect(callback).not.toHaveBeenCalled();
  });

  it('second click calls callback and disarms', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useConfirm());

    act(() => { result.current.confirm('test-key', callback); });
    act(() => { result.current.confirm('test-key', callback); });

    expect(callback).toHaveBeenCalledOnce();
    expect(result.current.isArmed('test-key')).toBe(false);
  });

  it('auto-resets after timeout', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useConfirm(3000));

    act(() => { result.current.confirm('test-key', callback); });
    expect(result.current.isArmed('test-key')).toBe(true);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.isArmed('test-key')).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });

  it('different keys are independent', () => {
    const { result } = renderHook(() => useConfirm());

    act(() => { result.current.confirm('key-a', vi.fn()); });

    expect(result.current.isArmed('key-a')).toBe(true);
    expect(result.current.isArmed('key-b')).toBe(false);
  });

  it('does not auto-reset when timeout is null', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useConfirm(null));

    act(() => { result.current.confirm('test-key', callback); });
    expect(result.current.isArmed('test-key')).toBe(true);

    act(() => { vi.advanceTimersByTime(60000); });
    expect(result.current.isArmed('test-key')).toBe(true);
    expect(callback).not.toHaveBeenCalled();
  });

  it('arming new key disarms previous key', () => {
    const { result } = renderHook(() => useConfirm());

    act(() => { result.current.confirm('key-a', vi.fn()); });
    act(() => { result.current.confirm('key-b', vi.fn()); });

    expect(result.current.isArmed('key-a')).toBe(false);
    expect(result.current.isArmed('key-b')).toBe(true);
  });
});
