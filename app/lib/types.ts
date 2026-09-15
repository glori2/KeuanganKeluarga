export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'posted' | 'voided';
export type RekeningType = 'cash' | 'bank' | 'ewallet' | 'investment' | 'other';
export type MemberRole = 'admin' | 'member';
export type ActorType = 'web' | 'telegram' | 'system' | 'api';
export type AuditAction = 'CREATE' | 'UPDATE' | 'VOID' | 'TRANSFER';

export interface Rekening {
  id: number;
  keluarga_id?: number;
  name: string;
  balance: number;
  type: RekeningType;
  created_at?: string;
}

export interface Anggota {
  id: number;
  keluarga_id?: number;
  name: string;
  telegram_id?: string | null;
  role: MemberRole;
  user_id?: string | null;
  created_at?: string;
}

export interface Transaksi {
  id: number;
  keluarga_id?: number;
  rekening_id: number;
  destination_rekening_id?: number | null;
  anggota_id: number;
  amount: number;
  type: TransactionType;
  category: string;
  description?: string | null;
  date: string;
  status: TransactionStatus;
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
  created_at?: string;
  // Joined fields
  anggota_name?: string;
  rekening_name?: string;
  destination_rekening_name?: string | null;
}

export interface AuditLogEntry {
  id: number;
  keluarga_id: number;
  transaksi_id?: number | null;
  actor_user_id?: string | null;
  actor_type: ActorType;
  actor_name?: string | null;
  telegram_id?: string | null;
  action: AuditAction;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardData {
  total_balance: number;
  total_income: number;
  total_expense: number;
  rekening_list: Rekening[];
  recent_transactions: Transaksi[];
  anggota_list: Anggota[];
}

export interface LaporanSummary {
  total_income: number;
  total_expense: number;
  net: number;
}

export interface LaporanResponse {
  transactions: Transaksi[];
  summary: LaporanSummary;
}

export interface TelegramLinkCodeResponse {
  code: string;
  expires_at: string;
  expires_in_minutes: number;
  instructions: string[];
}
