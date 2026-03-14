import { describe, it, expect } from 'vitest';
import { validateSendRequest } from '../../rooms/services/FriendsService.js';

describe('validateSendRequest', () => {
  it('rejects self-add', () => {
    expect(validateSendRequest('A', 'A', false, false, false)).toBe('FRIEND_SELF');
  });
  it('rejects if already friends', () => {
    expect(validateSendRequest('A', 'B', true, false, false)).toBe('ALREADY_FRIENDS');
  });
  it('rejects if already requested', () => {
    expect(validateSendRequest('A', 'B', false, true, false)).toBe('ALREADY_REQUESTED');
  });
  it('rejects if blocked', () => {
    expect(validateSendRequest('A', 'B', false, false, true)).toBe('BLOCKED');
  });
  it('returns null if valid', () => {
    expect(validateSendRequest('A', 'B', false, false, false)).toBeNull();
  });
});
