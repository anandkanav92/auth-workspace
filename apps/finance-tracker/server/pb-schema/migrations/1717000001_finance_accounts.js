/// <reference path="../pb_data/types.d.ts" />

// Per-user collection: `accounts` (design §4).
// One row per broker/wallet. Created first because holdings, transactions,
// imports and holdings_snapshot all hold a relation to it.
//
// Privacy rules (the core multi-tenant guarantee — Spike 5): every operation
// requires an authenticated user AND that the row's `user` equals the caller.
//
// NOTE: the v0.23 JSVM binding drops a `fields: [...]` array passed to the
// Collection constructor, so fields are attached via `collection.fields.add()`
// before the rules (which reference `user`) are validated on save.
const PER_USER_RULE = '@request.auth.id != "" && user = @request.auth.id';

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    const accounts = new Collection({ type: 'base', name: 'accounts' });

    accounts.fields.add(
      new RelationField({
        name: 'user',
        required: true,
        maxSelect: 1,
        collectionId: users.id,
        cascadeDelete: true,
      }),
    );
    accounts.fields.add(
      new SelectField({
        name: 'source',
        required: true,
        maxSelect: 1,
        values: ['revolut', 'trading212', 'manual'],
      }),
    );
    accounts.fields.add(new TextField({ name: 'label', required: true, max: 200 }));
    accounts.fields.add(new TextField({ name: 'currency', required: false, max: 8 }));

    accounts.indexes = ['CREATE INDEX `idx_accounts_user` ON `accounts` (`user`)'];

    accounts.listRule = PER_USER_RULE;
    accounts.viewRule = PER_USER_RULE;
    accounts.createRule = PER_USER_RULE;
    accounts.updateRule = PER_USER_RULE;
    accounts.deleteRule = PER_USER_RULE;

    app.save(accounts);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('accounts'));
  },
);
