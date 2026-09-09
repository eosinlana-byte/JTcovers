const { Pool } = require("pg");

let connectionString = process.env.DATABASE_URL;
if (connectionString) {
  try {
    const u = new URL(connectionString);
    u.searchParams.delete("channel_binding");
    connectionString = u.toString();
  } catch { /* keep original */ }
}

const needsSsl =
  connectionString &&
  (connectionString.includes("neon.tech") || connectionString.includes("sslmode=require"));

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: 5,
    })
  : null;

async function query(text, params) {
  if (!pool) throw new Error("DATABASE_URL is not set");
  const res = await pool.query(text, params);
  return res.rows;
}

async function init() {
  if (!pool) {
    console.warn("[db] No DATABASE_URL. Site will run, but admin/enquiries need a database.");
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS covers (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      genre TEXT DEFAULT '',
      image TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id SERIAL PRIMARY KEY,
      image TEXT DEFAULT '',
      quote TEXT DEFAULT '',
      name TEXT DEFAULT '',
      role TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS enquiries (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      service TEXT DEFAULT '',
      subject TEXT DEFAULT '',
      message TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS media_files (
      id SERIAL PRIMARY KEY,
      mime_type TEXT NOT NULL,
      original_name TEXT DEFAULT '',
      data BYTEA NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("[db] Ready");
}

module.exports = { query, init, hasDb: () => Boolean(pool) };
