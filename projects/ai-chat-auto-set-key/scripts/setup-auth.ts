#!/usr/bin/env tsx
/**
 * Setup script: create the initial user credentials stored in Cloudflare KV.
 *
 * Usage:
 *   pnpm setup-auth
 *
 * This writes the user record directly to KV via the Wrangler CLI.
 * Run this ONCE before deploying.
 */

import { execSync } from "child_process";
import { createInterface } from "readline/promises";
import { randomUUID } from "crypto";

// ── PBKDF2 password hash (Node.js crypto) ─────────────────────────────────────
import { createHash, randomBytes, pbkdf2Sync } from "crypto";

function hashPassword(password: string, salt?: string) {
  const saltBuf = salt ? Buffer.from(salt, "base64url") : randomBytes(16);
  const derived = pbkdf2Sync(password, saltBuf, 100000, 32, "sha256");
  return {
    hash: derived.toString("base64url"),
    salt: saltBuf.toString("base64url"),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n=== GitHub KV Chat — Initial Auth Setup ===\n");

  const username = await rl.question("Enter username: ");
  const password = await rl.question("Enter password: ");

  if (!username || !password) {
    console.error("Username and password are required.");
    process.exit(1);
  }

  const { hash, salt } = hashPassword(password);
  const userId = randomUUID();

  const user = {
    username,
    passwordHash: hash,
    passwordSalt: salt,
    userId,
    createdAt: new Date().toISOString(),
  };

  const json = JSON.stringify(user);

  console.log("\nWriting user to Cloudflare KV (local preview)...");

  try {
    execSync(
      `cd packages/worker && pnpm wrangler kv key put auth:user '${json.replace(/'/g, "'\\''")}' --preview`,
      { stdio: "inherit" }
    );
    console.log("\n✅ User created in KV (preview). Deploy and run again with --remote for production:");
    console.log(
      `   cd packages/worker && pnpm wrangler kv key put auth:user '${json.replace(/'/g, "'\\''")}' --remote`
    );
  } catch (e) {
    console.error("Failed to write to KV. Make sure wrangler is configured and KV namespace exists.");
    console.error("Raw user JSON to manually set:");
    console.log("\n" + json);
  }

  rl.close();
}

main().catch(console.error);
