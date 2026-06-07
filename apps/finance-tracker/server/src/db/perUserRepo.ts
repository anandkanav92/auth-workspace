// Generic base for the five per-user PocketBase repos (accounts, holdings,
// transactions, imports, holdings_snapshot). They share an identical CRUD
// surface that only varies by collection name + record types, so the shared
// logic lives here (Template Method) and each concrete repo just binds the
// collection name and its Zod-derived types.
//
// SECURITY (design §9, plan convention): even though PocketBase per-user rules
// enforce `user = @request.auth.id`, these repos use an ADMIN token whose
// requests bypass collection rules. We therefore re-assert isolation in this
// layer: every list query is scoped to `user = {:userId}` using PocketBase's
// PARAMETERIZED filter binding (pb.filter(...)) — never string interpolation —
// so a hostile pbUserId value cannot break out of the filter.

import type PocketBase from 'pocketbase';
import { pbAdmin } from '../lib/pb';

export class PerUserRepo<
  TRecord,
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
> {
  constructor(protected readonly collection: string) {}

  /** Obtain a fresh admin client per call (never shares an authStore). */
  protected async pb(): Promise<PocketBase> {
    return pbAdmin();
  }

  /** List every row owned by `pbUserId`. Defensively scoped by user. */
  async list(pbUserId: string): Promise<TRecord[]> {
    const pb = await this.pb();
    const filter = pb.filter('user = {:userId}', { userId: pbUserId });
    return pb.collection(this.collection).getFullList<TRecord>({ filter });
  }

  /** Fetch a single row by id. */
  async get(id: string): Promise<TRecord> {
    const pb = await this.pb();
    return pb.collection(this.collection).getOne<TRecord>(id);
  }

  /** Create a row. The caller is responsible for setting `user` on `data`. */
  async create(data: TCreate): Promise<TRecord> {
    const pb = await this.pb();
    return pb.collection(this.collection).create<TRecord>(data);
  }

  /** Patch a row by id. */
  async update(id: string, patch: TUpdate): Promise<TRecord> {
    const pb = await this.pb();
    return pb.collection(this.collection).update<TRecord>(id, patch);
  }

  /** Delete a row by id. */
  async delete(id: string): Promise<boolean> {
    const pb = await this.pb();
    return pb.collection(this.collection).delete(id);
  }
}
