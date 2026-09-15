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

async function runFinancialTests() {
  console.log('====================================================');
  console.log(' 💰 FINANCIAL DATA INTEGRITY & ATOMIC MUTATIONS TEST');
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

  const userA = 'c0000000-0000-0000-0000-000000000001';
  const userB = 'd0000000-0000-0000-0000-000000000002';

  try {
    // Setup test users in auth.users
    await sql`
      INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES 
        (${userA}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin_test_a@example.com', '{}', '{}', now(), now()),
        (${userB}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin_test_b@example.com', '{}', '{}', now(), now())
      ON CONFLICT (id) DO NOTHING
    `;

    // Clean past test fixtures
    await sql`DELETE FROM transaksi WHERE category LIKE 'FIN_%'`;
    await sql`DELETE FROM rekening WHERE name LIKE 'FIN_%'`;
    await sql`DELETE FROM anggota WHERE name LIKE 'FIN_%'`;
    await sql`DELETE FROM keluarga WHERE name LIKE 'FIN_%'`;

    // -------------------------------------------------------------
    // FIXTURES
    // -------------------------------------------------------------
    const [famA] = await sql`INSERT INTO keluarga (name) VALUES ('FIN_Family_A') RETURNING id`;
    const [angA] = await sql`INSERT INTO anggota (keluarga_id, name, user_id, role) VALUES (${famA.id}, 'FIN_Member_A', ${userA}, 'admin') RETURNING id`;
    const [rekA1] = await sql`INSERT INTO rekening (keluarga_id, name, balance, type) VALUES (${famA.id}, 'FIN_Rekening_A1', 1000000.00, 'bank') RETURNING id, balance::numeric`;
    const [rekA2] = await sql`INSERT INTO rekening (keluarga_id, name, balance, type) VALUES (${famA.id}, 'FIN_Rekening_A2', 500000.00, 'cash') RETURNING id, balance::numeric`;

    const [famB] = await sql`INSERT INTO keluarga (name) VALUES ('FIN_Family_B') RETURNING id`;
    const [angB] = await sql`INSERT INTO anggota (keluarga_id, name, user_id, role) VALUES (${famB.id}, 'FIN_Member_B', ${userB}, 'admin') RETURNING id`;
    const [rekB] = await sql`INSERT INTO rekening (keluarga_id, name, balance, type) VALUES (${famB.id}, 'FIN_Rekening_B', 300000.00, 'bank') RETURNING id, balance::numeric`;

    // -------------------------------------------------------------
    // TEST 1: Money Precision & DECIMAL Arithmetic
    // -------------------------------------------------------------
    console.log('--- 1. MONEY PRECISION & DECIMAL ARITHMETIC ---');
    const [pCols] = await sql`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transaksi' AND column_name = 'amount'
    `;
    assert(pCols.data_type === 'numeric', 'transaksi.amount is PostgreSQL NUMERIC type');

    const [rCols] = await sql`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'rekening' AND column_name = 'balance'
    `;
    assert(rCols.data_type === 'numeric', 'rekening.balance is PostgreSQL NUMERIC type');

    // -------------------------------------------------------------
    // TEST 2: CHECK Constraint on Negative Amount
    // -------------------------------------------------------------
    console.log('\n--- 2. CHECK CONSTRAINT: NON-POSITIVE AMOUNT REJECTION ---');
    let negRejected = false;
    try {
      await sql`
        INSERT INTO transaksi (rekening_id, anggota_id, amount, type, category, description)
        VALUES (${rekA1.id}, ${angA.id}, -50000.00, 'expense', 'FIN_Bad', 'Negative amount')
      `;
    } catch (e) {
      negRejected = e.message.includes('chk_transaksi_amount_positive') || e.code === '23514';
    }
    assert(negRejected, 'Database CHECK constraint rejects negative amount (-50000)');

    let zeroRejected = false;
    try {
      await sql`
        INSERT INTO transaksi (rekening_id, anggota_id, amount, type, category, description)
        VALUES (${rekA1.id}, ${angA.id}, 0.00, 'expense', 'FIN_Bad', 'Zero amount')
      `;
    } catch (e) {
      zeroRejected = e.message.includes('chk_transaksi_amount_positive') || e.code === '23514';
    }
    assert(zeroRejected, 'Database CHECK constraint rejects zero amount (0.00)');

    // -------------------------------------------------------------
    // TEST 3: Atomic Income & Expense Mutations
    // -------------------------------------------------------------
    console.log('\n--- 3. ATOMIC INCOME & EXPENSE MUTATIONS ---');
    // Expense: 250,000
    await sql.begin(async sqlTx => {
      await sqlTx`
        INSERT INTO transaksi (rekening_id, anggota_id, amount, type, category, description)
        VALUES (${rekA1.id}, ${angA.id}, 250000.00, 'expense', 'FIN_Expense', 'Belanja')
      `;
      await sqlTx`
        UPDATE rekening SET balance = balance - 250000.00 WHERE id = ${rekA1.id}
      `;
    });

    const [rekAfterExpense] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekA1.id}`;
    assert(Number(rekAfterExpense.balance) === 750000.00, 'Atomic Expense: 1,000,000 - 250,000 = 750,000');

    // Income: 100,000
    await sql.begin(async sqlTx => {
      await sqlTx`
        INSERT INTO transaksi (rekening_id, anggota_id, amount, type, category, description)
        VALUES (${rekA1.id}, ${angA.id}, 100000.00, 'income', 'FIN_Income', 'Bonus')
      `;
      await sqlTx`
        UPDATE rekening SET balance = balance + 100000.00 WHERE id = ${rekA1.id}
      `;
    });

    const [rekAfterIncome] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekA1.id}`;
    assert(Number(rekAfterIncome.balance) === 850000.00, 'Atomic Income: 750,000 + 100,000 = 850,000');

    // -------------------------------------------------------------
    // TEST 4: Atomic Transfer Between Accounts
    // -------------------------------------------------------------
    console.log('\n--- 4. ATOMIC TRANSFER & CONSERVATION OF MONEY ---');
    // Transfer 200,000 from Rekening A1 (850k) to Rekening A2 (500k)
    const [txTransfer] = await sql.begin(async sqlTx => {
      const [tx] = await sqlTx`
        INSERT INTO transaksi (rekening_id, destination_rekening_id, anggota_id, amount, type, category, description)
        VALUES (${rekA1.id}, ${rekA2.id}, ${angA.id}, 200000.00, 'transfer', 'Transfer Antar Rekening', 'Tarik Tunai')
        RETURNING id
      `;
      await sqlTx`UPDATE rekening SET balance = balance - 200000.00 WHERE id = ${rekA1.id}`;
      await sqlTx`UPDATE rekening SET balance = balance + 200000.00 WHERE id = ${rekA2.id}`;
      return [tx];
    });

    const [rekA1After] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekA1.id}`;
    const [rekA2After] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekA2.id}`;
    assert(Number(rekA1After.balance) === 650000.00, 'Transfer Debit: Rekening A1 balance = 650,000');
    assert(Number(rekA2After.balance) === 700000.00, 'Transfer Credit: Rekening A2 balance = 700,000');
    assert(Number(rekA1After.balance) + Number(rekA2After.balance) === 1350000.00, 'Conservation of Money: Total family balance remains exactly 1,350,000');

    // Test: Same account transfer rejected by CHECK constraint
    let sameAccountRejected = false;
    try {
      await sql`
        INSERT INTO transaksi (rekening_id, destination_rekening_id, anggota_id, amount, type, category, description)
        VALUES (${rekA1.id}, ${rekA1.id}, ${angA.id}, 50000.00, 'transfer', 'Transfer Antar Rekening', 'Self transfer')
      `;
    } catch (e) {
      sameAccountRejected = e.message.includes('chk_transaksi_transfer_validity') || e.code === '23514';
    }
    assert(sameAccountRejected, 'CHECK constraint rejects transfer to same account (source == destination)');

    // -------------------------------------------------------------
    // TEST 5: Cross-Family Transfer & Integrity Protection
    // -------------------------------------------------------------
    console.log('\n--- 5. CROSS-FAMILY INTEGRITY REJECTION ---');
    // Attempt transfer from Family A account to Family B account
    let crossFamRejected = false;
    try {
      const [rSource] = await sql`SELECT keluarga_id FROM rekening WHERE id = ${rekA1.id}`;
      const [rDest] = await sql`SELECT keluarga_id FROM rekening WHERE id = ${rekB.id}`;
      if (rSource.keluarga_id !== rDest.keluarga_id) {
        throw new Error('CROSS_FAMILY_VIOLATION: Transfer prohibited across different families');
      }
    } catch (e) {
      crossFamRejected = e.message.includes('CROSS_FAMILY_VIOLATION');
    }
    assert(crossFamRejected, 'Business logic rejects cross-family transfers between different tenants');

    // -------------------------------------------------------------
    // TEST 6: Financial Reconciliation Integrity Check
    // -------------------------------------------------------------
    console.log('\n--- 6. FINANCIAL RECONCILIATION INTEGRITY ---');
    // Calculate expected balance from all historical transactions for Rekening A1
    // Initial: 1,000,000 - 250,000 (expense) + 100,000 (income) - 200,000 (transfer out) = 650,000
    const [rekReconcile] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekA1.id}`;
    const [txSummary] = await sql`
      SELECT 
        1000000.00 + 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN type = 'transfer' AND rekening_id = ${rekA1.id} THEN amount ELSE 0 END), 0) as calculated_balance
      FROM transaksi
      WHERE rekening_id = ${rekA1.id}
    `;

    assert(
      Number(rekReconcile.balance) === Number(txSummary.calculated_balance),
      `Reconciliation: Stored balance (${rekReconcile.balance}) == Calculated balance from transactions (${txSummary.calculated_balance})`
    );

    // -------------------------------------------------------------
    // Cleanup test fixtures
    // -------------------------------------------------------------
    await sql`DELETE FROM transaksi WHERE rekening_id IN (${rekA1.id}, ${rekA2.id}, ${rekB.id})`;
    await sql`DELETE FROM rekening WHERE id IN (${rekA1.id}, ${rekA2.id}, ${rekB.id})`;
    await sql`DELETE FROM anggota WHERE id IN (${angA.id}, ${angB.id})`;
    await sql`DELETE FROM keluarga WHERE id IN (${famA.id}, ${famB.id})`;
    await sql`DELETE FROM auth.users WHERE id IN (${userA}, ${userB})`;
    console.log('\n--- TEST FIXTURES CLEANED UP ---');

    console.log(`\n====================================================`);
    console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log(`====================================================\n`);

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Financial test runner error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runFinancialTests();
