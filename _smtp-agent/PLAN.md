# RunnersHub SMTP Agent — Planning Document

Last updated: 2025-08-08
Owner: You (RunnersHub)

## 1) Purpose & Scope
A standalone Python service that continuously monitors Firestore collection `/mail` and sends emails via the provider’s SMTP service. It replaces the “send” step of the Firebase Trigger Email Extension while keeping upstream content generation unchanged.

In-scope:
- Poll or listen for new/failed docs in `/mail`.
- Validate required fields (`to`, `subject`, `message.html`).
- Send via authenticated SMTP (TLS).
- Update the Firestore document with delivery status.
- Log to console and optionally to file.
 - Provide a lightweight Admin GUI (local web UI) for configuration (e.g., polling interval) and a status/stats dashboard.

Out-of-scope:
- Template rendering, content generation, scheduling — done upstream.
- Complex queue orchestration.

## 2) Stakeholders
- RunnersHub maintainers (ops + dev)
- Admin recipients (report emails)

## 3) Assumptions
- Cloud Functions (or similar) already write complete email payloads to `/mail`.
- Service account with read/write access to Firestore.
- SMTP credentials provided by domain/email provider.

## 4) Document Contract (Firestore `/mail`)
Required fields:
- `to: string | string[]`
- `subject: string`
- `message.html: string`
Optional fields (produced upstream):
- `type: string`
- `state: 'PENDING' | 'ERROR' | 'SENT' | string` (any string allowed, we only key on ERROR and success)
- `delivery: { success: bool, timestamp: Timestamp, error?: string } | null`

Processing rules:
- Process if `delivery == null` OR `state == 'ERROR'`.
- Skip if `delivery.success == true`.
- Support `to` as single string or array; send one email with all recipients in `To`.
- Update `delivery` and `state` after attempt.

## 5) Architecture
Modules:
- `main.py` – bootstraps service, sets logging, starts listener.
- `firestore_listener.py` – queries/polls Firestore, selects docs to process, updates status.
- `smtp_sender.py` – constructs and sends email via SMTP (TLS, auth).
- `config.py` – loads env/config (paths, SMTP, polling, logging).
- `utils.py` (optional) – validation helpers, parsing arrays, backoff helpers.

Runtime model:
- MVP: polling loop every `POLL_INTERVAL` seconds.
- Future: switch to Firestore onSnapshot listener if desired (long-lived stream), with reconnect logic.

### 5a) Admin GUI (Planned)
- Goals:
  - Adjust runtime settings without restarting (e.g., `POLL_INTERVAL`, log level).
  - View live status: last poll time, processed counts, success/error rates, recent errors.
  - Manual actions: trigger immediate poll, test email send.
- Approach:
  - Lightweight local web server (FastAPI or Flask) running in the same process, separate thread.
  - Serve a minimal HTML dashboard (Jinja2 or HTMX) with Tailwind (optional) for simplicity.
  - Provide REST endpoints for settings and actions.
- Security:
  - Bind to `127.0.0.1` by default (LAN access off by default).
  - Optional Basic Auth via env vars; session cookie for dashboard.
  - No secrets rendered; redact sensitive config.
- Persistence of settings:
  - In-memory with write-through to a local JSON file (e.g., `runtime_settings.json`).
  - On startup, load overrides that merge with `config.py` defaults.
- Telemetry & metrics:
  - Keep in-process counters (sent_ok, sent_error, last_send_ts, queue_size on last check).
  - Expose `/metrics` (optionally Prometheus format) in future.

## 6) Configuration
Loaded from environment or `.env` (not committed):
- Firebase: `FIREBASE_SERVICE_ACCOUNT_PATH`, `FIREBASE_DATABASE_URL`.
- SMTP: `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_USE_TLS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`.
- App: `POLL_INTERVAL` (sec), `MAX_RETRY_COUNT`.
- Logging: `LOG_LEVEL`, `LOG_FILE` (optional).

Secrets handling:
- `.env` for local only; in prod, use systemd Environment or secret manager.

## 7) Error Handling, Retries, Idempotency
- Validation failure → mark `delivery.success = false`, `state = 'ERROR'`, `error` message.
- SMTP transient failure → retry with exponential backoff up to `MAX_RETRY_COUNT`.
- Idempotency: skip docs where `delivery.success == true`.
- Consider adding a `processing` marker to avoid double-processing if we add concurrency later.

Retry/backoff (planned):
- Base delay: 5s; backoff factor: 2; jitter: ±20%.

## 8) Concurrency & Throughput
- MVP: Single-threaded loop.
- Future: Bounded worker pool (size N) to process multiple emails concurrently.
- Add simple rate limit (X emails/min) if SMTP provider enforces limits.

## 9) Observability & Logging
- Console logs by default; optional `LOG_FILE` for persistent logs.
- Levels: INFO for flow; DEBUG for payload shapes (without secrets), ERROR for failures.
- Include doc id and recipient in log lines.

## 10) Security
- Service account JSON stored locally on host running the agent.
- Do not log SMTP credentials or full message content; safe summaries only.
- TLS for SMTP by default.

## 11) Deployment & Operations
Run modes:
- Local dev: `python main.py` from `_smtp-agent` dir.
- Persistent service: systemd unit (example):

```
[Unit]
Description=RunnersHub SMTP Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/USER/runners-hub/_smtp-agent
Environment=PYTHONUNBUFFERED=1
Environment=LOG_LEVEL=INFO
# EnvironmentFile=/etc/runnershub-smtp-agent.env  # optional external env file
ExecStart=/usr/bin/python3 /home/USER/runners-hub/_smtp-agent/main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Operational checks:
- Health: logs show polling activity every `POLL_INTERVAL`.
- Manual test: insert a test doc in `/mail`.

### 11a) Web UI Operations (Planned)
- Default bind: `127.0.0.1` only; default port: `8787` (configurable via `ADMIN_PORT`).
- Start/stop: Web UI runs in-process, started automatically with the agent; graceful shutdown with the agent.
- Authentication: optional Basic Auth via `ADMIN_USER`/`ADMIN_PASS` envs; disabled by default for local-only use.
- Logs: HTTP access logs at DEBUG level; app actions at INFO.

## 12) Testing Plan
- Unit tests (future):
  - `smtp_sender` with SMTP mock.
  - `firestore_listener` logic with in-memory/mocked Firestore SDK.
- Integration test (manual): create a doc and verify email receipt + Firestore update.

## 13) Milestones
- M1: MVP working locally (done).
- M2: Admin GUI foundation
  - M2.1: Embed lightweight web server (FastAPI/Flask), bind to localhost:8787.
  - M2.2: Settings endpoints + persistence (runtime overrides + JSON file).
  - M2.3: Status dashboard (counters, last poll/send, recent errors, trigger poll/test email).
  - M2.4: Optional Basic Auth.
- M3: Add better retries with exponential backoff (+ jitter) and rate limiting knobs.
- M4: Handle `to` as array; add CC/BCC (and reply_to) if upstream adds fields.
- M5: Optional: switch from polling to Firestore onSnapshot listener.
- M6: Packaging/scripts for systemd and log rotation.

## 14) Risks & Mitigations
- SMTP rate limits → add rate limiting + backoff.
- Duplicate sends → idempotency checks (delivery.success) and optional `processing` flag.
- Service account leakage → keep locally, restrict perms, avoid committing.

## 15) Open Questions
- Should we support `cc`, `bcc`, `reply_to` if upstream provides them?
- Any need to support attachments (`message.attachments`)?
- Preferred run mode for production (systemd, Docker)?
- Do we want Firestore onSnapshot instead of polling now or later?
