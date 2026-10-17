#!/usr/bin/env node
// ============================================================================
// Pillow Thief :: end-to-end role matrix harness
// ----------------------------------------------------------------------------
// Signs in as three real accounts against the hosted Supabase project and
// asserts the admin / client / provider role matrix over the public REST API
// (PostgREST + GoTrue). No npm dependencies, Node 18+ (global fetch).
//
// Order of operations:
//
//   1. supabase db query --linked -f supabase/tests/roles_fixtures.sql
//   2. node scripts/verify_roles.mjs
//   3. supabase db query --linked -f supabase/tests/roles_cleanup.sql
//
// The fixture resets the qa.* state (role back to client, provider_profiles
// removed, swipes/matches/conversations cleared, application back to pending),
// so the whole cycle is repeatable. Running this script twice WITHOUT
// re-applying the fixture will fail A3 (the provider is still published from
// the previous run) and C2 (the client's like already exists) — that is
// expected, not a regression.
//
// Environment overrides (all optional):
//   SUPABASE_URL, SUPABASE_ANON_KEY,
//   QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD,
//   QA_CLIENT_EMAIL, QA_CLIENT_PASSWORD,
//   QA_PROVIDER_EMAIL, QA_PROVIDER_PASSWORD
//
// Exit codes: 0 = every assertion passed, 1 = at least one FAIL, 2 = fatal
// (could not sign in as the admin, so the matrix could not run).
// ============================================================================

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://tkutsdhjsfxkikfkmztg.supabase.co').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_IOI896t2zBwhSiPcYzAdtQ_vItyjHDF';

const ADMIN = {
  email: process.env.QA_ADMIN_EMAIL || 'admin@pillowthief.local',
  password: process.env.QA_ADMIN_PASSWORD || 'Password123!',
};
const CLIENT = {
  email: process.env.QA_CLIENT_EMAIL || 'qa.client@pillowthief.test',
  password: process.env.QA_CLIENT_PASSWORD || 'QaPassword123!',
};
const PROVIDER = {
  email: process.env.QA_PROVIDER_EMAIL || 'qa.provider@pillowthief.test',
  password: process.env.QA_PROVIDER_PASSWORD || 'QaPassword123!',
};

const CLIENT_ID = '22222222-bbbb-4000-8000-000000000001';
const PROVIDER_ID = '22222222-bbbb-4000-8000-000000000002';
const APPLICATION_ID = '22222222-bbbb-4000-8000-000000000003';

// ---------------------------------------------------------------------------
// Tiny harness
// ---------------------------------------------------------------------------
const results = [];

function group(title) {
  console.log('');
  console.log(`== ${title} ==`);
}

function clip(value, max = 700) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text === undefined) return 'undefined';
  return text.length > max ? `${text.slice(0, max)}... (${text.length} chars)` : text;
}

