-- Migration 004: RLS cross-operator isolation tests
-- Runs only in test / local environments (supabase db reset).
-- Verifies that operator A cannot see operator B's data.

do $$
declare
  coop_a uuid := '00000000-0000-0000-0000-000000000001'; -- Demo Cooperative (seed)
  coop_b uuid := '00000000-0000-0000-0000-000000000002';
  meter_b uuid := '00000000-0000-0000-0000-000000000020';
  reading_b uuid := '00000000-0000-0000-0000-000000000040';
  cert_b  uuid := '00000000-0000-0000-0000-000000000030';
  cnt     int;
begin
  -- ── Fixture: second cooperative + meter + reading + certificate ─────────────
  insert into cooperatives (id, name, admin_address) values
    (coop_b, 'Other Cooperative', 'GOTHER1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
    on conflict (id) do nothing;

  insert into meters (id, cooperative_id, serial_number, pubkey_hex) values
    (meter_b, coop_b, 'METER-B-001',
     'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    on conflict (id) do nothing;

  insert into readings (id, meter_id, kwh, timestamp, reading_hash, signature_hex, anchor_tx_hash, mint_tx_hash, anchored, minted) values
    (reading_b, meter_b, 5.0, now(), 'deadbeef' || repeat('0', 56),
     'ff' || repeat('0', 126), 'anchor' || repeat('0', 58),
     'mint' || repeat('0', 60), true, false)
    on conflict (id) do nothing;

  insert into certificates (id, cooperative_id, reading_id, reading_hash,
                             anchor_tx_hash, mint_tx_hash, kwh) values
    (cert_b, coop_b,
     reading_b,
     'deadbeef' || repeat('0', 56),
     'anchor' || repeat('0', 58),
     'mint' || repeat('0', 60),
     10.0)
    on conflict (id) do nothing;

  -- ── Test 1: operator A JWT → cannot see coop B's meters ───────────────────
  -- Simulate by setting the claim and querying through RLS.
  perform set_config('request.jwt.claims',
    json_build_object(
      'app_metadata', json_build_object('cooperative_id', coop_a::text)
    )::text, true);

  select count(*) into cnt from meters where cooperative_id = coop_b;
  assert cnt = 0,
    format('FAIL test1: operator A saw %s meter(s) belonging to operator B', cnt);

  -- ── Test 2: operator A JWT → cannot see coop B's readings ───────────────
  select count(*) into cnt from readings where meter_id = meter_b;
  assert cnt = 0,
    format('FAIL test2: operator A saw %s reading(s) belonging to operator B', cnt);

  -- ── Test 3: operator A JWT → cannot see coop B's certificates ────────────
  select count(*) into cnt from certificates where cooperative_id = coop_b;
  assert cnt = 0,
    format('FAIL test3: operator A saw %s certificate(s) belonging to operator B', cnt);

  -- ── Test 4: operator A JWT → can see own meters and readings ─────────────
  select count(*) into cnt from meters where cooperative_id = coop_a;
  assert cnt > 0,
    'FAIL test4: operator A could not see its own meters';

  select count(*) into cnt from readings r
    join meters m on m.id = r.meter_id
    where m.cooperative_id = coop_a;
  assert cnt > 0,
    'FAIL test4: operator A could not see its own readings';

  -- ── Test 5: admin JWT → can see all cooperatives ──────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object(
      'app_metadata', json_build_object('role', 'admin')
    )::text, true);

  select count(*) into cnt from cooperatives;
  assert cnt >= 2,
    format('FAIL test4: admin saw only %s cooperative(s), expected >= 2', cnt);

  -- ── Test 5: admin JWT → can see meters from all cooperatives ──────────────
  select count(*) into cnt from meters;
  assert cnt >= 2,
    format('FAIL test5: admin saw only %s meter(s), expected >= 2', cnt);

  raise notice 'RLS isolation tests passed (5/5)';
end;
$$;
