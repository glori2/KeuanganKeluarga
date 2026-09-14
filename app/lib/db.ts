import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;

// Create a PostgreSQL client that works in Vercel Serverless
const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  max: 1,        // Serverless: keep pool small
  idle_timeout: 20,
});

export default sql;
