/// <reference path="../pb_data/types.d.ts" />

// Task 2.2 — broker-sync idempotency key on `transactions`.
//
// The Trading 212 API sync re-pulls the full order/dividend ledger on every
// run, so each synced row needs a stable identity to upsert against rather than
// re-inserting duplicates. We add a nullable `external_id` (the broker's ledger
// event id) plus a PARTIAL unique index on (user, source, external_id).
//
// Why PARTIAL: manually-entered transactions have no broker id, so they store
// an empty `external_id`. A plain unique index would collide on the *second*
// manual row (every empty-string would equal the first). The `WHERE
// external_id != ''` predicate scopes uniqueness to synced rows only, leaving
// manual rows unconstrained. (PocketBase stores unset TextFields as '' — never
// NULL — so the predicate keys off empty string, mirroring listStale's
// `last_refreshed_at = ""` convention.)
//
// Forward-only/additive (we never edit committed migration history; see
// pb-schema/README.md). The existing
// `idx_transactions_user_account_occurred` non-unique index is preserved — we
// append the new index rather than replacing the array.

migrate(
  (app) => {
    const transactions = app.findCollectionByNameOrId('transactions');

    // Nullable broker ledger event id (empty string for manual rows).
    transactions.fields.add(
      new TextField({ name: 'external_id', required: false, max: 128 }),
    );

    // Append the partial unique index, keeping the existing occurred-at index.
    transactions.indexes = [
      ...transactions.indexes,
      "CREATE UNIQUE INDEX `idx_tx_user_source_extid` ON `transactions` (`user`, `source`, `external_id`) WHERE `external_id` != ''",
    ];

    app.save(transactions);
  },
  (app) => {
    const transactions = app.findCollectionByNameOrId('transactions');
    // Drop the partial unique index, then the field.
    transactions.indexes = transactions.indexes.filter(
      (sql) => !sql.includes('idx_tx_user_source_extid'),
    );
    const extId = transactions.fields.find((f) => f.name === 'external_id');
    if (extId) transactions.fields.removeById(extId.id);
    app.save(transactions);
  },
);
