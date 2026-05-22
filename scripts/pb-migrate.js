#!/usr/bin/env node
/**
 * PocketBase schema migration for completion notes + vacation mode.
 *
 * Usage:
 *   PB_URL=http://localhost:8090 PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=secret node scripts/pb-migrate.js
 *
 * What it does:
 *   1. Adds `effort` (number) and `notes` (text) fields to the `completions` collection
 *   2. Creates a `user_settings` collection with `userId`, `vacationMode`, `vacationStart`
 */

const PB_URL = process.env.PB_URL || "http://localhost:8090";
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars");
  process.exit(1);
}

async function main() {
  // Authenticate as admin
  const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
  });
  if (!authRes.ok) throw new Error(`Auth failed: ${await authRes.text()}`);
  const { token } = await authRes.json();
  const headers = { "Content-Type": "application/json", Authorization: token };

  // 1. Get completions collection schema
  const colRes = await fetch(`${PB_URL}/api/collections/completions`, { headers });
  if (!colRes.ok) throw new Error(`Failed to get completions collection: ${await colRes.text()}`);
  const completions = await colRes.json();

  const existingNames = completions.schema.map(f => f.name);

  if (!existingNames.includes("effort")) {
    completions.schema.push({
      name: "effort",
      type: "number",
      required: false,
      options: { min: 0, max: 10 },
    });
    console.log("Adding 'effort' field to completions");
  }

  if (!existingNames.includes("notes")) {
    completions.schema.push({
      name: "notes",
      type: "text",
      required: false,
      options: { maxSize: 2000 },
    });
    console.log("Adding 'notes' field to completions");
  }

  if (!existingNames.includes("effort") || !existingNames.includes("notes")) {
    const updateRes = await fetch(`${PB_URL}/api/collections/completions`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ schema: completions.schema }),
    });
    if (!updateRes.ok) throw new Error(`Failed to update completions: ${await updateRes.text()}`);
    console.log("completions collection updated");
  } else {
    console.log("completions collection already has effort + notes fields");
  }

  // 2. Create user_settings collection (if it doesn't exist)
  const settingsCheck = await fetch(`${PB_URL}/api/collections/user_settings`, { headers });
  if (settingsCheck.ok) {
    console.log("user_settings collection already exists");
  } else {
    const createRes = await fetch(`${PB_URL}/api/collections`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "user_settings",
        type: "base",
        schema: [
          { name: "userId", type: "text", required: true, options: {} },
          { name: "vacationMode", type: "bool", required: false, options: {} },
          { name: "vacationStart", type: "text", required: false, options: {} },
        ],
        indexes: ["CREATE INDEX idx_user_settings_userId ON user_settings (userId)"],
        listRule: 'userId = @request.auth.id || @request.auth.id != ""',
        viewRule: 'userId = @request.auth.id || @request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: 'userId = @request.auth.id',
        deleteRule: 'userId = @request.auth.id',
      }),
    });
    if (!createRes.ok) throw new Error(`Failed to create user_settings: ${await createRes.text()}`);
    console.log("user_settings collection created");
  }

  console.log("Migration complete!");
}

main().catch(err => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
