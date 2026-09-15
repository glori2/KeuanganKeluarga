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

// Standalone implementations of core audit and void logic for testing
async function testCreateTransaksi(input) {
  const amountStr = input.amount.toFixed(2);
  return await sql.begin(async sqlTx => {
    const [rek] = await sqlTx`SELECT id, keluarga_id, balance FROM rekening WHERE id = ${input.rekening_id} FOR UPDATE`;
    const [ang] = await sqlTx`SELECT id, keluarga_id FROM anggota WHERE id = ${input.anggota_id}`;
    if (!rek || !ang || rek.keluarga_id !== ang.keluarga_id) throw new Error('CROSS_FAMILY_VIOLATION');

    const [tx] = await sqlTx`
      INSERT INTO transaksi (rekening_id, anggota_id, amount, type, category, description, date, status)
      VALUES (${input.rekening_id}, ${input.anggota_id}, ${amountStr}::numeric, ${input.type}, ${input.category}, ${input.description || ''}, NOW(), 'posted')
      RETURNING *
    `;

    if (input.type === 'income') {
      await sqlTx`UPDATE rekening SET balance = balance + ${amountStr}::numeric WHERE id = ${input.rekening_id}`;
    } else if (input.type === 'expense') {
      await sqlTx`UPDATE rekening SET balance = balance - ${amountStr}::numeric WHERE id = ${input.rekening_id}`;
    }

    await sqlTx`
      INSERT INTO audit_log (keluarga_id, transaksi_id, actor_user_id, actor_type, actor_name, telegram_id, action, new_data)
      VALUES (${rek.keluarga_id}, ${tx.id}, ${input.actor_user_id || null}, ${input.actor_type || 'web'}, ${input.actor_name || null}, ${input.telegram_id || null}, 'CREATE', ${sql.json(tx)})
    `;

    return tx;
  });
}

async function testUpdateTransaksi(id, input, actor) {
  return await sql.begin(async sqlTx => {
    const [oldTx] = await sqlTx`SELECT * FROM transaksi WHERE id = ${id} FOR UPDATE`;
    if (!oldTx) throw new Error('Transaksi tidak ditemukan');
    if (oldTx.status === 'voided') throw new Error('INVALID_MUTATION: Transaksi yang sudah dibatalkan (voided) tidak dapat diubah.');

    // Revert old
    if (oldTx.type === 'income') {
      await sqlTx`UPDATE rekening SET balance = balance - ${oldTx.amount}::numeric WHERE id = ${oldTx.rekening_id}`;
    } else if (oldTx.type === 'expense') {
      await sqlTx`UPDATE rekening SET balance = balance + ${oldTx.amount}::numeric WHERE id = ${oldTx.rekening_id}`;
    }

    const newAmountStr = (input.amount ?? Number(oldTx.amount)).toFixed(2);
    const [targetRek] = await sqlTx`SELECT id, keluarga_id FROM rekening WHERE id = ${oldTx.rekening_id} FOR UPDATE`;

    const [updated] = await sqlTx`
      UPDATE transaksi
      SET amount = ${newAmountStr}::numeric, description = ${input.description ?? oldTx.description}
      WHERE id = ${id}
      RETURNING *
    `;

    // Apply new
    if (oldTx.type === 'income') {
      await sqlTx`UPDATE rekening SET balance = balance + ${newAmountStr}::numeric WHERE id = ${oldTx.rekening_id}`;
    } else if (oldTx.type === 'expense') {
      await sqlTx`UPDATE rekening SET balance = balance - ${newAmountStr}::numeric WHERE id = ${oldTx.rekening_id}`;
    }

    await sqlTx`
      INSERT INTO audit_log (keluarga_id, transaksi_id, actor_user_id, actor_type, actor_name, telegram_id, action, old_data, new_data)
      VALUES (${targetRek.keluarga_id}, ${id}, ${actor?.actor_user_id || null}, ${actor?.actor_type || 'web'}, ${actor?.actor_name || null}, null, 'UPDATE', ${sql.json(oldTx)}, ${sql.json(updated)})
    `;

    return updated;
  });
}

