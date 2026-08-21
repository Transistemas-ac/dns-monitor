# 👁️ DNS Monitor - Cloudflare Worker

> 🇬🇧 English | 🇪🇸 [Español](README.es.md)

### Domain monitoring with email alerts: DNS changes, nameservers, expiry, email records, DNSSEC and monitor health

This project implements a **Cloudflare Worker with cron** that monitors:

- changes in the internal DNS records (Cloudflare)
- changes in the real domain nameservers (DNS over HTTPS)
- **who** made each DNS change (Cloudflare Audit Logs)
- domain expiration (RDAP, free, no API key), including **registrar changes** and **critical statuses** (`pendingDelete`, `redemptionPeriod`, `clientHold`)
- email records: **MX, SPF, DMARC, DKIM** (DNS over HTTPS), plus **SPF DNS lookup limit** (RFC 7208) and **DMARC rua/ruf** report addresses
- **DNSSEC** status (Cloudflare + public DS records)
- **CAA** records (*optional*, `expectCAA`)
- **HTTPS (SVCB)** record in the apex
- **nameserver consistency** between resolvers 1.1.1.1 and 8.8.8.8 (possible DNS hijacking/fragmentation)
- **web check** (*optional*, `expectWeb`): is the site actually responding over HTTPS?
- monitor health: missed runs and recurring errors (heartbeat)

And it sends an automatic email when it detects any difference or problem. It can monitor **multiple domains**, each with its own recipient email.

<br>

## 🚀 How it works

1. The Worker runs every 10 minutes.
2. It fetches the internal DNS records via the Cloudflare API and the real nameservers via DoH, and compares them with snapshots in KV. If there are changes, it attaches who made them by querying the Cloudflare Audit Logs.
3. The status checks (expiry, email records, DNSSEC) run **once per day** (freshness controlled by timestamps in KV).
4. The heartbeat detects missed cron runs and recurring errors per domain.
5. If there is anything new, it sends a combined email with all the domain's sections.

<br>

## 🔧 Prerequisites

- Cloudflare Workers enabled
- Access to the domains to monitor in Cloudflare
- A **Resend** account
- Domain(s) verified in Resend (the `mailFrom` sender must be verified)
- Cloudflare token with permissions over **all** zones to monitor:
  - `Zone → DNS → Read`
  - `Zone → Zone → Read`
  - `Zone → Logs → Read` (required for the "Who changed it" section; if missing, it is skipped without breaking the rest)

<br>

## ⚙️ Installation

Clone the repository:

    git clone https://github.com/Transistemas-ac/dns-monitor

Install dependencies:

    npm install

Create the KV namespace:

    npx wrangler kv namespace create DNS_MONITOR

The command returns a JSON with an `id`. Copy it into `wrangler.toml`:

    kv_namespaces = [
      { binding = "DNS_MONITOR", id = "<id from the command>" }
    ]

Configure the secrets:

    npx wrangler secret put CF_API_TOKEN
    npx wrangler secret put RESEND_API_KEY

Optional — external watchdog (covers the total death of the Worker, which the internal heartbeat cannot detect). Setup step by step:

