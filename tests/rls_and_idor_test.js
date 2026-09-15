const postgres = require('postgres');
const fs = require('fs');

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (fs.existsSync('.env.local')) {
    const lines = fs.readFileSync('.env.local', 'utf-8').split('\n');
    for (const line of lines) {
      if (line.startsWith('DATABASE_URL=')) {
        return line.replace('DATABASE_URL=', '').trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return null;
}

const sql = postgres(getDbUrl(), { ssl: { rejectUnauthorized: false } });

async function runSecurityTests() {
  console.log('====================================================');
  console.log(' 🛡️ SUPABASE RLS & TENANT ISOLATION SECURITY TESTS  ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      failed++;
    }
  }

  // Generate 2 synthetic test user UUIDs
  const userA = 'a0000000-0000-0000-0000-000000000001';
  const userB = 'b0000000-0000-0000-0000-000000000002';

  try {
    // 1. Setup Test Users in auth.users
    await sql`
      INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES 
        (${userA}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_user_a@example.com', '{}', '{"full_name": "Test User A"}', now(), now()),
        (${userB}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_user_b@example.com', '{}', '{"full_name": "Test User B"}', now(), now())
      ON CONFLICT (id) DO NOTHING
    `;

    // Clean up past test fixtures if any
    await sql`DELETE FROM transaksi WHERE category LIKE 'TEST_%'`;
    await sql`DELETE FROM rekening WHERE name LIKE 'TEST_%'`;
    await sql`DELETE FROM anggota WHERE name LIKE 'TEST_%'`;
    await sql`DELETE FROM keluarga WHERE name LIKE 'TEST_%'`;

    // Create Family A
    const [famA] = await sql`INSERT INTO keluarga (name) VALUES ('TEST_Keluarga_A') RETURNING id`;
    const [angA] = await sql`INSERT INTO anggota (keluarga_id, name, user_id, role) VALUES (${famA.id}, 'TEST_User_A', ${userA}, 'admin') RETURNING id`;
    const [rekA] = await sql`INSERT INTO rekening (keluarga_id, name, balance, type) VALUES (${famA.id}, 'TEST_Rekening_A', 1000000, 'bank') RETURNING id`;
    const [txA] = await sql`INSERT INTO transaksi (rekening_id, anggota_id, amount, type, category, description) VALUES (${rekA.id}, ${angA.id}, 50000, 'expense', 'TEST_Cat_A', 'Test Tx A') RETURNING id`;

    // Create Family B
    const [famB] = await sql`INSERT INTO keluarga (name) VALUES ('TEST_Keluarga_B') RETURNING id`;
    const [angB] = await sql`INSERT INTO anggota (keluarga_id, name, user_id, role) VALUES (${famB.id}, 'TEST_User_B', ${userB}, 'admin') RETURNING id`;
    const [rekB] = await sql`INSERT INTO rekening (keluarga_id, name, balance, type) VALUES (${famB.id}, 'TEST_Rekening_B', 2000000, 'cash') RETURNING id`;
    const [txB] = await sql`INSERT INTO transaksi (rekening_id, anggota_id, amount, type, category, description) VALUES (${rekB.id}, ${angB.id}, 75000, 'expense', 'TEST_Cat_B', 'Test Tx B') RETURNING id`;

    console.log('--- TEST FIXTURES INITIALIZED ---');
    console.log(`Family A (ID: ${famA.id}, User: ${userA})`);
    console.log(`Family B (ID: ${famB.id}, User: ${userB})\n`);

    // Helper to simulate user auth in a connection
    async function asUser(userId, role, callback) {
      return await sql.begin(async sql => {
        if (userId) {
          await sql`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`;
        } else {
          await sql`SELECT set_config('request.jwt.claim.sub', '', true)`;
        }
        await sql`SELECT set_config('request.jwt.claim.role', ${role}, true)`;
        await sql`SELECT set_config('role', 'authenticated', true)`;
        return await callback(sql);
      });
    }

    // -------------------------------------------------------------
    // TEST 1: Tenant Resolution Helper Function
    // -------------------------------------------------------------
    console.log('--- 1. TENANT RESOLUTION HELPER ---');
    await asUser(userA, 'authenticated', async sql => {
      const userAFamilies = await sql`SELECT public.get_auth_user_keluarga_ids() as id`;
      const userAFamilyIds = userAFamilies.map(r => r.id);
      assert(userAFamilyIds.includes(famA.id) && !userAFamilyIds.includes(famB.id), 
        'get_auth_user_keluarga_ids() for User A returns only Family A');
    });

    await asUser(userB, 'authenticated', async sql => {
      const userBFamilies = await sql`SELECT public.get_auth_user_keluarga_ids() as id`;
      const userBFamilyIds = userBFamilies.map(r => r.id);
      assert(userBFamilyIds.includes(famB.id) && !userBFamilyIds.includes(famA.id), 
        'get_auth_user_keluarga_ids() for User B returns only Family B');
    });

    // -------------------------------------------------------------
    // TEST 2: Anonymous User Access (RLS Deny)
    // -------------------------------------------------------------
    console.log('\n--- 2. ANONYMOUS ACCESS (RLS POLICY) ---');
    await asUser(null, 'anon', async sql => {
      await sql`SELECT set_config('role', 'anon', true)`;
      const anonFam = await sql`SELECT * FROM keluarga WHERE id IN (${famA.id}, ${famB.id})`;
      assert(anonFam.length === 0, 'Anonymous user cannot SELECT any keluarga rows');

      const anonRek = await sql`SELECT * FROM rekening WHERE id IN (${rekA.id}, ${rekB.id})`;
      assert(anonRek.length === 0, 'Anonymous user cannot SELECT any rekening rows');

      const anonTx = await sql`SELECT * FROM transaksi WHERE id IN (${txA.id}, ${txB.id})`;
      assert(anonTx.length === 0, 'Anonymous user cannot SELECT any transaksi rows');
    });

    // -------------------------------------------------------------
    // TEST 3: User A Isolation (Can access A, Cannot access B)
    // -------------------------------------------------------------
    console.log('\n--- 3. USER A TENANT ISOLATION ---');
    await asUser(userA, 'authenticated', async sql => {
      const userAFamQuery = await sql`SELECT * FROM keluarga WHERE id = ${famA.id}`;
      assert(userAFamQuery.length === 1, 'User A CAN SELECT Family A');

      const userABlockedFamQuery = await sql`SELECT * FROM keluarga WHERE id = ${famB.id}`;
      assert(userABlockedFamQuery.length === 0, 'User A CANNOT SELECT Family B (RLS Filtered)');

      const userARekQuery = await sql`SELECT * FROM rekening WHERE id = ${rekA.id}`;
      assert(userARekQuery.length === 1, 'User A CAN SELECT Account A');

      const userABlockedRekQuery = await sql`SELECT * FROM rekening WHERE id = ${rekB.id}`;
      assert(userABlockedRekQuery.length === 0, 'User A CANNOT SELECT Account B (RLS Filtered)');

      const userATxQuery = await sql`SELECT * FROM transaksi WHERE id = ${txA.id}`;
      assert(userATxQuery.length === 1, 'User A CAN SELECT Transaction A');

      const userABlockedTxQuery = await sql`SELECT * FROM transaksi WHERE id = ${txB.id}`;
      assert(userABlockedTxQuery.length === 0, 'User A CANNOT SELECT Transaction B (RLS Filtered)');
    });

    // -------------------------------------------------------------
    // TEST 4: IDOR Protection (User A cannot mutate User B resources)
    // -------------------------------------------------------------
    console.log('\n--- 4. IDOR MUTATION PROTECTION ---');
    await asUser(userA, 'authenticated', async sql => {
      const idorFamUpdate = await sql`UPDATE keluarga SET name = 'HACKED' WHERE id = ${famB.id} RETURNING id`;
      assert(idorFamUpdate.length === 0, 'IDOR: User A CANNOT UPDATE Family B');

      const idorRekUpdate = await sql`UPDATE rekening SET balance = 0 WHERE id = ${rekB.id} RETURNING id`;
      assert(idorRekUpdate.length === 0, 'IDOR: User A CANNOT UPDATE Account B');

      const idorTxDelete = await sql`DELETE FROM transaksi WHERE id = ${txB.id} RETURNING id`;
      assert(idorTxDelete.length === 0, 'IDOR: User A CANNOT DELETE Transaction B');
    });

    // -------------------------------------------------------------
    // Clean up test fixtures
    // -------------------------------------------------------------
    await sql`DELETE FROM transaksi WHERE id IN (${txA.id}, ${txB.id})`;
    await sql`DELETE FROM rekening WHERE id IN (${rekA.id}, ${rekB.id})`;
    await sql`DELETE FROM anggota WHERE id IN (${angA.id}, ${angB.id})`;
    await sql`DELETE FROM keluarga WHERE id IN (${famA.id}, ${famB.id})`;
    await sql`DELETE FROM auth.users WHERE id IN (${userA}, ${userB})`;
    console.log('\n--- TEST FIXTURES CLEANED UP ---');

    console.log(`\n====================================================`);
    console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log(`====================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Security test runner error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runSecurityTests();
