# SMTP Agent (Firestore → SMTP)

This agent replaces the Firebase Trigger Email Extension. It watches the Firestore `mail/` collection and sends emails via your SMTP provider. It also exposes a small admin UI for monitoring.

- Agent code lives in: `_smtp-agent/`
- Admin UI (Flask) default: `http://localhost:8787/`
- Collection watched: `mail`

## Document shape expected by the agent

When the front-end drops a mail job, it should include:

- `to` (string or array of strings)
- `subject` (top-level; also stored under `message.subject` for compat)
- `message.html`
- `smtpAgent.state: "PENDING"` (initial) — REQUIRED for the agent's query
- `smtpAgent.lastUpdatedAt: <serverTimestamp>` (set by app)
- `state: "PENDING"` (root-level legacy, optional)
- `delivery: null` (initial)

The agent updates `smtpAgent.*` fields upon processing (state, attempts, lastAttempt, timestamps, etc.).

Notes:
- The app now ensures `smtpAgent.state` is present on new mail docs (with a post-write `updateDoc` safeguard).
- A legacy root-level field `status` may be present; the agent ignores it.

## Environment and credentials

The agent can be configured via environment variables or a `.env` file (loaded by python-dotenv). In production (and in your setup), it uses a systemd user service with an external environment file:

- Unit file: `~/.config/systemd/user/smtp-agent.service`
- Environment file: `~/.config/runners-hub/smtp-agent.env`

Example environment file (do not commit real secrets):

```
# --- SMTP ---
SMTP_SERVER=smtp.domeneshop.no
SMTP_PORT=587
SMTP_USERNAME=post@krultra.no
SMTP_PASSWORD=REDACTED
SMTP_USE_TLS=True
SMTP_FROM_EMAIL=post@krultra.no
SMTP_FROM_NAME=RunnersHub

# --- Admin UI ---
ADMIN_PORT=8787
# optional basic auth for the admin UI (set both to enable)
ADMIN_USER=
ADMIN_PASS=

# --- Logging/Retry ---
LOG_LEVEL=DEBUG
MAX_RETRY_COUNT=5
LOG_FILE=/home/tkruke/runners-hub/_smtp-agent/smtp_agent.log

# --- Agent behavior ---
POLL_INTERVAL=60
PROCESS_FROM_AFTER=

# --- Firebase ---
# Preferred: one of these must point to your service account JSON
FIREBASE_SERVICE_ACCOUNT_PATH=/home/tkruke/.secrets/runners-hub/serviceAccountKey.json
# or
# GOOGLE_APPLICATION_CREDENTIALS=/home/tkruke/.secrets/runners-hub/serviceAccountKey.json
```

## systemd user service

Your user service unit is already present at `~/.config/systemd/user/smtp-agent.service` and points to:

- WorkingDirectory: `/home/tkruke/runners-hub/_smtp-agent`
- ExecStart: `/home/tkruke/runners-hub/_smtp-agent/.venv/bin/python main.py`
- EnvironmentFile: `~/.config/runners-hub/smtp-agent.env`

To reload and (re)start the service:

```bash
# Ensure user bus is available in this shell (if needed)
export XDG_RUNTIME_DIR=/run/user/$(id -u)

systemctl --user daemon-reload
systemctl --user enable smtp-agent
systemctl --user start smtp-agent
systemctl --user status smtp-agent --no-pager
journalctl --user -u smtp-agent -n 100 --no-pager
```

## Admin UI integrations

- Templates panel (`src/components/admin/TemplatesPanel.tsx`):
  - "Test" button under an active template prompts for a recipient and enqueues a test email to `mail/` with the correct fields (`to`, `subject`, `message.html`, and `smtpAgent.state='PENDING'`).
  - Handlebars helpers like `formatDate` and `formatDateTime` are registered automatically for previews and test sends.

- Registration Details dialog (`src/components/admin/RegistrationDetailsDialog.tsx`):
  - Sending an email now confirms immediately after enqueue (no waiting for the old Firebase Trigger extension).
  - The status shown in the Admin Comments list and in the Email Details popup prioritizes `smtpAgent.state`, falling back to root `status`, else `unknown`.

## Running manually (for debugging)

From `_smtp-agent/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp env.example .env
# edit .env to point to your service account and SMTP credentials
python3 main.py
```

## Admin UI endpoints

- `GET /` – dashboard
- `GET /health` – health JSON
- `GET /emails?state=SENT|ERROR` – recent items
- `GET /emails/{id}` – detail view
- `POST /status/reset` – mark baseline for error stats
- `GET/POST /config` – override agent config via Firestore admin doc
