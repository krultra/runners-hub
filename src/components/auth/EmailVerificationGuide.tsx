import React, { useState } from 'react';
import { Box, Typography, Button, Alert, Paper, CircularProgress } from '@mui/material';
import { sendSignInLinkToEmail } from 'firebase/auth';
import { auth } from '../../config/firebase';

interface EmailVerificationGuideProps {
  email: string;
  setEmail: (email: string) => void;
  onEmailSent?: () => void;
  showResendButton?: boolean;
}

const EmailVerificationGuide: React.FC<EmailVerificationGuideProps> = ({ 
  email, 
  setEmail, 
  onEmailSent,
  showResendButton = true
}) => {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');

  const handleSendVerificationLink = async () => {
    if (!email) return;
    
    setSending(true);
    setStatus('idle');
    
    try {
      // Preserve ?returnTo= param in the email link
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get('returnTo');
      let url = window.location.origin + (window.location.pathname || '/');
      if (returnTo) {
        url += `?returnTo=${encodeURIComponent(returnTo)}`;
      }
      const actionCodeSettings = {
        url,
        handleCodeInApp: true,
      };
      
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
      setStatus('sent');
      if (onEmailSent) onEmailSent();
    } catch (error) {
      console.error('Error sending verification link:', error);
      setStatus('error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Email Verification
      </Typography>
      
      {/* Email input and button at the top */}
      {showResendButton && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendVerificationLink();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}
          >
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
              style={{ 
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                width: '250px'
              }}
            />
            <Button
              variant="contained"
              color="primary"
              disabled={!email || sending}
              startIcon={sending ? <CircularProgress size={20} color="inherit" /> : null}
              type="submit"
            >
              {sending ? 'Sending...' : status === 'sent' ? 'Resend Email' : 'Send Verification Email'}
            </Button>
          </form>
        </Box>
      )}
      
      {/* Status alerts */}
      {status === 'sent' && (
        <Alert 
          icon={false}
          severity="success" 
          variant="filled" 
          sx={theme => ({ mb: 2, backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText })}
        >
          <Typography variant="body2" sx={{ color: 'inherit' }}>
            <strong>Verification link sent!</strong><br />
            Please check your inbox for an email from Firebase with the subject "Sign in to runnershub-62442 requested at [date and time]".<br />
            <em>If you don't see it, please check your spam or junk folder.</em>
          </Typography>
        </Alert>
      )}
      
      {status === 'error' && (
        <Alert severity="error" variant="filled" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Failed to send verification link.</strong><br />
            Please check your email address and try again.
          </Typography>
        </Alert>
      )}
      
      {/* Collapsible information section */}
      <Box>
        <Typography variant="body2" paragraph>
          <strong>Important tips:</strong>
        </Typography>
        
        <ul style={{ paddingLeft: '20px', marginTop: 0, marginBottom: '16px' }}>
          <li>
            <Typography variant="body2">
              Look for an email with the subject <strong>"Sign in to runnershub-62442 requested at [date and time]"</strong>
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              The link in the email will say <strong>"Sign in to runnershub-62442"</strong>
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              If you don't see it in your inbox, check your spam or junk folder
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              The link in the email is valid for 24 hours
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              It is recommended that you open the link on the same device you requested it from for the most reliable experience
            </Typography>
          </li>
        </ul>
        
        <Typography variant="body2" paragraph>
          Example email:
        </Typography>
        
        <Box sx={{ 
          border: '1px solid #ccc', 
          borderRadius: 1, 
          p: 1, 
          mb: 2,
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          <img 
            src="/images/emailLinkScreenshot.png" 
            alt="Example of verification email" 
            style={{ 
              maxWidth: '100%', 
              height: 'auto',
              display: 'block',
              margin: '0 auto'
            }} 
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default EmailVerificationGuide;
