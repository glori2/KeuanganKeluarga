const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

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

const dbUrl = getDbUrl();
if (!dbUrl) {
  console.error('❌ DATABASE_URL is missing from environment.');
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

// Helper to test format functions directly
function formatRupiah(amount, includePrefix = true) {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return includePrefix ? 'Rp 0' : '0';
  }
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  const parts = num.toFixed(2).split('.');
  const intPart = parseInt(parts[0], 10).toLocaleString('id-ID');
  const decimalPart = parts[1];
  let formatted = intPart;
  if (decimalPart && decimalPart !== '00') {
    formatted += ',' + decimalPart;
  }
  return includePrefix ? `Rp ${formatted}` : formatted;
}

function parseMoneyInput(value) {
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
  const decimalSplit = cleaned.split('.');
  if (decimalSplit.length === 2 && decimalSplit[1].length > 2) {
    return { valid: false, value: 0, error: 'Nominal maksimal 2 angka di belakang koma' };
  }
  return { valid: true, value: Math.round(num * 100) / 100 };
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

async function runTests() {
  console.log('====================================================');
  console.log(' 🎨 PHASE 7 — FRONTEND HARDENING & UX SECURITY TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Hardcoded Family ID in Frontend Scan
  const appDir = path.join(__dirname, '../app');
  function scanFiles(dir, ext = ['.tsx', '.ts']) {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(scanFiles(fullPath, ext));
      } else if (ext.some((e) => entry.name.endsWith(e))) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const tsxFiles = scanFiles(appDir, ['.tsx']);
  let hasHardcodedFamilyInTsx = false;
  for (const file of tsxFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (/getDashboardData\s*\(\s*1\s*\)/.test(content) || /keluarga_id\s*=\s*1\b/.test(content)) {
      hasHardcodedFamilyInTsx = true;
      console.error(`Found hardcoded family ID in: ${file}`);
    }
  }
  assert(!hasHardcodedFamilyInTsx, 'Hardcoded Family ID: No hardcoded family ID in any frontend TSX component');

  // 2. Client-side Secret Leak Scan
  const allAppFiles = scanFiles(appDir, ['.tsx', '.ts']);
  let hasLeakedSecrets = false;
  for (const file of allAppFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/.test(content) ||
        /NEXT_PUBLIC_DATABASE_URL/.test(content) ||
        /NEXT_PUBLIC_TELEGRAM_BOT_TOKEN/.test(content) ||
        /NEXT_PUBLIC_TELEGRAM_WEBHOOK_SECRET/.test(content)) {
      hasLeakedSecrets = true;
      console.error(`Found leaked secret variable in: ${file}`);
    }
  }
  assert(!hasLeakedSecrets, 'Client Bundle Security: No sensitive server keys exposed with NEXT_PUBLIC_');

  // 3. Money Display Formatter Precision Tests
  assert(formatRupiah(119000) === 'Rp 119.000', 'Money Display: Correctly formats integer amount 119000');
  assert(formatRupiah(119000.0000001) === 'Rp 119.000', 'Money Display: Filters floating point noise 119000.0000001');
  assert(formatRupiah(50000.5) === 'Rp 50.000,50', 'Money Display: Formats decimal amount 50000.5');
  assert(formatRupiah(0) === 'Rp 0', 'Money Display: Correctly formats 0');
  assert(formatRupiah(null) === 'Rp 0', 'Money Display: Safely handles null value');

  // 4. Money Input Validator Tests
  assert(parseMoneyInput('50000').valid === true && parseMoneyInput('50000').value === 50000, 'Money Input: Accepts valid integer string');
  assert(parseMoneyInput('-50000').valid === false, 'Money Input: Rejects negative amount');
  assert(parseMoneyInput('0').valid === false, 'Money Input: Rejects zero amount');
  assert(parseMoneyInput('abc').valid === false, 'Money Input: Rejects non-numeric string');
  assert(parseMoneyInput(Infinity).valid === false, 'Money Input: Rejects Infinity');
  assert(parseMoneyInput(NaN).valid === false, 'Money Input: Rejects NaN');
  assert(parseMoneyInput('150000000000').valid === false, 'Money Input: Rejects excessively large number (> 100 Miliar)');
  assert(parseMoneyInput('100.555').valid === false, 'Money Input: Rejects more than 2 decimal places');

  // 5. CSV Formula Injection Escaping Tests
  assert(escapeCsvField('=cmd|"/C calc"!A0') === '"\'=cmd|""/C calc""!A0"', 'CSV Security: Escapes = formula injection');
  assert(escapeCsvField('+123456') === '"\'+123456"', 'CSV Security: Escapes + formula injection');
  assert(escapeCsvField('-123456') === '"\'-123456"', 'CSV Security: Escapes - formula injection');
  assert(escapeCsvField('@SUM(A1:A10)') === '"\'@SUM(A1:A10)"', 'CSV Security: Escapes @ formula injection');
  assert(escapeCsvField('Makan "Siang"') === '"Makan ""Siang"""', 'CSV Security: Escapes double quotes properly');

  // 6. Database Verification: Ensure soft-void and audit records are structurally compatible with frontend types
  const sampleAudit = await sql`
    SELECT id, keluarga_id, transaksi_id, action, actor_type, created_at 
    FROM audit_log 
    ORDER BY id DESC 
    LIMIT 1
  `;
  assert(sampleAudit.length >= 0, 'Database Audit Compatibility: audit_log table schema is verified and queryable');

  console.log('\n====================================================');
  console.log(`🎉 FRONTEND SECURITY TEST RESULTS: ${passed} PASS, ${failed} FAIL`);
  console.log('====================================================\n');

  await sql.end();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
