import sql from './db';

const TELEGRAM_API = 'https://api.telegram.org';

export async function sendTelegramMessage(chatId: string | number, text: string, parseMode: string = 'Markdown') {
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
    return result.ok;
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
  // Bersihkan titik jika berupa separator ribuan
  const numOnly = clean.replace(/\./g, '').replace(',', '.');
  const val = parseFloat(numOnly);
  return isNaN(val) || val <= 0 ? null : val;
}

export async function handleTelegramUpdate(update: any) {
  const message = update?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const telegramId = String(message.from.id);
  const firstName = message.from.first_name || 'Keluarga';
  const text = message.text.trim();

  // 1. Perintah /start
  if (text.startsWith('/start')) {
    const existingAnggota = await sql`
      SELECT a.*, k.name as keluarga_name 
      FROM anggota a 
      JOIN keluarga k ON a.keluarga_id = k.id 
      WHERE a.telegram_id = ${telegramId}
    `;

    if (existingAnggota.length > 0) {
      const user = existingAnggota[0];
      await sendTelegramMessage(
        chatId,
        `Halo *${user.name}*! 👋\nAnda terdaftar di *${user.keluarga_name}*.\n\nGunakan perintah berikut:\n` +
          `• \`/catat [nominal] [kategori] [ket]\` - Catat pengeluaran\n` +
          `• \`/masuk [nominal] [kategori] [ket]\` - Catat pemasukan\n` +
          `• \`/saldo\` - Cek saldo rekening\n` +
          `• \`/bantuan\` - Panduan lengkap`
      );
      return;
    }

    // Cek apakah ada anggota yang belum memiliki telegram_id
    const unlinked = await sql`
      SELECT a.*, k.name as keluarga_name 
      FROM anggota a 
      JOIN keluarga k ON a.keluarga_id = k.id 
      WHERE a.telegram_id IS NULL OR a.telegram_id = ''
      ORDER BY a.id ASC 
      LIMIT 1
    `;

    if (unlinked.length > 0) {
      const user = unlinked[0];
      await sql`
        UPDATE anggota 
        SET telegram_id = ${telegramId} 
        WHERE id = ${user.id}
      `;
      await sendTelegramMessage(
        chatId,
        `🎉 Selamat datang, *${firstName}*!\nAkun Telegram Anda berhasil ditautkan ke profil *${user.name}* (*${user.keluarga_name}*).\n\nSekarang Anda bisa langsung mencatat pengeluaran/pemasukan dengan perintah \`/catat\` atau \`/masuk\`.`
      );
      return;
    }

    // Jika belum ada keluarga sama sekali
    const anyKeluarga = await sql`SELECT id FROM keluarga LIMIT 1`;
    let keluargaId = 1;
    if (anyKeluarga.length === 0) {
      const newK = await sql`
        INSERT INTO keluarga (name) VALUES (${`Keluarga ${firstName}`}) RETURNING id
      `;
      keluargaId = newK[0].id;
      await sql`
        INSERT INTO rekening (keluarga_id, name, balance, type) 
        VALUES (${keluargaId}, 'Dompet Utama', 0, 'cash')
      `;
      await sql`
        INSERT INTO anggota (keluarga_id, name, telegram_id, role) 
        VALUES (${keluargaId}, ${firstName}, ${telegramId}, 'admin')
      `;
      await sendTelegramMessage(
        chatId,
        `🎉 *Keluarga Baru Berhasil Dibuat!*\nSelamat datang Admin *${firstName}*.\nKetik \`/catat\` untuk mencatat pengeluaran pertama Anda!`
      );
      return;
    } else {
      keluargaId = anyKeluarga[0].id;
      // Tambahkan anggota baru
      await sql`
        INSERT INTO anggota (keluarga_id, name, telegram_id, role) 
        VALUES (${keluargaId}, ${firstName}, ${telegramId}, 'member')
      `;
      await sendTelegramMessage(
        chatId,
        `✅ Akun Telegram Anda (*${firstName}*) berhasil didaftarkan sebagai Anggota Keluarga!\n\nKetik \`/catat\` untuk mencatat pengeluaran atau \`/saldo\` untuk cek saldo.`
      );
      return;
    }
  }

  // 2. Perintah /bantuan atau /help
  if (text.startsWith('/help') || text.startsWith('/bantuan')) {
    await sendTelegramMessage(
      chatId,
      `📖 *Panduan Bot Keuangan Keluarga*\n\n` +
        `*1. Catat Pengeluaran:*\n` +
        `• \`/catat 25000 Makan Bakso\`\n` +
        `• \`/catat 50k Bensin Motor\`\n` +
        `• \`/catat 150rb Belanja Sayur di pasar\`\n\n` +
        `*2. Catat Pemasukan:*\n` +
        `• \`/masuk 5000000 Gaji Bulanan\`\n` +
        `• \`/masuk 500k Bonus Proyek\`\n` +
        `• \`/masuk 2.5jt Transfer THR\`\n\n` +
        `*3. Cek Saldo:*\n` +
        `• \`/saldo\`\n\n` +
        `Semua transaksi langsung tersinkronisasi ke Web Dashboard secara real-time!`
    );
    return;
  }

  // Cek apakah user terdaftar untuk perintah /saldo, /catat, /masuk
  const userRows = await sql`
    SELECT a.*, k.name as keluarga_name 
    FROM anggota a 
    JOIN keluarga k ON a.keluarga_id = k.id 
    WHERE a.telegram_id = ${telegramId}
  `;

  if (userRows.length === 0) {
    await sendTelegramMessage(
      chatId,
      `⚠️ Akun Telegram Anda belum terdaftar.\nKetik \`/start\` untuk menghubungkan akun Anda.`
    );
    return;
  }

  const currentUser = userRows[0];
  const keluargaId = currentUser.keluarga_id;

  // 3. Perintah /saldo
  if (text.startsWith('/saldo')) {
    const rekenings = await sql`
      SELECT name, balance FROM rekening WHERE keluarga_id = ${keluargaId} ORDER BY id ASC
    `;
    if (rekenings.length === 0) {
      await sendTelegramMessage(chatId, `Belum ada dompet/rekening terdaftar.`);
      return;
    }

    let total = 0;
    let msg = `💰 *SALDO KEUANGAN KELUARGA*\n\n`;
    for (const r of rekenings) {
      const bal = Number(r.balance);
      total += bal;
      msg += `• *${r.name}*: Rp ${bal.toLocaleString('id-ID')}\n`;
    }
    msg += `\n─────────────────\n*TOTAL SALDO: Rp ${total.toLocaleString('id-ID')}*`;
    await sendTelegramMessage(chatId, msg);
    return;
  }

  // 4. Perintah /catat (Pengeluaran) atau /masuk (Pemasukan)
  const isExpense = text.startsWith('/catat') || text.startsWith('/keluar');
  const isIncome = text.startsWith('/masuk');

  if (isExpense || isIncome) {
    const parts = text.split(/\s+/);
    if (parts.length < 3) {
      const cmd = isExpense ? '/catat' : '/masuk';
      await sendTelegramMessage(
        chatId,
        `⚠️ *Format kurang lengkap.*\nContoh penggunaan:\n\`${cmd} 50k Makan Nasi Padang\` atau\n\`${cmd} 100.000 Bensin Pertamax\``
      );
      return;
    }

    const nominalRaw = parts[1];
    const nominal = parseNominal(nominalRaw);
    if (!nominal) {
      await sendTelegramMessage(
        chatId,
        `⚠️ Nominal *${nominalRaw}* tidak valid.\nContoh: \`50000\`, \`50k\`, \`50rb\`, atau \`1.5jt\`.`
      );
      return;
    }

    const category = parts[2];
    const description = parts.slice(3).join(' ') || category;
    const type = isExpense ? 'expense' : 'income';

    // Cari rekening default keluarga
    const rekeningRows = await sql`
      SELECT id, name, balance FROM rekening WHERE keluarga_id = ${keluargaId} ORDER BY id ASC LIMIT 1
    `;
    if (rekeningRows.length === 0) {
      // Buat rekening default otomatis
      const newRek = await sql`
        INSERT INTO rekening (keluarga_id, name, balance, type) 
        VALUES (${keluargaId}, 'Dompet Utama', 0, 'cash') 
        RETURNING id, name, balance
      `;
      rekeningRows.push(newRek[0]);
    }

    const rekening = rekeningRows[0];

    // Simpan transaksi
    await sql`
      INSERT INTO transaksi (rekening_id, anggota_id, amount, type, category, description, date)
      VALUES (${rekening.id}, ${currentUser.id}, ${nominal}, ${type}, ${category}, ${description}, NOW())
    `;

    // Update saldo rekening
    if (type === 'income') {
      await sql`
        UPDATE rekening SET balance = balance + ${nominal} WHERE id = ${rekening.id}
      `;
    } else {
      await sql`
        UPDATE rekening SET balance = balance - ${nominal} WHERE id = ${rekening.id}
      `;
    }

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
        `Cek dasbor web untuk melihat laporan lengkap.`
    );
    return;
  }
}
