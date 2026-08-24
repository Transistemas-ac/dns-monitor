-- 0002_drop_legacy_domain_columns.sql
-- El código actual guarda el token CF y los datos de envío a nivel de usuario,
-- no por dominio. Estas columnas legacy eran NOT NULL sin default y rompían
-- el INSERT al crear dominios nuevos. Se eliminan.

ALTER TABLE domains DROP COLUMN mail_to;
ALTER TABLE domains DROP COLUMN mail_from;
ALTER TABLE domains DROP COLUMN cf_token_enc;
ALTER TABLE domains DROP COLUMN cf_token_iv;
ALTER TABLE domains DROP COLUMN resend_key_enc;
ALTER TABLE domains DROP COLUMN resend_key_iv;
