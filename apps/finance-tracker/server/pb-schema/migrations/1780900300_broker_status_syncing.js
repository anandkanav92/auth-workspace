/// <reference path="../pb_data/types.d.ts" />

// Add a third `broker_connections.status` value: 'syncing'.
//
// The "Sync now" flow is fire-and-forget (POST returns 202, the sync runs in the
// background). The UI needs a SERVER-AUTHORITATIVE signal that a sync is in
// progress so it can show a disabled "Syncing…" button that survives reloads and
// concurrent clients — and the route uses it to reject a concurrent sync (409).
// The lifecycle becomes: syncing → connected | error.
//
// Mirrors the field-modify pattern of 1780900200 (findCollectionByNameOrId +
// getByName + set .values + app.save). Forward-only / additive — we never edit
// committed migration history (see pb-schema/README.md). Reversible: down strips
// 'syncing' back out (safe only if no row currently holds it).

migrate(
  (app) => {
    const broker = app.findCollectionByNameOrId('broker_connections');
    broker.fields.getByName('status').values = ['connected', 'error', 'syncing'];
    app.save(broker);
  },
  (app) => {
    const broker = app.findCollectionByNameOrId('broker_connections');
    broker.fields.getByName('status').values = ['connected', 'error'];
    app.save(broker);
  },
);
