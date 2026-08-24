-- 0001_init.sql
-- Multi-tenant: usuarios, dominios con credenciales cifradas, sesiones e historial de alertas.

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone_id TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  mail_to TEXT NOT NULL,
  mail_from TEXT NOT NULL,
  expiry_alert_days TEXT NOT NULL DEFAULT '[60,30,14,7,1]',
  expect_mx INTEGER NOT NULL DEFAULT 1,
  expect_spf INTEGER NOT NULL DEFAULT 1,
  expect_dmarc INTEGER NOT NULL DEFAULT 1,
  expect_dkim INTEGER NOT NULL DEFAULT 1,
  expect_caa INTEGER NOT NULL DEFAULT 0,
  expect_web INTEGER NOT NULL DEFAULT 0,
  cf_token_enc TEXT NOT NULL,
  cf_token_iv TEXT NOT NULL,
  resend_key_enc TEXT NOT NULL,
  resend_key_iv TEXT NOT NULL,
  last_check_ts INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_domains_user ON domains(user_id);
CREATE INDEX idx_domains_zone ON domains(zone_id);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  subject TEXT NOT NULL,
  sections TEXT NOT NULL
);
CREATE INDEX idx_alerts_domain ON alerts(domain_id, created_at DESC);
CREATE INDEX idx_alerts_user ON alerts(user_id, created_at DESC);