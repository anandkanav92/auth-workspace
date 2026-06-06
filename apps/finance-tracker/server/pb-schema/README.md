# PocketBase schema (finance-tracker)

The finance-tracker schema is defined as **PocketBase JS migration files** under
[`migrations/`](./migrations). These files are the single source of truth for
the 8 finance-tracker collections — there is no checked-in JSON snapshot.

PocketBase auto-applies any pending migrations from its `--migrationsDir` on
every boot (lexicographic order), so committing a migration is all it takes to
roll a schema change to every environment.

## Collections

| Collection          | Scope    | API rules |
|---------------------|----------|-----------|
| `accounts`          | per-user | list/view/create/update/delete = `@request.auth.id != "" && user = @request.auth.id` |
| `holdings`          | per-user | same (cost_basis / cost_currency are nullable — Revolut PDF has none) |
| `transactions`      | per-user | same |
| `imports`           | per-user | same (unique `(user, file_hash)` for idempotency) |
| `holdings_snapshot` | per-user | same |
| `symbol_profiles`   | shared   | list/view = `@request.auth.id != ""`; create/update/delete = locked (superuser only) |
| `price_cache`       | shared   | same as symbol_profiles |
| `fx_rates`          | shared   | same as symbol_profiles |

The built-in `users` auth collection also gains a unique-indexed `firebase_uid`
text field — the BFF auth middleware (Milestone 2) keys on it.

> **Why migrations, not the JSON-export-from-admin-UI workflow the plan
> originally sketched:** this deployment has no human at the admin UI to click
> "export". Migrations are committable, reviewable, and auto-applied — which is
> exactly what plan Task 1.3 asks for. They subsume Tasks 1.1 and 1.2.

### v0.23 JSVM gotcha (documented so the next change doesn't trip on it)

A `fields: [...]` array passed to the `new Collection({...})` constructor is
**silently dropped** by the v0.23 JSVM binding (only the system `id` field
survives). Always attach fields with `collection.fields.add(new TextField(...))`
*before* `app.save(collection)`. Rules that reference a relation field (e.g.
`user = @request.auth.id`) validate against the attached fields at save time, so
the `fields.add()` calls must precede setting the rules.

## Creating a new migration

Two options:

1. **Hand-write** a file in `migrations/` named `<unix-ts>_<description>.js`
   using the `migrate((app) => { ... }, (app) => { ... })` API (up + down).
   Match the patterns in the existing files. This is what we do here.

2. **Generate from a local instance.** Make the change in your local admin UI
   (`./.pb/pocketbase serve`), then `./.pb/pocketbase migrate collections` to
   emit a snapshot, and move the generated `*.js` into `migrations/`.

## Applying locally / running the isolation test

```bash
# from apps/finance-tracker/server
./.pb/pocketbase migrate up --migrationsDir=./pb-schema/migrations --dir=./.pb/pb_data

# Spike 5 isolation test (spawns its own throwaway PB, applies migrations):
pnpm test:integration
```

The local dev PocketBase binary lives in `.pb/` (gitignored — **never
committed**). Download v0.23.11 for your platform from the
[PocketBase releases](https://github.com/pocketbase/pocketbase/releases/tag/v0.23.11),
e.g. for macOS arm64:

```bash
mkdir -p .pb && \
curl -sL https://github.com/pocketbase/pocketbase/releases/download/v0.23.11/pocketbase_0.23.11_darwin_arm64.zip -o .pb/pb.zip && \
unzip -o .pb/pb.zip -d .pb && rm .pb/pb.zip && chmod +x .pb/pocketbase
```

## Applying in production

finance-tracker does **not** run its own PocketBase container — it shares the
workspace-wide PocketBase that `habit-tracker` already operates. Whichever
PocketBase container runs in prod must mount this `migrations/` directory into
its `--migrationsDir` (PocketBase's default is `<dataDir>/pb_migrations`):

```yaml
volumes:
  - ./pb-schema/migrations:/pb/pb_migrations:ro
```

On boot PocketBase applies any pending finance-tracker migrations alongside the
existing habit-tracker collections. Migrations are additive and idempotent
(each runs once, tracked in PocketBase's `_migrations` table), so they are safe
to leave mounted permanently.
