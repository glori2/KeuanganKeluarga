const postgres = require('postgres');
const fs = require('fs');

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

async function audit() {
  console.log('=== 1. AUDIT SCHEMA & DATA TYPES ===');
  const cols = await sql`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `;
  cols.forEach(c => console.log(`${c.table_name}.${c.column_name} -> ${c.data_type} (${c.udt_name}), nullable: ${c.is_nullable}, default: ${c.column_default}`));

  console.log('\n=== 2. BASELINE FINANCIAL METRICS (BEFORE MIGRATION) ===');
  const rekCount = await sql`
    SELECT 
      count(*)::int as count, 
      count(balance)::int as not_null_count, 
      coalesce(sum(balance), 0)::numeric as total_balance, 
      coalesce(min(balance), 0)::numeric as min_balance, 
      coalesce(max(balance), 0)::numeric as max_balance 
    FROM rekening
  `;
  console.log('Rekening metrics:', rekCount[0]);

  const txCount = await sql`
    SELECT 
      count(*)::int as count, 
      count(amount)::int as not_null_count, 
      coalesce(sum(amount), 0)::numeric as total_amount, 
      coalesce(min(amount), 0)::numeric as min_amount, 
      coalesce(max(amount), 0)::numeric as max_amount 
    FROM transaksi
  `;
  console.log('Transaksi metrics:', txCount[0]);

  console.log('\n=== 3. EXISTING CONSTRAINTS ===');
  const cons = await sql`
    SELECT conname, contype, conrelid::regclass as table_name, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public'
    ORDER BY conrelid::regclass::text, conname;
  `;
  cons.forEach(c => console.log(`${c.table_name} -> [${c.conname}] (${c.contype}): ${c.def}`));

  console.log('\n=== 4. TRANSAKSI ENUM & VALUES ===');
  const enumTypes = await sql`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder;
  `;
  enumTypes.forEach(e => console.log(`Enum ${e.typname} -> '${e.enumlabel}'`));

  await sql.end();
}

audit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
