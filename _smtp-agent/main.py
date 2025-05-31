#!/usr/bin/env python3
"""
Firebase SMTP Agent - Main Entry Point

This script starts the Firebase SMTP Agent, which:
1. Monitors the Firestore 'mail' collection
2. Detects new or failed email documents
3. Sends emails via SMTP
4. Updates document status in Firestore
"""
import logging
import os
import sys
import signal
import time

import config
from firestore_listener import FirestoreListener
from admin_app.server import run_admin_background

# Configure logging to both file and console
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(config.LOG_FILE) if config.LOG_FILE else logging.NullHandler(),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('main')

def signal_handler(sig, frame):
    """Handle termination signals gracefully"""
    logger.info("Received termination signal. Shutting down...")
    sys.exit(0)

def main():
    """Main entry point for the SMTP agent"""
    logger.info("Starting Firebase SMTP Agent")
    
    # Log configuration
    logger.info(f"SMTP Server: {config.SMTP_SERVER}:{config.SMTP_PORT}")
    logger.info(f"Firebase Service Account: {config.FIREBASE_SERVICE_ACCOUNT_PATH}")
    logger.info(f"Monitoring collection: {config.MAIL_COLLECTION}")
    logger.info(f"Poll interval: {config.POLL_INTERVAL} seconds")
    
    # Check for service account file
    if not os.path.exists(config.FIREBASE_SERVICE_ACCOUNT_PATH):
        logger.error(f"Service account file not found: {config.FIREBASE_SERVICE_ACCOUNT_PATH}")
        logger.error("Please place your Firebase service account key file in the correct location")
        sys.exit(1)
    
    # Start Admin UI in background
    try:
        run_admin_background()
        logger.info(f"Admin UI started on port {config.ADMIN_PORT}")
    except Exception as e:
        logger.warning(f"Admin UI failed to start: {e}")

    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Initialize and start the Firestore listener
        listener = FirestoreListener()
        listener.start_listening()
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