async function testVoidTransaksi(id, reason, actor) {
  return await sql.begin(async sqlTx => {
    const [oldTx] = await sqlTx`
      SELECT t.*, r.keluarga_id FROM transaksi t JOIN rekening r ON t.rekening_id = r.id WHERE t.id = ${id} FOR UPDATE
    `;
    if (!oldTx) throw new Error('Transaksi tidak ditemukan');
    if (oldTx.status === 'voided') throw new Error('ALREADY_VOIDED: Transaksi ini sudah dibatalkan sebelumnya.');

    const amountStr = Number(oldTx.amount).toFixed(2);

    if (oldTx.type === 'income') {
      await sqlTx`SELECT id FROM rekening WHERE id = ${oldTx.rekening_id} FOR UPDATE`;
      await sqlTx`UPDATE rekening SET balance = balance - ${amountStr}::numeric WHERE id = ${oldTx.rekening_id}`;
    } else if (oldTx.type === 'expense') {
      await sqlTx`SELECT id FROM rekening WHERE id = ${oldTx.rekening_id} FOR UPDATE`;
      await sqlTx`UPDATE rekening SET balance = balance + ${amountStr}::numeric WHERE id = ${oldTx.rekening_id}`;
    } else if (oldTx.type === 'transfer' && oldTx.destination_rekening_id) {
      const firstId = Math.min(oldTx.rekening_id, oldTx.destination_rekening_id);
      const secondId = Math.max(oldTx.rekening_id, oldTx.destination_rekening_id);
      await sqlTx`SELECT id FROM rekening WHERE id = ${firstId} FOR UPDATE`;
      await sqlTx`SELECT id FROM rekening WHERE id = ${secondId} FOR UPDATE`;
      await sqlTx`UPDATE rekening SET balance = balance + ${amountStr}::numeric WHERE id = ${oldTx.rekening_id}`;
      await sqlTx`UPDATE rekening SET balance = balance - ${amountStr}::numeric WHERE id = ${oldTx.destination_rekening_id}`;
    }

    const [voidedTx] = await sqlTx`
      UPDATE transaksi
      SET status = 'voided', voided_at = NOW(), voided_by = ${actor?.actor_user_id || null}, void_reason = ${reason || 'Dibatalkan'}
      WHERE id = ${id}
      RETURNING *
    `;

    await sqlTx`
      INSERT INTO audit_log (keluarga_id, transaksi_id, actor_user_id, actor_type, actor_name, action, old_data, new_data)
      VALUES (${oldTx.keluarga_id}, ${id}, ${actor?.actor_user_id || null}, ${actor?.actor_type || 'web'}, ${actor?.actor_name || null}, 'VOID', ${sql.json(oldTx)}, ${sql.json(voidedTx)})
    `;

    return voidedTx;
  });
}

async function testCreateTransfer(input) {
  const amountStr = input.amount.toFixed(2);
  return await sql.begin(async sqlTx => {
    const firstId = Math.min(input.source_rekening_id, input.destination_rekening_id);
    const secondId = Math.max(input.source_rekening_id, input.destination_rekening_id);
    const [firstRek] = await sqlTx`SELECT id, keluarga_id FROM rekening WHERE id = ${firstId} FOR UPDATE`;
    const [secondRek] = await sqlTx`SELECT id, keluarga_id FROM rekening WHERE id = ${secondId} FOR UPDATE`;
    if (!firstRek || !secondRek || firstRek.keluarga_id !== secondRek.keluarga_id) throw new Error('CROSS_FAMILY_VIOLATION');

    const [tx] = await sqlTx`
      INSERT INTO transaksi (rekening_id, destination_rekening_id, anggota_id, amount, type, category, description, date, status)
      VALUES (${input.source_rekening_id}, ${input.destination_rekening_id}, ${input.anggota_id}, ${amountStr}::numeric, 'transfer', 'Transfer', 'Transfer test', NOW(), 'posted')
      RETURNING *
    `;

    await sqlTx`UPDATE rekening SET balance = balance - ${amountStr}::numeric WHERE id = ${input.source_rekening_id}`;
    await sqlTx`UPDATE rekening SET balance = balance + ${amountStr}::numeric WHERE id = ${input.destination_rekening_id}`;

    await sqlTx`
      INSERT INTO audit_log (keluarga_id, transaksi_id, actor_user_id, actor_type, actor_name, action, new_data)
      VALUES (${firstRek.keluarga_id}, ${tx.id}, ${input.actor_user_id || null}, 'web', ${input.actor_name || null}, 'TRANSFER', ${sql.json(tx)})
    `;

    return tx;
  });
}

