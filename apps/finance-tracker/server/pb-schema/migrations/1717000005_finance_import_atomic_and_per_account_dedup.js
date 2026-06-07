/// <reference path="../pb_data/types.d.ts" />

// Two related fixes to the M6 statement-import commit path. Forward-only,
// additive migration (we never edit committed migration history; see
// pb-schema/README.md).
//
// 1. ENABLE BATCH TRANSACTIONS (C1 — atomic commit prerequisite).
//    The import commit now runs delete-all + insert + imports-row as ONE
//    PocketBase batch transaction so a mid-insert failure can't wipe an
//    account (see src/db/importCommit.ts). PocketBase's batch endpoint is
//    DISABLED by default and returns 403 "Batch requests are not allowed." until
//    `batch.enabled` is on — so we turn it on here. This is a GLOBAL setting on
//    the shared workspace PocketBase; it only adds the (auth-gated) /api/batch
//    endpoint, which our admin-token BFF is the only client of.
//
// 2. PER-ACCOUNT IMPORT DEDUP INDEX (I1 — scope mismatch fix).
//    Runtime dedup is keyed (user, account, file_hash) — the SAME file is
//    deliberately allowed into two DIFFERENT accounts. But the original unique
//    index was (user, file_hash) — NO account. So the same file uploaded to a
//    second account passed the runtime 409, ran the destructive snapshot-replace
//    on that account, then the imports-row insert violated the unique index →
//    500 AFTER the wipe. Widening the index to (user, account, file_hash) makes
//    the DB constraint match the intended per-account dedup, so a second-account
//    import succeeds and re-importing to the SAME account is what's blocked.
//    (The atomic commit in fix 1 independently prevents the wipe even if a
//    constraint did fire — defence in depth.)

migrate(
  (app) => {
    // --- 1. enable batch transactions ------------------------------------
    const settings = app.settings();
    settings.batch.enabled = true;
    settings.batch.maxRequests = 1000; // a large statement = many positions
    settings.batch.timeout = 30; // seconds
    app.save(settings);

    // --- 2. swap the imports unique index to include `account` ------------
    const imports = app.findCollectionByNameOrId('imports');
    imports.indexes = [
      'CREATE UNIQUE INDEX `idx_imports_user_account_file_hash` ON `imports` (`user`, `account`, `file_hash`)',
    ];
    app.save(imports);
  },
  (app) => {
    // Reverse fix 2: restore the original (user, file_hash) unique index.
    const imports = app.findCollectionByNameOrId('imports');
    imports.indexes = [
      'CREATE UNIQUE INDEX `idx_imports_user_file_hash` ON `imports` (`user`, `file_hash`)',
    ];
    app.save(imports);

    // Reverse fix 1: turn batch transactions back off.
    const settings = app.settings();
    settings.batch.enabled = false;
    app.save(settings);
  },
);
