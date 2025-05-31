# Firebase SMTP Agent

A Python application that monitors a Firestore `/mail` collection and sends emails via SMTP.

## Overview

This agent replaces the sending functionality of Firebase Trigger Email Extension. It:
- Monitors the `/mail` collection in Firestore
- Detects new or failed documents (`state: ERROR` or missing `delivery`)
- Sends the email using your domain provider's SMTP service
- Updates the document after successful delivery

## Setup

### Prerequisites

- Python 3.x
- Firebase project with Firestore
- SMTP server credentials

### Installation

1. Clone or download this repository
2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file from the template:
```bash
cp env.example .env
```

4. Edit the `.env` file with your configuration:
   - Add your Firebase service account details
   - Configure your SMTP server settings

5. Place your Firebase service account key file (`serviceAccountKey.json`) in the project directory

### Configuration

All configuration is handled through environment variables or the `.env` file:

- **Firebase Configuration**
  - `FIREBASE_SERVICE_ACCOUNT_PATH`: Path to your service account key file
  - `FIREBASE_DATABASE_URL`: Your Firebase database URL

- **SMTP Configuration**
  - `SMTP_SERVER`: SMTP server hostname
  - `SMTP_PORT`: SMTP server port (usually 587 for TLS)
  - `SMTP_USERNAME`: SMTP username/email
  - `SMTP_PASSWORD`: SMTP password
  - `SMTP_USE_TLS`: Whether to use TLS (True/False)
  - `SMTP_FROM_EMAIL`: Sender email address
  - `SMTP_FROM_NAME`: Sender name

- **Logging Configuration**
  - `LOG_LEVEL`: Logging level (INFO, DEBUG, WARNING, ERROR)
  - `LOG_FILE`: Log file path (leave empty for console only)

- **Application Configuration**
  - `POLL_INTERVAL`: How often to check for new emails (seconds)
  - `MAX_RETRY_COUNT`: Maximum number of retry attempts

## Usage

Run the agent:

```bash
python main.py
```

The agent will:
1. Connect to Firebase using your service account
2. Monitor the `/mail` collection
3. Send emails for new or failed documents
4. Update document status after sending

## Document Structure

Expected Firestore document structure:

```json
{
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "message": {
    "html": "<h1>Email Content</h1><p>Hello world!</p>"
  },
  "state": "PENDING",
  "delivery": null
}
```

After processing, the document will be updated with:

```json
{
  "delivery": {
    "success": true,
    "timestamp": "2025-08-07T16:22:24Z",
    "error": null
  },
  "state": "SENT"
}
```

## Logging

Logs are written to both the console and the configured log file (if specified).