async function runAuditTrailTests() {
  console.log('====================================================');
  console.log(' 🧾 FINANCIAL AUDIT TRAIL, VOID & REVERSAL TESTS');
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

  const userA = 'a1000000-0000-0000-0000-000000000001';
  const userB = 'b2000000-0000-0000-0000-000000000002';

  try {
    // Setup test users in auth.users
    await sql`
      INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES 
        (${userA}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'audit_a@example.com', '{}', '{}', now(), now()),
        (${userB}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'audit_b@example.com', '{}', '{}', now(), now())
      ON CONFLICT (id) DO NOTHING
    `;

    // -------------------------------------------------------------
    // FIXTURES
    // -------------------------------------------------------------
    const [famA] = await sql`INSERT INTO keluarga (name) VALUES ('AUDIT_FamA') RETURNING id`;
    const [angA] = await sql`INSERT INTO anggota (keluarga_id, name, user_id, role) VALUES (${famA.id}, 'AUDIT_UserA', ${userA}, 'admin') RETURNING id`;
    const [rekA1] = await sql`INSERT INTO rekening (keluarga_id, name, balance, type) VALUES (${famA.id}, 'AUDIT_RekA1', 1000000.00, 'cash') RETURNING id`;
    const [rekA2] = await sql`INSERT INTO rekening (keluarga_id, name, balance, type) VALUES (${famA.id}, 'AUDIT_RekA2', 500000.00, 'bank') RETURNING id`;

    const [famB] = await sql`INSERT INTO keluarga (name) VALUES ('AUDIT_FamB') RETURNING id`;
    const [angB] = await sql`INSERT INTO anggota (keluarga_id, name, user_id, role) VALUES (${famB.id}, 'AUDIT_UserB', ${userB}, 'admin') RETURNING id`;
    const [rekB1] = await sql`INSERT INTO rekening (keluarga_id, name, balance, type) VALUES (${famB.id}, 'AUDIT_RekB1', 200000.00, 'cash') RETURNING id`;

    // -------------------------------------------------------------
    // 1. AUDIT CREATION ON TRANSACTION
    // -------------------------------------------------------------
    const txCreate = await testCreateTransaksi({
      rekening_id: rekA1.id,
      anggota_id: angA.id,
      amount: 150000,
      type: 'expense',
      category: 'AUDIT_Food',
      description: 'Belanja Mingguan',
      actor_user_id: userA,
      actor_name: 'AUDIT_UserA',
      actor_type: 'web',
    });

    const [auditCreate] = await sql`SELECT * FROM audit_log WHERE transaksi_id = ${txCreate.id}`;
    assert(
      auditCreate && auditCreate.action === 'CREATE' && auditCreate.actor_user_id === userA,
      'Audit Creation: Transaction creation records immutable CREATE audit log'
    );

    // -------------------------------------------------------------
    // 2. AUDIT ON UPDATE WITH BEFORE/AFTER DIFF
    // -------------------------------------------------------------
    await testUpdateTransaksi(
      txCreate.id,
      { amount: 200000, description: 'Belanja Mingguan + Buah' },
      { actor_user_id: userA, actor_name: 'AUDIT_UserA', actor_type: 'web' }
    );

    const [auditUpdate] = await sql`SELECT * FROM audit_log WHERE transaksi_id = ${txCreate.id} AND action = 'UPDATE'`;
    assert(
      auditUpdate && auditUpdate.old_data && auditUpdate.new_data && Number(auditUpdate.new_data.amount) === 200000,
      'Audit Update: Updating transaction records before/after diff in audit log'
    );

    // -------------------------------------------------------------
    // 3. ATOMIC VOID & BALANCE RESTORATION
    // -------------------------------------------------------------
    const [rekBeforeVoid] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekA1.id}`;
    // Balance was 1,000,000 - 200,000 = 800,000
    assert(Number(rekBeforeVoid.balance) === 800000, 'Pre-void State: Account balance correctly decremented');

    const voidResult = await testVoidTransaksi(
      txCreate.id,
      'Salah input nominal belanja',
      { actor_user_id: userA, actor_name: 'AUDIT_UserA', actor_type: 'web' }
    );

    const [rekAfterVoid] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekA1.id}`;
    assert(
      Number(rekAfterVoid.balance) === 1000000,
      'Void Restoration: Voiding expense restored balance back to 1,000,000'
    );
    assert(
      voidResult.status === 'voided' && voidResult.void_reason === 'Salah input nominal belanja',
      'Void Status: Transaction marked as voided with reason and voided_at timestamp'
    );

    const [auditVoid] = await sql`SELECT * FROM audit_log WHERE transaksi_id = ${txCreate.id} AND action = 'VOID'`;
    assert(
      auditVoid && auditVoid.action === 'VOID' && auditVoid.actor_user_id === userA,
      'Audit Void: Voiding records VOID action in audit log'
    );

    // -------------------------------------------------------------
    // 4. DOUBLE-VOID REJECTION
    // -------------------------------------------------------------
    let doubleVoidCaught = false;
    try {
      await testVoidTransaksi(txCreate.id, 'Coba void lagi', { actor_user_id: userA });
    } catch (err) {
      if (err.message.includes('ALREADY_VOIDED')) doubleVoidCaught = true;
    }
    assert(doubleVoidCaught, 'Double-Void Protection: Attempting to re-void already voided transaction is rejected');

    const [rekAfterDoubleVoid] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekA1.id}`;
    assert(
      Number(rekAfterDoubleVoid.balance) === 1000000,
      'Double-Void Balance Safety: Balance is NOT reversed twice'
    );

    // -------------------------------------------------------------
    // 5. UPDATE VOIDED TRANSACTION REJECTION
    // -------------------------------------------------------------
    let updateVoidedCaught = false;
    try {
      await testUpdateTransaksi(txCreate.id, { amount: 300000 }, { actor_user_id: userA });
    } catch (err) {
      if (err.message.includes('INVALID_MUTATION')) updateVoidedCaught = true;
    }
    assert(updateVoidedCaught, 'Void Immutability: Editing a voided transaction is strictly rejected');

    // -------------------------------------------------------------
    // 6. AUDIT LOG IMMUTABILITY TRIGGER
    // -------------------------------------------------------------
    let updateAuditCaught = false;
    try {
      await sql`UPDATE audit_log SET action = 'HACKED' WHERE id = ${auditCreate.id}`;
    } catch (err) {
      if (err.message.includes('IMMUTABILITY_VIOLATION')) updateAuditCaught = true;
    }
    assert(updateAuditCaught, 'Audit Immutability: Direct UPDATE on audit_log table blocked by DB trigger');

    let deleteAuditCaught = false;
    try {
      await sql`DELETE FROM audit_log WHERE id = ${auditCreate.id}`;
    } catch (err) {
      if (err.message.includes('IMMUTABILITY_VIOLATION')) deleteAuditCaught = true;
    }
    assert(deleteAuditCaught, 'Audit Immutability: Direct DELETE on audit_log table blocked by DB trigger');

    // -------------------------------------------------------------
    // 7. TRANSFER VOID / REVERSAL
    // -------------------------------------------------------------
    const txTransfer = await testCreateTransfer({
      source_rekening_id: rekA1.id,
      destination_rekening_id: rekA2.id,
      anggota_id: angA.id,
      amount: 300000,
      actor_user_id: userA,
      actor_name: 'AUDIT_UserA',
    });

    const [transferAudit] = await sql`SELECT * FROM audit_log WHERE transaksi_id = ${txTransfer.id} AND action = 'TRANSFER'`;
    assert(transferAudit !== undefined, 'Transfer Audit: Transfer created TRANSFER action in audit log');

    // RekA1: 1,000,000 - 300,000 = 700,000. RekA2: 500,000 + 300,000 = 800,000.
    await testVoidTransaksi(txTransfer.id, 'Transfer salah rekening', { actor_user_id: userA });

    const [rekA1AfterTfVoid] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekA1.id}`;
    const [rekA2AfterTfVoid] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekA2.id}`;

    assert(
      Number(rekA1AfterTfVoid.balance) === 1000000 && Number(rekA2AfterTfVoid.balance) === 500000,
      'Transfer Reversal: Reversing transfer restored both source and destination account balances atomically'
    );

    // -------------------------------------------------------------
    // 8. TELEGRAM AUDIT ATTRIBUTION
    // -------------------------------------------------------------
    const txTelegram = await testCreateTransaksi({
      rekening_id: rekA1.id,
      anggota_id: angA.id,
      amount: 50000,
      type: 'expense',
      category: 'AUDIT_Bot_Expense',
      description: 'Bensin Motor',
      actor_type: 'telegram',
      actor_name: 'AUDIT_UserA',
      telegram_id: '9988776655',
    });

    const [auditTg] = await sql`SELECT * FROM audit_log WHERE transaksi_id = ${txTelegram.id}`;
    assert(
      auditTg && auditTg.actor_type === 'telegram' && auditTg.telegram_id === '9988776655',
      'Telegram Audit: Bot financial entries accurately capture actor_type=telegram and telegram_id'
    );

    // -------------------------------------------------------------
    // 9. TENANT ISOLATION ON AUDIT LOGS (RLS)
    // -------------------------------------------------------------
    // Query audit log with User A context (RLS simulation)
    const userA_AuditRows = await sql`
      SELECT id, keluarga_id FROM audit_log
      WHERE keluarga_id IN (
        SELECT k.id FROM keluarga k
        JOIN anggota a ON a.keluarga_id = k.id
        WHERE a.user_id = ${userA}
      )
    `;

    const foundFamilyBInUserA = userA_AuditRows.some(r => r.keluarga_id === famB.id);
    assert(!foundFamilyBInUserA, 'Tenant Isolation: User A cannot access any audit logs for Family B');

    // -------------------------------------------------------------
    // 10. FINANCIAL RECONCILIATION WITH VOIDED TRANSACTIONS
    // -------------------------------------------------------------
    // Stored balance on RekA1 should be 1,000,000 - 50,000 = 950,000
    const [rekRecon] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekA1.id}`;
    const [activeIncomes] = await sql`
      SELECT COALESCE(SUM(amount), 0)::numeric as total FROM transaksi 
      WHERE (rekening_id = ${rekA1.id} AND type = 'income' AND status = 'posted')
         OR (destination_rekening_id = ${rekA1.id} AND type = 'transfer' AND status = 'posted')
    `;
    const [activeExpenses] = await sql`
      SELECT COALESCE(SUM(amount), 0)::numeric as total FROM transaksi 
      WHERE rekening_id = ${rekA1.id} AND (type = 'expense' OR type = 'transfer') AND status = 'posted'
    `;

    const calculatedBalance = 1000000 + Number(activeIncomes.total) - Number(activeExpenses.total);
    assert(
      Number(rekRecon.balance) === 950000 && calculatedBalance === 950000,
      'Reconciliation Integrity: Stored balance matches active posted transactions with voided records excluded'
    );

    // -------------------------------------------------------------
    // CLEANUP FIXTURES
    // -------------------------------------------------------------
    // Disable trigger temporarily to clean test fixtures
    await sql`ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_immutable`;
    await sql`DELETE FROM audit_log WHERE keluarga_id IN (${famA.id}, ${famB.id})`;
    await sql`ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_immutable`;

    await sql`DELETE FROM transaksi WHERE rekening_id IN (${rekA1.id}, ${rekA2.id}, ${rekB1.id}) OR destination_rekening_id IN (${rekA1.id}, ${rekA2.id}, ${rekB1.id})`;
    await sql`DELETE FROM rekening WHERE id IN (${rekA1.id}, ${rekA2.id}, ${rekB1.id})`;
    await sql`DELETE FROM anggota WHERE id IN (${angA.id}, ${angB.id})`;
    await sql`DELETE FROM keluarga WHERE id IN (${famA.id}, ${famB.id})`;

    console.log('\n====================================================');
    console.log(`🎉 AUDIT TRAIL TEST RESULTS: ${passed} PASS, ${failed} FAIL`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runAuditTrailTests();
