import { useState, type FormEvent } from 'react';
import { signIn, signUp } from '../../firebase/auth';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';

export function LoginPage() {
  const [mode, setMode] = useState<'SIGN_IN' | 'SIGN_UP'>('SIGN_IN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'SIGN_IN') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? friendlyAuthError(err.message) : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">HRMS</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'SIGN_IN' ? 'Sign in to access your synced data.' : 'Create your account to get started.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'SIGN_IN' ? 'current-password' : 'new-password'}
            hint={mode === 'SIGN_UP' ? 'At least 6 characters.' : undefined}
          />

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'SIGN_IN' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'SIGN_IN' ? 'SIGN_UP' : 'SIGN_IN');
            setError(null);
          }}
          className="mt-4 text-sm text-slate-500 hover:underline"
        >
          {mode === 'SIGN_IN' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}

function friendlyAuthError(message: string): string {
  if (message.includes('auth/invalid-credential') || message.includes('auth/wrong-password')) {
    return 'Incorrect email or password.';
  }
  if (message.includes('auth/user-not-found')) {
    return 'No account with that email. Try creating one.';
  }
  if (message.includes('auth/email-already-in-use')) {
    return 'An account with that email already exists. Try signing in instead.';
  }
  if (message.includes('auth/weak-password')) {
    return 'Password must be at least 6 characters.';
  }
  if (message.includes('auth/invalid-email')) {
    return 'That email address looks invalid.';
  }
  return message;
}
