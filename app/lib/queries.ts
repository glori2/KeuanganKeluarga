import sql from './db';

export interface ActorContext {
  actor_user_id?: string | null;
  actor_type?: 'web' | 'telegram' | 'system' | 'api';
  actor_name?: string | null;
  telegram_id?: string | null;
}

export interface TransaksiInput extends ActorContext {
  rekening_id: number;
  anggota_id: number;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  description?: string;
  date?: string | Date;
  destination_rekening_id?: number | null;
}

export interface TransferInput extends ActorContext {
  source_rekening_id: number;
  destination_rekening_id: number;
  anggota_id: number;
  amount: number;
  description?: string;
  date?: string | Date;
}

export async function getDashboardData(keluargaId: number) {
  // Get all rekening
  const rekeningList = await sql`
    SELECT id, name, balance::numeric, type 
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
    // Only aggregate active (posted) transactions into dashboard statistics
    const incomeResult = await sql`
      SELECT COALESCE(SUM(amount), 0)::numeric as total 
      FROM transaksi 
      WHERE anggota_id = ANY(${anggotaIds}) AND type = 'income' AND status = 'posted'
    `;
    totalIncome = Number(incomeResult[0].total);

    const expenseResult = await sql`
      SELECT COALESCE(SUM(amount), 0)::numeric as total 
      FROM transaksi 
      WHERE anggota_id = ANY(${anggotaIds}) AND type = 'expense' AND status = 'posted'
    `;
    totalExpense = Number(expenseResult[0].total);

    recentTransactions = await sql`
      SELECT t.id, t.rekening_id, t.destination_rekening_id, t.anggota_id, 
             t.amount::numeric, t.type, t.category, t.description, t.date, 
             t.status, t.voided_at, t.void_reason,
             a.name as anggota_name, r.name as rekening_name,
             rdest.name as destination_rekening_name
      FROM transaksi t 
      JOIN anggota a ON t.anggota_id = a.id
      JOIN rekening r ON t.rekening_id = r.id
      LEFT JOIN rekening rdest ON t.destination_rekening_id = rdest.id
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
      destination_rekening_id: t.destination_rekening_id,
      anggota_id: t.anggota_id,
      amount: Number(t.amount),
      type: t.type,
      category: t.category,
      description: t.description,
      date: t.date,
      status: t.status || 'posted',
      voided_at: t.voided_at,
      void_reason: t.void_reason,
      anggota_name: t.anggota_name,
      rekening_name: t.rekening_name,
      destination_rekening_name: t.destination_rekening_name,
    })),
  };
}

