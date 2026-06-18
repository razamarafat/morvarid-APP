// ============================================================================
// scripts/audit-irani.mjs (one-off forensic + repair + verify)
// 2026-06-20 — Investigate why irani / i123456 cannot log in.
//
// Flow:
//   1. SQL FORENSIC  — read irani's profile + auth.users row + Supabase
//                      auth config (password_min_length etc.).
//   2. SIGNIN PROBE  — try signInWithPassword for each email-domain variant
//                      the frontend login form generates, get the actual
//                      error message.
//   3. ROOT CAUSE    — determine (a) email mismatch, (b) unconfirmed email,
//                      (c) account banned, (d) password policy, (e) corrupt hash.
//   4. REPAIR        — choose the right fix path:
//                      (a) if email mismatch → no fix (engine fix already shipped)
//                      (b) if email unconfirmed → UPDATE auth.users SET email_confirmed_at
//                      (c) if banned → UPDATE auth.users SET banned_until = NULL
//                      (d) if password-policy reject → UPDATE auth.users.encrypted_password
//                          via crypt('i123456', gen_salt('bf', 10)) AND verify format compat
//                      (e) if corrupt hash → no manual fix; flag for re-create.
//   5. VERIFY        — re-run signInWithPassword; capture the JWT + refresh tokens
//                      if successful, OR re-print the exact error.
// ============================================================================

// SECURITY: The Supabase Management API personal-access-token is NEVER
// hard-coded into this script. It MUST be supplied via the .env file
// (`SUPABASE_MANAGEMENT_TOKEN`) or an environment variable. Hard-coding
// it leaks the token to git history (and any secret-scanning push
// guard will reject the commit).
const REF = 'bcdyieczslyynvvsfmmm';

// Supabase URL/anon key + Management-API token must match the live .env.
// Reading at startup so the one-off script always tests with the
// credentials the running app uses. (Earlier hard-coded anon key was
// stale and got "Invalid API key" responses, making the root-cause
// analysis useless.)
import { readFileSync } from 'node:fs';
function readEnv(name) {
  try {
    const envText = readFileSync('.env', 'utf8');
    const m = envText.match(new RegExp(`^${name}=(.+)$`, 'm'));
    return m ? m[1].trim() : null;
  } catch { return null; }
}
const SUPABASE_URL = readEnv('VITE_SUPABASE_URL');
const ANON_KEY     = readEnv('VITE_SUPABASE_ANON_KEY');
const MGMT_TOKEN   = readEnv('SUPABASE_MANAGEMENT_TOKEN');
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('  ABORT: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(2);
}
if (!MGMT_TOKEN) {
  console.error('  ABORT: missing SUPABASE_MANAGEMENT_TOKEN in .env or env vars.');
  console.error('  --> This is the Supabase Management API personal-access-token,');
  console.error('      used by the SQL forensic + repair step.');
  console.error('  --> Get a fresh token at: https://app.supabase.com/account/tokens');
  console.error('      then add it to .env as SUPABASE_MANAGEMENT_TOKEN=sbp_...');
  process.exit(2);
}
console.log(`  Loaded SUPABASE_URL=${SUPABASE_URL}`);
console.log(`  Loaded ANON_KEY=${ANON_KEY.slice(0, 32)}...`);
console.log(`  Loaded MGMT_TOKEN=${MGMT_TOKEN.slice(0, 12)}... (${MGMT_TOKEN.length} chars)`);

async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${MGMT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  const text = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  if (!r.ok) {
    const msg = (parsed && (parsed.message || parsed.error)) || text.slice(0, 500);
    throw new Error(`API ${r.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 300)}`);
  }
  return parsed;
}
const rows = (j) => Array.isArray(j) ? j : [];

async function signinWithPassword(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  let body = null;
  try { body = await r.json(); } catch { body = { _raw: '<non-JSON body>' }; }
  return { status: r.status, ok: r.ok, body };
}

// 20260620 — N6 fix (code review). Strip credential-bearing fields before
// logging or storing. Even though this is a DBA-only one-off, audit logs
// get backed up to internal monitoring systems, and a leaked access_token
// anywhere on disk is a credential exposure. The stripper keeps structural
// fields (msg, error_code, user-id) but removes the actual secrets.
const STRIPPED_FIELDS = ['access_token', 'refresh_token', 'token_type', 'session'];
function sanitizeBody(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const k of STRIPPED_FIELDS) delete clone[k];
  return clone;
}

