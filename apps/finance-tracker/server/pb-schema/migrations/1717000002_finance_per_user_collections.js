/// <reference path="../pb_data/types.d.ts" />

// Per-user collections that depend on `accounts` (and `holdings`):
//   holdings, transactions, imports, holdings_snapshot   (design §4)
//
// Created in dependency order: holdings first (transactions relate to it),
// then transactions, imports, holdings_snapshot. All carry the same per-user
// privacy rule as accounts.
//
// NOTE: the v0.23 JSVM binding drops a `fields: [...]` array passed to the
// Collection constructor, so fields are attached via `collection.fields.add()`.
const PER_USER_RULE = '@request.auth.id != "" && user = @request.auth.id';

function applyPerUserRules(collection) {
  collection.listRule = PER_USER_RULE;
  collection.viewRule = PER_USER_RULE;
  collection.createRule = PER_USER_RULE;
  collection.updateRule = PER_USER_RULE;
  collection.deleteRule = PER_USER_RULE;
}

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const accounts = app.findCollectionByNameOrId('accounts');

    const userRelation = () =>
      new RelationField({
        name: 'user',
        required: true,
        maxSelect: 1,
        collectionId: users.id,
        cascadeDelete: true,
      });

    const accountRelation = () =>
      new RelationField({
        name: 'account',
        required: true,
        maxSelect: 1,
        collectionId: accounts.id,
        cascadeDelete: true, // deleting an account removes its child rows
      });

    // --- holdings ---------------------------------------------------------
    // Current positions. cost_basis + cost_currency are NULLABLE: the Revolut
    // PDF has no cost basis (spike 2), so those positions import with null.
    const holdings = new Collection({ type: 'base', name: 'holdings' });
    holdings.fields.add(userRelation());
    holdings.fields.add(accountRelation());
    holdings.fields.add(new TextField({ name: 'ticker', required: true, max: 32 }));
    holdings.fields.add(new TextField({ name: 'isin', required: false, max: 16 }));
    holdings.fields.add(new NumberField({ name: 'quantity', required: true }));
    holdings.fields.add(new NumberField({ name: 'cost_basis', required: false })); // nullable
    holdings.fields.add(new TextField({ name: 'cost_currency', required: false, max: 8 })); // nullable
    holdings.fields.add(
      new SelectField({
        name: 'source',
        required: true,
        maxSelect: 1,
        values: ['revolut', 'trading212', 'manual'],
      }),
    );
    holdings.fields.add(new TextField({ name: 'notes', required: false, max: 2000 }));
    holdings.indexes = [
      // One row per (user, account, ticker) — drives upsert on import/add.
      'CREATE UNIQUE INDEX `idx_holdings_user_account_ticker` ON `holdings` (`user`, `account`, `ticker`)',
    ];
    applyPerUserRules(holdings);
    app.save(holdings);

    const holdingsSaved = app.findCollectionByNameOrId('holdings');

    // --- transactions -----------------------------------------------------
    // Append-only audit log. `holding` is nullable (orphan dividends/fees).
    const transactions = new Collection({ type: 'base', name: 'transactions' });
    transactions.fields.add(userRelation());
    transactions.fields.add(accountRelation());
    transactions.fields.add(
      new RelationField({
        name: 'holding',
        required: false, // nullable: orphan dividends/fees
        maxSelect: 1,
        collectionId: holdingsSaved.id,
        cascadeDelete: false,
      }),
    );
    transactions.fields.add(
      new SelectField({
        name: 'type',
        required: true,
        maxSelect: 1,
        values: ['buy', 'sell', 'dividend', 'fee', 'adjustment', 'import'],
      }),
    );
    transactions.fields.add(new TextField({ name: 'ticker', required: true, max: 32 }));
    transactions.fields.add(new NumberField({ name: 'quantity', required: true }));
    transactions.fields.add(new NumberField({ name: 'price', required: true })); // per share
    transactions.fields.add(new TextField({ name: 'currency', required: true, max: 8 }));
    transactions.fields.add(new NumberField({ name: 'fee', required: false }));
    transactions.fields.add(new DateField({ name: 'occurred_at', required: true }));
    transactions.fields.add(
      new SelectField({
        name: 'source',
        required: true,
        maxSelect: 1,
        values: ['revolut', 'trading212', 'manual'],
      }),
    );
    transactions.fields.add(new TextField({ name: 'notes', required: false, max: 2000 }));
    transactions.indexes = [
      'CREATE INDEX `idx_transactions_user_account_occurred` ON `transactions` (`user`, `account`, `occurred_at`)',
    ];
    applyPerUserRules(transactions);
    app.save(transactions);

    // --- imports ----------------------------------------------------------
    // Idempotency + audit of statement uploads. (user, file_hash) unique
    // blocks re-imports of the same file.
    const imports = new Collection({ type: 'base', name: 'imports' });
    imports.fields.add(userRelation());
    imports.fields.add(accountRelation());
    imports.fields.add(
      new SelectField({
        name: 'source',
        required: true,
        maxSelect: 1,
        values: ['revolut', 'trading212'],
      }),
    );
    imports.fields.add(new TextField({ name: 'filename', required: true, max: 500 }));
    imports.fields.add(new TextField({ name: 'file_hash', required: true, max: 128 })); // sha256
    imports.fields.add(new NumberField({ name: 'row_count', required: false }));
    imports.fields.add(
      new SelectField({
        name: 'status',
        required: true,
        maxSelect: 1,
        values: ['success', 'partial', 'failed'],
      }),
    );
    imports.fields.add(new TextField({ name: 'error_log', required: false, max: 10000 }));
    imports.indexes = [
      'CREATE UNIQUE INDEX `idx_imports_user_file_hash` ON `imports` (`user`, `file_hash`)',
    ];
    applyPerUserRules(imports);
    app.save(imports);

    // --- holdings_snapshot ------------------------------------------------
    // Nightly point-in-time copy of every holding; powers Phase 2 time-series.
    const holdingsSnapshot = new Collection({ type: 'base', name: 'holdings_snapshot' });
    holdingsSnapshot.fields.add(userRelation());
    holdingsSnapshot.fields.add(accountRelation());
    holdingsSnapshot.fields.add(new TextField({ name: 'ticker', required: true, max: 32 }));
    holdingsSnapshot.fields.add(new NumberField({ name: 'quantity', required: true }));
    holdingsSnapshot.fields.add(new NumberField({ name: 'cost_basis', required: false }));
    holdingsSnapshot.fields.add(new NumberField({ name: 'eur_value', required: true }));
    holdingsSnapshot.fields.add(new DateField({ name: 'date', required: true })); // YYYY-MM-DD
    holdingsSnapshot.indexes = [
      'CREATE UNIQUE INDEX `idx_snapshot_user_account_ticker_date` ON `holdings_snapshot` (`user`, `account`, `ticker`, `date`)',
    ];
    applyPerUserRules(holdingsSnapshot);
    app.save(holdingsSnapshot);
  },
  (app) => {
    // Reverse dependency order on rollback.
    for (const name of ['holdings_snapshot', 'imports', 'transactions', 'holdings']) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {
        // already gone — ignore
      }
    }
  },
);
