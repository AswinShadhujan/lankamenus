'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { getAdminToken, clearAdminToken } from '@/lib/api';

type UserMe = { id: number; email: string; name: string | null; role: string };

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = getAdminToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    api
      .get<UserMe>('/auth/me')
      .then((res) => setUser(res.data))
      .catch((err) => {
        if (err.response?.status === 401) {
          clearAdminToken();
          router.replace('/login');
        } else {
          clearAdminToken();
          router.replace('/login');
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await api.post('/auth/logout');
    } finally {
      clearAdminToken();
      setLogoutLoading(false);
      router.push('/');
      router.refresh();
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Redirecting to login…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-h1 mb-6" style={{ color: 'var(--text-primary)' }}>Account</h1>
      <div
        className="rounded-xl border p-4 space-y-2"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <p>
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>Email</span>
          <br />
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{user.email}</span>
        </p>
        {user.name && (
          <p>
            <span className="text-small" style={{ color: 'var(--text-secondary)' }}>Name</span>
            <br />
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{user.name}</span>
          </p>
        )}
        <p>
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>Role</span>
          <br />
          <span className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{user.role}</span>
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutLoading}
          className="w-full rounded-lg border py-2 font-medium transition-colors disabled:opacity-50"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          {logoutLoading ? 'Signing out…' : 'Log out'}
        </button>
        <Link
          href="/"
          className="block text-center text-small font-medium transition-opacity hover:opacity-80"
          style={{ color: 'var(--accent-primary)' }}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
