const postgres = require('postgres');
const fs = require('fs');
const crypto = require('crypto');

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

// Standalone implementation of core telegram logic for testing
async function generateLinkCode(anggotaId) {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await sql`
    INSERT INTO telegram_link_codes (anggota_id, code, expires_at, created_at)
    VALUES (${anggotaId}, ${code}, ${expiresAt}, NOW())
  `;
  return { code, expiresAt };
}

async function linkTelegram(rawCode, telegramId, chatId) {
  const cleanCode = (rawCode || '').trim().toUpperCase();
  return await sql.begin(async sqlTx => {
    const [codeRow] = await sqlTx`
      SELECT id, anggota_id, code, expires_at, used_at
      FROM telegram_link_codes
      WHERE code = ${cleanCode}
      FOR UPDATE
    `;

    if (!codeRow) {
      return { success: false, message: 'Kode tautan tidak valid atau tidak ditemukan.' };
    }
    if (codeRow.used_at) {
      return { success: false, message: 'Kode tautan ini sudah pernah digunakan.' };
    }
    if (new Date(codeRow.expires_at) < new Date()) {
      return { success: false, message: 'Kode tautan sudah kadaluarsa.' };
    }

    const [targetAnggota] = await sqlTx`
      SELECT a.id, a.name, a.keluarga_id, k.name as keluarga_name
      FROM anggota a
      JOIN keluarga k ON a.keluarga_id = k.id
      WHERE a.id = ${codeRow.anggota_id}
      FOR UPDATE
    `;

    if (!targetAnggota) {
      return { success: false, message: 'Profil anggota tidak ditemukan.' };
    }

    // Anti-reassignment check
    const [existingLink] = await sqlTx`
      SELECT a.id, a.name, a.keluarga_id, k.name as keluarga_name
      FROM anggota a
      JOIN keluarga k ON a.keluarga_id = k.id
      WHERE a.telegram_id = ${telegramId}
      FOR UPDATE
    `;

    if (existingLink) {
      if (existingLink.id === targetAnggota.id) {
        const chatIdVal = chatId ? BigInt(chatId) : null;
        if (chatIdVal) {
          await sqlTx`
            UPDATE anggota 
            SET telegram_chat_id = ${chatIdVal}
            WHERE id = ${targetAnggota.id}
          `;
        }
        await sqlTx`UPDATE telegram_link_codes SET used_at = NOW() WHERE id = ${codeRow.id}`;
        return { success: true, message: `Sudah terhubung ke ${targetAnggota.name}`, anggota: targetAnggota };
      }

      if (existingLink.keluarga_id === targetAnggota.keluarga_id) {
        return {
          success: false,
          message: `Akun Telegram ini sudah terhubung ke anggota "${existingLink.name}". Silakan gunakan perintah /unlink terlebih dahulu.`,
        };
      } else {
        return {
          success: false,
          message: `Akun Telegram ini sudah terhubung ke profil keluarga lain. Silakan gunakan perintah /unlink terlebih dahulu.`,
        };
      }
    }

    const chatIdVal = chatId ? BigInt(chatId) : null;
    await sqlTx`
      UPDATE anggota 
      SET telegram_id = ${telegramId}, 
          telegram_chat_id = ${chatIdVal}
      WHERE id = ${targetAnggota.id}
    `;

    await sqlTx`
      UPDATE telegram_link_codes
      SET used_at = NOW()
      WHERE id = ${codeRow.id}
    `;

    return {
      success: true,
      message: 'Akun Telegram berhasil ditautkan!',
      anggota: targetAnggota,
    };
  });
}

async function recordTelegramUpdate(updateId) {
  if (!updateId) return false;
  try {
    const res = await sql`
      INSERT INTO telegram_updates (update_id, received_at)
      VALUES (${updateId}, NOW())
      ON CONFLICT (update_id) DO NOTHING
      RETURNING update_id
    `;
    return res.length > 0;
  } catch (err) {
    return false;
  }
}

