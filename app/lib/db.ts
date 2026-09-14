import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || '';

// Create a PostgreSQL client that works in Vercel Serverless
const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export default sql;
