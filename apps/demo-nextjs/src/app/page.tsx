'use client';

import { AuthGuard, SignInButton, SignOutButton, UserAvatar } from '@myorg/auth-google';
import { useAuth } from '@myorg/auth-google';

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
      <h1>Next.js Demo</h1>
      <p>Sign in to continue</p>
      <SignInButton />
    </div>
  );
}

export default function Home() {
  const { loading } = useAuth();
  if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>;

  return (
    <AuthGuard fallback={<LoginPage />}>
      <Dashboard />
    </AuthGuard>
  );
}
