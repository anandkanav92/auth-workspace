/// <reference path="../pb_data/types.d.ts" />

// Two related relaxations driven by PocketBase's NumberField `required` quirk —
// it treats 0 as "blank" and rejects it with "Cannot be blank":
//
// 1. transactions.price  (required → optional)
//    Not every transaction is a market trade. An `adjustment` (manual qty/cost
//    correction) and a zero-cost import legitimately have no per-share price.
//    Optional is the honest fix — adjustments carry no price, not a fake sentinel.
//
// 2. holdings.quantity   (required → optional)
//    A fully-sold position is represented as quantity 0 (the design's "closed"
//    marker — no closed_at field) and filtered out of GET /api/holdings. With
//    quantity required, PocketBase rejected the 0 update, so a full sell could
//    never close a position. Relaxing it lets 0 persist. The Zod read/write
//    schemas keep quantity as a number, so callers still always supply it.
//
// Forward-only, additive migration (we never edit committed migration history;
// see pb-schema/README.md).

migrate(
  (app) => {
    const transactions = app.findCollectionByNameOrId('transactions');
    transactions.fields.getByName('price').required = false;
    app.save(transactions);

    const holdings = app.findCollectionByNameOrId('holdings');
    holdings.fields.getByName('quantity').required = false;
    app.save(holdings);
  },
  (app) => {
    const transactions = app.findCollectionByNameOrId('transactions');
    transactions.fields.getByName('price').required = true;
    app.save(transactions);

    const holdings = app.findCollectionByNameOrId('holdings');
    holdings.fields.getByName('quantity').required = true;
    app.save(holdings);
  },
);
