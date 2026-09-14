import sql from './db';

export interface TransaksiInput {
  rekening_id: number;
  anggota_id: number;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  description?: string;
  date?: string | Date;
}

export async function getDashboardData(keluargaId: number) {
  // Get all rekening
  const rekeningList = await sql`
    SELECT id, name, balance, type 
    FROM rekening 
    WHERE keluarga_id = ${keluargaId}
    ORDER BY id ASC
  `;
  const totalBalance = rekeningList.reduce((sum: number, r: any) => sum + Number(r.balance), 0);

  // Get all anggota
  const anggotaRows = await sql`
    SELECT id, name, telegram_id, role 
    FROM anggota 
    WHERE keluarga_id = ${keluargaId}
    ORDER BY id ASC
  `;
  const anggotaIds = anggotaRows.map((r: any) => r.id);

  let totalIncome = 0;
  let totalExpense = 0;
  let recentTransactions: any[] = [];

  if (anggotaIds.length > 0) {
    const incomeResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transaksi 
      WHERE anggota_id = ANY(${anggotaIds}) AND type = 'income'
    `;
    totalIncome = Number(incomeResult[0].total);

    const expenseResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transaksi 
      WHERE anggota_id = ANY(${anggotaIds}) AND type = 'expense'
    `;
    totalExpense = Number(expenseResult[0].total);

    recentTransactions = await sql`
      SELECT t.id, t.rekening_id, t.anggota_id, t.amount, t.type, t.category, t.description, t.date, 
             a.name as anggota_name, r.name as rekening_name
      FROM transaksi t 
      JOIN anggota a ON t.anggota_id = a.id
      JOIN rekening r ON t.rekening_id = r.id
      WHERE t.anggota_id = ANY(${anggotaIds})
      ORDER BY t.date DESC 
      LIMIT 10
    `;
  }

  return {
    total_balance: totalBalance,
    total_income: totalIncome,
    total_expense: totalExpense,
    rekening_list: rekeningList.map((r: any) => ({
      id: r.id,
      name: r.name,
      balance: Number(r.balance),
      type: r.type,
    })),
    anggota_list: anggotaRows.map((a: any) => ({
      id: a.id,
      name: a.name,
      telegram_id: a.telegram_id,
      role: a.role,
    })),
    recent_transactions: recentTransactions.map((t: any) => ({
      id: t.id,
      rekening_id: t.rekening_id,
      anggota_id: t.anggota_id,
      amount: Number(t.amount),
      type: t.type,
      category: t.category,
      description: t.description,
      date: t.date,
      anggota_name: t.anggota_name,
      rekening_name: t.rekening_name,
    })),
  };
}

export async function getRekeningList(keluargaId: number) {
  return await sql`
    SELECT id, name, balance, type 
    FROM rekening 
    WHERE keluarga_id = ${keluargaId} 
    ORDER BY id ASC
  `;
}

export async function getAnggotaByKeluarga(keluargaId: number) {
  return await sql`
    SELECT id, name, telegram_id, role 
    FROM anggota 
    WHERE keluarga_id = ${keluargaId} 
    ORDER BY id ASC
  `;
}

export async function getLaporanBulanan(
  keluargaId: number,
  month: number,
  year: number,
  anggotaId?: number
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  let anggotaIds: number[];
  if (anggotaId) {
    anggotaIds = [anggotaId];
  } else {
    const rows = await sql`
      SELECT id FROM anggota WHERE keluarga_id = ${keluargaId}
    `;
    anggotaIds = rows.map((r: any) => r.id);
  }

  if (anggotaIds.length === 0) {
    return {
      transactions: [],
      summary: { total_income: 0, total_expense: 0, net: 0 },
    };
  }

  const transactions = await sql`
    SELECT t.id, t.rekening_id, t.anggota_id, t.amount, t.type, t.category, t.description, t.date,
           a.name as anggota_name, r.name as rekening_name
    FROM transaksi t
    JOIN anggota a ON t.anggota_id = a.id
    JOIN rekening r ON t.rekening_id = r.id
    WHERE t.anggota_id = ANY(${anggotaIds})
      AND t.date >= ${startDate}
      AND t.date <= ${endDate}
    ORDER BY t.date DESC
  `;

  let totalIncome = 0;
  let totalExpense = 0;

  const formatted = transactions.map((t: any) => {
    const amount = Number(t.amount);
    if (t.type === 'income') totalIncome += amount;
    if (t.type === 'expense') totalExpense += amount;
    return {
      id: t.id,
      rekening_id: t.rekening_id,
      anggota_id: t.anggota_id,
      amount,
      type: t.type,
      category: t.category,
      description: t.description,
      date: t.date,
      anggota_name: t.anggota_name,
      rekening_name: t.rekening_name,
    };
  });

  return {
    transactions: formatted,
    summary: {
      total_income: totalIncome,
      total_expense: totalExpense,
      net: totalIncome - totalExpense,
    },
  };
}

