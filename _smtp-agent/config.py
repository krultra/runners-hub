"""
Configuration settings for the SMTP Agent
"""
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

# Load environment variables from .env file
load_dotenv()

# Firebase configuration
# Prefer GOOGLE_APPLICATION_CREDENTIALS if present; fallback to FIREBASE_SERVICE_ACCOUNT_PATH, then local file
_GAC = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
FIREBASE_SERVICE_ACCOUNT_PATH = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH', _GAC or 'serviceAccountKey.json')
FIREBASE_DATABASE_URL = os.getenv('FIREBASE_DATABASE_URL', 'https://your-project-id.firebaseio.com')

# Firestore configuration
MAIL_COLLECTION = 'mail'

# SMTP configuration
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.domeneshop.no')
SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
SMTP_USERNAME = os.getenv('SMTP_USERNAME', 'post@krultra.no')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
SMTP_USE_TLS = os.getenv('SMTP_USE_TLS', 'True').lower() == 'true'
SMTP_FROM_EMAIL = os.getenv('SMTP_FROM_EMAIL', 'post@krultra.no')
SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'RunnersHub')

# Logging configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
MAX_RETRY_COUNT = int(os.getenv("MAX_RETRY_COUNT", "5"))
LOG_FILE = os.getenv('LOG_FILE', 'smtp_agent.log')

# Application configuration
POLL_INTERVAL = int(os.getenv('POLL_INTERVAL', 60))  # seconds

# Process cutoff configuration (ISO 8601, e.g., 2025-08-07T00:00:00Z or YYYY-MM-DD)
PROCESS_FROM_AFTER = os.getenv('PROCESS_FROM_AFTER', '').strip()

def _parse_cutoff(value: str):
    if not value:
        return None
    v = value.strip()
    try:
        # Support 'YYYY-MM-DD'
        if len(v) == 10 and v[4] == '-' and v[7] == '-':
            dt = datetime.strptime(v, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            return dt
        # Normalize trailing 'Z' to +00:00 for fromisoformat
        if v.endswith('Z'):
            v = v[:-1] + '+00:00'
        dt = datetime.fromisoformat(v)
        # Ensure timezone-aware (default to UTC)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None

PROCESS_FROM_AFTER_DT = _parse_cutoff(PROCESS_FROM_AFTER)

# Admin UI (planned) basic settings
ADMIN_PORT = int(os.getenv('ADMIN_PORT', 8787))
ADMIN_USER = os.getenv('ADMIN_USER', '')
ADMIN_PASS = os.getenv('ADMIN_PASS', '')
