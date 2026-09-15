/**
 * Formats a monetary amount into standard Indonesian Rupiah (IDR) format.
 * Guarantees no floating point anomalies (e.g. 119000.0000001).
 */
export function formatRupiah(amount: number | string | null | undefined, includePrefix: boolean = true): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return includePrefix ? 'Rp 0' : '0';
  }

  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  
  // Format with integer / 2 decimal precision without floating point noise
  const parts = num.toFixed(2).split('.');
  const intPart = parseInt(parts[0], 10).toLocaleString('id-ID');
  const decimalPart = parts[1];

  let formatted = intPart;
  if (decimalPart && decimalPart !== '00') {
    formatted += ',' + decimalPart;
  }

  return includePrefix ? `Rp ${formatted}` : formatted;
}

/**
 * Validates and parses user money input.
 * Returns parsed numeric value or null if invalid.
 */
export function parseMoneyInput(value: string | number): { valid: boolean; value: number; error?: string } {
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value) || value <= 0) {
      return { valid: false, value: 0, error: 'Nominal harus lebih besar dari 0' };
    }
    if (value > 100_000_000_000) {
      return { valid: false, value: 0, error: 'Nominal melebihi batas wajar (maksimal 100 Miliar)' };
    }
    return { valid: true, value: Math.round(value * 100) / 100 };
  }

  const cleaned = String(value).trim().replace(/\s/g, '').replace(/,/g, '.');
  if (!cleaned) {
    return { valid: false, value: 0, error: 'Nominal wajib diisi' };
  }

  const num = Number(cleaned);
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    return { valid: false, value: 0, error: 'Nominal harus berupa angka positif lebih dari 0' };
  }

  if (num > 100_000_000_000) {
    return { valid: false, value: 0, error: 'Nominal melebihi batas wajar (maksimal 100 Miliar)' };
  }

  // Max 2 decimal digits check
  const decimalSplit = cleaned.split('.');
  if (decimalSplit.length === 2 && decimalSplit[1].length > 2) {
    return { valid: false, value: 0, error: 'Nominal maksimal 2 angka di belakang koma' };
  }

  return { valid: true, value: Math.round(num * 100) / 100 };
}

/**
 * Formats date string into Indonesian locale date.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

/**
 * Formats datetime string into Indonesian locale datetime.
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

/**
 * Escapes CSV field against formula injection and delimiters.
 * Prepends single quote if field begins with dangerous formula characters: = + - @ \t \r
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  
  // Prevent CSV formula injection in spreadsheet software
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  
  // Escape double quotes and semicolons
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}
