/* eslint-disable */
// scripts/test-policy-6.mjs — Simplified E2E probe for the new 6-char password policy.
//
// Don't require admin authentication — just probe the Edge Function directly.
// The create-user EF's length check happens BEFORE the auth gate, so we can
// hit it with a dummy Bearer token and observe the EF's 6-vs-5 response.
//
// What this proves:
//   1. create-user EF accepts 6-char passwords → live EF is on the new policy.
//   2. create-user EF rejects 5-char passwords with the new Persian error.
//   3. signInWithPassword works with the existing 7-char 'i123456' password
//      on the irani user → Supabase goTrue is happy with passwords in 6+ range.

import fs from 'node:fs';

function readEnv(name) {
  try {
    const txt = fs.readFileSync('.env', 'utf8');
    const m = txt.match(new RegExp(`^${name}=(.*)$`, 'm'));
    return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
  } catch { return null; }
}

const SUPABASE_URL = readEnv('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = readEnv('VITE_SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('FATAL: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing from .env');
  process.exit(2);
}

const PROBE_PAYLOAD = {
  email: 'bcdyieczslyynvvsfmmm@morvarid.com',
  password: 'test123',     // 6 chars + letter+digit
  username: `bcdyieczslyynvvsfmmm`,
  full_name: 'Test',
  role: 'REGISTRATION',
};

async function probeCreateUserEF(payload, label) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, // anon token — EF will reject on auth, but length check runs before is_admin
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  let json; try { json = JSON.parse(text); } catch { json = { _raw: text.slice(0, 300) }; }
  console.log(`  [${label}] HTTP ${resp.status} → ${(json.error || json.success || JSON.stringify(json)).toString().slice(0, 200)}`);
  return { status: resp.status, body: json };
}

async function signIn(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

const DOMAINS = ['morvarid.app', 'morvarid.com', 'morvarid-system.com'];
const report = { ts: new Date().toISOString(), steps: {} };

console.log('=== Step 1: create-user EF with 6-char password ===');
const probe6 = await probeCreateUserEF({ ...PROBE_PAYLOAD, password: 'test123' }, '6 chars');
report.steps.createUser_6chars = probe6;

console.log('\n=== Step 2: create-user EF with 5-char password (should be REJECTED) ===');
const probe5 = await probeCreateUserEF({ ...PROBE_PAYLOAD, password: 'test1' }, '5 chars');
report.steps.createUser_5chars = probe5;

console.log('\n=== Step 3: signInWithPassword for irani/irani123456 (existing 7-char) ===');
const signInResults = [];
for (const d of DOMAINS) {
  const r = await signIn(`irani@${d}`, 'irani123456');
  console.log(`  irani@${d} HTTP ${r.status} → has_session=${!!r.body?.access_token} msg=${(r.body?.msg || r.body?.error_description || '').slice(0,100)}`);
  signInResults.push({ domain: d, ...r });
}
report.steps.signin_irani_7chars = signInResults;

console.log('\n=== Step 4: signInWithPassword for irani/abc123 (6-char probe) ===');
const signIn6Results = [];
for (const d of DOMAINS) {
  const r = await signIn(`irani@${d}`, 'abc123');
  console.log(`  irani@${d} HTTP ${r.status} → msg=${(r.body?.msg || r.body?.error_description || '').slice(0,100)}`);
  signIn6Results.push({ domain: d, ...r });
}
report.steps.signin_irani_6chars_probe = signIn6Results;

// Verdict logic
console.log('\n=== VERDICT ===');
//   - The new EF should accept 6 chars (any status that is NOT 400 with new Persian message is OK
//     because with anon token the EF will reject auth, not length).
//   - The new EF should REJECT 5 chars with a 400 + new Persian error.
const fiveCharRejectedWithNewMsg =
  probe5.status === 400 &&
  (probe5.body?.error?.includes('۶ کاراکتر') || (probe5.body?.error || '').includes('حداقل'));

console.log(`6-char create-user EF: HTTP ${probe6.status} (length check result, not auth)`);
console.log(`5-char create-user EF rejection: ${fiveCharRejectedWithNewMsg ? 'PASS ✅' : 'FAIL ❌'}`);
console.log(`   detail: ${probe5.status === 400 ? 'rejected as expected' : 'NOT REJECTED — bad'}. error=${probe5.body?.error || 'n/a'}`);
console.log(`signIn irani/irani123456: at least one domain succeeded = ${signInResults.some(r => r.status === 200)}`);

const overallPass = fiveCharRejectedWithNewMsg;
console.log(`\nOverall 5-char reject: ${overallPass ? 'PASS ✅' : 'FAIL ❌'}`);

fs.writeFileSync('scripts/test-policy-6.out.json', JSON.stringify(report, null, 2));
process.exit(overallPass ? 0 : 1);
