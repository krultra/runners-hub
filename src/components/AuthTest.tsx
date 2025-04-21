import React, { useState, useEffect } from 'react';
import { getAuth, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { Paper, Typography, Button, Box } from '@mui/material';
import EmailVerificationGuide from './auth/EmailVerificationGuide';

// Dynamically determine the correct URL based on environment
const getActionCodeSettings = () => {
  // In production, use the custom domain if available
  const isCustomDomain = window.location.hostname === 'runnershub.krultra.no';
  const baseUrl = isCustomDomain 
    ? 'https://runnershub.krultra.no' 
    : window.location.origin;
    
  return {
    url: baseUrl + '/auth',
    handleCodeInApp: true,
  };
};

const actionCodeSettings = getActionCodeSettings();

const AuthTest: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [user, setUser] = useState<any>(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setStatus('Signed in as ' + u.email);
      // If user is signed in and there's a returnTo param, redirect
      if (u) {
        const params = new URLSearchParams(location.search);
        const returnTo = params.get('returnTo');
        if (returnTo) {
          navigate(returnTo, { replace: true });
        }
      }
    });
    return unsub;
  }, [navigate, location.search]);

  // Handle sign-in link in URL
  useEffect(() => {
    const auth = getAuth();
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let emailForSignIn = window.localStorage.getItem('emailForSignIn') || '';
      if (!emailForSignIn) {
        emailForSignIn = window.prompt('Please provide your email for confirmation') || '';
      }
      signInWithEmailLink(auth, emailForSignIn, window.location.href)
        .then((result) => {
          setStatus('Successfully signed in as ' + result.user.email);
          setUser(result.user);
          window.localStorage.removeItem('emailForSignIn');
          
          // Check for stored return path in localStorage
          const returnPath = localStorage.getItem('authReturnPath');
          if (returnPath) {
            // Clear the stored path
            localStorage.removeItem('authReturnPath');
            // Navigate back to the stored path
            navigate(returnPath, { replace: true });
          } else {
            // Fallback to URL parameter if available
            const params = new URLSearchParams(window.location.search);
            const returnTo = params.get('returnTo');
            if (returnTo) {
              navigate(returnTo, { replace: true });
            } else {
              // Default to home page if no return path is specified
              navigate('/', { replace: true });
            }
          }
        })
        .catch((error) => {
          setStatus('Error signing in: ' + error.message);
        });
    }
  }, [navigate]);

  const handleEmailSent = () => {
    setStatus('Verification email sent! Check your inbox.');
  };

  const handleLogout = () => {
    const auth = getAuth();
    auth.signOut();
    setStatus('Logged out');
    setUser(null);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-surface-border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        borderRadius: 2,
        p: 3,
        maxWidth: 420,
        mx: 'auto',
        my: 5,
      }}
    >
      <Typography variant="h4" gutterBottom align="center" sx={{ fontWeight: 700 }}>
        Log in
      </Typography>
      
      {user ? (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Signed in as: <strong>{user.email}</strong>
          </Typography>
          
          <Button
            variant="contained"
            color="inherit"
            onClick={handleLogout}
            sx={{
              mb: 2,
              backgroundColor: 'black',
              color: 'white',
              border: '2px solid var(--color-surface-border)',
              fontWeight: 700,
              minWidth: 210,
              '&:hover': { backgroundColor: '#222' }
            }}
          >
            Log out
          </Button>
          
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
            You are now logged in. Redirecting you back...
          </Typography>
        </Box>
      ) : (
        <>
          <Typography variant="body1" paragraph align="center" sx={{ fontWeight: 500 }}>
            Enter your email to receive a secure sign-in link.
          </Typography>
          
          <EmailVerificationGuide 
            email={email} 
            setEmail={setEmail} 
            onEmailSent={handleEmailSent}
          />
          
          {status && (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
              {status}
            </Typography>
          )}
        </>
      )}
    </Paper>
  );
};

export default AuthTest;
