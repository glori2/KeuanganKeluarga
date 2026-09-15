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

async function show() {
  console.log('=== KELUARGA ===');
  console.log(await sql`SELECT * FROM keluarga`);

  console.log('\n=== ANGGOTA ===');
  console.log(await sql`SELECT * FROM anggota`);

  console.log('\n=== REKENING ===');
  console.log(await sql`SELECT * FROM rekening`);

  console.log('\n=== TRANSAKSI ===');
  console.log(await sql`SELECT * FROM transaksi`);

  await sql.end();
}

show().catch(console.error);
