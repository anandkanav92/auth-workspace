// Per-user repo for the `imports` collection. See perUserRepo.ts for shared
// CRUD + user-scoping logic.
import { PerUserRepo } from './perUserRepo';
import type { Import, ImportCreate, ImportUpdate } from './schemas';

export class ImportsRepo extends PerUserRepo<Import, ImportCreate, ImportUpdate> {
  constructor() {
    super('imports');
  }

  /**
   * Find this user's prior import of the same file (by sha256) on a given
   * account, or null. Backs the upload-dedup 409: re-uploading an already-
   * imported statement to the same account is a no-op the route rejects.
   * Scoped by user (the admin token bypasses PB rules).
   */
  async findByHash(
    pbUserId: string,
    account: string,
    fileHash: string,
  ): Promise<Import | null> {
    const matches = await this.listWhere(pbUserId, {
      fragment: 'account = {:account} && file_hash = {:hash}',
      params: { account, hash: fileHash },
    });
    return matches[0] ?? null;
  }
}

export const importsRepo = new ImportsRepo();
