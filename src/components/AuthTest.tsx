import React, { useState, useEffect } from 'react';
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged } from 'firebase/auth';

const actionCodeSettings = {
  // TODO: Replace with your deployed app's URL that handles sign-in completion
  url: window.location.origin + '/auth',
  handleCodeInApp: true,
};

const AuthTest: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setStatus('Signed in as ' + u.email);
    });
    return unsub;
  }, []);

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
        })
        .catch((error) => {
          setStatus('Error signing in: ' + error.message);
        });
    }
  }, []);

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
      <h2>Email Link Authentication Test</h2>
      {user ? (
        <>
          <div style={{ marginBottom: 16 }}>Signed in as: <b>{user.email}</b></div>
          <button onClick={handleLogout}>Log out</button>
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
