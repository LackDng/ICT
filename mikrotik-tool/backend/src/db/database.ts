import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH || './data/mikrotik.db';
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

function runMigrations(database: Database.Database): void {
  const migrationPath = path.join(__dirname, '../../../migrations/001_init.sql');
  if (fs.existsSync(migrationPath)) {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    database.exec(sql);
  } else {
    // Inline schema if migration file not found
    database.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;

      CREATE TABLE IF NOT EXISTS devices (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        label             TEXT,
        host              TEXT NOT NULL,
        port              INTEGER DEFAULT 8728,
        username          TEXT NOT NULL DEFAULT 'admin',
        password          TEXT,
        connection_method TEXT DEFAULT 'auto',
        ros_version       TEXT,
        last_connected    TEXT,
        created_at        TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS change_log (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp     TEXT NOT NULL DEFAULT (datetime('now')),
        device_ip     TEXT,
        device_id     INTEGER REFERENCES devices(id) ON DELETE SET NULL,
        session_id    TEXT,
        feature_group TEXT,
        action        TEXT NOT NULL,
        api_path      TEXT,
        payload       TEXT,
        ros_command   TEXT,
        result        TEXT NOT NULL,
        response      TEXT,
        applied_by    TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_log_device  ON change_log(device_ip);
      CREATE INDEX IF NOT EXISTS idx_log_session ON change_log(session_id);
      CREATE INDEX IF NOT EXISTS idx_log_time    ON change_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_log_result  ON change_log(result);
      CREATE INDEX IF NOT EXISTS idx_log_feature ON change_log(feature_group);

      CREATE TABLE IF NOT EXISTS device_snapshots (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id     INTEGER REFERENCES devices(id) ON DELETE CASCADE,
        label         TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_snap_device ON device_snapshots(device_id);

      CREATE TABLE IF NOT EXISTS revoked_tokens (
        jti        TEXT PRIMARY KEY,
        revoked_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL
      );
    `);
  }
}

// ─── Device queries ───────────────────────────────────────────────────────────

export function getAllDevices() {
  return getDb()
    .prepare('SELECT id, label, host, port, username, connection_method, ros_version, last_connected, created_at FROM devices ORDER BY created_at DESC')
    .all();
}

export function getDeviceById(id: number) {
  return getDb()
    .prepare('SELECT id, label, host, port, username, connection_method, ros_version, last_connected, created_at FROM devices WHERE id = ?')
    .get(id);
}

export function upsertDevice(data: {
  label?: string;
  host: string;
  port: number;
  username: string;
  encryptedPassword: string;
  connection_method: string;
  ros_version?: string;
}): number {
  const existing = getDb()
    .prepare('SELECT id FROM devices WHERE host = ? AND username = ?')
    .get(data.host, data.username) as { id: number } | undefined;

  if (existing) {
    getDb().prepare(`
      UPDATE devices SET label=?, port=?, password=?, connection_method=?, ros_version=?, last_connected=datetime('now')
      WHERE id=?
    `).run(data.label ?? null, data.port, data.encryptedPassword, data.connection_method, data.ros_version ?? null, existing.id);
    return existing.id;
  } else {
    const result = getDb().prepare(`
      INSERT INTO devices (label, host, port, username, password, connection_method, ros_version, last_connected)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(data.label ?? null, data.host, data.port, data.username, data.encryptedPassword, data.connection_method, data.ros_version ?? null);
    return result.lastInsertRowid as number;
  }
}

export function deleteDevice(id: number) {
  getDb().prepare('DELETE FROM devices WHERE id = ?').run(id);
}

export function updateDeviceLastConnected(host: string, ros_version?: string) {
  getDb().prepare(`
    UPDATE devices SET last_connected=datetime('now'), ros_version=? WHERE host=?
  `).run(ros_version ?? null, host);
}

// ─── Change log queries ───────────────────────────────────────────────────────

export interface ChangeLogFilter {
  device_ip?: string;
  feature_group?: string;
  result?: string;
  session_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export function insertChangeLog(entry: {
  device_ip?: string;
  device_id?: number;
  session_id?: string;
  feature_group?: string;
  action: string;
  api_path?: string;
  payload?: string;
  ros_command?: string;
  result: string;
  response?: string;
  applied_by?: string;
}): number {
  const result = getDb().prepare(`
    INSERT INTO change_log
      (timestamp, device_ip, device_id, session_id, feature_group, action, api_path, payload, ros_command, result, response, applied_by)
    VALUES
      (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.device_ip ?? null,
    entry.device_id ?? null,
    entry.session_id ?? null,
    entry.feature_group ?? null,
    entry.action,
    entry.api_path ?? null,
    entry.payload ?? null,
    entry.ros_command ?? null,
    entry.result,
    entry.response ?? null,
    entry.applied_by ?? null
  );
  return result.lastInsertRowid as number;
}

export function queryChangeLogs(filter: ChangeLogFilter) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.device_ip) { conditions.push('device_ip = ?'); params.push(filter.device_ip); }
  if (filter.feature_group) { conditions.push('feature_group = ?'); params.push(filter.feature_group); }
  if (filter.result) { conditions.push('result = ?'); params.push(filter.result); }
  if (filter.session_id) { conditions.push('session_id = ?'); params.push(filter.session_id); }
  if (filter.from_date) { conditions.push('timestamp >= ?'); params.push(filter.from_date); }
  if (filter.to_date) { conditions.push('timestamp <= ?'); params.push(filter.to_date); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filter.limit ?? 200;
  const offset = filter.offset ?? 0;

  const rows = getDb().prepare(`
    SELECT * FROM change_log ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = (getDb().prepare(`
    SELECT COUNT(*) as cnt FROM change_log ${where}
  `).get(...params) as { cnt: number }).cnt;

  return { rows, total };
}

export function deleteChangeLogOlderThan(days: number) {
  const result = getDb().prepare(`
    DELETE FROM change_log WHERE timestamp < datetime('now', '-' || ? || ' days')
  `).run(days);
  return result.changes;
}

// ─── Snapshot queries ─────────────────────────────────────────────────────────

export function insertSnapshot(data: {
  device_id: number;
  label: string;
  snapshot_json: string;
}): number {
  const result = getDb().prepare(`
    INSERT INTO device_snapshots (device_id, label, snapshot_json)
    VALUES (?, ?, ?)
  `).run(data.device_id, data.label, data.snapshot_json);
  return result.lastInsertRowid as number;
}

export function getSnapshotsByDevice(device_id: number) {
  return getDb().prepare(`
    SELECT id, device_id, label, created_at FROM device_snapshots
    WHERE device_id = ? ORDER BY created_at DESC
  `).all(device_id);
}

export function getSnapshotById(id: number) {
  return getDb().prepare('SELECT * FROM device_snapshots WHERE id = ?').get(id);
}

export function deleteSnapshot(id: number) {
  getDb().prepare('DELETE FROM device_snapshots WHERE id = ?').run(id);
}