1. Create a free account at [healthchecks.io](https://healthchecks.io) and go to **My Checks → Add Check**.
2. Pick **"Ping-only"** as the check type (no project, no storage).
3. Set the **Period** to `10` minutes and the **Grace** to `1` day (or more, if you don't want night emails). The Worker pings at the end of every successful run; Healthchecks alerts if the pings stop.
4. Copy the ping URL of the check (e.g. `https://hc-ping.com/<uuid>`) and configure it as a secret:

       npx wrangler secret put HEALTHCHECKS_URL

5. Deploy and verify: after the next run you should see the check's **Pings** list update, and the Worker logs `Healthchecks ping` activity in `wrangler tail`. If the cron dies entirely, Healthchecks sends the alert.

Edit `wrangler.toml`:

- the `id` returned by the KV command above (see the `kv_namespaces` block)
- the `DOMAINS` variable with the list of domains to monitor (JSON array)

> ⚠️ **Important:** the `DOMAINS` variable comes preconfigured with the values of **transistemas.org** as an example. You must replace it with **your own domain** and **your own emails** before deploying.

`DOMAINS` format — per domain:

| Field            | Description                                                                     |
| ---------------- | ------------------------------------------------------------------------------- |
| `zoneId`         | Zone ID in Cloudflare                                                           |
| `zoneName`       | The domain to monitor                                                           |
| `mailTo`         | Alert recipient                                                                 |
| `mailFrom`       | Sender (must be verified in your Resend account)                                |
| `expiryAlertDays`| *(optional)* Day thresholds to alert expiry. Default: `[60, 30, 14, 7, 1]`       |
| `expectMX`       | *(optional)* Verify MX. Default: `true`                                         |
| `expectSPF`      | *(optional)* Verify SPF. Default: `true`                                        |
| `expectDMARC`     | *(optional)* Verify DMARC. Default: `true`                                      |
| `expectDKIM`      | *(optional)* Verify DKIM. Default: `true`                                      |
| `expectCAA`       | *(optional)* Warn if no CAA records exist. Default: `false`                    |
| `expectWeb`       | *(optional)* Check the site responds over HTTPS. Default: `false`              |

Example with two domains (multiline JSON with triple quotes `"""`):

```toml
[vars]
DOMAINS = """[
  {
    "zoneId": "<ZONE_ID>",
    "zoneName": "example.com",
    "mailTo": "admin@example.com",
    "mailFrom": "dns@example.com"
  },
  {
    "zoneId": "<ZONE_ID_2>",
    "zoneName": "example.org",
    "mailTo": "ops@example.org",
    "mailFrom": "dns@example.org",
    "expiryAlertDays": [30, 14, 7],
    "expectDKIM": false
  }
]"""
```

> Note: `mailFrom` doesn't have to belong to the monitored domain, but it must be a verified sender in your Resend account.

<br>

## 🚀 Deploy

    npx wrangler deploy

The landing page is served at **https://dns.transistemas.org** (custom domain configured in `wrangler.toml`). The scheduled cron (`*/10 * * * *`) runs alongside it; deploy once and forget.

<br>

## 🧪 Quick test

Create a test DNS record in any of the monitored domains:

- Type: `TXT`
- Name: `dns-test`
- Content: `test`

You should receive an email at the configured `mailTo` for that domain within 10 minutes, including the "Who changed it" section (if the token has `Zone → Logs → Read`).

To trigger the cron manually in development:

    npx wrangler dev --test-scheduled
    curl "http://localhost:8787/__scheduled?cron=*/10+*+*+*+*"

> The daily checks (expiry, email, DNSSEC) run once every 24 h. To force them on the first deploy, delete the keys `last_expiry_ts_<zoneId>`, `last_email_ts_<zoneId>` and `last_dnssec_ts_<zoneId>` from the KV (or just wait for the first daily run).

<br>

## 🔍 Logs

    npx wrangler tail

<br>

## ⚡ Functions

- `scheduled(event, env, ctx)`: Entry point of the scheduled Worker; triggers the periodic execution of `runCheck` using the configured cron. Ensures the check runs in the background with `ctx.waitUntil`.

- `runCheck(env)`: Orchestrates the full run: missed-run heartbeat, per-domain check, error recovery, Healthchecks.io ping and global alert sending. If a domain fails, the error is logged and the rest continues.

- `getDomains(env)`: Reads and validates the `DOMAINS` variable (accepts a JSON string or an already parsed array) and returns the list of domains.

- `checkDomain(env, domain)`: Orchestrates the flow of a single domain: internal DNS, external nameservers, audit logs (if there was a DNS diff) and the daily checks with freshness control via KV timestamps. Returns the domain's alert sections.

- `fetchAuditSection(env, domain)`: Queries the zone Audit Logs from the cursor stored in KV, filters `dns_record.*` events and extracts the `email`, `action` and `date` of each author. Advances the cursor only if the query was successful; on 403 (missing permission) it is skipped without breaking the flow.

- `checkMissedRuns(env)`: Internal heartbeat. Stores `last_run_ts` in KV and, if the previous run is more than 25 min old, generates a "missed runs" alert (covers silent cron failures).

- `pingHealthchecks(env)`: Pings `HEALTHCHECKS_URL` (if configured) at the end of every successful run — external watchdog that covers the total death of the Worker.

- `recordDomainError(env, domain)` / `clearDomainError(env, domain)`: Keep a consecutive-error counter per domain in KV. Alerts at 3 errors (and every 3 following runs); reports "Domain recovered" when it works again.

- `checkDomainExpiry(env, domain)`: Queries RDAP (`rdap.org/domain/...`) for the real domain expiration date and alerts when crossing each `expiryAlertDays` threshold. Detects renewals and reports when the date changes with an active alert. Also alerts when the **registrar changes** and when critical statuses appear (`pendingDelete`, `redemptionPeriod`, `clientHold`).

- `checkEmailRecords(env, domain)`: Verifies via DoH the MX, SPF (missing/duplicate/without `all`/more than 10 DNS lookups per RFC 7208), DMARC (missing/`p=none`/duplicate/without `rua`/`ruf`) and DKIM (common selectors) records. Alerts **only when the status changes** compared to the KV snapshot, not every day.

- `checkDnssec(env, domain)`: Compares the Cloudflare DNSSEC status (`active/pending/disabled` + expected DS) with the public DS records via DoH. Detects unpropagated DS, orphan DS and DS mismatch.

- `checkCaa(env, domain)`: Queries the CAA records (type 257) via DoH and alerts on changes. With `expectCAA: true`, warns once if no CAA records exist.

- `checkWeb(env, domain)`: With `expectWeb: true`, fetches `https://<domain>` (15 s timeout) and alerts when the site starts/stops responding or changes HTTP status.

- `checkNsConsistency(env, domain)`: Compares the NS records returned by 1.1.1.1 (Cloudflare) and 8.8.8.8 (Google) and alerts if the resolvers disagree — possible DNS hijacking or fragmentation.

- `checkHttpsRecord(env, domain)`: Tracks the HTTPS (SVCB, type 65) record in the apex via DoH and alerts on changes.

- `dohQuery(name, type)`: DNS-over-HTTPS query helper (Cloudflare DNS JSON) used by the nameserver, email and DNSSEC checks.

- `fetchAllDnsRecords(zoneId, apiToken)`: Queries the Cloudflare API paginating over all the zone's DNS records.

- `normalizeRecords(records)`: Normalizes the DNS records to a reduced and sorted format to compare them deterministically.

- `diffRecords(previous, current)`: Computes the differences between snapshots (created, deleted, modified) and exposes `hasChanges`.

- `buildEmailBody(zoneName, sections)`: Builds the email body from generic sections `{title, lines}` (DNS diff, NS diff, expiry, email, DNSSEC, audit, heartbeat).

- `sendEmail(env, { from, to, subject, body })`: Sends the notification email using the Resend API.

<br>

## 🛡️ Security

This repository **contains no secrets**.  
Tokens are managed exclusively with:

    npx wrangler secret put ...

The `.gitignore` prevents accidentally uploading variables, logs or credentials.

<br>

## 📝 License

MIT.
You can use this Worker to monitor any domain: DNS changes, nameservers, expiry, email records, DNSSEC and monitor health.

<br>

---

_🌈 Created with pride by the Transistemas Development Team ❤_