"""
SMTP Sender module for sending emails via SMTP
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

import config

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename=config.LOG_FILE if config.LOG_FILE else None
)
logger = logging.getLogger('smtp_sender')

class SMTPSender:
    """
    Handles sending emails via SMTP
    """
    def __init__(self):
        self.smtp_server = config.SMTP_SERVER
        self.smtp_port = config.SMTP_PORT
        self.username = config.SMTP_USERNAME
        self.password = config.SMTP_PASSWORD
        self.use_tls = config.SMTP_USE_TLS
        self.from_email = config.SMTP_FROM_EMAIL
        self.from_name = config.SMTP_FROM_NAME
        
    def send_email(self, to_email, subject, html_content):
        """
        Send an email using SMTP
        
        Args:
            to_email (str): Recipient email address
            subject (str): Email subject
            html_content (str): HTML content of the email
            
        Returns:
            dict: Result of the email sending operation
                {
                    'success': bool,
                    'timestamp': datetime,
                    'error': str or None
                }
        """
        try:
            # Create message container
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            # Attach HTML content
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            # Connect to SMTP server
            logger.info(f"Connecting to SMTP server {self.smtp_server}:{self.smtp_port}")
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                if self.use_tls:
                    server.starttls()
                
                # Login if credentials are provided
                if self.username and self.password:
                    logger.debug(f"Logging in as {self.username}")
                    server.login(self.username, self.password)
                
                # Send email
                logger.info(f"Sending email to {to_email} with subject: {subject}")
                server.sendmail(self.from_email, to_email, msg.as_string())
                
            logger.info(f"Email sent successfully to {to_email}")
            return {
                'success': True,
                'timestamp': datetime.now(),
                'error': None
            }
            
        except Exception as e:
            error_msg = f"Failed to send email: {str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'timestamp': datetime.now(),
                'error': error_msg
            }
