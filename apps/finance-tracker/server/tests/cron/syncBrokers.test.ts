import { describe, it, expect, vi } from 'vitest';
import {
  runSyncBrokersWith,
  type SyncBrokersDeps,
} from '../../src/cron/syncBrokers';
import type { BrokerConnection } from '../../src/db/schemas';

function connection(p: Partial<BrokerConnection> & { user: string }): BrokerConnection {
  return {
    id: `c-${p.user}`,
    created: '',
    updated: '',
    broker: 'trading212',
    api_key_enc: 'enc',
    ...p,
  };
}

function makeDeps(overrides: {
  connections?: BrokerConnection[];
  sync?: (userId: string) => Promise<unknown>;
}): SyncBrokersDeps & {
  listAllConnected: ReturnType<typeof vi.fn>;
  syncUser: ReturnType<typeof vi.fn>;
} {
  const listAllConnected = vi.fn(async () => overrides.connections ?? []);
  const syncUser = vi.fn(overrides.sync ?? (async () => ({ positions: 0, orders: 0, dividends: 0 })));
  return {
    connections: { listAllConnected },
    syncUser,
    listAllConnected,
    syncUser,
  } as never;
}

describe('runSyncBrokersWith', () => {
  it('syncs every connection and returns counts', async () => {
    const deps = makeDeps({
      connections: [connection({ user: 'u1' }), connection({ user: 'u2' })],
    });

    const res = await runSyncBrokersWith(deps);

    expect(res).toEqual({ users: 2, ok: 2, failed: 0 });
    expect(deps.syncUser).toHaveBeenCalledWith('u1');
    expect(deps.syncUser).toHaveBeenCalledWith('u2');
  });

  it('one user failing does NOT abort the batch — the other still syncs', async () => {
    const deps = makeDeps({
      connections: [connection({ user: 'boom' }), connection({ user: 'ok' })],
      sync: async (userId) => {
        if (userId === 'boom') throw new Error('t212 429 rate limited');
        return { positions: 1, orders: 0, dividends: 0 };
      },
    });

    const res = await runSyncBrokersWith(deps);

    expect(res).toEqual({ users: 2, ok: 1, failed: 1 });
    // Both users were attempted despite the first throwing.
    expect(deps.syncUser).toHaveBeenCalledTimes(2);
    expect(deps.syncUser).toHaveBeenCalledWith('boom');
    expect(deps.syncUser).toHaveBeenCalledWith('ok');
  });

  it('no connections → zero counts, no sync calls', async () => {
    const deps = makeDeps({ connections: [] });
    const res = await runSyncBrokersWith(deps);
    expect(res).toEqual({ users: 0, ok: 0, failed: 0 });
    expect(deps.syncUser).not.toHaveBeenCalled();
  });
});
