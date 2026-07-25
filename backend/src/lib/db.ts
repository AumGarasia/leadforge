/**
 * Query driver abstraction.
 *
 * Local dev and tests use Node's built-in `node:sqlite` — zero native/binary
 * deps, works anywhere. Production uses Postgres via `pg`, selected
 * automatically when DATABASE_URL is set (e.g. a Render/Neon connection
 * string). Everything above this file (repositories.ts) calls db.all/get/run
 * with `?`-style placeholders and never knows which driver is underneath —
 * this is the one file the SRS's "swap to Postgres" note refers to.
 */
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";

export interface Driver {
  all(sql: string, params?: any[]): Promise<any[]>;
  get(sql: string, params?: any[]): Promise<any | undefined>;
  run(sql: string, params?: any[]): Promise<void>;
  close(): void;
}

// Converts `?` placeholders (used throughout repositories.ts) to Postgres's
// `$1, $2, ...` style — keeps repositories.ts driver-agnostic.
function toPgPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

class SqliteDriver implements Driver {
  private conn: DatabaseSync;
  constructor(path: string) {
    this.conn = new DatabaseSync(path);
    this.conn.exec("PRAGMA foreign_keys = ON;");
  }
  async all(sql: string, params: any[] = []) {
    return this.conn.prepare(sql).all(...params);
  }
  async get(sql: string, params: any[] = []) {
    return this.conn.prepare(sql).get(...params);
  }
  async run(sql: string, params: any[] = []) {
    this.conn.prepare(sql).run(...params);
  }
  execSync(sql: string) {
    this.conn.exec(sql);
  }
  close() {
    this.conn.close();
  }
}

class PgDriver implements Driver {
  private pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  async all(sql: string, params: any[] = []) {
    const res = await this.pool.query(toPgPlaceholders(sql), params);
    return res.rows;
  }
  async get(sql: string, params: any[] = []) {
    const res = await this.pool.query(toPgPlaceholders(sql), params);
    return res.rows[0];
  }
  async run(sql: string, params: any[] = []) {
    await this.pool.query(toPgPlaceholders(sql), params);
  }
  async execRaw(sql: string) {
    await this.pool.query(sql);
  }
  close() {
    void this.pool.end();
  }
}

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN','MEMBER')) DEFAULT 'MEMBER',
    isActive INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    message TEXT,
    source TEXT NOT NULL DEFAULT 'public_form',
    stage TEXT NOT NULL CHECK (stage IN ('NEW','CONTACTED','QUALIFIED','PROPOSAL_SENT','WON','LOST')) DEFAULT 'NEW',
    lostReason TEXT,
    assignedToId TEXT REFERENCES users(id),
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    leadId TEXT NOT NULL REFERENCES leads(id),
    authorId TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    leadId TEXT NOT NULL REFERENCES leads(id),
    actorId TEXT REFERENCES users(id),
    eventType TEXT NOT NULL CHECK (eventType IN ('CREATED','STAGE_CHANGED','ASSIGNED','NOTE_ADDED')),
    payload TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
  CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assignedToId);
  CREATE INDEX IF NOT EXISTS idx_notes_lead ON notes(leadId);
  CREATE INDEX IF NOT EXISTS idx_activity_lead ON activity_log(leadId);
`;

const PG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN','MEMBER')) DEFAULT 'MEMBER',
    isActive BOOLEAN NOT NULL DEFAULT true,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    message TEXT,
    source TEXT NOT NULL DEFAULT 'public_form',
    stage TEXT NOT NULL CHECK (stage IN ('NEW','CONTACTED','QUALIFIED','PROPOSAL_SENT','WON','LOST')) DEFAULT 'NEW',
    lostReason TEXT,
    assignedToId TEXT REFERENCES users(id),
    createdAt TIMESTAMPTZ NOT NULL DEFAULT now(),
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    leadId TEXT NOT NULL REFERENCES leads(id),
    authorId TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    leadId TEXT NOT NULL REFERENCES leads(id),
    actorId TEXT REFERENCES users(id),
    eventType TEXT NOT NULL CHECK (eventType IN ('CREATED','STAGE_CHANGED','ASSIGNED','NOTE_ADDED')),
    payload TEXT NOT NULL,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
  CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assignedToId);
  CREATE INDEX IF NOT EXISTS idx_notes_lead ON notes(leadId);
  CREATE INDEX IF NOT EXISTS idx_activity_lead ON activity_log(leadId);
`;

let driver: Driver;
let sqliteInstance: SqliteDriver | null = null;
let pgInstance: PgDriver | null = null;

if (process.env.DATABASE_URL) {
  pgInstance = new PgDriver(process.env.DATABASE_URL);
  driver = pgInstance;
} else {
  const path = process.env.DATABASE_PATH || ":memory:";
  sqliteInstance = new SqliteDriver(path);
  sqliteInstance.execSync(SQLITE_SCHEMA);
  driver = sqliteInstance;
}

export const db = driver;

// Called once at boot (see index.ts). No-op for SQLite (schema already
// applied synchronously above); runs the Postgres DDL on first connection.
export async function ensureSchema() {
  if (pgInstance) {
    await pgInstance.execRaw(PG_SCHEMA);
  }
}

export function resetDb() {
  if (sqliteInstance) {
    sqliteInstance.execSync(`
      DELETE FROM activity_log;
      DELETE FROM notes;
      DELETE FROM leads;
      DELETE FROM users;
    `);
  }
}
