import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackButton } from '../components/FeedbackButton';
import { mockStoreState } from '../test/mockStore';

describe('FeedbackButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('is hidden for guests', () => {
    mockStoreState({ token: 'tok', isGuest: true } as any);
    render(<FeedbackButton />);
    expect(screen.queryByTestId('feedback-fab')).toBeNull();
  });

  it('is hidden when not logged in', () => {
    mockStoreState({ token: null, isGuest: false } as any);
    render(<FeedbackButton />);
    expect(screen.queryByTestId('feedback-fab')).toBeNull();
  });

  it('shows for a logged-in non-guest and opens the modal (send disabled while empty)', async () => {
    mockStoreState({ token: 'tok', isGuest: false } as any);
    render(<FeedbackButton />);
    const fab = screen.getByTestId('feedback-fab');
    expect(fab).toBeInTheDocument();
    await userEvent.click(fab);
    expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-send')).toBeDisabled();
  });

  it('submits with auth header + payload and closes', async () => {
    mockStoreState({ token: 'tok123', isGuest: false } as any);
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 1 }) } as Response);
    render(<FeedbackButton />);
    await userEvent.click(screen.getByTestId('feedback-fab'));
    await userEvent.selectOptions(screen.getByTestId('feedback-category'), 'bug');
    await userEvent.type(screen.getByTestId('feedback-message'), 'Es ruckelt');
    await userEvent.click(screen.getByTestId('feedback-send'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/api/feedback');
    expect(opts.method).toBe('POST');
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
    expect(JSON.parse(opts.body as string)).toEqual({ category: 'bug', message: 'Es ruckelt' });
    await waitFor(() => expect(screen.queryByTestId('feedback-modal')).toBeNull());
  });
});
