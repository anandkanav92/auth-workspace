// Generic base for the three shared market-data repos (symbol_profiles,
// price_cache, fx_rates). Unlike the per-user repos these are read-all by any
// authed user and written ONLY by the BFF service account — so reads/writes
// here always go through pbAdmin() (an admin token) and carry no user scoping.
//
// Each shared collection has a single natural unique key (ticker / date), so
// the repo exposes:
//   - upsert(data): create, or update the existing row matched by that key
//   - get(key):     fetch the row by its natural key (null if absent)
//   - list():       every row
//
// upsert uses PocketBase's PARAMETERIZED filter binding (pb.filter(...)) to
// match by key — never string interpolation — so a hostile key value cannot
// break out of the filter.

import type PocketBase from 'pocketbase';
import { pbAdmin } from '../lib/pb';

export class SharedRepo<
  TRecord extends { id: string },
  TCreate extends Record<string, unknown>,
> {
  /**
   * @param collection PocketBase collection name.
   * @param keyField   the natural unique key field (e.g. 'ticker', 'date').
   */
  constructor(
    protected readonly collection: string,
    protected readonly keyField: string,
  ) {}

  protected async pb(): Promise<PocketBase> {
    return pbAdmin();
  }

  /** Fetch the single row whose key field equals `key`, or null if absent. */
  async get(key: string): Promise<TRecord | null> {
    const pb = await this.pb();
    const filter = pb.filter(`${this.keyField} = {:key}`, { key });
    return pb
      .collection(this.collection)
      .getFirstListItem<TRecord>(filter)
      .catch(() => null);
  }

  /** Every row in the collection. */
  async list(): Promise<TRecord[]> {
    const pb = await this.pb();
    return pb.collection(this.collection).getFullList<TRecord>();
  }

  /**
   * Create the row, or update the existing one matched by the natural key.
   * The key value is read from `data[keyField]`.
   */
  async upsert(data: TCreate): Promise<TRecord> {
    const key = data[this.keyField];
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error(
        `${this.collection}.upsert: missing/invalid key field "${this.keyField}"`,
      );
    }
    const pb = await this.pb();
    const filter = pb.filter(`${this.keyField} = {:key}`, { key });
    const existing = await pb
      .collection(this.collection)
      .getFirstListItem<TRecord>(filter)
      .catch(() => null);

    if (existing) {
      return pb.collection(this.collection).update<TRecord>(existing.id, data);
    }
    return pb.collection(this.collection).create<TRecord>(data);
  }
}
