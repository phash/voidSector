import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailVerifyBanner } from '../components/EmailVerifyBanner';
import { mockStoreState } from '../test/mockStore';

describe('EmailVerifyBanner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows for a logged-in non-guest with unverified email', () => {
    mockStoreState({ token: 'tok', isGuest: false, emailVerified: false } as any);
    render(<EmailVerifyBanner />);
    expect(screen.getByTestId('email-verify-banner')).toBeInTheDocument();
    expect(screen.getByTestId('resend-verification-btn')).toBeInTheDocument();
  });

  it('is hidden when the email is verified', () => {
    mockStoreState({ token: 'tok', isGuest: false, emailVerified: true } as any);
    render(<EmailVerifyBanner />);
    expect(screen.queryByTestId('email-verify-banner')).toBeNull();
  });

  it('is hidden for guests', () => {
    mockStoreState({ token: 'tok', isGuest: true, emailVerified: false } as any);
    render(<EmailVerifyBanner />);
    expect(screen.queryByTestId('email-verify-banner')).toBeNull();
  });

  it('is hidden when not logged in', () => {
    mockStoreState({ token: null, isGuest: false, emailVerified: false } as any);
    render(<EmailVerifyBanner />);
    expect(screen.queryByTestId('email-verify-banner')).toBeNull();
  });

  it('resend posts to /api/resend-verification with the auth header', async () => {
    mockStoreState({ token: 'tok123', isGuest: false, emailVerified: false } as any);
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'sent' }) } as Response);
    render(<EmailVerifyBanner />);
    await userEvent.click(screen.getByTestId('resend-verification-btn'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/api/resend-verification');
    expect(opts.method).toBe('POST');
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
    await waitFor(() => expect(screen.getByText(/Mail gesendet/)).toBeInTheDocument());
  });

  it('marks verified when the server says already_verified', async () => {
    const setEmailVerified = vi.fn();
    mockStoreState({ token: 'tok', isGuest: false, emailVerified: false, setEmailVerified } as any);
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'already_verified' }),
    } as Response);
    render(<EmailVerifyBanner />);
    await userEvent.click(screen.getByTestId('resend-verification-btn'));
    await waitFor(() => expect(setEmailVerified).toHaveBeenCalledWith(true));
  });
});
