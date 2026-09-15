import crypto from 'crypto';
import sql from './db';
import { createTransaksi } from './queries';

const TELEGRAM_API = 'https://api.telegram.org';

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  parseMode: string = 'Markdown'
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return false;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    });
    const result = await res.json();
    return Boolean(result.ok);
  } catch (error) {
    console.error('Error sending telegram message:', error);
    return false;
  }
}

/**
 * Parsing angka format Indonesia:
 * - 50k / 50K -> 50000
 * - 50rb / 50RB -> 50000
 * - 1.5jt / 1,5jt -> 1500000
 * - 50.000 -> 50000
 * - 50000 -> 50000
 */
export function parseNominal(raw: string): number | null {
  if (!raw) return null;
  let clean = raw.trim().toLowerCase();

  // Tangani akhiran jt / juta
  if (clean.endsWith('jt') || clean.endsWith('juta')) {
    clean = clean.replace(/jt|juta/g, '').replace(',', '.').trim();
    const val = parseFloat(clean);
    return isNaN(val) || val <= 0 ? null : val * 1_000_000;
  }

  // Tangani akhiran k / rb / ribu
  if (clean.endsWith('k') || clean.endsWith('rb') || clean.endsWith('ribu')) {
    clean = clean.replace(/k|rb|ribu/g, '').replace(',', '.').trim();
    const val = parseFloat(clean);
    return isNaN(val) || val <= 0 ? null : val * 1_000;
  }

  // Tangani format titik ribuan: 50.000 atau 1.000.000
  const numOnly = clean.replace(/\./g, '').replace(',', '.');
  const val = parseFloat(numOnly);
  return isNaN(val) || val <= 0 ? null : val;
}

/**
 * Generate a cryptographically secure, 8-character uppercase OTP code for Telegram account linking.
 * Valid for 10 minutes. Single-use.
 */
export async function generateTelegramLinkCode(anggotaId: number): Promise<{ code: string; expires_at: Date }> {
  // Validate anggota exists
  const [anggota] = await sql`SELECT id FROM anggota WHERE id = ${anggotaId}`;
  if (!anggota) {
    throw new Error('Anggota tidak ditemukan');
  }

  // Generate 8-char hex code (4 bytes = 8 hex chars)
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

  await sql`
    INSERT INTO telegram_link_codes (anggota_id, code, expires_at, created_at)
    VALUES (${anggotaId}, ${code}, ${expiresAt}, NOW())
  `;

  return { code, expires_at: expiresAt };
}

/**
 * Validates an OTP link code and securely binds the Telegram ID to the member profile.
 */
export async function linkTelegramAccount(
  rawCode: string,
  telegramId: string,
  chatId?: number | string
): Promise<{ success: boolean; message: string; anggota?: any }> {
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
        // Mark code as used
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

/**
 * Deduplicate updates by update_id to ensure webhook idempotency.
 * Returns true if new update, false if already received.
 */
export async function recordTelegramUpdate(updateId: number): Promise<boolean> {
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
    console.error('Error recording telegram update_id:', err);
    return false;
  }
}

/**
 * Marks update as fully processed.
 */
export async function markUpdateProcessed(updateId: number) {
  if (!updateId) return;
  try {
    await sql`
      UPDATE telegram_updates 
      SET processed_at = NOW() 
      WHERE update_id = ${updateId}
    `;
  } catch (err) {
    console.error('Error marking update processed:', err);
  }
}

/**
 * Main Telegram Webhook Update Handler.
 */
