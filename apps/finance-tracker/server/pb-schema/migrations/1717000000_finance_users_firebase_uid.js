/// <reference path="../pb_data/types.d.ts" />

// Adds an indexed `firebase_uid` text field to the built-in `users` auth
// collection. The BFF auth middleware (Milestone 2) looks users up by this
// field (decoded Firebase UID -> PocketBase user id), so it must be unique +
// indexed. PocketBase's own `id` stays auto-generated (design §13 decision).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    // Idempotency: only add the field if it isn't already present.
    if (!users.fields.find((f) => f.name === 'firebase_uid')) {
      users.fields.add(
        new TextField({
          name: 'firebase_uid',
          required: false, // existing users may predate Firebase linkage
          max: 128,
        }),
      );
    }

    // Unique index so the upsert-by-uid lookup is fast and collision-free.
    const idx =
      'CREATE UNIQUE INDEX `idx_users_firebase_uid` ON `users` (`firebase_uid`) WHERE `firebase_uid` != ""';
    if (!users.indexes.includes(idx)) {
      users.indexes.push(idx);
    }

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.indexes = users.indexes.filter(
      (i) => !i.includes('idx_users_firebase_uid'),
    );
    const field = users.fields.find((f) => f.name === 'firebase_uid');
    if (field) {
      users.fields.removeById(field.id);
    }
    app.save(users);
  },
);
