import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/routes';
import { useAuthUser } from './firebase/auth';
import { LoginPage } from './features/auth/LoginPage';
import { ensureDefaultSettings } from './db/repositories/settings';

export default function App() {
  const { user, loading } = useAuthUser();

  // Make sure the settings doc exists as soon as we know who's signed in, so
  // every page that live-subscribes to it never gets stuck waiting on a doc
  // that was never created.
  useEffect(() => {
    if (user) void ensureDefaultSettings();
  }, [user]);

  if (loading) return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  if (!user) return <LoginPage />;

  return <RouterProvider router={router} />;
}
