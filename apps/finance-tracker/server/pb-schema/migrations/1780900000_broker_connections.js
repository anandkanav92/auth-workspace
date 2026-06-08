/// <reference path="../pb_data/types.d.ts" />

// Per-user collection: `broker_connections` (design §4-5, plan Task 1.1).
// One row per (user, broker) holding the AES-256-GCM-encrypted read-only API
// key plus sync bookkeeping. Drives the automated Trading 212 API sync.
//
// Privacy rules (the core multi-tenant guarantee — Spike 5): every operation
// requires an authenticated user AND that the row's `user` equals the caller —
// identical to the other per-user collections (accounts, holdings, ...).
//
// NOTE: the v0.23 JSVM binding drops a `fields: [...]` array passed to the
// Collection constructor, so fields are attached via `collection.fields.add()`
// before the rules (which reference `user`) are validated on save.
const PER_USER_RULE = '@request.auth.id != "" && user = @request.auth.id';

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    const brokerConnections = new Collection({
      type: 'base',
      name: 'broker_connections',
    });

    brokerConnections.fields.add(
      new RelationField({
        name: 'user',
        required: true,
        maxSelect: 1,
        collectionId: users.id,
        cascadeDelete: true,
      }),
    );
    brokerConnections.fields.add(
      new SelectField({
        name: 'broker',
        required: true,
        maxSelect: 1,
        values: ['trading212'],
      }),
    );
    // AES-256-GCM-encrypted read-only API key (base64(iv).base64(tag).base64(ct)).
    brokerConnections.fields.add(
      new TextField({ name: 'api_key_enc', required: true, max: 4000 }),
    );
    brokerConnections.fields.add(
      new TextField({ name: 't212_account_id', required: false, max: 64 }),
    );
    brokerConnections.fields.add(
      new TextField({ name: 'currency', required: false, max: 8 }),
    );
    brokerConnections.fields.add(
      new SelectField({
        name: 'status',
        required: false,
        maxSelect: 1,
        values: ['connected', 'error'],
      }),
    );
    brokerConnections.fields.add(
      new DateField({ name: 'last_synced_at', required: false }),
    );
    brokerConnections.fields.add(
      new TextField({ name: 'last_error', required: false, max: 2000 }),
    );

    brokerConnections.indexes = [
      // One connection per (user, broker) — drives the upsert on connect.
      'CREATE UNIQUE INDEX `idx_broker_connections_user_broker` ON `broker_connections` (`user`, `broker`)',
    ];

    brokerConnections.listRule = PER_USER_RULE;
    brokerConnections.viewRule = PER_USER_RULE;
    brokerConnections.createRule = PER_USER_RULE;
    brokerConnections.updateRule = PER_USER_RULE;
    brokerConnections.deleteRule = PER_USER_RULE;

    app.save(brokerConnections);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('broker_connections'));
  },
);
