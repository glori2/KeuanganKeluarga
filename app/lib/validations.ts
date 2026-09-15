import { z } from 'zod';

export const CreateTransaksiSchema = z.object({
  rekening_id: z.number().int().positive('ID Rekening harus positif'),
  anggota_id: z.number().int().positive('ID Anggota harus positif'),
  amount: z
    .number()
    .positive('Nominal transaksi harus lebih dari 0')
    .finite('Nominal harus berupa angka valid')
    .max(1_000_000_000_000, 'Nominal melebihi batas maksimal transaksi'),
  type: z.enum(['income', 'expense'], {
    message: 'Tipe transaksi hanya boleh income atau expense',
  }),
  category: z
    .string()
    .trim()
    .min(1, 'Kategori wajib diisi')
    .max(100, 'Kategori maksimal 100 karakter'),
  description: z.string().trim().max(255, 'Keterangan maksimal 255 karakter').optional().default(''),
  date: z.string().or(z.date()).optional(),
  idempotency_key: z.string().max(100).optional(),
});

export const CreateTransferSchema = z.object({
  source_rekening_id: z.number().int().positive('ID Rekening asal harus positif'),
  destination_rekening_id: z.number().int().positive('ID Rekening tujuan harus positif'),
  anggota_id: z.number().int().positive('ID Anggota harus positif'),
  amount: z
    .number()
    .positive('Nominal transfer harus lebih dari 0')
    .finite('Nominal harus berupa angka valid')
    .max(1_000_000_000_000, 'Nominal transfer melebihi batas maksimal'),
  description: z.string().trim().max(255, 'Keterangan maksimal 255 karakter').optional().default('Transfer Antar Rekening'),
  date: z.string().or(z.date()).optional(),
}).refine(data => data.source_rekening_id !== data.destination_rekening_id, {
  message: 'Rekening tujuan tidak boleh sama dengan rekening asal',
  path: ['destination_rekening_id'],
});

export const UpdateTransaksiSchema = z.object({
  rekening_id: z.number().int().positive().optional(),
  anggota_id: z.number().int().positive().optional(),
  amount: z
    .number()
    .positive('Nominal transaksi harus lebih dari 0')
    .finite('Nominal harus berupa angka valid')
    .max(1_000_000_000_000)
    .optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(255).optional(),
  date: z.string().or(z.date()).optional(),
});

export const CreateRekeningSchema = z.object({
  keluarga_id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, 'Nama dompet/rekening wajib diisi').max(100),
  initial_balance: z.number().finite().default(0),
  type: z.enum(['cash', 'bank', 'ewallet']).default('cash'),
});

export const CreateAnggotaSchema = z.object({
  keluarga_id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, 'Nama anggota wajib diisi').max(100),
  telegram_id: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Telegram User ID harus berupa angka (contoh: 123456789)')
    .max(50)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  role: z.enum(['admin', 'member']).default('member'),
  confirm_duplicate: z.boolean().optional().default(false),
});

export const UpdateAnggotaSchema = z.object({
  name: z.string().trim().min(1, 'Nama anggota wajib diisi').max(100),
  telegram_id: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Telegram User ID harus berupa angka (contoh: 123456789)')
    .max(50)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  role: z.enum(['admin', 'member']).optional(),
});

export const TelegramLinkCodeSchema = z.object({
  anggota_id: z.number({
    error: 'ID Anggota wajib diisi dan berupa angka'
  }).int('ID Anggota harus bilangan bulat').positive('ID Anggota harus bernilai positif'),
});

export const CheckDuplicateFamilySchema = z.object({
  familyName: z
    .string({
      error: 'Nama keluarga wajib diisi'
    })
    .trim()
    .min(2, 'Nama keluarga minimal 2 karakter')
    .max(100, 'Nama keluarga maksimal 100 karakter'),
});

export const CreateInvitationSchema = z.object({
  target_role: z.enum(['admin', 'member']).default('member'),
  target_anggota_id: z.number().int().positive().nullable().optional(),
});

export const AcceptInvitationSchema = z.object({
  code: z
    .string({
      error: 'Kode undangan wajib diisi'
    })
    .trim()
    .min(6, 'Kode undangan minimal 6 karakter')
    .max(32, 'Kode undangan maksimal 32 karakter'),
});

