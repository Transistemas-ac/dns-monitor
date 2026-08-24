/* ===== Capa de datos D1 ===== */

const DB_QUOTA_DOMAINS = 3;

export { DB_QUOTA_DOMAINS };

/* ---------- Users ---------- */

export async function createUser(env, { email, passwordHash, salt }) {
  const res = await env.DB.prepare(
    "INSERT INTO users (email, password_hash, salt, created_at) VALUES (?, ?, ?, ?)"
  )
    .bind(email, passwordHash, salt, Date.now())
    .run();
  return res.meta.last_row_id;
}

export async function getUserByEmail(env, email) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM users WHERE email = ?"
  )
    .bind(email)
    .all();
  return results[0] || null;
}

export async function getUserById(env, id) {
  const { results } = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .all();
  return results[0] || null;
}

/* ---------- Sessions ---------- */

export async function createSession(env, { tokenHash, userId, expiresAt }) {
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(tokenHash, userId, Date.now(), expiresAt)
    .run();
}

export async function getSessionUser(env, tokenHash) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.email, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(tokenHash, Date.now())
    .all();
  return results[0] || null;
}

export async function deleteSession(env, tokenHash) {
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .run();
}

/* ---------- Domains ---------- */

export async function countDomains(env, userId) {
  const { results } = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM domains WHERE user_id = ?"
  )
    .bind(userId)
    .all();
  return results[0]?.n || 0;
}

export async function createDomain(env, { userId, domain }) {
  const res = await env.DB.prepare(
    `INSERT INTO domains
      (user_id, zone_id, zone_name, mail_to, mail_from, expiry_alert_days,
       expect_mx, expect_spf, expect_dmarc, expect_dkim, expect_caa, expect_web,
       cf_token_enc, cf_token_iv, resend_key_enc, resend_key_iv, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      userId,
      domain.zoneId,
      domain.zoneName,
      domain.mailTo,
      domain.mailFrom,
      JSON.stringify(domain.expiryAlertDays || [60, 30, 14, 7, 1]),
      domain.expectMX ? 1 : 0,
      domain.expectSPF ? 1 : 0,
      domain.expectDMARC ? 1 : 0,
      domain.expectDKIM ? 1 : 0,
      domain.expectCAA ? 1 : 0,
      domain.expectWeb ? 1 : 0,
      domain.cfTokenEnc,
      domain.cfTokenIv,
      domain.resendKeyEnc,
      domain.resendKeyIv,
      Date.now()
    )
    .run();
  return res.meta.last_row_id;
}

export async function listDomains(env, userId) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM domains WHERE user_id = ? ORDER BY created_at DESC`
  )
    .bind(userId)
    .all();
  return results;
}

export async function getDomain(env, id, userId) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM domains WHERE id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .all();
  return results[0] || null;
}

export async function updateDomain(env, id, userId, fields) {
  await env.DB.prepare(
    `UPDATE domains SET
       mail_to = ?, mail_from = ?, expiry_alert_days = ?,
       expect_mx = ?, expect_spf = ?, expect_dmarc = ?, expect_dkim = ?,
       expect_caa = ?, expect_web = ?,
       cf_token_enc = ?, cf_token_iv = ?, resend_key_enc = ?, resend_key_iv = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(
      fields.mailTo,
      fields.mailFrom,
      JSON.stringify(fields.expiryAlertDays || [60, 30, 14, 7, 1]),
      fields.expectMX ? 1 : 0,
      fields.expectSPF ? 1 : 0,
      fields.expectDMARC ? 1 : 0,
      fields.expectDKIM ? 1 : 0,
      fields.expectCAA ? 1 : 0,
      fields.expectWeb ? 1 : 0,
      fields.cfTokenEnc,
      fields.cfTokenIv,
      fields.resendKeyEnc,
      fields.resendKeyIv,
      id,
      userId
    )
    .run();
}

export async function deleteDomain(env, id, userId) {
  await env.DB.prepare("DELETE FROM domains WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
}

export async function updateDomainStatus(env, id, { lastCheckTs, lastError }) {
  await env.DB.prepare(
    "UPDATE domains SET last_check_ts = ?, last_error = ? WHERE id = ?"
  )
    .bind(lastCheckTs, lastError || null, id)
    .run();
}

export async function getAllDomains(env) {
  const { results } = await env.DB.prepare(
    `SELECT d.*, u.email AS user_email
     FROM domains d JOIN users u ON u.id = d.user_id`
  ).all();
  return results;
}

/* ---------- Alerts (historial) ---------- */

export async function insertAlert(env, { domainId, userId, subject, sections }) {
  await env.DB.prepare(
    "INSERT INTO alerts (domain_id, user_id, created_at, subject, sections) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(domainId, userId, Date.now(), subject, JSON.stringify(sections))
    .run();
}

export async function listAlerts(env, { userId, domainId, page = 1, perPage = 20 }) {
  const offset = (page - 1) * perPage;
  const whereClause = domainId
    ? "domain_id = ? AND user_id = ?"
    : "user_id = ?";
  const params = domainId ? [domainId, userId] : [userId];

  const { results } = await env.DB.prepare(
    `SELECT id, domain_id, subject, created_at
     FROM alerts WHERE ${whereClause}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(...params, perPage, offset)
    .all();

  const { results: countRows } = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM alerts WHERE ${whereClause}`
  )
    .bind(...params)
    .all();

  return { alerts: results, total: countRows[0]?.n || 0, page, perPage };
}

/* ---------- Tokens (verificación de email y reset de contraseña) ---------- */

export async function createToken(env, { tokenHash, userId, type, expiresAt }) {
  await env.DB.prepare(
    "INSERT INTO tokens (token_hash, user_id, type, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(tokenHash, userId, type, Date.now(), expiresAt)
    .run();
}

export async function getTokenUser(env, tokenHash, type) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.email, u.verified
     FROM tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.type = ? AND t.expires_at > ?`
  )
    .bind(tokenHash, type, Date.now())
    .all();
  return results[0] || null;
}

export async function deleteToken(env, tokenHash) {
  await env.DB.prepare("DELETE FROM tokens WHERE token_hash = ?")
    .bind(tokenHash)
    .run();
}

export async function deleteTokensForUser(env, userId, type) {
  await env.DB.prepare("DELETE FROM tokens WHERE user_id = ? AND type = ?")
    .bind(userId, type)
    .run();
}

export async function setUserVerified(env, userId) {
  await env.DB.prepare("UPDATE users SET verified = 1 WHERE id = ?")
    .bind(userId)
    .run();
}

export async function updateUserPassword(env, userId, passwordHash, salt) {
  await env.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?")
    .bind(passwordHash, salt, userId)
    .run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?")
    .bind(userId)
    .run();
}

/* ---------- Limpieza de estado KV al eliminar un dominio ---------- */

const KV_STATE_KEYS = [
  "dns_state_",
  "ns_state_",
  "audit_cursor_",
  "last_expiry_ts_",
  "last_email_ts_",
  "last_dnssec_ts_",
  "last_caa_ts_",
  "last_web_ts_",
  "last_nscons_ts_",
  "last_https_ts_",
  "caa_state_",
  "caa_warned_",
  "dnssec_state_",
  "expiry_state_",
  "email_state_",
  "https_state_",
  "nscons_state_",
  "web_state_",
  "error_streak_",
];

export async function deleteKvStateForZone(env, zoneId) {
  if (!env.DNS_MONITOR) return;
  await Promise.all(
    KV_STATE_KEYS.map((prefix) =>
      env.DNS_MONITOR.delete(`${prefix}${zoneId}`)
    )
  );
}