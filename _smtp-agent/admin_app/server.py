import os
import threading
from functools import wraps

from flask import Flask, jsonify, request, render_template, redirect, url_for
from flask_httpauth import HTTPBasicAuth

import config
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import firebase_admin
    from firebase_admin import firestore
except Exception:
    firebase_admin = None
    firestore = None

_auth = HTTPBasicAuth()

ADMIN_USER = config.ADMIN_USER or os.environ.get("ADMIN_USER", "")
ADMIN_PASS = config.ADMIN_PASS or os.environ.get("ADMIN_PASS", "")


def _check_creds(username, password):
    return username == ADMIN_USER and password == ADMIN_PASS and bool(username)


@_auth.verify_password
def verify_password(username, password):
    if _check_creds(username, password):
        return username
    return None


def create_app():
    app = Flask(__name__)

    def get_version() -> str:
        """Read version from repository VERSION file.
        Attempts repo root, then _smtp-agent fallback. Returns '0.0.0' if missing.
        """
        try:
            here = Path(__file__).resolve()
            # repo root is three levels up from this file
            repo_root = here.parent.parent.parent
            version_file = repo_root / "VERSION"
            if not version_file.exists():
                version_file = (here.parent.parent / "VERSION")
            if version_file.exists():
                v = version_file.read_text(encoding="utf-8").strip()
                if v:
                    return v
        except Exception:
            pass
        return "0.0.0"

    @app.context_processor
    def inject_version():
        return {"app_version": get_version(), "owner_name": "KrUltra"}

    def require_auth(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # No auth if creds not configured
            if not ADMIN_USER or not ADMIN_PASS:
                return f(*args, **kwargs)
            return _auth.login_required(f)(*args, **kwargs)
        return wrapper

    @app.get("/health")
    def health():
        # Basic health info with effective config
        effective = {
            "pollInterval": config.POLL_INTERVAL,
            "logLevel": config.LOG_LEVEL,
        }
        try:
            if firestore is not None:
                db = firestore.client()
                merged = {
                    "pollInterval": config.POLL_INTERVAL,
                    "logLevel": config.LOG_LEVEL,
                }
                try:
                    merged = _read_admin_config(db)
                except Exception:
                    pass
                effective["pollInterval"] = merged.get("pollInterval", config.POLL_INTERVAL)
                effective["logLevel"] = merged.get("logLevel", config.LOG_LEVEL)
        except Exception:
            pass
        status = {
            "status": "ok",
            "version": get_version(),
            "adminPort": config.ADMIN_PORT,
            "pollInterval": effective["pollInterval"],
            "logLevel": effective["logLevel"],
        }
        # Firestore check
        fs_ok = False
        fs_error = None
        try:
            if firebase_admin is not None:
                try:
                    firebase_admin.get_app()
                except ValueError:
                    # Not initialized yet; listener will do it. Attempt lightweight client anyway.
                    pass
                if firestore is not None:
                    db = firestore.client()
                    # read a lightweight doc; existence not important
                    db.collection("_smtpAgentTests").document("_health").get()
                    fs_ok = True
        except Exception as e:
            fs_error = str(e)
        status["firestore"] = {"ok": fs_ok, "error": fs_error}
        return jsonify(status)

    def _read_status_reset(db):
        try:
            doc = db.collection("admin").document("smtpAgentStatus").get()
            if doc.exists:
                data = doc.to_dict() or {}
                return data.get("statusResetAt")
        except Exception:
            pass
        return None

    def _collect_stats():
        stats = {
            "h1": {"sent": 0, "error": 0},
            "h24": {"sent": 0, "error": 0},
            "lastProcessedAt": None,
            "status": {"indicator": "green", "since": None, "errorsSinceReset": 0},
            "serverTime": None,
        }
        now = datetime.now(timezone.utc)
        stats["serverTime"] = now.isoformat()
        if firestore is None:
            return stats
        try:
            db = firestore.client()
            reset_at = _read_status_reset(db)
            t1 = now - timedelta(hours=1)
            t24 = now - timedelta(hours=24)
            # Query last 24h processed docs
            q24 = (
                db.collection(config.MAIL_COLLECTION)
                .where("smtpAgent.lastUpdatedAt", ">=", t24)
            )
            docs = q24.stream()
            last_ts = None
            errors_since_reset = 0
            for d in docs:
                data = d.to_dict() or {}
                sa = data.get("smtpAgent", {}) or {}
                st = (sa.get("state") or "").upper()
                ts = sa.get("lastUpdatedAt")
                if ts and (last_ts is None or ts > last_ts):
                    last_ts = ts
                if st == "SENT":
                    stats["h24"]["sent"] += 1
                elif st == "ERROR":
                    stats["h24"]["error"] += 1
                # track 1h inside same loop
                if ts and ts >= t1:
                    if st == "SENT":
                        stats["h1"]["sent"] += 1
                    elif st == "ERROR":
                        stats["h1"]["error"] += 1
                # errors since reset
                if reset_at and ts and ts >= reset_at and st == "ERROR":
                    errors_since_reset += 1
            stats["lastProcessedAt"] = last_ts
            # If admin has never reset status, use 24h window as baseline
            if reset_at is None:
                stats["status"]["since"] = t24.isoformat()
                stats["status"]["errorsSinceReset"] = stats["h24"]["error"]
                stats["status"]["indicator"] = "red" if stats["h24"]["error"] > 0 else "green"
            else:
                stats["status"]["since"] = reset_at.isoformat()
                stats["status"]["errorsSinceReset"] = errors_since_reset
                stats["status"]["indicator"] = "red" if errors_since_reset > 0 else "green"
        except Exception:
            pass
        return stats

    @app.get("/")
    @require_auth
    def index():
        stats = _collect_stats()
        # Read current effective config from Firestore overrides if available
        if firestore is not None:
            try:
                db = firestore.client()
                merged = _read_admin_config(db)
                # also allow dashboard refresh interval override
                refresh_sec = merged.get("dashboardRefreshSec")
            except Exception:
                merged = {
                    "pollInterval": config.POLL_INTERVAL,
                    "processFromAfter": config.PROCESS_FROM_AFTER or "",
                    "maxRetryCount": config.MAX_RETRY_COUNT,
                    "logLevel": config.LOG_LEVEL,
                    "dashboardRefreshSec": None,
                }
        else:
            merged = {
                "pollInterval": config.POLL_INTERVAL,
                "processFromAfter": config.PROCESS_FROM_AFTER or "",
                "maxRetryCount": config.MAX_RETRY_COUNT,
                "logLevel": config.LOG_LEVEL,
                "dashboardRefreshSec": None,
            }
        return render_template(
            "index.html",
            cfg={
                "mailCollection": config.MAIL_COLLECTION,
                "pollInterval": merged.get("pollInterval"),
                "processFromAfter": merged.get("processFromAfter"),
                "maxRetryCount": merged.get("maxRetryCount"),
                "logLevel": merged.get("logLevel"),
                "dashboardRefreshSec": merged.get("dashboardRefreshSec") or 30,
            },
            stats=stats,
        )

    @app.get("/stats")
    @require_auth
    def stats_json():
        return jsonify(_collect_stats())

    @app.post("/status/reset")
    @require_auth
    def reset_status():
        if firestore is None:
            return jsonify({"ok": False, "error": "Firestore not available"}), 500
        try:
            db = firestore.client()
            db.collection("admin").document("smtpAgentStatus").set({
                "statusResetAt": datetime.now(timezone.utc)
            }, merge=True)
            return jsonify({"ok": True})
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 500

    @app.get("/emails")
    @require_auth
    def emails_list():
        """List recently processed emails filtered by state (SENT or ERROR)."""
        state = (request.args.get("state") or "").upper()
        limit = int(request.args.get("limit") or 50)
        limit = max(1, min(limit, 200))
        items = []
        error = None
        if firestore is None:
            error = "Firestore not available"
        else:
            try:
                db = firestore.client()
                col = db.collection(config.MAIL_COLLECTION)
                q = col
                if state in ("SENT", "ERROR"):
                    try:
                        q = q.where("smtpAgent.state", "==", state)
                    except Exception:
                        pass
                # order by lastUpdatedAt desc
                try:
                    q = q.order_by("smtpAgent.lastUpdatedAt", direction=firestore.Query.DESCENDING)
                except Exception:
                    pass
                try:
                    q = q.limit(limit)
                except Exception:
                    pass
                docs = q.stream()
                for d in docs:
                    data = d.to_dict() or {}
                    sa = data.get("smtpAgent", {}) or {}
                    items.append({
                        "id": d.id,
                        "to": data.get("to"),
                        "subject": data.get("message", {}).get("subject") or data.get("subject"),
                        "state": sa.get("state"),
                        "createdAt": data.get("createdAt"),
                        "lastUpdatedAt": sa.get("lastUpdatedAt"),
                        "error": (sa.get("lastAttempt", {}) or {}).get("errorMessage"),
                    })
            except Exception as e:
                error = str(e)
        return render_template("emails_list.html", items=items, state=state, limit=limit, error=error)

    @app.get("/emails/<doc_id>")
    @require_auth
    def email_detail(doc_id):
        """Show details for a specific email document."""
        doc = None
        error = None
        state = (request.args.get("state") or "").upper()
        next_id = None
        prev_id = None
        if firestore is None:
            error = "Firestore not available"
        else:
            try:
                db = firestore.client()
                ref = db.collection(config.MAIL_COLLECTION).document(doc_id)
                snap = ref.get()
                if snap.exists:
                    d = snap.to_dict() or {}
                    doc = {
                        "id": doc_id,
                        "data": d,
                        "to": d.get("to"),
                        "subject": d.get("message", {}).get("subject") or d.get("subject"),
                        "html": d.get("message", {}).get("html") or d.get("html"),
                        "from": d.get("message", {}).get("from") or d.get("from") or f"{config.SMTP_FROM_NAME} <{config.SMTP_FROM_EMAIL}>",
                        "smtpAgent": d.get("smtpAgent", {}) or {},
                        "createdAt": d.get("createdAt"),
                    }
                    # Determine neighbors within current filter
                    try:
                        col = db.collection(config.MAIL_COLLECTION)
                        q = col
                        if state in ("SENT", "ERROR"):
                            q = q.where("smtpAgent.state", "==", state)
                        q = q.order_by("smtpAgent.lastUpdatedAt", direction=firestore.Query.DESCENDING).limit(200)
                        ordered = list(q.stream())
                        ids = [s.id for s in ordered]
                        if doc_id in ids:
                            idx = ids.index(doc_id)
                            if idx > 0:
                                next_id = ids[idx - 1]  # next newer (since desc)
                            if idx < len(ids) - 1:
                                prev_id = ids[idx + 1]  # previous older
                    except Exception:
                        # If ordering not supported, skip neighbors silently
                        pass
                else:
                    error = "Document not found"
            except Exception as e:
                error = str(e)
        # JSON response for modal usage
        if (request.args.get("format") or "").lower() == "json":
            if error:
                return jsonify({"error": error}), 404
            return jsonify(doc)
        return render_template("email_detail.html", doc=doc, error=error, state=state, next_id=next_id, prev_id=prev_id)

    @app.get("/logs")
    @require_auth
    def get_logs():
        try:
            with open(config.LOG_FILE, 'r') as f:
                lines = f.readlines()[-500:]
            return "<pre>" + "".join(lines) + "</pre>"
        except Exception as e:
            return f"<pre>Failed to read log file: {e}</pre>", 500

    # Admin Config
    def _read_admin_config(db):
        try:
            snap = db.document("admin/smtpAgentConfig").get()
            if snap.exists:
                d = snap.to_dict() or {}
            else:
                d = {}
        except Exception:
            d = {}
        # Merge with defaults from code
        merged = {
            "pollInterval": d.get("pollInterval", config.POLL_INTERVAL),
            "processFromAfter": d.get("processFromAfter", config.PROCESS_FROM_AFTER),
            "maxRetryCount": d.get("maxRetryCount", config.MAX_RETRY_COUNT),
            "logLevel": d.get("logLevel", config.LOG_LEVEL),
            "dashboardRefreshSec": d.get("dashboardRefreshSec"),
        }
        return merged

    @app.get("/config")
    @require_auth
    def admin_config_view():
        if firestore is None:
            return render_template("admin_config.html", error="Firestore not available", cfg=None)
        db = firestore.client()
        cfg = _read_admin_config(db)
        return render_template("admin_config.html", cfg=cfg, error=None)

    @app.post("/config")
    @require_auth
    def admin_config_save():
        if firestore is None:
            return render_template("admin_config.html", error="Firestore not available", cfg=None), 500
        db = firestore.client()
        # Basic validation and normalization
        poll = request.form.get("pollInterval", type=int)
        mrc = request.form.get("maxRetryCount", type=int)
        pfa = (request.form.get("processFromAfter") or "").strip()
        lvl = (request.form.get("logLevel") or "").upper() or config.LOG_LEVEL
        drs = request.form.get("dashboardRefreshSec", type=int)
        if poll is None or poll <= 0:
            poll = config.POLL_INTERVAL
        if mrc is None or mrc <= 0:
            mrc = config.MAX_RETRY_COUNT
        if drs is None or drs <= 0:
            drs = None
        # Store
        try:
            db.document("admin/smtpAgentConfig").set({
                "pollInterval": poll,
                "processFromAfter": pfa,
                "maxRetryCount": mrc,
                "logLevel": lvl,
                "dashboardRefreshSec": drs,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }, merge=True)
        except Exception as e:
            cfg = _read_admin_config(db)
            return render_template("admin_config.html", cfg=cfg, error=str(e)), 500
        return redirect(url_for('admin_config_view'))

    return app


def run_admin_background():
    app = create_app()

    def _run():
        # Use Flask built-in server for dev; no reloader; threaded
        app.run(host="0.0.0.0", port=config.ADMIN_PORT, debug=False, use_reloader=False, threaded=True)

    t = threading.Thread(target=_run, name="admin-ui", daemon=True)
    t.start()
    return t
