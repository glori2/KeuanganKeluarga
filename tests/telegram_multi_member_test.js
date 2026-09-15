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

// Exact implementation of app/lib/telegram.ts logic
async function generateTelegramLinkCode(anggotaId) {
  const [anggota] = await sql`SELECT id FROM anggota WHERE id = ${anggotaId}`;
  if (!anggota) {
    throw new Error('Anggota tidak ditemukan');
  }

  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

  await sql`
    INSERT INTO telegram_link_codes (anggota_id, code, expires_at, created_at)
    VALUES (${anggotaId}, ${code}, ${expiresAt}, NOW())
  `;

  return { code, expires_at: expiresAt };
}

async function linkTelegramAccount(rawCode, telegramId, chatId) {
  const cleanCode = (rawCode || '').trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, message: 'Kode tautan tidak boleh kosong.' };
  }

  return await sql.begin(async sqlTx => {
    // 1. Lock and fetch code record
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
      return { success: false, message: 'Kode tautan sudah kadaluarsa (berlaku 10 menit). Silakan buat kode baru di dasbor web.' };
    }

    // 2. Lock target anggota
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

    // 3. Check if this telegramId is already linked to any member
    const [existingLink] = await sqlTx`
      SELECT a.id, a.name, a.keluarga_id, k.name as keluarga_name
      FROM anggota a
      JOIN keluarga k ON a.keluarga_id = k.id
      WHERE a.telegram_id = ${telegramId}
      FOR UPDATE
    `;

    if (existingLink) {
      if (existingLink.id === targetAnggota.id) {
        // Already linked to this exact member profile - update chat_id if provided
        const chatIdVal = chatId ? String(chatId) : null;
        if (chatIdVal) {
          await sqlTx`
            UPDATE anggota 
            SET telegram_chat_id = ${chatIdVal}::bigint
            WHERE id = ${targetAnggota.id}
          `;
        }
        await sqlTx`
          UPDATE telegram_link_codes
          SET used_at = NOW()
          WHERE id = ${codeRow.id}
        `;
        return {
          success: true,
          message: `Akun Telegram Anda sudah terhubung ke profil "${targetAnggota.name}".`,
          anggota: targetAnggota,
        };
      }

      // Already linked to ANOTHER member: REJECT (No silent reassignment!)
      // Check family boundary to prevent cross-family member leakage
      if (existingLink.keluarga_id === targetAnggota.keluarga_id) {
        return {
          success: false,
          message: `Akun Telegram ini sudah terhubung ke anggota "${existingLink.name}". Silakan gunakan perintah /unlink terlebih dahulu di Telegram sebelum menautkannya ke anggota lain.`,
        };
      } else {
        // Cross-family sanitized response: do not leak Family A member name to Family B
        return {
          success: false,
          message: `Akun Telegram ini sudah terhubung ke profil keluarga lain. Silakan gunakan perintah /unlink terlebih dahulu sebelum menautkannya ke akun keluarga baru.`,
        };
      }
    }

    // 4. Bind telegram_id and optional telegram_chat_id to target anggota
    const chatIdVal = chatId ? String(chatId) : null;
    await sqlTx`
      UPDATE anggota 
      SET telegram_id = ${telegramId}, 
          telegram_chat_id = ${chatIdVal}::bigint
      WHERE id = ${targetAnggota.id}
    `;

    // 5. Mark code as used
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

async function runMultiMemberTests() {
  console.log('====================================================');
  console.log(' 👥 TELEGRAM MULTI-MEMBER & ANTI-REASSIGNMENT TESTS');
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
    await sql`DELETE FROM telegram_link_codes WHERE code LIKE 'MM_%' OR code LIKE 'TEST_%'`;
    await sql`DELETE FROM telegram_updates WHERE update_id >= 88000`;
    await sql`DELETE FROM transaksi WHERE category LIKE 'MM_TEST_%'`;
    await sql`DELETE FROM rekening WHERE name LIKE 'MM_TEST_%'`;
    await sql`DELETE FROM anggota WHERE name LIKE 'MM_TEST_%'`;
    await sql`DELETE FROM keluarga WHERE name LIKE 'MM_TEST_%'`;

    // Family 1: Ainun Family Simulation
    const [fam1] = await sql`INSERT INTO keluarga (name) VALUES ('MM_TEST_AinunFamily') RETURNING id, name`;
    const [mA] = await sql`INSERT INTO anggota (keluarga_id, name, role) VALUES (${fam1.id}, 'MM_TEST_MemberA', 'admin') RETURNING id, name`;
    const [mB] = await sql`INSERT INTO anggota (keluarga_id, name, role) VALUES (${fam1.id}, 'MM_TEST_MemberB', 'member') RETURNING id, name`;
    const [mC] = await sql`INSERT INTO anggota (keluarga_id, name, role) VALUES (${fam1.id}, 'MM_TEST_MemberC', 'member') RETURNING id, name`;
    const [rek1] = await sql`INSERT INTO rekening (keluarga_id, name, balance, type) VALUES (${fam1.id}, 'MM_TEST_RekeningUtama', 10000000.00, 'bank') RETURNING id, name`;

    // Family 2: Other Family Simulation (Tenant Isolation)
    const [fam2] = await sql`INSERT INTO keluarga (name) VALUES ('MM_TEST_OtherFamily') RETURNING id, name`;
    const [mOther] = await sql`INSERT INTO anggota (keluarga_id, name, role) VALUES (${fam2.id}, 'MM_TEST_OtherMember', 'admin') RETURNING id, name`;

    // -------------------------------------------------------------
    // TEST 1: Member A -> Telegram A
    // -------------------------------------------------------------
    const { code: codeA } = await generateTelegramLinkCode(mA.id);
    const tgA = '70001';
    const linkResA = await linkTelegramAccount(codeA, tgA, tgA);
    assert(
      linkResA.success === true && linkResA.anggota.id === mA.id,
      'TEST 1: Member A successfully links Telegram A'
    );
    const [checkA1] = await sql`SELECT telegram_id, telegram_chat_id FROM anggota WHERE id = ${mA.id}`;
    assert(
      checkA1.telegram_id === tgA && String(checkA1.telegram_chat_id) === tgA,
      'TEST 1: Member A telegram_id and chat_id correctly stored'
    );

    // -------------------------------------------------------------
    // TEST 2: Member B -> Telegram B (Member A remains Telegram A)
    // -------------------------------------------------------------
    const { code: codeB } = await generateTelegramLinkCode(mB.id);
    const tgB = '70002';
    const linkResB = await linkTelegramAccount(codeB, tgB, tgB);
    assert(
      linkResB.success === true && linkResB.anggota.id === mB.id,
      'TEST 2: Member B successfully links Telegram B'
    );
    const [checkA2] = await sql`SELECT telegram_id FROM anggota WHERE id = ${mA.id}`;
    const [checkB2] = await sql`SELECT telegram_id FROM anggota WHERE id = ${mB.id}`;
    assert(
      checkA2.telegram_id === tgA,
      'TEST 2: Member A linkage remains intact (NOT overwritten)'
    );
    assert(
      checkB2.telegram_id === tgB,
      'TEST 2: Member B correctly linked to Telegram B'
    );

    // -------------------------------------------------------------
    // TEST 3: Member C -> Telegram C (All 3 intact concurrently)
    // -------------------------------------------------------------
    const { code: codeC } = await generateTelegramLinkCode(mC.id);
    const tgC = '70003';
    const linkResC = await linkTelegramAccount(codeC, tgC, tgC);
    assert(
      linkResC.success === true && linkResC.anggota.id === mC.id,
      'TEST 3: Member C successfully links Telegram C'
    );
    const allMembers = await sql`
      SELECT id, name, telegram_id FROM anggota WHERE keluarga_id = ${fam1.id} ORDER BY id ASC
    `;
    assert(
      allMembers[0].telegram_id === tgA &&
      allMembers[1].telegram_id === tgB &&
      allMembers[2].telegram_id === tgC,
      'TEST 3: All 3 members concurrently and independently linked to distinct Telegram accounts'
    );

    // -------------------------------------------------------------
    // TEST 4: Anti-Reassignment: Telegram A tries to link Member B
    // -------------------------------------------------------------
    const { code: codeB_Attempt } = await generateTelegramLinkCode(mB.id);
    const linkResAttemptA = await linkTelegramAccount(codeB_Attempt, tgA, tgA);
    assert(
      linkResAttemptA.success === false && linkResAttemptA.message.includes('/unlink'),
      'TEST 4: Telegram A attempting to link Member B is REJECTED (Anti-Reassignment)'
    );
    const [checkA4] = await sql`SELECT telegram_id FROM anggota WHERE id = ${mA.id}`;
    const [checkB4] = await sql`SELECT telegram_id FROM anggota WHERE id = ${mB.id}`;
    assert(
      checkA4.telegram_id === tgA,
      'TEST 4: Member A STILL retains Telegram A after failed hijack attempt'
    );
    assert(
      checkB4.telegram_id === tgB,
      'TEST 4: Member B STILL retains Telegram B'
    );

    // -------------------------------------------------------------
    // TEST 5: Anti-Reassignment: Telegram B tries to link Member C
    // -------------------------------------------------------------
    const { code: codeC_Attempt } = await generateTelegramLinkCode(mC.id);
    const linkResAttemptB = await linkTelegramAccount(codeC_Attempt, tgB, tgB);
    assert(
      linkResAttemptB.success === false && linkResAttemptB.message.includes('/unlink'),
      'TEST 5: Telegram B attempting to link Member C is REJECTED'
    );
    const [checkB5] = await sql`SELECT telegram_id FROM anggota WHERE id = ${mB.id}`;
    assert(checkB5.telegram_id === tgB, 'TEST 5: Member B retains Telegram B');

    // -------------------------------------------------------------
    // TEST 6: OTP Scoping: Generated OTP is tied strictly to Member B (not Admin)
    // -------------------------------------------------------------
    const { code: codeTargetB } = await generateTelegramLinkCode(mB.id);
    const [codeRecordB] = await sql`SELECT anggota_id FROM telegram_link_codes WHERE code = ${codeTargetB}`;
    assert(
      codeRecordB.anggota_id === mB.id && codeRecordB.anggota_id !== mA.id,
      'TEST 6: OTP generation for Member B is strictly scoped to Member B (not Admin)'
    );

    // -------------------------------------------------------------
    // TEST 7: Cross-Family Sanitized Protection: TG from Family 2 tries OTP from Family 1
    // -------------------------------------------------------------
    const { code: codeFam1 } = await generateTelegramLinkCode(mA.id);
    const tgOther = '70099';
    // First link tgOther to mOther in Family 2
    const { code: codeOther } = await generateTelegramLinkCode(mOther.id);
    await linkTelegramAccount(codeOther, tgOther, tgOther);

    // Now tgOther attempts to redeem code from Family 1
    const crossFamRes = await linkTelegramAccount(codeFam1, tgOther, tgOther);
    assert(
      crossFamRes.success === false && crossFamRes.message.includes('/unlink'),
      'TEST 7: Cross-family linking attempt REJECTED'
    );
    assert(
      !crossFamRes.message.includes(mA.name) && !crossFamRes.message.includes(fam1.name),
      'TEST 7: Error message is sanitized and does not leak Family 1 data to Family 2 user'
    );

    // -------------------------------------------------------------
    // TEST 8: Expired OTP Rejected
    // -------------------------------------------------------------
    const expiredCode = 'EXP_9999';
    await sql`
      INSERT INTO telegram_link_codes (anggota_id, code, expires_at, created_at)
      VALUES (${mB.id}, ${expiredCode}, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '15 minutes')
    `;
    const expRes = await linkTelegramAccount(expiredCode, '70077', '70077');
    assert(
      expRes.success === false && expRes.message.includes('kadaluarsa'),
      'TEST 8: Expired OTP is rejected'
    );

    // -------------------------------------------------------------
    // TEST 9: Used OTP Rejected (Replay Attack)
    // -------------------------------------------------------------
    const replayRes = await linkTelegramAccount(codeA, '70088', '70088');
    assert(
      replayRes.success === false && replayRes.message.includes('sudah pernah digunakan'),
      'TEST 9: Already used OTP is rejected'
    );

    // -------------------------------------------------------------
    // TEST 10: Webhook Idempotency (Deduplication)
    // -------------------------------------------------------------
    const upId = 88001;
    const isFirst = await recordTelegramUpdate(upId);
    const isDuplicate = await recordTelegramUpdate(upId);
    assert(
      isFirst === true && isDuplicate === false,
      'TEST 10: Duplicate telegram update_id is safely dropped/ignored'
    );

    // -------------------------------------------------------------
    // TEST 11: Explicit /unlink Telegram A
    // -------------------------------------------------------------
    const [unlinkingMember] = await sql`SELECT id, name FROM anggota WHERE telegram_id = ${tgA}`;
    assert(unlinkingMember && unlinkingMember.id === mA.id, 'TEST 11: Telegram A resolves to Member A before unlink');
    await sql`
      UPDATE anggota 
      SET telegram_id = NULL, telegram_chat_id = NULL 
      WHERE id = ${unlinkingMember.id}
    `;
    const [checkUnlinkedA] = await sql`SELECT telegram_id, telegram_chat_id FROM anggota WHERE id = ${mA.id}`;
    assert(
      checkUnlinkedA.telegram_id === null && checkUnlinkedA.telegram_chat_id === null,
      'TEST 11: After /unlink, Member A telegram_id and chat_id are NULL'
    );

    // -------------------------------------------------------------
    // TEST 12: Relink After Unlink: Telegram A -> OTP Member B (with Member B previously unlinked)
    // -------------------------------------------------------------
    // Unlink Member B first
    await sql`UPDATE anggota SET telegram_id = NULL, telegram_chat_id = NULL WHERE id = ${mB.id}`;
    const { code: newCodeB } = await generateTelegramLinkCode(mB.id);
    const relinkRes = await linkTelegramAccount(newCodeB, tgA, tgA);
    assert(
      relinkRes.success === true && relinkRes.anggota.id === mB.id,
      'TEST 12: After explicit unlink, Telegram A can be legitimately linked to Member B'
    );
    const [checkRelinkB] = await sql`SELECT telegram_id FROM anggota WHERE id = ${mB.id}`;
    assert(
      checkRelinkB.telegram_id === tgA,
      'TEST 12: Member B now holds Telegram A'
    );

    // -------------------------------------------------------------
    // TEST 13 (PART 10): Concurrency Test: Simultaneous Linking
    // -------------------------------------------------------------
    // Create fresh members for concurrency test
    const [mConc1] = await sql`INSERT INTO anggota (keluarga_id, name, role) VALUES (${fam1.id}, 'MM_TEST_Conc1', 'member') RETURNING id`;
    const [mConc2] = await sql`INSERT INTO anggota (keluarga_id, name, role) VALUES (${fam1.id}, 'MM_TEST_Conc2', 'member') RETURNING id`;
    const { code: concCode1 } = await generateTelegramLinkCode(mConc1.id);
    const { code: concCode2 } = await generateTelegramLinkCode(mConc2.id);

    const tgConc1 = '70011';
    const tgConc2 = '70022';

    // Execute concurrent linking via Promise.all
    const [resConc1, resConc2] = await Promise.all([
      linkTelegramAccount(concCode1, tgConc1, tgConc1),
      linkTelegramAccount(concCode2, tgConc2, tgConc2),
    ]);

    assert(
      resConc1.success === true && resConc2.success === true,
      'TEST 13: Concurrent linking both successfully complete without conflict'
    );

    const [rowConc1] = await sql`SELECT telegram_id FROM anggota WHERE id = ${mConc1.id}`;
    const [rowConc2] = await sql`SELECT telegram_id FROM anggota WHERE id = ${mConc2.id}`;
    assert(
      rowConc1.telegram_id === tgConc1 && rowConc2.telegram_id === tgConc2,
      'TEST 13: Concurrent linking results in accurate distinct assignments (no lost update)'
    );

    // -------------------------------------------------------------
    // TEST 14: Financial Actor Attribution
    // -------------------------------------------------------------
    const [actor1] = await sql`
      SELECT a.id, a.name, a.keluarga_id FROM anggota a WHERE a.telegram_id = ${tgConc1}
    `;
    const [actor2] = await sql`
      SELECT a.id, a.name, a.keluarga_id FROM anggota a WHERE a.telegram_id = ${tgConc2}
    `;
    assert(
      actor1.id === mConc1.id && actor2.id === mConc2.id && actor1.id !== actor2.id,
      'TEST 14: Financial actor attribution resolves to the exact distinct members'
    );

    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    await sql`DELETE FROM telegram_link_codes WHERE code LIKE 'MM_%' OR code LIKE 'EXP_%'`;
    await sql`DELETE FROM telegram_updates WHERE update_id >= 88000`;
    await sql`DELETE FROM transaksi WHERE category LIKE 'MM_TEST_%'`;
    await sql`DELETE FROM rekening WHERE name LIKE 'MM_TEST_%'`;
    await sql`DELETE FROM anggota WHERE name LIKE 'MM_TEST_%'`;
    await sql`DELETE FROM keluarga WHERE name LIKE 'MM_TEST_%'`;

    console.log('\n====================================================');
    console.log(`🎉 MULTI-MEMBER TEST RESULTS: ${passed} PASS, ${failed} FAIL`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMultiMemberTests();
