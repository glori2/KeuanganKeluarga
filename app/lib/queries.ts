import sql from './db';

export async function getDashboardData(keluargaId: number) {
  // Get total balance from all rekening
  const balanceResult = await sql`
    SELECT COALESCE(SUM(balance), 0) as total_balance 
    FROM rekening 
    WHERE keluarga_id = ${keluargaId}
  `;
  const totalBalance = Number(balanceResult[0].total_balance);

  // Get all anggota IDs for this family
  const anggotaRows = await sql`
    SELECT id FROM anggota WHERE keluarga_id = ${keluargaId}
  `;
  const anggotaIds = anggotaRows.map((r: any) => r.id);

  let totalIncome = 0;
  let totalExpense = 0;
  let recentTransactions: any[] = [];

  if (anggotaIds.length > 0) {
    // Get total income
    const incomeResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transaksi 
      WHERE anggota_id = ANY(${anggotaIds}) AND type = 'income'
    `;
    totalIncome = Number(incomeResult[0].total);

    // Get total expense
    const expenseResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transaksi 
      WHERE anggota_id = ANY(${anggotaIds}) AND type = 'expense'
    `;
    totalExpense = Number(expenseResult[0].total);

    // Get recent transactions with anggota name
    recentTransactions = await sql`
      SELECT t.id, t.amount, t.type, t.category, t.description, t.date, 
             a.name as anggota_name
      FROM transaksi t 
      JOIN anggota a ON t.anggota_id = a.id
      WHERE t.anggota_id = ANY(${anggotaIds})
      ORDER BY t.date DESC 
      LIMIT 5
    `;
  }

  return {
    total_balance: totalBalance,
    total_income: totalIncome,
    total_expense: totalExpense,
    recent_transactions: recentTransactions.map((t: any) => ({
      id: t.id,
      amount: Number(t.amount),
      type: t.type,
      category: t.category,
      description: t.description,
      date: t.date,
      anggota_name: t.anggota_name,
    })),
  };
}

export async function getAnggotaByKeluarga(keluargaId: number) {
  return await sql`
    SELECT id, name FROM anggota WHERE keluarga_id = ${keluargaId} ORDER BY name
  `;
}

export async function getLaporanBulanan(
  keluargaId: number,
  month: number,
  year: number,
  anggotaId?: number
) {
  // Build the date range
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  let anggotaIds: number[];
  if (anggotaId) {
    anggotaIds = [anggotaId];
  } else {
    const rows = await sql`
      SELECT id FROM anggota WHERE keluarga_id = ${keluargaId}
    `;
    anggotaIds = rows.map((r: any) => r.id);
  }

  if (anggotaIds.length === 0) return [];

  const transactions = await sql`
    SELECT t.id, t.amount, t.type, t.category, t.description, t.date,
           a.name as anggota_name
    FROM transaksi t
    JOIN anggota a ON t.anggota_id = a.id
    WHERE t.anggota_id = ANY(${anggotaIds})
      AND t.date >= ${startDate}
      AND t.date <= ${endDate}
    ORDER BY t.date DESC
  `;

  return transactions.map((t: any) => ({
    id: t.id,
    amount: Number(t.amount),
    type: t.type,
    category: t.category,
    description: t.description,
    date: t.date,
    anggota_name: t.anggota_name,
  }));
}
