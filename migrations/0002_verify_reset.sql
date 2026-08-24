-- 0002_verify_reset.sql
-- Verificación de email y tokens de reset de contraseña.

ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;

CREATE TABLE tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_tokens_user ON tokens(user_id);