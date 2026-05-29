import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailVerifyBanner } from '../components/EmailVerifyBanner';
import { mockStoreState } from '../test/mockStore';

describe('EmailVerifyBanner', () => {
  it('shows for a logged-in non-guest with unverified email', () => {
    mockStoreState({ token: 'tok', isGuest: false, emailVerified: false } as any);
    render(<EmailVerifyBanner />);
    expect(screen.getByTestId('email-verify-banner')).toBeInTheDocument();
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
});