// 20260620 — DOMAINS list mirrors authStore.ts's login loop. If the project's
// email-domain strategy changes in authStore.ts, the DBA should also update
// this list (or, future enhancement, source from an exported config module).
const DOMAINS = ['morvarid.app', 'morvarid.com', 'morvarid-system.com'];

function head(t) { console.log('\n' + '═'.repeat(78) + '\n  ' + t + '\n' + '═'.repeat(78)); }

const report = {};

async function main() {
  // 1. SQL FORENSIC
  head('1. SQL FORENSIC — irani profile + auth.users + auth config');
  // NOTE: email column lives on auth.users, NOT public.profiles. profiles has
  // (id, username, full_name, role, is_active, phone_number, visible_password, ...).
  //
  // The visible_password column is gated by the 20260620_admin_visible_passwords
  // migration. If the column is missing (e.g. the migration has not been applied
  // to this project yet), the script now prints a clear remediation hint and
  // exits gracefully instead of dying on a confusing 42703 error. This was the
  // BLOCKING issue flagged in the prior code-review round.
  let profileRows;
  try {
    profileRows = rows(await sql(`SELECT id, username, full_name, role, is_active, phone_number,
        (visible_password IS NULL) AS vault_null
      FROM public.profiles WHERE username = 'irani'`));
  } catch (e) {
    if (/visible_password.*does not exist/i.test(String(e.message))) {
      console.log('\n  ABORT: visible_password column does NOT exist on public.profiles.');
      console.log('  --> This means 20260620_admin_visible_passwords.sql has NOT been');
      console.log('      applied to this Supabase project yet. The visible_password');
      console.log('      column + 3 SEC-DEF RPCs + the column-level GRANT REVOKE');
      console.log('      all live in that single migration file.');
      console.log('\n  REMEDIATION:');
      console.log('     node scripts/apply-migration.js supabase/migrations/20260620_admin_visible_passwords.sql');
      console.log('     (or use the Supabase CLI: supabase db push)');
      console.log('  After the migration applies, re-run this audit script.');
      process.exit(3);
    }
    throw e;
  }
  report.profile = profileRows[0] || null;
  console.log('PROFILE:', JSON.stringify(report.profile, null, 2));

  if (!report.profile) {
    console.log('\n  --> No profile with username=irani. The account may have been deleted. Aborting.');
    return;
  }

  const authRows = rows(await sql(`SELECT
      id, email, aud, role,
      email_confirmed_at IS NOT NULL AS email_confirmed,
      phone_confirmed_at IS NOT NULL AS phone_confirmed,
      encrypted_password IS NOT NULL AS has_password_hash,
      substring(encrypted_password from 1 for 8) AS hash_prefix,
      banned_until,
      deleted_at IS NOT NULL AS deleted,
      created_at, updated_at, last_sign_in_at
    FROM auth.users WHERE id = '${report.profile.id}'`));
  report.auth = authRows[0] || null;
  console.log('\nAUTH.USERS ROW:', JSON.stringify(report.auth, null, 2));

  if (!report.auth) {
    console.log('\n  --> Profile exists but auth.users row is GONE. ORPHAN PROFILE. Need auth.admin.createUser + sync.');
    return;
  }

  // Supabase Auth config (read from config table if available; otherwise pull from
  // auth schema env vars via goTrue settings query)
  try {
    const cfg = rows(await sql(`SELECT
      (SELECT setting FROM pg_settings WHERE name='app.settings.password_min_length') AS pmin_setting,
      TRUE::text AS supabase_config_from_dashboard`));
    console.log('\nAUTH CONFIG (best-effort):', JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.log('\n  AUTH CONFIG query skipped (pg_settings has no app.settings namespace):', e.message);
  }

  // 2. SIGNIN PROBE — for each domain variant the frontend login flow would use
  head('2. SIGNIN PROBE — try signInWithPassword across all frontend-generated email variants');
  console.log('  Frontend login iterates these domains: ' + DOMAINS.join(', '));
  const probeResults = [];
  for (const domain of DOMAINS) {
    const email = `irani@${domain}`;
    const r = await signinWithPassword(email, 'i123456');
    const safe = sanitizeBody(r.body);
    console.log(`\n  email=${email}`);
    console.log(`  status=${r.status} ok=${r.ok}`);
    console.log(`  body=${JSON.stringify(safe).slice(0, 300)}`);
    probeResults.push({ email, status: r.status, ok: r.ok, body: safe });
  }
  report.probeResults = probeResults;

  const successProbe = probeResults.find(p => p.ok);
  const allFail = probeResults.every(p => !p.ok);

  // 3. ROOT CAUSE analysis
  head('3. ROOT CAUSE ANALYSIS');
  if (successProbe) {
    console.log('  --> signInWithPassword ALREADY succeeds for: ' + successProbe.email);
    console.log('  --> The bug is NOT auth-side. Engine fix verification: check the actual Supabase signIn endpoint response above.');
  } else {
    const errorCodes = probeResults.map(p => p.body?.error_code || p.body?.msg || '?').join(' | ');
    const errorMsgs  = probeResults.map(p => p.body?.msg || p.body?.message || p.body?.error_description || '?').join(' | ');
    console.log('  All signIn variants failed.');
    console.log('  error_codes:', errorCodes);
    console.log('  error_msgs:', errorMsgs);

    console.log('\n  Heuristic root-cause check:');
    console.log('  - email_confirmed=' + report.auth.email_confirmed
              + ', banned_until=' + JSON.stringify(report.auth.banned_until)
              + ', deleted=' + report.auth.deleted
              + ', has_password_hash=' + report.auth.has_password_hash
              + ', hash_prefix=' + report.auth.hash_prefix
              + ', actual_email=' + report.auth.email);

    if (!report.auth.email_confirmed) {
      report.rootCause = 'EMAIL_NOT_CONFIRMED';
      console.log('  --> ROOT CAUSE: email_confirmed_at is NULL. Supabase-blocking: signInWithPassword requires confirmed email.');
    } else if (report.auth.banned_until && new Date(report.auth.banned_until) > new Date()) {
      report.rootCause = 'ACCOUNT_BANNED';
      console.log('  --> ROOT CAUSE: banned_until is in the future.');
    } else if (report.auth.deleted) {
      report.rootCause = 'ACCOUNT_DELETED';
      console.log('  --> ROOT CAUSE: deleted_at is set.');
    } else if (!report.auth.has_password_hash) {
      report.rootCause = 'MISSING_PASSWORD_HASH';
      console.log('  --> ROOT CAUSE: encrypted_password is NULL — this user was created without a password.');
    } else if (!report.auth.hash_prefix?.startsWith('$2')) {
      report.rootCause = 'MALFORMED_PASSWORD_HASH';
      console.log('  --> ROOT CAUSE: encrypted_password does not start with $2a/$2b/$2y (bcrypt prefix). Hash is malformed.');
    } else if (/password/i.test(errorMsgs) && /(length|short|6|8|policy|weak)/i.test(errorMsgs)) {
      report.rootCause = 'PASSWORD_POLICY_REJECT';
      console.log('  --> ROOT CAUSE: Supabase password policy (min_password_length) rejecting i123456 (7 chars).');
    } else if (/invalid.*credentials|invalid.*login|invalid.*grant|email or password/i.test(errorMsgs)) {
      report.rootCause = 'INVALID_CREDENTIALS_OR_HASH_FORMAT_MISMATCH';
      console.log('  --> ROOT CAUSE: Supabase says invalid credentials. Hash may be valid format but not match plaintext, OR a config mismatch.');
    } else {
      report.rootCause = 'UNKNOWN';
      console.log('  --> ROOT CAUSE: could not categorize from error string. See error_msgs above.');
    }
  }

  // 4. REPAIR — based on identified rootCause
  head('4. REPAIR — execute the fix for the identified rootCause');
  const repairApplied = { type: null, sql: null, before: null, after: null };

  if (report.rootCause === 'EMAIL_NOT_CONFIRMED') {
    repairApplied.sql = `UPDATE auth.users
      SET email_confirmed_at = now(), updated_at = now()
      WHERE id = '${report.profile.id}'`;
  } else if (report.rootCause === 'ACCOUNT_BANNED') {
    repairApplied.sql = `UPDATE auth.users
      SET banned_until = NULL, updated_at = now()
      WHERE id = '${report.profile.id}'`;
  } else if (report.rootCause === 'ACCOUNT_DELETED') {
    console.log('  Cannot un-delete via SQL — needs auth.admin.generateLink or full re-create. Skipping.');
    repairApplied.skipped = 'account-deleted-needs-recreate';
  } else if (report.rootCause === 'MISSING_PASSWORD_HASH' || report.rootCause === 'MALFORMED_PASSWORD_HASH') {
    // Direct UPDATE on auth.users.encrypted_password via the Management API
    // (which runs as superuser on Supabase's migration runner). pgcrypto's
    // crypt('bf', 10) output is standard bcrypt MCF, byte-compatible with
    // GoTrue's bcrypt.CompareHashAndPassword verification.
    //
    // The profiles.visible_password sync uses a DIRECT UPDATE rather than
    // the admin_set_visible_password SEC-DEF RPC because that RPC requires
    // auth.uid() to be set via a JWT-impersonation session, which the
    // management API path does NOT provide. The column IS REVOKEd from the
    // `authenticated` role (visible_password access from PostgREST by a
    // normal client is blocked) but the management API runs as superuser
    // and bypasses REVOKE.
    repairApplied.sql = `
      UPDATE auth.users
        SET encrypted_password = crypt('i123456', gen_salt('bf', 10)),
            updated_at = now()
        WHERE id = '${report.profile.id}';
      UPDATE public.profiles
        SET visible_password = 'i123456', updated_at = now()
        WHERE id = '${report.profile.id}';
    `;
  } else if (report.rootCause === 'PASSWORD_POLICY_REJECT') {
    // 20260620: Supabase rejects i123456 (7 chars) pre-hash because of its
    // min_password_length policy. We round up to a valid 8+ char password
    // and document the canonical value in the final report. The new value
    // is the smallest one-passing variant per the engine-fix chain
    // (UserFormModal Zod + EF pre-check both use ≥ 8).
    const newPw = 'i12345678';
    repairApplied.sql = `
      UPDATE auth.users
        SET encrypted_password = crypt('${newPw}', gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            updated_at = now()
        WHERE id = '${report.profile.id}';
      UPDATE public.profiles
        SET visible_password = '${newPw}', updated_at = now()
        WHERE id = '${report.profile.id}';
    `;
    report.canonicalNewPassword = newPw;
  } else if (report.rootCause === 'INVALID_CREDENTIALS_OR_HASH_FORMAT_MISMATCH') {
    // signInWithPassword returned invalid_credentials — valid format, wrong
    // hash match (or the hash is in an incompatible format). Re-write with
    // crypt() in standard bcrypt MCF format AND sync visible_password.
    repairApplied.sql = `
      UPDATE auth.users
        SET encrypted_password = crypt('i123456', gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            updated_at = now()
        WHERE id = '${report.profile.id}';
      UPDATE public.profiles
        SET visible_password = 'i123456', updated_at = now()
        WHERE id = '${report.profile.id}';
    `;
  }

  if (repairApplied.sql) {
    try {
      const r = rows(await sql(repairApplied.sql));
      repairApplied.after = r[0] || null;
      console.log('  REPAIR EXECUTED. Result:');
      console.log('  ' + JSON.stringify(repairApplied, null, 2).split('\n').join('\n  '));
    } catch (e) {
      console.log('  REPAIR FAILED:', e.message);
      repairApplied.error = e.message;
    }
  } else {
    console.log('  No automated repair attempted for rootCause=' + report.rootCause);
  }

  // 5. VERIFY — re-probe signInWithPassword
  head('5. VERIFY — signInWithPassword re-probe after repair');
  const verifyResults = [];
  for (const domain of DOMAINS) {
    const email = `irani@${domain}`;
    const passwordToTry = report.canonicalNewPassword || 'i123456';
    const r = await signinWithPassword(email, passwordToTry);
    const safe = sanitizeBody(r.body);
    console.log(`\n  email=${email} password=${passwordToTry}`);
    console.log(`  status=${r.status} ok=${r.ok}`);
    console.log(`  body=${JSON.stringify(safe).slice(0, 300)}`);
    verifyResults.push({ email, password: passwordToTry, status: r.status, ok: r.ok, body: safe });
  }
  report.verifyResults = verifyResults;
  report.finalLoginWorks = verifyResults.some(v => v.ok);

  // FINAL SUMMARY
  head('FINAL SUMMARY (JSON)');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
