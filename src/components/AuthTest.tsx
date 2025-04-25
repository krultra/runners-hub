import React, { useState, useEffect } from 'react';
import { getAuth, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { Paper, Typography, Button, Box } from '@mui/material';
import EmailVerificationGuide from './auth/EmailVerificationGuide';

// Removed unused action code settings logic

// Helper to robustly decode returnTo
function robustDecodeReturnTo(raw: string | null): string | null {
  let value = raw;
  let count = 0;
  while (value && value.startsWith('%') && count < 3) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
      count++;
    } catch {
      break;
    }
  }
  return value;
}

const AuthTest: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string>('');
  // Removed unused verification state
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
          // Prefer ?returnTo= param in URL
          const params = new URLSearchParams(window.location.search);
          let returnTo = params.get('returnTo');
          returnTo = robustDecodeReturnTo(returnTo);
          if (returnTo) {
            navigate(returnTo, { replace: true });
          } else {
            // Otherwise fallback to stored path
            const returnPath = localStorage.getItem('authReturnPath');
            if (returnPath) {
              localStorage.removeItem('authReturnPath');
              navigate(returnPath, { replace: true });
            } else {
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
        borderRadius: 2,
        p: { xs: 2, sm: 3 },
        maxWidth: 600,
        width: '100%',
        mx: 'auto',
        my: 5,
      }}
    >
      <Typography variant="h4" gutterBottom align="center" sx={{ fontWeight: 700 }}>
        Log in
      </Typography>
      {/* Show message if redirected here for login-required route */}
      {(() => {
        const params = new URLSearchParams(location.search);
        const returnTo = params.get('returnTo');
        if (returnTo) {
          return (
            <Typography variant="body1" align="center" sx={{ mb: 2 }}>
              You need to log in to be able to continue
            </Typography>
          );
        }
        return null;
      })()}
      
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
