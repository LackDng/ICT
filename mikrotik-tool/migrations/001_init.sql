-- MikroTik Configuration Tool — Initial Schema
-- Migration: 001_init.sql

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ─── Devices ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS devices (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  label             TEXT,
  host              TEXT NOT NULL,
  port              INTEGER DEFAULT 8728,
  username          TEXT NOT NULL DEFAULT 'admin',
  password          TEXT,                          -- AES-256 encrypted
  connection_method TEXT DEFAULT 'auto',           -- 'rest' | 'ssh' | 'auto'
  ros_version       TEXT,
  last_connected    TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Change Log ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS change_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp    TEXT NOT NULL DEFAULT (datetime('now')),
  device_ip    TEXT,
  device_id    INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  session_id   TEXT,
  feature_group TEXT,
  action       TEXT NOT NULL,                      -- 'add'|'set'|'remove'|'read'|'connect'
  api_path     TEXT,
  payload      TEXT,                               -- JSON of params sent
  ros_command  TEXT,                               -- equivalent RouterOS CLI command
  result       TEXT NOT NULL,                      -- 'success'|'failed'|'skipped'
  response     TEXT,                               -- raw API response or error
  applied_by   TEXT
);

CREATE INDEX IF NOT EXISTS idx_log_device  ON change_log(device_ip);
CREATE INDEX IF NOT EXISTS idx_log_session ON change_log(session_id);
CREATE INDEX IF NOT EXISTS idx_log_time    ON change_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_log_result  ON change_log(result);
CREATE INDEX IF NOT EXISTS idx_log_feature ON change_log(feature_group);

-- ─── Device Snapshots ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS device_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id     INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,                     -- full config as JSON
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_snap_device ON device_snapshots(device_id);

-- ─── Sessions (JWT revocation list) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
