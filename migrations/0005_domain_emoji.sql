-- 0005_domain_emoji.sql
-- Emoji personalizable por dominio (elegido desde el picker del dashboard).

ALTER TABLE domains ADD COLUMN emoji TEXT NOT NULL DEFAULT '🌍';