async function run(id, title, fn) {
  let outcome;
  try {
    outcome = await fn();
  } catch (err) {
    outcome = { ok: false, detail: `threw: ${err && err.message ? err.message : String(err)}` };
  }
  const ok = Boolean(outcome && outcome.ok);
  const detail = outcome && outcome.detail !== undefined ? outcome.detail : '';
  results.push({ id, title, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}  ${title}`);
  console.log(`     ${String(detail).split('\n').join('\n     ')}`);
  return ok;
}

const fail = (detail) => ({ ok: false, detail });

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
async function http(path, { method = 'GET', token, body, headers = {} } = {}) {
  const finalHeaders = { apikey: ANON_KEY, ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${SUPABASE_URL}${path}`, { method, headers: finalHeaders, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, text, json };
}

async function signIn({ email, password }) {
  const res = await http('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  });
  return { ...res, token: res.json && res.json.access_token ? res.json.access_token : null };
}

const rpc = (name, body, token) =>
  http(`/rest/v1/rpc/${name}`, { method: 'POST', token, body: body === undefined ? {} : body });

const get = (path, token) => http(`/rest/v1/${path}`, { token });

const isJsonObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('Pillow Thief :: role matrix');
  console.log(`target : ${SUPABASE_URL}`);
  console.log(`admin  : ${ADMIN.email}`);
  console.log(`client : ${CLIENT.email} (${CLIENT_ID})`);
  console.log(`provider: ${PROVIDER.email} (${PROVIDER_ID})`);
  console.log(`application: ${APPLICATION_ID}`);

  const adminAuth = await signIn(ADMIN);
  if (!adminAuth.token) {
    console.error('');
    console.error(`FATAL: admin sign-in failed (HTTP ${adminAuth.status})`);
    console.error(clip(adminAuth.text, 1200));
    console.error('');
    console.error('The matrix cannot run. Check the hosted project, the publishable key');
    console.error('and the admin password, then re-apply supabase/tests/roles_fixtures.sql.');
    process.exit(2);
  }
  const admin = adminAuth.token;

  const clientAuth = await signIn(CLIENT);
  const client = clientAuth.token;
  const providerAuth = await signIn(PROVIDER);
  const provider = providerAuth.token;

  // =========================================================================
  group(`Admin path (${ADMIN.email})`);
  // =========================================================================

  await run('A1', 'admin_metrics() returns 200 + the documented keys', async () => {
    const res = await rpc('admin_metrics', {}, admin);
    if (res.status !== 200) {
      return fail(`HTTP ${res.status} :: ${clip(res.text)}`);
    }
    if (!isJsonObject(res.json)) {
      return fail(`expected a JSON object, got ${clip(res.text, 300)}`);
    }
    const required = ['users_total', 'applications_pending', 'bookings_by_status', 'gmv_30d_minor'];
    const missing = required.filter((key) => !(key in res.json));
    if (missing.length) {
      return fail(`missing keys ${JSON.stringify(missing)} :: ${clip(res.json)}`);
    }
    return { ok: true, detail: `HTTP 200 :: ${clip(res.json)}` };
  });

  let approveRes = null;
  await run('A2', "admin_decide_application('approve') verifies the fixture application", async () => {
    const res = await rpc(
      'admin_decide_application',
      { p_application: APPLICATION_ID, p_action: 'approve', p_note: 'QA role matrix approval' },
      admin,
    );
    approveRes = res;
    if (res.status !== 200) {
      return fail(`HTTP ${res.status} :: ${clip(res.text)}`);
    }
    if (!res.json || res.json.status !== 'verified') {
      return fail(`expected status "verified" :: ${clip(res.json)}`);
    }
    return { ok: true, detail: `HTTP 200 :: ${clip(res.json)}` };
  });

  await run('A3', "provider role is 'provider' and provider_profiles exists with published=false", async () => {
    const profile = await get(`profiles?select=id,role&id=eq.${PROVIDER_ID}`, admin);
    const pp = await get(
      `provider_profiles?select=provider_id,verification,published&provider_id=eq.${PROVIDER_ID}`,
      admin,
    );
    const role = Array.isArray(profile.json) && profile.json[0] ? profile.json[0].role : null;
    const row = Array.isArray(pp.json) && pp.json[0] ? pp.json[0] : null;
    const detail =
      `profiles HTTP ${profile.status} :: ${clip(profile.json)}\n` +
      `provider_profiles HTTP ${pp.status} :: ${clip(pp.json)}`;
    if (role !== 'provider') return fail(`role is ${JSON.stringify(role)}, expected "provider"\n${detail}`);
    if (!row) return fail(`no provider_profiles row\n${detail}`);
    if (row.published !== false) return fail(`published is ${JSON.stringify(row.published)}, expected false\n${detail}`);
    if (row.verification !== 'verified') {
      return fail(`verification is ${JSON.stringify(row.verification)}, expected "verified"\n${detail}`);
    }
    return { ok: true, detail };
  });

  await run('A4', "'publish' sets published=true and the row is visible to anon", async () => {
    const pub = await rpc('admin_set_provider_status', { p_provider: PROVIDER_ID, p_action: 'publish' }, admin);
    if (pub.status !== 200) {
      return fail(`publish HTTP ${pub.status} :: ${clip(pub.text)}`);
    }
    if (!pub.json || pub.json.published !== true) {
      return fail(`publish did not report published=true :: ${clip(pub.json)}`);
    }
    // Deliberately no Authorization header: this is the anonymous surface.
    const anonRes = await get(
      `provider_profiles?select=provider_id,verification,published&provider_id=eq.${PROVIDER_ID}`,
    );
    const rows = Array.isArray(anonRes.json) ? anonRes.json : [];
    const detail =
      `publish HTTP ${pub.status} :: ${clip(pub.json)}\n` +
      `anon GET HTTP ${anonRes.status} :: ${clip(anonRes.json)}`;
    if (anonRes.status !== 200) return fail(`anon GET returned HTTP ${anonRes.status}\n${detail}`);
    if (rows.length !== 1) return fail(`anon GET returned ${rows.length} row(s), expected 1\n${detail}`);
    if (rows[0].published !== true || rows[0].verification !== 'verified') {
      return fail(`unexpected anon row\n${detail}`);
    }
    return { ok: true, detail };
  });

  await run('A5', "admin_set_provider_status rejects an unknown action", async () => {
    const res = await rpc(
      'admin_set_provider_status',
      { p_provider: PROVIDER_ID, p_action: 'not_a_real_action' },
      admin,
    );
    if (res.ok) return fail(`silently succeeded with HTTP ${res.status} :: ${clip(res.text)}`);
    if (!/unknown action/i.test(res.text)) {
      return fail(`errored, but not with "unknown action" :: HTTP ${res.status} :: ${clip(res.text)}`);
    }
    return { ok: true, detail: `HTTP ${res.status} :: ${clip(res.text)}` };
  });

  // =========================================================================
  group(`Client path (${CLIENT.email})`);
  // =========================================================================

  await run('C1', 'discovery_deck() includes the verified, published fixture provider', async () => {
    if (!client) return fail(`client sign-in failed (HTTP ${clientAuth.status}) :: ${clip(clientAuth.text, 400)}`);
    const res = await rpc(
      'discovery_deck',
      { p_lat: -24.6282, p_lng: 25.9231, p_max_km: 50, p_limit: 50 },
      client,
    );
    if (res.status !== 200) return fail(`HTTP ${res.status} :: ${clip(res.text)}`);
    if (!Array.isArray(res.json)) return fail(`expected an array :: ${clip(res.text)}`);
    const ids = res.json.map((row) => row.provider_id);
    const detail = `HTTP 200 :: ${ids.length} provider(s) :: ${clip(ids)}`;
    if (!ids.includes(PROVIDER_ID)) return fail(`fixture provider ${PROVIDER_ID} not in the deck\n${detail}`);
    return { ok: true, detail };
  });

  await run('C2', "record_swipe('like') on the provider stays double-blind (matched=false)", async () => {
    if (!client) return fail(`client sign-in failed (HTTP ${clientAuth.status})`);
    const res = await rpc('record_swipe', { p_target: PROVIDER_ID, p_direction: 'like' }, client);
    if (res.status !== 200) return fail(`HTTP ${res.status} :: ${clip(res.text)}`);
    if (!res.json || res.json.matched !== false) {
      return fail(`expected matched=false :: ${clip(res.json)}`);
    }
    if (res.json.match_id) return fail(`a one-sided like leaked a match_id :: ${clip(res.json)}`);
    return { ok: true, detail: `HTTP 200 :: ${clip(res.json)}` };
  });

  await run('C3', 'admin_metrics() as a client is rejected', async () => {
    if (!client) return fail(`client sign-in failed (HTTP ${clientAuth.status})`);
    const res = await rpc('admin_metrics', {}, client);
    if (res.ok) return fail(`client read admin metrics :: HTTP ${res.status} :: ${clip(res.text)}`);
    if (!/not authorised|permission denied/i.test(res.text)) {
      return fail(`rejected, but not by is_admin() :: HTTP ${res.status} :: ${clip(res.text)}`);
    }
    return { ok: true, detail: `HTTP ${res.status} :: ${clip(res.text)}` };
  });

  await run('C4', 'client cannot PATCH its own profiles.role to admin', async () => {
    if (!client) return fail(`client sign-in failed (HTTP ${clientAuth.status})`);
    const patch = await http(`/rest/v1/profiles?id=eq.${CLIENT_ID}`, {
      method: 'PATCH',
      token: client,
      body: { role: 'admin' },
      headers: { Prefer: 'return=representation' },
    });
    const after = await get(`profiles?select=id,role&id=eq.${CLIENT_ID}`, admin);
    const role = Array.isArray(after.json) && after.json[0] ? after.json[0].role : null;
    const detail =
      `PATCH HTTP ${patch.status} :: ${clip(patch.text)}\n` +
      `role afterwards (admin read) :: ${clip(after.json)}`;
    if (patch.ok) return fail(`role escalation was accepted\n${detail}`);
    if (role !== 'client') return fail(`role is now ${JSON.stringify(role)}, expected "client"\n${detail}`);
    return { ok: true, detail };
  });

  await run('C5', "client cannot POST a provider_application with status 'verified'", async () => {
    if (!client) return fail(`client sign-in failed (HTTP ${clientAuth.status})`);
    const post = await http('/rest/v1/provider_applications', {
      method: 'POST',
      token: client,
      body: {
        user_id: CLIENT_ID,
        status: 'verified',
        legal_name: 'QA Client Legal Name',
        date_of_birth: '1995-01-01',
        display_name: 'QA Client',
        bio: 'Attempted self-escalation from the role matrix harness.',
        base_price_60_minor: 20000,
        boundaries: 'Attempted self-escalation.',
      },
      headers: { Prefer: 'return=representation' },
    });
    // Confirm nothing was written even if the request was partially accepted.
    const check = await get(`provider_applications?select=id,status&user_id=eq.${CLIENT_ID}`, admin);
    const detail =
      `POST HTTP ${post.status} :: ${clip(post.text)}\n` +
      `applications for client afterwards (admin read) :: ${clip(check.json)}`;
    if (post.ok) return fail(`application with status 'verified' was accepted\n${detail}`);
    if (!/applications must be submitted with status = pending|new row violates row-level security/i.test(post.text)) {
      return fail(`rejected, but not by the status guard :: ${detail}`);
    }
    if (Array.isArray(check.json) && check.json.length > 0) {
      return fail(`an application row was written anyway\n${detail}`);
    }
    return { ok: true, detail };
  });

  await run('C6', "client sees none of another user's bookings", async () => {
    if (!client) return fail(`client sign-in failed (HTTP ${clientAuth.status})`);
    const clientView = await get('bookings?select=id,client_id,provider_id', client);
    const adminView = await get('bookings?select=id,client_id,provider_id', admin);
    const clientRows = Array.isArray(clientView.json) ? clientView.json : null;
    const adminRows = Array.isArray(adminView.json) ? adminView.json : null;
    const detail =
      `client GET HTTP ${clientView.status} :: ${clientRows ? clientRows.length : clip(clientView.json)} row(s)\n` +
      `admin  GET HTTP ${adminView.status} :: ${adminRows ? adminRows.length : clip(adminView.json)} row(s)`;
    if (!clientRows) return fail(`client bookings query did not return an array\n${detail}`);
    if (!adminRows) return fail(`admin bookings query did not return an array\n${detail}`);
    if (clientRows.length !== 0) {
      return fail(`fresh fixture client can see ${clientRows.length} booking(s)\n${detail}`);
    }
    if (adminRows.length < clientRows.length) {
      return fail(`client sees more bookings than the admin\n${detail}`);
    }
    if (adminRows.length === 0) {
      return {
        ok: true,
        detail: `${detail}\n(the bookings table is empty, so this check is satisfied but does not exercise the RLS filter)`,
      };
    }
    return { ok: true, detail };
  });

  // =========================================================================
  group(`Provider path (${PROVIDER.email})`);
  // =========================================================================

  await run('P1', 'provider sign-in succeeds (hand-made auth.users row is GoTrue-valid)', async () => {
    if (!provider) {
      return fail(`HTTP ${providerAuth.status} :: ${clip(providerAuth.text, 800)}`);
    }
    return {
      ok: true,
      detail: `HTTP ${providerAuth.status} :: access_token issued, user id ${providerAuth.json && providerAuth.json.user ? providerAuth.json.user.id : 'unknown'}`,
    };
  });

  await run('P2', 'list_who_liked_me() surfaces the client who liked the provider', async () => {
    if (!provider) return fail(`provider sign-in failed (HTTP ${providerAuth.status})`);
    const res = await rpc('list_who_liked_me', { p_limit: 50 }, provider);
    if (res.status !== 200) return fail(`HTTP ${res.status} :: ${clip(res.text)}`);
    if (!Array.isArray(res.json)) return fail(`expected an array :: ${clip(res.text)}`);
    const ids = res.json.map((row) => row.actor_id);
    const detail = `HTTP 200 :: ${ids.length} admirer(s) :: ${clip(ids)}`;
    if (!ids.includes(CLIENT_ID)) return fail(`client ${CLIENT_ID} is not in list_who_liked_me\n${detail}`);
    return { ok: true, detail };
  });

  let matchId = null;
  await run('P3', "mutual like via record_swipe() creates a match + conversation", async () => {
    if (!provider) return fail(`provider sign-in failed (HTTP ${providerAuth.status})`);
    const res = await rpc('record_swipe', { p_target: CLIENT_ID, p_direction: 'like' }, provider);
    if (res.status !== 200) return fail(`HTTP ${res.status} :: ${clip(res.text)}`);
    if (!res.json || res.json.matched !== true) {
      return fail(`expected matched=true :: ${clip(res.json)}`);
    }
    if (!res.json.match_id || !res.json.conversation_id) {
      return fail(`missing match_id/conversation_id :: ${clip(res.json)}`);
    }
    matchId = res.json.match_id;
    return { ok: true, detail: `HTTP 200 :: ${clip(res.json)}` };
  });

  await run('P4', 'list_matches() as the client returns the same match', async () => {
    if (!client) return fail(`client sign-in failed (HTTP ${clientAuth.status})`);
    if (!matchId) return fail('no match id from P3 — mutual like did not produce a match');
    const res = await rpc('list_matches', { p_limit: 50 }, client);
    if (res.status !== 200) return fail(`HTTP ${res.status} :: ${clip(res.text)}`);
    if (!Array.isArray(res.json)) return fail(`expected an array :: ${clip(res.text)}`);
    const ids = res.json.map((row) => row.match_id);
    const detail = `HTTP 200 :: ${ids.length} match(es) :: ${clip(res.json)}`;
    if (!ids.includes(matchId)) return fail(`match ${matchId} not visible to the client\n${detail}`);
    return { ok: true, detail };
  });

  await run('P5', 'unmatch() removes the match from both sides', async () => {
    if (!client) return fail(`client sign-in failed (HTTP ${clientAuth.status})`);
    if (!matchId) return fail('no match id from P3');
    const res = await rpc('unmatch', { p_match: matchId }, client);
    if (!res.ok) return fail(`unmatch HTTP ${res.status} :: ${clip(res.text)}`);
    const after = await rpc('list_matches', { p_limit: 50 }, client);
    const rows = Array.isArray(after.json) ? after.json : null;
    const detail =
      `unmatch HTTP ${res.status} :: ${clip(res.text, 200)}\n` +
      `list_matches after HTTP ${after.status} :: ${rows ? rows.length : clip(after.json)} row(s)`;
    if (!rows) return fail(`list_matches did not return an array\n${detail}`);
    if (rows.length !== 0) return fail(`client still sees ${rows.length} match(es)\n${detail}`);
    return { ok: true, detail };
  });

  await run('P6', 'admin_decide_application() as the provider is rejected', async () => {
    if (!provider) return fail(`provider sign-in failed (HTTP ${providerAuth.status})`);
    const res = await rpc(
      'admin_decide_application',
      { p_application: APPLICATION_ID, p_action: 'approve', p_note: 'nope' },
      provider,
    );
    if (res.ok) return fail(`provider approved an application :: HTTP ${res.status} :: ${clip(res.text)}`);
    if (!/not authorised|permission denied/i.test(res.text)) {
      return fail(`rejected, but not by is_admin() :: HTTP ${res.status} :: ${clip(res.text)}`);
    }
    return { ok: true, detail: `HTTP ${res.status} :: ${clip(res.text)}` };
  });

  // =========================================================================
  // Summary
  // =========================================================================
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  console.log('');
  console.log('--------------------------------------------------------------------');
  console.log(`SUMMARY: ${passed}/${results.length} passed, ${failed} failed`);
  if (failed) {
    console.log(`FAILED : ${results.filter((r) => !r.ok).map((r) => r.id).join(', ')}`);
    console.log('');
    console.log('Re-run the fixture to reset state before investigating:');
    console.log('  supabase db query --linked -f supabase/tests/roles_fixtures.sql');
  } else {
    console.log('');
    console.log('All assertions passed. Clean up with:');
    console.log('  supabase db query --linked -f supabase/tests/roles_cleanup.sql');
  }

  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('');
  console.error('FATAL: harness crashed');
  console.error(err && err.stack ? err.stack : err);
  process.exit(2);
});
