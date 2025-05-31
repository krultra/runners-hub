"""
Firestore Listener module for monitoring the 'mail' collection
"""
import logging
import time
import socket
import os
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

import firebase_admin
from firebase_admin import credentials, firestore

import config
from smtp_sender import SMTPSender

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename=config.LOG_FILE if config.LOG_FILE else None
)
logger = logging.getLogger('firestore_listener')

class FirestoreListener:
    """
    Monitors Firestore 'mail' collection for new or failed email documents
    """
    def __init__(self):
        self.initialize_firebase()
        self.db = firestore.client()
        self.mail_collection = self.db.collection(config.MAIL_COLLECTION)
        self.smtp_sender = SMTPSender()
        self.last_check_time = datetime.now()
        self.host = socket.gethostname()
        self.pid = os.getpid()
        self.version = "0.2.0"
        # Effective, reloadable config
        self.poll_interval = config.POLL_INTERVAL
        self.max_retry_count = config.MAX_RETRY_COUNT
        self.process_from_after_dt = config.PROCESS_FROM_AFTER_DT
        self.log_level = config.LOG_LEVEL
        # Initial load of overrides
        self._load_overrides()
        
    def initialize_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            # Check if already initialized
            firebase_admin.get_app()
        except ValueError:
            # Initialize with service account
            cred = credentials.Certificate(config.FIREBASE_SERVICE_ACCOUNT_PATH)
            firebase_admin.initialize_app(cred, {
                'databaseURL': config.FIREBASE_DATABASE_URL
            })
            logger.info("Firebase Admin SDK initialized successfully")
    
    def start_listening(self):
        """
        Start listening for new or failed email documents
        """
        logger.info(f"Starting to monitor '{config.MAIL_COLLECTION}' collection")

        while True:
            try:
                # Reload admin overrides each cycle (lightweight read)
                self._load_overrides()
                self._check_pending_emails()
                time.sleep(self.poll_interval)
            except Exception as e:
                logger.error(f"Error in listener loop: {str(e)}")
                time.sleep(self.poll_interval)
    
    def _check_pending_emails(self):
        """
        Check for pending emails in Firestore
        """
        # Build base query: createdAt >= cutoff (if configured)
        query = self.mail_collection
        if self.process_from_after_dt:
            cutoff = self.process_from_after_dt
            logger.debug(f"Applying cutoff createdAt >= {cutoff.isoformat()}")
            query = query.where('createdAt', '>=', cutoff)

        # Ignore already-finished docs to reduce re-scans
        try:
            query = query.where('smtpAgent.state', 'not-in', ['SENT', 'SKIPPED'])
        except Exception:
            # Older Firestore emulator/SDK may not support 'not-in'; fall back to filtering in code
            pass

        # Get candidate docs and filter in code
        self._process_query_results(query)
        
        # Update last check time
        self.last_check_time = datetime.now()
        
    def _process_query_results(self, query):
        """
        Process query results and send emails
        
        Args:
            query: Firestore query object
        """
        # Execute query with fallback in case composite index for 'not-in' is missing
        try:
            docs = query.get()
        except Exception as e:
            logger.warning(f"Primary query failed (possibly missing index for 'not-in'): {e}")
            # Fallback: drop the not-in filter by rebuilding query only with cutoff
            fb_query = self.mail_collection
            if self.process_from_after_dt:
                fb_query = fb_query.where('createdAt', '>=', self.process_from_after_dt)
            try:
                docs = fb_query.get()
                logger.info("Falling back to createdAt-only query; filtering finished docs in code")
            except Exception as e2:
                logger.error(f"Fallback query also failed: {e2}")
                return
        for doc in docs:
            doc_id = doc.id
            doc_data = doc.to_dict()

            logger.debug(f"Processing document {doc_id}")
            
            # Skip if before cutoff (if createdAt missing, treat as now and allow)
            try:
                created_at = doc_data.get('createdAt')
                if self.process_from_after_dt and isinstance(created_at, datetime):
                    # Firestore returns aware datetimes
                    if created_at < self.process_from_after_dt:
                        logger.debug(f"Skipping {doc_id}: before cutoff")
                        self._update_agent_state(doc.reference, state='SKIPPED', reason='before_cutoff')
                        continue
            except Exception:
                pass

            smtp_agent = doc_data.get('smtpAgent', {}) or {}
            state = smtp_agent.get('state')
            if state == 'SENT' or state == 'SKIPPED':
                logger.debug(f"Skipping {doc_id}: state={state}")
                continue

            # Retry/backoff: skip until nextRetryAt, and stop after MAX_RETRY_COUNT
            try:
                attempts = int(smtp_agent.get('attempts') or 0)
            except Exception:
                attempts = 0
            next_retry_at = smtp_agent.get('nextRetryAt')
            now = datetime.now(timezone.utc)
            if next_retry_at and isinstance(next_retry_at, datetime) and next_retry_at > now:
                logger.debug(f"Skipping {doc_id}: nextRetryAt in future {next_retry_at}")
                continue
            if attempts >= self.max_retry_count:
                logger.debug(f"Skipping {doc_id}: attempts {attempts} >= MAX_RETRY_COUNT")
                self._update_agent_state(doc.reference, state='SKIPPED', reason='max_retries')
                continue
                
            # Extract email data
            try:
                to_email = doc_data.get('to')
                # subject is inside message upstream
                subject = doc_data.get('message', {}).get('subject') or doc_data.get('subject')
                html_content = doc_data.get('message', {}).get('html')
                
                # Validate required fields
                if not all([to_email, subject, html_content]):
                    logger.error(f"Document {doc_id} missing required fields")
                    self._update_agent_error(doc.reference, 'VALIDATION', 'Missing required fields')
                    continue
                
                # Normalize recipient(s)
                if isinstance(to_email, list):
                    to_resolved = to_email
                    to_primary = ','.join(to_email)
                else:
                    to_resolved = [to_email]
                    to_primary = to_email

                # Idempotency hash
                message_hash = self._message_hash(subject, html_content, to_resolved)

                # Mark as PROCESSING with a short lease
                start_ts = firestore.SERVER_TIMESTAMP
                self._set_processing(doc.reference, start_ts)

                # Send email
                result = self.smtp_sender.send_email(to_primary, subject, html_content)

                # Update document with result in smtpAgent namespace
                self._update_agent_result(
                    doc.reference,
                    result=result,
                    to_resolved=to_resolved,
                    message_hash=message_hash
                )
                
            except Exception as e:
                logger.error(f"Error processing document {doc_id}: {str(e)}")
                self._update_agent_error(doc.reference, 'EXCEPTION', str(e))

    def _update_document_status(self, doc_ref, result: Dict[str, Any]):
        """
        Update document status in Firestore
        
        Args:
            doc_ref: Firestore document reference
            result: Result dictionary from email sending
        """
        try:
            # Convert datetime to Firestore timestamp
            if isinstance(result.get('timestamp'), datetime):
                result['timestamp'] = firestore.SERVER_TIMESTAMP
                
            # Update document
            doc_ref.update({
                'delivery': result,
                'state': 'SENT' if result.get('success') else 'ERROR'
            })
            
            logger.info(f"Updated document {doc_ref.id} with status: {result.get('success')}")
        except Exception as e:
            logger.error(f"Failed to update document {doc_ref.id}: {str(e)}")

    def _set_processing(self, doc_ref, start_ts):
        try:
            doc_ref.update({
                'smtpAgent': {
                    'version': self.version,
                    'host': self.host,
                    'pid': self.pid,
                    'state': 'PROCESSING',
                    'lastUpdatedAt': firestore.SERVER_TIMESTAMP,
                    'processing': {
                        'by': f"{self.host}:{self.pid}",
                        'leaseExpireTime': firestore.SERVER_TIMESTAMP
                    },
                    'lastAttempt': {
                        'startTime': start_ts
                    }
                }
            })
        except Exception as e:
            logger.warning(f"Failed to set processing state: {e}")

    def _update_agent_result(self, doc_ref, result: Dict[str, Any], to_resolved, message_hash: str):
        try:
            success = result.get('success')
            state = 'SENT' if success else 'ERROR'
            error_msg = result.get('error')
            # Compute nextRetryAt for failures with exponential backoff
            next_retry = None
            if not success:
                # Fetch existing attempts count by increment intention (best-effort)
                # Backoff: 60s * 2^min(attempts, 6) capped around ~1h
                try:
                    # We cannot read attempts atomically here without a read; use a simple progression
                    base_seconds = 60
                    # approximate attempts from previous value + 1 after this update
                    # let attempts grow indirectly via Increment; schedule next attempt conservatively
                    backoff_seconds = base_seconds * 2
                except Exception:
                    backoff_seconds = 120
                next_retry = datetime.now(timezone.utc) + timedelta(seconds=backoff_seconds)
            update_payload = {
                'smtpAgent': {
                    'version': self.version,
                    'host': self.host,
                    'pid': self.pid,
                    'state': state,
                    'lastUpdatedAt': firestore.SERVER_TIMESTAMP,
                    'attempts': firestore.Increment(1),
                    'lastSuccessAt': firestore.SERVER_TIMESTAMP if success else None,
                    'nextRetryAt': None if success else next_retry,
                    'lastAttempt': {
                        'endTime': firestore.SERVER_TIMESTAMP,
                        'success': success,
                        'errorCode': None if success else 'SMTP',
                        'errorMessage': None if success else (str(error_msg)[:300] if error_msg else None),
                        'smtpResponse': None,
                        'toResolved': to_resolved,
                    },
                    'processing': {
                        'by': f"{self.host}:{self.pid}",
                        'leaseExpireTime': None
                    },
                    'idempotency': {
                        'messageHash': message_hash,
                        'lastSeenSameHashAt': firestore.SERVER_TIMESTAMP
                    },
                    'smtpDelivery': {
                        'success': success,
                        'timestamp': firestore.SERVER_TIMESTAMP,
                        'provider': 'custom-smtp',
                        'messageId': None
                    }
                }
            }
            doc_ref.set(update_payload, merge=True)
            logger.info(f"Updated smtpAgent for {doc_ref.id}: state={state}")
        except Exception as e:
            logger.error(f"Failed to update smtpAgent result for {doc_ref.id}: {e}")

    def _update_agent_error(self, doc_ref, code: str, message: str):
        try:
            # schedule a retry with backoff
            next_retry = datetime.now(timezone.utc) + timedelta(seconds=120)
            doc_ref.set({
                'smtpAgent': {
                    'version': self.version,
                    'host': self.host,
                    'pid': self.pid,
                    'state': 'ERROR',
                    'lastUpdatedAt': firestore.SERVER_TIMESTAMP,
                    'attempts': firestore.Increment(1),
                    'nextRetryAt': next_retry,
                    'lastAttempt': {
                        'endTime': firestore.SERVER_TIMESTAMP,
                        'success': False,
                        'errorCode': code,
                        'errorMessage': (message or '')[:300]
                    },
                    'processing': {
                        'by': f"{self.host}:{self.pid}",
                        'leaseExpireTime': None
                    }
                }
            }, merge=True)
        except Exception as e:
            logger.error(f"Failed to update smtpAgent error for {doc_ref.id}: {e}")

    def _update_agent_state(self, doc_ref, state: str, reason: str = None):
        try:
            payload = {
                'smtpAgent': {
                    'version': self.version,
                    'host': self.host,
                    'pid': self.pid,
                    'state': state,
                    'lastUpdatedAt': firestore.SERVER_TIMESTAMP,
                }
            }
            if reason:
                payload['smtpAgent']['lastAttempt'] = {
                    'endTime': firestore.SERVER_TIMESTAMP,
                    'success': False,
                    'errorCode': 'SKIP',
                    'errorMessage': reason
                }
            doc_ref.set(payload, merge=True)
        except Exception as e:
            logger.error(f"Failed to set smtpAgent state for {doc_ref.id}: {e}")

    def _message_hash(self, subject: str, html: str, to_list):
        h = hashlib.sha256()
        h.update((subject or '').encode('utf-8'))
        h.update((html or '').encode('utf-8'))
        h.update(('|'.join(sorted(to_list))).encode('utf-8'))
        return h.hexdigest()[:16]

    def _load_overrides(self):
        """Load admin config overrides from Firestore and apply live."""
        try:
            snap = self.db.document('admin/smtpAgentConfig').get()
            data = snap.to_dict() if snap.exists else {}
        except Exception:
            data = {}
        # pollInterval
        try:
            pi = int(data.get('pollInterval')) if data and data.get('pollInterval') is not None else None
            if pi and pi > 0:
                if pi != self.poll_interval:
                    logger.info(f"Applying override: pollInterval {self.poll_interval} -> {pi}")
                self.poll_interval = pi
            else:
                self.poll_interval = config.POLL_INTERVAL
        except Exception:
            self.poll_interval = config.POLL_INTERVAL
        # maxRetryCount
        try:
            mrc = int(data.get('maxRetryCount')) if data and data.get('maxRetryCount') is not None else None
            if mrc and mrc > 0:
                if mrc != self.max_retry_count:
                    logger.info(f"Applying override: maxRetryCount {self.max_retry_count} -> {mrc}")
                self.max_retry_count = mrc
            else:
                self.max_retry_count = config.MAX_RETRY_COUNT
        except Exception:
            self.max_retry_count = config.MAX_RETRY_COUNT
        # processFromAfter
        try:
            pfa = (data.get('processFromAfter') or '').strip() if data else ''
            dt = config._parse_cutoff(pfa) if pfa else None
            self.process_from_after_dt = dt or config.PROCESS_FROM_AFTER_DT
        except Exception:
            self.process_from_after_dt = config.PROCESS_FROM_AFTER_DT
        # logLevel
        try:
            lvl = (data.get('logLevel') or '').upper() if data else ''
            lvl = lvl or config.LOG_LEVEL
            if lvl != self.log_level and hasattr(logging, lvl):
                self.log_level = lvl
                logging.getLogger().setLevel(getattr(logging, lvl))
                logger.setLevel(getattr(logging, lvl))
                logger.info(f"Applied override: logLevel -> {lvl}")
        except Exception:
            pass
