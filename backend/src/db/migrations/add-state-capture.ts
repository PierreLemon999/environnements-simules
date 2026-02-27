/**
 * Migration: Add state-based capture support
 *
 * Adds: pageType, parentPageId, domFingerprint, syntheticUrl, captureTimingMs,
 *       stateIndex columns to pages; captureStrategy to versions;
 *       page_transitions table.
 *
 * Run with: npx tsx src/db/migrations/add-state-capture.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../../../data/app.db');

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = OFF'); // Temporarily disable for ALTER TABLE

const migrations = [
  // -- pages: new columns
  `ALTER TABLE pages ADD COLUMN page_type TEXT NOT NULL DEFAULT 'page'`,
  `ALTER TABLE pages ADD COLUMN parent_page_id TEXT`,
  `ALTER TABLE pages ADD COLUMN dom_fingerprint TEXT`,
  `ALTER TABLE pages ADD COLUMN synthetic_url TEXT`,
  `ALTER TABLE pages ADD COLUMN capture_timing_ms INTEGER`,
  `ALTER TABLE pages ADD COLUMN state_index INTEGER`,

  // -- versions: capture strategy
  `ALTER TABLE versions ADD COLUMN capture_strategy TEXT NOT NULL DEFAULT 'url_based'`,

  // -- page_transitions table
  `CREATE TABLE IF NOT EXISTS page_transitions (
    id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
    source_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    target_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL,
    trigger_selector TEXT,
    trigger_text TEXT,
    loading_time_ms INTEGER,
    had_loading_indicator INTEGER NOT NULL DEFAULT 0,
    loading_indicator_type TEXT,
    capture_mode TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
];

console.log(`Running migration on: ${dbPath}`);

const runAll = sqlite.transaction(() => {
  for (const sql of migrations) {
    try {
      sqlite.exec(sql);
      console.log(`  OK: ${sql.substring(0, 60)}...`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Skip "duplicate column" errors (migration already applied)
      if (msg.includes('duplicate column') || msg.includes('already exists')) {
        console.log(`  SKIP (already exists): ${sql.substring(0, 60)}...`);
      } else {
        throw err;
      }
    }
  }
});

runAll();
sqlite.pragma('foreign_keys = ON');
sqlite.close();

console.log('Migration complete.');
