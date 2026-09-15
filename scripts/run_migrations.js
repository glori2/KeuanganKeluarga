const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

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

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  console.log('Found migration files:', files);

  for (const file of files) {
    console.log(`\nExecuting migration: ${file}...`);
    const filePath = path.join(migrationsDir, file);
    let sqlContent = fs.readFileSync(filePath, 'utf-8');
    if (sqlContent.charCodeAt(0) === 0xFEFF) {
      sqlContent = sqlContent.slice(1);
    }
    
    try {
      await sql.unsafe(sqlContent);
      console.log(`✅ ${file} applied successfully.`);
    } catch (err) {
      console.error(`❌ Error in ${file}:`, err.message);
      throw err;
    }
  }

  console.log('\n🎉 All migrations completed successfully.');
  await sql.end();
}

runMigrations().catch(err => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
