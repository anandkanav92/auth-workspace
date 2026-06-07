// Per-user repo for the `imports` collection. See perUserRepo.ts for shared
// CRUD + user-scoping logic.
import { PerUserRepo } from './perUserRepo';
import type { Import, ImportCreate, ImportUpdate } from './schemas';

export class ImportsRepo extends PerUserRepo<Import, ImportCreate, ImportUpdate> {
  constructor() {
    super('imports');
  }
}

export const importsRepo = new ImportsRepo();