export async function handleTelegramUpdate(update: any) {
  const updateId = update?.update_id;
  if (!updateId) return;

  // Idempotency check: Ignore duplicate updates
  const isNew = await recordTelegramUpdate(updateId);
  if (!isNew) {
    console.log(`[Telegram Webhook] Skipped duplicate update_id: ${updateId}`);
    return;
  }

  const message = update?.message;
  if (!message || !message.text) {
    await markUpdateProcessed(updateId);
    return;
  }

  const chatId = message.chat.id;
  const telegramId = String(message.from.id);
  const firstName = message.from.first_name || 'Pengguna';
  const text = message.text.trim();

  try {
    // 1. Perintah /start atau deep linking /start <code>
    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/);
      if (parts.length > 1 && parts[1].length >= 6) {
        // Treat as /link <code>
        const linkResult = await linkTelegramAccount(parts[1], telegramId, chatId);
        if (linkResult.success) {
          await sendTelegramMessage(
            chatId,
            `🎉 *Akun Berhasil Ditautkan!*\n\n` +
              `Halo *${linkResult.anggota.name}*, akun Telegram Anda telah terhubung ke *${linkResult.anggota.keluarga_name}*.\n\n` +
              `Perintah yang dapat digunakan:\n` +
              `• \`/saldo\` - Cek saldo rekening\n` +
              `• \`/catat [nominal] [kategori] [ket]\` - Catat pengeluaran\n` +
              `• \`/masuk [nominal] [kategori] [ket]\` - Catat pemasukan\n` +
              `• \`/help\` - Bantuan lengkap`
          );
        } else {
          await sendTelegramMessage(
            chatId,
            `❌ *Gagal Menautkan Akun*\n\n${linkResult.message}\n\nSilakan minta kode OTP baru di web dashboard.`
          );
        }
        await markUpdateProcessed(updateId);
        return;
      }

      // Check if user is already linked
      const existing = await sql`
        SELECT a.id, a.name, a.role, k.id as keluarga_id, k.name as keluarga_name 
        FROM anggota a 
        JOIN keluarga k ON a.keluarga_id = k.id 
        WHERE a.telegram_id = ${telegramId}
      `;

      if (existing.length > 0) {
        const user = existing[0];
        await sendTelegramMessage(
          chatId,
          `Halo *${user.name}*! 👋\n` +
            `Akun Telegram Anda terhubung ke *${user.keluarga_name}*.\n\n` +
            `Gunakan perintah berikut:\n` +
            `• \`/saldo\` - Cek saldo rekening\n` +
            `• \`/catat [nominal] [kategori] [ket]\` - Catat pengeluaran\n` +
            `• \`/masuk [nominal] [kategori] [ket]\` - Catat pemasukan\n` +
            `• \`/unlink\` - Putuskan tautan akun\n` +
            `• \`/help\` - Panduan format lengkap`
        );
      } else {
        // Unlinked user: Informative security guide. NO AUTO-LINKING!
        await sendTelegramMessage(
          chatId,
          `👋 Halo *${firstName}*!\n\n` +
            `🔒 *Akun Telegram Belum Terhubung*\n` +
            `Untuk menghubungkan Telegram dengan data keuangan keluarga Anda:\n\n` +
            `1. Buka Web Dashboard Keuangan Keluarga\n` +
            `2. Buka menu *Anggota / Profil*\n` +
            `3. Klik *Hubungkan Telegram* untuk mendapatkan kode OTP (8 digit)\n` +
            `4. Kirimkan perintah berikut ke bot ini:\n` +
            `   \`/link KODE_OTP\`\n\n` +
            `Contoh: \`/link A1B2C3D4\``
        );
      }
      await markUpdateProcessed(updateId);
      return;
    }

    // 2. Perintah /link atau /tautkan
    if (text.startsWith('/link') || text.startsWith('/tautkan')) {
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        await sendTelegramMessage(
          chatId,
          `⚠️ *Format Perintah Salah*\n\n` +
            `Gunakan: \`/link [KODE_OTP]\`\n` +
            `Contoh: \`/link A1B2C3D4\`\n\n` +
            `Dapatkan kode OTP 8-digit di web dashboard pada menu Anggota.`
        );
        await markUpdateProcessed(updateId);
        return;
      }

      const codeInput = parts[1];
      const linkResult = await linkTelegramAccount(codeInput, telegramId, chatId);
      if (linkResult.success) {
        await sendTelegramMessage(
          chatId,
          `🎉 *Akun Berhasil Ditautkan!*\n\n` +
            `Halo *${linkResult.anggota.name}*, akun Telegram Anda sekarang resmi terhubung ke *${linkResult.anggota.keluarga_name}*.\n\n` +
            `Silakan coba perintah:\n` +
            `• \`/saldo\` - Cek saldo rekening\n` +
            `• \`/catat [nominal] [kategori] [keterangan]\`\n` +
            `• \`/masuk [nominal] [kategori] [keterangan]\``
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ *Gagal Menautkan Akun*\n\n${linkResult.message}`
        );
      }
      await markUpdateProcessed(updateId);
      return;
    }

    // 3. Perintah /unlink atau /putuskan
    if (text.startsWith('/unlink') || text.startsWith('/putuskan')) {
      const [linked] = await sql`
        SELECT a.id, a.name FROM anggota a WHERE a.telegram_id = ${telegramId}
      `;
      if (!linked) {
        await sendTelegramMessage(chatId, `⚠️ Akun Telegram Anda saat ini tidak ditautkan ke profil manapun.`);
      } else {
        await sql`
          UPDATE anggota 
          SET telegram_id = NULL, telegram_chat_id = NULL 
          WHERE id = ${linked.id}
        `;
        await sendTelegramMessage(
          chatId,
          `✅ *Tautan Akun Diputuskan*\n\nAkun Telegram Anda tidak lagi terhubung ke profil *${linked.name}*.`
        );
      }
      await markUpdateProcessed(updateId);
      return;
    }

    // 4. Perintah /help atau /bantuan
    if (text.startsWith('/help') || text.startsWith('/bantuan')) {
      await sendTelegramMessage(
        chatId,
        `📖 *Panduan Bot Keuangan Keluarga*\n\n` +
          `*1. Hubungkan Akun:*\n` +
          `• \`/link [KODE]\` - Hubungkan akun via kode OTP dari Web\n` +
          `• \`/unlink\` - Putuskan tautan akun Telegram\n\n` +
          `*2. Catat Pengeluaran:*\n` +
          `• \`/catat 25000 Makan Bakso\`\n` +
          `• \`/catat 50k Bensin Motor\`\n` +
          `• \`/catat 150rb Belanja Sayur di pasar\`\n\n` +
          `*3. Catat Pemasukan:*\n` +
          `• \`/masuk 5000000 Gaji Bulanan\`\n` +
          `• \`/masuk 500k Bonus Proyek\`\n` +
          `• \`/masuk 2.5jt Transfer THR\`\n\n` +
          `*4. Cek Saldo:*\n` +
          `• \`/saldo\`\n\n` +
          `Semua mutasi tersimpan secara atomic dan real-time di Web Dashboard!`
      );
      await markUpdateProcessed(updateId);
      return;
    }

    // Autentikasi / Otorisasi Anggota untuk perintah finansial
    const userRows = await sql`
      SELECT a.id, a.name, a.role, a.keluarga_id, k.name as keluarga_name 
      FROM anggota a 
      JOIN keluarga k ON a.keluarga_id = k.id 
      WHERE a.telegram_id = ${telegramId}
    `;

    if (userRows.length === 0) {
      await sendTelegramMessage(
        chatId,
        `⚠️ *Akses Ditolak*\n\n` +
          `Akun Telegram Anda belum ditautkan ke keluarga manapun.\n` +
          `Ketik \`/start\` untuk petunjuk cara menghubungkan akun.`
      );
      await markUpdateProcessed(updateId);
      return;
    }

    const currentUser = userRows[0];
    const keluargaId = currentUser.keluarga_id;

    // 5. Perintah /saldo
    if (text.startsWith('/saldo')) {
      const rekenings = await sql`
        SELECT name, balance::numeric FROM rekening WHERE keluarga_id = ${keluargaId} ORDER BY id ASC
      `;
      if (rekenings.length === 0) {
        await sendTelegramMessage(chatId, `Belum ada dompet/rekening terdaftar untuk keluarga *${currentUser.keluarga_name}*.`);
        await markUpdateProcessed(updateId);
        return;
      }

      let total = 0;
      let msg = `💰 *SALDO KEUANGAN KELUARGA*\n_${currentUser.keluarga_name}_\n\n`;
      for (const r of rekenings) {
        const bal = Number(r.balance);
        total += bal;
        msg += `• *${r.name}*: Rp ${bal.toLocaleString('id-ID')}\n`;
      }
      msg += `\n─────────────────\n*TOTAL SALDO: Rp ${total.toLocaleString('id-ID')}*`;
      await sendTelegramMessage(chatId, msg);
      await markUpdateProcessed(updateId);
      return;
    }

    // 6. Perintah /catat (Pengeluaran) atau /masuk (Pemasukan)
    const isExpense = text.startsWith('/catat') || text.startsWith('/keluar');
    const isIncome = text.startsWith('/masuk');

    if (isExpense || isIncome) {
      const parts = text.split(/\s+/);
      if (parts.length < 3) {
        const cmd = isExpense ? '/catat' : '/masuk';
        await sendTelegramMessage(
          chatId,
          `⚠️ *Format Kurang Lengkap*\n\nContoh penggunaan:\n\`${cmd} 50k Makan Nasi Padang\`\n\`${cmd} 100.000 Bensin Pertamax\``
        );
        await markUpdateProcessed(updateId);
        return;
      }

      const nominalRaw = parts[1];
      const nominal = parseNominal(nominalRaw);
      if (!nominal || nominal <= 0) {
        await sendTelegramMessage(
          chatId,
          `⚠️ Nominal *${nominalRaw}* tidak valid.\nContoh: \`50000\`, \`50k\`, \`50rb\`, atau \`1.5jt\`.`
        );
        await markUpdateProcessed(updateId);
        return;
      }

      const category = parts[2];
      const description = parts.slice(3).join(' ') || category;
      const type = isExpense ? 'expense' : 'income';

      // Cari rekening default keluarga
      const rekeningRows = await sql`
        SELECT id, name, balance::numeric FROM rekening WHERE keluarga_id = ${keluargaId} ORDER BY id ASC LIMIT 1
      `;
      let rekening = rekeningRows[0];
      if (!rekening) {
        const [newRek] = await sql`
          INSERT INTO rekening (keluarga_id, name, balance, type) 
          VALUES (${keluargaId}, 'Dompet Utama', 0, 'cash') 
          RETURNING id, name, balance::numeric
        `;
        rekening = newRek;
      }

      // Mutasi transaksi finansial secara ATOMIC dengan Audit Log Telegram
      await createTransaksi({
        rekening_id: rekening.id,
        anggota_id: currentUser.id,
        amount: nominal,
        type,
        category,
        description,
        date: new Date(),
        actor_type: 'telegram',
        actor_name: currentUser.name,
        telegram_id: telegramId,
      });

      const icon = type === 'income' ? '🟢 PEMASUKAN' : '🔴 PENGELUARAN';
      const sign = type === 'income' ? '+' : '-';
      await sendTelegramMessage(
        chatId,
        `✅ *${icon} BERHASIL DICATAT*\n\n` +
          `• Nominal: *${sign} Rp ${nominal.toLocaleString('id-ID')}*\n` +
          `• Kategori: *${category}*\n` +
          `• Keterangan: _${description}_\n` +
          `• Dicatat oleh: *${currentUser.name}*\n` +
          `• Dompet: *${rekening.name}*\n\n` +
          `Tersinkronisasi ke Web Dashboard *${currentUser.keluarga_name}*.`
      );
      await markUpdateProcessed(updateId);
      return;
    }

    // Default unhandled command
    await markUpdateProcessed(updateId);
  } catch (error: any) {
    console.error(`Error processing Telegram update ${updateId}:`, error);
    await markUpdateProcessed(updateId);
  }
}

