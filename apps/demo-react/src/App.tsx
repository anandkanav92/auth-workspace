import { useEffect } from 'react';
import { initAuth, useAuth, SignInButton, SignOutButton, UserAvatar, AuthGuard } from '@myorg/auth-google';

initAuth({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

function Dashboard() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>
      <p>You are signed in.</p>
      <UserAvatar />
      <br />
      <SignOutButton />
    </div>
  );
}

function LoginPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Vite + React Demo</h1>
      <p>Sign in to continue</p>
      <SignInButton />
    </div>
  );
}

function App() {
  const { loading } = useAuth();
  if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>;

  return (
    <AuthGuard fallback={<LoginPage />}>
      <Dashboard />
    </AuthGuard>
  );
}

export default App;
