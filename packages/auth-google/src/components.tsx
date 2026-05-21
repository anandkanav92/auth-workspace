import React from 'react';
import { signInWithGoogle, signOut } from './auth';
import { useAuth } from './hooks';

interface ButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function SignInButton({ className, children }: ButtonProps) {
  const [loading, setLoading] = React.useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleSignIn} disabled={loading} className={className}>
      {children ?? (loading ? 'Signing in...' : 'Sign in with Google')}
    </button>
  );
}

export function SignOutButton({ className, children }: ButtonProps) {
  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <button onClick={handleSignOut} className={className}>
      {children ?? 'Sign out'}
    </button>
  );
}

export function UserAvatar({ className }: { className?: string }) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {user.photoURL && (
        <img
          src={user.photoURL}
          alt={user.displayName ?? 'User'}
          width={32}
          height={32}
          style={{ borderRadius: '50%' }}
        />
      )}
      <span>{user.displayName ?? user.email}</span>
    </div>
  );
}

export function AuthGuard({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <>{fallback ?? null}</>;
  return <>{children}</>;
}
