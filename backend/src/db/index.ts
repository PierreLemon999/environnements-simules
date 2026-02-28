import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve data directory relative to the backend root
const dataDir = path.resolve(__dirname, '../../data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure uploads directory exists
const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'app.db');
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite, dataDir, uploadsDir };
export default db;

// ── Migrations ──────────────────────────────────────────────────────────────
try { sqlite.exec(`ALTER TABLE projects ADD COLUMN favicon_url TEXT`); } catch { /* already exists */ }

try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'error',
    message TEXT NOT NULL,
    stack TEXT,
    endpoint TEXT,
    method TEXT,
    status_code INTEGER,
    user_id TEXT,
    user_agent TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL
  )`);
} catch { /* already exists */ }
