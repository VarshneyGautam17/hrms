import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { signIn, signUp } from '../../firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

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
        toast.success('Account created');
      }
    } catch (err) {
      const message = err instanceof Error ? friendlyAuthError(err.message) : 'Something went wrong.';
      setError(message);
      toast.error(mode === 'SIGN_IN' ? 'Sign in failed' : 'Could not create account', { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 via-background to-sky-100 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="p-6 sm:p-8">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-base font-bold text-white shadow-md">
            DE
          </span>
          <h1 className="mt-4 text-center text-lg font-semibold">Deepak Electricals</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {mode === 'SIGN_IN' ? 'Sign in to access your synced data.' : 'Create your account to get started.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'SIGN_IN' ? 'current-password' : 'new-password'}
              />
              {mode === 'SIGN_UP' && <span className="text-xs text-muted-foreground">At least 6 characters.</span>}
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
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
            className="mt-4 text-sm text-muted-foreground hover:underline"
          >
            {mode === 'SIGN_IN' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
          </button>
        </CardContent>
      </Card>
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
