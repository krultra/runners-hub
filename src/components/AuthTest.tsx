import React, { useState, useEffect } from 'react';
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';

const actionCodeSettings = {
  url: window.location.origin + '/auth',
  handleCodeInApp: true,
};

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
          // After sign in, redirect if returnTo param exists
          const params = new URLSearchParams(window.location.search);
          const returnTo = params.get('returnTo');
          if (returnTo) {
            navigate(returnTo, { replace: true });
          }
        })
        .catch((error) => {
          setStatus('Error signing in: ' + error.message);
        });
    }
  }, [navigate]);

  const handleSendLink = async () => {
    setIsVerifying(true);
    setStatus('Sending email...');
    try {
      const auth = getAuth();
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
      setStatus('Verification email sent! Check your inbox.');
    } catch (error: any) {
      setStatus('Error sending email: ' + error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    const auth = getAuth();
    auth.signOut();
    setStatus('Logged out');
    setUser(null);
  };

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '40px auto', border: '1px solid #ddd', borderRadius: 8 }}>
      <h2>Log in</h2>
      {user ? (
        <>
          <div style={{ marginBottom: 16 }}>Signed in as: <b>{user.email}</b></div>
          <button onClick={handleLogout}>Log out</button>
          <div style={{ marginTop: 16, color: '#1976d2', fontWeight: 500 }}>
            You are now logged in. You may return to the application and continue as a logged-in user.
          </div>
        </>
      ) : (
        <>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email"
            style={{ width: '100%', padding: 8, marginBottom: 12 }}
            disabled={isVerifying}
          />
          <button onClick={handleSendLink} disabled={!email || isVerifying} style={{ width: '100%', padding: 10 }}>
            {isVerifying ? 'Sending...' : 'Send Verification Link'}
          </button>
        </>
      )}
      <div style={{ marginTop: 18, color: '#555' }}>{status}</div>
    </div>
  );
};

export default AuthTest;
