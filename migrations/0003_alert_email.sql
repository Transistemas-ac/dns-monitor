-- 0003_alert_email.sql
-- Email de alertas configurable por usuario (sección Alertas del dashboard).
-- NULL = usar el email de la cuenta.

ALTER TABLE users ADD COLUMN alert_email TEXT;