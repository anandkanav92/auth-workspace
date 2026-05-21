export { initAuth } from './firebase';
export { signInWithGoogle, signOut, getCurrentUser, onAuthChange } from './auth';
export { useAuth } from './hooks';
export { SignInButton, SignOutButton, UserAvatar, AuthGuard } from './components';
export type { AuthConfig, AuthUser } from './types';
