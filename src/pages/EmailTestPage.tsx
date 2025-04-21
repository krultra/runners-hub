import React, { useState } from 'react';
import { Container, Typography, TextField, Button, Paper, Box, Alert } from '@mui/material';
import { sendTestEmail } from '../services/testEmailService';

const EmailTestPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSendTestEmail = async () => {
    if (!email) return;
    
    setStatus('sending');
    setMessage('');
    
    try {
      await sendTestEmail(email);
      setStatus('success');
      setMessage('Test email sent successfully! Check your inbox.');
    } catch (error) {
      console.error('Error in test page:', error);
      setStatus('error');
      setMessage(`Error sending test email: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <Container maxWidth="md">
      <Paper 
  elevation={0}
  sx={{
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-surface-border)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    borderRadius: 2,
    p: 3,
    mb: 4
  }}
>
        <Typography variant="h4" gutterBottom align="center">
          Email System Test
        </Typography>
        
        <Typography variant="body1" paragraph>
          Use this page to test the email functionality of the KUTC registration system.
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <TextField
            label="Email Address"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'sending'}
            sx={{ mb: 2 }}
          />
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleSendTestEmail}
            disabled={!email || status === 'sending'}
            fullWidth
          >
            {status === 'sending' ? 'Sending...' : 'Send Test Email'}
          </Button>
        </Box>
        
        {status === 'success' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}
        
        {status === 'error' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}
        
        <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
          Troubleshooting Tips
        </Typography>
        
        <ul>
          <li>
            <Typography variant="body2">
              Check the browser console for detailed logs
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              Verify your Firebase extension configuration
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              Check your spam/junk folder if you don't see the test email
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              Ensure your Firestore security rules allow writing to the 'mail' collection
            </Typography>
          </li>
        </ul>
      </Paper>
    </Container>
  );
};

export default EmailTestPage;