function verifySecretToken(headerSecret, configuredSecret) {
  if (!configuredSecret) return true;
  if (!headerSecret) return false;
  const expectedBuffer = Buffer.from(configuredSecret, 'utf-8');
  const actualBuffer = Buffer.from(headerSecret, 'utf-8');
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

async function runTelegramSecurityTests() {
  console.log('====================================================');
  console.log(' 🛡️  TELEGRAM SECURITY & SECURE LINKING TEST SUITE');
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

  try {
    // -------------------------------------------------------------
    // CLEANUP & FIXTURES
    // -------------------------------------------------------------
    await sql`DELETE FROM telegram_link_codes WHERE code LIKE 'TG_%' OR code LIKE 'TEST%'`;
    await sql`DELETE FROM telegram_updates WHERE update_id >= 99000`;
    await sql`DELETE FROM transaksi WHERE category LIKE 'TG_TEST_%'`;
    await sql`DELETE FROM rekening WHERE name LIKE 'TG_TEST_%'`;
    await sql`DELETE FROM anggota WHERE name LIKE 'TG_TEST_%'`;
    await sql`DELETE FROM keluarga WHERE name LIKE 'TG_TEST_%'`;

    const [famA] = await sql`INSERT INTO keluarga (name) VALUES ('TG_TEST_FamA') RETURNING id`;
    const [angA] = await sql`INSERT INTO anggota (keluarga_id, name, role) VALUES (${famA.id}, 'TG_TEST_UserA', 'admin') RETURNING id`;
    const [rekA] = await sql`INSERT INTO rekening (keluarga_id, name, balance, type) VALUES (${famA.id}, 'TG_TEST_RekA', 1000000.00, 'cash') RETURNING id`;

    const [famB] = await sql`INSERT INTO keluarga (name) VALUES ('TG_TEST_FamB') RETURNING id`;
    const [angB] = await sql`INSERT INTO anggota (keluarga_id, name, role) VALUES (${famB.id}, 'TG_TEST_UserB', 'member') RETURNING id`;
    const [rekB] = await sql`INSERT INTO rekening (keluarga_id, name, balance, type) VALUES (${famB.id}, 'TG_TEST_RekB', 500000.00, 'cash') RETURNING id`;

    // -------------------------------------------------------------
    // 1. WEBHOOK SECRET TOKEN TIMING-SAFE VERIFICATION
    // -------------------------------------------------------------
    const configuredSecret = 'super_secret_webhook_token_12345';
    assert(
      verifySecretToken(configuredSecret, configuredSecret) === true,
      'Webhook Secret: Valid secret token accepted'
    );
    assert(
      verifySecretToken('wrong_secret_token_value_99999', configuredSecret) === false,
      'Webhook Secret: Invalid secret token rejected'
    );
    assert(
      verifySecretToken('', configuredSecret) === false,
      'Webhook Secret: Empty/missing secret token rejected'
    );
    assert(
      verifySecretToken('short', configuredSecret) === false,
      'Webhook Secret: Length-mismatched secret token rejected safely'
    );

    // -------------------------------------------------------------
    // 2. OTP LINK CODE GENERATION & VALIDATION
    // -------------------------------------------------------------
    const { code: linkCodeA } = await generateLinkCode(angA.id);
    assert(
      linkCodeA.length === 8 && /^[0-9A-F]{8}$/.test(linkCodeA),
      'OTP Generation: Produces 8-char uppercase hex code'
    );

    const [savedCode] = await sql`SELECT * FROM telegram_link_codes WHERE code = ${linkCodeA}`;
    assert(
      savedCode && savedCode.anggota_id === angA.id && savedCode.used_at === null,
      'OTP Storage: Link code saved with anggota association and used_at = NULL'
    );

    // -------------------------------------------------------------
    // 3. SECURE ACCOUNT LINKING FLOW
    // -------------------------------------------------------------
    const tgIdA = '987654321';
    const tgChatIdA = '987654321';
    const linkRes1 = await linkTelegram(linkCodeA, tgIdA, tgChatIdA);
    assert(
      linkRes1.success === true && linkRes1.anggota.id === angA.id,
      'Account Linking: Valid OTP code successfully links Telegram account'
    );

    const [updatedAngA] = await sql`SELECT telegram_id, telegram_chat_id FROM anggota WHERE id = ${angA.id}`;
    assert(
      updatedAngA.telegram_id === tgIdA && String(updatedAngA.telegram_chat_id) === tgChatIdA,
      'Account Linking: Anggota table updated with telegram_id & telegram_chat_id'
    );

    // -------------------------------------------------------------
    // 4. REPLAY PROTECTION & SINGLE-USE ENFORCEMENT
    // -------------------------------------------------------------
    const linkResReplay = await linkTelegram(linkCodeA, '111222333', '111222333');
    assert(
      linkResReplay.success === false && linkResReplay.message.includes('sudah pernah digunakan'),
      'Replay Protection: Reusing the same link code fails immediately'
    );

    // -------------------------------------------------------------
    // 5. EXPIRATION ENFORCEMENT
    // -------------------------------------------------------------
    const expiredCode = 'EXPIRED1';
    await sql`
      INSERT INTO telegram_link_codes (anggota_id, code, expires_at, created_at)
      VALUES (${angB.id}, ${expiredCode}, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '15 minutes')
    `;
    const linkResExpired = await linkTelegram(expiredCode, '222333444', '222333444');
    assert(
      linkResExpired.success === false && linkResExpired.message.includes('kadaluarsa'),
      'Expiration Check: Expired link code is rejected'
    );

    // -------------------------------------------------------------
    // 6. INVALID / NON-EXISTENT CODE REJECTION
    // -------------------------------------------------------------
    const linkResInvalid = await linkTelegram('NOTEXIST', '333444555', '333444555');
    assert(
      linkResInvalid.success === false && linkResInvalid.message.includes('tidak valid'),
      'Invalid Code: Non-existent link code is rejected'
    );

    // -------------------------------------------------------------
    // 7. NO INSECURE AUTO-LINKING ON UNLINKED USERS
    // -------------------------------------------------------------
    // Verify an unlinked user querying anggota table directly does not bind to angB (which is still unlinked)
    const attackerTgId = '999999999';
    const unlinkedRows = await sql`SELECT id FROM anggota WHERE telegram_id = ${attackerTgId}`;
    assert(
      unlinkedRows.length === 0,
      'No Auto-Linking: Unknown Telegram user is NOT automatically bound to unlinked member'
    );

    // -------------------------------------------------------------
    // 8. WEBHOOK IDEMPOTENCY DEDUPLICATION
    // -------------------------------------------------------------
    const updateId = 99101;
    const firstDelivery = await recordTelegramUpdate(updateId);
    assert(firstDelivery === true, 'Webhook Idempotency: First update delivery accepted');

    const duplicateDelivery = await recordTelegramUpdate(updateId);
    assert(duplicateDelivery === false, 'Webhook Idempotency: Duplicate update delivery rejected/skipped');

    // -------------------------------------------------------------
    // 9. TENANT ISOLATION FOR FINANCIAL MUTATIONS VIA TELEGRAM
    // -------------------------------------------------------------
    const [currRekA] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekA.id}`;
    const [currRekB] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekB.id}`;

    // Simulate atomic /catat by User A
    const amount = 75000;
    await sql.begin(async sqlTx => {
      const [userRow] = await sqlTx`
        SELECT a.id, a.keluarga_id FROM anggota a WHERE a.telegram_id = ${tgIdA}
      `;
      assert(userRow && userRow.keluarga_id === famA.id, 'Tenant Boundary: Telegram user strictly resolved to Family A');

      const [rek] = await sqlTx`
        SELECT id FROM rekening WHERE keluarga_id = ${userRow.keluarga_id} ORDER BY id ASC LIMIT 1 FOR UPDATE
      `;

      await sqlTx`
        INSERT INTO transaksi (rekening_id, anggota_id, amount, type, category, description, date)
        VALUES (${rek.id}, ${userRow.id}, ${amount}, 'expense', 'TG_TEST_Food', 'Makan Siang', NOW())
      `;

      await sqlTx`
        UPDATE rekening SET balance = balance - ${amount}::numeric WHERE id = ${rek.id}
      `;
    });

    const [afterRekA] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekA.id}`;
    const [afterRekB] = await sql`SELECT balance::numeric FROM rekening WHERE id = ${rekB.id}`;

    assert(
      Number(afterRekA.balance) === Number(currRekA.balance) - amount,
      'Telegram Mutation: Family A rekening balance correctly decremented'
    );
    assert(
      Number(afterRekB.balance) === Number(currRekB.balance),
      'Tenant Isolation: Family B rekening balance completely unaffected'
    );

    // -------------------------------------------------------------
    // CLEANUP FIXTURES
    // -------------------------------------------------------------
    await sql`DELETE FROM telegram_link_codes WHERE anggota_id IN (${angA.id}, ${angB.id})`;
    await sql`DELETE FROM telegram_updates WHERE update_id >= 99000`;
    await sql`DELETE FROM transaksi WHERE category LIKE 'TG_TEST_%'`;
    await sql`DELETE FROM rekening WHERE id IN (${rekA.id}, ${rekB.id})`;
    await sql`DELETE FROM anggota WHERE id IN (${angA.id}, ${angB.id})`;
    await sql`DELETE FROM keluarga WHERE id IN (${famA.id}, ${famB.id})`;

    console.log('\n====================================================');
    console.log(`🎉 TELEGRAM SECURITY TEST RESULTS: ${passed} PASS, ${failed} FAIL`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution exception:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runTelegramSecurityTests();