// --- Mutasi Transaksi ---
export async function createTransaksi(input: TransaksiInput) {
  const dateVal = input.date ? new Date(input.date) : new Date();

  const res = await sql`
    INSERT INTO transaksi (rekening_id, anggota_id, amount, type, category, description, date)
    VALUES (${input.rekening_id}, ${input.anggota_id}, ${input.amount}, ${input.type}, ${input.category}, ${input.description || ''}, ${dateVal})
    RETURNING id, rekening_id, anggota_id, amount, type, category, description, date
  `;

  // Update saldo rekening
  if (input.type === 'income') {
    await sql`UPDATE rekening SET balance = balance + ${input.amount} WHERE id = ${input.rekening_id}`;
  } else if (input.type === 'expense') {
    await sql`UPDATE rekening SET balance = balance - ${input.amount} WHERE id = ${input.rekening_id}`;
  }

  return res[0];
}

export async function updateTransaksi(id: number, input: Partial<TransaksiInput>) {
  // Ambil transaksi lama untuk penyesuaian saldo
  const oldRows = await sql`SELECT * FROM transaksi WHERE id = ${id}`;
  if (oldRows.length === 0) throw new Error('Transaksi tidak ditemukan');
  const oldTx = oldRows[0];

  // 1. Rollback saldo lama
  if (oldTx.type === 'income') {
    await sql`UPDATE rekening SET balance = balance - ${oldTx.amount} WHERE id = ${oldTx.rekening_id}`;
  } else if (oldTx.type === 'expense') {
    await sql`UPDATE rekening SET balance = balance + ${oldTx.amount} WHERE id = ${oldTx.rekening_id}`;
  }

  // 2. Data baru
  const newRekeningId = input.rekening_id ?? oldTx.rekening_id;
  const newAnggotaId = input.anggota_id ?? oldTx.anggota_id;
  const newAmount = input.amount ?? Number(oldTx.amount);
  const newType = input.type ?? oldTx.type;
  const newCategory = input.category ?? oldTx.category;
  const newDescription = input.description !== undefined ? input.description : oldTx.description;
  const newDate = input.date ? new Date(input.date) : oldTx.date;

  // 3. Update data transaksi
  const updated = await sql`
    UPDATE transaksi
    SET rekening_id = ${newRekeningId},
        anggota_id = ${newAnggotaId},
        amount = ${newAmount},
        type = ${newType},
        category = ${newCategory},
        description = ${newDescription},
        date = ${newDate}
    WHERE id = ${id}
    RETURNING *
  `;

  // 4. Terapkan saldo baru
  if (newType === 'income') {
    await sql`UPDATE rekening SET balance = balance + ${newAmount} WHERE id = ${newRekeningId}`;
  } else if (newType === 'expense') {
    await sql`UPDATE rekening SET balance = balance - ${newAmount} WHERE id = ${newRekeningId}`;
  }

  return updated[0];
}

export async function deleteTransaksi(id: number) {
  const oldRows = await sql`SELECT * FROM transaksi WHERE id = ${id}`;
  if (oldRows.length === 0) throw new Error('Transaksi tidak ditemukan');
  const oldTx = oldRows[0];

  // Kembalikan saldo
  if (oldTx.type === 'income') {
    await sql`UPDATE rekening SET balance = balance - ${oldTx.amount} WHERE id = ${oldTx.rekening_id}`;
  } else if (oldTx.type === 'expense') {
    await sql`UPDATE rekening SET balance = balance + ${oldTx.amount} WHERE id = ${oldTx.rekening_id}`;
  }

  await sql`DELETE FROM transaksi WHERE id = ${id}`;
  return { success: true, deleted_id: id };
}

// --- Mutasi Anggota ---
export async function createAnggota(keluargaId: number, name: string, telegramId?: string, role: string = 'member') {
  const cleanTelegramId = telegramId ? telegramId.trim() : null;
  const res = await sql`
    INSERT INTO anggota (keluarga_id, name, telegram_id, role)
    VALUES (${keluargaId}, ${name}, ${cleanTelegramId}, ${role})
    RETURNING *
  `;
  return res[0];
}

export async function updateAnggota(id: number, name: string, telegramId?: string, role?: string) {
  const cleanTelegramId = telegramId ? telegramId.trim() : null;
  const roleVal = role || 'member';
  const res = await sql`
    UPDATE anggota
    SET name = ${name},
        telegram_id = ${cleanTelegramId},
        role = ${roleVal}
    WHERE id = ${id}
    RETURNING *
  `;
  return res[0];
}

export async function deleteAnggota(id: number) {
  // Hapus transaksi terkait dulu agar tidak melanggar foreign key
  await sql`DELETE FROM transaksi WHERE anggota_id = ${id}`;
  await sql`DELETE FROM anggota WHERE id = ${id}`;
  return { success: true, deleted_id: id };
}

// --- Mutasi Rekening ---
export async function createRekening(keluargaId: number, name: string, initialBalance: number = 0, type: string = 'cash') {
  const res = await sql`
    INSERT INTO rekening (keluarga_id, name, balance, type)
    VALUES (${keluargaId}, ${name}, ${initialBalance}, ${type})
    RETURNING *
  `;
  return res[0];
}

export async function updateRekening(id: number, name: string, type: string) {
  const res = await sql`
    UPDATE rekening
    SET name = ${name},
        type = ${type}
    WHERE id = ${id}
    RETURNING *
  `;
  return res[0];
}

export async function deleteRekening(id: number) {
  await sql`DELETE FROM transaksi WHERE rekening_id = ${id}`;
  await sql`DELETE FROM rekening WHERE id = ${id}`;
  return { success: true, deleted_id: id };
}