export async function getRekeningList(keluargaId: number) {
  return await sql`
    SELECT id, name, balance::numeric, type 
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
    SELECT t.id, t.rekening_id, t.destination_rekening_id, t.anggota_id, 
           t.amount::numeric, t.type, t.category, t.description, t.date,
           t.status, t.voided_at, t.void_reason,
           a.name as anggota_name, r.name as rekening_name,
           rdest.name as destination_rekening_name
    FROM transaksi t
    JOIN anggota a ON t.anggota_id = a.id
    JOIN rekening r ON t.rekening_id = r.id
    LEFT JOIN rekening rdest ON t.destination_rekening_id = rdest.id
    WHERE t.anggota_id = ANY(${anggotaIds})
      AND t.date >= ${startDate}
      AND t.date <= ${endDate}
    ORDER BY t.date DESC
  `;

  let totalIncome = 0;
  let totalExpense = 0;

  const formatted = transactions.map((t: any) => {
    const amount = Number(t.amount);
    const isPosted = !t.status || t.status === 'posted';
    if (isPosted) {
      if (t.type === 'income') totalIncome += amount;
      if (t.type === 'expense') totalExpense += amount;
    }
    return {
      id: t.id,
      rekening_id: t.rekening_id,
      destination_rekening_id: t.destination_rekening_id,
      anggota_id: t.anggota_id,
      amount,
      type: t.type,
      category: t.category,
      description: t.description,
      date: t.date,
      status: t.status || 'posted',
      voided_at: t.voided_at,
      void_reason: t.void_reason,
      anggota_name: t.anggota_name,
      rekening_name: t.rekening_name,
      destination_rekening_name: t.destination_rekening_name,
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

// ====================================================================
// ATOMIC FINANCIAL MUTATIONS & AUDIT TRAIL
// ====================================================================

export async function createTransaksi(input: TransaksiInput) {
  const dateVal = input.date ? new Date(input.date) : new Date();
  const amountStr = input.amount.toFixed(2);

  return await sql.begin(async sqlTx => {
    // 1. Cross-Family & Existence Validation with Row Lock (FOR UPDATE)
    const [rek] = await sqlTx`
      SELECT id, keluarga_id, balance FROM rekening 
      WHERE id = ${input.rekening_id} 
      FOR UPDATE
    `;
    if (!rek) throw new Error('Rekening tidak ditemukan');

    const [ang] = await sqlTx`
      SELECT id, keluarga_id FROM anggota 
      WHERE id = ${input.anggota_id}
    `;
    if (!ang) throw new Error('Anggota tidak ditemukan');

    if (rek.keluarga_id !== ang.keluarga_id) {
      throw new Error('CROSS_FAMILY_VIOLATION: Rekening dan Anggota bukan berasal dari keluarga yang sama');
    }

    // 2. Insert Transaction Record (status = 'posted')
    const [tx] = await sqlTx`
      INSERT INTO transaksi (
        rekening_id, 
        destination_rekening_id, 
        anggota_id, 
        amount, 
        type, 
        category, 
        description, 
        date,
        status
      )
      VALUES (
        ${input.rekening_id}, 
        ${input.destination_rekening_id || null}, 
        ${input.anggota_id}, 
        ${amountStr}::numeric, 
        ${input.type}, 
        ${input.category}, 
        ${input.description || ''}, 
        ${dateVal},
        'posted'
      )
      RETURNING id, rekening_id, destination_rekening_id, anggota_id, amount::numeric, type, category, description, date, status
    `;

    // 3. Atomic Balance Mutation
    if (input.type === 'income') {
      await sqlTx`
        UPDATE rekening 
        SET balance = balance + ${amountStr}::numeric 
        WHERE id = ${input.rekening_id}
      `;
    } else if (input.type === 'expense') {
      await sqlTx`
        UPDATE rekening 
        SET balance = balance - ${amountStr}::numeric 
        WHERE id = ${input.rekening_id}
      `;
    }

    // 4. Record Immutable Audit Log
    await sqlTx`
      INSERT INTO audit_log (
        keluarga_id,
        transaksi_id,
        actor_user_id,
        actor_type,
        actor_name,
        telegram_id,
        action,
        new_data
      )
      VALUES (
        ${rek.keluarga_id},
        ${tx.id},
        ${input.actor_user_id || null},
        ${input.actor_type || 'web'},
        ${input.actor_name || null},
        ${input.telegram_id || null},
        'CREATE',
        ${sql.json(tx)}
      )
    `;

    return tx;
  });
}

export async function createTransfer(input: TransferInput) {
  if (input.source_rekening_id === input.destination_rekening_id) {
    throw new Error('Rekening tujuan transfer tidak boleh sama dengan rekening sumber');
  }

  const dateVal = input.date ? new Date(input.date) : new Date();
  const amountStr = input.amount.toFixed(2);

  return await sql.begin(async sqlTx => {
    // 1. Lock both accounts in consistent order to prevent deadlocks
    const firstId = Math.min(input.source_rekening_id, input.destination_rekening_id);
    const secondId = Math.max(input.source_rekening_id, input.destination_rekening_id);

    const [firstRek] = await sqlTx`SELECT id, keluarga_id FROM rekening WHERE id = ${firstId} FOR UPDATE`;
    const [secondRek] = await sqlTx`SELECT id, keluarga_id FROM rekening WHERE id = ${secondId} FOR UPDATE`;

    if (!firstRek || !secondRek) {
      throw new Error('Salah satu rekening transfer tidak ditemukan');
    }

    if (firstRek.keluarga_id !== secondRek.keluarga_id) {
      throw new Error('CROSS_FAMILY_VIOLATION: Transfer hanya dapat dilakukan antar rekening dalam satu keluarga');
    }

    const [ang] = await sqlTx`SELECT id, keluarga_id FROM anggota WHERE id = ${input.anggota_id}`;
    if (!ang || ang.keluarga_id !== firstRek.keluarga_id) {
      throw new Error('CROSS_FAMILY_VIOLATION: Anggota pencatat bukan berasal dari keluarga pemilik rekening');
    }

    // 2. Insert Transfer Transaction
    const [tx] = await sqlTx`
      INSERT INTO transaksi (
        rekening_id,
        destination_rekening_id,
        anggota_id,
        amount,
        type,
        category,
        description,
        date,
        status
      )
      VALUES (
        ${input.source_rekening_id},
        ${input.destination_rekening_id},
        ${input.anggota_id},
        ${amountStr}::numeric,
        'transfer',
        'Transfer Antar Rekening',
        ${input.description || 'Transfer Antar Rekening'},
        ${dateVal},
        'posted'
      )
      RETURNING *
    `;

    // 3. Atomic Dual-Account Balance Update
    await sqlTx`
      UPDATE rekening 
      SET balance = balance - ${amountStr}::numeric 
      WHERE id = ${input.source_rekening_id}
    `;

    await sqlTx`
      UPDATE rekening 
      SET balance = balance + ${amountStr}::numeric 
      WHERE id = ${input.destination_rekening_id}
    `;

    // 4. Record Immutable Audit Log
    await sqlTx`
      INSERT INTO audit_log (
        keluarga_id,
        transaksi_id,
        actor_user_id,
        actor_type,
        actor_name,
        telegram_id,
        action,
        new_data
      )
      VALUES (
        ${firstRek.keluarga_id},
        ${tx.id},
        ${input.actor_user_id || null},
        ${input.actor_type || 'web'},
        ${input.actor_name || null},
        ${input.telegram_id || null},
        'TRANSFER',
        ${sql.json(tx)}
      )
    `;

    return tx;
  });
}

export async function updateTransaksi(
  id: number,
  input: Partial<TransaksiInput>,
  actor?: ActorContext
) {
  return await sql.begin(async sqlTx => {
    // 1. Get old transaction with lock
    const [oldTx] = await sqlTx`SELECT * FROM transaksi WHERE id = ${id} FOR UPDATE`;
    if (!oldTx) throw new Error('Transaksi tidak ditemukan');

    if (oldTx.status === 'voided') {
      throw new Error('INVALID_MUTATION: Transaksi yang sudah dibatalkan (voided) tidak dapat diubah.');
    }

    // 2. Rollback previous balance mutation
    if (oldTx.type === 'income') {
      await sqlTx`UPDATE rekening SET balance = balance - ${oldTx.amount}::numeric WHERE id = ${oldTx.rekening_id}`;
    } else if (oldTx.type === 'expense') {
      await sqlTx`UPDATE rekening SET balance = balance + ${oldTx.amount}::numeric WHERE id = ${oldTx.rekening_id}`;
    } else if (oldTx.type === 'transfer' && oldTx.destination_rekening_id) {
      await sqlTx`UPDATE rekening SET balance = balance + ${oldTx.amount}::numeric WHERE id = ${oldTx.rekening_id}`;
      await sqlTx`UPDATE rekening SET balance = balance - ${oldTx.amount}::numeric WHERE id = ${oldTx.destination_rekening_id}`;
    }

    // 3. Prepare new fields
    const newRekeningId = input.rekening_id ?? oldTx.rekening_id;
    const newAnggotaId = input.anggota_id ?? oldTx.anggota_id;
    const newAmountNum = input.amount ?? Number(oldTx.amount);
    const newAmountStr = newAmountNum.toFixed(2);
    const newType = input.type ?? oldTx.type;
    const newCategory = input.category ?? oldTx.category;
    const newDescription = input.description !== undefined ? input.description : oldTx.description;
    const newDate = input.date ? new Date(input.date) : oldTx.date;
    const newDestRekId = input.destination_rekening_id !== undefined ? input.destination_rekening_id : oldTx.destination_rekening_id;

    // Validate new rekening lock
    const [targetRek] = await sqlTx`SELECT id, keluarga_id FROM rekening WHERE id = ${newRekeningId} FOR UPDATE`;
    if (!targetRek) throw new Error('Rekening tujuan tidak ditemukan');

    // 4. Update transaction row
    const [updated] = await sqlTx`
      UPDATE transaksi
      SET rekening_id = ${newRekeningId},
          destination_rekening_id = ${newDestRekId},
          anggota_id = ${newAnggotaId},
          amount = ${newAmountStr}::numeric,
          type = ${newType},
          category = ${newCategory},
          description = ${newDescription},
          date = ${newDate}
      WHERE id = ${id}
      RETURNING *
    `;

    // 5. Apply new balance mutation
    if (newType === 'income') {
      await sqlTx`UPDATE rekening SET balance = balance + ${newAmountStr}::numeric WHERE id = ${newRekeningId}`;
    } else if (newType === 'expense') {
      await sqlTx`UPDATE rekening SET balance = balance - ${newAmountStr}::numeric WHERE id = ${newRekeningId}`;
    } else if (newType === 'transfer' && newDestRekId) {
      await sqlTx`UPDATE rekening SET balance = balance - ${newAmountStr}::numeric WHERE id = ${newRekeningId}`;
      await sqlTx`UPDATE rekening SET balance = balance + ${newAmountStr}::numeric WHERE id = ${newDestRekId}`;
    }

    // 6. Record Immutable Audit Log (Before vs After)
    await sqlTx`
      INSERT INTO audit_log (
        keluarga_id,
        transaksi_id,
        actor_user_id,
        actor_type,
        actor_name,
        telegram_id,
        action,
        old_data,
        new_data
      )
      VALUES (
        ${targetRek.keluarga_id},
        ${id},
        ${actor?.actor_user_id || input.actor_user_id || null},
        ${actor?.actor_type || input.actor_type || 'web'},
        ${actor?.actor_name || input.actor_name || null},
        ${actor?.telegram_id || input.telegram_id || null},
        'UPDATE',
        ${sql.json(oldTx)},
        ${sql.json(updated)}
      )
    `;

    return updated;
  });
}

/**
 * Atomically voids a posted transaction, reversing its financial effect on balances
 * and preserving historical data in an immutable audit ledger.
 */
export async function voidTransaksi(
  id: number,
  reason?: string,
  actor?: ActorContext
) {
  return await sql.begin(async sqlTx => {
    // 1. Lock transaction row
    const [oldTx] = await sqlTx`
      SELECT t.*, r.keluarga_id
      FROM transaksi t
      JOIN rekening r ON t.rekening_id = r.id
      WHERE t.id = ${id}
      FOR UPDATE
    `;
    if (!oldTx) throw new Error('Transaksi tidak ditemukan');

    // Double-void protection
    if (oldTx.status === 'voided') {
      throw new Error('ALREADY_VOIDED: Transaksi ini sudah dibatalkan sebelumnya.');
    }

    const amountStr = Number(oldTx.amount).toFixed(2);

    // 2. Revert account balances atomically
    if (oldTx.type === 'income') {
      await sqlTx`SELECT id FROM rekening WHERE id = ${oldTx.rekening_id} FOR UPDATE`;
      await sqlTx`
        UPDATE rekening 
        SET balance = balance - ${amountStr}::numeric 
        WHERE id = ${oldTx.rekening_id}
      `;
    } else if (oldTx.type === 'expense') {
      await sqlTx`SELECT id FROM rekening WHERE id = ${oldTx.rekening_id} FOR UPDATE`;
      await sqlTx`
        UPDATE rekening 
        SET balance = balance + ${amountStr}::numeric 
        WHERE id = ${oldTx.rekening_id}
      `;
    } else if (oldTx.type === 'transfer' && oldTx.destination_rekening_id) {
      const firstId = Math.min(oldTx.rekening_id, oldTx.destination_rekening_id);
      const secondId = Math.max(oldTx.rekening_id, oldTx.destination_rekening_id);
      await sqlTx`SELECT id FROM rekening WHERE id = ${firstId} FOR UPDATE`;
      await sqlTx`SELECT id FROM rekening WHERE id = ${secondId} FOR UPDATE`;

      // Reversal: source account refunded (+), destination account deducted (-)
      await sqlTx`
        UPDATE rekening 
        SET balance = balance + ${amountStr}::numeric 
        WHERE id = ${oldTx.rekening_id}
      `;
      await sqlTx`
        UPDATE rekening 
        SET balance = balance - ${amountStr}::numeric 
        WHERE id = ${oldTx.destination_rekening_id}
      `;
    }

    // 3. Mark transaction as voided
    const [voidedTx] = await sqlTx`
      UPDATE transaksi
      SET status = 'voided',
          voided_at = NOW(),
          voided_by = ${actor?.actor_user_id || null},
          void_reason = ${reason || 'Dibatalkan oleh pengguna'}
      WHERE id = ${id}
      RETURNING *
    `;

    // 4. Record VOID in audit_log
    await sqlTx`
      INSERT INTO audit_log (
        keluarga_id,
        transaksi_id,
        actor_user_id,
        actor_type,
        actor_name,
        telegram_id,
        action,
        old_data,
        new_data
      )
      VALUES (
        ${oldTx.keluarga_id},
        ${id},
        ${actor?.actor_user_id || null},
        ${actor?.actor_type || 'web'},
        ${actor?.actor_name || null},
        ${actor?.telegram_id || null},
        'VOID',
        ${sql.json({ id: oldTx.id, status: 'posted', amount: oldTx.amount, type: oldTx.type })},
        ${sql.json({ id: voidedTx.id, status: 'voided', void_reason: voidedTx.void_reason, voided_at: voidedTx.voided_at })}
      )
    `;

    return voidedTx;
  });
}

/**
 * Preserves historical records by soft-voiding instead of hard deleting.
 */
export async function deleteTransaksi(id: number, actor?: ActorContext) {
  await voidTransaksi(id, 'Dihapus melalui web dashboard', actor);
  return { success: true, voided_id: id, status: 'voided' };
}

// --- Audit Log Retrieval Helpers ---

export async function getTransaksiAuditLog(transaksiId: number, keluargaId: number) {
  return await sql`
    SELECT id, keluarga_id, transaksi_id, actor_user_id, actor_type, actor_name, 
           telegram_id, action, old_data, new_data, created_at
    FROM audit_log
    WHERE transaksi_id = ${transaksiId} AND keluarga_id = ${keluargaId}
    ORDER BY created_at DESC
  `;
}

export async function getFamilyAuditLog(keluargaId: number, limit: number = 50) {
  return await sql`
    SELECT id, keluarga_id, transaksi_id, actor_user_id, actor_type, actor_name, 
           telegram_id, action, old_data, new_data, created_at
    FROM audit_log
    WHERE keluarga_id = ${keluargaId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

// --- Reconciliation Helper ---
export async function checkBalanceReconciliation(rekeningId: number) {
  const [rek] = await sql`SELECT id, name, balance::numeric FROM rekening WHERE id = ${rekeningId}`;
  if (!rek) throw new Error('Rekening tidak ditemukan');

  const [incomes] = await sql`
    SELECT COALESCE(SUM(amount), 0)::numeric as total 
    FROM transaksi 
    WHERE ((rekening_id = ${rekeningId} AND type = 'income')
       OR (destination_rekening_id = ${rekeningId} AND type = 'transfer'))
      AND status = 'posted'
  `;

  const [expenses] = await sql`
    SELECT COALESCE(SUM(amount), 0)::numeric as total 
    FROM transaksi 
    WHERE (rekening_id = ${rekeningId} AND (type = 'expense' OR type = 'transfer'))
      AND status = 'posted'
  `;

  const calculatedBalance = Number(incomes.total) - Number(expenses.total);
  const storedBalance = Number(rek.balance);

  return {
    rekening_id: rekeningId,
    name: rek.name,
    stored_balance: storedBalance,
    calculated_balance: calculatedBalance,
    is_reconciled: Math.abs(storedBalance - calculatedBalance) < 0.01,
  };
}

// --- Mutasi Anggota ---
export async function createAnggota(keluargaId: number, name: string, telegramId?: string | null, role: string = 'member') {
  const cleanTelegramId = telegramId ? telegramId.trim() : null;
  const res = await sql`
    INSERT INTO anggota (keluarga_id, name, telegram_id, role)
    VALUES (${keluargaId}, ${name}, ${cleanTelegramId}, ${role}::roleenum)
    RETURNING *
  `;
  return res[0];
}

export async function updateAnggota(id: number, name: string, telegramId?: string | null, role?: string) {
  const cleanTelegramId = telegramId ? telegramId.trim() : null;
  const roleVal = role || 'member';
  const res = await sql`
    UPDATE anggota
    SET name = ${name},
        telegram_id = ${cleanTelegramId},
        role = ${roleVal}::roleenum
    WHERE id = ${id}
    RETURNING *
  `;
  return res[0];
}

export async function deleteAnggota(id: number) {
  return await sql.begin(async sqlTx => {
    // Delete linked transactions first
    await sqlTx`DELETE FROM transaksi WHERE anggota_id = ${id}`;
    await sqlTx`DELETE FROM anggota WHERE id = ${id}`;
    return { success: true, deleted_id: id };
  });
}

// --- Mutasi Rekening ---
export async function createRekening(keluargaId: number, name: string, initialBalance: number = 0, type: string = 'cash') {
  const balanceStr = initialBalance.toFixed(2);
  const res = await sql`
    INSERT INTO rekening (keluarga_id, name, balance, type)
    VALUES (${keluargaId}, ${name}, ${balanceStr}::numeric, ${type}::rekeningtypeenum)
    RETURNING *
  `;
  return res[0];
}

export async function updateRekening(id: number, name: string, type: string) {
  const res = await sql`
    UPDATE rekening
    SET name = ${name},
        type = ${type}::rekeningtypeenum
    WHERE id = ${id}
    RETURNING *
  `;
  return res[0];
}

export async function deleteRekening(id: number) {
  return await sql.begin(async sqlTx => {
    await sqlTx`DELETE FROM transaksi WHERE rekening_id = ${id} OR destination_rekening_id = ${id}`;
    await sqlTx`DELETE FROM rekening WHERE id = ${id}`;
    return { success: true, deleted_id: id };
  });
}

