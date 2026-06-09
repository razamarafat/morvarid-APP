/**
 * Supabase Migration Applier
 * Applies SQL migration files to your Supabase database using the Management API.
 *
 * Usage: node scripts/apply-migration.js <path-to-sql-file>
 *
 * Requires SUPABASE_ACCESS_TOKEN environment variable or prompts for it.
 * Get your token from: https://supabase.com/dashboard/account/tokens
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

const SUPABASE_PROJECT_REF = 'bcdyieczslyynvvsfmmm';
const MANAGEMENT_API_URL = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`;

function getEnvVar(name) {
  // Try reading from .env file
  try {
    const envFile = readFileSync(resolve('.env'), 'utf8');
    const match = envFile.match(new RegExp(`^${name}=(.+)$`, 'm'));
    if (match) return match[1].trim();
  } catch {}
  return process.env[name] || null;
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const sqlFilePath = process.argv[2];
  if (!sqlFilePath) {
    console.error('❌ Usage: node scripts/apply-migration.js <path-to-sql-file>');
    console.error('   Example: node scripts/apply-migration.js supabase/migrations/20260609_add_factory_reset_rpc.sql');
    process.exit(1);
  }

  const fullPath = resolve(sqlFilePath);
  let sql;
  try {
    sql = readFileSync(fullPath, 'utf8');
  } catch {
    console.error(`❌ Cannot read file: ${fullPath}`);
    process.exit(1);
  }

  if (!sql.trim()) {
    console.error('❌ SQL file is empty');
    process.exit(1);
  }

  console.log(`📄 Migration file: ${sqlFilePath}`);
  console.log(`📏 SQL size: ${sql.length} bytes`);
  console.log(`🎯 Project ref: ${SUPABASE_PROJECT_REF}\n`);

  // Get access token
  let accessToken = getEnvVar('SUPABASE_ACCESS_TOKEN');
  if (!accessToken) {
    console.log('🔑 Supabase Personal Access Token required.');
    console.log('   Create one at: https://supabase.com/dashboard/account/tokens\n');
    accessToken = await prompt('Paste your Supabase Access Token: ');
    if (!accessToken) {
      console.error('❌ No token provided. Aborting.');
      process.exit(1);
    }
  }

  // Validate token format
  if (!accessToken.startsWith('sbp_')) {
    console.error('❌ Invalid token format. Token should start with "sbp_".');
    console.error('   Get a valid token from: https://supabase.com/dashboard/account/tokens');
    process.exit(1);
  }

  console.log('✅ Token validated\n');

  // Send the entire SQL as a single query (Management API handles multi-statement SQL)
  console.log('🚀 Executing migration...\n');

  try {
    const response = await fetch(MANAGEMENT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    const result = await response.text();
    let parsed;
    try { parsed = JSON.parse(result); } catch { parsed = { raw: result }; }

    if (response.ok) {
      console.log('✅ Migration applied successfully!');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        console.log(JSON.stringify(parsed, null, 2));
      }
    } else {
      const errorMsg = typeof parsed === 'object' ? (parsed.message || parsed.error || JSON.stringify(parsed)) : String(parsed);
      console.error('❌ Migration failed:', errorMsg);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Network error:', err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
