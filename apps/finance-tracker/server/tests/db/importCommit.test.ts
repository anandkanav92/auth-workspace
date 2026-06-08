import { describe, it, expect, vi, beforeEach } from 'vitest';

// commitHoldingsReplace builds a PocketBase batch and sends it. We mock pbAdmin
// so no real PB/env is required and we can assert on the batch lifecycle.
// In particular: when BOTH the existing holdings and the new positions are
// empty, the helper must NOT issue a batch (an empty createBatch().send() is a
// wasted/invalid round-trip), and must be a clean no-op.

const sendMock = vi.fn(async () => []);
const deleteMock = vi.fn();
const createMock = vi.fn();
const createBatchMock = vi.fn(() => ({
  collection: () => ({ delete: deleteMock, create: createMock }),
  send: sendMock,
}));

vi.mock('../../src/lib/pb', () => ({
  pbAdmin: vi.fn(async () => ({ createBatch: createBatchMock })),
}));

import { commitHoldingsReplace } from '../../src/db/importCommit';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('commitHoldingsReplace', () => {
  it('is a no-op (no batch sent) when both existing and new holdings are empty', async () => {
    await expect(
      commitHoldingsReplace({ existing: [], holdings: [] }),
    ).resolves.toBeUndefined();

    // No batch should be created or sent for a zero/zero replace.
    expect(createBatchMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends a batch when there is something to delete or create', async () => {
    await commitHoldingsReplace({
      existing: [{ id: 'h-old' }],
      holdings: [],
    });
    expect(createBatchMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith('h-old');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
