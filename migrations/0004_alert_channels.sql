-- 0004_alert_channels.sql
-- Canales de alerta por cuenta (globales): telegram, discord, webhook.
-- config_enc/iv = JSON cifrado con MASTER_KEY: telegram {botToken, chatId},
-- discord {url}, webhook {url, signatureSecret}.

CREATE TABLE alert_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT,
  config_enc TEXT NOT NULL,
  config_iv TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_channels_user ON alert_channels(user_id);
CREATE UNIQUE INDEX idx_channels_user_type ON alert_channels(user_id, type);