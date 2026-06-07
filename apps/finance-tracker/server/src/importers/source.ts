// The broker sources that have a statement importer. Matches the
// statementSourceEnum in db/schemas.ts (imports.source / account.source minus
// the manual source, which has no statement). Kept in its own tiny module so the
// importer layer doesn't pull in the whole schemas barrel.
export type StatementSource = 'trading212' | 'revolut';
