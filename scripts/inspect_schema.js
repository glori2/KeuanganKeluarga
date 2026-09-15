const postgres = require('postgres');
const fs = require('fs');

// Simple .env.local parser
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

const connectionString = getDbUrl();
if (!connectionString) {
  console.error('No DATABASE_URL found in .env.local');
  process.exit(1);
}

const sql = postgres(connectionString, { ssl: { rejectUnauthorized: false } });

async function inspect() {
  console.log('--- TABLES IN PUBLIC SCHEMA ---');
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;
  console.log('Tables found:', tables.map(t => t.table_name));

  for (const t of tables) {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${t.table_name}
      ORDER BY ordinal_position;
    `;
    console.log(`\nTable [${t.table_name}] columns:`);
    cols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));

    const count = await sql`SELECT count(*) FROM ${sql(t.table_name)}`;
    console.log(`  Total rows: ${count[0].count}`);
  }

  console.log('\n--- EXISTING FOREIGN KEYS ---');
  const fks = await sql`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
  `;
  fks.forEach(fk => console.log(`  ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`));

  await sql.end();
}

inspect().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});
