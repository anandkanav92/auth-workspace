/// <reference path="../pb_data/types.d.ts" />

// Relax transactions.quantity (required → optional), mirroring the earlier
// 1717000004 relaxation of transactions.price and holdings.quantity.
//
// PocketBase's NumberField `required` quirk treats 0 as "blank" and rejects it
// with "Failed to create record." (field detail: quantity "Cannot be blank").
// Dividend and fee ledger rows from the Trading 212 sync legitimately carry
// quantity 0, so the live sync failed to create them. 1717000004 fixed price
// and holdings.quantity but missed transactions.quantity — this completes it.
//
// Forward-only, additive migration (we never edit committed migration history;
// see pb-schema/README.md).

migrate(
  (app) => {
    const transactions = app.findCollectionByNameOrId('transactions');
    transactions.fields.getByName('quantity').required = false;
    app.save(transactions);
  },
  (app) => {
    const transactions = app.findCollectionByNameOrId('transactions');
    transactions.fields.getByName('quantity').required = true;
    app.save(transactions);
  },
);
