// Per-user repo for the `holdings_snapshot` collection. See perUserRepo.ts for
// shared CRUD + user-scoping logic.
import { PerUserRepo } from './perUserRepo';
import type {
  HoldingsSnapshot,
  HoldingsSnapshotCreate,
  HoldingsSnapshotUpdate,
} from './schemas';

export class HoldingsSnapshotRepo extends PerUserRepo<
  HoldingsSnapshot,
  HoldingsSnapshotCreate,
  HoldingsSnapshotUpdate
> {
  constructor() {
    super('holdings_snapshot');
  }
}

export const holdingsSnapshotRepo = new HoldingsSnapshotRepo();
